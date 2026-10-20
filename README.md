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

## Modular browser prototype (2.0)

Open `v2/` to assemble a selection from reusable ARM modules directly in the browser. This prototype supports Phase Distortion, Swarm and Bass Drum across nine available choices, using four DSP module objects and one shared native bridge. Swarm has one immutable module and independent host contracts for Speech, Chords, Basic Waves and Superwave; those four choices do not store pair-specific adaptations. The two native slots require explicitly replacing Speech to release verified code space. It does not look up or merge complete-firmware patches. The original firmware remains on the visitor's device.

The prototype links sections and ARM relocations, applies the adapter contracts and computes the shared configuration bridge for the requested selection. Download is enabled only after structural/archive checks and browser-side ARM checks complete: native constructors and parameter setters, four independent notes and DSP dispatch, retained Plaits frontends, four-voice unison, logical note-on/off and late audio-rate changes. These are bounded test fixtures, not boot, interrupt, MIDI transport, physical CPU or hardware acceptance.

Two previously uncatalogued three-engine recipes were independently built and passed the existing native verification suite. Their browser-assembled firmware matches byte for byte. All seven individual reference results also match. The complete native controller-construction regression catches an upstream interpreter temporary-lifetime bug fixed in this prototype. The patched interpreter source, build instructions and GPLv2 notices are supplied alongside the runtime in `v2/unicorn-source.tar.gz`.

This remains a limited prototype. The native bridge is currently exposed only for Swarm in Basic Waves and Superwave. A global allocator across all retired code regions and universal host coverage remain future work. The production single-engine configurator and its assets remain available at the root.

For local checks, set `FREAKSWAP_FIRMWARE` to your official 5.0.0.2084 `.mff` path and run `node --test tests/v2-core.test.mjs tests/v2-portable.test.mjs`. Without the file, module/selection/allocator tests still run and firmware-dependent tests are skipped. Serve the repository over HTTP for a browser preview; no build server or external CDN is used.

The portable-host proof also runs DSP-level note/control ownership, held-note replacement histories and native overlay restoration. Both native selections passed the established independent ARM suites (presets, controls/display, mono/paraphonic, unison, CV activation, retained native engines with loaded resources). Their audio is bit-identical to the previous native builder under matching fixtures, and native/WASM results agree. Bridge sources are provided in `tools/`; no DSP module was recompiled for the portable-host proof. Physical acceptance is still required.
