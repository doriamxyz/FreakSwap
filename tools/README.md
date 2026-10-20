# Shared native bridge

`portable-bridge.cc` is compiled once for the MicroFreak 5.0.0.2084 Cortex-M4 Thumb hard-float ABI. It uses the MIT-licensed Mutable Instruments `stmlib/utils/buffer_allocator.h` header and C++11. The build uses clang++ with `-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard -Oz -fno-builtin -fno-exceptions -fno-rtti -ffunction-sections -fdata-sections --target=arm-none-eabi`.

The exported closure contains `native_alias_init`, `native_alias_parameter`, and a 23-word binding table. The table is volatile so an initially empty table cannot be constant-folded away. The browser verifies the immutable module, relocates its sections, and binds only the requested IDs to their runtime ABI tables. `portable-route.S` is assembled once with the same Thumb target; the browser supplies its binding-table literal. DSP objects are not compiled during selection.

The bridge temporarily uses the original Chords object for each voice while a selected native ID is active. It restores Chords' normal table before every frontend Init, preserves the visible native model ID, and calls the selected engine's Init and activation methods. Original native family tables are preserved; IDs absent from the binding table retain their original routes.

Current library contracts expose this mechanism for Swarm, Bass Drum, Phase Distortion and Snare Drum in Basic Waves and Superwave, including mixed selections, with an explicit Speech replacement providing audited code space. These sources do not certify additional IDs or engines.
