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

## Power model — three separate physical systems
The ship runs on three independent power systems that work together to keep it in
a nominal state; each feeds every system (engines / drones / weapons / shields):
- **Core reactor — 100%.** Its own physical system. Core (main) power comes
  straight off the reactor: **ONLINE = 100%**, **DAMAGED = 50%**, **OFFLINE = 0%**.
  At 100% every system is fully fed and **players do nothing**. If the reactor is
  hit (by the DM or players), core power drops and players fall back to the
  reserves — restore the reactor via DM challenges.
- **Auxiliary — up to 50%.** A separate reserve players route into a starved
  system to bring it back to **sub-optimal** levels when core power is down. The
  DM can damage the aux bank; *not* drained by ship integrity.
- **Battery backup — up to 25%.** A separate fallback reserve that **unlocks once
  the aux bank is damaged**. The DM can damage it too; *not* drained by ship
  integrity.

**Ship integrity** is **derived** from the combined health of these three systems
plus the rest of the ship (areas, lift fans, shield panels). As systems break, the
overall state degrades **NOMINAL → DAMAGED → CRITICAL → OFFLINE** on its own.

It's a tracker — aux/battery routing is the players' control; the DM applies the
in-game effect by hand.

## What the DM controls (operator.html)
- **Core power** — read-only; it reflects the core reactor's state.
- **System power** — a per-system core throttle (0–100%), capped by the current
  core level. Throttle or cut any system.
- **Aux / battery routing** — players route per-system aux (50%) and battery
  (25%); the DM can **damage the aux/battery banks** (independent of ship
  integrity), which lowers their ceiling and unlocks the battery fallback.
- **Ship integrity** — read-only, derived from every system's health.
- **Damage control** — set each area (bridge, **reactor**, AI core, drone bay,
  weapons, boosters, lift fans) to ONLINE / DAMAGED / OFFLINE, plus the four
  directional shield panels. The reactor drives core power; every system (plus
  aux/battery bank damage) feeds the derived ship-integrity state.
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
  timer, and the per-system aux / battery routing only (no state readouts; the
  battery sliders stay locked until the aux bank is damaged).
