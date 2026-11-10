// crew-figures.js — small low-poly hologram figurines for the crew indicators.
//
// Each player gets an original, stylised figure built from Three.js primitives and
// drawn like the ship: bright wireframe edges over a very faint fill, additive, plus
// one accent colour per character. Units: feet at y = 0, facing +Z, ~4.5–7 units
// tall (the ship is ~160 long). index.html scales / places / spins them.
//
//   casper  — hulking, hunched troll hacker: horns, tusks, a glowing cyberdeck + jack cable
//   gimli   — stocky dwarf warrior: braided beard, conical helm, long-hafted axe
//   ganbold — tall hitman: long coat, fur ushanka, shades, suppressed rifle
//   ryu     — lean street samurai: cyber visor, topknot, katana across the back, cyber arm

import * as THREE from './vendor/three.module.js';

const EDGE_OPACITY = 0.9, FILL_OPACITY = 0.07;
const edgeMat = color => new THREE.LineBasicMaterial({ color, transparent: true, opacity: EDGE_OPACITY,
  blending: THREE.AdditiveBlending, depthWrite: false });
const fillMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: FILL_OPACITY,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

// one solid part → faint fill + crisp edges, positioned / rotated / scaled
function part(group, geo, color, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z); holder.rotation.set(rx, ry, rz); holder.scale.set(sx, sy, sz);
  holder.add(new THREE.Mesh(geo, fillMat(color)));
  holder.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat(color)));
  group.add(holder);
  return holder;
}
// a plain line (cables, straps)
function line(group, pts, color) {
  const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p)));
  group.add(new THREE.Line(g, edgeMat(color)));
}

const W = 0xffffff;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);

const BUILD = {
  // ---- troll hacker: big, hunched, horns + tusks, cyberdeck glowing cyan ----
  casper(g) {
    const DECK = 0x6df3ff;
    part(g, box(0.95, 1.9, 0.95), W, [-0.65, 0.95, 0]);                       // legs
    part(g, box(0.95, 1.9, 0.95), W, [0.65, 0.95, 0]);
    part(g, box(2.7, 2.3, 1.7), W, [0, 3.0, 0.15], [0.28, 0, 0]);             // hunched torso
    part(g, sph(0.8), W, [-1.55, 3.85, 0.3]);                                 // shoulders
    part(g, sph(0.8), W, [1.55, 3.85, 0.3]);
    part(g, box(1.05, 0.95, 1.05), W, [0, 4.55, 0.75]);                       // jutting head
    part(g, cone(0.2, 1.0, 6), W, [-0.42, 5.25, 0.55], [-0.5, 0, 0.45]);      // horns
    part(g, cone(0.2, 1.0, 6), W, [0.42, 5.25, 0.55], [-0.5, 0, -0.45]);
    part(g, cone(0.09, 0.35, 5), W, [-0.25, 4.25, 1.3]);                      // tusks
    part(g, cone(0.09, 0.35, 5), W, [0.25, 4.25, 1.3]);
    part(g, cyl(0.42, 0.36, 2.7), W, [-1.75, 2.5, 0.75], [0.45, 0, 0.12]);    // long arms reaching to the deck
    part(g, cyl(0.42, 0.36, 2.7), W, [1.75, 2.5, 0.75], [0.45, 0, -0.12]);
    part(g, box(1.9, 0.16, 1.1), DECK, [0, 2.05, 1.7]);                       // cyberdeck
    part(g, box(1.6, 0.9, 0.06), DECK, [0, 2.55, 1.25], [-0.35, 0, 0]);       // its screen
    line(g, [[0, 2.2, 1.4], [0.4, 3.2, 1.3], [0.55, 4.4, 1.1]], DECK);        // datajack cable to the head
    return 5.9;
  },
  // ---- dwarf warrior: short and broad, braided beard, conical helm, axe ----
  gimli(g) {
    const STEEL = 0xfacc15;
    part(g, box(0.75, 1.05, 0.75), W, [-0.45, 0.52, 0]);                      // stubby legs
    part(g, box(0.75, 1.05, 0.75), W, [0.45, 0.52, 0]);
    part(g, cyl(1.1, 1.25, 1.7, 8), W, [0, 1.9, 0]);                          // barrel chest
    part(g, cyl(1.28, 1.28, 0.25, 8), STEEL, [0, 1.15, 0]);                   // belt
    part(g, sph(0.62), W, [0, 3.15, 0.05]);                                   // head
    part(g, cone(0.72, 0.85, 8), STEEL, [0, 3.75, 0]);                        // conical helm
    part(g, box(0.12, 0.55, 0.12), STEEL, [0, 3.2, 0.62]);                    // nasal guard
    part(g, cone(0.78, 1.7, 8), W, [0, 2.3, 0.5], [Math.PI, 0, 0]);           // big beard
    part(g, cone(0.18, 0.7, 5), W, [-0.35, 1.15, 0.7], [Math.PI, 0, 0]);      // beard braids
    part(g, cone(0.18, 0.7, 5), W, [0.35, 1.15, 0.7], [Math.PI, 0, 0]);
    part(g, cyl(0.3, 0.26, 1.45), W, [-1.35, 2.0, 0.1], [0, 0, -0.25]);       // arms
    part(g, cyl(0.3, 0.26, 1.45), W, [1.35, 2.0, 0.25], [-0.5, 0, 0.25]);
    part(g, cyl(0.08, 0.08, 3.4, 6), W, [1.6, 2.1, 0.6], [-0.2, 0, 0.12]);    // axe haft
    part(g, box(0.12, 0.95, 0.85), STEEL, [1.75, 3.6, 0.55], [-0.2, 0, 0.12]); // axe blade
    return 4.4;
  },
  // ---- hitman: tall, long coat, fur hat, shades, suppressed rifle ----
  ganbold(g) {
    const FUR = 0xd6c3a5, GUN = 0xef4444;
    part(g, cyl(0.28, 0.24, 2.4, 6), W, [-0.33, 1.2, 0]);                     // legs
    part(g, cyl(0.28, 0.24, 2.4, 6), W, [0.33, 1.2, 0]);
    part(g, cyl(0.78, 1.15, 3.1, 8), W, [0, 2.75, 0]);                        // long flared coat
    part(g, box(1.6, 0.6, 0.85), W, [0, 4.35, 0]);                            // shoulders
    part(g, sph(0.45), W, [0, 5.0, 0]);                                       // head
    part(g, box(0.75, 0.12, 0.08), 0x6df3ff, [0, 5.05, 0.42]);                // shades
    part(g, box(1.05, 0.45, 1.0), FUR, [0, 5.48, 0]);                         // ushanka
    part(g, box(0.15, 0.55, 0.6), FUR, [-0.58, 5.1, 0]);                      // ear flaps
    part(g, box(0.15, 0.55, 0.6), FUR, [0.58, 5.1, 0]);
    part(g, cyl(0.2, 0.17, 1.9, 6), W, [-0.9, 3.4, 0.1], [0, 0, -0.12]);      // arms
    part(g, cyl(0.2, 0.17, 1.9, 6), W, [0.85, 3.5, 0.45], [-0.9, 0, 0.1]);
    part(g, box(0.22, 0.32, 1.9), GUN, [0.75, 3.55, 1.15], [0.12, 0, 0]);     // rifle body
    part(g, cyl(0.1, 0.1, 1.0, 6), GUN, [0.75, 3.43, 2.55], [Math.PI / 2 + 0.12, 0, 0]); // suppressor
    part(g, box(0.18, 0.45, 0.6), GUN, [0.75, 3.35, 0.1], [0.12, 0, 0]);      // stock
    return 5.9;
  },
  // ---- street samurai: lean, visor, topknot, katana across the back, cyber arm ----
  ryu(g) {
    const NEON = 0xb99cff, BLADE = 0x6df3ff;
    part(g, cyl(0.3, 0.24, 2.6, 6), W, [-0.36, 1.3, 0]);                      // legs
    part(g, cyl(0.3, 0.24, 2.6, 6), W, [0.36, 1.3, 0]);
    part(g, cyl(0.8, 0.58, 1.9, 6), W, [0, 3.5, 0]);                          // tapered torso
    part(g, sph(0.45), W, [0, 4.95, 0]);                                      // head
    part(g, sph(0.17, 6, 4), W, [0, 5.5, -0.18]);                             // topknot
    part(g, box(0.9, 0.16, 0.12), NEON, [0, 5.0, 0.4]);                       // cyber visor
    part(g, cyl(0.18, 0.15, 1.8, 6), W, [-0.85, 3.4, 0], [0, 0, -0.1]);       // flesh arm
    part(g, cyl(0.2, 0.17, 0.85, 6), NEON, [0.85, 3.85, 0.1], [0, 0, 0.12]); // cyber arm, segmented
    part(g, cyl(0.17, 0.15, 0.85, 6), NEON, [0.95, 2.95, 0.25], [-0.35, 0, 0.1]);
    part(g, cyl(0.05, 0.05, 3.3, 5), BLADE, [0, 3.75, -0.62], [0, 0, 0.78]);  // katana across the back
    part(g, cyl(0.17, 0.17, 0.05, 8), W, [-1.16, 4.92, -0.62], [0, 0, 0.78]); // tsuba (over the shoulder)
    part(g, cyl(0.07, 0.07, 0.75, 5), W, [-1.43, 5.19, -0.62], [0, 0, 0.78]); // grip
    return 5.7;
  },
};

/** A new figure group for a crew key (casper/gimli/ganbold/ryu), feet at y = 0.
 *  Returns { group, height }. Unknown keys fall back to a simple glowing pillar. */
export function buildFigure(key) {
  const group = new THREE.Group();
  const height = BUILD[key] ? BUILD[key](group) : (part(group, cyl(0.5, 0.5, 5, 8), W, [0, 2.5, 0]), 5);
  return { group, height };
}
