#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026.
// Released under the upstream MIT license.

#include <algorithm>

#include "plaits/dsp/engine/engine.h"
#include "plaits/dsp/engine/swarm_engine.h"
#include "plaits/dsp/oscillator/sine_oscillator.h"
#include "plaits/resources.h"
#include "stmlib/dsp/parameter_interpolator.h"
#include "stmlib/dsp/units.h"
#include "stmlib/utils/random.h"

extern "C" float fabsf(float value) {
  return value < 0.0f ? -value : value;
}

namespace plaits {

using namespace std;
using namespace stmlib;

namespace {

const int kMicroFreakNumSwarmVoices = 8;

inline float MicroFreakNoteToFrequency(float midi_note) {
  midi_note -= 9.0f;
  CONSTRAIN(midi_note, -128.0f, 127.0f);
#ifdef MICROFREAK_NATIVE_TEST
  const float pitch_a0 = 55.0f / kCorrectedSampleRate;
#else
  const volatile float* pitch_a0 =
      reinterpret_cast<const volatile float*>(0x20000004);
#endif
#ifdef MICROFREAK_NATIVE_TEST
  return pitch_a0 * 0.25f * SemitonesToRatio(midi_note);
#else
  return *pitch_a0 * 0.25f * SemitonesToRatio(midi_note);
#endif
}

// MicroFreak 5.0.0.2084 contains Arturia's 1024-step sine table. Plaits 1.2
// normally compiles this envelope against a 512-step table.
inline float MicroFreakSine(float phase) {
  return InterpolateWrap(lut_sine, phase, 1024.0f);
}

class MicroFreakGrainEnvelope {
 public:
  void Init() {
    from_ = 0.0f;
    interval_ = 1.0f;
    phase_ = 1.0f;
    fm_ = 0.0f;
    amplitude_ = 0.5f;
    previous_size_ratio_ = 0.0f;
    filter_coefficient_ = 0.0f;
  }

  inline void Step(float rate, bool burst_mode, bool start_burst) {
    bool randomize = false;
    if (start_burst) {
      phase_ = 0.5f;
      fm_ = 16.0f;
      randomize = true;
    } else {
      phase_ += rate * fm_;
      if (phase_ >= 1.0f) {
        phase_ -= static_cast<float>(static_cast<int>(phase_));
        randomize = true;
      }
    }
    if (randomize) {
      from_ += interval_;
      interval_ = Random::GetFloat() - from_;
      fm_ = burst_mode
          ? fm_ * (0.8f + 0.2f * Random::GetFloat())
          : 0.5f + 1.5f * Random::GetFloat();
    }
  }

  inline float frequency(float size_ratio) const {
    return size_ratio < 1.0f
        ? 2.0f * (from_ + interval_ * phase_) - 1.0f
        : from_;
  }

  inline float amplitude(float size_ratio) {
    float target_amplitude = 1.0f;
    if (size_ratio >= 1.0f) {
      float phase = (phase_ - 0.5f) * size_ratio;
      CONSTRAIN(phase, -1.0f, 1.0f);
      const float e = MicroFreakSine(0.5f * phase + 1.25f);
      target_amplitude = 0.5f * (e + 1.0f);
    }
    if ((size_ratio >= 1.0f) ^ (previous_size_ratio_ >= 1.0f)) {
      filter_coefficient_ = 0.5f;
    }
    filter_coefficient_ *= 0.95f;
    previous_size_ratio_ = size_ratio;
    ONE_POLE(amplitude_, target_amplitude, 0.5f - filter_coefficient_);
    return amplitude_;
  }

 private:
  float from_;
  float interval_;
  float phase_;
  float fm_;
  float amplitude_;
  float previous_size_ratio_;
  float filter_coefficient_;
};

class MicroFreakSwarmVoice {
 public:
  void Init(float rank) {
    rank_ = rank;
    envelope_.Init();
    saw_.Init();
    sine_.Init();
  }

  void Render(float f0, float density, bool burst_mode, bool start_burst,
              float spread, float size_ratio, float* saw, float* sine,
              size_t size) {
    envelope_.Step(density, burst_mode, start_burst);
    const float amplitude = envelope_.amplitude(size_ratio) /
        static_cast<float>(kMicroFreakNumSwarmVoices);
    const float expo_amount = envelope_.frequency(size_ratio);
    f0 *= SemitonesToRatio(48.0f * expo_amount * spread * rank_);
    const float linear_amount = rank_ * (rank_ + 0.01f) * spread * 0.25f;
    f0 *= 1.0f + linear_amount;
    saw_.Render(f0, amplitude, saw, size);
    sine_.Render(f0, amplitude, sine, size);
  }

 private:
  float rank_;
  MicroFreakGrainEnvelope envelope_;
  AdditiveSawOscillator saw_;
  FastSineOscillator sine_;
};

}  // namespace

class MicroFreakSwarmEngine : public Engine {
 public:
  virtual void Init(BufferAllocator* allocator);
  virtual void Reset();
  virtual void LoadUserData(const uint8_t*) { }
  virtual void Render(const EngineParameters&, float*, float*, size_t, bool*);

 private:
  void InitializeVoices();
  MicroFreakSwarmVoice* swarm_voice_;
};

static_assert(sizeof(MicroFreakSwarmEngine) <= 132,
              "Swarm object no longer fits the Formant slot");

void MicroFreakSwarmEngine::InitializeVoices() {
  const float n = (kMicroFreakNumSwarmVoices - 1) * 0.5f;
  for (int i = 0; i < kMicroFreakNumSwarmVoices; ++i) {
    swarm_voice_[i].Init((static_cast<float>(i) - n) / n);
  }
}

void MicroFreakSwarmEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = 0.8f;
  post_processing_settings.aux_gain = 0.8f;
  swarm_voice_ = allocator->Allocate<MicroFreakSwarmVoice>(
      kMicroFreakNumSwarmVoices);
  // Arturia selects engines without reliably calling Reset.
  InitializeVoices();
}

void MicroFreakSwarmEngine::Reset() {
  InitializeVoices();
}

void MicroFreakSwarmEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float control_rate = static_cast<float>(size);
  const float density = MicroFreakNoteToFrequency(parameters.timbre * 120.0f) *
      0.025f * control_rate;
  const float spread = parameters.harmonics * parameters.harmonics *
      parameters.harmonics;
  float size_ratio = 0.25f * SemitonesToRatio(
      (1.0f - parameters.morph) * 84.0f);
  const bool burst_mode = !(parameters.trigger & TRIGGER_UNPATCHED);
  const bool start_burst = parameters.trigger & TRIGGER_RISING_EDGE;

  fill(&out[0], &out[size], 0.0f);
  fill(&aux[0], &aux[size], 0.0f);
  for (int i = 0; i < kMicroFreakNumSwarmVoices; ++i) {
    swarm_voice_[i].Render(
        f0, density, burst_mode, start_burst, spread, size_ratio,
        out, aux, size);
    size_ratio *= TwistMacro(0.97f,0.86f,1.04f,TW_INDEX);
  }
  if (already_enveloped) {
    *already_enveloped = false;
  }
}

}  // namespace plaits
