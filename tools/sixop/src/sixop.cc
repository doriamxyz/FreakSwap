// Compact Six-Op FM MicroFreak adapter. Plaits core (c) Emilie Gillet, MIT.
// See vendor/ for licensed upstream code and PROVENANCE.json for revisions.
#include <algorithm>
#include "controls.h"
#include "stmlib/utils/buffer_allocator.h"
#include "plaits/dsp/fm/voice.h"

#include "plaits/dsp/fm/dx_units.cc"

// Arturia writes one trigger byte, followed by three unspecified stack bytes.
struct Params {
  uint8_t trigger; uint8_t padding[3];
  float note, timbre, shape, wave, accent;
};
static_assert(sizeof(Params) == 24, "parameter ABI");
static_assert(__builtin_offsetof(Params, note) == 4, "pitch ABI");
static_assert(__builtin_offsetof(Params, wave) == 16, "Wave ABI");
struct State {
  plaits::fm::CompactAlgorithms algorithms;
  plaits::fm::Voice<6> voice;
  plaits::fm::Patch patch;
  float temp[32];
  int selected_patch;
};
struct Host {
  uint32_t vptr;
  float out_gain, aux_gain;
  bool already_enveloped; uint8_t padding[3];
  State* state;
  const volatile uint8_t* gate;
  uint32_t bank;
};
static_assert(sizeof(Host) == 28, "host must fit Speech span");
static_assert(sizeof(State) < 16384, "arena capacity");


extern "C" const uint32_t sixop_sizes[] = {
  sizeof(Host), sizeof(State), sizeof(plaits::fm::CompactAlgorithms),
  sizeof(plaits::fm::Voice<6>), sizeof(plaits::fm::Patch), sizeof(State::temp)
};
extern "C" float fabsf(float x) { return x < 0.0f ? -x : x; }

static void LoadPatch(Host* h, int index) {
  State& s = *h->state;
  // Lossless fixed-width decoding, only when changing a patch. No allocation.
  static const uint8_t widths[137] = {
#include "patch-widths.inc"
  };
  unsigned bit = 0;
  for (unsigned i = 0; i < 137; ++i) {
    unsigned byte = bit >> 3;
    unsigned pair = fm_bits(index)[byte] | (unsigned(fm_bits(index)[byte+1]) << 8);
    s.patch.bytes()[i] = (pair >> (bit & 7)) & ((1u << widths[i]) - 1);
    bit += widths[i];
  }
  const float pitch_a0 = *reinterpret_cast<const volatile float*>(0x20000004);
  s.voice.Init(&s.algorithms, 55.0f / pitch_a0);
  s.voice.SetPatch(&s.patch);
  s.voice.Setup();
  s.selected_patch = index;
}

extern "C" void sixop_activate(Host* h, const uint8_t*) {
  // All stock Plaits engines share this arena. Reconstruct when selected,
  // even after another engine has written arbitrary data into it.
  uint32_t* p = reinterpret_cast<uint32_t*>(h->state);
  for (size_t i = 0; i < sizeof(State) / 4; ++i) p[i] = 0;
  unsigned bank=h->bank;
  LoadPatch(h, bank*FM_PATCH_COUNT);
  h->out_gain = h->aux_gain = 0.8f;
  h->already_enveloped = true;
}
extern "C" void sixop_init(Host* h, stmlib::BufferAllocator* allocator) {
  // Verified Voice::trigger_state_ at +0x668. The stock Render emits
  // only LOW/RISING/UNPATCHED, never Plaits TRIGGER_HIGH. Vptr and
  // object offsets come from the original Voice constructor/registry.
  h->gate = reinterpret_cast<const volatile uint8_t*>(h) + 0x668;
  h->state = allocator->Allocate<State>();
  if (h->state) sixop_activate(h, 0);
}
extern "C" void sixop_reset(Host* h) {
  if (h->state) sixop_activate(h, 0);
}
extern "C" void sixop_render(Host* h, const Params* p, float* out,
    float* aux, size_t n, bool* already_enveloped) {
  *already_enveloped = true;
  for (size_t i = 0; i < n; ++i) out[i] = aux[i] = 0.0f;
  if (!h->state || n == 0 || n > 32) return;
  State& s = *h->state;
  int selection = static_cast<int>(p->wave * FM_PATCH_COUNT);
  if (selection < 0) selection = 0;
  if (selection >= FM_PATCH_COUNT) selection = FM_PATCH_COUNT - 1;
  selection += h->bank*FM_PATCH_COUNT;
  if (selection != s.selected_patch) {
    LoadPatch(h, selection);
    // Do not combine DX patch setup and rendering in the same audio block.
    return;
  }
  s.voice.SetSampleRate(55.0f / *reinterpret_cast<const volatile float*>(0x20000004));
  fm_patch(selection, fm_default(selection,0), fm_default(selection,1));
  volatile FMControls* controls = fm_state();
  s.patch.algorithm = controls->value[0] == 65535 ? fm_default(selection,0) : controls->value[0];
  s.patch.feedback = controls->value[1] == 65535 ? fm_default(selection,1) : controls->value[1];
  plaits::fm::Voice<6>::Parameters vp;
  // The host already provides a real gate. Plaits envelope scrubbing is
  // unused here; Shape retains its gated DX attack/decay/release control.
  vp.sustain = false;
  vp.gate = *h->gate != 0;
  vp.note = p->note + fm_transpose(selection);
  vp.velocity = std::max(0.0f, std::min(p->accent, 1.0f));
  vp.brightness = p->timbre;
  vp.envelope_control = p->shape;
  vp.pitch_mod = (static_cast<int>(controls->value[2]) - 16384) * (1.0f / 16384.0f);
  vp.amp_mod = (16384 - static_cast<int>(controls->value[3])) * (1.0f / 4096.0f);
  for (size_t i = 0; i < n; ++i) s.temp[i] = 0.0f;
  s.voice.Render(vp, s.temp, out, aux, n);
  for (size_t i = 0; i < n; ++i) {
    out[i] = stmlib::SoftClip(out[i] * 0.25f);
    aux[i] = out[i];
  }
}

extern "C" void sixop_init_a(Host* h, stmlib::BufferAllocator* a) {h->bank=0;sixop_init(h,a);}
extern "C" void sixop_init_b(Host* h, stmlib::BufferAllocator* a) {h->bank=1;sixop_init(h,a);}
extern "C" void sixop_init_c(Host* h, stmlib::BufferAllocator* a) {h->bank=2;sixop_init(h,a);}
