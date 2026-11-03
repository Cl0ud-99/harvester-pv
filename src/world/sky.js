import * as THREE from 'three';
import { clamp, lerp } from '../lib/util.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uMid, uHorizon, uGround, uSunColor, uCloudLit, uCloudShade, uPlume;
uniform vec3 uSunDir, uPlumeDir;
uniform float uTime, uSunPower, uCloudCover, uStars, uHaze, uPlumeAmt, uSplit;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){ s += a * vnoise(p); p = p * 2.03 + 11.3; a *= 0.5; }
  return s;
}
float fbmR(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0)); p = p * 2.11 + 5.7; a *= 0.5; }
  return s;
}

void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 dz = normalize(vec3(d.x, 0.0, d.z));
  float sunAz = max(dot(dz, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
  float plumeAz = max(dot(dz, normalize(vec3(uPlumeDir.x, 0.0, uPlumeDir.z))), 0.0);

  // three-band gradient: cool zenith, pale mid, hot horizon
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.30, up));
  col = mix(col, uZenith, smoothstep(0.22, 0.95, up));

  // the rift glow: one side of the sky is lit by the lava field
  col = mix(col, uPlume, pow(plumeAz, 3.0) * (1.0 - smoothstep(0.0, 0.55, up)) * uPlumeAmt);

  // warm scatter around the sun
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float horizonGlow = pow(1.0 - up, 5.0);
  col += uSunColor * pow(sd, 5.0) * 0.26;
  col += uSunColor * horizonGlow * pow(sunAz, 2.2) * 0.62;

  // sun disk
  col += uSunColor * pow(sd, 2600.0) * uSunPower * 30.0;
  col += uSunColor * pow(sd, 120.0) * uSunPower * 1.9;
  col += uSunColor * pow(sd, 9.0) * 0.22 * uSunPower;

  // ---- clouds ----
  if (d.y > 0.004) {
    vec2 base = d.xz / max(d.y, 0.05);
    vec2 drift = vec2(uTime * 0.0028, uTime * 0.0009);

    vec2 uv1 = base * 0.72 + drift;
    float n1 = fbm(uv1 * 1.05);
    float m1 = fbmR(uv1 * 1.9 + 7.0);
    float cover1 = smoothstep(0.50 - uCloudCover * 0.18, 0.84, n1 * 0.62 + m1 * 0.48);
    float dens1 = smoothstep(0.0, 0.5, cover1);

    vec2 uv2 = base * 2.4 - drift * 1.5;
    float n2 = fbm(uv2 * 0.85 + 21.0);
    float cover2 = smoothstep(0.63, 0.96, n2) * 0.42;

    float cover = clamp(dens1 + cover2 * (1.0 - dens1), 0.0, 1.0);
    cover *= smoothstep(0.0, 0.07, d.y) * (1.0 - smoothstep(0.78, 1.0, up) * 0.5);

    float sunSide = pow(sd * 0.5 + 0.5, 2.6);
    float thickness = 1.0 - smoothstep(0.42, 0.92, n1 * 0.7 + m1 * 0.4);
    vec3 cloudCol = mix(uCloudShade, uCloudLit, clamp(sunSide * (1.3 - thickness * 0.75), 0.0, 1.0));
    // lava-lit underside on the plume side
    cloudCol += uPlume * pow(plumeAz, 2.5) * (1.0 - up) * 0.5 * (1.0 - thickness);
    cloudCol += uSunColor * pow(sd, 12.0) * 0.6 * (1.0 - thickness);
    col = mix(col, cloudCol, cover * 0.86);

    // ---- volcanic smoke columns rising from the far rim ----
    float col2 = pow(plumeAz, 2.0);
    float tower = smoothstep(0.0, 0.22, up) * (1.0 - smoothstep(0.25, 0.75, up));
    float smoke = fbm(vec2(dz.x * 9.0 + dz.z * 9.0, d.y * 5.0 - uTime * 0.02)) * 0.6 + 0.4 * fbmR(vec2(d.y * 8.0, dz.x * 6.0));
    float sm = smoothstep(0.48, 0.86, smoke) * tower * col2 * uPlumeAmt;
    col = mix(col, vec3(0.16, 0.09, 0.09) + uPlume * 0.35, sm * 0.55);
  }

  // stars
  if (uStars > 0.01 && d.y > 0.03) {
    vec2 sp = d.xz / (d.y + 0.35) * 190.0;
    float st = hash(floor(sp));
    float s = smoothstep(0.9975, 1.0, st) * (0.6 + 0.4 * sin(uTime * 2.7 + st * 64.0));
    col += vec3(0.75, 0.82, 1.0) * s * uStars * 2.4 * smoothstep(0.03, 0.32, d.y);
  }

  // horizon haze
  col = mix(col, mix(uHorizon, uSunColor, 0.22), pow(1.0 - up, 20.0) * uHaze);

  gl_FragColor = vec4(col, 1.0);
}`;

/* 0 = bright late afternoon, 1 = night */
const STOPS = [
  { t: 0.00, zenith: 0x2a7aa8, mid: 0x8fb6c4, horizon: 0xf2c489, ground: 0x6b5440, sun: 0xfff0d4, cloudLit: 0xf6dcc0, cloudShade: 0x59647a, plume: 0xc25a22, sunPower: 1.05, cover: 0.42, stars: 0.0, haze: 0.22, plumeAmt: 0.35, fog: 0xb09a86, sunEl: 0.46, sunAz: -1.86 },
  { t: 0.36, zenith: 0x1f6f98, mid: 0x7fa3b2, horizon: 0xf7ab63, ground: 0x5b4433, sun: 0xffe0bd, cloudLit: 0xf0bb92, cloudShade: 0x4a4a62, plume: 0xd2561c, sunPower: 0.95, cover: 0.56, stars: 0.0, haze: 0.24, plumeAmt: 0.55, fog: 0x9d8371, sunEl: 0.46, sunAz: -1.84 },
  { t: 0.62, zenith: 0x1b3f68, mid: 0x6d7f96, horizon: 0xef7a3c, ground: 0x4a3527, sun: 0xffc08a, cloudLit: 0xdd8f63, cloudShade: 0x363449, plume: 0xd0461a, sunPower: 1.5, cover: 0.66, stars: 0.04, haze: 0.28, plumeAmt: 0.8, fog: 0x7d5b4a, sunEl: 0.24, sunAz: -1.82 },
  { t: 0.82, zenith: 0x152a44, mid: 0x4b4a60, horizon: 0x9c5236, ground: 0x241c16, sun: 0xff8a48, cloudLit: 0x9a5340, cloudShade: 0x1e1d2e, plume: 0x8e2e12, sunPower: 1.5, cover: 0.6, stars: 0.45, haze: 0.24, plumeAmt: 0.9, fog: 0x64423a, sunEl: -0.03, sunAz: -1.80 },
  { t: 1.00, zenith: 0x05080f, mid: 0x0d1220, horizon: 0x161d2c, ground: 0x080a0e, sun: 0x3a5c86, cloudLit: 0x2a3247, cloudShade: 0x0a0c14, plume: 0x5a1c0c, sunPower: 0.3, cover: 0.45, stars: 1.0, haze: 0.28, plumeAmt: 1.0, fog: 0x121a26, sunEl: -0.14, sunAz: -1.78 },
];

function stopAt(t) {
  t = clamp(t, 0, 1);
  let i = 0;
  while (i < STOPS.length - 2 && t > STOPS[i + 1].t) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  const k = clamp((t - a.t) / Math.max(1e-5, b.t - a.t), 0, 1);
  return { a, b, e: k * k * (3 - 2 * k) };
}

export function createSky(renderer, scene) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x2f617f) },
    uMid: { value: new THREE.Color(0x8fa9b4) },
    uHorizon: { value: new THREE.Color(0xe8c9a0) },
    uGround: { value: new THREE.Color(0x6b5440) },
    uSunColor: { value: new THREE.Color(0xfff0d4) },
    uCloudLit: { value: new THREE.Color(0xf6dcc0) },
    uCloudShade: { value: new THREE.Color(0x59647a) },
    uPlume: { value: new THREE.Color(0xc25a22) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.3, -0.85).normalize() },
    uPlumeDir: { value: new THREE.Vector3(-0.2, 0.1, 0.98).normalize() },
    uTime: { value: 0 },
    uSunPower: { value: 2.4 },
    uCloudCover: { value: 0.5 },
    uStars: { value: 0 },
    uHaze: { value: 0.5 },
    uPlumeAmt: { value: 0.6 },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });

  const geo = new THREE.SphereGeometry(4200, 64, 40);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky';
  scene.add(mesh);

  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(geo, mat));

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let envRT = null;
  let envTimer = null;

  const sunDir = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const state = { t: 0.36, envT: -1 };

  function rebuildEnv() {
    if (envRT) { envRT.dispose(); envRT = null; }
    envRT = pmrem.fromScene(envScene, 0.02, 0.1, 800);
    scene.environment = envRT.texture;
    state.envT = state.t;
  }

  function setTime(t, force = false) {
    state.t = clamp(t, 0, 1);
    const { a, b, e } = stopAt(state.t);
    const mix = (ca, cb) => tmpC.setHex(ca).lerp(new THREE.Color(cb), e).clone();

    uniforms.uZenith.value.copy(mix(a.zenith, b.zenith));
    uniforms.uMid.value.copy(mix(a.mid, b.mid));
    uniforms.uHorizon.value.copy(mix(a.horizon, b.horizon));
    uniforms.uGround.value.copy(mix(a.ground, b.ground));
    uniforms.uSunColor.value.copy(mix(a.sun, b.sun));
    uniforms.uCloudLit.value.copy(mix(a.cloudLit, b.cloudLit));
    uniforms.uCloudShade.value.copy(mix(a.cloudShade, b.cloudShade));
    uniforms.uPlume.value.copy(mix(a.plume, b.plume));
    uniforms.uSunPower.value = lerp(a.sunPower, b.sunPower, e);
    uniforms.uCloudCover.value = lerp(a.cover, b.cover, e);
    uniforms.uStars.value = lerp(a.stars, b.stars, e);
    uniforms.uHaze.value = lerp(a.haze, b.haze, e);
    uniforms.uPlumeAmt.value = lerp(a.plumeAmt, b.plumeAmt, e);

    const el = lerp(a.sunEl, b.sunEl, e);
    const az = lerp(a.sunAz, b.sunAz, e);
    sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    uniforms.uSunDir.value.copy(sunDir);

    // lava glow sits roughly opposite the sun so the sky is split warm/cool
    uniforms.uPlumeDir.value.set(-Math.cos(az) * 0.92, 0.06, -Math.sin(az) * 0.92).normalize();

    scene.fog.color.copy(mix(a.fog, b.fog));
    scene.fog.density = lerp(0.00036, 0.00062, e);

    // debounce the PMREM rebuild: rebuilding on every key press can reset the GPU context
    if (force) {
      if (envTimer) { clearTimeout(envTimer); envTimer = null; }
      rebuildEnv();
    } else if (Math.abs(state.t - state.envT) > 0.05) {
      if (envTimer) clearTimeout(envTimer);
      envTimer = setTimeout(() => { envTimer = null; rebuildEnv(); }, 160);
    }
    return state.t;
  }

  return {
    mesh, uniforms, sunDir, state, setTime,
    update(dt) { uniforms.uTime.value += dt; },
  };
}
