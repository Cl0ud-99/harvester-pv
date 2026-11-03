import * as THREE from 'three';
import { mergeList, mulberry32 } from '../lib/util.js';
import { terrainH, RIFT_A } from './terrain.js';

const TAU = Math.PI * 2;

/* stacked-cone conifer with a baked vertical colour gradient */
function conifer(seed) {
  const rnd = mulberry32(seed);
  const h = 13 + rnd() * 11;
  const r = h * (0.16 + rnd() * 0.06);
  const parts = [];

  const trunk = new THREE.CylinderGeometry(r * 0.16, r * 0.24, h * 0.42, 6, 1, false);
  trunk.translate(0, h * 0.21, 0);
  parts.push(trunk);

  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const ch = h * (0.40 - t * 0.07);
    const cr = r * (1 - t * 0.42);
    const cone = new THREE.ConeGeometry(cr, ch, 9, 2, false);
    cone.translate(0, h * (0.30 + t * 0.22) + ch * 0.5, 0);
    parts.push(cone);
  }

  const g = mergeList(parts);

  // vertical gradient: dark base -> lit crown, breaks the flat-shaded read
  const p3 = g.attributes.position;
  const cols = new Float32Array(p3.count * 3);
  const dark = new THREE.Color(0x18240f);
  const mid = new THREE.Color(0x2f4322);
  const tip = new THREE.Color(0x5c7a3a);
  const c = new THREE.Color();
  for (let i = 0; i < p3.count; i++) {
    const t = Math.min(1, Math.max(0, p3.getY(i) / h));
    c.copy(dark).lerp(mid, Math.min(1, t * 2.2)).lerp(tip, Math.max(0, (t - 0.45) / 0.55) * 0.55);
    const j = 0.92 + (i % 7) * 0.022;
    cols[i * 3] = c.r * j; cols[i * 3 + 1] = c.g * j; cols[i * 3 + 2] = c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  g.rotateY(rnd() * TAU);
  return g;
}

function boulder(seed) {
  const rnd = mulberry32(seed);
  const g = new THREE.DodecahedronGeometry(1, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.7 + rnd() * 0.7;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.72, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

export function createFlora(M, scene) {
  const root = new THREE.Group();
  root.name = 'flora';
  const rnd = mulberry32(9137);

  const trees = [], rocks = [];
  const CELL = 200;
  const cells = new Map();
  const treeVariants = [];
  for (let i = 0; i < 8; i++) treeVariants.push(conifer(500 + i * 31));
  const rockVariants = [];
  for (let i = 0; i < 6; i++) rockVariants.push(boulder(900 + i * 17));

  const blocked = (x, z) => Math.hypot(x, z) < 104;
  const inCorridor = (x, z) => {
    const a = Math.atan2(z, x);
    let d = a - RIFT_A;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return Math.abs(d) < 0.075 && Math.hypot(x, z) < 240;
  };

  /* forest patches — dense inner belt, much denser outer ring */
  const PATCHES = 330;
  for (let p = 0; p < PATCHES; p++) {
    const pa = rnd() * TAU;
    const pr = 118 + rnd() * 780;
    const cx = Math.cos(pa) * pr, cz = Math.sin(pa) * pr;
    const radius = 26 + rnd() * 62;
    const n = pr > 420 ? 55 + Math.floor(rnd() * 90) : 30 + Math.floor(rnd() * 70);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const rr = Math.sqrt(rnd()) * radius;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (blocked(x, z) || inCorridor(x, z)) continue;
      const y = terrainH(x, z);
      if (y > 120) continue;
      const g = treeVariants[Math.floor(rnd() * treeVariants.length)].clone();
      const s = 0.42 + Math.pow(rnd(), 1.55) * 1.55;
      g.scale(s, s * (0.75 + rnd() * 0.6), s);
      g.rotateY(rnd() * TAU);
      g.translate(x, y - 0.6, z);
      const key = Math.floor(x / CELL) + "," + Math.floor(z / CELL);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(g);
    }
  }

  /* boulders */
  for (let i = 0; i < 420; i++) {
    const a = rnd() * TAU;
    const r = 108 + rnd() * 320;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    const y = terrainH(x, z);
    const g = rockVariants[Math.floor(rnd() * rockVariants.length)].clone();
    const s = 0.8 + Math.pow(rnd(), 2.2) * 5.5;
    g.scale(s * (0.8 + rnd() * 0.5), s * (0.5 + rnd() * 0.5), s * (0.8 + rnd() * 0.5));
    g.rotateY(rnd() * TAU);
    g.translate(x, y + s * 0.22, z);
    rocks.push(g);
  }

  // one merged mesh per 200 m cell so frustum culling can actually reject geometry
  let cellCount = 0;
  for (const [key, list] of cells) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeList(list), M.foliage);
    const cx = Number(key.split(",")[0]) * CELL + CELL / 2;
    const cz = Number(key.split(",")[1]) * CELL + CELL / 2;
    const far = Math.hypot(cx, cz) > 620;
    m.castShadow = !far;               // distant cells skip the shadow pass
    m.receiveShadow = true;
    m.name = 'forest_' + key;
    root.add(m);
    cellCount++;
  }

  const rockMesh = new THREE.Mesh(mergeList(rocks), M.rock);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  rockMesh.name = 'meadowRocks';
  root.add(rockMesh);

  scene.add(root);
  return { group: root };
}
