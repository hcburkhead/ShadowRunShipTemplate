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

## Power model (three tiers, per system)
Each system (engines / drones / weapons / shields) is fed in three tiers:
- **Core power — 100%.** The main supply, **derived from ship integrity** (hull
  sets the ceiling, the reactor weighs heavily, the rest of the ship trims the
  top; a dead hull or reactor zeroes it). At 100% every system is fully fed and
  **players do nothing**. As the ship takes damage, core power drops — restore it
  by repairing the ship (DM challenges).
- **Auxiliary — up to 50%.** A player-routed reserve. When core power is down,
  players route aux into a system to bring it back to **sub-optimal** levels.
  *Not* affected by ship integrity; the DM can damage the aux bank separately.
- **Battery backup — up to 25%.** A fallback reserve that **unlocks once the aux
  bank is damaged**. *Not* affected by ship integrity.

It's a tracker — aux/battery routing is the players' control; the DM applies the
in-game effect by hand.

## What the DM controls (operator.html)
- **Core power** — read-only; it tracks ship integrity automatically.
- **System power** — a per-system core throttle (0–100%), capped by the current
  core level. Throttle or cut any system.
- **Aux / battery routing** — players route per-system aux (50%) and battery
  (25%); the DM can **damage the aux/battery banks** (independent of ship
  integrity), which lowers their ceiling and unlocks the battery fallback.
- **Damage control** — set each area (bridge, reactor, AI core, drone bay,
  weapons, boosters, lift fans) to ONLINE / DAMAGED / OFFLINE, plus hull
  integrity and the four directional shield panels. Hull + reactor + area damage
  feed the core-power calculation.
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
