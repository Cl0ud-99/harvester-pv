p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("sun.intensity = lerp(5.2, 0.0, nightK) * lerp(1.0, 0.72, currentT);",
              "sun.intensity = lerp(7.4, 0.0, nightK) * lerp(1.0, 0.70, currentT);")
s = s.replace("hemi.intensity = lerp(1.05, 0.16, nightK);", "hemi.intensity = lerp(0.42, 0.10, nightK);")
s = s.replace("const hemi = new THREE.HemisphereLight(0x9fc0dd, 0x6a5238, 0.75);",
              "const hemi = new THREE.HemisphereLight(0x7fa8cf, 0x4a3a28, 0.42);")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/materials.js'
s = open(p, encoding='utf-8').read()
s = s.replace("clearcoat: 0.45, clearcoatRoughness: 0.42, envMapIntensity: 0.85,", "clearcoat: 0.5, clearcoatRoughness: 0.36, envMapIntensity: 0.32,")
s = s.replace("clearcoat: 0.3, clearcoatRoughness: 0.55, envMapIntensity: 0.7,", "clearcoat: 0.34, clearcoatRoughness: 0.5, envMapIntensity: 0.26,")
s = s.replace("color: 0x7d746a, metalness: 0.02, roughness: 0.90, envMapIntensity: 0.55, flatShading: false,",
              "color: 0x8a8076, metalness: 0.03, roughness: 0.88, envMapIntensity: 0.22, flatShading: false,")
s = s.replace("color: 0x59682c, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.28, flatShading: true,",
              "color: 0x6b7a33, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.2, flatShading: true,")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()
s = s.replace("uSaturation: { value: 1.12 },", "uSaturation: { value: 1.26 },")
s = s.replace("uContrast: { value: 1.07 },", "uContrast: { value: 1.12 },")
s = s.replace("uVignette: { value: 0.40 },", "uVignette: { value: 0.46 },")
s = s.replace("uLift: { value: new THREE.Vector3(0.012, 0.020, 0.036) },",
              "uLift: { value: new THREE.Vector3(0.004, 0.014, 0.030) },")
s = s.replace("uGain: { value: new THREE.Vector3(1.03, 1.0, 0.955) },",
              "uGain: { value: new THREE.Vector3(1.06, 1.005, 0.94) },")
s = s.replace("const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.78, 0.92);",
              "const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.62, 0.72, 1.02);")
open(p, 'w', encoding='utf-8').write(s)
print('lighting patched')
