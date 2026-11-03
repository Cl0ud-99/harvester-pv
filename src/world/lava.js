import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  LAVA / MOLTEN CORE — animated emissive shader
 * ------------------------------------------------------------------ */
const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform sampler2D tNoise;
uniform float uTime;
uniform vec3 uHot, uMid, uCool, uCrust;
uniform float uFlow, uScale, uVertical;
#include <fog_pars_fragment>

void main(){
  vec2 uv = uVertical > 0.5
    ? vec2(vUv.x * uScale, vUv.y * uScale * 0.12)
    : vUv * uScale + vWorld.xz * 0.012;
  uv.y -= uTime * uFlow;

  vec3 a = texture2D(tNoise, uv).rgb;
  vec3 b = texture2D(tNoise, uv * 2.6 + vec2(0.31, 0.17) - vec2(0.0, uTime * uFlow * 0.8)).rgb;
  vec3 c = texture2D(tNoise, uv * 0.55 + vec2(0.11, 0.43)).rgb;

  float heat = a.r * 0.52 + b.g * 0.30 + c.b * 0.18;
  heat = smoothstep(0.26, 0.80, heat);

  float crust = smoothstep(0.44, 0.74, c.b * 0.6 + a.r * 0.4);
  float seam = smoothstep(0.52, 0.88, b.g) * (1.0 - smoothstep(0.25, 0.55, a.r));

  vec3 col = mix(uCool, uMid, smoothstep(0.02, 0.45, heat));
  col = mix(col, uHot, smoothstep(0.45, 1.0, heat));
  col = mix(col, uCrust, crust * 0.45 * (1.0 - heat));
  col += uHot * seam * 1.7;

  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

export function makeLavaMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        tNoise: { value: lavaNoiseTex() },
        uTime: { value: 0 },
        uHot: { value: new THREE.Color(opts.hot || 0xfff0c0) },
        uMid: { value: new THREE.Color(opts.mid || 0xff6a1a) },
        uCool: { value: new THREE.Color(opts.cool || 0x8c1c04) },
        uCrust: { value: new THREE.Color(opts.crust || 0x241008) },
        uFlow: { value: opts.flow ?? 0.06 },
        uScale: { value: opts.scale ?? 3.0 },
        uVertical: { value: opts.vertical ? 1 : 0 },
      },
    ]),
    toneMapped: true,
    fog: true,
  });
}

/* ------------------------------------------------------------------ *
 *  The lava well: rock shaft walls, molten pool, heat haze light
 * ------------------------------------------------------------------ */
import { SET, terrainH } from './terrain.js';
import { mulberry32, fbm2, torus, tube, chunk, cyl, mergeList } from '../lib/util.js';
import { lavaNoiseTex } from '../lib/textures.js';

export function createLavaWell(M, scene) {
  const group = new THREE.Group();
  group.name = 'lava-well';
  const R = SET.pitR;
  const depth = SET.pitDepth;

  /* shaft rock walls (inside-facing) */
  const wallGeo = new THREE.CylinderGeometry(R - 0.4, R - 5.5, depth, 64, 18, true);
  const pos = wallGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const t = (v.y + depth / 2) / depth;      // 0 bottom, 1 top
    // strata ledges + vertical fluting
    const strata = Math.sin(t * 26.0 + Math.sin(a * 3.0) * 1.4) * 0.55;
    const flute = Math.sin(a * 14.0 + t * 2.0) * 0.5;
    const n = fbm2(a * 3.2 + 5, t * 6.0, 4);
    const k = 1.0 + (strata + flute) * 0.012 + n * 0.035;
    v.x *= k; v.z *= k;
    // jagged inward ledges
    v.x -= Math.cos(a) * Math.max(0, strata) * 0.9;
    v.z -= Math.sin(a) * Math.max(0, strata) * 0.9;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  wallGeo.computeVertexNormals();
  const wallMat = M.rockDark.clone();
  wallMat.side = THREE.BackSide;
  wallMat.color = new THREE.Color(0x8a6a4c);
  wallMat.emissive = new THREE.Color(0x3a1204);
  wallMat.emissiveIntensity = 0.55;
  wallMat.roughness = 0.86;
  wallMat.envMapIntensity = 0.15;
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = -depth / 2;
  wall.receiveShadow = true;
  group.add(wall);

  /* molten pool */
  const lavaMat = makeLavaMaterial({ scale: 4.0, flow: 0.05 });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(R - 5.0, 64), lavaMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = SET.lavaY;
  group.add(pool);

  // glowing rim of the pool
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const rim = new THREE.Mesh(new THREE.RingGeometry(R - 6.2, R - 4.4, 64), rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = SET.lavaY + 0.15;
  group.add(rim);

  /* steel collar around the pit rim */
  const rimRing = new THREE.Mesh(torus(R - 0.2, 1.15, 96, 10), M.darkSteel);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.35;
  rimRing.castShadow = true; rimRing.receiveShadow = true;
  group.add(rimRing);

  const rimRing2 = new THREE.Mesh(torus(R + 0.9, 0.45, 96, 8), M.hazard ? M.steel : M.steel);
  rimRing2.rotation.x = Math.PI / 2;
  rimRing2.position.y = 1.35;
  group.add(rimRing2);

  /* railing posts + rails around the pit */
  const railGeos = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = Math.cos(a) * (R + 1.6), z = Math.sin(a) * (R + 1.6);
    railGeos.push(chunk(0.16, 1.25, 0.16, x, 1.35 + 0.62, z));
    if (i < N) {
      const a2 = ((i + 1) / N) * Math.PI * 2;
      const x2 = Math.cos(a2) * (R + 1.6), z2 = Math.sin(a2) * (R + 1.6);
      const g = tube(new THREE.Vector3(x, 2.55, z), new THREE.Vector3(x2, 2.55, z2), 0.075, 0.075, 6);
      railGeos.push(g);
      const g2 = tube(new THREE.Vector3(x, 1.7, z), new THREE.Vector3(x2, 1.7, z2), 0.05, 0.05, 6);
      railGeos.push(g2);
    }
  }
  const railMesh = new THREE.Mesh(mergeList(railGeos), M.yellowTrim);
  railMesh.castShadow = true;
  group.add(railMesh);

  /* heat haze lights */
  const lavaLight = new THREE.PointLight(0xff7a2a, 40, 130, 2.0);
  lavaLight.position.set(0, SET.lavaY + 8, 0);
  group.add(lavaLight);

  const lavaLight2 = new THREE.PointLight(0xff9a44, 16, 60, 2.0);
  lavaLight2.position.set(0, 2, 0);
  group.add(lavaLight2);

  // bounce lights so the shaft walls are readable instead of pure black
  for (const [yy, ii, dd] of [[-3, 420, 150], [-12, 380, 140], [-24, 320, 130], [-33, 260, 120]]) {
    const L = new THREE.PointLight(0xff7b30, ii, dd, 2.0);
    L.position.set(0, yy, 0);
    group.add(L);
  }

  /* warm bounce onto the deck rim: lava light spilling over the lip */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const L = new THREE.PointLight(0xff8a3c, 260, 120, 2.0);
    L.position.set(Math.cos(a) * (SET.pitR - 4), 2.5, Math.sin(a) * (SET.pitR - 4));
    group.add(L);
  }

  /* floating embers */
  const emberCount = 260;
  const emberGeo = new THREE.BufferGeometry();
  const ep = new Float32Array(emberCount * 3);
  const es = new Float32Array(emberCount);
  const rnd = mulberry32(9);
  for (let i = 0; i < emberCount; i++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * (R - 10);
    ep[i * 3] = Math.cos(a) * r;
    ep[i * 3 + 1] = SET.lavaY + rnd() * 30;
    ep[i * 3 + 2] = Math.sin(a) * r;
    es[i] = 0.4 + rnd() * 1.6;
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  emberGeo.setAttribute('aScale', new THREE.BufferAttribute(es, 1));

  const emberMat = new THREE.PointsMaterial({
    color: 0xffa040, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.name = 'embers';
  group.add(embers);

  scene.add(group);

  return {
    group, lavaMat, pool, embers, lavaLight, lavaLight2,
    update(dt, t) {
      lavaMat.uniforms.uTime.value = t;
      const p = emberGeo.attributes.position;
      for (let i = 0; i < emberCount; i++) {
        let y = p.getY(i) + dt * (1.2 + es[i] * 1.6);
        if (y > SET.lavaY + 34) y = SET.lavaY;
        p.setY(i, y);
      }
      p.needsUpdate = true;
      const flick = 0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 17.1) * 0.04;
      lavaLight.intensity = 40 * flick;
    },
  };
}
