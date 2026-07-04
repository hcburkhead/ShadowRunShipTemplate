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
- `ship-model.js` — the shared power/damage model (pure functions + sync
  constants); both `operator.html` and `index.html` import it, so the math
  lives in one place.
- `gas/ship-commands.gs` — Google Apps Script helper for sending remote
  commands to the ship from a Google Sheet (see "Remote commands" below).
- `gas/casper-shiplink.gs` — drop-in bridge for the CASPER TACTICAL OS player
  terminal (GAS web app): adds `ship status/timer/alt/power` commands plus the
  hidden `SD -T <secs>` destruct code, sharing the ship terminal's 3-attempt /
  5-minute lockout. Install notes are in the file header.
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
  DM can damage the aux bank; *not* drained by ship integrity. If the DM damages
  it fully, aux **locks out** for players (a global "AUX BANK OFFLINE" banner) —
  the signal to fall back to battery and restore aux via DM challenges.
- **Battery backup — up to 25%.** A separate always-available fallback reserve,
  routed per system. It **can't be damaged** (only routed out / depleted); *not*
  drained by ship integrity.

**Ship integrity** is **derived** from the combined health of these three systems
plus the rest of the ship (areas, lift fans, shield panels). As systems break, the
overall state degrades **NOMINAL → DAMAGED → CRITICAL → OFFLINE** on its own.

**Max power & self-destruct.** A ship-wide **MAX POWER** meter reads CORE + AUX +
BATTERY; the safe maximum is **175%** (core 100 + aux 50 + battery 25). Players have
an **OVERDRIVE** control that forces both reserve banks to 100% output — pushing the
total past the 175% redline **overloads the reactor and triggers the self-destruct
sequence** (the display floods red with a CORE OVERLOAD banner). Backing overdrive
off drops it below the redline and clears the overload. Two gates keep it hidden
and honest:
- The OVERDRIVE button **stays hidden** until the players fully commit both
  reserve banks (every system's AUX at 50% and BATTERY at 25%) — the overload
  isn't advertised up front.
- The reactor can only be overloaded at **full core power**. If the core is at
  50% (reactor damaged) or 0% (reactor offline), there isn't enough output to
  push past the redline — an amber **insufficient core power** flag shows on the
  MAX POWER panel and the self-destruct cannot trigger (an active overload also
  clears if the core drops mid-overdrive).

**Shields** are a special case. Available shield power follows core (main) power —
full main = 100%, damaged main = 50%. Each of the four shield panels the DM marks
**DAMAGED/OFFLINE costs 13%**. Players route **aux/battery to the shields system** to
recover **damaged (yellow)** panels back up to the available ceiling (e.g. main
damaged + one panel down = 37%; routing 13% brings it to 50%). **Offline (red)**
panels are a hard loss until the DM repairs them — routed power can't recover them.

**Ship terminal.** A command-line card on the console (players get it too). The
players can type commands; the right one — **`SD -T <seconds>`**, e.g.
`SD -T 20` — starts a SELF-DESTRUCT countdown on the display **regardless of
core power** (unlike overdrive, which needs a full core). Three bad entries
lock the terminal for **5 minutes** (again on each relock); the DM has a
RESET LOCK override, and the terminal history/lockout syncs to every console.

**Remote commands (Google Apps Script / Sheets).** External tools can drive the
ship by writing to the `shipCommand` key in the Firebase DB — `gas/ship-commands.gs`
is a paste-ready Apps Script with a `sendShipCommand('...')` helper, a SHIP
spreadsheet menu, and an optional type-a-command-in-a-cell console. Supported
commands (no terminal lockout on this channel — it's the GM's authorized path):
`SD -T <secs>`, `TIMER <secs|m:ss> [LABEL]`, `TIMER STOP|RESET`,
`DAMAGE <AREA> <ONLINE|DAMAGED|OFFLINE>`, `SHIELD <FORE|STBD|AFT|PORT> <state>`,
`POWER <ENG|DRONES|WEAPONS|SHIELDS> <0-100>`, `ALT <0-100>`. Every executed
command is echoed in the terminal log with a `▮ REMOTE >` prefix; there is also
a local test hook — run `shipCommand('SD -T 20')` in the browser console.

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
  aux-bank damage) feeds the derived ship-integrity state. Only the **aux** bank is
  DM-damageable — the battery can't be damaged.
- **Altitude** — slider that raises/lowers the ship projection.
- **"Oh sh*t!" timer** — a general-purpose set / start / stop / reset countdown
  (defaults to 10:00) to any catastrophe. The DM names the event (IMPACT, CORE
  MELTDOWN, HULL BREACH, …); the countdown shows top-right on the display —
  players see it too — and at 0:00 the display floods red with the event banner
  until the DM resets it.

## On the display (index.html)
- Counter-rotating lift-fan blades per duct (slow/stop/red as fans take damage).
- The hull **kerns** — banks/pitches toward failing lift fans.
- Directional shields, a floor shield ring, drone swarm, and blinking damage
  dots, all colored by state.
- A left-rail **system log** (DM view only) recording every state change.

## Views
- `operator.html` — DM console.
- `operator.html?player-view` — player view: the live ship display (blinking
  yellow/red damage dots, the shield view showing which panel is under attack,
  main-power / integrity / subsystem readouts), plus the **three power controls
  players operate** — main-power system load, auxiliary routing, battery routing,
  and the **OVERDRIVE** button (hidden until both reserve banks are routed to
  full). Everything else (damage control, integrity, flight,
  timer) is DM-only. Battery is always available; aux sliders lock out entirely
  (with a global offline banner) once the DM fully damages the aux bank.
