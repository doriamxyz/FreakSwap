#include "twist.h"
// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026. Upstream MIT license.

#include "stmlib/dsp/dsp.h"

// The MicroFreak firmware table has 1024 steps; upstream Plaits uses 512.
namespace stmlib {
template<typename T>
inline T MicroFreakSnareSineInterpolate(const T* table, float index, float size) {
  return Interpolate(table, index, size * 2.0f);
}
template<typename T>
inline T MicroFreakSnareSineInterpolateWrap(
    const T* table, float index, float size) {
  return InterpolateWrap(table, index, size * 2.0f);
}
}  // namespace stmlib

#define Interpolate MicroFreakSnareSineInterpolate
#define InterpolateWrap MicroFreakSnareSineInterpolateWrap
#include "plaits/dsp/engine/snare_drum_engine.h"
#undef Interpolate
#undef InterpolateWrap

extern "C" float fabsf(float value) {
  return value < 0.0f ? -value : value;
}

namespace plaits {

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

class MicroFreakSnareDrumEngine : public Engine {
 public:
  virtual void Init(BufferAllocator* allocator);
  virtual void Reset() { }
  virtual void LoadUserData(const uint8_t*) { }
  virtual void Render(const EngineParameters&, float*, float*, size_t, bool*);

 private:
  AnalogSnareDrum* analog_snare_drum_;
  SyntheticSnareDrum* synthetic_snare_drum_;
};

static_assert(sizeof(MicroFreakSnareDrumEngine) <= 132,
              "Snare Drum object does not fit the Formant slot");

void MicroFreakSnareDrumEngine::Init(BufferAllocator* allocator) {
  post_processing_settings.already_enveloped = true;
  post_processing_settings.out_gain = 0.8f;
  post_processing_settings.aux_gain = 0.8f;
  analog_snare_drum_ = allocator->Allocate<AnalogSnareDrum>();
  synthetic_snare_drum_ = allocator->Allocate<SyntheticSnareDrum>();
  analog_snare_drum_->Init();
  synthetic_snare_drum_->Init();
}

void MicroFreakSnareDrumEngine::Render(
    const EngineParameters& parameters, float* out, float* aux, size_t size,
    bool* already_enveloped) {
  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const bool sustain = parameters.trigger & TRIGGER_UNPATCHED;
  const bool trigger = parameters.trigger & TRIGGER_RISING_EDGE;
  analog_snare_drum_->Render(
      sustain, trigger, parameters.accent, f0, parameters.timbre,
      parameters.morph, parameters.harmonics, out, size);
  synthetic_snare_drum_->Render(
      sustain, trigger, parameters.accent, f0, parameters.timbre,
      parameters.morph, parameters.harmonics, aux, size);
  if (already_enveloped) {
    *already_enveloped = true;
  }
}

}  // namespace plaits
