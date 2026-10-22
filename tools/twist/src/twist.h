#pragma once
#include <stdint.h>
// Separate from the unchanged Six-OP block at 0x2001ff80.
#define TW_STATE 0x2001ff00u
#define TW_COUNT 11
struct TwistState { uint32_t magic; uint16_t value[TW_COUNT]; uint16_t active, model; };
static_assert(sizeof(TwistState)<=128,"TWIST state overflow");
inline volatile TwistState* tw_state(){return reinterpret_cast<volatile TwistState*>(TW_STATE);}
inline float TwistValue(unsigned index){
  volatile TwistState* s=tw_state();
  unsigned raw=s->magic==0x31545750?s->value[index]:16384;
  // Exactly neutral at 16384, exact endpoints, as in Palette's centre detent.
  return raw<=16384?float(raw)/32768.0f:0.5f+float(raw-16384)/32766.0f;
}
inline float TwistMacro(float stock,float low,float high,unsigned index){
  float m=TwistValue(index),a=m*2.0f;
  return m<0.5f?low+(stock-low)*a:stock+(high-stock)*(a-1.0f);
}
