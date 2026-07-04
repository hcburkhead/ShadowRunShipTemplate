/**
 * SHIPLINK — CASPER TACTICAL OS ⇄ Helicarrier console bridge.
 *
 * INSTALL (2 steps, no Terminal.html changes needed):
 *   1. Add this file to the CASPER Apps Script project (File → New → Script,
 *      name it ShipLink).
 *   2. In Code.gs, inside processCommand's try block, add ONE line just
 *      before the switch statement:
 *
 *          var ship = shipLinkHandle(raw);
 *          if (ship) return ship;
 *
 * That's it — responses come back as { type:'text', content:[...] }, which
 * the CASPER terminal already knows how to print.
 *
 * PLAYER COMMANDS ADDED:
 *   ship                     → uplink help
 *   ship status              → live helicarrier readout (core/aux/countdown)
 *   ship timer <m:ss> [NAME] → start a countdown (ship timer 5:00 CORE MELTDOWN)
 *   ship timer stop|reset    → pause / clear the countdown
 *   ship alt <0-100>         → set ship altitude
 *   ship power <sys> <0-100> → throttle eng|drones|weapons|shields
 *   SD -T <seconds>          → the self-destruct code (NOT listed in help).
 *                              Shares the ship terminal's 3-attempt /
 *                              5-minute lockout — bad "SD ..." entries here
 *                              burn the SAME attempts as on the ship console,
 *                              and everything echoes into the DM's terminal.
 *
 * DAMAGE / SHIELD commands are deliberately NOT exposed to players — the DM
 * keeps those in gas/ship-commands.gs.
 *
 * Requires: a ship console (operator.html or the player view) open somewhere
 * to execute commands — always true during play.
 */

var SHIP_DB_URL = 'https://shadowrun-ship-db-default-rtdb.firebaseio.com';
var SHIP_TRIES = 3;
var SHIP_LOCK_MS = 5 * 60 * 1000;

// ---- Firebase REST helpers ----
function shipGet_(key) {
  try {
    var res = UrlFetchApp.fetch(SHIP_DB_URL + '/' + key + '.json', { muteHttpExceptions: true });
    return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null;
  } catch (e) { return null; }
}
function shipPut_(key, value) {
  try {
    var res = UrlFetchApp.fetch(SHIP_DB_URL + '/' + key + '.json', {
      method: 'put', contentType: 'application/json',
      payload: JSON.stringify(value), muteHttpExceptions: true,
    });
    return res.getResponseCode() === 200;
  } catch (e) { return false; }
}
function shipSend_(cmd) {
  return shipPut_('shipCommand', { id: Utilities.getUuid(), at: Date.now(), cmd: String(cmd) });
}

// ---- small utils ----
function shipText_(lines) { return { type: 'text', content: lines }; }
function shipClock_(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
}

// ---- shared ship-terminal lockout state (same shape the consoles use) ----
function shipTermState_() {
  var t = shipGet_('shipTerminal') || {};
  return {
    attempts: Math.max(0, Math.min(SHIP_TRIES, parseInt(t.attempts, 10) || 0)),
    lockUntil: Math.max(0, Number(t.lockUntil) || 0),
    hist: Array.isArray(t.hist) ? t.hist : [],
  };
}
function shipTermSave_(t, lines) {
  (lines || []).forEach(function (l) { t.hist.push({ m: l.m, c: l.c }); });
  t.hist = t.hist.slice(-6);
  shipPut_('shipTerminal', t);
}

// ---- main hook: call from processCommand with the raw command string ----
// returns a CASPER response object, or null if the command isn't ship-related
function shipLinkHandle(raw) {
  var s = String(raw || '').trim().replace(/\s+/g, ' ');
  var up = s.toUpperCase();

  // ── the self-destruct code (secret — shares the ship terminal lockout) ──
  if (/^SD( |$)/.test(up)) {
    var t = shipTermState_();
    var now = Date.now();
    if (t.lockUntil > now) {
      return shipText_(['> SHIP UPLINK LOCKED — RETRY IN ' + shipClock_((t.lockUntil - now) / 1000)]);
    }
    var m = up.match(/^SD -T (\d{1,4})$/);
    if (m) {
      var secs = Math.max(1, Math.min(5999, parseInt(m[1], 10)));
      t.attempts = 0;
      shipTermSave_(t, [{ m: '▮ CASPER > ' + up, c: 'tl-in' },
                        { m: '⚠ COMMAND ACCEPTED — SELF-DESTRUCT SEQUENCE INITIATED · T-' + shipClock_(secs), c: 'tl-ok' }]);
      shipSend_(up);
      return shipText_([
        '> UPLINK ACCEPTED.',
        '> SELF-DESTRUCT SEQUENCE INITIATED — T-' + shipClock_(secs),
        '> THIS TERMINAL IS NOT RESPONSIBLE FOR WHAT HAPPENS NEXT.',
      ]);
    }
    // an "SD ..." entry with the wrong code burns a shared attempt
    t.attempts++;
    if (t.attempts >= SHIP_TRIES) {
      t.attempts = 0;
      t.lockUntil = now + SHIP_LOCK_MS;
      shipTermSave_(t, [{ m: '▮ CASPER > ' + up, c: 'tl-in' },
                        { m: '✖ COMMAND REJECTED — TERMINAL LOCKED (5:00)', c: 'tl-lock' }]);
      return shipText_(['> COMMAND REJECTED — SHIP UPLINK LOCKED (5:00)']);
    }
    var left = SHIP_TRIES - t.attempts;
    shipTermSave_(t, [{ m: '▮ CASPER > ' + up, c: 'tl-in' },
                      { m: '✖ COMMAND NOT RECOGNIZED — ' + left + ' ATTEMPT(S) REMAINING', c: 'tl-err' }]);
    return shipText_(['> COMMAND NOT RECOGNIZED — ' + left + ' ATTEMPT(S) REMAINING']);
  }

  // ── everything else lives under "ship ..." ──
  if (!/^SHIP( |$)/.test(up)) return null;   // not ours — fall through to CASPER
  var arg = up.slice(4).trim();

  if (!arg || arg === 'HELP' || arg === '-H') {
    return shipText_([
      '═══════════════════════════════════════',
      '   - HELICARRIER UPLINK -',
      '═══════════════════════════════════════',
      '',
      '  ship status              → live ship readout',
      '  ship timer <m:ss> [NAME] → start a countdown',
      '  ship timer stop          → pause the countdown',
      '  ship timer reset         → clear the countdown',
      '  ship alt <0-100>         → set altitude',
      '  ship power <sys> <0-100> → throttle a system',
      '       sys: eng | drones | weapons | shields',
      '',
      'EXAMPLES:',
      '  ship timer 5:00 CORE MELTDOWN',
      '  ship power weapons 0',
      '  ship alt 25',
      '',
      '═══════════════════════════════════════',
    ]);
  }

  if (arg === 'STATUS') {
    var dmg = shipGet_('shipDamageState') || {};
    var areas = dmg.areas || {};
    var r = parseInt(areas.reactor, 10) || 0;
    var core = r >= 2 ? 0 : r >= 1 ? 50 : 100;
    var aux = shipGet_('shipAux') || {};
    var auxDmg = Math.max(0, Math.min(50, Number(aux.auxDmg) || 0));
    var tm = shipGet_('shipTimer') || {};
    var tLeft = tm.running && tm.endsAt ? Math.max(0, (tm.endsAt - Date.now()) / 1000) : (Number(tm.remaining) || 0);
    return shipText_([
      '--- HELICARRIER UPLINK STATUS ---',
      'CORE POWER : ' + core + '%' + (core === 0 ? '  [REACTOR OFFLINE]' : core === 50 ? '  [REACTOR DAMAGED]' : ''),
      'AUX BANK   : ' + (50 - auxDmg) + '% CAP' + (auxDmg >= 50 ? '  [OFFLINE]' : ''),
      'OVERDRIVE  : ' + (aux.overdrive ? 'ENGAGED' : 'off'),
      'COUNTDOWN  : ' + (tm.running ? (tm.label || 'IMPACT') + ' — ' + shipClock_(tLeft) : 'inactive'),
    ]);
  }

  // whitelisted pass-through — the few specific commands players may send
  var ALLOWED = [
    /^TIMER (STOP|RESET)$/,
    /^TIMER \d{1,4}( .+)?$/, /^TIMER \d{1,3}:[0-5]\d( .+)?$/,
    /^ALT \d{1,3}$/,
    /^POWER (ENG|ENGINES|DRONES|DRN|WEAPONS|WPN|SHIELDS|SHD) \d{1,3}$/,
  ];
  for (var i = 0; i < ALLOWED.length; i++) {
    if (ALLOWED[i].test(arg)) {
      var ok = shipSend_(arg);
      return shipText_([ok ? '> UPLINK SENT: ' + arg : '> ERR: UPLINK UNREACHABLE — TRY AGAIN.']);
    }
  }
  return shipText_(['> ERR: unknown ship command.', '> Type "ship help" for the uplink index.']);
}
