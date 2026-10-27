# FreakSwap

[Open FreakSwap](https://doriamxyz.github.io/FreakSwap/)

A free, independent browser tool for building a custom MicroFreak engine lineup. Choose which original engines to replace, listen to examples, and prepare a modified firmware file locally in your browser.

## Raster

Raster replaces Sample with rhythmic sample slicing and repeat controls. Wave sets Start, Timbre chooses the Density division and Shape adds Chaos. It uses your loaded samples and the existing sample selector. Repeats follow transport while it runs and return to free repetition when it stops. Cloud, Hit and Scan stay unchanged unless you explicitly replace those slots too. [Implementation, rebuilding and limits](engines/raster/README.md).

## Use

1. Choose the original positions and their replacement engines.
2. Optionally load a compatible Yamaha DX7 bank for 6-Op FM Custom and select its presets.
3. Continue and select the official MicroFreak firmware **5.0.0.2084** (`.mff`).
4. Prepare and download the modified firmware and installation guide.
5. Back up your presets and install manually with Arturia MIDI Control Center.

The official firmware is not included or uploaded. Imported banks remain in the browser session and must be selected again after a reload. Audio examples are digital references, not recordings of the instrument's analog output.

## Installation risk

Modified firmware is experimental and can damage or brick your instrument. Back up your presets and keep the official firmware. Automated checks do not certify hardware boot, timing or physical audio. Use at your own risk.

## Support

FreakSwap is free and always will be. Optional contributions: [Support the project](https://ko-fi.com/doriamxyz).

## Notices

Independent project, unaffiliated with Arturia. MicroFreak and MIDI Control Center are Arturia product names. See [NOTICE.txt](NOTICE.txt) for third-party attribution and licenses. The verification interpreter's source and build instructions are included in [unicorn-source.tar.gz](unicorn-source.tar.gz).
