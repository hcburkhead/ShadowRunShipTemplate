// ship-rooms.js — hologram interiors drawn inside the ship's wireframe so the crew stand in
// real rooms: the bridge (with the AI core at its back), the command offices on the hull
// deck above, and the engine room with the main reactor on the aft underside keel.
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
  const ER = { along: -0.09, upF: 0.03, L: 0.26 * Lh, W: 0.5 * Bh, H: 0.2 * H };
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
  const CO = { along: 0.17, upF: 0.41,  // forward of the drone bay (its swarm hovers around along −0.12)
                L: 0.28 * Lh, W: 0.6 * Bh, H: 0.15 * H };
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
  const BR = { along: 0.29, upF: 0.03, L: 0.34 * Lh, W: 0.56 * Bh, H: 0.17 * H };
  function bridge() {
    const g = new THREE.Group(); shell(g, BR.L, BR.W, BR.H);
    const fz = BR.L * 0.48;                                                                           // forward window frame
    [-0.42, -0.14, 0.14, 0.42].forEach(f => box(g, 0.12, BR.H * 0.8, 0.12, { p: [f * BR.W, BR.H * 0.45, fz] }));
    box(g, BR.W * 0.9, 0.12, 0.12, { p: [0, BR.H * 0.85, fz] });
    [-0.6, -0.3, 0, 0.3, 0.6].forEach(a => console_(g,                                               // console arc
      [Math.sin(a) * BR.W * 0.36, 0, BR.L * 0.18 + Math.cos(a) * BR.L * 0.18], a + Math.PI, 2.2));
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

  targets.forEach(t => {
    const er = engineRoom(); place(er, ER.along, 0, ER.upF); t.add(er);
    const co = commandOffices(); place(co, CO.along, 0, CO.upF); t.add(co);
    const br = bridge(); place(br, BR.along, 0, BR.upF); t.add(br);
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
    },
  };
}
