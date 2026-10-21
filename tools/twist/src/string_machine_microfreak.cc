#include "twist.h"
// Copyright 2021 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include <algorithm>

#include "plaits/dsp/chords/chord_bank.h"
#include "plaits/dsp/engine/chord_engine.h"
#include "plaits/dsp/fx/fx_engine.h"
#include "plaits/resources.h"
#include "stmlib/dsp/filter.h"

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

// Arturia's embedded sine table has 1024 steps, whereas upstream Plaits 1.2
// builds SineRaw around a 512-step table. Keep the same 32-bit phase mapping
// while addressing the table actually present in firmware 5.0.0.2084.
inline float MicroFreakSineRaw(uint32_t phase) {
  return lut_sine[phase >> 22];
}

const int kRegistrationTableSize = 11;
const float kRegistrations[kRegistrationTableSize][kChordNumHarmonics * 2] = {
  { 1.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f },
  { 0.5f, 0.0f, 0.5f, 0.0f, 0.0f, 0.0f },
  { 0.4f, 0.0f, 0.2f, 0.0f, 0.4f, 0.0f },
  { 0.3f, 0.0f, 0.0f, 0.3f, 0.0f, 0.4f },
  { 0.3f, 0.0f, 0.0f, 0.0f, 0.0f, 0.7f },
  { 0.2f, 0.0f, 0.0f, 0.2f, 0.0f, 0.6f },
  { 0.0f, 0.2f, 0.1f, 0.0f, 0.2f, 0.5f },
  { 0.0f, 0.3f, 0.0f, 0.3f, 0.0f, 0.4f },
  { 0.0f, 0.4f, 0.0f, 0.3f, 0.0f, 0.3f },
  { 0.0f, 0.5f, 0.0f, 0.5f, 0.0f, 0.0f },
  { 0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 0.0f },
};

class MicroFreakEnsemble {
 public:
  typedef FxEngine<1024, FORMAT_32_BIT> E;

  void Init(E::T* buffer) {
    engine_.Init(buffer);
    phase_1_ = phase_2_ = 0;
  }
  void Reset() { engine_.Clear(); }
  void set_amount(float amount) { amount_ = amount; }
  void set_depth(float depth) { depth_ = depth; }

  void Process(float* left, float* right, size_t size) {
    typedef E::Reserve<511, E::Reserve<511> > Memory;
    E::DelayLine<Memory, 0> line_l;
    E::DelayLine<Memory, 1> line_r;
    E::Context c;
    while (size--) {
      engine_.Start(&c);
      const float dry_amount = 1.0f - amount_ * 0.5f;
      const uint32_t one_third = 1417339207UL;
      const uint32_t two_third = 2834678415UL;
      phase_1_ += 67289;
      phase_2_ += 589980;
      const float slow_0 = MicroFreakSineRaw(phase_1_);
      const float slow_120 = MicroFreakSineRaw(phase_1_ + one_third);
      const float slow_240 = MicroFreakSineRaw(phase_1_ + two_third);
      const float fast_0 = MicroFreakSineRaw(phase_2_);
      const float fast_120 = MicroFreakSineRaw(phase_2_ + one_third);
      const float fast_240 = MicroFreakSineRaw(phase_2_ + two_third);
      const float a = depth_ * 160.0f;
      const float b = depth_ * 16.0f;
      const float mod_1 = slow_0 * a + fast_0 * b;
      const float mod_2 = slow_120 * a + fast_120 * b;
      const float mod_3 = slow_240 * a + fast_240 * b;
      float wet = 0.0f;
      c.Read(*left, 1.0f); c.Write(line_l, 0.0f);
      c.Read(*right, 1.0f); c.Write(line_r, 0.0f);
      c.Interpolate(line_l, mod_1 + 192, 0.33f);
      c.Interpolate(line_l, mod_2 + 192, 0.33f);
      c.Interpolate(line_r, mod_3 + 192, 0.33f);
      c.Write(wet, 0.0f);
      *left = wet * amount_ + *left * dry_amount;
      c.Interpolate(line_r, mod_1 + 192, 0.33f);
      c.Interpolate(line_r, mod_2 + 192, 0.33f);
      c.Interpolate(line_l, mod_3 + 192, 0.33f);
      c.Write(wet, 0.0f);
      *right = wet * amount_ + *right * dry_amount;
      ++left; ++right;
    }
  }

 private:
  E engine_;
  float amount_;
  float depth_;
  uint32_t phase_1_;
  uint32_t phase_2_;
};

}  // namespace

class MicroFreakStringMachineEngine : public Engine {
 public:
  virtual void Init(BufferAllocator* allocator);
  virtual void Reset();
  virtual void LoadUserData(const uint8_t*) { }
  virtual void Render(const EngineParameters&, float*, float*, size_t, bool*);

 private:
  void ComputeRegistration(float registration, float* amplitudes);
  ChordBank chords_;
  MicroFreakEnsemble ensemble_;
  StringSynthOscillator divide_down_voice_[kChordNumNotes];
  NaiveSvf svf_[2];
  float morph_lp_;
  float timbre_lp_;
};

static_assert(sizeof(MicroFreakStringMachineEngine) == 272,
              "String Machine object no longer fits the Chords slot");

void MicroFreakStringMachineEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = 0.8f;
  post_processing_settings.aux_gain = 0.8f;
  for (int i = 0; i < kChordNumNotes; ++i) divide_down_voice_[i].Init();
  chords_.Init(allocator);
  morph_lp_ = timbre_lp_ = 0.0f;
  svf_[0].Init(); svf_[1].Init();
  ensemble_.Init(allocator->Allocate<MicroFreakEnsemble::E::T>(1024));

  // Arturia's seven-engine dispatcher calls Init at boot and LoadUserData on
  // selection, but unlike upstream Plaits it does not call Reset. Populate the
  // chord ratios and clear the delay memory here so the first render is valid.
  chords_.Reset();
  ensemble_.Reset();
}

void MicroFreakStringMachineEngine::Reset() {
  chords_.Reset();
  ensemble_.Reset();
}

void MicroFreakStringMachineEngine::ComputeRegistration(
    float registration, float* amplitudes) {
  registration *= kRegistrationTableSize - 1.001f;
  MAKE_INTEGRAL_FRACTIONAL(registration);
  for (int i = 0; i < kChordNumHarmonics * 2; ++i) {
    const float a = kRegistrations[registration_integral][i];
    const float b = kRegistrations[registration_integral + 1][i];
    amplitudes[i] = a + (b - a) * registration_fractional;
  }
}

void MicroFreakStringMachineEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  ONE_POLE(morph_lp_, parameters.morph, 0.1f);
  ONE_POLE(timbre_lp_, parameters.timbre, 0.1f);
  chords_.set_chord(parameters.harmonics);
  float harmonics[kChordNumHarmonics * 2 + 2];
  ComputeRegistration(max(morph_lp_, 0.0f), harmonics);
  harmonics[kChordNumHarmonics * 2] = 0.0f;
  fill(&out[0], &out[size], 0.0f);
  fill(&aux[0], &aux[size], 0.0f);
  const float f0 = MicroFreakNoteToFrequency(parameters.note) * 0.998f;
  for (int note = 0; note < kChordNumNotes; ++note) {
    const float note_f0 = f0 * chords_.ratio(note);
    float gain = 4.0f - note_f0 * 32.0f;
    CONSTRAIN(gain, 0.0f, 1.0f);
    divide_down_voice_[note].Render(
        note_f0, harmonics, 0.25f * gain, note & 1 ? aux : out, size);
  }
  const float cutoff = 2.2f * f0 * SemitonesToRatio(120.0f * parameters.timbre);
  svf_[0].set_f_q<FREQUENCY_DIRTY>(cutoff, 1.0f);
  svf_[1].set_f_q<FREQUENCY_DIRTY>(cutoff * 1.5f, 1.0f);
  for (size_t i = 0; i < size; ++i) {
    const float l = svf_[0].Process<FILTER_MODE_LOW_PASS>(out[i]);
    const float r = svf_[1].Process<FILTER_MODE_LOW_PASS>(aux[i]);
    out[i] = 0.66f * l + 0.33f * r;
    aux[i] = 0.66f * r + 0.33f * l;
  }
  const float amount = TwistMacro(fabsf(parameters.timbre-0.5f)*2.0f,0.0f,1.0f,TW_INDEX);
  ensemble_.set_amount(amount);
  ensemble_.set_depth(0.35f + 0.65f * parameters.timbre);
  ensemble_.Process(out, aux, size);
}

}  // namespace plaits

// Pull in the upstream chord definitions without modifying the synced source.
#include "plaits/dsp/chords/chord_bank.cc"
