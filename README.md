# Ship Power Dashboard

Tactical ship power management for tabletop RPG / DM use.

## Files
- `schematic_overlay.html` — **NEW**: the original blueprint image with live SVG
  overlays. Each system tints its real structures by power level. Self-contained
  (image is embedded) — just open it in a browser.
- `index.html` — the side-panel dashboard (Engines/Drones/Weapons/Shields bars + log).
- `ShipTemplate.png` — the ship schematic graphic.

## How the overlay works (schematic_overlay.html)
The original art stays as the base layer. Two transparent SVG layers sit on top,
aligned to the image (viewBox 1538×688 = the image's native size):
- a `mix-blend-mode: color` layer recolors each system's lines by power level
- a `mix-blend-mode: screen` layer adds a soft glow

Drag a slider and that system's actual structures shift color:
green (full) → yellow → orange → red (critical), pulsing red at 0%.

## System → structure mapping
| System  | Structures lit |
|---------|----------------|
| Engines | 4 dorsal turbine nacelles, side-profile turbine, 2 bow intake rings |
| Drones  | internal drone bay (2×2) |
| Weapons | conning tower + battery box, ventral pods + gun, bow mast |
| Shields | bow hexagon emitter |

## Rules
- Total battery is 100%, shared across all four systems; each capped at 25%.
- Pushing one slider past the remaining budget clamps it automatically.

## Tweaking overlay placement
All overlay coordinates are plain SVG shapes inside the two `<svg>` blocks in
`schematic_overlay.html`, in the image's pixel space (0–1538 x, 0–688 y).
Nudge any `x/y/width/height/cx/cy/r/points` value to fine-tune a structure.
