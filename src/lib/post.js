import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/* grading in display space — tone mapping is done by OutputPass (ACES) */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.04 },
    uSunPos: { value: new THREE.Vector2(0.5, 0.6) },
    uSunVisible: { value: 0.0 },
    uRayStrength: { value: 0.58 },
    uRayThreshold: { value: 0.62 },
    uTime: { value: 0 },
    uGrain: { value: 0.006 },
    uVignette: { value: 0.5 },
    uSaturation: { value: 1.22 },
    uContrast: { value: 1.13 },
    uCA: { value: 0.00055 },
    uLift: { value: new THREE.Vector3(0.030, 0.043, 0.070) },
    uGain: { value: new THREE.Vector3(1.04, 1.005, 0.97) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uExposure, uSunVisible, uRayStrength, uRayThreshold, uTime;
    uniform float uGrain, uVignette, uSaturation, uContrast, uCA;
    uniform vec2 uSunPos;
    uniform vec3 uLift, uGain;

    float hash12(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    vec3 godrays(vec2 uv){
      vec2 d = uSunPos - uv;
      float dist = length(d);
      if (dist < 0.0001 || uSunVisible < 0.01) return vec3(0.0);
      vec2 dir = d / dist;
      vec3 acc = vec3(0.0);
      float w = 1.0, wsum = 0.0;
      vec2 p = uv;
      float stepSz = dist * 0.055;
      for (int i = 0; i < 14; i++){
        p += dir * stepSz;
        vec3 c = texture2D(tDiffuse, clamp(p, vec2(0.001), vec2(0.999))).rgb;
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float m = smoothstep(uRayThreshold, uRayThreshold * 1.9, lum);
        acc += c * m * w;
        wsum += w;
        w *= 0.88;
      }
      return acc / max(wsum, 1e-3) * uRayStrength * uSunVisible;
    }

    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      vec2 off = c * uCA * (0.3 + r2 * 2.4);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;

      col += godrays(uv);
      col *= uExposure;

      // split-tone: cool shadows, warm highlights (display space)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += uLift * (1.0 - smoothstep(0.0, 0.42, lum));
      col *= mix(vec3(1.0), uGain, smoothstep(0.42, 1.0, lum));

      col = (col - 0.5) * uContrast + 0.5;
      float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l2), col, uSaturation);
      col = clamp(col, 0.0, 1.0);

      float vig = 1.0 - uVignette * smoothstep(0.12, 0.95, r2 * 1.6);
      col *= vig;

      float g = hash12(uv * vec2(1600.0, 900.0) + fract(uTime) * 137.0) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};


/* heat shimmer: subtle screen-space refraction above the molten well */
const HeatHazeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uStrength: { value: 0.00112 },
    uCenter: { value: new THREE.Vector2(0.5, 0.55) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime, uStrength;
    uniform vec2 uCenter;

    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
                 mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    void main(){
      vec2 uv = vUv;
      float d = distance(uv, uCenter);
      float mask = smoothstep(0.385, 0.042, d);

      float a = n2(vec2(uv.x * 22.0, uv.y * 30.0 - uTime * 1.7));
      float b = n2(vec2(uv.x * 41.0 + 5.0, uv.y * 55.0 - uTime * 2.6));
      vec2 off = vec2(a - 0.5, b - 0.5) * uStrength * mask * 2.0;

      float ca = 0.35 * mask * uStrength * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off + vec2(ca, 0.0)).r;
      col.g = texture2D(tDiffuse, uv + off).g;
      col.b = texture2D(tDiffuse, uv + off - vec2(ca, 0.0)).b;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ *
 *  volumetric light — half-res depth-aware sun raymarch
 *  Runs before Bloom so the shafts are picked up by the HDR bloom.
 * ------------------------------------------------------------------ */
const VolumetricLightShader = {
  uniforms: {
    tDepth: { value: null },
    uProj: { value: new THREE.Matrix4() },
    uView: { value: new THREE.Matrix4() },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(0xffe0bd) },
    uSunPos: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVisible: { value: 0 },
    uIntensity: { value: 0.85 },
    uDensity: { value: 0.00055 },
    uMaxDist: { value: 260 },
    uNear: { value: 0.6 },
    uFar: { value: 6000 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowBias: { value: 0.0012 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tDepth;
    uniform sampler2D uShadowMap;
    uniform mat4 uProj, uView, uInvProj, uCamWorld, uShadowMatrix;
    uniform vec3 uCamPos, uSunDir, uSunColor;
    uniform vec2 uSunPos, uResolution;
    uniform float uSunVisible, uIntensity, uDensity, uMaxDist, uNear, uFar, uTime, uShadowBias;

    float hash12(vec2 p){
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float viewZ(float d){
      return (uNear * uFar) / ((uFar - uNear) * d - uFar);
    }
    float hg(float c, float g){
      float g2 = g * g;
      return (1.0 - g2) / (12.566371 * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5));
    }

    void main(){
      float depth = texture2D(tDepth, vUv).x;
      vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
      vec4 vpos = uInvProj * clip;
      vpos /= vpos.w;
      vec3 world = (uCamWorld * vec4(vpos.xyz, 1.0)).xyz;
      vec3 toCam = world - uCamPos;
      float sceneDist = length(toCam);
      toCam /= max(sceneDist, 0.0001);

      // Sky pixels start at the far end of the shaft volume; solid pixels
      // start on the surface so the ray marches through the air toward the sun.
      if (depth > 0.99995) world = uCamPos + toCam * uMaxDist;

      float stepLen = uMaxDist / 16.0;
      float jitter = hash12(vUv * uResolution + vec2(uTime * 37.0, uTime * 17.0));
      float t = stepLen * jitter;
      float acc = 0.0;
      float trans = 1.0;

      float cosT = dot(toCam, uSunDir);
      float phase = hg(cosT, 0.72) * 4.2 + 0.12;
      float sunD = length((vUv - uSunPos) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0));
      float sunW = 0.72 + 0.28 * exp(-sunD * sunD * 2.0);

      for (int i = 0; i < 16; i++){
        vec3 p = world + uSunDir * t;
        float h = max(p.y, 0.0);
        float dens = uDensity * exp(-h / 115.0);
        dens *= 0.62 + 0.38 * exp(-h / 32.0);

        // one depth sample per step: if the camera-visible surface at this
        // screen position is closer than the sample, the sample is occluded
        vec4 cp = uProj * uView * vec4(p, 1.0);
        vec3 ndc = cp.xyz / max(cp.w, 0.0001);
        if (ndc.x > -1.0 && ndc.x < 1.0 && ndc.y > -1.0 && ndc.y < 1.0){
          vec2 suv = ndc.xy * 0.5 + 0.5;
          float sd = texture2D(tDepth, suv).x;
          float sz = viewZ(sd);
          float pz = (uView * vec4(p, 1.0)).z;
          float bias = max(0.06, stepLen * 0.018);
          dens *= 1.0 - step(pz + bias, sz);
        }

        // sun shadow test: one depth tap per step
        vec4 sc = uShadowMatrix * vec4(p, 1.0);
        vec3 scc = sc.xyz / max(sc.w, 0.0001);
        if (scc.x > 0.001 && scc.x < 0.999 && scc.y > 0.001 && scc.y < 0.999 && scc.z < 1.0){
          float sdep = unpackRGBAToDepth(texture2D(uShadowMap, scc.xy));
          dens *= step(scc.z - uShadowBias, sdep);
        }

        acc += dens * trans * stepLen;
        trans *= exp(-dens * stepLen * 0.22);
        t += stepLen;
      }

      vec3 col = uSunColor * acc * phase * sunW * uIntensity * uSunVisible;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

const VolumetricCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tVolume: { value: null },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tVolume;
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb + texture2D(tVolume, vUv).rgb;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

class VolumetricLightPass extends Pass {
  constructor(camera, opts = {}) {
    super();
    this.camera = camera;
    this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.rt.texture.name = 'volumetric';
    this.volumeMaterial = new THREE.ShaderMaterial({
      name: 'VolumetricLight',
      uniforms: THREE.UniformsUtils.clone(VolumetricLightShader.uniforms),
      vertexShader: VolumetricLightShader.vertexShader,
      fragmentShader: VolumetricLightShader.fragmentShader,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.compositeMaterial = new THREE.ShaderMaterial({
      name: 'VolumetricComposite',
      uniforms: THREE.UniformsUtils.clone(VolumetricCompositeShader.uniforms),
      vertexShader: VolumetricCompositeShader.vertexShader,
      fragmentShader: VolumetricCompositeShader.fragmentShader,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.whiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.whiteTexture.needsUpdate = true;
    this.volumeMaterial.uniforms.uShadowMap.value = this.whiteTexture;
    this.quad = new FullScreenQuad(this.volumeMaterial);
    this.enabled = opts.enabled !== false;
  }

  setSize(w, h) {
    this.rt.setSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!readBuffer.depthTexture || !readBuffer.depthTexture.isDepthTexture) return;
    const u = this.volumeMaterial.uniforms;
    u.tDepth.value = readBuffer.depthTexture;
    u.uProj.value.copy(this.camera.projectionMatrix);
    u.uView.value.copy(this.camera.matrixWorldInverse);
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    this.camera.getWorldPosition(u.uCamPos.value);
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    u.uResolution.value.set(this.rt.width, this.rt.height);

    this.quad.material = this.volumeMaterial;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    this.quad.render(renderer);

    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tVolume.value = this.rt.texture;
    this.quad.material = this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    this.quad.render(renderer);
  }

  dispose() {
    this.rt.dispose();
    this.whiteTexture.dispose();
    this.volumeMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quad.dispose();
  }
}

/* ------------------------------------------------------------------ *
 *  TAA — Halton jitter + history reprojection
 *  Resolves the scene before volumetrics/bloom; history is reset on cuts.
 * ------------------------------------------------------------------ */
const TAAShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tHistory: { value: null },
    uInvViewProj: { value: new THREE.Matrix4() },
    uPrevViewProj: { value: new THREE.Matrix4() },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uBlend: { value: 0.12 },
    uHistoryValid: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse, tDepth, tHistory;
    uniform mat4 uInvViewProj, uPrevViewProj;
    uniform vec2 uResolution;
    uniform float uBlend, uHistoryValid;

    vec3 neighborhoodMin(vec2 uv){
      vec2 t = 1.0 / uResolution;
      vec3 m = texture2D(tDiffuse, uv).rgb;
      m = min(m, texture2D(tDiffuse, uv + vec2(-t.x, 0.0)).rgb);
      m = min(m, texture2D(tDiffuse, uv + vec2( t.x, 0.0)).rgb);
      m = min(m, texture2D(tDiffuse, uv + vec2(0.0, -t.y)).rgb);
      m = min(m, texture2D(tDiffuse, uv + vec2(0.0,  t.y)).rgb);
      return m;
    }
    vec3 neighborhoodMax(vec2 uv){
      vec2 t = 1.0 / uResolution;
      vec3 m = texture2D(tDiffuse, uv).rgb;
      m = max(m, texture2D(tDiffuse, uv + vec2(-t.x, 0.0)).rgb);
      m = max(m, texture2D(tDiffuse, uv + vec2( t.x, 0.0)).rgb);
      m = max(m, texture2D(tDiffuse, uv + vec2(0.0, -t.y)).rgb);
      m = max(m, texture2D(tDiffuse, uv + vec2(0.0,  t.y)).rgb);
      return m;
    }

    void main(){
      vec3 cur = texture2D(tDiffuse, vUv).rgb;
      if (uHistoryValid < 0.5) { gl_FragColor = vec4(cur, 1.0); return; }

      float d = texture2D(tDepth, vUv).x;
      vec4 clip = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec4 world = uInvViewProj * clip;
      world /= world.w;
      vec4 pc = uPrevViewProj * world;
      if (pc.w <= 0.0001) { gl_FragColor = vec4(cur, 1.0); return; }
      vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
      if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0) {
        gl_FragColor = vec4(cur, 1.0); return;
      }

      vec3 hist = texture2D(tHistory, puv).rgb;
      hist = clamp(hist, neighborhoodMin(vUv), neighborhoodMax(vUv));
      gl_FragColor = vec4(mix(hist, cur, uBlend), 1.0);
    }
  `,
};

const TAACopyShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }
  `,
};

function halton(index, base) {
  let f = 1, r = 0;
  while (index > 0) {
    f /= base;
    r += f * (index % base);
    index = Math.floor(index / base);
  }
  return r;
}

class TAAPass extends Pass {
  constructor(camera, opts = {}) {
    super();
    this.camera = camera;
    this.needsSwap = false;
    this.clear = false;
    this.prev = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.next = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.prev.texture.name = 'taa-history';
    this.next.texture.name = 'taa-resolve';
    this.material = new THREE.ShaderMaterial({
      name: 'TAA',
      uniforms: THREE.UniformsUtils.clone(TAAShader.uniforms),
      vertexShader: TAAShader.vertexShader,
      fragmentShader: TAAShader.fragmentShader,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      name: 'TAA Copy',
      uniforms: THREE.UniformsUtils.clone(TAACopyShader.uniforms),
      vertexShader: TAACopyShader.vertexShader,
      fragmentShader: TAACopyShader.fragmentShader,
      depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending,
    });
    this.quad = new FullScreenQuad(this.material);
    this.prevViewProj = new THREE.Matrix4();
    this.historyValid = false;
    this.frame = 0;
    this.enabled = opts.enabled !== false;
  }

  reset() {
    this.historyValid = false;
    this.frame = 0;
  }

  setSize(w, h) {
    this.prev.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
    this.next.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
    this.reset();
  }

  nextJitter(w, h) {
    if (!this.historyValid) this.frame = 0;
    else this.frame = (this.frame + 1) % 16;
    const n = this.frame + 1;
    return [(halton(n, 2) - 0.5) * 2.0 / w, (halton(n, 3) - 0.5) * 2.0 / h];
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!readBuffer.depthTexture || !readBuffer.depthTexture.isDepthTexture) return;
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.tHistory.value = this.prev.texture;
    u.uResolution.value.set(this.prev.width, this.prev.height);
    u.uHistoryValid.value = this.historyValid ? 1 : 0;

    const vp = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    u.uInvViewProj.value.copy(vp).invert();
    if (this.historyValid) u.uPrevViewProj.value.copy(this.prevViewProj);
    else u.uPrevViewProj.value.copy(vp);

    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.quad.material = this.material;
    renderer.setRenderTarget(this.next);
    renderer.clear();
    this.quad.render(renderer);

    // copy the resolve back into readBuffer, keeping its depth attachment intact
    this.copyMaterial.uniforms.tDiffuse.value = this.next.texture;
    this.quad.material = this.copyMaterial;
    renderer.setRenderTarget(readBuffer);
    this.quad.render(renderer);

    renderer.autoClear = oldAutoClear;
    this.prevViewProj.copy(vp);
    this.historyValid = true;
    const tmp = this.prev;
    this.prev = this.next;
    this.next = tmp;
  }

  dispose() {
    this.prev.dispose();
    this.next.dispose();
    this.material.dispose();
    this.copyMaterial.dispose();
    this.quad.dispose();
  }
}

export function createPost(renderer, scene, camera, opts = {}) {
  const size = renderer.getSize(new THREE.Vector2());

  // main scene target carries a depth texture for the volumetric pass
  const sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(size.x, size.y),
  });
  sceneRT.texture.name = 'EffectComposer.rt1';
  sceneRT.depthTexture.name = 'EffectComposer.depth';

  const composer = new EffectComposer(renderer, sceneRT);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);

  composer.addPass(new RenderPass(scene, camera));

  const taa = new TAAPass(camera, { enabled: opts.taa !== false });
  composer.addPass(taa);

  const volumetric = new VolumetricLightPass(camera, { enabled: opts.volumetric !== false });
  composer.addPass(volumetric);

  let gtao = null;
  if (opts.ao !== false) {
    try {
      gtao = new GTAOPass(scene, camera, size.x, size.y);
      gtao.output = GTAOPass.OUTPUT?.Default ?? 1;
      gtao.blendIntensity = 0.32;
      if (gtao.updateGtaoMaterial) {
        gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples: 12 });
      }
      composer.addPass(gtao);
    } catch (e) {
      console.warn('[post] GTAO unavailable', e);
      gtao = null;
    }
  }

  const bokeh = new BokehPass(scene, camera, { focus: 60, aperture: 0.00004, maxblur: 0.0028 });
  bokeh.enabled = !!opts.dof;
  composer.addPass(bokeh);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.40, 0.66, 0.95);
  composer.addPass(bloom);

  // ACES + sRGB
  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const heat = new ShaderPass(HeatHazeShader);
  composer.addPass(heat);

  const smaa = new SMAAPass(size.x, size.y);
  composer.addPass(smaa);

  return {
    composer, bokeh, bloom, grade, heat, smaa, gtao, volumetric, taa,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    setQuality(level) {
      if (level === 'low') {
        if (gtao) gtao.enabled = false;
        bokeh.enabled = false;
        smaa.enabled = false;
        volumetric.enabled = false;
        taa.enabled = false;
      } else if (level === 'mid') {
        if (gtao) gtao.enabled = true;
        bokeh.enabled = false;
        smaa.enabled = true;
        volumetric.enabled = true;
        if (!taa.enabled) taa.reset();
        taa.enabled = true;
      } else {
        if (gtao) gtao.enabled = true;
        bokeh.enabled = true;
        smaa.enabled = true;
        volumetric.enabled = true;
        if (!taa.enabled) taa.reset();
        taa.enabled = true;
      }
    },
  };
}
