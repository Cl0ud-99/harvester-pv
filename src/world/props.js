import * as THREE from 'three';
import { Assembler } from '../lib/assembler.js';
import { chunk, tube, torus, mergeList, mulberry32, lerp, box } from '../lib/util.js';
import { terrainH } from './terrain.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 *  A docked Hammond Robotics field module (the white/blue hull)
 * ------------------------------------------------------------------ */
function moduleHull(M, len = 46, wid = 14, hgt = 11) {
  const g = new THREE.Group();
  const A = new Assembler(g, M);

  const white = [], dirty = [], blue = [], dark = [], glass = [], red = [], yellow = [];

  // main body — a chamfered slab with a slightly domed roof
  const body = chunk(wid, hgt, len);
  white.push(body);

  // roof cap, inset
  white.push(chunk(wid * 0.94, 0.9, len * 0.96, 0, hgt / 2 + 0.35, 0));

  // blue skirt band
  blue.push(chunk(wid * 1.005, hgt * 0.26, len * 0.999, 0, -hgt / 2 + hgt * 0.13, 0));

  // dark base / undercarriage
  dark.push(chunk(wid * 0.92, 1.6, len * 0.9, 0, -hgt / 2 - 0.7, 0));

  // window band along both long sides
  for (const s of [-1, 1]) {
    glass.push(chunk(0.35, 2.2, len * 0.62, (wid / 2) * s * 0.99, hgt * 0.18, -len * 0.06));
    // frame above the glass
    dirty.push(chunk(0.55, 0.55, len * 0.68, (wid / 2) * s * 0.97, hgt * 0.18 + 1.35, -len * 0.06));
    // blue underline
    blue.push(chunk(0.42, 0.5, len * 0.7, (wid / 2) * s * 0.98, hgt * 0.18 - 1.3, -len * 0.06));
  }

  // end bulkhead with double doors
  for (const s of [-1, 1]) {
    red.push(chunk(wid * 0.32, hgt * 0.52, 0.4, 0, -hgt * 0.12, (len / 2) * s * 0.995));
    dark.push(chunk(wid * 0.40, hgt * 0.58, 0.3, 0, -hgt * 0.10, (len / 2) * s * 0.985));
    // hazard frame
    yellow.push(chunk(wid * 0.36, 0.3, 0.35, 0, -hgt * 0.12 + hgt * 0.30, (len / 2) * s * 0.99));
  }

  // roof greebles
  const rnd = mulberry32(31);
  for (let i = 0; i < 9; i++) {
    const zz = -len * 0.4 + rnd() * len * 0.8;
    const xx = (rnd() - 0.5) * wid * 0.55;
    const s = 1.2 + rnd() * 2.6;
    dark.push(chunk(s, 0.7 + rnd() * 0.9, s * 1.5, xx, hgt / 2 + 1.0, zz));
  }
  // a dish
  const dish = new THREE.CylinderGeometry(1.5, 0.4, 0.35, 14, 1, false);
  dish.rotateX(0.7);
  dish.translate(wid * 0.22, hgt / 2 + 1.8, -len * 0.30);
  white.push(dish);

  // landing skids
  for (const s of [-1, 1]) {
    for (const zz of [-len * 0.32, len * 0.32]) {
      dark.push(chunk(2.6, 1.1, 3.0, (wid / 2 + 2.0) * s, -hgt / 2 - 1.6, zz));
      dark.push(tube(
        new THREE.Vector3((wid / 2 + 2.0) * s, -hgt / 2 - 1.2, zz),
        new THREE.Vector3((wid / 2) * s, -hgt / 2 + 1.2, zz),
        0.28, 0.28, 6,
      ));
    }
  }

  // hull ribs along the length
  for (let i = -5; i <= 5; i++) {
    const zz = (i / 5) * len * 0.45;
    for (const s of [-1, 1]) {
      dirty.push(chunk(0.55, hgt * 0.7, 0.9, (wid / 2) * s * 0.98, hgt * 0.02, zz));
    }
  }

  A.add(mergeList(white), 'armour');
  // door frames + hinges
  for (const sd of [-1, 1]) {
    const zf = (len / 2) * sd * 1.004;
    const dw = wid * 0.34, dh = hgt * 0.55, fy = -hgt * 0.12;
    dark.push(chunk(dw + 0.9, 0.45, 0.5, 0, fy + dh / 2, zf));
    dark.push(chunk(dw + 0.9, 0.45, 0.5, 0, fy - dh / 2, zf));
    dark.push(chunk(0.45, dh, 0.5, -dw / 2 - 0.2, fy, zf));
    dark.push(chunk(0.45, dh, 0.5, dw / 2 + 0.2, fy, zf));
    for (const hy of [-0.28, 0.28]) {
      const c = new THREE.CylinderGeometry(0.15, 0.15, 0.75, 8, 1, false);
      c.rotateZ(Math.PI / 2);
      c.translate(-dw / 2 - 0.05, fy + hy * dh, zf + 0.3 * sd);
      yellow.push(c);
    }
  }

  // corrugated skirt ribs along both flanks
  for (let i = -7; i <= 7; i++) {
    const zz = (i / 7) * len * 0.44;
    for (const sd of [-1, 1]) {
      dirty.push(chunk(0.5, 1.7, 0.75, (wid / 2) * sd * 1.012, -hgt * 0.35, zz));
    }
  }

  A.add(mergeList(dirty), 'armourDirty');
  A.add(mergeList(blue), 'armourBlue');
  A.add(mergeList(dark), 'darkSteel');
  A.add(mergeList(glass), 'glass');
  A.add(mergeList(red), 'red');
  A.add(mergeList(yellow), 'yellowTrim');
  A.finish();
  return g;
}

/* ------------------------------------------------------------------ *
 *  Ground props around the station
 * ------------------------------------------------------------------ */
export function createProps(M, scene) {
  const root = new THREE.Group();
  root.name = 'props';
  const rnd = mulberry32(1234);
  const A = new Assembler(root, M);

  const gy = (x, z) => terrainH(x, z);

  /* --- the docked field modules --- */
  const mods = [
    { x: 90, z: 44, ry: -2.24, len: 46, wid: 14, hgt: 11 },
    { x: 98, z: 14, ry: -2.05, len: 26, wid: 11, hgt: 9 },
    { x: -76, z: 74, ry: 0.85, len: 22, wid: 10, hgt: 8 },
  ];
  for (const m of mods) {
    const hull = moduleHull(M, m.len, m.wid, m.hgt);
    hull.position.set(m.x, gy(m.x, m.z) + m.hgt / 2 + 1.9, m.z);
    hull.rotation.y = m.ry;
    root.add(hull);
  }

  /* --- red beacon sphere on a mast --- */
  const bx = -46, bz = 128;
  const mastH = 30;
  const mast = [];
  mast.push(tube(new THREE.Vector3(bx, gy(bx, bz) - 2, bz), new THREE.Vector3(bx, gy(bx, bz) + mastH, bz), 0.34, 0.18, 8));
  mast.push(tube(new THREE.Vector3(bx - 4, gy(bx, bz) + mastH * 0.55, bz), new THREE.Vector3(bx + 4, gy(bx, bz) + mastH * 0.55, bz), 0.16, 0.16, 6));
  for (let i = 0; i < 5; i++) {
    mast.push(tube(
      new THREE.Vector3(bx, gy(bx, bz) + 2 + i * 6, bz),
      new THREE.Vector3(bx, gy(bx, bz) + 2 + i * 6 + 3, bz + 2.4),
      0.10, 0.10, 4,
    ));
  }
  A.add(mergeList(mast), 'steel');

  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 20, 14),
    new THREE.MeshPhysicalMaterial({ color: 0xd8402a, roughness: 0.42, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.3 }),
  );
  balloon.position.set(bx, gy(bx, bz) + mastH + 1.6, bz);
  balloon.castShadow = true;
  root.add(balloon);

  const beaconLight = new THREE.PointLight(0xff3a20, 6, 40, 2.0);
  beaconLight.position.copy(balloon.position);
  root.add(beaconLight);

  /* --- cargo containers + crates on the ground --- */
  const cWhite = [], cBlue = [], cRust = [], cYellow = [], cRed = [];
  const groundProps = (radiusMin, radiusMax, count) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * TAU;
      const r = radiusMin + rnd() * (radiusMax - radiusMin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = gy(x, z);
      const kind = rnd();
      const s = 1.8 + rnd() * 1.8;
      const ry = rnd() * TAU;
      if (kind < 0.4) {
        const g = chunk(s * 2.4, s, s * 1.1, x, y + s * 0.5, z, ry);
        (kind < 0.2 ? cWhite : cBlue).push(g);
      } else if (kind < 0.68) {
        const g = chunk(s, s * 0.8, s, x, y + s * 0.4, z, ry);
        (kind < 0.56 ? cRust : cYellow).push(g);
      } else if (kind < 0.82) {
        const c = new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.9, 12, 1, false);
        c.translate(x, y + s * 0.45, z);
        cRust.push(c);
      } else {
        cRed.push(chunk(s * 1.6, s * 0.5, s * 1.2, x, y + s * 0.25, z, ry));
      }
    }
  };
  groundProps(104, 150, 30);
  A.add(mergeList(cWhite), 'armour');
  A.add(mergeList(cBlue), 'armourBlue');
  A.add(mergeList(cRust), 'rust');
  A.add(mergeList(cYellow), 'armourDirty');
  A.add(mergeList(cRed), 'rust');

  /* --- a service gantry / pipe run along the ground --- */
  const pipes = [], pylons = [];
  for (let i = 0; i < 26; i++) {
    const a0 = lerp(0.9, 3.9, i / 26);
    const a1 = lerp(0.9, 3.9, (i + 1) / 26);
    const r = 116;
    const p0 = new THREE.Vector3(Math.cos(a0) * r, gy(Math.cos(a0) * r, Math.sin(a0) * r) + 1.6, Math.sin(a0) * r);
    const p1 = new THREE.Vector3(Math.cos(a1) * r, gy(Math.cos(a1) * r, Math.sin(a1) * r) + 1.6, Math.sin(a1) * r);
    pipes.push(tube(p0, p1, 0.42, 0.42, 8));
    if (i % 3 === 0) {
      pylons.push(chunk(0.9, 2.4, 0.9, p0.x, p0.y - 1.1, p0.z, -a0));
    }
  }
  A.add(mergeList(pipes), 'steel');
  A.add(mergeList(pylons), 'darkSteel');

  /* --- a few boulders close to the deck for foreground framing --- */
  A.finish();
  scene.add(root);

  return {
    group: root,
    balloon, beaconLight,
    update(dt, t) {
      beaconLight.intensity = 6 + Math.sin(t * 2.0) * 4.5;
    },
  };
}
