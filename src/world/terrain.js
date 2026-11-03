import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm2, ridged2 } from '../lib/util.js';

/* ------------------------------------------------------------------ *
 *  Set metrics — the station deck surface is y = 0
 * ------------------------------------------------------------------ */
export const SET = {
  ringR: 94.5,
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
  const dryWeights = new Float32Array(pos.count);
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
    // moss belt: keep the inner edge at the station skirt; outer fade
    // 270 -> 373 m makes the deck-edge-to-fade area another 2x larger
    const rn = Math.hypot(x, z) + fbm2(x * 0.0021 + 3, z * 0.0021 - 7, 3) * 150 + fbm2(x * 0.0085 - 2, z * 0.0085 + 5, 3) * 44 + fbm2(x * 0.026, z * 0.026, 2) * 9;
    const mossMask = 1 - smoothstep(106, 373, rn);
    // dry soil ring follows the new edge
    const dryMask = smoothstep(365, 440, rn) * (1 - smoothstep(760, 980, rn));
    dryWeights[i] = dryMask;
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
  geo.setAttribute('aDry', new THREE.BufferAttribute(dryWeights, 1));
  geo.computeVertexNormals();

  const groundMat = M.ground.clone();
  groundMat.vertexColors = true;
  if (M.groundDry && M.groundDry.map) {
    const dryMap = M.groundDry.map;
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uDryMap = { value: dryMap };
      shader.vertexShader = 'attribute float aDry;\nvarying float vDry;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vDry = aDry;',
      );
      shader.fragmentShader = 'uniform sampler2D uDryMap;\nvarying float vDry;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          '#ifdef USE_MAP',
          '  vec4 dryTexel = texture2D(uDryMap, vMapUv);',
          '  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * dryTexel.rgb * 1.08, clamp(vDry, 0.0, 1.0) * 0.92);',
          '#endif',
        ].join('\n'),
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.95, clamp(vDry, 0.0, 1.0));',
      );
    };
    groundMat.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, groundMat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'ground';
  group.add(mesh);

  // modeled butte clusters are parked: the textured heightfield carries the range
  scene.add(group);
  return { group, mesh };
}

export function groundHeight(x, z) { return terrainH(x, z); }
