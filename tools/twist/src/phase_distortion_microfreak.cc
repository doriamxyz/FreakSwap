#include "twist.h"
// Copyright 2021 Emilie Gillet.
// MicroFreak compatibility adaptation, 2026.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// Adaptation of Mutable Instruments' Phase Distortion engine for offline ARM
// candidates. Linking is verified offline; hardware validation is pending.

#include "plaits/dsp/engine2/phase_distortion_engine.h"

#include <algorithm>

#include "stmlib/dsp/parameter_interpolator.h"

#include "plaits/resources.h"

namespace plaits {

using namespace std;
using namespace stmlib;

namespace {

// Identified in firmware 5.0.0.2084. The initializer at 0x0802ff0c writes
// 55.0f / sample_rate here. Reading it avoids baking upstream's 47872.34 Hz
// compile-time assumption into the adapted engine.
const uintptr_t kMicroFreakPitchA0Address = 0x20000004;

inline float MicroFreakNoteToFrequency(float midi_note) {
  midi_note -= 9.0f;
  CONSTRAIN(midi_note, -128.0f, 127.0f);
  const volatile float* pitch_a0 =
      reinterpret_cast<const volatile float*>(kMicroFreakPitchA0Address);
  return *pitch_a0 * 0.25f * stmlib::SemitonesToRatio(midi_note);
}

// Arturia's table contains 1024 samples per cycle plus a 256-sample
// quadrature extension and endpoint (1281 floats total). Upstream Plaits 1.2
// uses 512 samples per cycle, so its Sine() helper cannot be reused directly.
inline float MicroFreakSine(float phase) {
  return stmlib::InterpolateWrap(lut_sine, phase, 1024.0f);
}

}  // namespace

void PhaseDistortionEngine::Init(BufferAllocator* allocator) {
  modulator_.Init();
  shaper_.Init();
  temp_buffer_ = allocator->Allocate<float>(kMaxBlockSize * 4);
}

void PhaseDistortionEngine::Reset() {
}

void PhaseDistortionEngine::Render(
    const EngineParameters& parameters,
    float* out,
    float* aux,
    size_t size,
    bool* already_enveloped) {
  const float f0 = 0.5f * MicroFreakNoteToFrequency(parameters.note);
  const float modulator_f = min(0.25f, f0 * TwistMacro(1.0f,0.5f,2.0f,TW_INDEX) * SemitonesToRatio(Interpolate(
      lut_fm_frequency_quantizer,
      parameters.harmonics,
      128.0f)));
  const float pw = 0.5f + parameters.morph * 0.49f;
  const float amount = 8.0f * parameters.timbre * parameters.timbre *
      (1.0f - modulator_f * 3.8f);

  float* synced = &temp_buffer_[0];
  float* free_running = &temp_buffer_[2 * size];
  shaper_.Render<true, true>(
      f0, modulator_f, pw, 0.0f, amount, synced, 2 * size);
  modulator_.Render<false, true>(
      f0, modulator_f, pw, 0.0f, amount, free_running, 2 * size);

  for (size_t i = 0; i < size; ++i) {
    out[i] = 0.5f * MicroFreakSine(*synced++ + 0.25f);
    out[i] += 0.5f * MicroFreakSine(*synced++ + 0.25f);

    aux[i] = 0.5f * MicroFreakSine(*free_running++ + 0.25f);
    aux[i] += 0.5f * MicroFreakSine(*free_running++ + 0.25f);
  }
}

}  // namespace plaits
