// ship-rooms.js — hologram interiors + deck plan (corridors, stairs, lift, floor labels) drawn
// inside the ship's wireframe like a tabletop dungeon map, so the crew stand in
// real rooms: the bridge (with the AI core at its back) in the forward underside gondola,
// the command offices in the aft section at mid-height, and the engine room with the main
// reactor on the underside keel between the bridge and the stern.
//
// Rooms are built in a ship-local frame: origin on the room's floor centre, +Z toward the
// bow, +Y up, X across the beam. Units are the display's world units (the ship is ~160
// long). Drawn as pale-blue edges over a very faint fill, additive — like the crew figures.

import * as THREE from './vendor/three.module.js';

const ROOM = 0x9ad7ff, CORE = 0x6df3ff;
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
function tube(g, pts, r, color = ROOM) {
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 10, r, 5, false);
  return solid(g, geo, {}, color, 0.5, 0.03);
}

// floor plate + faint wall outline for a room of length L (bow axis), width W, height H
function shell(g, L, W, H) {
  box(g, W, 0.12, L, { p: [0, 0.06, 0] }, ROOM, 0.7, 0.05);                         // deck plate
  const grid = new THREE.GridHelper(Math.max(L, W), Math.round(Math.max(L, W) / 2.5), ROOM, ROOM);
  grid.scale.set(W / Math.max(L, W), 1, L / Math.max(L, W)); grid.position.y = 0.13;
  grid.material.transparent = true; grid.material.opacity = 0.18; grid.material.depthWrite = false;
  grid.material.blending = THREE.AdditiveBlending; g.add(grid);
  const walls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, L)), edgeMat(ROOM, 0.25));
  walls.position.y = H / 2; g.add(walls);
}
// a desk console with a tilted screen, facing local +Z (rotate the returned group to aim it)
function console_(g, p, ry = 0, w = 2.6) {
  const c = new THREE.Group(); c.position.set(...p); c.rotation.y = ry; g.add(c);
  box(c, w, 1.1, 0.9, { p: [0, 0.55, 0] });
  box(c, w * 0.9, 0.7, 0.06, { p: [0, 1.5, -0.3], r: [-0.35, 0, 0] }, CORE, 0.8, 0.12);   // screen
  return c;
}
function chair(g, p, ry = 0) {
  const c = new THREE.Group(); c.position.set(...p); c.rotation.y = ry; g.add(c);
  box(c, 0.9, 0.15, 0.9, { p: [0, 0.75, 0] });
  box(c, 0.9, 0.9, 0.12, { p: [0, 1.25, -0.42] });
  solid(c, new THREE.CylinderGeometry(0.08, 0.08, 0.7, 5), { p: [0, 0.35, 0] });
}

/**
 * Build the interiors and add a copy to every target scene.
 * frame = { at(along, beam, up) → THREE.Vector3 world point, bow: unit Vector3, Lh, Bh, H }
 * Returns { anchors: { key: Vector3 floor spot for crew }, setState(areas), tick(t) }.
 */
export function buildRooms(frame, targets) {
  const { at, bow, Lh, Bh, H } = frame;
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(up, bow).normalize();
  const basis = new THREE.Matrix4().makeBasis(side, up, bow);
  const place = (g, along, beam, upFrac) => { g.position.copy(at(along, beam, upFrac)); g.quaternion.setFromRotationMatrix(basis); };
  // ship-local offset (x across, y up, z toward bow) → world, for crew anchors inside a room
  const local = (along, beam, upFrac, x, y, z) => at(along, beam, upFrac)
    .add(side.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(y)).add(bow.clone().multiplyScalar(z));

  const reactorCores = [], aiCores = [], spinners = [];

  // ---- engine room: aft end of the underside keel, main reactor in the middle ----
  // (rooms sized to sit inside the hull, not bulge out of it)
  const ER = { along: -0.05, upF: 0.05, L: 0.18 * Lh, W: 0.34 * Bh, H: 0.16 * H };
  function engineRoom() {
    const g = new THREE.Group(); shell(g, ER.L, ER.W, ER.H);
    const core = new THREE.Group(); g.add(core);
    solid(core, new THREE.CylinderGeometry(2.6, 2.6, 0.5, 14), { p: [0, 0.4, 0] }, ROOM, 0.7, 0.05);   // base
    const reactor = solid(core, new THREE.CylinderGeometry(1.7, 1.7, ER.H - 1.6, 14), { p: [0, ER.H / 2, 0] }, CORE, 0.9, 0.18);
    solid(core, new THREE.CylinderGeometry(2.6, 2.6, 0.5, 14), { p: [0, ER.H - 0.5, 0] }, ROOM, 0.7, 0.05); // cap
    const rings = [0.3, 0.5, 0.7].map(f => solid(core, new THREE.TorusGeometry(2.2, 0.12, 4, 18),
      { p: [0, ER.H * f, 0], r: [Math.PI / 2, 0, 0] }, CORE, 0.9, 0.15));
    reactorCores.push({ mats: [reactor, ...rings].flatMap(m => m.userData.mats) });
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) =>                                          // coolant pipes
      tube(g, [[sx * 1.8, ER.H * 0.65, sz * 1.2], [sx * ER.W * 0.3, ER.H * 0.8, sz * ER.L * 0.25], [sx * ER.W * 0.48, ER.H * 0.55, sz * ER.L * 0.35]], 0.25));
    console_(g, [ER.W * 0.32, 0, ER.L * 0.3], Math.PI * 0.85);
    console_(g, [-ER.W * 0.32, 0, -ER.L * 0.3], -Math.PI * 0.15);
    return g;
  }

  // ---- command offices: the hull deck above the keel — three partitioned offices + holo-table ----
  // aft (rear) section of the hull, on the internal deck at mid-height
  const CO = { along: -0.6, upF: 0.42, L: 0.2 * Lh, W: 0.4 * Bh, H: 0.14 * H };
  function commandOffices() {
    const g = new THREE.Group(); shell(g, CO.L, CO.W, CO.H);
    [-1, 1].forEach(sx => box(g, 0.15, CO.H * 0.75, CO.L * 0.55, { p: [sx * CO.W * 0.17, CO.H * 0.375, -CO.L * 0.2] }));   // partitions
    box(g, CO.W * 0.98, CO.H * 0.75, 0.15, { p: [0, CO.H * 0.375, CO.L * 0.08] }, ROOM, 0.4, 0.02);                      // office fronts
    [-1, 0, 1].forEach(i => {                                                                                         // three offices
      const x = i * CO.W * 0.33;
      console_(g, [x, 0, -CO.L * 0.38], 0, 2.4);
      chair(g, [x, 0, -CO.L * 0.24], Math.PI);
    });
    const table = new THREE.Group(); table.position.set(0, 0, CO.L * 0.3); g.add(table);              // holo-table
    solid(table, new THREE.CylinderGeometry(1.8, 1.4, 1.1, 14), { p: [0, 0.55, 0] });
    const holo = solid(table, new THREE.SphereGeometry(0.9, 10, 6), { p: [0, 2.0, 0] }, CORE, 0.7, 0.08);
    spinners.push(holo);
    return g;
  }

  // ---- bridge: forward underside gondola — window frame, console arc, captain's chair;
  //      the AI core sits at the back of the bridge ----
  const BR = { along: 0.29, upF: 0.04, L: 0.26 * Lh, W: 0.4 * Bh, H: 0.14 * H };
  function bridge() {
    const g = new THREE.Group(); shell(g, BR.L, BR.W, BR.H);
    const fz = BR.L * 0.48;                                                                           // forward window frame
    [-0.42, -0.14, 0.14, 0.42].forEach(f => box(g, 0.12, BR.H * 0.8, 0.12, { p: [f * BR.W, BR.H * 0.45, fz] }));
    box(g, BR.W * 0.9, 0.12, 0.12, { p: [0, BR.H * 0.85, fz] });
    [-0.6, -0.3, 0, 0.3, 0.6].forEach(a => console_(g,                                               // console arc
      [Math.sin(a) * BR.W * 0.36, 0, BR.L * 0.18 + Math.cos(a) * BR.L * 0.18], a + Math.PI, 1.7));
    chair(g, [0, 0, -BR.L * 0.02], 0);                                                                // captain's chair
    // AI core at the back of the bridge: a glowing sphere on a pedestal with two spinning rings
    const ai = new THREE.Group(); ai.position.set(0, 0, -BR.L * 0.36); g.add(ai);
    solid(ai, new THREE.CylinderGeometry(1.0, 1.4, 1.2, 12), { p: [0, 0.6, 0] });
    const sphere = solid(ai, new THREE.SphereGeometry(1.1, 12, 8), { p: [0, 2.4, 0] }, CORE, 0.9, 0.2);
    const r1 = solid(ai, new THREE.TorusGeometry(1.6, 0.07, 4, 20), { p: [0, 2.4, 0] }, CORE, 0.9, 0.15);
    const r2 = solid(ai, new THREE.TorusGeometry(1.9, 0.06, 4, 20), { p: [0, 2.4, 0], r: [Math.PI / 2, 0, 0] }, CORE, 0.9, 0.15);
    aiCores.push({ mats: [sphere, r1, r2].flatMap(m => m.userData.mats) });
    spinners.push(r1, r2);
    return g;
  }

  // ---- deck plan: corridors, stairs and a lift joining the rooms (classic dungeon-map style) ----
  //   bridge aft door ──keel corridor── engine room ──lift (up)── mid-deck passage ── command offices
  //   bridge ──stairs (up)── mid-deck walkway ──┘   (a loop: two routes between fore and aft)
  const PATH = 0xc8e6ff, LABEL_OP = 0.55;
  const brAft = BR.along - BR.L / 2 / Lh, erFore = ER.along + ER.L / 2 / Lh, erAft = ER.along - ER.L / 2 / Lh;
  const coFore = CO.along + CO.L / 2 / Lh;
  const LIFT = { along: erAft - 0.025, beam: 0 };
  const MID = CO.upF, PORT = -0.2;                                   // mid deck height; passage offset to port (clear of the drone bay)
  const STAIR = { beam: 0.2, a0: brAft + 0.01, a1: brAft - 0.12 };   // bridge stairs climb aft on the starboard side
  function labelSprite(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d'); x.font = 'bold 26px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(200,230,255,0.9)'; x.fillText(text, 128, 24);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: LABEL_OP, depthWrite: false }));
    sp.scale.set(10, 1.9, 1); return sp;
  }
  // a straight floor segment along the bow axis between two 'along' values, at beam / upFrac
  function corridor(g, a0, a1, beam, upF, width) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1), len = (hi - lo) * Lh;
    const seg = new THREE.Group(); place(seg, (lo + hi) / 2, beam, upF); g.add(seg);
    box(seg, width, 0.1, len, { p: [0, 0.05, 0] }, PATH, 0.6, 0.05);                          // floor
    [-1, 1].forEach(sx => box(seg, 0.08, 1.6, len, { p: [sx * width / 2, 0.8, 0] }, PATH, 0.18, 0.012));   // low walls
    const dash = new THREE.LineDashedMaterial({ color: PATH, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.5, depthWrite: false });
    const cl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.12, -len / 2), new THREE.Vector3(0, 0.12, len / 2)]), dash);
    cl.computeLineDistances(); seg.add(cl);                                                      // dashed centre line
    const n = Math.max(1, Math.floor(len / 6));                                                  // direction chevrons
    for (let i = 0; i < n; i++) {
      const z = -len / 2 + (i + 0.5) * len / n, w = width * 0.22;
      seg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w, 0.13, z - w * 0.6), new THREE.Vector3(0, 0.13, z + w * 0.4), new THREE.Vector3(w, 0.13, z - w * 0.6)]), edgeMat(PATH, 0.45)));
    }
    return seg;
  }
  // a door frame standing across the bow axis at 'along'
  function door(g, along, beam, upF, width, height) {
    const d = new THREE.Group(); place(d, along, beam, upF); g.add(d);
    [-1, 1].forEach(sx => box(d, 0.25, height, 0.25, { p: [sx * width / 2, height / 2, 0] }, PATH, 0.8, 0.05));
    box(d, width + 0.25, 0.25, 0.25, { p: [0, height, 0] }, PATH, 0.8, 0.05);
  }
  // stairs climbing from (a0, u0) to (a1, u1) at beam, built from individual treads + stringers
  function stairs(g, a0, u0, a1, u1, beam, width) {
    const A = at(a0, beam, u0), B = at(a1, beam, u1), run = A.distanceTo(new THREE.Vector3(B.x, A.y, B.z));
    const rise = B.y - A.y, n = Math.max(6, Math.round(rise / 0.9));
    const st = new THREE.Group(); place(st, a0, beam, u0); g.add(st);
    const dir = Math.sign(a1 - a0);                                                              // +z = toward the bow
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      box(st, width, 0.18, run / n * 1.05, { p: [0, rise * f, dir * run * f] }, PATH, 0.7, 0.06);
    }
    const slope = Math.atan2(rise, run), len = Math.hypot(rise, run);
    [-1, 1].forEach(sx => box(st, 0.14, 0.4, len, { p: [sx * width / 2, rise / 2 + 0.25, dir * run / 2], r: [-dir * slope, 0, 0] }, PATH, 0.6, 0.03));
    return st;
  }
  // a lift: open shaft frame between two deck heights, landing pads, and a car that rides it
  const liftCars = [];
  function lift(g, along, beam, u0, u1, size) {
    const A = at(along, beam, u0), B = at(along, beam, u1), h = B.y - A.y;
    const L = new THREE.Group(); place(L, along, beam, u0); g.add(L);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) =>
      box(L, 0.18, h + 2.4, 0.18, { p: [x * size / 2, (h + 2.4) / 2, z * size / 2] }, PATH, 0.75, 0.05));   // corner rails
    [0, h].forEach(y => box(L, size + 0.6, 0.1, size + 0.6, { p: [0, y + 0.05, 0] }, PATH, 0.6, 0.04));    // landings
    const car = new THREE.Group(); L.add(car);
    box(car, size * 0.92, 0.16, size * 0.92, { p: [0, 0.1, 0] }, CORE, 0.9, 0.12);                        // car floor
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size * 0.92, 2.2, size * 0.92)), edgeMat(CORE, 0.6));
    frame.position.y = 1.2; car.add(frame);
    liftCars.push({ car, h });
    return L;
  }
  function deckPlan() {
    const g = new THREE.Group();
    // lower (keel) deck: bridge ⇄ engine room, then aft to the lift
    corridor(g, erFore, brAft, 0, BR.upF, 0.18 * Bh);
    door(g, brAft, 0, BR.upF, 0.16 * Bh, BR.H * 0.7);
    door(g, erFore, 0, ER.upF, 0.16 * Bh, ER.H * 0.7);
    // lift from the engine room's aft wall up to the mid deck
    lift(g, LIFT.along, LIFT.beam, ER.upF, MID, 0.1 * Bh);
    door(g, erAft, 0, ER.upF, 0.12 * Bh, ER.H * 0.6);
    // mid-deck passage: lift landing → command offices (offset to port)
    corridor(g, LIFT.along, LIFT.along - 0.03, 0, MID, 0.14 * Bh);                       // landing stub
    corridor(g, LIFT.along - 0.03, coFore + 0.005, PORT, MID, 0.14 * Bh);
    corridor(g, coFore + 0.03, coFore - 0.005, 0, MID, 0.14 * Bh);                      // into the offices
    door(g, coFore, 0, CO.upF, 0.16 * Bh, CO.H * 0.75);
    // bridge stairs (starboard) up to the mid deck, then a walkway aft to join the passage
    stairs(g, STAIR.a0, BR.upF, STAIR.a1, MID, STAIR.beam, 0.12 * Bh);
    corridor(g, STAIR.a1, LIFT.along - 0.03, STAIR.beam, MID, 0.12 * Bh);
    // cross-passages tying the walkway / landing / port passage together
    const xr = new THREE.Group(); place(xr, LIFT.along - 0.03, 0, MID); g.add(xr);
    box(xr, (STAIR.beam - PORT) * Bh + 0.14 * Bh, 0.1, 0.12 * Bh, { p: [(STAIR.beam + PORT) / 2 * Bh, 0.05, 0] }, PATH, 0.6, 0.05);
    // floor labels, dungeon-map style
    [['BRIDGE', BR.along, 0, BR.upF], ['AI CORE', BR.along - BR.L * 0.36 / Lh, 0, BR.upF], ['ENGINEERING', ER.along, 0, ER.upF],
     ['COMMAND', CO.along, 0, CO.upF], ['LIFT', LIFT.along, 0, (ER.upF + MID) / 2], ['STAIRS', STAIR.a0 - 0.02, STAIR.beam + 0.16, BR.upF]]
      .forEach(([t, a, b, u]) => { const sp = labelSprite(t); sp.position.copy(at(a, b, u)).add(new THREE.Vector3(0, 6, 0)); g.add(sp); });
    return g;
  }

  targets.forEach(t => {
    const er = engineRoom(); place(er, ER.along, 0, ER.upF); t.add(er);
    const co = commandOffices(); place(co, CO.along, 0, CO.upF); t.add(co);
    const br = bridge(); place(br, BR.along, 0, BR.upF); t.add(br);
    t.add(deckPlan());
  });

  // crew standing spots on the room floors (beside, not inside, the reactor / AI core)
  const anchors = {
    reactor: local(ER.along, 0, ER.upF, 0, 0.15, ER.L * 0.24),
    command: local(CO.along, 0, CO.upF, 0, 0.15, -CO.L * 0.05),
    bridge:  local(BR.along, 0, BR.upF, 0, 0.15, BR.L * 0.08),
    aiCore:  local(BR.along, 0, BR.upF, 0, 0.15, -BR.L * 0.2),
  };

  const STATE_HEX = [CORE, 0xfacc15, 0xef4444];
  return {
    anchors,
    // colour the reactor / AI core by their damage-control state (0 online · 1 damaged · 2 offline)
    setState(areas) {
      const paint = (list, st) => list.forEach(({ mats }) => mats.forEach(m => m.color.setHex(STATE_HEX[st] || CORE)));
      paint(reactorCores, Math.max(0, Math.min(2, (areas.reactor || 0) | 0)));
      paint(aiCores, Math.max(0, Math.min(2, (areas.aiCore || 0) | 0)));
    },
    // gentle animation (perspective view): reactor glow pulses, AI-core rings and holo-table turn
    tick(t) {
      const k = 0.65 + 0.35 * Math.sin(t * 2.4);
      reactorCores.forEach(({ mats }) => mats.forEach((m, i) => { m.opacity = i % 2 ? 0.9 * k : 0.18 * k; }));
      spinners.forEach((s, i) => { s.rotation.y = t * (0.6 + (i % 3) * 0.25); });
      liftCars.forEach(({ car, h }) => { car.position.y = h * (0.5 - 0.5 * Math.cos(t * 0.35)); });   // lift car rides up and down
    },
  };
}
