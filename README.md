# FreakSwap

An independent, experimental browser tool for replacing one original MicroFreak synth engine with an engine adapted from Mutable Instruments’ Plaits.

[Open FreakSwap](https://doriamxyz.github.io/FreakSwap/)

## Use

1. Choose one of the 11 engines.
2. Choose an available original engine to replace.
3. Select your official MicroFreak 5.0.0.2084 firmware file.
4. Download the modified `.mff` and installation guide.
5. Install manually using Arturia’s MIDI Control Center.

The catalog contains 38 individual replacement options. Firmware processing runs locally in your browser. The official firmware is not included or uploaded to a server.

## Installation risk

Back up your presets before installing. Presets using the replaced engine will sound different. Installing modified firmware carries a risk of bricking your MicroFreak. You use this experimental tool at your own risk and are responsible for your hardware. The author cannot guarantee that it will work on your unit or accept responsibility for damage or issues resulting from its use.

## GitHub Pages

In Settings → Pages, select **GitHub Actions** as the source. The workflow in `.github/workflows/pages.yml` publishes every push to `main`: it copies the web files and extracts `catalog.zip` into the deployed `catalog/` folder. The archive contains all 114 patches, recipes, and installation guides.

For a local preview, extract `catalog.zip` at the repository root, then serve that directory over HTTP. The site uses relative asset paths and runs under the repository URL.

## Notices

Independent project, unaffiliated with Arturia. MicroFreak and MIDI Control Center are Arturia product names. See [NOTICE.txt](NOTICE.txt) for third-party attribution and license terms.

## Modular browser tool (2.0)

Open `v2/` to assemble firmware locally from reusable ARM modules. The library defines each of the 11 existing engine families once (13 output variants) and exposes all 22 original engine positions. Engine compatibility comes from a shared ABI and measured object/scratch limits; there are no engine–destination pair definitions or complete-firmware recipes consulted by the composer. Six-OP is outside this update.

The browser jointly places module sections, relocations, bindings, labels and configuration across audited regions released by the positions you explicitly replace. Shared native-family code is reclaimed only when every original ID in that family is retired. A selection can also set a position to **Empty**, which produces silence and releases its eligible space. If a selection needs additional space, the UI offers a concrete Empty change that requires an explicit click. It never removes other engines silently. Insufficient capacity, fragmentation and bounded-search exhaustion are reported separately.

All eleven engine families fit together in the verified selection (33,229 bytes required, 41,108 bytes available). This does not mean every selection fits: available space depends on which originals are replaced, and each engine family may appear once per selection. Selecting a new combination does not compile DSP or bridge code. The official 5.0.0.2084 firmware stays on the visitor's device and is neither distributed here nor uploaded.

Before download, an independent structural verifier checks every changed byte, permitted memory region, retained descriptor and runtime binding; browser-side ARM execution then checks constructors, parameter setters, four-voice routing, paraphonic note histories, unison, activation/restoration and sample-rate changes. These bounded fixtures do not emulate boot, interrupts, MIDI transport, physical CPU timing or hardware audio. Physical acceptance of newly generated firmware remains pending.

Validation includes 47 passing Node tests with the official firmware: 38 composed selections covering every destination, all 13 module variants and stress selections; bit-exact native/WASM audio comparison; 994 retained-native differential cases; and original UI, preset serialization and persistent-storage checks for four representative selections. All 13 canonical DSP modules also match independent ABI-checked rebuilds. Negative tests reject unauthorized modifications, missing bindings, overlapping placements and broken Vocoder CV routing. Previous version-2 behavior is covered using its frozen library fixture and unchanged module objects.

For local checks, set `FREAKSWAP_FIRMWARE` to your official 5.0.0.2084 `.mff` path and run `node --test tests/*.test.mjs`. Firmware-dependent tests are skipped if no official file is supplied. Serve the repository over HTTP for a browser preview; no build server or external CDN is used. Shared bridge sources are in `tools/`. The patched interpreter source, build instructions and GPLv2 notices accompany the runtime in `v2/unicorn-source.tar.gz`.

This branch remains a draft for review. The production single-engine configurator and its assets remain at the root.
