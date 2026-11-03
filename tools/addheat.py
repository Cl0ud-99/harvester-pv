p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()

shader = '''
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

'''

anchor = 'export function createPost(renderer, scene, camera, opts = {}) {'
assert anchor in s
s = s.replace(anchor, shader + anchor, 1)

old = """  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);"""
new = """  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const heat = new ShaderPass(HeatHazeShader);
  composer.addPass(heat);"""
assert old in s
s = s.replace(old, new, 1)

s = s.replace("    composer, bokeh, bloom, grade, smaa, gtao,", "    composer, bokeh, bloom, grade, heat, smaa, gtao,")

open(p, 'w', encoding='utf-8').write(s)
print('heat haze pass added')
