extern "C" const volatile unsigned fm_banks[12] = {};
extern "C" const volatile unsigned fm_models[23] = {};
// Shift controls for stock MicroFreak 5.0.0.2084, offline-built experimental port.
#include "controls.h"
typedef unsigned (*Getter)(unsigned,unsigned);
typedef void (*Draw)(unsigned,unsigned,unsigned);
static unsigned get(unsigned p) { return ((Getter)0x0800e645)(0x2001c898,p); }
static unsigned bank() { return fm_bank_id(get(0)); }
static const char* title() { static const char* titles[]={"Six-Op A","Six-Op B","Six-Op C"}; unsigned b=bank();return titles[b<3?b:0]; }
static unsigned held() {return *(volatile unsigned*)0x20003728 & 2;}
static void defaults() {
  volatile FMControls* s=fm_state();
  s->value[0]=s->value[1]=65535;s->value[2]=s->value[3]=16384;
}
extern "C" void fm_boot_init() {
  volatile FMControls* s=fm_state();
  for(unsigned i=0;i<128;++i)((volatile uint8_t*)s)[i]=0;
  s->magic=0x364d4653;s->patch=65535;defaults();
}
extern "C" void fm_patch(unsigned patch,unsigned algorithm,unsigned feedback) {
  volatile FMControls* s=fm_state();
  // Read the unmodulated native selector, not one voice's modulated Wave.
  // Otherwise different patches in simultaneous voices would reset macros.
  unsigned b=bank();if(b>=3)return;
  unsigned base=(((Getter)0x08023c2d)(0x2001c898,1) * FM_PATCH_COUNT) >> 15;
  if(base>=FM_PATCH_COUNT)base=FM_PATCH_COUNT-1;
  base += b*FM_PATCH_COUNT;
  if(s->patch!=base) {defaults();s->patch=base;}

  s->factory_algorithm=fm_default(base,0);s->factory_feedback=fm_default(base,1);
}
// Original OLED packet encoders/layouts verified by the earlier ShiftType V3.
static void text(const char* p,unsigned layout) {
  typedef void (*Text)(unsigned,const char*,unsigned);
  Text send=(Text)0x080557e9;unsigned n=0;while(p[n])++n;++n;
  send(0,0,127);while(n>4){send(0,p,4);p+=4;n-=4;}
  if(n)send(0,p,n);((Draw)0x0805579d)(0,18,layout);
}
static void frame(const char* label,const char* value) {
  ((Draw)0x0805579d)(0,2,0xff0f);
  text(title(),0x01001a00);text(label,0x05001a00);
  text(value,0x06001a00);((Draw)0x0805579d)(0,3,0);
}
static void draw_patch() {
  fm_patch(0,0,0);

  unsigned index=fm_state()->patch;
  frame("Patch",fm_name(index));
  fm_state()->displayed_patch=index;
}
static void draw() {
  volatile FMControls* s=fm_state();unsigned i=s->active-1;
  if(i>3)return;
  const char* names[]={"Algorithm","Feedback","Detune","Release"};
  unsigned v=s->value[i];
  if(i<2 && v==65535)v=i?s->factory_feedback:s->factory_algorithm;
  if(i==0)++v;
  if(i>=2)v=(v*100+16383)/32767;
  char str[4];unsigned n=0;
  if(v>=100)str[n++]='0'+v/100;
  if(v>=10)str[n++]='0'+(v/10)%10;
  str[n++]='0'+v%10;str[n]=0;
  frame(names[i],str);
}
static void restore(uint8_t* view) {
  fm_state()->active=0;
  unsigned p=view[6]|(view[7]<<8);
  if(p!=1 && p!=3 && p!=5)p=1;
  view[6]=p;view[7]=0;view[13]=0;
  if(p==1 && bank()<3) {
    fm_state()->active=5;draw_patch();return;
  }
  ((void (*)(uint8_t*))0x0804fc5d)(view);
  view[8]=p;view[9]=0;view[12]=0;view[13]=1;
  ((Draw)0x0805579d)(0,3,0);
}
extern "C" int fm_encoder(unsigned context,unsigned parameter,int delta) {
  if(bank()>=3)return 0;
  if(!held()) {
    if(parameter!=1)return 0;
    // Orange knobs report relative encoder events. Each event advances one
    // patch; retain continuous raw Wave for matrix/MIDI and existing presets.
    if(!(*(volatile uint8_t*)0x200007ea))return 1;
    fm_patch(0,0,0);int current=fm_state()->patch%FM_PATCH_COUNT;
    int next=current+(delta>0?1:delta<0?-1:0);
    if(next<0)next=0;if(next>=FM_PATCH_COUNT)next=FM_PATCH_COUNT-1;
    *(volatile uint16_t*)0x20000a16=1;
    if(next!=current) {
      unsigned raw=((2*next+1)*32768)/(2*FM_PATCH_COUNT);
      ((unsigned (*)(unsigned,unsigned,unsigned,unsigned))0x08023c41)(0x2001c898,1,raw,1);
      fm_patch(0,0,0);
      ((void (*)(unsigned,unsigned))0x0805488d)(0x20000bdc,1);
    }
    fm_state()->active=5;draw_patch();return 1;
  }
  unsigned index;
  switch(parameter){case 0:index=0;break;case 1:index=1;break;case 3:index=2;break;case 5:index=3;break;default:return 0;}
  fm_patch(0,0,0);
  if(!delta)return 1;
  volatile FMControls* s=fm_state();int v=s->value[index];
  if(index<2 && v==65535)v=index?s->factory_feedback:s->factory_algorithm;
  if(delta>128)delta=128;if(delta<-128)delta=-128;
  v+=delta*(index<2?1:256);int max=index==0?31:index==1?7:32767;
  if(v<0)v=0;if(v>max)v=max;s->value[index]=v;s->active=index+1;
  *(volatile uint16_t*)0x20000a16=parameter;
  ((void (*)(unsigned,unsigned))0x0805488d)(0x20000bdc,1);
  draw();return 1;
}
extern "C" int fm_refresh(uint8_t* view,unsigned force) {
  volatile FMControls* s=fm_state();unsigned parameter=view[6]|(view[7]<<8);
  // Native parameter IDs encode the section in the high byte. Never
  // restore a VCO overlay into filter, cycling envelope, arp or other views.
  if(parameter>>8){s->active=0;return 0;}
  if(s->active==5 || (!s->active && bank()<3 && parameter==1)) {
    if(bank()>=3 || parameter!=1){restore(view);return 1;}
    unsigned entering=s->active!=5;s->active=5;
    fm_patch(0,0,0);
    if(entering || force || s->displayed_patch!=s->patch)draw_patch();
    return 1;
  }
  if(!s->active)return 0;
  if(!held() || bank()>=3){restore(view);return 1;}
  if(force)draw();return 1;
}
extern "C" int fm_tick(uint8_t* view) {
  volatile FMControls* s=fm_state();
  unsigned parameter=view[6]|(view[7]<<8);
  if(parameter>>8){s->active=0;return 0;}
  if(s->active==5) {
    if(bank()>=3 || parameter!=1){restore(view);return 1;}
    fm_patch(0,0,0);
    if(s->displayed_patch!=s->patch){draw_patch();return 1;}
  } else if(s->active && (!held() || bank()>=3)){restore(view);return 1;}
  return 0;
}
// Native tagged preset extension SF6. Exactly 42 additional bytes when active.
// Other engines keep byte-identical native serialization. MCC roundtrip untested.
extern "C" int mf4_save(void*,uint8_t* b,unsigned start) {
  if(bank()>=3)return start;
  fm_patch(0,0,0);
  if(start<32 || start+42>2012)return -1;
  unsigned p=start;b[p++]=0x23;b[p++]='S';b[p++]='F';b[p++]='6';
  const char names[]="VAFDRP";
  for(unsigned i=0;i<6;++i){
    unsigned v=i==0?FM_PRESET_VERSION:i==5?fm_state()->patch:fm_state()->value[i-1];
    b[p++]=0x41;b[p++]=names[i];b[p++]=0x63;b[p++]=0xee;
    b[p++]=v;b[p++]=v>>8;
  }
  b[p++]=0x40;b[p]=0x20;return p;
}
extern "C" int mf4_load(void*,const uint8_t* b,unsigned size) {
  defaults();fm_state()->patch=65535;fm_state()->active=0;
  uint16_t pending[6]={};unsigned pos=32,group=0,seen=0,found=0;
  unsigned end=size<2012?size:2012;
  while(pos<end){unsigned tag=b[pos++],n=tag&31;
    if((tag&224)==32){
      if(!n){
        if(found==1 && seen==63 && pending[0]==FM_PRESET_VERSION &&
          (pending[1]<32 || pending[1]==65535) && (pending[2]<8 || pending[2]==65535) &&
          pending[3]<32768 && pending[4]<32768 && pending[5]<FM_TOTAL_PATCHES && pending[5]/FM_PATCH_COUNT==bank()){
          for(unsigned i=0;i<4;++i)fm_state()->value[i]=pending[i+1];
          fm_state()->patch=pending[5];
        }
        return 0;
      }
      if(n>end-pos)return 0;
      group=n==3 && b[pos]=='S' && b[pos+1]=='F' && b[pos+2]=='6';
      if(group)++found;pos+=n;
    }else if((tag&224)==64){
      if(!n){group=0;continue;}
      if(n>end-pos || end-pos-n<4)return 0;
      unsigned name=b[pos];pos+=n;
      if(b[pos++]!=0x63)return 0;
      unsigned metadata=b[pos++],v=b[pos]|(b[pos+1]<<8);pos+=2;
      if(group){
        const char names[]="VAFDRP";unsigned i=0;
        while(i<6 && names[i]!=name)++i;
        if(n!=1 || metadata!=0xee || i==6 || (seen&(1u<<i)))return 0;
        pending[i]=v;seen|=1u<<i;
      }
    }else return 0;
  }
  return 0;
}
