#include <stdint.h>
#include "stmlib/utils/buffer_allocator.h"
extern "C" {
extern const volatile uint32_t native_bindings[23] = {0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0,0x0};
void native_alias_init(uint8_t* host, uint32_t model, uint8_t* arena, uint32_t capacity) {
  uint8_t* voice = *reinterpret_cast<uint8_t**>(host + 0x5c) + 0x28;
  // Chords' normal table can itself contain a requested replacement. Keep
  // that ROM table authoritative; only the per-voice header is overlaid.
  *reinterpret_cast<uint32_t*>(voice) = 0x08078578;
  uint32_t table = model < 23 ? native_bindings[model] : 0;
  typedef void (*Init)(uint8_t*, uint32_t, uint8_t*, uint32_t);
  reinterpret_cast<Init>(0x08030745)(host, table ? 10 : model, arena, capacity);
  if (table) {
    *reinterpret_cast<uint16_t*>(host + 12) = model;
    for (uint32_t i=16;i<336;i+=4) *reinterpret_cast<uint32_t*>(voice+i)=0;
    for (uint32_t i=0;i<capacity;i+=4) *reinterpret_cast<uint32_t*>(arena+i)=0;
    *reinterpret_cast<uint32_t*>(voice) = table;
    stmlib::BufferAllocator allocator(arena, capacity);
    typedef void (*EngineInit)(uint8_t*, stmlib::BufferAllocator*);
    reinterpret_cast<EngineInit>(*reinterpret_cast<const uint32_t*>(table))(voice, &allocator);
    // Some proven adapters clear their delay memory in activation rather
    // than Init. Invoke that ABI slot before taking an activation snapshot.
    typedef void (*Activate)(uint8_t*, const uint8_t*);
    reinterpret_cast<Activate>(*reinterpret_cast<const uint32_t*>(table + 4))(voice, 0);
  }
}
void native_alias_parameter(uint8_t* host, uint32_t parameter, uint32_t value) {
  typedef void (*Set)(uint8_t*, uint32_t, uint32_t);
  uint32_t mapped = parameter == 0 && value < 23 && native_bindings[value] ? 10 : value;
  reinterpret_cast<Set>(0x0802fe15)(host, parameter, mapped);
  if (mapped != value) *reinterpret_cast<uint16_t*>(host + 12) = value;
}
}
