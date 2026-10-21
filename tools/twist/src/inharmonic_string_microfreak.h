// Copyright 2016 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026.
// Released under the upstream MIT license.

#ifndef MICROFREAK_INHARMONIC_STRING_ENGINE_H_
#define MICROFREAK_INHARMONIC_STRING_ENGINE_H_

#include "plaits/dsp/engine/engine.h"
#include "plaits/dsp/physical_modelling/string_voice.h"

namespace plaits {

const int kMicroFreakNumStrings = 3;

class MicroFreakInharmonicStringEngine : public Engine {
 public:
  MicroFreakInharmonicStringEngine() { }
  ~MicroFreakInharmonicStringEngine() { }

  virtual void Init(stmlib::BufferAllocator* allocator);
  virtual void Reset();
  virtual void LoadUserData(const uint8_t* user_data) { }
  virtual void Render(const EngineParameters& parameters,
      float* out,
      float* aux,
      size_t size,
      bool* already_enveloped);

 private:
  // Upstream embeds this array in the engine object. The Formant object span is
  // smaller, so the same three trivial-state objects live in the existing
  // per-engine allocator instead. Their DSP and delay-line sizes are unchanged.
  StringVoice* voice_;
  float f0_[kMicroFreakNumStrings];
  DelayLine<float, 16> f0_delay_;
  int active_string_;
  float* temp_buffer_;

  DISALLOW_COPY_AND_ASSIGN(MicroFreakInharmonicStringEngine);
};

}  // namespace plaits

#endif  // MICROFREAK_INHARMONIC_STRING_ENGINE_H_
