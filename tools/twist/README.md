# Palette TWIST on Shift + Type

The eleven existing non-FM engine families now expose Palette's documented
fourth synthesis parameter. Hold the physical Shift button and turn Type;
release Shift to return to the native screen and engine selector. The other
three oscillator controls keep their existing mappings. The configurator and
installation guide describe the control for the selected engine.

| Engine | Shift + Type | Palette behavior |
|---|---|---|
| Phase Distortion | Ratio Fine | Modulator multiplier ×0.5 → ×1 → ×2 |
| Classic Waves + VCF | Drive | Oscillator/filter input drive ×0.5 → ×1 → ×2, with inverse compensation |
| Swarm | Size Spread | Successive grain-size multiplier 0.86 → 0.97 → 1.04 |
| Inharmonic String | Excite Size | Excitation duration ×0.25 → ×1 → ×4; affects a new strike |
| Particle Noise | Diffusion | Dry → original diffusion → full diffusion |
| Filtered Noise, OUT | Filter Pos | Filter response around the existing Wave setting: low-pass → original → high-pass |
| String Machine | Ensemble | Dry → original ensemble amount → full ensemble |
| Chiptune | Register | Nine hysteretic register/inversion presets; center preserves the original voicing |
| Bass Drum | Punch | Attack pitch-envelope amount ×0.25 → ×1 → ×1.75 |
| Snare Drum | Mode Spread | Shell-mode frequency spread ×0.5 → ×1 → ×1.75 |
| Wave Terrain, OUT and AUX | Y Offset | Vertical scan offset −0.95 → 0 → +0.95, with interpolation |

Filtered Noise **Dual Band/AUX** retains its previous module and controls.
Palette's filter-response macro affects OUT, while the dual band-pass signal
uses AUX. Exposing it on that variant would provide a silent control. The UI
explains this distinction rather than assigning a different, invented macro.

Reference: [Plaits Palette](https://rubato.audio/plaits-palette/), and the pinned
Rubato/Mutable engine sources and catalog used during development. The copied
control descriptions and per-variant identities are in `palette-controls.json`.
This port applies the documented macros to the existing MicroFreak adaptations;
it does not import unrelated newer Palette stereo, terrain-bank or FM features.
The existing five procedural Wave Terrain landscapes remain.

## Neutral point and storage

Raw 16384 is exactly 0.5 and is the initial value for every family. Raw 0 and
32767 reach the two endpoints exactly. Encoder deltas are clamped to ±128 and
each step changes the stored value by 256. A zero delta leaves the value and
preset dirty flag alone. The DSP reads its own family value, independent of
which other visible ID is selected by Type modulation.

The separate tagged preset extension is `TW4`, version 1. Field A is the version;
B–L store the eleven family values in `build-contracts.json` index order. It
uses 78 bytes including its group close and final terminator. Old or malformed
extensions restore defaults atomically. The native save hook aborts before
storage if capacity is insufficient. A preset retains all family values when
changing between engines. MCC or stock firmware can discard unknown fields if
they rewrite a preset; physical MCC roundtrips remain unqualified.

## Six-OP preservation and memory

Six-OP A/B/C source files, module bytes, banks, labels, controls and SF6 V6 codec
are unchanged. A selection containing only Six-OP reproduces its prior full
firmware byte for byte. Mixed selections place TWIST first in the UI hooks and
tail-chain the original Six-OP hooks for all other events. The persistence
wrapper invokes the original SF6 serializer/loader and appends/parses TW4 as a
separate group. SF6 does not acquire a new version or any new parameters.

TWIST owns 128 bytes at `0x2001ff00`. Six-OP retains its existing block at
`0x2001ff80`; TWIST never clears it. Any selection using TWIST moves the initial
and reset stack words to `0x2001ff00`, reserving 256 bytes below the old stack top
(including the unchanged Six-OP block, whether selected or unused). The nominal
stack span is consequently 3280 bytes, versus the original 3536. Physical stack
high-water and CPU/interrupt behavior require device testing. Six-OP-only images
retain their original 128-byte reservation and hooks.

All sections, descriptor labels and callback bindings participate in the
existing joint allocator. The independent verifier checks the extra hooks,
state reservation, all model/label bindings, and all Six-OP continuations.
No additional original is silently retired to pay for the runtime.

## Rebuild and verification

`build.py` rebuilds and compares all twelve supported DSP variants and the
shared runtime against the immutable modules, without accessing official
firmware or the network. It uses only this folder's included sources, header
variants, upstream dependencies and compile contracts:

```sh
python3 tools/twist/build.py --clang clang++ --linker ld.lld
# Alternatively: --linker 'zig ld.lld'
```

The compiler must support Cortex-M4 Thumb hard-float. The checked closures pin
object sizes, the 24-byte native parameter structure and all six field offsets.
ABS32 addends are normalized before browser relocation. The runtime is 1832
bytes before selection-specific labels and tables. `source-identity.json` pins
these inputs, library and output module identities.

`tests/v6-twist.test.mjs` verifies control coverage, exact Six-OP preservation,
conditional linking, isolated state and hook continuations, tamper detection,
encoder bounds/Shift behavior, preset roundtrips and malformed/capacity cases.
The previous catalog is frozen in `tests/fixtures/v4-legacy-library.json` so its
existing exact-image/audio regressions retain their original meaning.

```sh
FREAKSWAP_FIRMWARE=/path/to/MicroFreak_Firmware_Update_5_0_0_2084.mff \
  node --test tests/*.test.mjs
```

The native live-control qualification also reaches both macro endpoints through
the subscribed encoder and confirms reads by all four voices for each of the
eleven families. The resulting audio changes shape after removing a fitted gain.

`validation.json` records whole-selection, native encoder/OLED, persistent NOR,
DSP-neutrality and browser-download evidence. The native tests execute reset up
to the first original initialization call, not the complete device boot. OLED
packets and NOR peripherals use explicit fixtures. No hardware was flashed.
