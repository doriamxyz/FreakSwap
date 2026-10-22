#include "twist.h"
// Copyright 2021 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "plaits/dsp/engine2/chiptune_engine.h"

#include <algorithm>

extern "C" float fabsf(float value) {
  return value < 0.0f ? -value : value;
}

namespace plaits {

using namespace std;
using namespace stmlib;

static_assert(sizeof(ChiptuneEngine) == 260,
              "Chiptune object no longer fits the Chords slot");

namespace {

const uintptr_t kMicroFreakPitchA0Address = 0x20000004;

inline float MicroFreakNoteToFrequency(float midi_note) {
  midi_note -= 9.0f;
  CONSTRAIN(midi_note, -128.0f, 127.0f);
  const volatile float* pitch_a0 =
      reinterpret_cast<const volatile float*>(kMicroFreakPitchA0Address);
  return *pitch_a0 * 0.25f * stmlib::SemitonesToRatio(midi_note);
}

}  // namespace

const uint8_t kRegisterVoicings[9][kChordNumVoices] = {
  { 0, 0, 0, 0, 0 },
  { 1, 0, 0, 0, 0 },
  { 0, 1, 0, 0, 0 },
  { 0, 0, 0, 0, 1 },
  { 0, 0, 0, 0, 0 },  // Stock voicing is handled separately.
  { 0, 0, 0, 1, 1 },
  { 0, 0, 1, 1, 2 },
  { 0, 1, 1, 2, 2 },
  { 0, 1, 2, 3, 4 },
};

void ChiptuneEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = 0.5f;
  post_processing_settings.aux_gain = 0.5f;
  bass_.Init();
  for (int i = 0; i < kChordNumNotes; ++i) voice_[i].Init();
  chords_.Init(allocator);
  arpeggiator_.Init();
  arpeggiator_pattern_selector_.Init(12, 0.075f, false);
  register_spread_selector_.Init(9,0.075f,false);
  envelope_shape_ = NO_ENVELOPE;
  envelope_state_ = 0.0f;
  aux_envelope_amount_ = 0.0f;

  // Arturia does not call the upstream Reset hook after selecting an engine.
  chords_.Reset();
}

void ChiptuneEngine::Reset() {
  chords_.Reset();
  arpeggiator_.Reset();
}

void ChiptuneEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float shape = parameters.morph * 0.995f;
  const bool clocked = !(parameters.trigger & TRIGGER_UNPATCHED);
  const int register_mode=register_spread_selector_.Process(TwistValue(TW_INDEX));
  float root_transposition = 1.0f;

  // The stock MicroFreak voice supplies its own gate/LPG envelope and has no
  // equivalent of Plaits' Chiptune-specific envelope-shape setter.
  *already_enveloped = false;

  if (clocked) {
    if (parameters.trigger & TRIGGER_RISING_EDGE) {
      chords_.set_chord(parameters.harmonics);
      chords_.Sort();
      const int pattern = arpeggiator_pattern_selector_.Process(parameters.timbre);
      arpeggiator_.set_mode(ArpeggiatorMode(pattern / 3));
      arpeggiator_.set_range(1 << (pattern % 3));
      arpeggiator_.Clock(chords_.num_notes());
    }
    const float octave = float(1 << arpeggiator_.octave());
    const float note_f0 =
        f0 * chords_.sorted_ratio(arpeggiator_.note()) * (register_mode==4?octave:float(1<<kRegisterVoicings[register_mode][arpeggiator_.note()]));
    root_transposition = octave;
    voice_[0].Render(note_f0, shape, out, size);
  } else {
    float ratios[kChordNumVoices];
    float amplitudes[kChordNumVoices];
    chords_.set_chord(parameters.harmonics);
    chords_.ComputeChordInversion(parameters.timbre, ratios, amplitudes);
    if (register_mode != 4) {
      float compact_ratios[kChordNumVoices];
      for (int voice = 0; voice < kChordNumVoices; ++voice) {
        float ratio = ratios[voice];
        while (ratio < 0.5f) {
          ratio *= 2.0f;
        }
        while (ratio >= 1.0f) {
          ratio *= 0.5f;
        }
        compact_ratios[voice] = ratio;
      }

      for (int voice = 0; voice < kChordNumVoices; ++voice) {
        int rank = 0;
        for (int other = 0; other < kChordNumVoices; ++other) {
          if (compact_ratios[other] < compact_ratios[voice] || \
              (compact_ratios[other] == compact_ratios[voice] && \
                  other < voice)) {
            ++rank;
          }
        }
        ratios[voice] = compact_ratios[voice] * float(
            1 << kRegisterVoicings[register_mode][rank]);
      }
    }

    for (int j = 1; j < kChordNumVoices; j += 2) amplitudes[j] = -amplitudes[j];
    fill(&out[0], &out[size], 0.0f);
    for (int voice = 0; voice < kChordNumVoices; ++voice) {
      const float voice_f0 = f0 * ratios[voice];
      voice_[voice].Render(voice_f0, shape, aux, size);
      for (size_t j = 0; j < size; ++j) out[j] += aux[j] * amplitudes[voice];
    }
  }

  bass_.Render(f0 * 0.5f * root_transposition, aux, size);
}

}  // namespace plaits

// Pull in upstream chord definitions without modifying synced source material.
#include "plaits/dsp/chords/chord_bank.cc"
