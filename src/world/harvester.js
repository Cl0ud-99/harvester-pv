import * as THREE from 'three';
import { Assembler } from '../lib/assembler.js';
import { chunk, tube, torus, mergeList, mulberry32, lerp, clamp, smoothstep } from '../lib/util.js';
import { loftRect, loftPoly } from '../lib/loft.js';
import { makeLavaMaterial } from './lava.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

export const H = {
  shoulder: 102,      // arms hinge off the column here
  petalTop: 194,      // arm tips
  crownTop: 214,
  coreTop: 220,
  petalR0: 17,
  petalR1: 92,
  logoY: 186,
};

/* four arms on the axes — the camera sits on a bisector and sees two wings */
const PETAL_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 3 / 2];

/* hard-edged arm profile: t, radius, tangential width, radial thickness */
const ARM_PROFILE = [
  [0.00, 16, 30, 18.0],
  [0.30, 40, 36, 17.0],
  [0.62, 64, 42, 15.5],
  [0.86, 82, 46, 14.0],
  [1.00, 92, 44, 13.0],
];

function chamferRing(w, t, c) {
  const hw = w / 2, ht = t / 2;
  const cc = Math.min(c, hw * 0.9, ht * 0.9);
  return [
    [-hw + cc, -ht], [hw - cc, -ht], [hw, -ht + cc], [hw, ht - cc],
    [hw - cc, ht], [-hw + cc, ht], [-hw, ht - cc], [-hw, -ht + cc],
  ];
}

function armPose(ang, t, inset = 0) {
  let k = 0;
  while (k < ARM_PROFILE.length - 2 && t > ARM_PROFILE[k + 1][0]) k++;
  const a = ARM_PROFILE[k], b = ARM_PROFILE[k + 1];
  const f = (t - a[0]) / (b[0] - a[0]);
  const r = lerp(a[1], b[1], f) + inset;
  const w = lerp(a[2], b[2], f);
  const th = lerp(a[3], b[3], f);
  const y = lerp(H.shoulder, H.petalTop, t);
  const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
  const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
  return { c: dir.clone().multiplyScalar(r).setY(y), right, up: dir, w, t: th, r };
}

function armSection(ang, t, inset, wScale = 1, tScale = 1) {
  const p = armPose(ang, t, inset);
  const ring = chamferRing(p.w * wScale, p.t * tScale, Math.min(p.w, p.t) * 0.22).map(
    ([a, b]) => p.right.clone().multiplyScalar(a).addScaledVector(p.up, b),
  );
  return { c: p.c, ring };
}

function armGeo(ang, inset, wScale, tScale, segs = 12) {
  const secs = [];
  for (let i = 0; i <= segs; i++) secs.push(armSection(ang, i / segs, inset, wScale, tScale));
  return loftPoly(secs, { uScale: 0.55, vScale: 0.05 });
}

export function createHarvester(M, scene) {
  const root = new THREE.Group();
  root.name = 'harvester';
  const A = new Assembler(root, M);
  const rnd = mulberry32(77);

  /* ---------------- arms ---------------- */
  const armsOuter = [], armsInner = [], edges = [], spines = [], slots = [];

  for (const ang of PETAL_ANGLES) {
    armsOuter.push(armGeo(ang, 0, 1, 1, 14));
    armsInner.push(armGeo(ang, -13.0, 0.72, 0.8, 12));

    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));

    // raised spine rib along the outer face
    for (let i = 0; i < 9; i++) {
      const t0 = i / 9, t1 = (i + 1) / 9;
      const p0 = armPose(ang, t0), p1 = armPose(ang, t1);
      const g = loftRect([
        { c: p0.c.clone().addScaledVector(dir, p0.t * 0.5), right, up: dir, w: 7.0, t: 1.8 },
        { c: p1.c.clone().addScaledVector(dir, p1.t * 0.5), right, up: dir, w: 7.0, t: 1.8 },
      ]);
      if (g) spines.push(g);
    }

    // blue trim strips on both leading edges
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const t0 = i / 9, t1 = (i + 1) / 9;
        const p0 = armPose(ang, t0), p1 = armPose(ang, t1);
        const o0 = right.clone().multiplyScalar(s * (p0.w / 2 - 1.6)).addScaledVector(dir, p0.t * 0.5 - 1.2);
        const o1 = right.clone().multiplyScalar(s * (p1.w / 2 - 1.6)).addScaledVector(dir, p1.t * 0.5 - 1.2);
        const g = loftRect([
          { c: p0.c.clone().add(o0), right, up: dir, w: 3.0, t: 1.6 },
          { c: p1.c.clone().add(o1), right, up: dir, w: 3.0, t: 1.6 },
        ]);
        if (g) edges.push(g);
      }
    }

    // recessed vents
    for (let k = 0; k < 10; k++) {
      const t = 0.10 + k * 0.055;
      const p = armPose(ang, t);
      const c = p.c.clone().addScaledVector(dir, p.t * 0.52);
      const g = chunk(p.w * 0.52, 0.85, 0.55);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
      g.translate(c.x, c.y, c.z);
      slots.push(g);
    }
  }
  A.add(mergeList(armsOuter), 'armour');
  /* ---- second armour skin: an outer plate offset from the main beam ---- */
  const skinGeos = [], seamPosts = [];
  for (const ang of PETAL_ANGLES) {
    skinGeos.push(armGeo(ang, 1.15, 1.05, 0.60, 12));

    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    for (let k = 1; k < 5; k++) {
      const p = armPose(ang, k / 5);
      for (const sd of [-1, 1]) {
        const c = p.c.clone().addScaledVector(right, sd * p.w * 0.46).addScaledVector(dir, p.t * 0.5);
        const g = chunk(1.1, 3.2, 2.4);
        g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
        g.translate(c.x, c.y, c.z);
        seamPosts.push(g);
      }
    }
  }
  A.add(mergeList(skinGeos), 'armourDirty');
  A.add(mergeList(seamPosts), 'darkSteel');

  A.add(mergeList(armsInner), 'armourDirty');
  A.add(mergeList(edges), 'armourBlue');
  A.add(mergeList(spines), 'armour');
  A.add(mergeList(slots), 'darkSteel');

  /* ---------------- rust truss between the plates ---------------- */
  const truss = [];
  for (const ang of PETAL_ANGLES) {
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const SEG = 10;
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG, t1 = (i + 1) / SEG;
      const a = armPose(ang, t0), b = armPose(ang, t1);
      const a2 = armPose(ang, t0, -12.0), b2 = armPose(ang, t1, -12.0);

      for (const s of [-1, 1]) {
        const p1 = a.c.clone().addScaledVector(right, s * a.w * 0.42);
        const p2 = b2.c.clone().addScaledVector(right, s * b2.w * 0.34);
        const p3 = b.c.clone().addScaledVector(right, s * b.w * 0.42);
        const p4 = a2.c.clone().addScaledVector(right, s * a2.w * 0.34);
        truss.push(tube(p1, p2, 0.55, 0.55, 5));
        truss.push(tube(p3, p4, 0.55, 0.55, 5));
        truss.push(tube(p1, p3, 0.6, 0.6, 5));
        truss.push(tube(p4, p2, 0.5, 0.5, 5));
      }
      truss.push(tube(
        a.c.clone().addScaledVector(right, -a.w * 0.42).addScaledVector(dir, 2),
        b2.c.clone().addScaledVector(right, b2.w * 0.34),
        0.3, 0.3, 4,
      ));
    }
  }
  A.add(mergeList(truss), 'copper');

  /* ---------------- molten core ---------------- */
  const coreMat = makeLavaMaterial({ vertical: true, scale: 1.0, flow: 0.12, hot: 0xfff4d8, mid: 0xff6a16, cool: 0x8f1c02 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 9.6, H.coreTop + 52, 40, 1, true), coreMat);
  core.position.y = (H.coreTop - 42) / 2;
  core.name = 'moltenCore';
  root.add(core);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3;
    const f = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6 + rnd() * 0.5, 0.6, H.coreTop - 24, 5, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    f.position.set(Math.cos(a) * 7.6, (H.coreTop - 24) / 2, Math.sin(a) * 7.6);
    root.add(f);
  }

  const cage = [];
  for (let y = -40; y < H.crownTop; y += 9.0) {
    const t2 = torus(lerp(17.0, 14.6, y / H.crownTop), 0.42, 44, 6);
    t2.rotateX(Math.PI / 2);
    t2.translate(0, y, 0);
    cage.push(t2);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    cage.push(tube(V(Math.cos(a) * 16.8, -42, Math.sin(a) * 16.8), V(Math.cos(a) * 14.4, H.crownTop, Math.sin(a) * 14.4), 0.5, 0.38, 5));
    for (let k = 0; k < 5; k++) {
      const y0 = -36 + k * 30;
      const a2 = a + 0.42;
      cage.push(tube(V(Math.cos(a) * 16.6, y0, Math.sin(a) * 16.6), V(Math.cos(a2) * 15.2, y0 + 30, Math.sin(a2) * 15.2), 0.3, 0.3, 4));
    }
  }
  A.add(mergeList(cage), 'copperDark');

  /* ---------------- column ---------------- */
  // skirt that carries the armoured column down into the molten pool
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(15.4, 17.2, 46, 8, 1, false),
    M.armourDirty,
  );
  skirt.rotation.y = Math.PI / 8;
  skirt.position.y = -23;
  skirt.castShadow = true; skirt.receiveShadow = true;
  root.add(skirt);

  const colGeos = [], colTrim = [], colVents = [];
  const COL_SEG = 12;
  for (let i = 0; i < COL_SEG; i++) {
    const t = i / COL_SEG;
    const y0 = lerp(-6, H.shoulder, t);
    const y1 = lerp(-6, H.shoulder, (i + 1) / COL_SEG);
    const r0 = lerp(15.5, 14.0, t);
    const r1 = lerp(15.5, 14.0, (i + 1) / COL_SEG);
    const blk = new THREE.CylinderGeometry(r1, r0, y1 - y0 - 0.7, 8, 1, false);
    blk.rotateY(Math.PI / 8);
    blk.translate(0, (y0 + y1) / 2, 0);
    colGeos.push(blk);
    const ring = new THREE.CylinderGeometry(r0 + 0.14, r0 + 0.14, 0.5, 8, 1, true);
    ring.rotateY(Math.PI / 8);
    ring.translate(0, y0 + 0.12, 0);
    colTrim.push(ring);
  }
  A.add(mergeList(colGeos), 'armour');
  A.add(mergeList(colTrim), 'armourBlue');

  for (const ang of PETAL_ANGLES) {
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    // full-height vertical ribs: hard-surface spine, not windows
    for (const s of [-1, 0, 1]) {
      const c = dir.clone().multiplyScalar(21.0).addScaledVector(right, s * 6.2);
      const g = new THREE.BoxGeometry(2.2, 150, 1.6);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
      g.translate(c.x, 19, c.z);
      colVents.push(g);
    }
    // inset dark panel band with a single vertical shade band
    const pnl = new THREE.BoxGeometry(9.0, 62, 0.7);
    pnl.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
    pnl.translate(dir.x * 21.0, 58, dir.z * 21.0);
    colVents.push(pnl);
  }
  A.add(mergeList(colVents), 'darkSteel');

  /* collar under the arm hinge */
  const collar = [];
  const c1 = new THREE.CylinderGeometry(21.0, 19.5, 9.0, 8, 1, false);
  c1.rotateY(Math.PI / 8); c1.translate(0, H.shoulder + 2.0, 0); collar.push(c1);
  const c2 = new THREE.CylinderGeometry(23.5, 23.5, 2.0, 8, 1, false);
  c2.rotateY(Math.PI / 8); c2.translate(0, H.shoulder - 2.6, 0); collar.push(c2);
  A.add(mergeList(collar), 'armourDirty');

  const shoulderTrim = new THREE.CylinderGeometry(21.4, 21.4, 1.4, 8, 1, true);
  shoulderTrim.rotateY(Math.PI / 8); shoulderTrim.translate(0, H.shoulder + 4.0, 0);
  A.add(shoulderTrim, 'armourBlue');

  const mach = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    mach.push(chunk(3.0, 4.0, 2.6, Math.cos(a) * 22.0, H.shoulder - 5.4, Math.sin(a) * 22.0, -a));
    if (i % 3 === 0) mach.push(tube(V(Math.cos(a) * 23.8, H.shoulder - 7.0, Math.sin(a) * 23.8), V(Math.cos(a) * 23.8, H.shoulder - 1.4, Math.sin(a) * 23.8), 0.38, 0.38, 6));
  }
  A.add(mergeList(mach), 'steel');

  /* ---------------- crown drum ---------------- */
  const crownProfile = [[150, 20.0], [156, 30.0], [168, 52.0], [182, 58.0], [194, 56.0], [202, 40.0], [208, 24.0]];
  const crownSecs = crownProfile.map(([y, r]) => {
    const ring = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ring.push(V(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return { c: V(0, y, 0), ring };
  });
  A.add(loftPoly(crownSecs, { uScale: 0.35, vScale: 0.06 }), 'armour');

  const brow = [];
  for (const [y, r, hh] of [[153.0, 21.0, 2.2], [170.0, 54.0, 1.6]]) {
    const g = new THREE.CylinderGeometry(r, r, hh, 8, 1, true);
    g.rotateY(Math.PI / 8); g.translate(0, y, 0);
    brow.push(g);
  }
  A.add(mergeList(brow), 'armourBlue');

  // logo faces
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const yaw = Math.atan2(dir.x, dir.z);

    const plate = new THREE.PlaneGeometry(46.0, 30.0);
    plate.rotateY(yaw);
    plate.translate(dir.x * 40.0, H.logoY, dir.z * 40.0);
    A.add(plate, 'armourDirty');

    const logo = new THREE.PlaneGeometry(20.0, 20.0);
    logo.rotateY(yaw);
    logo.translate(dir.x * 40.4, H.logoY + 1.5, dir.z * 40.4);
    const mesh = new THREE.Mesh(logo, M.logo);
    mesh.renderOrder = 3;
    root.add(mesh);
  }

  // canopy beams joining adjacent arm tips (the "roll cage")
  const canopy = [];
  for (let i = 0; i < 4; i++) {
    const a0 = PETAL_ANGLES[i], a1 = PETAL_ANGLES[(i + 1) % 4];
    const p0 = V(Math.cos(a0) * 88, H.petalTop - 8, Math.sin(a0) * 88);
    const p1 = V(Math.cos(a1) * 88, H.petalTop - 8, Math.sin(a1) * 88);
    canopy.push(tube(p0, p1, 2.2, 2.2, 6));
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    canopy.push(tube(mid, V(0, H.petalTop - 2, 0), 1.5, 1.5, 5));
  }
  A.add(mergeList(canopy), 'armourDirty');

  const hub = new THREE.CylinderGeometry(12.0, 15.2, 6.0, 8, 1, false);
  hub.rotateY(Math.PI / 8); hub.translate(0, 216.0, 0);
  A.add(hub, 'armour');
  const hub2 = new THREE.CylinderGeometry(7.0, 10.0, 6.6, 8, 1, false);
  hub2.rotateY(Math.PI / 8); hub2.translate(0, 221.5, 0);
  A.add(hub2, 'darkSteel');

  const masts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4;
    masts.push(tube(V(Math.cos(a) * 8.0, 222, Math.sin(a) * 8.0), V(Math.cos(a) * 12.5, 258 + (i % 3) * 7, Math.sin(a) * 12.5), 0.18, 0.06, 5));
  }
  A.add(mergeList(masts), 'steel');

  /* ---------------- beam ---------------- */
  const beamGroup = new THREE.Group();
  beamGroup.name = 'beam';
  beamGroup.position.y = 226;
  root.add(beamGroup);

  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffb066) }, uOpacity: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN;
      void main(){ vUv=uv; vN=normalize(normalMatrix*normal);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `precision highp float; varying vec2 vUv; varying vec3 vN;
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
      float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
      float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y);}
      void main(){
        float edge = pow(abs(vN.x)*0.5+0.5, 1.6);
        float streak = n2(vec2(vUv.y*4.0 - uTime*2.4, vUv.x*6.0)) * 0.5 + 0.5;
        float flick = 0.85 + 0.15*sin(uTime*13.0 + vUv.y*11.0);
        vec3 c = mix(vec3(1.0,0.99,0.94), uColor, clamp(vUv.y*2.2,0.0,1.0));
        gl_FragColor = vec4(c * (0.9 + streak*0.7) * flick, uOpacity * edge);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });

  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.8, 1600, 24, 1, true), beamMat);
  beamCore.position.y = 800;
  beamCore.frustumCulled = false;
  beamGroup.add(beamCore);

  const beamGlowMat = beamMat.clone();
  beamGlowMat.uniforms = THREE.UniformsUtils.clone(beamMat.uniforms);
  beamGlowMat.uniforms.uOpacity.value = 0.30;
  const beamGlow = new THREE.Mesh(new THREE.CylinderGeometry(9.0, 18.0, 1600, 24, 1, true), beamGlowMat);
  beamGlow.position.y = 800;
  beamGlow.frustumCulled = false;
  beamGroup.add(beamGlow);

  const beamHalo = new THREE.Mesh(
    new THREE.CylinderGeometry(46, 24, 1600, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beamHalo.position.y = 800;
  beamHalo.frustumCulled = false;
  beamGroup.add(beamHalo);

  /* ---------------- diagonal braces to the deck ---------------- */
  const braceWhite = [], braceDark = [], bracePipes = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const top = dir.clone().multiplyScalar(15).setY(H.shoulder + 4);
    const bot = dir.clone().multiplyScalar(64).setY(2.5);
    const mid = top.clone().add(bot).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), top.clone().sub(bot).normalize());

    const g = new THREE.BoxGeometry(11.0, top.distanceTo(bot), 5.4);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    g.translate(mid.x, mid.y, mid.z);
    braceWhite.push(g);

    const g2 = new THREE.BoxGeometry(4.4, top.distanceTo(bot) * 0.94, 7.6);
    g2.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    g2.translate(mid.x - dir.x * 3.4, mid.y, mid.z - dir.z * 3.4);
    braceDark.push(g2);

    bracePipes.push(tube(dir.clone().multiplyScalar(16).setY(H.shoulder + 2), dir.clone().multiplyScalar(62).setY(4.0), 1.0, 1.0, 8));
  }
  A.add(mergeList(braceWhite), 'armourDirty');
  A.add(mergeList(braceDark), 'darkSteel');
  A.add(mergeList(bracePipes), 'yellowPipe');

  /* ---------------- practicals ---------------- */
  const coreLight = new THREE.PointLight(0xff7a2a, 180, 420, 2.0);
  coreLight.position.set(0, 140, 0);
  root.add(coreLight);

  const crownLight = new THREE.PointLight(0xffa050, 200, 400, 2.0);
  crownLight.position.set(0, 200, 0);
  root.add(crownLight);

  const beamLight = new THREE.PointLight(0xffb070, 360, 800, 1.8);
  beamLight.position.set(0, 260, 0);
  root.add(beamLight);

  A.finish();
  scene.add(root);

  return {
    group: root, coreMat, coreLight, crownLight, beamLight, beamGroup,
    update(dt, t) {
      coreMat.uniforms.uTime.value = t;
      beamMat.uniforms.uTime.value = t;
      beamGlowMat.uniforms.uTime.value = t * 1.3;
      const f = 0.9 + Math.sin(t * 3.1) * 0.045 + Math.sin(t * 9.7) * 0.025;
      coreLight.intensity = 180 * f;
      crownLight.intensity = 200 * f;
      beamLight.intensity = 360 * (0.94 + Math.sin(t * 2.3) * 0.06);
    },
  };
}
