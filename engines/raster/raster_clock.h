// Musical position is supplied by the native clock manager, at 480 PPQN.
// This planner never drives, resets or modifies the native transport.
#ifndef FREAKSWAP_RASTER_CLOCK_H_
#define FREAKSWAP_RASTER_CLOCK_H_
#include <stdint.h>
namespace raster {
struct ClockState {
  uint32_t tick;
  uint32_t bucket;
  uint16_t grid;
  uint8_t source;
  uint8_t following;
};
inline void InitClock(ClockState& s, bool native_running) {
  s.tick = 0;
  s.bucket = 0;
  s.grid = 0;
  s.source = 255;
  s.following = native_running;
}
inline bool ClockDue(ClockState& s, uint32_t tick, uint16_t grid,
                     bool running, uint8_t source) {
  if (!running) {s.following = 0;return false;}
  const uint32_t bucket = tick / grid;
  const bool rebase = !s.following || s.grid != grid || s.source != source;
  // After source or division changes, join the next grid boundary rather
  // than fire an extra off-grid slice. A native Start rewinds tick to zero.
  const bool due = rebase ? tick % grid == 0 :
      (bucket != s.bucket || tick < s.tick);
  s.tick = tick;
  s.bucket = bucket;
  s.grid = grid;
  s.source = source;
  s.following = 1;
  return due;
}
}
#endif
