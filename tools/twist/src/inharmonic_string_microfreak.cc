#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026.
// Released under the upstream MIT license.

#include "inharmonic_string_microfreak.h"

#include <algorithm>

// Compile the unmodified upstream physical string and voice implementation in
// this relocatable unit. Files under vendor/ remain read-only.
#include "plaits/dsp/physical_modelling/string.cc"
#include "plaits/dsp/physical_modelling/string_voice.cc"

extern "C" float fabsf(float value) {
  return value < 0.0f ? -value : value;
}

namespace plaits {

using namespace std;
using namespace stmlib;

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

void MicroFreakInharmonicStringEngine::Init(BufferAllocator* allocator) {
  // Formant is registered as an externally enveloped oscillator. Restore the
  // original Plaits StringEngine post-processing contract so plucked tails are
  // not cut by the host LPG and the original limiter/gain behavior is used.
  post_processing_settings.already_enveloped = true;
  post_processing_settings.out_gain = -1.0f;
  post_processing_settings.aux_gain = 0.8f;
  voice_ = allocator->Allocate<StringVoice>(kMicroFreakNumStrings);
  temp_buffer_ = allocator->Allocate<float>(kMaxBlockSize);
  for (int i = 0; i < kMicroFreakNumStrings; ++i) {
    voice_[i].Init(allocator);
    f0_[i] = 0.01f;
  }
  active_string_ = kMicroFreakNumStrings - 1;
  f0_delay_.Init(allocator->Allocate<float>(16));
}

void MicroFreakInharmonicStringEngine::Reset() {
  f0_delay_.Reset();
  for (int i = 0; i < kMicroFreakNumStrings; ++i) {
    voice_[i].Reset();
  }
}

void MicroFreakInharmonicStringEngine::Render(
    const EngineParameters& parameters,
    float* out,
    float* aux,
    size_t size,
    bool* already_enveloped) {
  if (parameters.trigger & TRIGGER_RISING_EDGE) {
    f0_[active_string_] = f0_delay_.Read(14);
    active_string_ = (active_string_ + 1) % kMicroFreakNumStrings;
  }

  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  f0_[active_string_] = f0;
  f0_delay_.Write(f0);

  fill(&out[0], &out[size], 0.0f);
  fill(&aux[0], &aux[size], 0.0f);

  for (int i = 0; i < kMicroFreakNumStrings; ++i) {
    voice_[i].Render(
        parameters.trigger & TRIGGER_UNPATCHED && i == active_string_,
        parameters.trigger & TRIGGER_RISING_EDGE && i == active_string_,
        parameters.accent,
        f0_[i],
        parameters.harmonics,
        parameters.timbre * parameters.timbre,
        parameters.morph,
        temp_buffer_,
        out,
        aux,
        size);
  }
}

}  // namespace plaits

// Pull lookup resources into individual ELF data sections. The offline linker
// keeps only lut_svf_shift; all other upstream tables are discarded.
#include "plaits/resources.cc"
