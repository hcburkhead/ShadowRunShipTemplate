// ship-rooms.js — the ship's interior at true scale, drawn inside the hologram like a
// tabletop dungeon map.
//
// Scale: the hull is ~160 world units long and stands for a ~450 m carrier, so 1 unit ≈ 2.8 m
// and a crew member is ~0.55 units tall. Inside the hull that leaves room for:
//   - 20 personnel decks (DECK 01 at the keel → DECK 20), each plate clipped to the hull's
//     real profile (the hull is deep under the keel / gondola and shallow toward the stern)
//   - an interior hangar deck for aircraft above them, with parked jets and an aircraft lift
//   - the flight deck on the top surface: runway markings, landing spots
//   - the rooms the crew use: the bridge (AI core at its back) in the forward gondola on
//     DECK 01–02, the engine room + main reactor on the keel (DECK 01–04), and the command
//     offices aft on DECK 16
//   - a lift + stairwell trunk running through every deck, corridors from it to each room,
//     and a keel corridor bridge ⇄ engine room
//
// Frame: at(along, beam, up) → world point, with along −1 stern … +1 bow, beam ±1, up 0 keel
// … 1 top (fractions of the hull's half-length / half-beam / height). Drawn as pale-blue
// edges over a very faint additive fill, like the crew figures.

import * as THREE from './vendor/three.module.js';

const ROOM = 0x9ad7ff, CORE = 0x6df3ff, PATH = 0xc8e6ff, DECK = 0x7fb8d8, MARK = 0xfacc15;
const edgeMat = (color, op = 0.55) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: op,
  blending: THREE.AdditiveBlending, depthWrite: false });
const fillMat = (color, op = 0.035) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function solid(g, geo, t = {}, color = ROOM, edgeOp = 0.55, fillOp = 0.035) {
  const h = new THREE.Group();
  if (t.p) h.position.set(...t.p);
  if (t.r) h.rotation.set(...t.r);
  const fill = new THREE.Mesh(geo, fillMat(color, fillOp));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat(color, edgeOp));
  h.add(fill, edges); g.add(h);
  h.userData.mats = [fill.material, edges.material];
  return h;
}
const box = (g, w, h, d, t, c, eo, fo) => solid(g, new THREE.BoxGeometry(w, h, d), t, c, eo, fo);
const lineMesh = (g, pts, color, op = 0.5) =>
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), edgeMat(color, op)));
function dashed(g, a, b, color, op, dash) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]),
    new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash * 0.8, transparent: true, opacity: op, depthWrite: false }));
  l.computeLineDistances(); g.add(l);
}
const LABELS = [];                   // map labels: shrink with camera distance (see scaleLabels)
function labelSprite(text, w = 4.5, op = 0.6) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const x = c.getContext('2d'); x.font = 'bold 26px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(200,230,255,0.95)'; x.fillText(text, 128, 24);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: op, depthWrite: false }));
  sp.scale.set(w, w * 0.19, 1); sp.userData.w = w; LABELS.push(sp); return sp;
}

// ---- scale ----
const _lp = new THREE.Vector3();
const K = 0.2;                       // furniture is modelled in "figure units" (a person ≈ 2.75) and scaled by K
// decks (fractions of hull height)
const DECK0 = 0.05, DECK_STEP = 0.021, DECKS = 20;                // DECK 01 … DECK 20
const deckU = n => DECK0 + (n - 1) * DECK_STEP;                   // floor of deck n
const HANGAR = { u0: 0.47, u1: 0.575, a0: -0.38, a1: 0.36, beam: 0.24 };
const FLIGHT = { u: 0.6, a0: -0.38, a1: 0.45, beam: 0.25 };
// hull bottom (fraction of height) along the length, read off the model's profile
const BOTTOM = [[-0.85, 0.38], [-0.65, 0.34], [-0.4, 0.3], [-0.3, 0.2], [-0.2, 0.12], [-0.15, 0.05], [0.42, 0.05], [0.46, 0.3], [0.5, 0.34]];
function hullBottom(a) {
  if (a <= BOTTOM[0][0]) return BOTTOM[0][1];
  for (let i = 1; i < BOTTOM.length; i++) if (a <= BOTTOM[i][0]) {
    const [a0, u0] = BOTTOM[i - 1], [a1, u1] = BOTTOM[i];
    return u0 + (u1 - u0) * (a - a0) / (a1 - a0);
  }
  return BOTTOM[BOTTOM.length - 1][1];
}
// the along-span of hull at height u (where the bottom is below it), within the main body
function deckSpan(u) {
  let lo = null, hi = null;
  for (let a = -0.82; a <= 0.48; a += 0.005) if (hullBottom(a) <= u - 0.004) { if (lo === null) lo = a; hi = a; }
  return lo === null ? null : [lo, hi];
}

// furniture (figure units, scaled by K): desk console with a tilted screen facing local +Z; chair
function console_(g, p, ry = 0, w = 2.6) {
  const c = new THREE.Group(); c.position.set(...p); c.rotation.y = ry; c.scale.setScalar(K); g.add(c);
  box(c, w, 1.1, 0.9, { p: [0, 0.55, 0] });
  box(c, w * 0.9, 0.7, 0.06, { p: [0, 1.5, -0.3], r: [-0.35, 0, 0] }, CORE, 0.8, 0.12);
  return c;
}
function chair(g, p, ry = 0) {
  const c = new THREE.Group(); c.position.set(...p); c.rotation.y = ry; c.scale.setScalar(K); g.add(c);
  box(c, 0.9, 0.15, 0.9, { p: [0, 0.75, 0] });
  box(c, 0.9, 0.9, 0.12, { p: [0, 1.25, -0.42] });
  solid(c, new THREE.CylinderGeometry(0.08, 0.08, 0.7, 5), { p: [0, 0.35, 0] });
}
// floor plate + floor grid + faint wall outline for a room (world units)
function shell(g, L, W, H) {
  box(g, W, 0.04, L, { p: [0, 0.02, 0] }, ROOM, 0.75, 0.06);
  const n = Math.max(L, W), grid = new THREE.GridHelper(n, Math.round(n / 0.8), ROOM, ROOM);
  grid.scale.set(W / n, 1, L / n); grid.position.y = 0.045;
  grid.material.transparent = true; grid.material.opacity = 0.16; grid.material.depthWrite = false;
  grid.material.blending = THREE.AdditiveBlending; g.add(grid);
  const walls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, L)), edgeMat(ROOM, 0.3));
  walls.position.y = H / 2; g.add(walls);
}
// a generic delta-wing jet (figure units ×K·4 ≈ 6 world units long), nose toward local +Z
function jet(g, p, ry) {
  const j = new THREE.Group(); j.position.set(...p); j.rotation.y = ry; j.scale.setScalar(K * 4); g.add(j);
  solid(j, new THREE.CylinderGeometry(0.45, 0.55, 5.5, 8), { p: [0, 0.75, -0.3], r: [Math.PI / 2, 0, 0] }, ROOM, 0.7, 0.05);   // fuselage
  solid(j, new THREE.ConeGeometry(0.45, 1.8, 8), { p: [0, 0.75, 3.35], r: [Math.PI / 2, 0, 0] }, ROOM, 0.7, 0.05);               // nose
  solid(j, new THREE.SphereGeometry(0.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 1.1, 1.6], s: [1, 1, 2] }, CORE, 0.8, 0.1); // canopy
  const wing = new THREE.Shape(); wing.moveTo(0, 1.2); wing.lineTo(3.2, -1.6); wing.lineTo(-3.2, -1.6); wing.closePath();
  solid(j, new THREE.ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: false }), { p: [0, 0.7, -0.5], r: [-Math.PI / 2, 0, 0] }, ROOM, 0.7, 0.05);
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-1.4, 0); fin.lineTo(-1.8, 1.4); fin.lineTo(-1.1, 1.4); fin.closePath();
  solid(j, new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false }), { p: [0.03, 1.1, -1.6], r: [0, -Math.PI / 2, 0] }, ROOM, 0.7, 0.05);
  [-0.6, 0.6].forEach(x => solid(j, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4), { p: [x, 0.3, -0.5] }));                  // gear
}

/**
 * Build the interiors and add a copy to every target scene.
 * frame = { at(along, beam, up) → THREE.Vector3 world point, bow: unit Vector3, Lh, Bh, H }
 * Returns { anchors: { key: Vector3 floor spot for crew }, setState(areas), tick(t), deckHeight }.
 */
export function buildRooms(frame, targets) {
  const { at, bow, Lh, Bh, H } = frame;
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(up, bow).normalize();
  const basis = new THREE.Matrix4().makeBasis(side, up, bow);
  const place = (g, along, beam, u) => { g.position.copy(at(along, beam, u)); g.quaternion.setFromRotationMatrix(basis); };
  const local = (along, beam, u, x, y, z) => at(along, beam, u)
    .add(side.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(y)).add(bow.clone().multiplyScalar(z));
  const DH = DECK_STEP * H;                                         // one deck's height in world units (~0.69)

  const reactorCores = [], aiCores = [], spinners = [], lifts = [];

  // ---- rooms (world units) ----
  const BR = { along: 0.3, u: deckU(1), L: 0.1 * Lh, W: 0.2 * Bh, H: DH * 2 };     // bridge, DECK 01–02
  const ER = { along: -0.04, u: deckU(1), L: 0.14 * Lh, W: 0.26 * Bh, H: DH * 4 };  // engine room, DECK 01–04
  const CO = { along: -0.6, u: deckU(16), L: 0.07 * Lh, W: 0.14 * Bh, H: DH };      // command offices, DECK 16
  const TRUNK = { along: -0.165 };
  
  function smallOffice(L, W, H) {
  const g = new THREE.Group();
  shell(g, L, W, H);
  // Abandoned desk console & chair facing into the room
  console_(g, [0, 0, -L * 0.22], 0, 2.0);
  chair(g, [0, 0, 0], 0);
  return g;
  }
  // lift + stairwell through every deck

  function bridge() {
    const g = new THREE.Group(); shell(g, BR.L, BR.W, BR.H);
    const fz = BR.L * 0.48;
    [-0.42, -0.14, 0.14, 0.42].forEach(f => box(g, 0.05, BR.H * 0.85, 0.05, { p: [f * BR.W, BR.H * 0.45, fz] }));   // window frame
    box(g, BR.W * 0.9, 0.05, 0.05, { p: [0, BR.H * 0.88, fz] });
    [-0.6, -0.3, 0, 0.3, 0.6].forEach(a => console_(g,                                                                   // console arc
      [Math.sin(a) * BR.W * 0.3, 0, BR.L * 0.2 + Math.cos(a) * BR.L * 0.16], a + Math.PI, 2.2));
    chair(g, [0, 0, -BR.L * 0.02], 0);
    const ai = new THREE.Group(); ai.position.set(0, 0, -BR.L * 0.34); ai.scale.setScalar(K * 1.6); g.add(ai);           // AI core
    solid(ai, new THREE.CylinderGeometry(1.0, 1.4, 1.2, 12), { p: [0, 0.6, 0] });
    const sphere = solid(ai, new THREE.SphereGeometry(1.1, 12, 8), { p: [0, 2.4, 0] }, CORE, 0.9, 0.2);
    const r1 = solid(ai, new THREE.TorusGeometry(1.6, 0.07, 4, 20), { p: [0, 2.4, 0] }, CORE, 0.9, 0.15);
    const r2 = solid(ai, new THREE.TorusGeometry(1.9, 0.06, 4, 20), { p: [0, 2.4, 0], r: [Math.PI / 2, 0, 0] }, CORE, 0.9, 0.15);
    aiCores.push({ mats: [sphere, r1, r2].flatMap(m => m.userData.mats) });
    spinners.push(r1, r2);
    return g;
  }
  function engineRoom() {
    const g = new THREE.Group(); shell(g, ER.L, ER.W, ER.H);
    [2, 3].forEach(n => {                                                             // catwalk rings on the decks above
      const c = new THREE.Mesh(new THREE.RingGeometry(ER.W * 0.2, ER.W * 0.26, 24), fillMat(ROOM, 0.05));
      c.rotation.x = -Math.PI / 2; c.position.y = DH * (n - 1); g.add(c);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.RingGeometry(ER.W * 0.2, ER.W * 0.26, 24)), edgeMat(ROOM, 0.4));
      e.rotation.x = -Math.PI / 2; e.position.y = DH * (n - 1); g.add(e);
    });
    const rr = ER.W * 0.12;                                                           // main reactor, floor to ceiling
    solid(g, new THREE.CylinderGeometry(rr * 1.5, rr * 1.5, 0.15, 14), { p: [0, 0.1, 0] }, ROOM, 0.7, 0.05);
    const reactor = solid(g, new THREE.CylinderGeometry(rr, rr, ER.H - 0.3, 14), { p: [0, ER.H / 2, 0] }, CORE, 0.9, 0.18);
    solid(g, new THREE.CylinderGeometry(rr * 1.5, rr * 1.5, 0.15, 14), { p: [0, ER.H - 0.1, 0] }, ROOM, 0.7, 0.05);
    const rings = [0.25, 0.5, 0.75].map(f => solid(g, new THREE.TorusGeometry(rr * 1.25, rr * 0.08, 4, 18),
      { p: [0, ER.H * f, 0], r: [Math.PI / 2, 0, 0] }, CORE, 0.9, 0.15));
    reactorCores.push({ mats: [reactor, ...rings].flatMap(m => m.userData.mats) });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {                       // coolant pipes
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[sx * rr, ER.H * 0.7, sz * rr * 0.6], [sx * ER.W * 0.3, ER.H * 0.85, sz * ER.L * 0.25],
        [sx * ER.W * 0.48, ER.H * 0.5, sz * ER.L * 0.38]].map(p => new THREE.Vector3(...p))), 10, rr * 0.12, 5, false);
      solid(g, geo, {}, ROOM, 0.5, 0.03);
    });
    console_(g, [ER.W * 0.3, 0, ER.L * 0.3], Math.PI * 0.85);
    console_(g, [-ER.W * 0.3, 0, -ER.L * 0.3], -Math.PI * 0.15);
    return g;
  }
  function commandOffices() {
    const g = new THREE.Group(); shell(g, CO.L, CO.W, CO.H);
    [-1, 1].forEach(sx => box(g, 0.04, CO.H * 0.8, CO.L * 0.5, { p: [sx * CO.W * 0.17, CO.H * 0.4, -CO.L * 0.22] }));
    box(g, CO.W * 0.98, CO.H * 0.8, 0.04, { p: [0, CO.H * 0.4, CO.L * 0.05] }, ROOM, 0.4, 0.02);
    [-1, 0, 1].forEach(i => { const x = i * CO.W * 0.33; console_(g, [x, 0, -CO.L * 0.4], 0, 2.4); chair(g, [x, 0, -CO.L * 0.27], Math.PI); });
    const table = new THREE.Group(); table.position.set(0, 0, CO.L * 0.3); table.scale.setScalar(K); g.add(table);   // holo-table
    solid(table, new THREE.CylinderGeometry(1.8, 1.4, 1.1, 14), { p: [0, 0.55, 0] });
    spinners.push(solid(table, new THREE.SphereGeometry(0.9, 10, 6), { p: [0, 2.0, 0] }, CORE, 0.7, 0.08));
    return g;
  }
  function hangar() {
    const L = (HANGAR.a1 - HANGAR.a0) * Lh, W = HANGAR.beam * 2 * Bh, h = (HANGAR.u1 - HANGAR.u0) * H;
    const g = new THREE.Group(); shell(g, L, W, h);
    [[-0.3, 0.3], [0.3, 0.3], [-0.3, 0.05], [0.3, 0.05], [-0.3, -0.2], [0.3, -0.2]].forEach(([x, z], i) =>           // parked jets
      jet(g, [x * W, 0, z * L], i % 2 ? -Math.PI * 0.8 : Math.PI * 0.8));
    dashed(g, [0, 0.05, -L * 0.45], [0, 0.05, L * 0.45], MARK, 0.5, 0.8);                                             // taxi line
    return g;
  }
  function flightDeck() {
    const L = (FLIGHT.a1 - FLIGHT.a0) * Lh, W = FLIGHT.beam * 2 * Bh;
    const g = new THREE.Group();
    [-1, 1].forEach(s => lineMesh(g, [[s * W / 2, 0.05, -L / 2], [s * W / 2, 0.05, L / 2]], MARK, 0.55));                // deck edges
    [-0.22, 0.22].forEach(x => {                                                                                        // twin runways
      dashed(g, [x * W, 0.05, -L * 0.48], [x * W, 0.05, L * 0.48], 0xffffff, 0.55, 1.6);
      for (let i = -3; i <= 3; i++) lineMesh(g, [[x * W + i * 0.35, 0.05, L * 0.46], [x * W + i * 0.35, 0.05, L * 0.42]], 0xffffff, 0.5);
    });
    [-0.3, 0, 0.3].forEach(z => {                                                                                       // landing spots
      const r = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(1.6, 20)), edgeMat(MARK, 0.55));
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z * L); g.add(r);
      lineMesh(g, [[-0.6, 0.05, z * L - 0.8], [-0.6, 0.05, z * L + 0.8]], MARK, 0.55);
      lineMesh(g, [[0.6, 0.05, z * L - 0.8], [0.6, 0.05, z * L + 0.8]], MARK, 0.55);
      lineMesh(g, [[-0.6, 0.05, z * L], [0.6, 0.05, z * L]], MARK, 0.55);
    });
    return g;
  }

  // ---- decks: 20 personnel decks, each clipped to the hull profile ----
  function decks() {
    const g = new THREE.Group();
    for (let n = 1; n <= DECKS; n++) {
      const u = deckU(n), span = deckSpan(u); if (!span) continue;
      const [a0, a1] = span, beam = u < 0.12 ? 0.17 : 0.26;
      const d = new THREE.Group(); place(d, (a0 + a1) / 2, 0, u); g.add(d);
      const L = (a1 - a0) * Lh, W = beam * 2 * Bh;
      box(d, W, 0.02, L, { p: [0, 0, 0] }, DECK, n % 5 === 0 ? 0.26 : 0.1, 0.005);
      dashed(d, [0, 0.02, -L / 2 + 0.5], [0, 0.02, L / 2 - 0.5], DECK, 0.22, 0.6); // passage spine

      // Populate personnel decks (3 to 19) with small office modules
      if (n >= 3 && n <= 19) {
        const rL = 1.6, rW = Math.min((W - 1.0) / 2, 1.8);
        if (rW > 0.5) {
          const count = Math.floor((L - 1.5) / (rL + 0.8));
          for (let i = 0; i < count; i++) {
            const z = -L / 2 + 1.2 + i * (rL + 0.8) + rL / 2;
            const globalAlong = (a0 + a1) / 2 + (z / Lh);

            // Avoid placing offices over the trunk shaft, engine room, or bridge
            if (Math.abs(globalAlong - TRUNK.along) < 0.04) continue;
            if (n <= 4 && globalAlong > -0.15 && globalAlong < 0.08) continue; // Engine Room area
            if (n <= 2 && globalAlong > 0.22) continue;                         // Bridge area

            // Port office
            const port = smallOffice(rL, rW, DH * 0.85);
            port.position.set(-W / 2 + rW / 2, 0, z);
            d.add(port);

            // Starboard office
            const stbd = smallOffice(rL, rW, DH * 0.85);
            stbd.position.set(W / 2 - rW / 2, 0, z);
            stbd.rotation.y = Math.PI; // Face inward toward corridor
            d.add(stbd);
          }
        }
      }

      if (n === 1 || n % 5 === 0) { // deck number
        const s = labelSprite('DECK ' + String(n).padStart(2, '0'), 3.2, 0.5);
        s.position.copy(at(a0 + 0.015, -beam - 0.04, u)).add(new THREE.Vector3(0, 0.25, 0)); g.add(s);
      }
    }
    return g;
  }

  // ---- paths: lift + stairwell trunk, corridors, keel corridor, aircraft lift ----
  function corridor(g, a0, a1, beam, u, width = 1.0) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), len = (hi - lo) * Lh;
    const seg = new THREE.Group(); place(seg, (lo + hi) / 2, beam, u); g.add(seg);
    box(seg, width, 0.03, len, { p: [0, 0.015, 0] }, PATH, 0.6, 0.05);
    [-1, 1].forEach(sx => box(seg, 0.03, 0.3, len, { p: [sx * width / 2, 0.15, 0] }, PATH, 0.2, 0.012));
    dashed(seg, [0, 0.04, -len / 2], [0, 0.04, len / 2], PATH, 0.5, 0.35);
    const n = Math.max(1, Math.floor(len / 3));
    for (let i = 0; i < n; i++) {
      const z = -len / 2 + (i + 0.5) * len / n, w = width * 0.22;
      lineMesh(seg, [[-w, 0.045, z - w * 0.6], [0, 0.045, z + w * 0.4], [w, 0.045, z - w * 0.6]], PATH, 0.45);
    }
  }
  function door(g, along, beam, u, width, height) {
    const d = new THREE.Group(); place(d, along, beam, u); g.add(d);
    [-1, 1].forEach(sx => box(d, 0.06, height, 0.06, { p: [sx * width / 2, height / 2, 0] }, PATH, 0.8, 0.05));
    box(d, width + 0.06, 0.06, 0.06, { p: [0, height, 0] }, PATH, 0.8, 0.05);
  }
  function trunk(g) {
    const u0 = deckU(1), u1 = HANGAR.u0, h = (u1 - u0) * H, S = 1.4;
    // lift shaft (port side of the trunk) + a car that rides the full height
    const L = new THREE.Group(); place(L, TRUNK.along, -0.035, u0); g.add(L);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => box(L, 0.05, h + DH, 0.05, { p: [x * S / 2, (h + DH) / 2, z * S / 2] }, PATH, 0.7, 0.04));
    const car = new THREE.Group(); L.add(car);
    box(car, S * 0.9, 0.05, S * 0.9, { p: [0, 0.03, 0] }, CORE, 0.9, 0.12);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S * 0.9, DH * 0.85, S * 0.9)), edgeMat(CORE, 0.6));
    frame.position.y = DH * 0.43; car.add(frame);
    lifts.push({ car, h, speed: 0.12 });
    // stairwell (starboard side): a switchback flight between every pair of decks
    const st = new THREE.Group(); place(st, TRUNK.along, 0.035, u0); g.add(st);
    const n = Math.round((u1 - u0) / DECK_STEP);
    for (let i = 0; i < n; i++) {
      const y0 = i * DH, dir = i % 2 ? 1 : -1, x = (i % 2 ? 0.3 : -0.3);
      lineMesh(st, [[x, y0, -dir * 0.6], [x, y0 + DH, dir * 0.6]], PATH, 0.55);                                        // flight
      lineMesh(st, [[-0.65, y0 + DH, dir * 0.6], [0.65, y0 + DH, dir * 0.6]], PATH, 0.45);                               // landing
    }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => box(st, 0.04, h, 0.04, { p: [x * 0.7, h / 2, z * 0.7] }, PATH, 0.4, 0.02));
  }
  function aircraftLift(g) {                                                      // hangar ⇄ flight deck
    const a = 0.2, b = 0.12, h = (FLIGHT.u - HANGAR.u0) * H, S = 4.5;
    const L = new THREE.Group(); place(L, a, b, HANGAR.u0); g.add(L);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => box(L, 0.08, h, 0.08, { p: [x * S / 2, h / 2, z * S / 2] }, MARK, 0.6, 0.04));
    const plat = new THREE.Group(); L.add(plat);
    box(plat, S * 0.95, 0.08, S * 0.95, { p: [0, 0.04, 0] }, MARK, 0.8, 0.08);
    lifts.push({ car: plat, h, speed: 0.08 });
  }
  function paths() {
    const g = new THREE.Group();
    trunk(g);
    aircraftLift(g);
    const brAft = BR.along - BR.L / 2 / Lh, erFore = ER.along + ER.L / 2 / Lh, erAft = ER.along - ER.L / 2 / Lh, coFore = CO.along + CO.L / 2 / Lh;
    corridor(g, erFore, brAft, 0, deckU(1));                                     // keel corridor: engine room ⇄ bridge
    door(g, brAft, 0, deckU(1), 0.9, DH * 0.85); door(g, erFore, 0, deckU(1), 0.9, DH * 0.85);
    corridor(g, TRUNK.along + 0.012, erAft, 0, deckU(1));                         // trunk ⇄ engine room
    door(g, erAft, 0, deckU(1), 0.9, DH * 0.85);
    corridor(g, TRUNK.along - 0.012, coFore, 0, CO.u);                            // DECK 16: trunk ⇄ command offices
    door(g, coFore, 0, CO.u, 0.9, DH * 0.85);
    corridor(g, TRUNK.along - 0.012, HANGAR.a0, 0, HANGAR.u0);                    // hangar deck: trunk ⇄ hangar
    // map labels
    const lab = (t, a, b, u, w) => { const s = labelSprite(t, w); s.position.copy(at(a, b, u)).add(new THREE.Vector3(0, 1.8, 0)); g.add(s); };
    lab('BRIDGE', BR.along + 0.03, 0, BR.u, 4); lab('AI CORE', BR.along - 0.06, 0, BR.u, 3.4);
    lab('ENGINEERING', ER.along, 0, ER.u + 0.06, 4.4); lab('COMMAND', CO.along, 0, CO.u, 4);
    lab('LIFT / STAIRS', TRUNK.along, 0, 0.3, 4.6); lab('HANGAR', 0, 0, HANGAR.u0, 5); lab('FLIGHT DECK', 0.05, 0, FLIGHT.u + 0.02, 6);
    return g;
  }

  targets.forEach(t => {
    t.add(decks());
    const br = bridge(); place(br, BR.along, 0, BR.u); t.add(br);
    const er = engineRoom(); place(er, ER.along, 0, ER.u); t.add(er);
    const co = commandOffices(); place(co, CO.along, 0, CO.u); t.add(co);
    const hg = hangar(); place(hg, (HANGAR.a0 + HANGAR.a1) / 2, 0, HANGAR.u0); t.add(hg);
    const fd = flightDeck(); place(fd, (FLIGHT.a0 + FLIGHT.a1) / 2, 0, FLIGHT.u); t.add(fd);
    t.add(paths());
  });

  // crew standing spots on the floors
  const anchors = {
    bridge:     local(BR.along, 0, BR.u, 0, 0.03, BR.L * 0.08),
    aiCore:     local(BR.along, 0, BR.u, 0, 0.03, -BR.L * 0.2),
    reactor:    local(ER.along, 0, ER.u, 0, 0.03, ER.L * 0.25),
    command:    local(CO.along, 0, CO.u, 0, 0.03, -CO.L * 0.05),
    hangar:     local(-0.04, -0.1, HANGAR.u0, 0, 0.03, 0),
    flightDeck: local(0.1, 0, FLIGHT.u, 0, 0.03, 0),
  };

  const STATE_HEX = [CORE, 0xfacc15, 0xef4444];
  return {
    anchors,
    deckHeight: DH,
    setState(areas) {
      const paint = (list, st) => list.forEach(({ mats }) => mats.forEach(m => m.color.setHex(STATE_HEX[st] || CORE)));
      paint(reactorCores, Math.max(0, Math.min(2, (areas.reactor || 0) | 0)));
      paint(aiCores, Math.max(0, Math.min(2, (areas.aiCore || 0) | 0)));
    },
    // keep map labels from swamping the view up close: full size from ~60 units out
    scaleLabels(camPos) {
      for (const s of LABELS) {
        if (!s.parent) continue;
        s.getWorldPosition(_lp);
        const k = Math.max(0.06, Math.min(1, camPos.distanceTo(_lp) / 60)), w = s.userData.w * k;
        s.scale.set(w, w * 0.19, 1);
      }
    },
    tick(t) {
      const k = 0.65 + 0.35 * Math.sin(t * 2.4);
      reactorCores.forEach(({ mats }) => mats.forEach((m, i) => { m.opacity = i % 2 ? 0.9 * k : 0.18 * k; }));
      spinners.forEach((s, i) => { s.rotation.y = t * (0.6 + (i % 3) * 0.25); });
      lifts.forEach(({ car, h, speed }) => { car.position.y = h * (0.5 - 0.5 * Math.cos(t * speed)); });
    },
  };
}
