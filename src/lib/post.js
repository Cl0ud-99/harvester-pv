import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

/* grading in display space — tone mapping is done by OutputPass (ACES) */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.04 },
    uSunPos: { value: new THREE.Vector2(0.5, 0.6) },
    uSunVisible: { value: 0.0 },
    uRayStrength: { value: 0.5 },
    uRayThreshold: { value: 0.72 },
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
    uStrength: { value: 0.0016 },
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
      float mask = smoothstep(0.55, 0.06, d);

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

export function createPost(renderer, scene, camera, opts = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);

  composer.addPass(new RenderPass(scene, camera));

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
    composer, bokeh, bloom, grade, heat, smaa, gtao,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
    },
    setQuality(level) {
      if (level === 'low') {
        if (gtao) gtao.enabled = false;
        bokeh.enabled = false;
        smaa.enabled = false;
      } else if (level === 'mid') {
        if (gtao) gtao.enabled = true;
        bokeh.enabled = false;
        smaa.enabled = true;
      } else {
        if (gtao) gtao.enabled = true;
        bokeh.enabled = true;
        smaa.enabled = true;
      }
    },
  };
}
