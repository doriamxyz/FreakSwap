#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "plaits/dsp/engine/particle_engine.h"

#include <algorithm>

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

void ParticleEngine::Init(BufferAllocator* allocator) {
  // Restore the upstream ParticleEngine post-processing settings rather than
  // inheriting the Chord slot's gain values.
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = -2.0f;
  post_processing_settings.aux_gain = 1.0f;
  for (int i = 0; i < kNumParticles; ++i) {
    particle_[i].Init();
  }
  diffuser_.Init(allocator->Allocate<uint16_t>(8192));
  post_filter_.Init();
}

void ParticleEngine::Reset() {
  diffuser_.Reset();
}

void ParticleEngine::Render(
    const EngineParameters& parameters,
    float* out,
    float* aux,
    size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float density_sqrt = MicroFreakNoteToFrequency(
      60.0f + parameters.timbre * parameters.timbre * 72.0f);
  const float density = density_sqrt * density_sqrt * (1.0f / kNumParticles);
  const float gain = 1.0f / density;
  const float q_sqrt = SemitonesToRatio(parameters.morph >= 0.5f
      ? (parameters.morph - 0.5f) * 120.0f
      : 0.0f);
  const float q = 0.5f + q_sqrt * q_sqrt;
  const float spread = 48.0f * parameters.harmonics * parameters.harmonics;
  const float raw_diffusion_sqrt = 2.0f * fabsf(parameters.morph - 0.5f);
  const float raw_diffusion = raw_diffusion_sqrt * raw_diffusion_sqrt;
  const float stock_diffusion=parameters.morph<0.5f?raw_diffusion:0.0f;
  const float diffusion=TwistMacro(stock_diffusion,0.0f,1.0f,TW_INDEX);
  const bool sync = parameters.trigger & TRIGGER_RISING_EDGE;

  fill(&out[0], &out[size], 0.0f);
  fill(&aux[0], &aux[size], 0.0f);
  for (int i = 0; i < kNumParticles; ++i) {
    particle_[i].Render(
        sync, density, gain, f0, spread, q, out, aux, size);
  }
  post_filter_.set_f_q<FREQUENCY_DIRTY>(min(f0, 0.49f), 0.5f);
  post_filter_.Process<FILTER_MODE_LOW_PASS>(out, out, size);
  diffuser_.Process(
      0.8f * diffusion * diffusion,
      0.5f * diffusion + 0.25f,
      out,
      size);
}

}  // namespace plaits
