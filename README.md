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

Open `v2/` to assemble firmware locally from reusable ARM modules. The catalog includes the eleven existing engine families and **Six-OP FM A/B/C Fidelity+** (32 factory programs per bank). All 22 original positions are selectable. Compatibility comes from a shared ABI and measured object/scratch limits rather than engine–destination pair definitions or complete-firmware recipes.

Six-OP uses the Fidelity operator amplitude law, LiveRate correction, native-screen exit fix, named patch selection, four Shift controls and SF6 V6 preset extension. It also incorporates the later per-patch DX7 transpose correction found in Finetales3. The private Finetales bank is not included. Some factory patches consequently play at a different octave from the older A/B/C port that ignored their transpose setting. DX LFO and a second internal FM voice remain outside this compact port.

Code and UI are shared between the three banks. Each bank's patch data, names, factory defaults and transpose values are independently linkable: selecting A does not reserve B/C. A single-bank selection replacing Speech requires 11,481 bytes and fits without an additional Empty. A/B/C together require 18,521 bytes in the verified selection replacing Two Op FM, Formant and Speech. Fourteen entries (the eleven earlier engines plus all three FM banks) also fit jointly in the tested selection with explicit Empty positions.

The browser places every module, label, binding and configuration section together across audited regions released by the originals you explicitly replace. Ownership is derived jointly across renderer roots and shared callees. Under full explicit retirement, verified capacity increased from 49,318 to 60,110 bytes. Newly enabled single-owner regions include SuperWave (600), Bass (1,078), SawX (1,290) and Harm (1,734 bytes). Actual space and fit depend on the selection; total bytes alone do not overcome fragmentation.

Unresolved references keep code protected. Shared native code is available only after all required owners are retired: for example, the recovered grain closure also requires Sample. Some originals still release zero verified bytes individually. Empty is an explicit silent replacement. The UI can offer an Empty suggestion, which requires a click; it never removes another original silently. Capacity, fragmentation and bounded-search exhaustion are reported separately.

Before download, an independent structural verifier checks permitted changes, retained descriptors, runtime tables, memory placement and conditional Six-OP hooks/state reservation. Browser ARM execution checks initialization, four-voice routing, audio, note histories, unison, live sample-rate changes and activation/restoration. Six-OP bank mappings and its gate pointer into each native Voice are checked explicitly.

The pre-TWIST qualification passed 58 Node tests with no skips. Validation covers 70 selections, including every Six-OP destination, all three single-bank selections, A/B/C at original and high IDs, recovery cases and the fourteen-entry stress selection. The 96 patches are compared against an independent complete FM Voice with original transpose; UI encoders, names, preset serialization, bank identities and persistent storage are exercised. 474 native/WASM audio cases agree bit for bit, and 1,808 retained-original differential cases passed. All 96 factory patches match the independent complete FM Voice sample for sample with their transpose applied. The old version-2 and version-3 libraries remain frozen as regression fixtures. Rebuildable Six-OP sources and source hashes are in `tools/sixop/`.

For local checks, set `FREAKSWAP_FIRMWARE` to your official 5.0.0.2084 `.mff` path and run `node --test tests/*.test.mjs`. Firmware-dependent tests are skipped without the official file. Serve the repository over HTTP; no build server or external CDN is used. The patched interpreter source, build instructions and GPLv2 notices accompany `v2/unicorn-source.tar.gz`.

This branch remains a draft. Physical acceptance of the generated files is pending: bounded emulation does not certify complete hardware boot, interrupts, MIDI transport, CPU/stack timing or physical audio. The official input stays on the visitor's device. Production root assets remain unchanged.

## Palette TWIST controls

Hold Shift and turn Type to edit the documented fourth parameter of each of the
eleven non-FM engine families. The configurator describes the function for your
selected engine. Values start at the original sound (50%) and persist in a
separate TW4 preset extension. Filtered Noise Dual Band retains its previous
controls because Palette’s macro affects OUT rather than AUX.

Six-OP A/B/C sources, modules, banks and SF6 V6 stay unchanged. Six-OP-only
selections reproduce their prior firmware exactly; mixed selections chain the
existing Six-OP controls and codecs. Details, rebuild instructions and the
qualified memory reservation are in [tools/twist/README.md](tools/twist/README.md).

This branch adds seven tests to the 60 existing regressions and qualifies 17
whole selections, including the fourteen-entry stress case. The actual browser
download matches the independent composition. Hardware acceptance remains
pending. Summary evidence: [tools/twist/validation.json](tools/twist/validation.json).
