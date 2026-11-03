p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("sun.intensity = lerp(4.6, 0.0, nightK) * lerp(1.0, 0.70, currentT);",
              "sun.intensity = lerp(6.2, 0.0, nightK) * lerp(1.0, 0.70, currentT);")
s = s.replace("hemi.intensity = lerp(0.42, 0.10, nightK);", "hemi.intensity = lerp(0.58, 0.12, nightK);")
s = s.replace("renderer.toneMappingExposure = 1.0;", "renderer.toneMappingExposure = 1.12;")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()
s = s.replace("beamGlowMat.uniforms.uOpacity.value = 0.42;", "beamGlowMat.uniforms.uOpacity.value = 0.30;")
s = s.replace("transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending", "transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()
s = s.replace("new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.7, 0.85)",
              "new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.40, 0.66, 0.95)")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/sky.js'
s = open(p, encoding='utf-8').read()
s = s.replace("{ t: 0.36, zenith: 0x2b5f88, mid: 0x94a7ae, horizon: 0xf0b483",
              "{ t: 0.36, zenith: 0x1f6f98, mid: 0x7fa3b2, horizon: 0xf7ab63")
s = s.replace("{ t: 0.62, zenith: 0x24466b, mid: 0x8d7f88, horizon: 0xe89060",
              "{ t: 0.62, zenith: 0x1b3f68, mid: 0x6d7f96, horizon: 0xef7a3c")
s = s.replace("{ t: 0.00, zenith: 0x2f6d94, mid: 0x8fa9b4, horizon: 0xe8c9a0",
              "{ t: 0.00, zenith: 0x2a7aa8, mid: 0x8fb6c4, horizon: 0xf2c489")
open(p, 'w', encoding='utf-8').write(s)
print('lighting pass 2')
