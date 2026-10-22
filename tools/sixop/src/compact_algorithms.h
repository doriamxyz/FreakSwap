// Copyright 2021 Emilie Gillet. MIT; compact opcode interpreter, 2026.
#pragma once
#include "plaits/dsp/fm/operator.h"
namespace plaits { namespace fm {
class CompactAlgorithms {
 public:
  void Init() { }
  bool is_modulator(int algorithm, int op) const {
    return opcodes_[algorithm][op] & 3;
  }
  // Interpret the official six one-byte opcodes per sample. This replaces
  // eight unrolled renderers and the run-time 32x6 function-pointer matrix.
  // Feedback destination/source flags preserve loops spanning 2/3 operators.
  static void Render(int algorithm, Operator* ops, const float* f,
      const float* a, float* feedback, int feedback_amount,
      float** buffers, size_t size) {
    uint32_t frequency[6];
    float increment[6];
    const float scale = 1.0f / float(size);
    for (int i = 0; i < 6; ++i) {
      frequency[i] = static_cast<uint32_t>(std::min(f[i], 0.5f) * 4294967296.0f);
      increment[i] = (std::min(a[i], 4.0f) - ops[i].amplitude) * scale;
    }
    const float fb_scale = feedback_amount ? float(1 << feedback_amount) / 512.0f : 0.0f;
    const uint8_t* opcodes = opcodes_[algorithm];
    for (size_t sample = 0; sample < size; ++sample) {
      float bus[3] = { 0.0f, 0.0f, 0.0f };
      for (int i = 0; i < 6; ++i) {
        uint8_t opcode = opcodes[i];
        int source = (opcode >> 4) & 3;
        int destination = opcode & 3;
        float pm = source == 3 ? (feedback[0] + feedback[1]) * fb_scale
                              : (source ? bus[source] : 0.0f);
        ops[i].phase += frequency[i];
        float value = SinePM(ops[i].phase, pm) * ops[i].amplitude;
        ops[i].amplitude += increment[i];
        if (opcode & 64) {
          feedback[1] = feedback[0]; feedback[0] = value;
        }
        if (opcode & 4) bus[destination] += value;
        else bus[destination] = value;
      }
      buffers[0][sample] = bus[0];
    }
  }
 private:
  static const uint8_t opcodes_[32][6];
};
#include "opcodes.inc"
} }
