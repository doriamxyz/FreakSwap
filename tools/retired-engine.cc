#include <stdint.h>
extern "C" {
void retired_init(void*,void*) {}
void retired_reset(void*) {}
void retired_load(void*,const uint8_t*) {}
void retired_render(void*,const void*,float* out,float* aux,uint32_t n,bool* env) { for(uint32_t i=0;i<n;i++){out[i]=0;aux[i]=0;}*env=false;}
}
