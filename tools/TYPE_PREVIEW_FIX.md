# Type preview: stale engine name

The OLED firmware accepts at most 13 ASCII characters for the engine-change preview title. The terminating NUL counts toward a strict length check below 15 bytes. A 14-character title is transmitted correctly by the main CPU, but the OLED processor leaves the previous preview text in its cache.

`String Machine` and `Filtered Noise` were both 14 characters. The instrument now receives `StringMachine` and `FilteredNoise` (13 characters); the catalog keeps the full engine names. Engine modules, synthesis parameters and bank data are unchanged.

The original OLED packet handler at `0x08005380` calls the native preview cache routine at `0x08003d74`. Its length check at `0x08003d9c`–`0x08003da2` skips the text copy for lengths of 15 or more, including the NUL. This explains why entering String Machine from Wavetable displayed Wavetable, while entering it from Karplus displayed KarplusStr.

## Validation

`tests/v5-type-preview.test.mjs` executes the original OLED packet decoder and preview cache using the OLED member of the locally supplied official firmware. It reproduces the stale name with both old labels and verifies the corrected labels. It also checks every current engine title against the 13-character limit. No official firmware is distributed.

The private native check also drives the main CPU's original title renderer and passes its actual packets into the original OLED decoder. It verifies the user's exact composition, two String Machine destinations, and both Filtered Noise variants in both directions. Main-CPU refresh arguments and final OLED frame scheduling remain fixtures; physical display pixels and hardware input timing are not covered.

All 70 selection packages were recomposed and independently checked. Six changed because their label data changed; their native execution checks retained exactly the previous audio references. The other 64 firmware images are byte-identical. Only those six package/raw identities were updated in the existing reference fixture.

Run with the rest of the suite using `FREAKSWAP_FIRMWARE=/absolute/path/to/official.mff node --test tests/*.test.mjs`.
