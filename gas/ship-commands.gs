/**
 * Helicarrier console — Google Apps Script remote commands.
 *
 * Paste this into your Apps Script project (script.google.com, or in a Sheet:
 * Extensions → Apps Script). It sends commands to the ship through the same
 * Firebase Realtime Database the consoles sync on — every open console
 * (operator.html, player view) picks a command up within about a second and
 * executes it. No API keys or OAuth scopes beyond UrlFetchApp are needed.
 *
 * Your own script can just call sendShipCommand('...') with any command below.
 *
 * ── Command reference ────────────────────────────────────────────────────
 *   SD -T <seconds>            self-destruct countdown (works at any core level)
 *   TIMER <secs|m:ss> [LABEL]  labeled countdown, e.g. TIMER 5:00 CORE MELTDOWN
 *   TIMER STOP | TIMER RESET   pause / clear the countdown
 *   DAMAGE <AREA> <STATE>      AREA: REACTOR BRIDGE AICORE DRONEBAY WPNFWD
 *                              WPNAFT BOOSTP BOOSTS FANFP FANFS FANAP FANAS
 *                              STATE: ONLINE | DAMAGED | OFFLINE
 *   SHIELD <PANEL> <STATE>     PANEL: FORE | STBD | AFT | PORT
 *   POWER <SYSTEM> <0-100>     SYSTEM: ENG | DRONES | WEAPONS | SHIELDS
 *   ALT <0-100>                ship altitude
 * ─────────────────────────────────────────────────────────────────────────
 */

var SHIP_DB = 'https://shadowrun-ship-db-default-rtdb.firebaseio.com';

/** Send one command to the ship. Returns the HTTP status code. */
function sendShipCommand(cmd) {
  var payload = { id: Utilities.getUuid(), at: Date.now(), cmd: String(cmd) };
  var res = UrlFetchApp.fetch(SHIP_DB + '/shipCommand.json', {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return res.getResponseCode();
}

/* ── ready-made commands (wire these to buttons, menus, or your own logic) ── */

function shipSelfDestruct20()   { sendShipCommand('SD -T 20'); }
function shipMeltdown5min()     { sendShipCommand('TIMER 5:00 CORE MELTDOWN'); }
function shipTimerStop()        { sendShipCommand('TIMER STOP'); }
function shipTimerReset()       { sendShipCommand('TIMER RESET'); }
function shipDamageReactor()    { sendShipCommand('DAMAGE REACTOR DAMAGED'); }
function shipReactorOffline()   { sendShipCommand('DAMAGE REACTOR OFFLINE'); }
function shipRepairReactor()    { sendShipCommand('DAMAGE REACTOR ONLINE'); }
function shipCutWeapons()       { sendShipCommand('POWER WEAPONS 0'); }
function shipRestoreWeapons()   { sendShipCommand('POWER WEAPONS 100'); }
function shipShieldForeDown()   { sendShipCommand('SHIELD FORE OFFLINE'); }

/** Adds a SHIP menu to the spreadsheet on open. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('SHIP')
    .addItem('Self-destruct T-20',   'shipSelfDestruct20')
    .addItem('Core meltdown 5:00',   'shipMeltdown5min')
    .addSeparator()
    .addItem('Damage reactor',       'shipDamageReactor')
    .addItem('Reactor offline',      'shipReactorOffline')
    .addItem('Repair reactor',       'shipRepairReactor')
    .addSeparator()
    .addItem('Stop countdown',       'shipTimerStop')
    .addItem('Reset countdown',      'shipTimerReset')
    .addToUi();
}

/**
 * Optional cell console: type a command into cell A1 of a sheet named SHIP
 * and it fires on edit (the cell clears itself; A2 shows what was sent).
 * Install: Apps Script → Triggers → add trigger → onEditShipConsole →
 * From spreadsheet → On edit. (An installable trigger is required —
 * the simple onEdit trigger cannot call UrlFetchApp.)
 */
function onEditShipConsole(e) {
  var rng = e && e.range;
  if (!rng) return;
  var sh = rng.getSheet();
  if (sh.getName() !== 'SHIP' || rng.getA1Notation() !== 'A1') return;
  var cmd = String(rng.getValue() || '').trim();
  if (!cmd) return;
  var code = sendShipCommand(cmd);
  rng.setValue('');
  sh.getRange('A2').setValue((code === 200 ? 'sent: ' : 'FAILED (' + code + '): ') + cmd);
}
