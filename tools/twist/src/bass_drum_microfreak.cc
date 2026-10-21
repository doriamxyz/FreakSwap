#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "stmlib/dsp/dsp.h"

// The MicroFreak firmware table has 1024 steps. Redirect only the sine helper
// interpolation calls made while parsing the upstream drum headers; all other
// DSP interpolation keeps its original semantics.
namespace stmlib {
template<typename T>
inline T MicroFreakSineInterpolate(const T* table, float index, float size) {
  return Interpolate(table, index, size * 2.0f);
}
template<typename T>
inline T MicroFreakSineInterpolateWrap(const T* table, float index, float size) {
  return InterpolateWrap(table, index, size * 2.0f);
}
}  // namespace stmlib

#define Interpolate MicroFreakSineInterpolate
#define InterpolateWrap MicroFreakSineInterpolateWrap
#include "plaits/dsp/engine/bass_drum_engine.h"
#undef Interpolate
#undef InterpolateWrap

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

class MicroFreakBassDrumEngine : public Engine {
 public:
  virtual void Init(BufferAllocator* allocator);
  virtual void Reset() { }
  virtual void LoadUserData(const uint8_t*) { }
  virtual void Render(const EngineParameters&, float*, float*, size_t, bool*);

 private:
  AnalogBassDrum* analog_bass_drum_;
  SyntheticBassDrum* synthetic_bass_drum_;
  Overdrive overdrive_;
};

static_assert(sizeof(MicroFreakBassDrumEngine) <= 132,
              "Bass Drum object does not fit the Formant slot");

void MicroFreakBassDrumEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = true;
  post_processing_settings.out_gain = 0.8f;
  post_processing_settings.aux_gain = 0.8f;
  analog_bass_drum_ = allocator->Allocate<AnalogBassDrum>();
  synthetic_bass_drum_ = allocator->Allocate<SyntheticBassDrum>();
  analog_bass_drum_->Init();
  synthetic_bass_drum_->Init();
  overdrive_.Init();
}

void MicroFreakBassDrumEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float attack_fm_amount = min(parameters.harmonics * 4.0f, 1.0f) * TwistMacro(1.0f,0.25f,1.75f,TW_INDEX);
  const float self_fm_amount =
      max(min(parameters.harmonics * 4.0f - 1.0f, 1.0f), 0.0f);
  const float drive = max(parameters.harmonics * 2.0f - 1.0f, 0.0f) *
      max(1.0f - 16.0f * f0, 0.0f);
  const bool sustain = parameters.trigger & TRIGGER_UNPATCHED;
  const bool trigger = parameters.trigger & TRIGGER_RISING_EDGE;

  analog_bass_drum_->Render(
      sustain, trigger, parameters.accent, f0, parameters.timbre,
      parameters.morph, attack_fm_amount, self_fm_amount, out, size);
  overdrive_.Process(0.5f + 0.5f * drive, out, size);
  synthetic_bass_drum_->Render(
      sustain, trigger, parameters.accent, f0, parameters.timbre,
      parameters.morph,
      sustain ? parameters.harmonics
              : 0.4f - 0.25f * parameters.morph * parameters.morph,
      min(parameters.harmonics * 2.0f, 1.0f),
      max(parameters.harmonics * 2.0f - 1.0f, 0.0f), aux, size);
}

}  // namespace plaits
