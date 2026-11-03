import * as THREE from 'three';

/** Triangle soup → signed volume. Negative means inward-facing winding. */
function signedVolume(arr) {
  let v = 0;
  for (let i = 0; i < arr.length; i += 9) {
    const ax = arr[i], ay = arr[i + 1], az = arr[i + 2];
    const bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5];
    const cx = arr[i + 6], cy = arr[i + 7], cz = arr[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

function flipTris(arr) {
  for (let i = 0; i < arr.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = arr[i + 3 + k];
      arr[i + 3 + k] = arr[i + 6 + k];
      arr[i + 6 + k] = t;
    }
  }
  return arr;
}

function finish(arr, uv) {
  if (signedVolume(arr) < 0) flipTris(arr);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Loft a chain of rectangular cross-sections into a solid plate.
 * section = { c: Vector3, right: Vector3(unit, width axis), up: Vector3(unit, thickness axis), w, t }
 */
export function loftRect(sections, { capStart = true, capEnd = true, uScale = 0.12, vScale = 0.12 } = {}) {
  const pos = [];
  const uv = [];
  const n = sections.length;
  if (n < 2) return null;

  const corner = (s, i) => {
    const sw = s.w * 0.5, st = s.t * 0.5;
    const sx = (i === 0 || i === 1) ? 1 : -1;
    const sy = (i < 2) ? -1 : 1;
    return new THREE.Vector3().copy(s.c)
      .addScaledVector(s.right, sx * sw)
      .addScaledVector(s.up, sy * st);
  };

  let len = 0;
  for (let k = 0; k < n - 1; k++) {
    const a = sections[k], b = sections[k + 1];
    const seg = a.c.distanceTo(b.c);
    for (let i = 0; i < 4; i++) {
      const i2 = (i + 1) % 4;
      const p00 = corner(a, i), p01 = corner(a, i2);
      const p10 = corner(b, i), p11 = corner(b, i2);
      pos.push(p00.x, p00.y, p00.z, p01.x, p01.y, p01.z, p11.x, p11.y, p11.z);
      pos.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z, p10.x, p10.y, p10.z);
      const v0 = len * vScale, v1 = (len + seg) * vScale;
      const u0 = i * a.w * uScale, u1 = (i + 1) * a.w * uScale;
      const u2 = i * b.w * uScale, u3 = (i + 1) * b.w * uScale;
      uv.push(u0, v0, u1, v0, u3, v1);
      uv.push(u0, v0, u3, v1, u2, v1);
    }
    len += seg;
  }

  const cap = (s) => {
    const p0 = corner(s, 0), p1 = corner(s, 1), p2 = corner(s, 2), p3 = corner(s, 3);
    pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    pos.push(p0.x, p0.y, p0.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };
  if (capStart) cap(sections[0]);
  if (capEnd) cap(sections[n - 1]);

  return finish(pos, uv);
}

/** Loft a chain of equal-length polygon rings. section = { c, ring } */
export function loftPoly(sections, { capStart = true, capEnd = true, uScale = 0.1, vScale = 0.1 } = {}) {
  const pos = [], uv = [];
  const n = sections.length;
  if (n < 2) return null;
  const m = sections[0].ring.length;
  let len = 0;
  for (let k = 0; k < n - 1; k++) {
    const a = sections[k], b = sections[k + 1];
    const seg = a.c.distanceTo(b.c);
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const p00 = a.ring[i].clone().add(a.c);
      const p01 = a.ring[j].clone().add(a.c);
      const p10 = b.ring[i].clone().add(b.c);
      const p11 = b.ring[j].clone().add(b.c);
      pos.push(p00.x, p00.y, p00.z, p01.x, p01.y, p01.z, p11.x, p11.y, p11.z);
      pos.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z, p10.x, p10.y, p10.z);
      const u0 = (i / m) * uScale * 10, u1 = ((i + 1) / m) * uScale * 10;
      const v0 = len * vScale, v1 = (len + seg) * vScale;
      uv.push(u0, v0, u1, v0, u1, v1);
      uv.push(u0, v0, u1, v1, u0, v1);
    }
    len += seg;
  }
  const cap = (s) => {
    for (let i = 1; i < m - 1; i++) {
      const p0 = s.ring[0].clone().add(s.c), p1 = s.ring[i].clone().add(s.c), p2 = s.ring[i + 1].clone().add(s.c);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      uv.push(0, 0, 1, 0, 1, 1);
    }
  };
  if (capStart) cap(sections[0]);
  if (capEnd) cap(sections[n - 1]);

  return finish(pos, uv);
}

/** Flat regular polygon ring in local XZ. */
export function polyRing(r, n, rot = 0, ry = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    pts.push(new THREE.Vector3(Math.cos(a) * r, ry, Math.sin(a) * r));
  }
  return pts;
}
