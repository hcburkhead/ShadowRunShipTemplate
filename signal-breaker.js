// signal-breaker.js — SIGNAL BREAKER, an operator-set code-breaker challenge.
//
// The operator arms a 6-number sequence (one value 0–9 per node A–F) from
// operator.html; players crack it on operator.html?player-view. Every
// transmission must carry a full sequence; each node then reads back:
//   NOMINAL ● (exact)      — green wave locked on the reference trace
//   HIGH    ▲ (too high)   — fast, tall red wave
//   LOW     ▼ (too low)    — slow, flat blue wave
// NOMINAL nodes lock in (kept, not editable, skipped during entry); every
// other dial clears. No timer and no attempt cap: the operator decides when
// the players are locked out.
//
// Synced state (localStorage / BroadcastChannel / Firebase key `shipBreaker`):
//   { id, code: [6 ints], status: off|active|cracked|lockout,
//     hist: [{ g: [6 ints], r: 'nhlnnl' }],    r: n nominal · h high · l low
//     target: relay key, relay: { eng, drones, weapons, shields, term },
//     reinit: [relay keys SERA has reinitialized], note: last repair message }
//
// SYSTEM-RELAY: every player-operated system has its own relay, with the same
// ONLINE (0) / DAMAGED (1) / OFFLINE (2) states as the rest of the ship. The
// relay gates that system's player controls (RELAY_SYSTEMS below). The DM picks
// which system a challenge targets. Repairs go through SERA, the ship's AI:
//   OFFLINE — SERA brings the relay straight back ONLINE on her own once every
//             ship sector is nominal (operator.html runs that check). Until
//             then a cracked challenge gets it to DAMAGED.
//   DAMAGED — takes TWO cracked challenges: the first lets SERA reinitialize
//             the system, the second re-engages it → ONLINE.
// Relays default to ONLINE, so nothing is gated until the DM knocks one down.
// The pure helpers below are shared by the operator and player views; the
// BreakerBoard class is the player-facing board (DOM + canvas).

export const BK_NODES = 6, BK_MIN = 0, BK_MAX = 9, BK_HIST = 200;
export const BK_STATUS = ['off', 'active', 'cracked', 'lockout'];
export const RELAY_WORD = ['ONLINE', 'DAMAGED', 'OFFLINE'];
// [key, label, unlocked at DAMAGED, unlocked at ONLINE]
export const RELAY_SYSTEMS = [
  ['eng',     'ENGINES',  'THROTTLE + BATTERY', 'AUX ROUTING'],
  ['drones',  'DRONES',   'THROTTLE + BATTERY', 'AUX ROUTING'],
  ['weapons', 'WEAPONS',  'THROTTLE + BATTERY', 'AUX ROUTING'],
  ['shields', 'SHIELDS',  'THROTTLE + BATTERY', 'AUX ROUTING'],
  ['term',    'TERMINAL', 'SHIP TERMINAL',      'OVERDRIVE'],
];
export const RELAY_KEYS = RELAY_SYSTEMS.map(r => r[0]);
export const relayLabel = k => (RELAY_SYSTEMS.find(r => r[0] === k) || [k, String(k).toUpperCase()])[1];
export const defaultRelay = () => Object.fromEntries(RELAY_KEYS.map(k => [k, 0]));
export function normRelay(raw) {
  const o = defaultRelay();
  if (raw && typeof raw === 'object') RELAY_KEYS.forEach(k => {
    const v = Math.round(+raw[k]);
    if (v >= 0 && v <= 2) o[k] = v;
  });
  return o;
}
/** relay status text, incl. SERA's two-step repair of a DAMAGED relay. */
export function relayText(b, k) {
  const st = b.relay[k] | 0;
  if (st !== 1) return RELAY_WORD[st];
  return (b.reinit || []).includes(k) ? 'DAMAGED · REINIT 1/2' : 'DAMAGED · REINIT 0/2';
}
/** what a relay unlocks right now, e.g. 'THROTTLE + BATTERY' (DAMAGED), 'ALL CONTROLS' (ONLINE). */
export function relayUnlocks(k, st) {
  const r = RELAY_SYSTEMS.find(x => x[0] === k);
  if (!r) return '';
  return st === 0 ? 'ALL CONTROLS' : st === 1 ? r[2] : 'NOTHING';
}
const RESULT_RE = new RegExp(`^[nhl]{${BK_NODES}}$`);

/** '482915', '4 8 2 9 1 5', '4,8,2,9,1,5' or [4,8,2,9,1,5] → array, else null. */
export function parseSequence(input) {
  if (input == null) return null;
  let parts = Array.isArray(input)
    ? input.map(String)
    : String(input).trim().split(/[\s,-]+/).filter(Boolean);
  if (parts.length === 1 && parts[0].length === BK_NODES) parts = parts[0].split('');
  if (parts.length !== BK_NODES) return null;
  const nums = parts.map(p => (/^\d+$/.test(p.trim()) ? Number(p) : NaN));
  return nums.every(n => Number.isInteger(n) && n >= BK_MIN && n <= BK_MAX) ? nums : null;
}

export const randomSequence = () =>
  Array.from({ length: BK_NODES }, () => BK_MIN + Math.floor(Math.random() * (BK_MAX - BK_MIN + 1)));

/** Per-node result string: n (nominal) / h (guess too high) / l (guess too low). */
export const evaluate = (guess, code) =>
  guess.map((g, i) => (g === code[i] ? 'n' : g > code[i] ? 'h' : 'l')).join('');

export const isCracked = r => /^n+$/.test(r);

export function normBreaker(raw) {
  if (!raw || typeof raw !== 'object') raw = {};
  const code = parseSequence(raw.code) || [];
  const status = code.length && BK_STATUS.includes(raw.status) ? raw.status : 'off';
  const hist = (Array.isArray(raw.hist) ? raw.hist : [])
    .map(h => ({ g: parseSequence(h && h.g), r: String((h && h.r) || '') }))
    .filter(h => h.g && RESULT_RE.test(h.r))
    .slice(-BK_HIST);
  const target = RELAY_KEYS.includes(raw.target) ? raw.target : RELAY_KEYS[0];
  const relay = normRelay(raw.relay);
  // a reinit only counts on a DAMAGED relay (Firebase drops empty arrays → default [])
  const reinit = (Array.isArray(raw.reinit) ? raw.reinit : []).filter(k => relay[k] === 1);
  const note = String(raw.note || '').slice(0, 90);
  return { id: String(raw.id || ''), code, status, hist, target, relay, reinit: [...new Set(reinit)], note };
}

/** A fresh, armed challenge; target + relays carry over. A new id tells every board to reset. */
export const newBreaker = (code, prev = {}) => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  code: code.slice(), status: 'active', hist: [],
  target: RELAY_KEYS.includes(prev.target) ? prev.target : RELAY_KEYS[0],
  relay: normRelay(prev.relay),
  reinit: Array.isArray(prev.reinit) ? prev.reinit.slice() : [],
  note: '',
});

/** Score the crack against the target relay (mutates b; sets b.note). Returns the
 *  repair message, or null if the relay was already ONLINE.
 *   OFFLINE → DAMAGED · DAMAGED → reinitialized (1/2) → re-engaged ONLINE (2/2) */
export function repairRelay(b) {
  const k = b.target, st = b.relay[k], name = relayLabel(k);
  const reinit = (b.reinit || []).filter(x => x !== k);
  let msg;
  if (st === 2) {
    b.relay = { ...b.relay, [k]: 1 };
    msg = `${name} RELAY DAMAGED — ${relayUnlocks(k, 1)} UNLOCKED · SERA MUST REINITIALIZE`;
  } else if (st === 1 && !(b.reinit || []).includes(k)) {
    reinit.push(k);
    msg = `SERA REINITIALIZED ${name} (1/2) — RE-ENGAGE REQUIRED`;
  } else if (st === 1) {
    b.relay = { ...b.relay, [k]: 0 };
    msg = `SERA RE-ENGAGED ${name} (2/2) — RELAY ONLINE · ALL CONTROLS UNLOCKED`;
  } else return null;
  b.reinit = reinit;
  b.note = msg;
  return msg;
}

export const nodeLabel = i => String.fromCharCode(65 + i);
export const RESULT_GLYPH = { n: '●', h: '▲', l: '▼' };
export const RESULT_CLASS = { n: 'bk-r-nom', h: 'bk-r-high', l: 'bk-r-low' };

// ---------------------------------------------------------------------------
//  tiny WebAudio blips (no assets; fails silently)
// ---------------------------------------------------------------------------
const SFX = {
  ctx: null,
  tone(freq, dur = 0.05, type = 'square', vol = 0.03, when = 0) {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* no audio */ }
  },
  click() { this.tone(880, 0.03); },
  bad()   { this.tone(150, 0.14, 'sawtooth', 0.04); },
  alarm() { this.tone(1180, 0.07); this.tone(1180, 0.07, 'square', 0.03, 0.14); },
  win()   { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.09, 'square', 0.035, i * 0.08)); },
  lose()  { [420, 300, 210, 130].forEach((f, i) => this.tone(f, 0.12, 'sawtooth', 0.04, i * 0.1)); },
};

const READOUT = {
  idle: ['NO SIGNAL', 'bk-r-idle'],
  n: ['NOMINAL ●', 'bk-r-nom'],
  h: ['HIGH ▲', 'bk-r-high'],
  l: ['LOW ▼', 'bk-r-low'],
};

// ---------------------------------------------------------------------------
//  BreakerBoard — the player board. Renders from synced state via update();
//  hands a complete guess to onTransmit(guess) and waits for the next update.
// ---------------------------------------------------------------------------
export class BreakerBoard {
  constructor(root, { onTransmit, sound = true } = {}) {
    this.root = root;
    this.onTransmit = onTransmit;
    this.sound = sound;
    this.id = null; this.histLen = -1; this.status = 'off'; this.seen = false;
    this.target = RELAY_KEYS[0]; this.relay = defaultRelay();
    this.hist = [];
    this.guess = Array(BK_NODES).fill(null);
    this.locked = Array(BK_NODES).fill(false);
    this.feedback = Array(BK_NODES).fill('idle');
    this.selected = 0;
    this.raf = null; this.flashT = null; this.keysOn = false;
    this.colors = null;
    this._onKey = this._onKey.bind(this);
    this._build();
  }

  _sfx(name) { if (this.sound) SFX[name](); }

  _build() {
    let nodes = '';
    for (let i = 0; i < BK_NODES; i++) {
      nodes += `
        <div class="bk-node" data-i="${i}">
          <div class="bk-node-h"><span class="bk-lbl">NODE ${nodeLabel(i)}</span><span class="bk-read"></span></div>
          <canvas class="bk-scope"></canvas>
          <div class="bk-tune">
            <button type="button" data-act="dec" tabindex="-1" aria-label="tune node ${nodeLabel(i)} down">▼</button>
            <span class="bk-val"></span>
            <button type="button" data-act="inc" tabindex="-1" aria-label="tune node ${nodeLabel(i)} up">▲</button>
          </div>
        </div>`;
    }
    this.root.innerHTML = `
      <div class="bk-target"></div>
      <div class="bk-status"></div>
      <div class="bk-hud"><span>TRANSMISSIONS <b class="bk-count">0</b></span><span>NOMINAL <b class="bk-nom">0/${BK_NODES}</b></span></div>
      <div class="bk-log"></div>
      <div class="hint bk-hint">Enter a FULL sequence each transmission — NOMINAL nodes lock in.
        Type 0–9 · ←/→ select · ↑/↓ tune · BKSP clear · ENTER transmit.</div>
      <div class="bk-grid">${nodes}</div>
      <button type="button" class="btn-wide bk-tx" tabindex="-1" disabled>ENTER SEQUENCE</button>`;

    const q = s => this.root.querySelector(s);
    this.el = {
      status: q('.bk-status'), count: q('.bk-count'), nom: q('.bk-nom'), log: q('.bk-log'), tx: q('.bk-tx'),
      nodes: [...this.root.querySelectorAll('.bk-node')],
      target: q('.bk-target'),
    };
    this.el.cards = this.el.nodes.map(n => ({
      card: n, read: n.querySelector('.bk-read'), val: n.querySelector('.bk-val'),
      canvas: n.querySelector('canvas'), ctx: n.querySelector('canvas').getContext('2d'),
    }));

    this.root.addEventListener('click', e => {
      if (this.status !== 'active') return;
      if (e.target.closest('.bk-tx')) { this._transmit(); return; }
      const card = e.target.closest('.bk-node');
      if (!card) return;
      const i = +card.dataset.i;
      if (this.locked[i]) return;
      this._select(i);
      const btn = e.target.closest('button[data-act]');
      if (btn) { this._tune(i, btn.dataset.act === 'inc' ? 1 : -1); btn.blur(); }
    });
  }

  /** Apply synced state. Safe to call repeatedly with the same state. */
  update(b) {
    const firstSeen = !this.seen;
    const prevId = this.id, prevStatus = this.status;
    const sessionChanged = b.id !== this.id;
    if (sessionChanged) { this.id = b.id; this.histLen = -1; }

    let newTransmission = false;
    if (b.hist.length !== this.histLen) {
      newTransmission = !sessionChanged && b.hist.length > this.histLen && this.histLen >= 0;
      this.histLen = b.hist.length;
      const last = b.hist[b.hist.length - 1];
      this.feedback = last ? last.r.split('') : Array(BK_NODES).fill('idle');
      this.locked = this.feedback.map(r => r === 'n');
      // locked nodes keep their value; every other dial clears for a full new entry
      this.guess = last ? last.g.map((g, i) => (this.locked[i] ? g : null)) : Array(BK_NODES).fill(null);
      this._select(0);
    }
    this.hist = b.hist;
    this.status = b.status;
    this.target = b.target;
    this.relay = b.relay;
    this.b = b;
    this.seen = true;
    // a status change (cracked / locked out / reseeded) always beats a pending warning
    if (sessionChanged || prevStatus !== b.status) { clearTimeout(this.flashT); this.flashT = null; }

    this._renderNodes();
    this._renderHud();
    this._renderRelay();
    this._renderStatus();

    if (!firstSeen) {
      if (sessionChanged && prevId && b.status === 'active') {
        this._sfx('alarm');
        this._flash('⚠ OPERATOR RESEEDED THE SIGNAL — NEW SEQUENCE', 2600);
      } else if (b.status === 'cracked' && prevStatus !== 'cracked') {
        this._sfx('win');
        if (b.note) this._flash('✓ ' + b.note, 4000);
      } else if (b.status === 'lockout' && prevStatus !== 'lockout') {
        this._sfx('lose');
        this.root.classList.remove('bk-shake'); void this.root.offsetWidth; this.root.classList.add('bk-shake');
      } else if (newTransmission && b.status === 'active') {
        const last = b.hist[b.hist.length - 1];
        const nom = last.r.split('').filter(r => r === 'n').length;
        this._sfx('bad');
        this._flash(`TRANSMISSION #${b.hist.length}: ${nom}/${BK_NODES} NODES NOMINAL`, 1600);
      }
    }

    if (b.status === 'off') this._stopLoop(); else this._startLoop();
    this._setKeys(b.status === 'active');
  }

  destroy() { this._stopLoop(); this._setKeys(false); }

  // ---- rendering ----
  _renderStatus() {
    if (this.flashT) return;   // a flash owns the line until it expires
    const s = this.el.status;
    const n = this.hist.length;
    const st = this.relay[this.target] | 0;
    const word = relayText(this.b || { relay: this.relay }, this.target);
    const txt = {
      off: 'SIGNAL BREAKER OFFLINE',
      active: `RELAY STATUS: ${word}`,
      cracked: `✓ RELAY STATUS: ${word} || ${n} TRANSMISSION${n === 1 ? '' : 'S'}`,
      lockout: '✖ ACCESS REVOKED — SERA INITIATED LOCK-OUT',
    }[this.status];
    s.textContent = txt;
    s.className = 'bk-status bk-st-' + this.status + ' bk-rs' + st;
  }

  _renderRelay() {
    const st = this.relay[this.target] | 0;
    const b = this.b || { relay: this.relay };
    this.el.target.textContent = `TARGET ▸ ${relayLabel(this.target)} RELAY · ${relayText(b, this.target)}`;
    this.el.target.className = 'bk-target bk-rs' + st;
  }

  _flash(msg, ms) {
    clearTimeout(this.flashT);
    const s = this.el.status;
    s.textContent = msg;
    s.className = 'bk-status bk-st-flash';
    this.flashT = setTimeout(() => { this.flashT = null; this._renderStatus(); }, ms);
  }

  _renderHud() {
    const last = this.hist[this.hist.length - 1];
    this.el.count.textContent = this.hist.length;
    this.el.nom.textContent = (last ? last.r.split('').filter(r => r === 'n').length : 0) + '/' + BK_NODES;
    if (!this.hist.length) {
      this.el.log.innerHTML = '<span class="bk-empty-log">NO TRANSMISSIONS LOGGED</span>';
      return;
    }
    // newest first; build with DOM nodes (values are ints, but keep it injection-proof)
    const rows = this.hist.map((h, k) => {
      const row = document.createElement('div'); row.className = 'bk-log-row';
      const n = document.createElement('span'); n.className = 'bk-n'; n.textContent = '#' + (k + 1);
      row.appendChild(n);
      h.g.forEach((g, i) => {
        const d = document.createElement('span');
        d.className = 'bk-d ' + RESULT_CLASS[h.r[i]];
        d.textContent = g + RESULT_GLYPH[h.r[i]];
        row.appendChild(d);
      });
      return row;
    }).reverse();
    this.el.log.replaceChildren(...rows);
  }

  _renderNodes() {
    for (let i = 0; i < BK_NODES; i++) this._renderNode(i);
    this._renderTx();
  }

  _renderNode(i) {
    const c = this.el.cards[i];
    const g = this.guess[i];
    c.val.textContent = g === null ? '–' : g;
    c.val.classList.toggle('bk-empty', g === null);
    const [txt, cls] = READOUT[this.feedback[i]] || READOUT.idle;
    c.read.textContent = txt;
    c.read.className = 'bk-read ' + cls;
    c.card.classList.toggle('bk-locked', !!this.locked[i]);
    c.card.classList.toggle('bk-sel', i === this.selected && this.status === 'active');
  }

  _renderTx() {
    const filled = this.guess.filter(g => g !== null).length;
    const tx = this.el.tx;
    tx.disabled = this.status !== 'active' || filled < BK_NODES;
    tx.textContent = this.status !== 'active' ? 'TRANSMIT ▸'
      : filled < BK_NODES ? `ENTER SEQUENCE (${filled}/${BK_NODES})` : 'TRANSMIT ▸';
  }

  // ---- input ----
  _select(i, dir = 1) {
    let idx = ((i % BK_NODES) + BK_NODES) % BK_NODES;
    for (let n = 0; n < BK_NODES && this.locked[idx]; n++) idx = (idx + dir + BK_NODES) % BK_NODES;
    this.selected = idx;
    this.el.cards.forEach((c, k) => c.card.classList.toggle('bk-sel', k === idx && this.status === 'active'));
  }

  _tune(i, delta) {
    if (this.locked[i]) return;
    const cur = this.guess[i];
    const next = cur === null ? (delta > 0 ? BK_MIN : BK_MAX)
      : Math.max(BK_MIN, Math.min(BK_MAX, cur + delta));
    if (next === cur) return;
    this.guess[i] = next;
    this._sfx('click');
    this._renderNode(i); this._renderTx();
  }

  _setValue(i, v) {
    if (this.locked[i]) return;
    this.guess[i] = Math.max(BK_MIN, Math.min(BK_MAX, v));
    this._sfx('click');
    this._renderNode(i); this._renderTx();
  }

  _clear(i) {
    if (this.locked[i]) return;
    this.guess[i] = null;
    this._renderNode(i); this._renderTx();
  }

  _transmit() {
    if (this.status !== 'active') return;
    if (this.guess.some(g => g === null)) {
      const missing = this.guess.map((g, i) => (g === null ? nodeLabel(i) : '')).filter(Boolean);
      this._sfx('bad');
      this._flash(`✖ INCOMPLETE SEQUENCE: NODE${missing.length > 1 ? 'S' : ''} ${missing.join(', ')} EMPTY`, 1600);
      return;
    }
    if (this.onTransmit) this.onTransmit(this.guess.slice());
  }

  _setKeys(on) {
    if (on === this.keysOn) return;
    this.keysOn = on;
    if (on) window.addEventListener('keydown', this._onKey);
    else window.removeEventListener('keydown', this._onKey);
  }

  _onKey(e) {
    if (this.status !== 'active' || !this.root.offsetParent) return;   // board hidden
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    let handled = true;
    if (k === 'ArrowLeft' || k === 'a') this._select(this.selected - 1, -1);
    else if (k === 'ArrowRight' || k === 'd') this._select(this.selected + 1);
    else if (k === 'ArrowUp' || k === 'w') this._tune(this.selected, 1);
    else if (k === 'ArrowDown' || k === 's') this._tune(this.selected, -1);
    else if (/^[0-9]$/.test(k)) { this._setValue(this.selected, +k); this._select(this.selected + 1); }
    else if (k === 'Backspace' || k === 'Delete') {
      // clear the selected node; if it's already blank, step back and clear that one
      if (this.guess[this.selected] === null && k === 'Backspace') this._select(this.selected - 1, -1);
      this._clear(this.selected);
    }
    else if (k === 'Enter' || k === ' ') { if (!e.repeat) this._transmit(); }
    else handled = false;
    if (handled) e.preventDefault();
  }

  // ---- oscilloscopes ----
  _startLoop() {
    if (this.raf) return;
    if (!this.colors) {
      const css = getComputedStyle(document.documentElement);
      const read = (n, f) => (css.getPropertyValue(n) || '').trim() || f;
      this.colors = {
        green: read('--g1', '#4ade80'), red: read('--red', '#ef4444'), blue: read('--blue', '#60a5fa'),
        ref: 'rgba(190,249,210,0.16)', grid: 'rgba(30,77,30,0.55)', idle: '#1e4d1e',
      };
    }
    const tick = now => { this._drawAll(now); this.raf = requestAnimationFrame(tick); };
    this.raf = requestAnimationFrame(tick);
  }

  _stopLoop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

  _drawAll(now) {
    if (!this.root.offsetParent) return;   // hidden: skip the work
    for (let i = 0; i < BK_NODES; i++) this._draw(i, now);
  }

  _draw(i, now) {
    const { canvas, ctx } = this.el.cards[i];
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
    if (!cw || !ch) return;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const w = cw, h = ch, mid = h / 2, C = this.colors;
    const state = this.feedback[i];
    const phase = now * 0.004 + i * 0.9;
    const k = 1 / dpr;   // keep wave shape independent of pixel density

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();

    const wave = (freq, amp, color, width, jitter = 0) => {
      ctx.strokeStyle = color; ctx.lineWidth = width * dpr;
      ctx.beginPath();
      for (let x = 0; x <= w; x += dpr) {
        const y = mid + Math.sin(x * k * freq + phase) * amp + (jitter ? (Math.random() - 0.5) * jitter * dpr : 0);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const refFreq = 0.12, refAmp = h * 0.3;
    if (state !== 'idle') wave(refFreq, refAmp, C.ref, 1);   // the trace every node must sit on
    if (state === 'h') wave(refFreq * 2.4, h * 0.42, C.red, 1.6, 2);
    else if (state === 'l') wave(refFreq * 0.45, h * 0.14, C.blue, 1.6);
    else if (state === 'n') {
      ctx.shadowBlur = 8 * dpr; ctx.shadowColor = C.green;
      wave(refFreq, refAmp, C.green, 2);
      ctx.shadowBlur = 0;
    } else {   // idle: low noise floor
      ctx.strokeStyle = C.idle; ctx.lineWidth = dpr;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3 * dpr) {
        const y = mid + (Math.random() - 0.5) * 3 * dpr;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
