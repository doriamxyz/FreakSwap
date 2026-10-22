#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "plaits/dsp/engine/noise_engine.h"

#include <algorithm>

#include "stmlib/dsp/parameter_interpolator.h"

extern "C" float fabsf(float value) {
  return value < 0.0f ? -value : value;
}

namespace plaits {

using namespace std;
using namespace stmlib;

namespace {

inline float MicroFreakNoteToFrequency(float midi_note) {
  midi_note -= 9.0f;
  CONSTRAIN(midi_note, -128.0f, 127.0f);
#ifdef MICROFREAK_NATIVE_TEST
  const float pitch_a0 = 55.0f / kCorrectedSampleRate;
  return pitch_a0 * 0.25f * SemitonesToRatio(midi_note);
#else
  const volatile float* pitch_a0 =
      reinterpret_cast<const volatile float*>(0x20000004);
  return *pitch_a0 * 0.25f * SemitonesToRatio(midi_note);
#endif
}

}  // namespace

#ifdef MICROFREAK_NATIVE_TEST
static_assert(sizeof(NoiseEngine) <= 136,
#else
static_assert(sizeof(NoiseEngine) <= 132,
#endif
              "Filtered Noise object does not fit the Formant slot");

void NoiseEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = 1.0f;
  post_processing_settings.aux_gain = 1.0f;
  clocked_noise_[0].Init();
  clocked_noise_[1].Init();
  lp_hp_filter_.Init();
  bp_filter_[0].Init();
  bp_filter_[1].Init();
  previous_f0_ = 0.0f;
  previous_f1_ = 0.0f;
  previous_q_ = 0.0f;
  previous_mode_ = 0.0f;
  temp_buffer_ = allocator->Allocate<float>(kMaxBlockSize);
}

void NoiseEngine::Reset() { }

void NoiseEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  float* const main_out = out;
  float* const aux_out = aux;
  const size_t block_size = size;
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float f1 = MicroFreakNoteToFrequency(
      parameters.note + parameters.harmonics * 48.0f - 24.0f);
  const float clock_lowest_note = parameters.trigger & TRIGGER_UNPATCHED
      ? 0.0f : -24.0f;
  const float clock_f = MicroFreakNoteToFrequency(
      parameters.timbre * (128.0f - clock_lowest_note) + clock_lowest_note);
  const float q = 0.5f * SemitonesToRatio(parameters.morph * 120.0f);
  const bool sync = parameters.trigger & TRIGGER_RISING_EDGE;
  clocked_noise_[0].Render(sync, clock_f, aux, size);
  clocked_noise_[1].Render(sync, clock_f * f1 / f0, temp_buffer_, size);

  ParameterInterpolator f0_modulation(&previous_f0_, f0, size);
  ParameterInterpolator f1_modulation(&previous_f1_, f1, size);
  ParameterInterpolator q_modulation(&previous_q_, q, size);
  ParameterInterpolator mode_modulation(
      &previous_mode_, TwistMacro(parameters.harmonics,0.0f,1.0f,TW_INDEX), size);
  const float* in_1 = aux;
  const float* in_2 = temp_buffer_;
  while (size--) {
    const float sample_f0 = f0_modulation.Next();
    const float sample_f1 = f1_modulation.Next();
    const float sample_q = q_modulation.Next();
    const float gain = 1.0f / Sqrt(
        (0.5f + sample_q) * 40.0f * sample_f0);
    lp_hp_filter_.set_f_q<FREQUENCY_ACCURATE>(sample_f0, sample_q);
    bp_filter_[0].set_f_q<FREQUENCY_ACCURATE>(sample_f0, sample_q);
    bp_filter_[1].set_f_q<FREQUENCY_ACCURATE>(sample_f1, sample_q);
    float input_1 = *in_1++ * gain;
    const float input_2 = *in_2++ * gain;
    lp_hp_filter_.ProcessMultimodeLPtoHP(
        &input_1, out++, 1, mode_modulation.Next());
    *aux++ = bp_filter_[0].Process<FILTER_MODE_BAND_PASS>(input_1) +
        bp_filter_[1].Process<FILTER_MODE_BAND_PASS>(input_2);
  }
#ifdef MICROFREAK_FILTERED_NOISE_AUX_MAIN
  // Controlled A/B variant: expose the two resonant band-pass noise bands on
  // the MicroFreak's audible oscillator path.
  copy(&aux_out[0], &aux_out[block_size], &main_out[0]);
#endif
  if (already_enveloped) {
    *already_enveloped = false;
  }
}

}  // namespace plaits
