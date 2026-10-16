# Brand source artwork

Drop the original exports here. These are the *sources*; everything in
`assets/images/` is generated from them, so never edit the generated files by hand.

## What to put in

| File | What it is | Minimum size | Background |
|---|---|---|---|
| `symbol.png` | The ring-and-document mark **alone**, tightly cropped, square | 1024 x 1024 | **transparent** |
| `wordmark.png` | The word "MedRekk" **alone**, no symbol | 2000 px wide | **transparent** |
| `lockup.png` | Symbol + wordmark together (optional) | 2000 px wide | **transparent** |

Either colour is fine — green `#0F6E56` or white. They can be recoloured either
way as long as the background is transparent.

## Why transparent matters

A white background baked into the PNG cannot be removed cleanly: the anti-aliased
edges keep a white fringe that shows up against the green splash. Export with
transparency, not on a white artboard.

## Why size matters

The files that were in use were 80 x 80 and 104 x 104, scaled up to fill a
1024 x 1024 icon slot. That upscale is why the icon looked soft. Bigger than
needed is harmless; smaller cannot be recovered.

## What gets generated from them

- `assets/images/icon.png` — 1024, full bleed on green (iOS masks the corners itself)
- `assets/images/android-icon-foreground.png` — 1024, transparent, mark inside the
  centre 60% because Android masks adaptive icons and crops the rest
- `assets/images/android-icon-background.png` — 1024, solid `#0F6E56`
- `assets/images/android-icon-monochrome.png` — 1024, flat silhouette for themed icons
- `assets/images/splash-icon.png` — the launch mark, white on green
- `assets/images/favicon.png` — 256, for the web build

SVG is not usable in the pipeline that generates these, so export PNG.
