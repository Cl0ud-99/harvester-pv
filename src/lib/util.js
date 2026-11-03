import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export { THREE, mergeGeometries };

/* ---------------- math ---------------- */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- gradient noise ---------------- */
const P = new Uint8Array(512);
(function () {
  const r = mulberry32(1337);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad2 = (h, x, y) => {
  switch (h & 3) {
    case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y;
  }
};
export function noise2(x, y) {
  const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = P[P[xi] + yi], ab = P[P[xi] + yi + 1], ba = P[P[xi + 1] + yi], bb = P[P[xi + 1] + yi + 1];
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v) * 0.7071;
}
export function fbm2(x, y, oct = 4, lac = 2.0, gain = 0.5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= lac; a *= gain; }
  return s;
}
export function ridged2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(noise2(x * f, y * f))); f *= 2.03; a *= 0.5; }
  return s;
}

/* ---------------- geometry helpers ---------------- */
export function jitter(geo, amp = 0.1, freq = 1, seed = 0) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm2(v.x * freq + seed, v.z * freq - seed, 3) + 0.4 * noise2(v.y * freq * 1.7 + seed * 3, v.x * freq);
    v.multiplyScalar(1 + n * amp);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function mergeList(list) {
  const clean = list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
  if (!clean.length) return null;
  const g = mergeGeometries(clean, false);
  clean.forEach((x) => x.dispose());
  if (!g) console.warn('[merge] failed for', clean.length, 'geoms');
  return g;
}

/* unit chamfered box hull, built once */
let _unitChunk = null;
function unitChunk() {
  if (_unitChunk) return _unitChunk;
  const cut = 0.13, hw = 0.5, hh = 0.5, hd = 0.5;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * (hw - cut), sy * hh, sz * hd));
    pts.push(new THREE.Vector3(sx * hw, sy * (hh - cut), sz * hd));
    pts.push(new THREE.Vector3(sx * hw, sy * hh, sz * (hd - cut)));
  }
  _unitChunk = new ConvexGeometry(pts);
  return _unitChunk;
}

/** Planar box-projection UVs for hull geometries that come without them. */
export function boxUV(geo, scale = 0.25, ox = 0, oz = 0) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!nor) geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nx && ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale + 0.5 + ox;
    uv[i * 2 + 1] = v * scale + 0.5 + oz;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** A chunky bevelled box — the workhorse of Apex hard-surface. */
export function chunk(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const g = unitChunk().clone();
  g.scale(w, h, d);
  boxUV(g, 0.19);
  if (ry) g.rotateY(ry);
  if (x || y || z) g.translate(x, y, z);
  return g;
}

/** Cylinder-ish chunky prism (n-gon), bevel-free but faceted like Apex panels. */
export function prism(r, h, n = 8, rot = 0) {
  const g = new THREE.CylinderGeometry(r, r, h, n, 1, false);
  if (rot) g.rotateY(rot);
  return g;
}

export function box(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** Box stretched between two points (long axis = Y by construction). */
export function beam(a, b, w, d = w) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.BoxGeometry(w, len, d);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

/** Cylinder between two points. */
export function tube(a, b, r1, r2 = r1, seg = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

export function torus(r, t, seg = 48, tubeSeg = 8) {
  return new THREE.TorusGeometry(r, t, tubeSeg, seg);
}

export function cyl(rt, rb, h, seg = 24, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}

/** Annular ring slab (flat, facing +Y). */
export function ringSlab(rIn, rOut, h, seg = 96) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  g.translate(0, h, 0);
  return g;
}

export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

export function mergeInto(parent, geos, material, name = 'merged') {
  const g = mergeList(geos);
  if (!g) return null;
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Simple LOD-free instanced scatter. */
export function instanced(geo, mat, transforms, cast = true) {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  const m = new THREE.Matrix4();
  transforms.forEach((t, i) => { m.compose(t.p, t.q || new THREE.Quaternion(), t.s || new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = cast; im.receiveShadow = true;
  return im;
}
