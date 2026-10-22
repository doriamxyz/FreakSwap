# FreakSwap

An independent, experimental browser tool for replacing original MicroFreak synth engines with engines adapted from Mutable Instruments’ Plaits.

[Open FreakSwap](https://doriamxyz.github.io/FreakSwap/)

## Use

1. Add one or more of the 11 engines. If needed, choose an explicit group to complete the combination.
2. Choose an available original to replace for each selected engine.
3. Select your official MicroFreak 5.0.0.2084 firmware file.
4. Download the modified `.mff` and installation guide.
5. Install manually using Arturia’s MIDI Control Center.

The catalog contains 85 complete configurations: the existing 38 individual replacements and 47 combinations, covering 67 engine/destination/version choices. The largest verified configurations contain 10 replacements. Available destinations depend on the complete configuration; some native destinations need space freed by another replacement. This release does not support every engine in every destination. Firmware processing runs locally in your browser. The official firmware is not included or uploaded to a server.

## Installation risk

Back up your presets before installing. Presets using the replaced engine will sound different. Installing modified firmware carries a risk of bricking your MicroFreak. You use this experimental tool at your own risk and are responsible for your hardware. The author cannot guarantee that it will work on your unit or accept responsibility for damage or issues resulting from its use.

## GitHub Pages

In Settings → Pages, select **GitHub Actions** as the source. The workflow in `.github/workflows/pages.yml` publishes every push to `main`: it copies the web files and extracts `catalog.zip` into the deployed `catalog/` folder. The archive contains all 255 patches, recipes, and installation guides.

For a local preview, extract `catalog.zip` at the repository root, then serve that directory over HTTP. The site uses relative asset paths and runs under the repository URL.

## Notices

Independent project, unaffiliated with Arturia. MicroFreak and MIDI Control Center are Arturia product names. See [NOTICE.txt](NOTICE.txt) for third-party attribution and license terms.

## Verification

After extracting `catalog.zip`, run `node --test tests/selection.test.mjs`. These checks cover reachability of every configuration, compatible destinations and versions, explicit companion groups, selection persistence, invalid inputs, and preservation of all 38 previous individual results.

Each published patch reconstructs an exact, locally verified whole firmware. Patches are never combined in the browser. Offline checks do not replace physical testing of the exact downloaded firmware.
