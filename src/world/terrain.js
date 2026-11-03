import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm2, ridged2, noise2, mulberry32, mergeList, boxUV } from '../lib/util.js';

/* ------------------------------------------------------------------ *
 *  Set metrics — the station deck surface is y = 0
 * ------------------------------------------------------------------ */
export const SET = {
  ringR: 82,
  pitR: 48,
  deckY: 0,
  deck2Y: 13,
  pitDepth: 46,
  lavaY: -34,
  roadR: 96,
  valleyR: 470,
  basinY: -3.5,
};

export const RIFT_A = -0.72;          // arrival azimuth — the canyon gate
const CAM_R = 300;
const CAM_X = Math.cos(RIFT_A) * CAM_R;
const CAM_Z = Math.sin(RIFT_A) * CAM_R;

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* ------------------------------------------------------------------ *
 *  height field
 * ------------------------------------------------------------------ */
export function terrainH(x, z) {
  const r = Math.hypot(x, z);

  let h = SET.basinY + fbm2(x * 0.011, z * 0.011, 3) * 3.4 + fbm2(x * 0.045, z * 0.045, 2) * 0.5;

  // bench around the station
  const bench = smoothstep(60, 130, r);
  h = lerp(-1.4 + fbm2(x * 0.05, z * 0.05, 2) * 0.5, h, bench);

  // carved shaft under the station so the well is open all the way down
  const wellK = 1 - smoothstep(SET.pitR - 2, SET.pitR + 12, r);
  if (wellK > 0.001) h = lerp(h, -46 + fbm2(x * 0.06, z * 0.06, 2) * 1.5, wellK);

  // canyon walls, with a wide notch where the rift opens (the arrival corridor)
  const notch = Math.exp(-Math.pow(angDiff(Math.atan2(z, x), RIFT_A) / 0.62, 2));
  const gate = 1.0 - 0.9 * notch;
  // two-stage ramp: foothills first, then the wall — never flat-to-cliff in one step
  const t0 = smoothstep(170, 430, r);
  const foothill = ridged2(x * 0.0040 + 9.0, z * 0.0040 - 4.0, 4);
  h += t0 * (4 + Math.pow(foothill, 1.15) * 52);

  const t1 = smoothstep(330, 820, r);
  const ridge1 = ridged2(x * 0.0050 + 3.1, z * 0.0050 - 2.2, 5);
  h += t1 * (12 + Math.pow(ridge1, 1.30) * 158) * gate;

  // second wall
  const t2 = smoothstep(600, 940, r);
  const ridge2 = ridged2(x * 0.0030 - 7.0, z * 0.0030 + 4.0, 5);
  h += t2 * (40 + Math.pow(ridge2, 1.25) * 240);

  // far rim
  const t3 = smoothstep(1050, 1600, r);
  const far = ridged2(x * 0.0015 + 11.0, z * 0.0015 - 9.0, 4) * 380 + 80;
  h = lerp(h, far, t3);

  return h;
}

/* ------------------------------------------------------------------ *
 *  Basalt buttes — monolithic, faceted, fluted
 * ------------------------------------------------------------------ */
function butteGeo(w, h, seed, sides = 9) {
  const rnd = mulberry32(seed);
  const g = new THREE.CylinderGeometry(w * 0.58, w, h, sides, 12, false);
  const pos = g.attributes.position;
  const colMul = [];
  for (let i = 0; i < sides; i++) colMul.push(0.78 + rnd() * 0.5);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = clamp(v.y / h + 0.5, 0, 1);
    const ang = Math.atan2(v.z, v.x);
    const seg = ((ang / (Math.PI * 2)) * sides + sides * 2) % sides;
    const i0 = Math.floor(seg) % sides, i1 = (i0 + 1) % sides;
    const fr = seg - Math.floor(seg);
    const cm = lerp(colMul[i0], colMul[i1], fr * fr * (3 - 2 * fr));

    // silhouette: flared base, slight waist, pinched crown
    const prof = 1.0 + 0.42 * Math.pow(1 - t, 2.4) - 0.42 * Math.pow(t, 2.2);
    // vertical fluting + eroded ledges
    const flute = 1 + 0.055 * Math.sin(ang * 7.0 + seed * 0.7) + 0.035 * Math.sin(ang * 13.0 - seed);
    const ledge = 1 + 0.05 * Math.sin(t * 26.0 + seed) * (1 - t * 0.5);

    const k = prof * cm * flute * ledge;
    v.x *= k;
    v.z *= k;
    // strata steps
    v.y += Math.sin(t * 17.0 + seed * 1.3) * h * 0.006 * (1 - t);

    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const non = g.toNonIndexed();
  g.dispose();
  non.computeVertexNormals();
  return non;
}

function butteCluster(seed, scale = 1) {
  const rnd = mulberry32(seed);
  const parts = [];
  const main = butteGeo(0.55 * scale, 1.0 * scale, seed, 9 + (seed % 3));
  parts.push(main);
  const n = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = 0.34 + rnd() * 0.3;
    const hh = (0.42 + rnd() * 0.5) * scale;
    const ww = (0.24 + rnd() * 0.2) * scale;
    const g = butteGeo(ww, hh, seed + i * 31, 6 + (i % 3));
    g.rotateY(rnd() * Math.PI * 2);
    g.translate(Math.cos(a) * rad * scale, hh * 0.42, Math.sin(a) * rad * scale);
    parts.push(g);
  }
  // a couple of broken spikes on the crown for silhouette
  for (let i = 0; i < 2; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = rnd() * 0.22 * scale;
    const hh = (0.3 + rnd() * 0.45) * scale;
    const g = butteGeo(0.10 * scale, hh, seed + 90 + i, 5);
    g.translate(Math.cos(a) * rad, 0.82 * scale + hh * 0.3, Math.sin(a) * rad);
    parts.push(g);
  }
  const merged = mergeList(parts);
  merged.computeVertexNormals();
  return merged;
}

function buildCliffs(M) {
  const group = new THREE.Group();
  group.name = 'cliffs';
  const variants = [];
  for (let i = 0; i < 10; i++) variants.push(butteCluster(211 + i * 53, 1));

  const rnd = mulberry32(2027);
  const geos = [];
  const moss = [];

  const put = (angle, radius, height, widthScale, variant, sink = 0.16, addMoss = true) => {
    if (radius < 560) {
      const d = Math.abs(angDiff(angle, RIFT_A));
      if (d < 0.34) return;
      if (d < 0.5 && radius < 460) return;
    }
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (radius < 700 && Math.hypot(x - CAM_X, z - CAM_Z) < 190) return;

    const g = variants[Math.abs(variant) % variants.length].clone();
    const wid = height * widthScale;
    g.scale(wid, height, wid);
    g.rotateY(rnd() * Math.PI * 2);
    g.translate(x, terrainH(x, z) + height * sink, z);
    boxUV(g, 0.16, x * 0.004, z * 0.004);
    geos.push(g);

    if (addMoss && height > 40) {
      const m = butteGeo(wid * 0.30, height * 0.10, 900 + variant * 17, 7);
      m.translate(x + (rnd() - 0.5) * wid * 0.35, terrainH(x, z) + height * 0.05, z + (rnd() - 0.5) * wid * 0.35);
      moss.push(m);
    }
  };

  /* hero framing masses — big buttes at the frame edges, never on the sight line */
  const heroes = [
    [-0.16, 470, 210, 0.42], [-1.34, 500, 262, 0.39], [-0.88, 600, 172, 0.48],
    [2.34, 520, 232, 0.40], [3.12, 570, 278, 0.37], [4.44, 540, 190, 0.45],
    [5.38, 496, 240, 0.40], [0.90, 560, 174, 0.47], [2.72, 660, 318, 0.34],
  ];
  heroes.forEach(([a, r, hh, ws], i) => put(a, r, hh, ws, i));

  /* the canyon wall ring */
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 430 + rnd() * 240;
    put(a, r, 150 + rnd() * 200, 0.36 + rnd() * 0.16, i);
  }
  /* the two flanking walls of the gate */
  for (let i = 0; i < 8; i++) {
    const a = RIFT_A + (i % 2 ? 1 : -1) * (0.42 + rnd() * 0.22);
    put(a, 420 + rnd() * 110, 190 + rnd() * 150, 0.42, i + 2);
  }
  /* far rim */
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 1050 + rnd() * 700;
    put(a, r, 240 + rnd() * 320, 0.36 + rnd() * 0.2, i + 3, 0.22, false);
  }
  /* basin boulders */
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 120 + rnd() * 170;
    put(a, r, 3 + rnd() * 8, 0.8 + rnd() * 0.6, i + 5, 0.14);
  }

  const merged = mergeList(geos);

  // paint the buttes with the same palette as the ground so the two cliff
  // languages read as one landscape: mossy feet, basalt flanks, pale crowns
  {
    const p3 = merged.attributes.position;
    const cols = new Float32Array(p3.count * 3);
    const cMossA = new THREE.Color(0x5f6d2e);
    const cMossB = new THREE.Color(0x7d7a35);
    const cRockA = new THREE.Color(0x544d46);
    const cRockB = new THREE.Color(0x6d665d);
    const cTop = new THREE.Color(0x7e766c);
    const tmp = new THREE.Color();
    for (let i = 0; i < p3.count; i++) {
      const x = p3.getX(i), y = p3.getY(i), z = p3.getZ(i);
      const n = fbm2(x * 0.02 + 7, z * 0.02 - 3, 3) * 0.5 + 0.5;
      const foot = 1 - smoothstep(-2, 34, y);
      const high = smoothstep(90, 260, y);
      tmp.copy(cRockA).lerp(cRockB, n);
      tmp.lerp(cMossA.clone().lerp(cMossB, n), foot * 0.85);
      tmp.lerp(cTop, high * 0.55);
      // vertical streak variation
      tmp.multiplyScalar(0.9 + 0.18 * (fbm2(x * 0.09, z * 0.09, 2) * 0.5 + 0.5));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    merged.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  const mesh = new THREE.Mesh(merged, M.rockVC);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'basalt';
  group.add(mesh);

  if (moss.length) {
    const mm = new THREE.Mesh(mergeList(moss), M.moss);
    mm.castShadow = false; mm.receiveShadow = true;
    mm.name = 'mossCaps';
    group.add(mm);
  }
  return group;
}

/* ------------------------------------------------------------------ *
 *  Terrain mesh
 * ------------------------------------------------------------------ */
export function createTerrain(M, scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const SIZE = 2600, SEG = 420;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cMoss = new THREE.Color(0x6d7c34);
  const cMossDry = new THREE.Color(0x93903f);
  const cDirt = new THREE.Color(0x5b4a36);
  const cRock = new THREE.Color(0x4a4440);
  const cDark = new THREE.Color(0x2a2523);
  const cAsh = new THREE.Color(0x6a635c);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);

    const e = 4.0;
    const hx = terrainH(x + e, z) - terrainH(x - e, z);
    const hz = terrainH(x, z + e) - terrainH(x, z - e);
    const slope = Math.hypot(hx, hz) / (2 * e);

    const n = fbm2(x * 0.018 + 4, z * 0.018, 3) * 0.5 + 0.5;
    const macro = fbm2(x * 0.0035 + 17, z * 0.0035 - 5, 3) * 0.5 + 0.5;
    // moss belt only out to ~330 m (about half the previous grass area)
    const rn = Math.hypot(x, z) + fbm2(x * 0.0021 + 3, z * 0.0021 - 7, 3) * 150 + fbm2(x * 0.0085 - 2, z * 0.0085 + 5, 3) * 44 + fbm2(x * 0.026, z * 0.026, 2) * 9;
    const mossMask = 1 - smoothstep(106, 196, rn);
    tmp.copy(cMoss).lerp(cMossDry, clamp(n * 1.2 - 0.15, 0, 1));
    tmp.lerp(cDirt, (1 - mossMask) * 0.86);
tmp.multiplyScalar(1 - (1 - mossMask) * 0.16);
    tmp.multiplyScalar(0.84 + macro * 0.34);
    tmp.lerp(cDirt, clamp((0.52 - n) * 1.4, 0, 0.5));
    const rocky = clamp(smoothstep(0.28, 0.70, slope) + smoothstep(24, 100, h) * 0.7, 0, 1);
    tmp.lerp(cRock, rocky);
    tmp.lerp(cDark, clamp(smoothstep(90, 250, h) * 0.6, 0, 1));
    tmp.lerp(cAsh, clamp(smoothstep(250, 480, h) * 0.45, 0, 1));
    const inner = 1 - smoothstep(SET.pitR + 2, SET.pitR + 26, Math.hypot(x, z));
    if (inner > 0.002) tmp.lerp(new THREE.Color(0x8a5f3e), inner * 0.85);
    const patch = fbm2(x * 0.055 + 9, z * 0.055 - 3, 2);
    tmp.lerp(cDirt, clamp(patch * 0.45 - 0.06, 0, 0.22));
    tmp.multiplyScalar(0.92 + n * 0.2);

    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const groundMat = M.ground.clone();
  groundMat.vertexColors = true;
  const mesh = new THREE.Mesh(geo, groundMat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'ground';
  group.add(mesh);

  // modeled butte clusters are parked: the textured heightfield carries the range
  const SHOW_MODELED_CLIFFS = false;
  if (SHOW_MODELED_CLIFFS) group.add(buildCliffs(M));
  scene.add(group);
  return { group, mesh };
}

export function groundHeight(x, z) { return terrainH(x, z); }
