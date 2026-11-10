// crew-figures.js — small hologram figurines for the crew indicators.
//
// Each player gets an original, stylised figure drawn like the ship: bright wireframe
// edges over a very faint fill, additive, with one or two accent colours. Bodies share
// one posable humanoid rig (contoured lathe torso, jointed two-part limbs with elbows /
// knees, hands, booted feet, neck, shaped head) and each character adds its own gear.
// Units: feet at y = 0, facing +Z, ~4.5–7 units tall (the ship is ~160 long);
// index.html scales / places / spins them.
//
//   casper  — tall, slender troll hacker: deep peaked hood with horns through it, tusks,
//             eyes glowing in the hood, long cloak, a cyberdeck + datajack cable
//   gimli   — stocky dwarf warrior: braided beard + moustache, crested half-helm with
//             nasal / cheek guards, pauldrons, belt + buckle, double-bladed axe
//   ganbold — tall hitman: long belted coat with popped collar, fur ushanka, square jaw,
//             shades, suppressed scoped rifle at the ready
//   ryu     — lean street samurai: jacket with collar, cyber arm, visor, topknot, katana
//             across the back, thigh holster

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
  sh.moveTo(0, -0.16);
  sh.quadraticCurveTo(0.25, -0.18, 0.52, -0.5);        // lower beard
  sh.quadraticCurveTo(0.72, 0, 0.52, 0.5);             // curved cutting edge
  sh.quadraticCurveTo(0.25, 0.18, 0, 0.16);            // upper horn back to the haft
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -0.03);
  return geo;
}

// ---- the shared humanoid rig ----
// o.legs / o.arms: [[root, joint, end], [root, joint, end]] (left, right)
function humanoid(g, o) {
  const c = o.color || W;
  o.legs.forEach(([hip, knee, ankle]) => {
    rod(g, hip, knee, o.thigh, o.thigh * 0.8, c);
    ball(g, knee, o.thigh * 0.82, c);
    rod(g, knee, ankle, o.thigh * 0.78, o.thigh * 0.55, c);
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
  // ---- troll hacker: tall and slender, hooded ----
  casper(g) {
    const DECK = 0x6df3ff;
    humanoid(g, {
      thigh: 0.24, arm: 0.14, foot: 0.75,
      legs: [[[-0.3, 3.2, 0], [-0.34, 1.75, 0.12], [-0.32, 0.4, 0]], [[0.3, 3.2, 0], [0.36, 1.75, 0.1], [0.34, 0.4, 0]]],
      arms: [[[-0.62, 5.0, 0], [-0.82, 4.1, 0.2], [-0.42, 3.8, 0.95]], [[0.62, 5.0, 0], [0.82, 4.1, 0.2], [0.42, 3.8, 0.95]]],
      torsoY: 3.05, torsoZ: 0.65, torso: [[0.42, 0], [0.4, 0.4], [0.36, 0.8], [0.5, 1.4], [0.6, 1.8], [0.5, 2.0], [0.2, 2.15]],
      neck: [5.15, 5.45, 0.13], head: { p: [0, 5.75, 0.05], r: 0.36 },
    });
    // the hood: a peaked cowl, open at the front (the gap is centred on +Z), and a long cloak
    solid(g, new THREE.CylinderGeometry(0.12, 0.78, 1.45, 12, 1, true, 0.6, Math.PI * 2 - 1.2), W, { p: [0, 5.95, -0.05] });
    solid(g, new THREE.ConeGeometry(0.14, 0.45, 6), W, { p: [0, 6.75, -0.28], r: [-0.6, 0, 0] });
    solid(g, new THREE.CylinderGeometry(0.72, 1.05, 3.3, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8), W, { p: [0, 3.55, -0.08] }); // cloak (back)
    solid(g, new THREE.ConeGeometry(0.1, 0.7, 5), W, { p: [-0.62, 6.15, -0.05], r: [0, 0, 1.0] }); // horns through the hood
    solid(g, new THREE.ConeGeometry(0.1, 0.7, 5), W, { p: [0.62, 6.15, -0.05], r: [0, 0, -1.0] });
    box(g, 0.48, 0.07, 0.05, DECK, { p: [0, 5.8, 0.36] });              // eyes glowing in the shadow
    solid(g, new THREE.ConeGeometry(0.05, 0.25, 4), W, { p: [-0.13, 5.42, 0.38] }); // tusks
    solid(g, new THREE.ConeGeometry(0.05, 0.25, 4), W, { p: [0.13, 5.42, 0.38] });
    ring(g, [0, 3.15, 0], 0.46, 0.04, W, undefined, [1, 0.68, 1]);      // belt
    box(g, 0.28, 0.3, 0.16, W, { p: [0.38, 3.0, 0.25] });               // belt pouches
    box(g, 0.28, 0.3, 0.16, W, { p: [-0.38, 3.0, 0.25] });
    box(g, 1.4, 0.1, 0.8, DECK, { p: [0, 3.65, 1.15] });                // cyberdeck
    box(g, 1.2, 0.7, 0.05, DECK, { p: [0, 4.05, 0.82], r: [-0.35, 0, 0] });   // its screen
    tube(g, [[0.3, 3.7, 1.0], [0.45, 4.4, 0.75], [0.3, 5.1, 0.45], [0.25, 5.55, 0.3]], 0.03, DECK); // datajack cable
    return 6.95;
  },

  // ---- dwarf warrior: short, broad, braided beard, half-helm, axe ----
  gimli(g) {
    const STEEL = 0xfacc15;
    humanoid(g, {
      thigh: 0.34, arm: 0.26, foot: 0.8,
      legs: [[[-0.42, 1.35, 0], [-0.5, 0.78, 0.12], [-0.46, 0.38, 0]], [[0.42, 1.35, 0], [0.5, 0.78, 0.1], [0.48, 0.38, 0]]],
      arms: [[[-1.0, 2.65, 0], [-1.25, 1.95, 0.25], [-0.95, 1.5, 0.65]], [[1.0, 2.65, 0], [1.32, 2.15, 0.3], [1.18, 1.95, 0.82]]],
      torsoY: 1.15, torsoZ: 0.85, torso: [[0.85, 0], [0.98, 0.35], [1.08, 0.8], [1.12, 1.2], [0.95, 1.55], [0.45, 1.8]],
      neck: [2.9, 3.0, 0.3], head: { p: [0, 3.35, 0.05], r: 0.5 },
    });
    // helm: half-dome + rim + crest, nasal and cheek guards
    solid(g, new THREE.SphereGeometry(0.58, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), STEEL, { p: [0, 3.4, 0.03] });
    ring(g, [0, 3.42, 0.03], 0.58, 0.05, STEEL);
    box(g, 0.08, 0.2, 1.0, STEEL, { p: [0, 3.95, 0.03] });               // crest ridge
    box(g, 0.1, 0.45, 0.08, STEEL, { p: [0, 3.25, 0.55] });              // nasal guard
    box(g, 0.08, 0.45, 0.35, STEEL, { p: [-0.5, 3.15, 0.25] });          // cheek guards
    box(g, 0.08, 0.45, 0.35, STEEL, { p: [0.5, 3.15, 0.25] });
    // beard: a full wedge, two long braids with rings, a moustache
    solid(g, new THREE.ConeGeometry(0.62, 1.3, 9), W, { p: [0, 2.55, 0.42], r: [Math.PI + 0.15, 0, 0] });
    tube(g, [[-0.28, 2.8, 0.55], [-0.32, 2.2, 0.72], [-0.3, 1.6, 0.8], [-0.26, 1.15, 0.78]], 0.08);
    tube(g, [[0.28, 2.8, 0.55], [0.32, 2.2, 0.72], [0.3, 1.6, 0.8], [0.26, 1.15, 0.78]], 0.08);
    ring(g, [-0.3, 1.55, 0.8], 0.11, 0.03, STEEL); ring(g, [0.3, 1.55, 0.8], 0.11, 0.03, STEEL);
    solid(g, new THREE.ConeGeometry(0.08, 0.5, 5), W, { p: [-0.25, 3.1, 0.5], r: [0, 0, 1.2] });   // moustache
    solid(g, new THREE.ConeGeometry(0.08, 0.5, 5), W, { p: [0.25, 3.1, 0.5], r: [0, 0, -1.2] });
    // pauldrons, belt + buckle
    solid(g, new THREE.SphereGeometry(0.45, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), STEEL, { p: [-1.02, 2.62, 0], r: [0, 0, 0.35] });
    solid(g, new THREE.SphereGeometry(0.45, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), STEEL, { p: [1.02, 2.62, 0], r: [0, 0, -0.35] });
    ring(g, [0, 1.3, 0], 1.0, 0.07, STEEL, undefined, [1, 0.86, 1]);
    box(g, 0.4, 0.3, 0.1, STEEL, { p: [0, 1.3, 0.88] });
    // double-bladed axe: haft, two crescent blades, top spike
    rod(g, [1.2, 0.35, 0.85], [1.2, 3.85, 0.72], 0.06, 0.06, W, 6);
    const blade = axeBlade();
    solid(g, blade, STEEL, { p: [1.2, 3.35, 0.7] });                       // crescent blades, either side
    solid(g, blade, STEEL, { p: [1.2, 3.35, 0.7], s: [-1, 1, 1] });
    solid(g, new THREE.ConeGeometry(0.07, 0.35, 5), STEEL, { p: [1.2, 4.0, 0.72] });
    return 4.3;
  },

  // ---- hitman: tall, long coat, ushanka, shades, suppressed rifle ----
  ganbold(g) {
    const FUR = 0xd6c3a5, GUN = 0xef4444, GLASS = 0x6df3ff;
    humanoid(g, {
      thigh: 0.26, arm: 0.18, foot: 0.75,
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
    humanoid(g, {
      thigh: 0.25, arm: 0.17, foot: 0.7, armColor: [W, NEON],
      legs: [[[-0.3, 2.65, 0], [-0.42, 1.45, 0.2], [-0.44, 0.4, 0.05]], [[0.3, 2.65, 0], [0.42, 1.45, 0.05], [0.46, 0.4, -0.12]]],
      arms: [[[-0.65, 4.2, 0], [-0.8, 3.4, 0.15], [-0.62, 2.75, 0.4]], [[0.65, 4.2, 0], [0.85, 3.45, 0.25], [0.6, 2.9, 0.6]]],
      torsoY: 2.55, torsoZ: 0.65, torso: [[0.46, 0], [0.42, 0.4], [0.38, 0.75], [0.56, 1.3], [0.64, 1.65], [0.5, 1.85], [0.2, 2.0]],
      neck: [4.5, 4.72, 0.14], head: { p: [0, 4.98, 0.02], r: 0.34 },
    });
    // jacket: short flared hem + standing collar
    lathe(g, [[0.6, 0], [0.5, 0.35], [0.44, 0.6]], W, { p: [0, 2.35, 0], s: [1, 1, 0.75] }, 10);
    lathe(g, [[0.22, 0], [0.3, 0.25]], W, { p: [0, 4.48, 0], s: [1, 1, 0.9] }, 10);
    // cyber arm detail: joint rings
    ring(g, [0.85, 3.45, 0.25], 0.17, 0.035, NEON, [0, 0, Math.PI / 2]);
    ring(g, [0.72, 3.8, 0.12], 0.17, 0.03, NEON, [0.2, 0, Math.PI / 2 - 0.3]);
    // visor, topknot
    box(g, 0.66, 0.12, 0.1, NEON, { p: [0, 5.02, 0.3] });
    ball(g, [0, 5.45, -0.12], 0.13);
    ring(g, [0, 5.36, -0.1], 0.1, 0.03, NEON);
    // katana across the back: blade, guard, wrapped grip
    rod(g, [0.95, 2.75, -0.48], [-0.72, 4.8, -0.48], 0.045, 0.03, BLADE, 5);
    ring(g, [-0.76, 4.85, -0.48], 0.14, 0.035, W, [0, Math.PI / 2, 0.68]);
    rod(g, [-0.8, 4.9, -0.48], [-1.12, 5.29, -0.48], 0.065, 0.065, W, 6);
    // thigh holster
    box(g, 0.2, 0.55, 0.32, W, { p: [0.62, 2.1, 0.08], r: [0, 0, 0.08] });
    return 5.55;
  },
};

/** A new figure group for a crew key (casper/gimli/ganbold/ryu), feet at y = 0.
 *  Returns { group, height }. Unknown keys fall back to a simple glowing pillar. */
export function buildFigure(key) {
  const group = new THREE.Group();
  const height = BUILD[key] ? BUILD[key](group) : (solid(group, new THREE.CylinderGeometry(0.5, 0.5, 5, 8), W, { p: [0, 2.5, 0] }), 5);
  return { group, height };
}
