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

// Plaits 1.2 Wave Terrain adaptation for the MicroFreak ABI. The five compact
// procedural terrains are preserved exactly. The three upstream terrains that
// reinterpret Plaits' 50,688-byte wav_integrated_waves resource are omitted:
// that resource is absent from the MicroFreak main image and cannot fit in the
// isolated 5,644-byte Formant replacement window. This is therefore a bounded
// five-terrain feasibility build, not a byte-for-byte full eight-terrain port.

#include "wave_terrain_microfreak.h"

#include <algorithm>
#include <cmath>

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

inline float MicroFreakSine(float phase) {
  return stmlib::InterpolateWrap(lut_sine, phase, 1024.0f);
}

inline float FastAbs(float x) {
  return x < 0.0f ? -x : x;
}

inline float Squash(float x, float amount) {
  x *= amount;
  return x / (1.0f + FastAbs(x));
}

}  // namespace

void WaveTerrainEngine::Init(BufferAllocator* allocator) {
  path_.Init();
  offset_ = 0.0f;
  y_offset_ = 0.0f;
  terrain_ = 0.0f;
  temp_buffer_ = allocator->Allocate<float>(kMaxBlockSize * 4);
}

void WaveTerrainEngine::Reset() {
}

float WaveTerrainEngine::Terrain(float x, float y, int terrain_index) {
  // These are the five procedural terrain functions from Plaits 1.2. The
  // positive phase offset is required by the original Sine helper contract.
  const float k = 4.0f;
  switch (terrain_index) {
    case 0:
      return (Squash(MicroFreakSine(k + x * 1.273f), 2.0f) -
          MicroFreakSine(k + y * (x + 1.571f) * 0.637f)) * 0.57f;

    case 1: {
      const float xy = x * y;
      return MicroFreakSine(
          k + MicroFreakSine(k + (x + y) * 0.637f) /
          (0.2f + xy * xy) * 0.159f);
    }

    case 2: {
      const float xy = x * y;
      return MicroFreakSine(
          k + MicroFreakSine(k + 2.387f * xy) /
          (0.350f + xy * xy) * 0.159f);
    }

    case 3: {
      const float xy = x * y;
      const float xys = (x - 0.25f) * (y + 0.25f);
      return MicroFreakSine(
          k + xy / (2.0f + FastAbs(5.0f * xys)) * 6.366f);
    }

    case 4:
      return MicroFreakSine(
          0.159f / (0.170f + FastAbs(y - 0.25f)) +
          0.477f / (0.350f + FastAbs((x + 0.5f) * (y + 1.5f))) + k);
  }
  return 0.0f;
}

void WaveTerrainEngine::Render(
    const EngineParameters& parameters,
    float* out,
    float* aux,
    size_t size,
    bool* already_enveloped) {
  const size_t kOversampling = 2;
  const float kScale = 1.0f / float(kOversampling);

  float* path_x = &temp_buffer_[0];
  float* path_y = &temp_buffer_[kOversampling * size];

  const float f0 = MicroFreakNoteToFrequency(parameters.note);
  const float attenuation = max(1.0f - 8.0f * f0, 0.0f);
  const float radius = 0.1f + 0.9f * parameters.timbre * attenuation *
      (2.0f - attenuation);

  path_.RenderQuadrature(
      f0 * kScale, radius, path_x, path_y, size * kOversampling);

  ParameterInterpolator offset(&offset_, 1.9f * parameters.morph - 1.0f, size);
  ParameterInterpolator y_offset(&y_offset_,1.9f*TwistValue(TW_INDEX)-0.95f,size);
  const int num_terrains = 5;
  ParameterInterpolator terrain(
      &terrain_,
      min(parameters.harmonics * 1.05f, 1.0f) *
          float(num_terrains - 1.0001f),
      size);

  size_t ij = 0;
  for (size_t i = 0; i < size; ++i) {
    const float x_offset = offset.Next();
    const float y_shift=y_offset.Next();
    const float z = terrain.Next();
    MAKE_INTEGRAL_FRACTIONAL(z);

    float out_s = 0.0f;
    float aux_s = 0.0f;
    for (size_t j = 0; j < kOversampling; ++j) {
      const float x = path_x[ij] * (1.0f - FastAbs(x_offset)) + x_offset;
      const float y = path_y[ij]*(1.0f-FastAbs(y_shift))+y_shift;
      ++ij;

      const float z0 = Terrain(x, y, z_integral);
      const float z1 = Terrain(x, y, z_integral + 1);
      const float terrain_height = z0 + (z1 - z0) * z_fractional;
      out_s += terrain_height;
      aux_s += y + terrain_height;
    }
    out[i] = kScale * out_s;
    aux[i] = MicroFreakSine(1.0f + 0.5f * kScale * aux_s);
  }
}

}  // namespace plaits
