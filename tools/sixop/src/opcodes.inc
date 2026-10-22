// Copyright 2021 Emilie Gillet, MIT. Exact official DX7 opcode table.
#define MOD(n) (n << 4)
#define ADD(n) (n | 4)
#define OUT(n) n
#define FB_SRC 64
#define FB_DST MOD(3)
#define FB (FB_SRC | FB_DST)
#define NO_MOD MOD(0)
#define OUTPUT ADD(0)
const uint8_t CompactAlgorithms::opcodes_[32][6] = {
  {
     // Algorithm 1
     FB | OUT(1),               // Op 6
     MOD(1) | OUT(1),           // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 2
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUT(1),           // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     FB | OUT(1),               // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 3
     FB | OUT(1),               // Op 6
     MOD(1) | OUT(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 4
     FB_DST | NO_MOD | OUT(1),  // Op 6
     MOD(1) | OUT(1),           // Op 5
     FB_SRC | MOD(1) | OUTPUT,  // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 5
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     NO_MOD | OUT(1),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 6
     FB_DST | NO_MOD | OUT(1),  // Op 6
     FB_SRC | MOD(1) | OUTPUT,  // Op 5
     NO_MOD | OUT(1),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 7
     FB | OUT(1),               // Op 6
     MOD(1) | OUT(1),           // Op 5
     NO_MOD | ADD(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 8
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUT(1),           // Op 5
     FB | ADD(1),               // Op 4
     MOD(1) | OUTPUT,           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 9
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUT(1),           // Op 5
     NO_MOD | ADD(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     FB | OUT(1),               // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 10
     NO_MOD | OUT(1),           // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     FB | OUT(1),               // Op 3
     MOD(1) | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 11
     FB | OUT(1),               // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 12
     NO_MOD | OUT(1),           // Op 6
     NO_MOD | ADD(1),           // Op 5
     NO_MOD | ADD(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     FB | OUT(1),               // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 13
     FB | OUT(1),               // Op 6
     NO_MOD | ADD(1),           // Op 5
     NO_MOD | ADD(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 14
     FB | OUT(1),               // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 15
     NO_MOD | OUT(1),           // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | OUTPUT,           // Op 3
     FB | OUT(1),               // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 16
     FB | OUT(1),               // Op 6
     MOD(1) | OUT(1),           // Op 5
     NO_MOD | OUT(2),           // Op 4
     MOD(2) | ADD(1),           // Op 3
     NO_MOD | ADD(1),           // Op 2
     MOD(1) | OUTPUT            // Op 1
  },
  {
     // Algorithm 17
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUT(1),           // Op 5
     NO_MOD | OUT(2),           // Op 4
     MOD(2) | ADD(1),           // Op 3
     FB | ADD(1),               // Op 2
     MOD(1) | OUTPUT            // Op 1
  },
  {
     // Algorithm 18
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUT(1),           // Op 5
     MOD(1) | OUT(1),           // Op 4
     FB | ADD(1),               // Op 3
     NO_MOD | ADD(1),           // Op 2
     MOD(1) | OUTPUT            // Op 1
  },
  {
     // Algorithm 19
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 20
     NO_MOD | OUT(1),           // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     FB | OUT(1),               // Op 3
     MOD(1) | ADD(0),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 21
     NO_MOD | OUT(1),           // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     FB | OUT(1),               // Op 3
     MOD(1) | ADD(0),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 22
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 23
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 24
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 25
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     MOD(1) | ADD(0),           // Op 4
     NO_MOD | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 26
     FB | OUT(1),               // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     NO_MOD | OUT(1),           // Op 3
     MOD(1) | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 27
     NO_MOD | OUT(1),           // Op 6
     NO_MOD | ADD(1),           // Op 5
     MOD(1) | OUTPUT,           // Op 4
     FB | OUT(1),               // Op 3
     MOD(1) | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 28
     NO_MOD | OUTPUT,           // Op 6
     FB | OUT(1),               // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | OUT(1),           // Op 2
     MOD(1) | ADD(0)            // Op 1
  },
  {
     // Algorithm 29
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     NO_MOD | OUT(1),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 30
     NO_MOD | OUTPUT,           // Op 6
     FB | OUT(1),               // Op 5
     MOD(1) | OUT(1),           // Op 4
     MOD(1) | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 31
     FB | OUT(1),               // Op 6
     MOD(1) | OUTPUT,           // Op 5
     NO_MOD | ADD(0),           // Op 4
     NO_MOD | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  },
  {
     // Algorithm 32
     FB | OUTPUT,               // Op 6
     NO_MOD | ADD(0),           // Op 5
     NO_MOD | ADD(0),           // Op 4
     NO_MOD | ADD(0),           // Op 3
     NO_MOD | ADD(0),           // Op 2
     NO_MOD | ADD(0)            // Op 1
  }
};
#undef MOD
#undef ADD
#undef OUT
#undef FB_SRC
#undef FB_DST
#undef FB
#undef NO_MOD
#undef OUTPUT
