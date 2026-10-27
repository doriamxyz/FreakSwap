// FreakSwap Raster-inspired prototype, 2026. No Arturia code is copied here.
#include <stdint.h>
#include "raster_clock.h"
namespace {
template<typename T> T& field(void* p,uint32_t off) {return *reinterpret_cast<T*>(static_cast<uint8_t*>(p)+off);}
struct State {uint32_t magic,random;float phase;uint32_t sample;uint32_t onsets;raster::ClockState clock;};
constexpr uint32_t Magic=0x52535431;
State& state(void* host){void* s=field<void*>(host,0x5c);return field<State>(field<void*>(s,0x18),0x400);}
uint32_t random(State& s){uint32_t x=s.random;x^=x<<13;x^=x>>17;x^=x<<5;return s.random=x;}
}
extern "C" {
void raster_init(void* host,uint32_t model,void* arena,uint32_t capacity) {
 typedef void(*Init)(void*,uint32_t,void*,uint32_t);
 reinterpret_cast<Init>(0x08030675)(host,model,arena,capacity);
 State& s=state(host);s.magic=Magic;s.random=0x6d2b79f5;s.phase=1.0f;s.sample=0xffffffff;s.onsets=0;
 raster::InitClock(s.clock,*reinterpret_cast<volatile uint8_t*>(0x20003cdc+0x20c)!=0);
}
void raster_parameter(void* host,uint32_t parameter,uint32_t value) {
 if(parameter==1||parameter==3||parameter==5) {if(value>32767)value=32767;}
 if(parameter<10) field<uint16_t>(host,12+2*parameter)=value;
 if(parameter==9) {
  void* p=field<void*>(host,0x5c);field<uint8_t>(p,0x90)=value>127?127:value;
 }
}
__attribute__((noinline)) void raster_prepare(void* p,const uint8_t* descriptor) {
  // Own metadata setup so native reload cannot replace the first planned slice.
  field<uint16_t>(p,0x84)=field<const uint16_t>(const_cast<uint8_t*>(descriptor),8);
  field<uint32_t>(p,0x88)=field<const uint32_t>(const_cast<uint8_t*>(descriptor),4);
  field<uint8_t>(p,0x34)=0;field<uint8_t>(p,0x64)=0;field<uint8_t>(p,0xd)=0;
  // Do not let the first new head interpolate stale PCM from the old sample.
  uint32_t* buffers=field<uint32_t*>(p,0x18);
  for(unsigned i=0;i<256;++i)buffers[i]=0;
  uint32_t pitch=field<uint32_t>(p,4);
  if(pitch>132340584u)pitch=132340584u;
  field<float>(p,0x8c)=static_cast<float>(pitch);
  typedef void(*Flush)(void*);
  reinterpret_cast<Flush>(0x080450c5)(reinterpret_cast<void*>(0x200018b8));
}
__attribute__((noinline)) void raster_launch(void* host,void* p,State* ps,uint32_t length,float period) {
  ps->phase-=static_cast<uint32_t>(ps->phase);++ps->onsets;
  // Metadata and cache transitions are completed before this launch.
  float position=field<uint16_t>(host,14)*(1.0f/32768.0f);
  float chaos=field<uint16_t>(host,22)*(1.0f/32768.0f);
  position+=(static_cast<float>(random(*ps)>>8)*(1.0f/16777216.0f)-0.5f)*chaos;
  if(position<0)position=0;if(position>1)position=1;
  uint32_t pitch=field<uint32_t>(p,4);
  if(pitch>132340584u)pitch=132340584u;
  float rate=static_cast<float>(pitch)*(1.0f/(11697365.0f*3.0f));
  // Preserve the accepted lower-register window; extend it when high notes
  // consume PCM faster. Native interpolation remains responsible for pitch.
  if(rate<2.0f/3.0f)rate=2.0f/3.0f;
  uint32_t span=static_cast<uint32_t>(period*rate);
  if(span<960)span=960;
  const uint32_t end_limit=length-1;
  if(span>end_limit)span=end_limit;
  uint32_t start=static_cast<uint32_t>(position*(end_limit-span));
  field<uint16_t>(p,0x7c)=static_cast<uint16_t>(position*32767.0f);
  field<uint16_t>(p,0x80)=32767;field<uint16_t>(p,0x82)=0;
  field<uint32_t>(p,0x70)=start;field<uint32_t>(p,0x74)=start+span;
  field<uint32_t>(p,0x78)=0;field<uint8_t>(p,0xc)=1;
}
void raster_density_text(char* out) {
 typedef uint16_t(*Get)(void*,uint32_t);
 uint32_t raw=reinterpret_cast<Get>(0x08023c2d)(reinterpret_cast<void*>(0x2001c898),3);
 uint32_t index=raw*5u/32768u;if(index>4)index=4;
 static const char text[5][5]={"1/2","1/4","1/8","1/16","1/32"};
 for(unsigned i=0;i<5;++i)out[i]=text[index][i];
}
void raster_render(void* host,void* buffer) {
 void* p=field<void*>(host,0x5c);State& s=state(host);
 if(s.magic!=Magic) {for(unsigned i=0;i<32;++i)static_cast<int16_t*>(buffer)[i]=0;return;}
 uint32_t sample=field<uint8_t>(p,0x90);
 uint8_t* descriptor=reinterpret_cast<uint8_t*>(0x200018b8+0x1010+sample*24);
 uint32_t length=field<uint32_t>(descriptor,4)/2;
 if(length<2||descriptor[23]==255) {for(unsigned i=0;i<32;++i)static_cast<int16_t*>(buffer)[i]=0;s.phase=1.0f;return;}
 uint32_t version=field<uint16_t>(descriptor,8);
 // Native clock manager stores hundredths of BPM. It is updated by its
 // internal/external tempo setter at 0x0802af0c; no peripheral is polled here.
 uint32_t bpm100=*reinterpret_cast<volatile uint16_t*>(0x20003eec);
 if(bpm100<3000||bpm100>30000) bpm100=13500;
 // Sample PCM is 32 kHz; its native host output contract (0x43030) is 48 kHz.
 uint32_t density=field<uint16_t>(host,18)*5u/32768u;
 if(density>4)density=4;
 float period=(48000.0f*12000.0f)/static_cast<float>(bpm100*(1u<<density));
 bool changed=s.sample!=(sample|(version<<8));
 if(changed){raster_prepare(p,descriptor);s.sample=sample|(version<<8);s.phase=1.0f;}
 const bool running=*reinterpret_cast<volatile uint8_t*>(0x20003cdc+0x20c)!=0;
 const uint8_t source=*reinterpret_cast<volatile uint8_t*>(0x20003cdc+0x1bc);
 const uint32_t tick=*reinterpret_cast<volatile uint32_t*>(0x20003cdc+0x1c4);
 // Leaving arp/transport must resume a held oscillator, not latch it silent.
 if(!running&&s.clock.following)s.phase=1.0f;
 const bool on_grid=raster::ClockDue(s.clock,tick,960u>>density,running,source);
 const bool free_play=!running;
 if(changed||on_grid||(free_play&&s.phase>=1.0f)) {
  raster_launch(host,p,&s,length,period);
 }
 if(free_play)s.phase+=32.0f/period;
 typedef void(*Render)(void*,void*);
 reinterpret_cast<Render>(0x08030979)(host,buffer);
}
}
