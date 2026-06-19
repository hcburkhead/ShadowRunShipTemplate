# Helicarrier Power Dashboard

Holographic ship-status console for tabletop RPG / DM use. A Three.js wireframe
of the Helicarrier with live damage, power, and flight readouts. Static site —
no build step; just open the files (or host on GitHub Pages).

## Files
- `operator.html` — the DM control surface, with the holographic display
  embedded. Drives everything below.
- `index.html` — the holographic display: a perspective view + four profile
  views (dorsal / port / fore / aft), driven by shared state.
- `holo.html` — standalone holo view.
- `Helicarrier.fbx` — the ship model. `sts.png` — logo. `vendor/` — Three.js.

State syncs via localStorage + BroadcastChannel, with optional Firebase for
cross-device play.

## What the DM controls (operator.html)
- **Power allocation** — engines / drones / weapons / shields, sharing a 100%
  budget (auto-clamped).
- **Main battery** — DM-set core reserve (depletes as systems take damage) plus
  a 25% auxiliary reserve. Players spend the reserve via a **battery boost**.
- **Damage control** — set each area (bridge, reactor, AI core, drone bay,
  weapons, boosters, lift fans) to ONLINE / DAMAGED / OFFLINE, plus hull
  integrity and the four directional shield panels.
- **Altitude** — slider that raises/lowers the ship projection.
- **Impact timer** — a set / start / stop / reset countdown (defaults to 10:00)
  shown top-right on the display; at 0:00 the ship "impacts" (resettable).

## On the display (index.html)
- Counter-rotating lift-fan blades per duct (slow/stop/red as fans take damage).
- The hull **kerns** — banks/pitches toward failing lift fans.
- Directional shields, a floor shield ring, drone swarm, and blinking damage
  dots, all colored by state.
- A left-rail **system log** (DM view only) recording every state change.

## Views
- `operator.html` — DM console.
- `operator.html?player-view` — player view: ship views, damage dots, impact
  timer, and the battery-boost control only (no state readouts).
