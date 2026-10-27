# Raster

Raster is a FreakSwap sample-slicing engine for MicroFreak firmware 5.0.0.2084.
It replaces **Sample**, keeping its native sample player, interpolation, storage
and note handling. It is an independent implementation inspired by rhythmic
sample slicing; it is not a port of MiniFreak's Raster DSP.

- **Wave / Start:** position in the selected sample.
- **Timbre / Density:** 1/2, 1/4, 1/8, 1/16 or 1/32, shown on screen.
- **Shape / Chaos:** variation around that position.
- Sample selection uses the existing Sample gesture. No extra Shift control.

While transport runs, repeats follow the native clock grid. After leaving arp
or stopping transport, held notes return to free repetition. Start rejoins the
grid. Note attacks and the first cut after changing sample remain immediate.
A larger source window helps higher notes last until the next repeat. This is
not time-stretch: short clips or rapid pitch changes can still leave gaps.

Raster itself leaves Cloud, Hit, Scan and the other original slots unchanged.
Other replacements in a recipe follow the composer's normal ownership rules.

## Implementation and rebuilding

The `native-sample-v1` adapter uses the existing 148-byte Sample object, its
1024-byte streaming buffers and 32 bytes of state per voice. It fits inside the
native 16 KiB voice arena. Raster does not add global state or move the boot
stack. PCM remains native 32 kHz with the Sample host's 48 kHz output contract.

Raster releases only obsolete Sample control routines. The native Sample DSP
and regions shared with Grains remain protected. Mixed recipes link the native
adapter in a separate pool and chain the parameter formatter; the ordinary
Plaits composition and verification run independently on their own pool.

The supplied relocatable module is pinned by hash. Rebuilding it requires Python
3, Clang with Cortex-M4F support, ARM GNU ld and Node 24+. The qualified compiler
is Apple Clang 21.0.0 (clang-2100.1.1.101), with GNU ld 2.42.0.20240614 from Arm
GNU Toolchain 13.3.Rel1. A different compiler result is rejected for qualification.
The exact official firmware must be supplied locally; it is not included.

From the repository root:

```sh
python3 engines/raster/build.py \
  --base /path/MicroFreak_Firmware_Update_5_0_0_2084.mff \
  --output /path/new-raster-build \
  --compiler clang++ --assembler clang \
  --linker arm-none-eabi-ld --node node

python3 engines/raster/verify.py \
  --base /path/MicroFreak_Firmware_Update_5_0_0_2084.mff \
  --candidate /path/new-raster-build --node node
```

The builder compiles the sources, checks the module hash, composes firmware and
runs the same bounded ARM checks as the browser before packaging the candidate.
`verify.py` recomposes, repeats the checks and compares existing artifacts.
An optional `--recipe recipe.json` supports mixed selections.

## Verification limits

Browser checks execute native constructors, selector, note allocation and DSP
with synthetic PCM. Storage reads complete synchronously in that fixture.
They cover four voices, unison, note changes, return from other engines and
return to free repetition after transport. Clock fields in browser checks are
explicit inputs; independent native-clock/parser testing does not certify
physical UART/USB, timer jitter or QSPI/DMA latency.

Native preset serialization and simulated reinitialization can be checked in
software; they do not constitute a power-cycle or persistent-storage test on
an instrument. Physical CPU deadlines, stack high-water and streaming margins
remain unmeasured. Back up presets and retain the official firmware before
installing any modified firmware.
