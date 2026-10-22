// Copyright 2021 Emilie Gillet. MIT; MicroFreak table adaptation 2026.
#pragma once
#include "stmlib/dsp/dsp.h"
namespace plaits {
extern const float lut_sine[];
__attribute__((always_inline)) inline float SinePM(uint32_t phase, float pm) {
  phase += static_cast<uint32_t>((pm + 32.0f) * 67108864.0f) * 64u;
  const uint32_t i = phase >> 22;
  const float t = static_cast<float>(phase << 10) * (1.0f / 4294967296.0f);
  return lut_sine[i] + (lut_sine[i + 1] - lut_sine[i]) * t;
}
}
