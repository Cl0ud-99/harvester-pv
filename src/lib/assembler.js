import * as THREE from 'three';
import { mergeList } from './util.js';

/** Collects geometry per material and merges into one mesh each — keeps draw calls low. */
export class Assembler {
  constructor(root, matMap) {
    this.root = root;
    this.mats = matMap;
    this.buckets = new Map();
    this.extras = [];
  }
  add(geo, matKey) {
    if (!geo) return this;
    let arr = this.buckets.get(matKey);
    if (!arr) { arr = []; this.buckets.set(matKey, arr); }
    arr.push(geo);
    return this;
  }
  /** Non-merged object (needs its own transform / material instances). */
  addMesh(obj) { this.extras.push(obj); return this; }
  finish({ cast = true, receive = true } = {}) {
    for (const [key, list] of this.buckets) {
      const mat = this.mats[key];
      if (!mat) { console.warn('[assembler] missing material', key); continue; }
      const g = mergeList(list);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = key;
      mesh.castShadow = cast && key !== 'ground';
      mesh.receiveShadow = receive;
      this.root.add(mesh);
    }
    this.extras.forEach((o) => this.root.add(o));
    this.buckets.clear();
    return this.root;
  }
}

/** Box oriented with its Y axis along a→b, flat face pointing away from the radial axis. */
export function armBox(a, b, w, h, off = 0) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return null;
  const y = dir.clone().normalize();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const rad = new THREE.Vector3(mid.x, 0, mid.z);
  if (rad.lengthSq() < 1e-5) rad.set(1, 0, 0);
  rad.normalize();
  let x = new THREE.Vector3().crossVectors(y, rad);
  if (x.lengthSq() < 1e-5) x.set(1, 0, 0);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const g = new THREE.BoxGeometry(w, len, h);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  g.applyMatrix4(m);
  if (off) g.translate(z.x * off, z.y * off, z.z * off);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** Quadratic bezier sampling. */
export function qbez(p0, p1, p2, t) {
  const a = 1 - t;
  return new THREE.Vector3(
    a * a * p0.x + 2 * a * t * p1.x + t * t * p2.x,
    a * a * p0.y + 2 * a * t * p1.y + t * t * p2.y,
    a * a * p0.z + 2 * a * t * p1.z + t * t * p2.z,
  );
}
