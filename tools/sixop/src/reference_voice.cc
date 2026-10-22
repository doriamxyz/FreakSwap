// Test-only complete Plaits Voice<6>, prior to compact adaptations.
#include <algorithm>
#include "plaits/dsp/fm/voice.h"
#include "plaits/dsp/fm/algorithms.cc"
#include "plaits/dsp/fm/dx_units.cc"
extern "C" float fabsf(float x) {return x<0.0f?-x:x;}
struct RefState {
 plaits::fm::Algorithms<6> algorithms;
 plaits::fm::Voice<6> voice;
 plaits::fm::Patch patch;
 float temp[32];
};
struct Params {uint8_t trigger,pad[3];float note,timbre,shape,wave,accent;};
extern "C" const uint32_t ref_size=sizeof(RefState);
extern "C" void reference_init(RefState* s, const uint8_t* packed) {
 s->algorithms.Init();s->patch.Unpack(packed);
 s->voice.Init(&s->algorithms,55.0f / *reinterpret_cast<const volatile float*>(0x20000004));
 s->voice.SetPatch(&s->patch);s->voice.Setup();
}
extern "C" void reference_render(RefState* s, const Params* p,float* out, size_t n) {
 float aux[32];
 for(size_t i=0;i<n;++i)s->temp[i]=out[i]=aux[i]=0.0f;
 plaits::fm::Voice<6>::Parameters vp;
 vp.sustain=false;vp.gate=(p->trigger&4)!=0;
 vp.note=p->note + static_cast<int>(s->patch.transpose) - 24;vp.velocity=p->accent;vp.brightness=p->timbre;
 vp.envelope_control=p->shape;vp.pitch_mod=vp.amp_mod=0;
 s->voice.Render(vp,s->temp,out,aux,n);
 for(size_t i=0;i<n;++i)out[i]=stmlib::SoftClip(out[i]*.25f);
}
