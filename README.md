# Ship Power Dashboard

Tactical ship power management for tabletop RPG / DM use.

## Files
- `index.html` — the single, self-contained dashboard: the blueprint with live
  SVG overlays, inset power bars, a main-power indicator, sliders, and a status
  log. Just open it in a browser.
- `ShipTemplate.png` — the ship schematic graphic.

## How it works
The schematic art stays as the base layer. Two transparent SVG layers sit on top,
aligned to the image (viewBox 1538×688 = the image's native size):
- a `mix-blend-mode: color` layer recolors each system's lines by power level
- a `mix-blend-mode: screen` layer adds a soft glow

Drag a slider and that system's actual structures shift color:
green (full) → yellow → orange → red (critical), pulsing red at 0%. The same
slider also fills that system's bar inset over the schematic's power panel and
updates the total-allocated readout in the main-power panel.

## System → structure mapping
| System  | Structures lit |
|---------|----------------|
| Engines | 4 dorsal turbine nacelles, side-profile turbine, 2 bow intake rings |
| Drones  | internal drone bay (2×2) |
| Weapons | mounted rail gun |
| Shields | bow hexagon emitter |

## Rules
- Total battery is 100%, shared across all four systems; each capped at 25%.
- Pushing one slider past the remaining budget clamps it automatically.

## Tweaking overlay placement
All overlay coordinates are plain SVG shapes inside the two `<svg>` blocks in
`index.html`, in the image's pixel space (0–1538 x, 0–688 y). Nudge any
`x/y/width/height/cx/cy/r/points` value to fine-tune a structure. The inset
progress bars are positioned by percentage of the image in the `.bar-overlay`
block.
