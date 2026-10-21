#include "twist.h"
// Per visible ID: family index + 1, title, control label. Patched by composer.
extern "C" const volatile uint32_t tw_models[23*3]={};
// Unmodified Six-OP hook/codec destinations, zero when Six-OP is absent.
extern "C" const volatile uint32_t tw_next[7]={};
typedef unsigned (*Getter)(unsigned,unsigned);
typedef void (*Draw)(unsigned,unsigned,unsigned);
static unsigned model(){return ((Getter)0x0800e645)(0x2001c898,0);}
static unsigned index(unsigned m){return m<23?tw_models[m*3]:0;}
static bool held(){return *(volatile unsigned*)0x20003728&2;}
extern "C" void tw_boot_init(){volatile TwistState* s=tw_state();for(unsigned i=0;i<128;i++)((volatile uint8_t*)s)[i]=0;for(unsigned i=0;i<TW_COUNT;i++)s->value[i]=16384;s->magic=0x31545750;}
static void text(const char* p,unsigned layout){typedef void (*Text)(unsigned,const char*,unsigned);Text send=(Text)0x080557e9;unsigned n=0;while(p[n])++n;++n;send(0,0,127);while(n>4){send(0,p,4);p+=4;n-=4;}if(n)send(0,p,n);((Draw)0x0805579d)(0,18,layout);}
static void draw(){unsigned m=tw_state()->model,i=index(m);if(!i)return;unsigned v=(tw_state()->value[i-1]*100u+16383)/32767;char b[5];unsigned n=0;if(v>=100)b[n++]='1';if(v>=10)b[n++]='0'+v/10%10;b[n++]='0'+v%10;b[n++]='%';b[n]=0;((Draw)0x0805579d)(0,2,0xff0f);text((const char*)tw_models[m*3+1],0x01001a00);text((const char*)tw_models[m*3+2],0x05001a00);text(b,0x06001a00);((Draw)0x0805579d)(0,3,0);}
static void restore(uint8_t* v){tw_state()->active=0;unsigned p=v[6]|v[7]<<8;if(p!=1&&p!=3&&p!=5)p=1;v[6]=p;v[7]=0;v[13]=0;((void(*)(uint8_t*))0x0804fc5d)(v);v[8]=p;v[9]=0;v[12]=0;v[13]=1;((Draw)0x0805579d)(0,3,0);}
extern "C" int tw_encoder(unsigned context,unsigned parameter,int delta){unsigned m=model(),i=index(m);if(!i||!held()||parameter!=0)return 0;if(!delta)return 1;if(delta>128)delta=128;if(delta<-128)delta=-128;volatile TwistState* s=tw_state();int v=s->value[i-1]+delta*256;if(v<0)v=0;if(v>32767)v=32767;s->value[i-1]=v;s->model=m;s->active=1;*(volatile uint16_t*)0x20000a16=0;((void(*)(unsigned,unsigned))0x0805488d)(0x20000bdc,1);draw();return 1;}
extern "C" int tw_refresh(uint8_t* v,unsigned force){if(!tw_state()->active)return 0;unsigned p=v[6]|v[7]<<8;if(p>>8){tw_state()->active=0;return 0;}if(!held()||model()!=tw_state()->model||p!=0){restore(v);return 1;}if(force)draw();return 1;}
extern "C" int tw_tick(uint8_t* v){if(!tw_state()->active)return 0;unsigned p=v[6]|v[7]<<8;if(p>>8){tw_state()->active=0;return 0;}if(!held()||model()!=tw_state()->model||p!=0){restore(v);return 1;}return 0;}
// TW4 version 1 stores all eleven family values. SF6 remains its own exact codec.
extern "C" int tw_save(void* ctx,uint8_t* b,unsigned start){if(tw_next[4]){int r=((int(*)(void*,uint8_t*,unsigned))tw_next[4])(ctx,b,start);if(r<0)return r;start=r;}if(start<32||start+(6*(TW_COUNT+1)+6)>2012)return -1;unsigned p=start;b[p++]=0x23;b[p++]='T';b[p++]='W';b[p++]='4';for(unsigned i=0;i<=TW_COUNT;i++){unsigned v=i?tw_state()->value[i-1]:1;b[p++]=0x41;b[p++]='A'+i;b[p++]=0x63;b[p++]=0xee;b[p++]=v;b[p++]=v>>8;}b[p++]=0x40;b[p]=0x20;return p;}
extern "C" int tw_load(void* ctx,const uint8_t* b,unsigned size){if(tw_next[5])((int(*)(void*,const uint8_t*,unsigned))tw_next[5])(ctx,b,size);tw_boot_init();uint16_t pending[TW_COUNT+1];unsigned pos=32,group=0,seen=0,found=0,end=size<2012?size:2012;while(pos<end){unsigned tag=b[pos++],n=tag&31;if((tag&224)==32){if(!n){if(found==1&&seen==((1u<<(TW_COUNT+1))-1)&&pending[0]==1){for(unsigned i=1;i<=TW_COUNT;i++)if(pending[i]>32767)return 0;for(unsigned i=0;i<TW_COUNT;i++)tw_state()->value[i]=pending[i+1];}return 0;}if(n>end-pos)return 0;group=n==3&&b[pos]=='T'&&b[pos+1]=='W'&&b[pos+2]=='4';if(group)++found;pos+=n;}else if((tag&224)==64){if(!n){group=0;continue;}if(n>end-pos||end-pos-n<4)return 0;unsigned name=b[pos];pos+=n;if(b[pos++]!=0x63)return 0;unsigned metadata=b[pos++],v=b[pos]|b[pos+1]<<8;pos+=2;if(group){unsigned i=name-'A';if(n!=1||metadata!=0xee||i>TW_COUNT||(seen&(1u<<i)))return 0;pending[i]=v;seen|=1u<<i;}}else return 0;}return 0;}

extern "C" void tw_runtime_init(){tw_boot_init();if(tw_next[6])((void(*)())tw_next[6])();}
