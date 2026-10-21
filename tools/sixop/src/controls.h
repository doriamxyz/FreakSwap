#pragma once
#include <stdint.h>
#define FM_PATCH_COUNT 32
#define FM_TOTAL_PATCHES 96
#define FM_PRESET_VERSION 6
#define FM_STATE_ADDRESS 0x2001ff80u
struct FMControls {
  uint32_t magic;
  uint16_t value[4]; // algorithm/feedback: 65535 = factory; D/R: centre 16384.
  uint16_t patch;
  uint8_t factory_algorithm, factory_feedback;
  uint16_t active; // 0 native screen, 1..4 Shift controls, 5 patch-name view.
  uint16_t displayed_patch;
};
static_assert(sizeof(FMControls) <= 128, "reserved state span");
static inline volatile FMControls* fm_state() {
  return reinterpret_cast<volatile FMControls*>(FM_STATE_ADDRESS);
}
extern "C" void fm_patch(unsigned patch, unsigned algorithm, unsigned feedback);

extern "C" const volatile uint32_t fm_models[23];
static inline unsigned fm_bank_id(unsigned model) { return model<23 && fm_models[model] ? fm_models[model]-1 : 3; }

extern "C" const volatile uint32_t fm_banks[12];
static inline const uint8_t* fm_bits(unsigned patch) {return reinterpret_cast<const uint8_t*>(fm_banks[(patch/32)*4])+(patch%32)*94;}
static inline const char* fm_name(unsigned patch) {return reinterpret_cast<const char*>(fm_banks[(patch/32)*4+1])+(patch%32)*11;}
static inline unsigned fm_default(unsigned patch,unsigned field) {return reinterpret_cast<const uint8_t*>(fm_banks[(patch/32)*4+2])[(patch%32)*2+field];}

static inline int fm_transpose(unsigned patch) {return reinterpret_cast<const uint8_t*>(fm_banks[(patch/32)*4+3])[patch%32]-24;}
