// crew-figures.js — small hologram figurines for the crew indicators.
//
// Each player gets an original, stylised figure drawn like the ship: bright wireframe
// edges over a very faint fill, additive, with one or two accent colours. Bodies share
// one posable humanoid rig (contoured lathe torso, jointed two-part limbs with elbows /
// knees, hands, booted feet, neck, shaped head) and each character adds its own gear.
// Units: feet at y = 0, facing +Z, ~4.5–7 units tall (the ship is ~160 long);
// index.html scales / places / spins them.
//
//   casper  — troll street hacker: hoodie with L-shaped horns, glowing blue visor, tusks +
//             rebreather mask, open green jacket, techno backpack with glowing power core,
//             tactical cargo pants, cyberdeck laptop + datajack cable, live terminal HUD
//   gimli   — the team's face, a dwarf: shorter, normal proportions, casual open coat +
//             jeans, groomed beard with one braid, swept-back hair, commlink in hand,
//             double-bladed axe strapped across his back
//   ganbold — tall augmented hitman: long belted coat with popped collar, fur ushanka,
//             shades over a red cybereye, neck ports, cyber left arm + smartlink cable,
//             suppressed scoped rifle at the ready
//   ryu     — stocky, heavily augmented weapons specialist: two cyber arms, armoured chest
//             plate + shoulder pads, spinal nodes, shin plates, visor (live terminal HUD),
//             topknot, katana across the back, heavy thigh holster, two small drones at his shoulders

import * as THREE from './vendor/three.module.js';

const EDGE_OPACITY = 0.9, FILL_OPACITY = 0.07;
const edgeMat = color => new THREE.LineBasicMaterial({ color, transparent: true, opacity: EDGE_OPACITY,
  blending: THREE.AdditiveBlending, depthWrite: false });
const fillMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: FILL_OPACITY,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

const W = 0xffffff;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// one solid → faint fill + crisp edges. t = { p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], q:Quaternion }
function solid(g, geo, color, t = {}, edgeAngle = 22) {
  const h = new THREE.Group();
  if (t.p) h.position.set(...t.p);
  if (t.q) h.quaternion.copy(t.q); else if (t.r) h.rotation.set(...t.r);
  if (t.s) h.scale.set(...t.s);
  h.add(new THREE.Mesh(geo, fillMat(color)));
  h.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, edgeAngle), edgeMat(color)));
  g.add(h);
  return h;
}
function line(g, pts, color) {
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => V(...p))), edgeMat(color)));
}
// a tapered rod from a to b (limbs, hafts, barrels)
function rod(g, a, b, r1, r2 = r1, color = W, sides = 7) {
  const A = V(...a), B = V(...b), d = B.clone().sub(A), len = d.length();
  return solid(g, new THREE.CylinderGeometry(r2, r1, len, sides), color,
    { p: A.clone().add(B).multiplyScalar(0.5).toArray(), q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()) });
}
const ball = (g, p, r, color = W, s) => solid(g, new THREE.SphereGeometry(r, 7, 5), color, { p, s });
// a lathe (turned profile) — profile = [[radius, y], …] bottom → top
const lathe = (g, profile, color, t, segs = 10) =>
  solid(g, new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs), color, t, 18);
// a soft tube through points (braids, cables)
function tube(g, pts, r, color = W, segs = 12) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => V(...p)));
  return solid(g, new THREE.TubeGeometry(curve, segs, r, 5, false), color, {}, 35);
}
const ring = (g, p, R, r, color, rot = [Math.PI / 2, 0, 0], s) =>
  solid(g, new THREE.TorusGeometry(R, r, 4, 14), color, { p, r: rot, s }, 35);
const box = (g, w, h, d, color, t) => solid(g, new THREE.BoxGeometry(w, h, d), color, t);
// a flat crescent axe blade in the XY plane, from the haft (x = 0) out to the edge (+x)
function axeBlade() {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.14);
  sh.quadraticCurveTo(0.22, -0.16, 0.45, -0.42);       // lower beard
  sh.quadraticCurveTo(0.62, 0, 0.45, 0.42);            // curved cutting edge
  sh.quadraticCurveTo(0.22, 0.16, 0, 0.14);            // upper horn back to the haft
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -0.025);
  return geo;
}

// ---- the shared humanoid rig ----
// o.legs / o.arms: [[root, joint, end], [root, joint, end]] (left, right)
function humanoid(g, o) {
  const c = o.color || W;
  const lc = o.legColor || c;                                     // e.g. denim for jeans
  o.legs.forEach(([hip, knee, ankle]) => {
    rod(g, hip, knee, o.thigh, o.thigh * 0.8, lc);
    ball(g, knee, o.thigh * 0.82, lc);
    rod(g, knee, ankle, o.thigh * 0.78, o.thigh * 0.55, lc);
    const fl = o.foot || 0.65;                                    // boot: sole + toe cap
    box(g, o.thigh * 1.25, 0.22, fl, c, { p: [ankle[0], 0.11, ankle[2] + fl * 0.3] });
    box(g, o.thigh * 1.1, 0.28, o.thigh * 1.2, c, { p: [ankle[0], 0.3, ankle[2]] });
  });
  o.arms.forEach(([sh, el, hand], i) => {
    const ac = (o.armColor && o.armColor[i]) || c;
    ball(g, sh, o.arm * 1.15, ac);
    rod(g, sh, el, o.arm, o.arm * 0.85, ac);
    ball(g, el, o.arm * 0.85, ac);
    rod(g, el, hand, o.arm * 0.82, o.arm * 0.65, ac);
    ball(g, hand, o.arm * 0.95, ac, [0.85, 1.15, 1]);            // hand
  });
  lathe(g, o.torso, c, { p: [0, o.torsoY, 0], s: [1, 1, o.torsoZ || 0.7] });
  rod(g, [0, o.neck[0], 0], [0, o.neck[1], 0], o.neck[2], o.neck[2] * 0.9, c);
  const [hx, hy, hz] = o.head.p;
  ball(g, [hx, hy, hz], o.head.r, c, [0.88, 1.08, 0.95]);       // skull
  box(g, o.head.r * 1.1, o.head.r * 0.5, o.head.r * 0.9, c,      // jaw
    { p: [hx, hy - o.head.r * 0.55, hz + o.head.r * 0.12] });
  box(g, o.head.r * 0.2, o.head.r * 0.35, o.head.r * 0.3, c,     // nose
    { p: [hx, hy - o.head.r * 0.1, hz + o.head.r * 0.92] });
}

const BUILD = {
  // ---- street troll hacker: hoodie, L-horns, visor, tusks, rebreather mask, open jacket, techno backpack, cyberdeck ----
  casper(g) {
    const GREEN = 0x22c55e, BLUE = 0x38bdf8, MASK = 0xa1a1aa, DECK = 0x6df3ff;
    humanoid(g, {
      thigh: 0.24, arm: 0.15, foot: 0.72,
      armColor: [GREEN, GREEN],
      legs: [[[-0.3, 3.2, 0], [-0.34, 1.75, 0.12], [-0.32, 0.4, 0]], [[0.3, 3.2, 0], [0.36, 1.75, 0.1], [0.34, 0.4, 0]]],
      arms: [[[-0.62, 4.95, 0], [-0.72, 4.05, 0.22], [-0.38, 3.25, 0.38]], [[0.62, 4.95, 0], [0.72, 4.05, 0.22], [0.38, 3.25, 0.38]]],
      torsoY: 3.05, torsoZ: 0.65, torso: [[0.42, 0], [0.4, 0.4], [0.36, 0.8], [0.5, 1.4], [0.6, 1.8], [0.5, 2.0], [0.2, 2.15]],
      neck: [5.15, 5.45, 0.13], head: { p: [0, 5.75, 0.05], r: 0.36 },
    });

    // hoodie cowl dome
    const OPEN = 1.35;
    solid(g, new THREE.SphereGeometry(0.5, 10, 8, Math.PI / 2 + OPEN / 2, Math.PI * 2 - OPEN, 0, Math.PI * 0.8),
      W, { p: [0, 5.82, -0.06], s: [0.9, 1.28, 1.1] }, 8);
    ring(g, [0, 5.78, 0.36], 0.32, 0.04, W, [0, 0, 0], [0.95, 1.4, 1]);   // hoodie rim
    ring(g, [0, 5.2, -0.04], 0.4, 0.08, W, undefined, [1, 0.85, 1]);      // neck fold
    line(g, [[0, 6.45, 0.15], [0, 6.42, -0.22], [0, 6.05, -0.58], [0, 5.5, -0.6]], W); // crown seam
    line(g, [[-0.1, 5.35, 0.42], [-0.12, 4.8, 0.46], [-0.1, 4.2, 0.46]], W);  // drawstrings
    line(g, [[0.12, 5.35, 0.42], [0.14, 4.8, 0.46], [0.12, 4.2, 0.46]], W);

    // L-shaped troll horns through the hoodie sides
    rod(g, [-0.35, 6.02, 0.0], [-0.68, 6.1, -0.02], 0.08, 0.065, W, 6);   // left base
    rod(g, [-0.68, 6.1, -0.02], [-0.62, 6.52, 0.22], 0.065, 0.02, W, 6); // left L-bend
    rod(g, [0.35, 6.02, 0.0], [0.68, 6.1, -0.02], 0.08, 0.065, W, 6);    // right base
    rod(g, [0.68, 6.1, -0.02], [0.62, 6.52, 0.22], 0.065, 0.02, W, 6);  // right L-bend

    // face: glowing blue visor, rebreather mask, and upward troll tusks
    box(g, 0.52, 0.12, 0.08, BLUE, { p: [0, 5.82, 0.38] });               // visor
    line(g, [[-0.25, 5.82, 0.43], [0.25, 5.82, 0.43]], BLUE);
    solid(g, new THREE.ConeGeometry(0.24, 0.38, 6), MASK, { p: [0, 5.5, 0.38], r: [-0.3, 0, 0] }); // mask body
    rod(g, [-0.14, 5.48, 0.38], [-0.24, 5.45, 0.3], 0.07, 0.07, MASK, 6);  // filter canisters
    rod(g, [0.14, 5.48, 0.38], [0.24, 5.45, 0.3], 0.07, 0.07, MASK, 6);
    box(g, 0.12, 0.18, 0.08, BLUE, { p: [0, 5.48, 0.42] });               // mask glow core
    solid(g, new THREE.ConeGeometry(0.05, 0.26, 4), W, { p: [-0.15, 5.42, 0.44], r: [0.3, 0, -0.2] }); // left tusk
    solid(g, new THREE.ConeGeometry(0.05, 0.26, 4), W, { p: [0.15, 5.42, 0.44], r: [0.3, 0, 0.2] });   // right tusk

    // open green jacket over hoodie with hands in pockets
    solid(g, new THREE.CylinderGeometry(0.68, 0.78, 2.1, 12, 1, true, 0.5, Math.PI * 2 - 1.0), GREEN, { p: [0, 4.05, 0], s: [1.05, 1, 0.85] });
    line(g, [[-0.28, 4.9, 0.42], [-0.38, 4.0, 0.48], [-0.38, 3.1, 0.42]], GREEN); // jacket lapels
    line(g, [[0.28, 4.9, 0.42], [0.38, 4.0, 0.48], [0.38, 3.1, 0.42]], GREEN);
    box(g, 0.18, 0.45, 0.05, W, { p: [-0.42, 4.5, 0.4], r: [0, 0, -0.15] });     // shoulder patches
    box(g, 0.18, 0.45, 0.05, W, { p: [0.42, 4.5, 0.4], r: [0, 0, 0.15] });
    box(g, 0.22, 0.28, 0.12, GREEN, { p: [-0.38, 3.25, 0.4] });                 // pockets
    box(g, 0.22, 0.28, 0.12, GREEN, { p: [0.38, 3.25, 0.4] });

    // techno-backpack mounted behind the coat
    box(g, 0.72, 0.95, 0.38, W, { p: [0, 4.25, -0.52] });                       // backpack chassis
    rod(g, [0, 3.85, -0.58], [0, 4.65, -0.58], 0.12, 0.12, BLUE, 8);            // central glowing power core
    ring(g, [0, 4.25, -0.58], 0.15, 0.03, BLUE, [Math.PI / 2, 0, 0]);           // core accent ring
    box(g, 0.84, 0.18, 0.28, BLUE, { p: [0, 4.55, -0.5] });                    // top heat-vent housing
    box(g, 0.18, 0.35, 0.15, W, { p: [-0.42, 4.1, -0.5] });                    // side utility modules
    box(g, 0.42, 0.35, 0.15, W, { p: [0.42, 4.1, -0.5] });
    tube(g, [[-0.32, 4.65, -0.38], [-0.38, 4.82, 0.18], [-0.38, 4.15, 0.38]], 0.035, W); // harness shoulder straps
    tube(g, [[0.32, 4.65, -0.38], [0.38, 4.82, 0.18], [0.38, 4.15, 0.38]], 0.035, W);

    // tactical cargo pockets on trousers
    box(g, 0.26, 0.35, 0.12, W, { p: [-0.38, 2.3, 0.15] });
    box(g, 0.26, 0.35, 0.12, W, { p: [0.38, 2.3, 0.15] });

    // cyberdeck laptop (keyboard base unit + tilted display screen casing)
    box(g, 1.2, 0.08, 0.7, DECK, { p: [0, 3.65, 0.95], r: [0.1, 0, 0] });       // base keyboard deck
    line(g, [[-0.45, 3.71, 0.8], [0.45, 3.71, 0.8]], DECK);                     // key row 1
    line(g, [[-0.45, 3.71, 0.98], [0.45, 3.71, 0.98]], DECK);                   // key row 2
    box(g, 1.15, 0.62, 0.04, DECK, { p: [0, 4.02, 1.26], r: [0.28, 0, 0] });    // screen lid backboard

    // live cyberdeck terminal display (attached to laptop lid backboard)
    const scr = new THREE.Group(); scr.position.set(0, 4.02, 1.24); scr.rotation.x = 0.28;
    const term = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.52), new THREE.MeshBasicMaterial({
      map: deckTerminal().tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    term.position.z = -0.025;
    term.rotation.y = Math.PI;                                                  // front faces Casper (-Z)
    scr.add(term); g.add(scr);

    // datajack cable linking deck to neck ports / head
    tube(g, [[0.35, 3.68, 0.9], [0.48, 4.35, 0.68], [0.32, 5.0, 0.42], [0.22, 5.45, 0.35]], 0.028, DECK);

    g.userData.tick = t => updateDeckTerminal(t);
    return 6.95;
  },

  // ---- dwarf face: shorter than the others but normal proportions, casual —
  //      an open coat over a plain top, jeans, groomed beard, swept-back hair ----
  gimli(g) {
    const DENIM = 0x60a5fa, LINK = 0x6df3ff, GOLD = 0xfacc15;
    humanoid(g, {
      thigh: 0.27, arm: 0.19, foot: 0.68, legColor: DENIM,
      legs: [[[-0.3, 1.75, 0], [-0.34, 0.98, 0.1], [-0.32, 0.38, 0]], [[0.3, 1.75, 0], [0.36, 0.98, 0.06], [0.35, 0.38, -0.04]]],
      arms: [[[-0.7, 3.35, 0], [-0.82, 2.7, 0.12], [-0.64, 2.15, 0.3]], [[0.7, 3.35, 0], [0.88, 2.78, 0.3], [0.55, 3.0, 0.68]]],
      torsoY: 1.6, torsoZ: 0.72, torso: [[0.55, 0], [0.52, 0.35], [0.5, 0.6], [0.62, 1.1], [0.68, 1.45], [0.52, 1.65], [0.22, 1.78]],
      neck: [3.36, 3.55, 0.17], head: { p: [0, 3.84, 0.03], r: 0.4 },
    });
    // jeans: waistband + belt line, side seams, front pockets
    ring(g, [0, 1.75, 0], 0.55, 0.04, DENIM, undefined, [1, 0.72, 1]);
    line(g, [[-0.58, 1.72, 0], [-0.62, 0.98, 0], [-0.5, 0.5, 0]], DENIM);
    line(g, [[0.58, 1.72, 0], [0.64, 0.98, 0], [0.52, 0.5, 0]], DENIM);
    line(g, [[-0.42, 1.72, 0.36], [-0.3, 1.5, 0.4], [-0.15, 1.7, 0.4]], DENIM);
    line(g, [[0.42, 1.72, 0.36], [0.3, 1.5, 0.4], [0.15, 1.7, 0.4]], DENIM);
    // open coat to mid-thigh: a flared shell open at the front, with a turned-down collar
    solid(g, new THREE.CylinderGeometry(0.66, 0.78, 2.05, 12, 1, true, 0.55, Math.PI * 2 - 1.1), W, { p: [0, 2.32, 0], s: [1, 1, 0.82] });
    lathe(g, [[0.24, 0], [0.36, 0.14], [0.3, 0.24]], W, { p: [0, 3.3, -0.02], s: [1, 1, 0.9] }, 10);
    line(g, [[-0.22, 3.32, 0.38], [-0.32, 2.9, 0.5], [-0.3, 1.35, 0.55]], W);    // coat front edges
    line(g, [[0.22, 3.32, 0.38], [0.32, 2.9, 0.5], [0.3, 1.35, 0.55]], W);
    // groomed beard with one braid, neat moustache, swept-back hair
    solid(g, new THREE.ConeGeometry(0.34, 0.55, 8), W, { p: [0, 3.42, 0.3], r: [Math.PI + 0.25, 0, 0] });
    tube(g, [[0, 3.2, 0.42], [0, 2.98, 0.48], [0, 2.82, 0.47]], 0.05);
    solid(g, new THREE.ConeGeometry(0.05, 0.3, 5), W, { p: [-0.14, 3.68, 0.36], r: [0, 0, 1.3] });
    solid(g, new THREE.ConeGeometry(0.05, 0.3, 5), W, { p: [0.14, 3.68, 0.36], r: [0, 0, -1.3] });
    lathe(g, [[0.38, 0], [0.41, 0.14], [0.34, 0.3], [0.12, 0.38], [0, 0.39]], W, { p: [0, 3.9, -0.05], s: [1, 1, 1.12] }, 10);
    // commlink held up in the right hand
    box(g, 0.28, 0.42, 0.05, LINK, { p: [0.52, 3.1, 0.75], r: [-0.4, -0.3, 0] });
    // double-bladed axe strapped diagonally across the back, head over the left shoulder
    const axe = new THREE.Group();
    axe.position.set(0, 2.55, -0.62); axe.rotation.z = -0.62;          // tilt: head up-left, butt down-right
    rod(axe, [0, -1.45, 0], [0, 1.5, 0], 0.05, 0.05, W, 6);           // haft
    const blade = axeBlade();
    solid(axe, blade, GOLD, { p: [0, 1.1, 0] });                       // crescent blades, either side
    solid(axe, blade, GOLD, { p: [0, 1.1, 0], s: [-1, 1, 1] });
    solid(axe, new THREE.ConeGeometry(0.06, 0.3, 5), GOLD, { p: [0, 1.62, 0] });   // top spike
    g.add(axe);
    // the strap: over the right shoulder, across the chest, round to the left hip
    tube(g, [[0.5, 3.35, -0.35], [0.45, 3.3, 0.35], [0, 2.75, 0.52], [-0.45, 2.15, 0.45], [-0.55, 1.95, -0.2]], 0.035, W);
    return 4.3;
  },

  // ---- hitman: tall, long coat, ushanka, shades, suppressed rifle ----
  ganbold(g) {
    const FUR = 0xd6c3a5, GUN = 0xef4444, GLASS = 0x6df3ff, AUG = 0xb99cff;
    humanoid(g, {
      thigh: 0.26, arm: 0.18, foot: 0.75, armColor: [AUG, W],
      legs: [[[-0.3, 2.9, 0], [-0.34, 1.6, 0.1], [-0.32, 0.4, 0]], [[0.3, 2.9, 0], [0.38, 1.6, 0.05], [0.36, 0.4, -0.05]]],
      arms: [[[-0.75, 4.45, 0], [-0.9, 3.85, 0.45], [-0.3, 3.95, 1.3]], [[0.75, 4.45, 0], [0.95, 3.7, 0.3], [0.48, 3.55, 0.7]]],
      torsoY: 2.85, torsoZ: 0.7, torso: [[0.5, 0], [0.48, 0.5], [0.6, 1.1], [0.72, 1.5], [0.6, 1.75], [0.25, 1.95]],
      neck: [4.75, 4.95, 0.17], head: { p: [0, 5.2, 0.02], r: 0.38 },
    });
    // long coat: flared skirt below a belt, popped collar, lapels
    lathe(g, [[1.02, 0], [0.92, 0.5], [0.75, 1.3], [0.62, 1.9], [0.55, 2.1]], W, { p: [0, 0.85, 0], s: [1, 1, 0.78] }, 12);
    ring(g, [0, 2.95, 0], 0.55, 0.05, W, undefined, [1, 0.72, 1]);      // coat belt
    box(g, 0.22, 0.2, 0.06, W, { p: [0, 2.95, 0.4] });                  // buckle
    lathe(g, [[0.3, 0], [0.38, 0.3], [0.42, 0.45]], W, { p: [0, 4.6, 0], s: [1, 1, 0.85] }, 10);   // popped collar
    line(g, [[-0.15, 4.6, 0.42], [-0.35, 3.8, 0.5], [-0.25, 3.0, 0.4]], W);   // lapels
    line(g, [[0.15, 4.6, 0.42], [0.35, 3.8, 0.5], [0.25, 3.0, 0.4]], W);
    // ushanka: crown, fur brim, ear flaps; shades
    lathe(g, [[0.42, 0], [0.44, 0.3], [0.36, 0.45], [0, 0.5]], FUR, { p: [0, 5.38, 0.02] }, 10);
    ring(g, [0, 5.42, 0.02], 0.45, 0.09, FUR);
    box(g, 0.14, 0.5, 0.45, FUR, { p: [-0.46, 5.12, 0] });
    box(g, 0.14, 0.5, 0.45, FUR, { p: [0.46, 5.12, 0] });
    box(g, 0.62, 0.11, 0.06, GLASS, { p: [0, 5.22, 0.36] });
    // augments: red cybereye glowing behind the right lens, neck interface ports,
    // a cybernetic left arm (rings + plating) and a smartlink cable from that hand to the rifle
    box(g, 0.12, 0.08, 0.04, GUN, { p: [0.15, 5.22, 0.4] });
    [[-0.12, 4.88], [0.12, 4.88]].forEach(([x, y]) => box(g, 0.07, 0.07, 0.07, AUG, { p: [x, y, 0.17] }));
    ring(g, [-0.9, 3.85, 0.45], 0.19, 0.035, AUG, [0, 0, Math.PI / 2]);
    ring(g, [-0.6, 3.9, 0.88], 0.16, 0.03, AUG, [0, 1.0, Math.PI / 2]);
    box(g, 0.2, 0.08, 0.5, AUG, { p: [-0.62, 4.0, 0.85], r: [0, 0.95, 0] });
    tube(g, [[-0.3, 3.95, 1.3], [-0.15, 3.75, 1.2], [0.05, 3.72, 1.05], [0.2, 3.62, 0.85]], 0.025, AUG);
    // suppressed, scoped rifle held at the ready
    rod(g, [0.55, 3.45, 0.45], [-0.25, 3.95, 1.55], 0.09, 0.09, GUN, 6);          // receiver / barrel
    rod(g, [-0.25, 3.95, 1.55], [-0.55, 4.13, 1.98], 0.13, 0.13, GUN, 8);         // suppressor
    rod(g, [0.45, 3.68, 0.55], [0.05, 3.93, 1.1], 0.07, 0.07, GUN, 6);            // scope
    box(g, 0.16, 0.35, 0.55, GUN, { p: [0.72, 3.32, 0.25], r: [0.5, 0, 0.45] });  // stock
    box(g, 0.1, 0.35, 0.12, GUN, { p: [0.28, 3.42, 0.7], r: [0.3, 0, 0] });       // magazine
    return 5.95;
  },

  // ---- street samurai: lean, cyber arm, visor, topknot, katana on the back ----
  ryu(g) {
    const NEON = 0xb99cff, BLADE = 0x6df3ff;
    // stocky, heavily augmented weapons specialist: broad frame, thick limbs, BOTH arms cybernetic
    humanoid(g, {
      thigh: 0.34, arm: 0.25, foot: 0.8, armColor: [NEON, NEON],
      legs: [[[-0.4, 2.55, 0], [-0.55, 1.4, 0.18], [-0.56, 0.42, 0.05]], [[0.4, 2.55, 0], [0.55, 1.4, 0.05], [0.58, 0.42, -0.1]]],
      arms: [[[-0.95, 4.2, 0], [-1.15, 3.35, 0.15], [-0.92, 2.7, 0.4]], [[0.95, 4.2, 0], [1.2, 3.4, 0.25], [0.9, 2.85, 0.6]]],
      torsoY: 2.45, torsoZ: 0.78, torso: [[0.62, 0], [0.6, 0.4], [0.58, 0.7], [0.8, 1.25], [0.9, 1.65], [0.72, 1.88], [0.3, 2.02]],
      neck: [4.42, 4.66, 0.21], head: { p: [0, 4.95, 0.03], r: 0.36 },
    });
    // armoured jacket: flared hem, high collar, chest plate, shoulder pads
    lathe(g, [[0.76, 0], [0.66, 0.35], [0.6, 0.6]], W, { p: [0, 2.25, 0], s: [1, 1, 0.8] }, 10);
    lathe(g, [[0.3, 0], [0.38, 0.28]], W, { p: [0, 4.4, 0], s: [1, 1, 0.9] }, 10);
    box(g, 1.15, 0.85, 0.12, NEON, { p: [0, 3.75, 0.6], r: [-0.12, 0, 0] });   // armoured chest plate
    line(g, [[-0.45, 3.75, 0.68], [0.45, 3.75, 0.68]], NEON);
    solid(g, new THREE.SphereGeometry(0.42, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), NEON, { p: [-0.98, 4.18, 0], r: [0, 0, 0.4] });
    solid(g, new THREE.SphereGeometry(0.42, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), NEON, { p: [0.98, 4.18, 0], r: [0, 0, -0.4] });
    // cyber arms: joint rings at elbow + forearm on both sides
    ring(g, [-1.15, 3.35, 0.15], 0.24, 0.04, NEON, [0, 0, Math.PI / 2]);
    ring(g, [1.2, 3.4, 0.25], 0.24, 0.04, NEON, [0, 0, Math.PI / 2]);
    ring(g, [-1.03, 3.0, 0.28], 0.21, 0.03, NEON, [0.5, 0, Math.PI / 2 - 0.2]);
    ring(g, [1.05, 3.12, 0.42], 0.21, 0.03, NEON, [0.5, 0, Math.PI / 2 + 0.2]);
    // spinal augment: a ridge of nodes down the back
    [4.3, 3.95, 3.6, 3.25, 2.9].forEach(y => box(g, 0.16, 0.12, 0.14, NEON, { p: [0, y, -0.6] }));
    // reinforced shin plates
    box(g, 0.32, 0.65, 0.1, NEON, { p: [-0.56, 0.95, 0.28], r: [0.05, 0, 0] });
    box(g, 0.32, 0.65, 0.1, NEON, { p: [0.58, 0.95, 0.12], r: [-0.08, 0, 0] });
    // visor, topknot
    box(g, 0.7, 0.13, 0.1, NEON, { p: [0, 5.0, 0.32] });
    // the visor runs the same live terminal feed as Casper's deck (a shared texture; this
    // copy shows a horizontal band of it to fit the slim visor), on its outer face
    const hud = deckTerminalView();                                      // same canvas → scrolls in sync
    hud.repeat.set(1, 0.3); hud.offset.set(0, 0.32);
    const visorHud = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.11), new THREE.MeshBasicMaterial({
      map: hud, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    visorHud.position.set(0, 5.0, 0.375); g.add(visorHud);
    ball(g, [0, 5.43, -0.12], 0.14);
    ring(g, [0, 5.34, -0.1], 0.11, 0.03, NEON);
    // katana across the back: blade, guard, wrapped grip
    rod(g, [1.05, 2.7, -0.66], [-0.8, 4.85, -0.66], 0.045, 0.03, BLADE, 5);
    ring(g, [-0.84, 4.9, -0.66], 0.15, 0.035, W, [0, Math.PI / 2, 0.68]);
    rod(g, [-0.88, 4.95, -0.66], [-1.2, 5.34, -0.66], 0.07, 0.07, W, 6);
    // heavy thigh holster
    box(g, 0.26, 0.6, 0.38, W, { p: [0.82, 2.05, 0.08], r: [0, 0, 0.08] });
    // two small quad-rotor drones hovering at his shoulders (bob + spin rotors via userData.tick)
    const drones = [-1, 1].map(side => {
      const d = new THREE.Group();
      d.position.set(side * 1.75, 4.95, 0.15);
      box(d, 0.36, 0.12, 0.36, W);                                        // body
      ball(d, [0, -0.02, 0], 0.1, BLADE);                                 // glowing core
      box(d, 0.16, 0.05, 0.05, BLADE, { p: [0, -0.02, 0.2] });            // sensor eye, facing forward
      const rotors = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z]) => {
        rod(d, [0, 0.03, 0], [x * 0.3, 0.06, z * 0.3], 0.025, 0.025, W, 4);   // arms
        const r = new THREE.Group(); r.position.set(x * 0.3, 0.09, z * 0.3);
        ring(r, [0, 0, 0], 0.15, 0.015, NEON);                              // rotor guard
        rod(r, [-0.13, 0, 0], [0.13, 0, 0], 0.012, 0.012, W, 3);            // blade
        d.add(r);
        return r;
      });
      g.add(d);
      return { d, rotors, side, y0: d.position.y };
    });
    g.userData.tick = t => {                                              // called each frame by index.html
      updateDeckTerminal(t);                                              // keeps the visor feed scrolling
      for (const { d, rotors, side, y0 } of drones) {
        d.position.y = y0 + Math.sin(t * 2.2 + side) * 0.12;
        d.rotation.y = Math.sin(t * 0.7 + side) * 0.25;
        rotors.forEach((r, i) => { r.rotation.y = t * 30 * (i % 2 ? 1 : -1); });
      }
    };
    return 5.55;
  },
};

// ---- Casper's cyberdeck terminal: a tiny canvas that scrolls hacker log lines ----
let deckTerm = null;
const HEX = n => Array.from({ length: n }, () => '0123456789ABCDEF'[Math.random() * 16 | 0]).join('');
const pick = a => a[Math.random() * a.length | 0];
const TERM_LINES = [
  () => '> jack-in node://' + HEX(4).toLowerCase() + '.' + HEX(2).toLowerCase(),
  () => 'decrypt ' + HEX(4) + ':' + HEX(4) + ' .. OK',
  () => '[ICE] probe deflected',
  () => '[ICE] black ICE sig ' + HEX(3) + ' masked',
  () => { const n = 10 + (Math.random() * 90 | 0), f = n / 10 | 0; return 'trace ' + '#'.repeat(f) + '.'.repeat(10 - f) + ' ' + n + '%'; },
  () => 'GET /host/' + pick(['sec', 'cam', 'door', 'paydata', 'relay', 'ice']) + ' 200',
  () => '0x' + HEX(6) + '  ' + HEX(2) + ' ' + HEX(2) + ' ' + HEX(2) + ' ' + HEX(2),
  () => '> sudo override --' + pick(['relay', 'lock', 'cams', 'alarm', 'drones']),
  () => '[SERA] handshake ' + pick(['ok', 'ok', 'retry', 'ok']),
  () => 'spoof id ' + HEX(8) + ' accepted',
  () => '> grep -r paydata /mnt/' + HEX(2).toLowerCase(),
];
function deckTerminal() {
  if (deckTerm) return deckTerm;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  deckTerm = { canvas, ctx: canvas.getContext('2d'), tex, views: [], lines: [], next: 0, drawn: -1 };
  for (let i = 0; i < 7; i++) deckTerm.lines.push(pick(TERM_LINES)());
  drawDeckTerminal(0);
  return deckTerm;
}
// another texture over the same terminal canvas (own repeat / offset). The renderer re-uploads
// per texture object, so every view is flagged on each redraw.
function deckTerminalView() {
  const t = deckTerminal().tex.clone();
  deckTerm.views.push(t);
  return t;
}
function drawDeckTerminal(t) {
  const { ctx, lines, tex } = deckTerm, W = 256, H = 128, LH = 14;
  ctx.fillStyle = 'rgb(2,22,14)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(109,243,255,0.28)'; ctx.fillRect(0, 0, W, 15);              // title bar
  ctx.font = 'bold 11px "Courier New", monospace'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#bef9d2'; ctx.fillText('casper@deck:~  [MATRIX]', 5, 2);
  ctx.font = '11px "Courier New", monospace';
  const shown = lines.slice(-7);
  shown.forEach((l, i) => {                                                           // older lines fade
    ctx.globalAlpha = 0.4 + 0.6 * (i + 1) / shown.length;
    ctx.fillStyle = l.startsWith('[ICE]') ? '#facc15' : l.startsWith('>') ? '#6df3ff' : '#4ade80';
    ctx.fillText(l.slice(0, 38), 5, 19 + i * LH);
  });
  ctx.globalAlpha = 1;
  if ((t * 2.5 | 0) % 2) {                                                            // blinking cursor
    const last = shown[shown.length - 1] || '';
    ctx.fillStyle = '#6df3ff'; ctx.fillRect(5 + Math.min(38, last.length) * 6.6 + 2, 19 + (shown.length - 1) * LH, 6, 11);
  }
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  tex.needsUpdate = true;
  for (const v of deckTerm.views) v.needsUpdate = true;
}
function updateDeckTerminal(t) {
  if (!deckTerm) return;
  if (t >= deckTerm.next) {                                                           // a new line every ~0.3–0.7 s
    deckTerm.lines.push(pick(TERM_LINES)());
    if (deckTerm.lines.length > 40) deckTerm.lines.splice(0, deckTerm.lines.length - 40);
    deckTerm.next = t + 0.3 + Math.random() * 0.4;
  }
  const frame = t * 10 | 0;                                                           // redraw at ~10 Hz
  if (frame !== deckTerm.drawn) { deckTerm.drawn = frame; drawDeckTerminal(t); }
}

/** A new figure group for a crew key (casper/gimli/ganbold/ryu), feet at y = 0.
 *  Returns { group, height }. Unknown keys fall back to a simple glowing pillar.
 *  A figure with moving parts sets group.userData.tick(seconds) — call it each frame. */
export function buildFigure(key) {
  const group = new THREE.Group();
  const height = BUILD[key] ? BUILD[key](group) : (solid(group, new THREE.CylinderGeometry(0.5, 0.5, 5, 8), W, { p: [0, 2.5, 0] }), 5);
  return { group, height };
}
