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

## Six-Op FM A/B/C

The Six-Op page prepares one fixed three-engine configuration: A in Two Op. FM, B in Formant and C in Speech, 32 patches per bank. It includes the live audio-rate tuning correction. The 38 individual replacement options remain available. Physical testing of the exact updated Six-Op firmware is pending.
