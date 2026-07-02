// ship-model.js — the ship's power/damage model, shared by the operator
// console (operator.html) and the holographic display (index.html). Pure
// functions + constants only (no DOM), so the model logic lives in exactly
// one place and both pages always agree on the numbers.

export const SYS_KEYS = ['eng', 'drones', 'weapons', 'shields'];
export const AUX_MAX = 50, BATT_MAX = 25;      // per-system reserve ceilings
export const MAXPWR_REDLINE = 175;             // core 100 + aux 50 + batt 25
export const SHIELD_PANEL_COST = 13;           // % lost per damaged/offline panel

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// area/fan state 0 ONLINE / 1 DAMAGED / 2 OFFLINE → health 1 / 0.5 / 0
export const areaHealth = s => (s >= 2 ? 0 : s >= 1 ? 0.5 : 1);

// CORE POWER comes straight off the core reactor (its own physical system) —
// it is NOT tied to hull/structure. Reactor ONLINE = 100%, DAMAGED = 50%,
// OFFLINE = 0%; when it drops players fall back to AUX, then BATTERY.
export function coreFromReactor(dmg) {
  const r = ((dmg && dmg.areas) || {}).reactor | 0;
  return r >= 2 ? 0 : r >= 1 ? 50 : 100;
}

// per-system core throttle 0-100; legacy values were 0-25, rescale those
export function normThrottle(v) {
  v = Number.isFinite(+v) ? +v : 100;
  if (v > 0 && v <= 25) v = Math.round(v / 25 * 100);
  return clamp(v, 0, 100);
}

// SHIELD POWER is special: main (core) power sets the ceiling of available
// shield power (full main = 100%, damaged main = 50%), then each damaged/
// offline panel costs 13%. OFFLINE (red) panels are a hard loss until the DM
// repairs them; DAMAGED (yellow) panels are compensated by routed reserves
// back up to the available ceiling.
export function shieldPower(core, throttle, auxV, battV, panels) {
  const avail = Math.min(clamp(throttle | 0, 0, 100), core);
  let offline = 0, damaged = 0;
  (Array.isArray(panels) ? panels : [0, 0, 0, 0]).forEach(v => {
    v = clamp(v | 0, 0, 2);
    if (v === 2) offline++; else if (v === 1) damaged++;
  });
  const hardCap = Math.max(0, avail - SHIELD_PANEL_COST * offline);
  const base = Math.max(0, hardCap - SHIELD_PANEL_COST * damaged);
  return Math.round(clamp(base + (auxV | 0) + (battV | 0), 0, hardCap));
}

// SHIP INTEGRITY is derived: the three power systems (reactor, aux, battery)
// work together to keep the ship nominal, and every damaged system drags the
// overall state down (NOMINAL → DAMAGED → CRITICAL → OFFLINE) as things break.
// Aux bank damage counts (it's a physical system); the battery can't be damaged.
const INTEGRITY_AREAS = ['boostP', 'boostS', 'bridge', 'aiCore', 'droneBay', 'wpnFwd', 'wpnAft'];
const INTEGRITY_FANS = ['fanFP', 'fanFS', 'fanAP', 'fanAS'];
export function shipIntegrity(dmg, auxInfo) {
  const a = (dmg && dmg.areas) || {};
  const auxDmg = auxInfo ? (auxInfo.auxDmg | 0) : 0;
  let num = 0, den = 0;
  const add = (h, w) => { num += clamp(h, 0, 1) * w; den += w; };
  add(areaHealth(a.reactor), 3);                 // core reactor — the main power system
  add((AUX_MAX - auxDmg) / AUX_MAX, 2);          // auxiliary system
  add(1, 1);                                     // battery system (undamageable)
  INTEGRITY_AREAS.forEach(k => add(areaHealth(a[k]), 1));
  INTEGRITY_FANS.forEach(k => add(areaHealth(a[k]), 0.5));
  (Array.isArray(dmg && dmg.shieldPanels) ? dmg.shieldPanels : [0, 0, 0, 0])
    .forEach(v => add(areaHealth(v), 0.25));
  const pct = den ? num / den * 100 : 100;
  const level = pct >= 85 ? 'NOMINAL' : pct >= 50 ? 'DAMAGED' : pct >= 20 ? 'CRITICAL' : 'OFFLINE';
  return { pct: Math.round(pct), level };
}

// normalize the stored reserve state ({eng:{aux,batt}, ..., auxDmg, overdrive}),
// migrating the legacy shared-pool shape ({eng:Number, ...}) and clamping every
// value to the (possibly DM-damaged) bank ceilings. Battery can't be damaged;
// aux locks out for players once auxDmg reaches AUX_MAX.
export function normalizeAux(raw) {
  if (!raw || typeof raw !== 'object') raw = {};
  const auxDmg = clamp(+raw.auxDmg || 0, 0, AUX_MAX);
  const auxCap = AUX_MAX - auxDmg;
  const out = { auxDmg, overdrive: !!raw.overdrive };
  SYS_KEYS.forEach(k => {
    const r = raw[k];
    const av = typeof r === 'number' ? r : (r && typeof r === 'object' ? +r.aux || 0 : 0);
    const bv = r && typeof r === 'object' ? +r.batt || 0 : 0;
    out[k] = { aux: clamp(av, 0, auxCap), batt: clamp(bv, 0, BATT_MAX) };
  });
  return out;
}

// ship-wide MAX POWER = core + aux output + battery output; each bank's output
// reads as the average routed across the four systems, so the meter is
// ship-wide. OVERDRIVE forces both banks to 100% output; a total past the
// 175% redline flags an overload (→ self-destruct on the display).
// the reactor can only be overloaded while it is producing FULL core power —
// a damaged (50%) or offline (0%) reactor doesn't have enough output to push
// the ship past the redline, so the self-destruct can't trigger.
export const canOverload = core => core >= 100;

export function shipMaxPower(core, aux) {
  let a = 100, b = 100;
  if (!(aux && aux.overdrive)) {
    const avg = key => Math.round(SYS_KEYS.reduce((t, k) =>
      t + ((aux && aux[k] && aux[k][key]) | 0), 0) / SYS_KEYS.length);
    a = avg('aux'); b = avg('batt');
  }
  const total = core + a + b;
  return { total, core, aux: a, batt: b, over: total > MAXPWR_REDLINE && canOverload(core) };
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

// the "oh sh*t!" timer's event label (IMPACT, CORE MELTDOWN, HULL BREACH, …):
// DM-entered free text, so normalize it the same way everywhere — uppercase,
// bounded, markup-safe (it ends up in the display banner and the system log)
export const normTimerLabel = l =>
  String(l ?? '').toUpperCase().replace(/[<>&]/g, '').trim().slice(0, 24) || 'IMPACT';

// safe localStorage JSON read
export function readJSON(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch (e) { return fallback; }
}

// ---- Firebase real-time sync (loaded dynamically so pages work offline) ----
export const SYNC_KEYS = ['shipPowerLevels', 'shipDamageState', 'shipAux', 'shipAltitude', 'shipTimer'];
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqy2m3QDMYtzjjUUoEki0RSFot69sZwj8",
  authDomain: "shadowrun-ship-db.firebaseapp.com",
  databaseURL: "https://shadowrun-ship-db-default-rtdb.firebaseio.com",
  projectId: "shadowrun-ship-db",
  storageBucket: "shadowrun-ship-db.firebasestorage.app",
  messagingSenderId: "584465229092",
  appId: "1:584465229092:web:d17e05b242a6c99c8c3fb1"
};
export async function firebaseDb() {
  const base = 'https://www.gstatic.com/firebasejs/10.8.1/';
  const [{ initializeApp }, dbm] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-database.js'),
  ]);
  return { db: dbm.getDatabase(initializeApp(FIREBASE_CONFIG)), ref: dbm.ref, set: dbm.set, onValue: dbm.onValue };
}
