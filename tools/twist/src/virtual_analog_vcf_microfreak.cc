#include "twist.h"
// Copyright 2021 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "plaits/dsp/engine2/virtual_analog_vcf_engine.h"

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

struct MicroFreakVirtualAnalogVCFState {
  Svf svf[2];
  VariableShapeOscillator oscillator;
  VariableShapeOscillator sub_oscillator;
  float previous_cutoff;
  float previous_stage2_gain;
  float previous_q;
  float previous_gain;
  float previous_sub_gain;
};

class MicroFreakVirtualAnalogVCFEngine : public Engine {
 public:
  virtual void Init(BufferAllocator* allocator);
  virtual void Reset();
  virtual void LoadUserData(const uint8_t*) { }
  virtual void Render(const EngineParameters&, float*, float*, size_t, bool*);

 private:
  MicroFreakVirtualAnalogVCFState* state_;
};

static_assert(sizeof(MicroFreakVirtualAnalogVCFEngine) <= 132,
              "Virtual Analog VCF object does not fit the Formant slot");

void MicroFreakVirtualAnalogVCFEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = false;
  post_processing_settings.out_gain = 1.0f;
  post_processing_settings.aux_gain = 1.0f;
  state_ = allocator->Allocate<MicroFreakVirtualAnalogVCFState>();
  state_->oscillator.Init();
  state_->sub_oscillator.Init();
  state_->svf[0].Init();
  state_->svf[1].Init();
  state_->previous_sub_gain = 0.0f;
  state_->previous_cutoff = 0.0f;
  state_->previous_stage2_gain = 0.0f;
  state_->previous_q = 0.0f;
  state_->previous_gain = 0.0f;
}

void MicroFreakVirtualAnalogVCFEngine::Reset() { }

void MicroFreakVirtualAnalogVCFEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);

  float shape = (parameters.morph - 0.25f) * 2.0f + 0.5f;
  CONSTRAIN(shape, 0.5f, 1.0f);
  float pw = (parameters.morph - 0.5f) * 2.0f + 0.5f;
  if (parameters.morph > 0.75f) {
    pw = 2.5f - parameters.morph * 2.0f;
  }
  CONSTRAIN(pw, 0.5f, 0.98f);
  const float sub_gain =
      max(fabsf(parameters.morph - 0.5f) - 0.3f, 0.0f) * 5.0f;

  state_->oscillator.Render(f0, pw, shape, out, size);
  state_->sub_oscillator.Render(f0 * 0.501f, 0.5f, 1.0f, aux, size);

  const float target_cutoff = f0 * SemitonesToRatio(
      (parameters.timbre - 0.2f) * 120.0f);
  float stage2_gain = 1.0f - (parameters.harmonics - 0.4f) * 4.0f;
  CONSTRAIN(stage2_gain, 0.0f, 1.0f);
  const float resonance = 2.667f *
      max(fabsf(parameters.harmonics - 0.5f) - 0.125f, 0.0f);
  const float resonance_sqr = resonance * resonance;
  const float q = resonance_sqr * resonance_sqr * 48.0f;
  float target_gain = (parameters.harmonics - 0.7f) + 0.85f;
  CONSTRAIN(target_gain, 0.7f - resonance_sqr * 0.3f, 1.0f);

  ParameterInterpolator sub_gain_modulation(
      &state_->previous_sub_gain, sub_gain, size);
  ParameterInterpolator cutoff_modulation(
      &state_->previous_cutoff, target_cutoff, size);
  ParameterInterpolator stage2_gain_modulation(
      &state_->previous_stage2_gain, stage2_gain, size);
  ParameterInterpolator q_modulation(&state_->previous_q, q, size);
  ParameterInterpolator gain_modulation(
      &state_->previous_gain, target_gain, size);

  for (size_t i = 0; i < size; ++i) {
    const float cutoff = min(cutoff_modulation.Next(), 0.25f);
    const float sample_q = q_modulation.Next();
    const float sample_stage2_gain = stage2_gain_modulation.Next();
    state_->svf[0].set_f_q<FREQUENCY_FAST>(cutoff, 0.5f + sample_q);
    state_->svf[1].set_f_q<FREQUENCY_FAST>(
        cutoff, 0.5f + 0.025f * sample_q);
    const float gain = gain_modulation.Next();
    const float drive=TwistMacro(1.0f,0.5f,2.0f,TW_INDEX);
    const float input = SoftClip(
        (out[i] + aux[i] * sub_gain_modulation.Next()) * gain * drive) / drive;
    float lp;
    float hp;
    state_->svf[0].Process<FILTER_MODE_LOW_PASS, FILTER_MODE_HIGH_PASS>(
        input, &lp, &hp);
    lp = SoftClip(lp * gain);
    lp += sample_stage2_gain *
        (SoftClip(state_->svf[1].Process<FILTER_MODE_LOW_PASS>(lp)) - lp);
    out[i] = lp;
    aux[i] = SoftClip(hp * gain);
  }
  if (already_enveloped) {
    *already_enveloped = false;
  }
}

}  // namespace plaits
