p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("sun.intensity = lerp(7.4, 0.0, nightK) * lerp(1.0, 0.70, currentT);",
              "sun.intensity = lerp(4.6, 0.0, nightK) * lerp(1.0, 0.70, currentT);")
s = s.replace("sun.color.copy(sky.uniforms.uSunColor.value);", "sun.color.copy(sky.uniforms.uSunColor.value);")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/sky.js'
s = open(p, encoding='utf-8').read()
s = s.replace("sunPower: 2.2, cover: 0.34", "sunPower: 1.5, cover: 0.42")
s = s.replace("sunPower: 2.45, cover: 0.46", "sunPower: 1.35, cover: 0.56")
s = s.replace("sunPower: 2.3, cover: 0.62", "sunPower: 1.5, cover: 0.66")
s = s.replace("haze: 0.30", "haze: 0.22").replace("haze: 0.34,", "haze: 0.24,").replace("haze: 0.38", "haze: 0.28")
s = s.replace("fog: 0xcdb49a", "fog: 0xb09a86").replace("fog: 0xc79a78", "fog: 0x9d8371").replace("fog: 0xa06f58", "fog: 0x7d5b4a")
s = s.replace("scene.fog.density = lerp(0.00042, 0.0007, e);", "scene.fog.density = lerp(0.00036, 0.00062, e);")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()
s = s.replace("uSaturation: { value: 1.14 },", "uSaturation: { value: 1.22 },")
s = s.replace("uContrast: { value: 1.06 },", "uContrast: { value: 1.13 },")
s = s.replace("uLift: { value: new THREE.Vector3(0.0, 0.012, 0.028) },",
              "uLift: { value: new THREE.Vector3(0.0, 0.016, 0.042) },")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""      for (const s of [-1, 0, 1]) {
        const c = dir.clone().multiplyScalar(r + 0.3).setY(y).addScaledVector(right, s * 5.8);
        const g = chunk(2.4, 6.8, 1.2);""", """      for (const s of [-1, 1]) {
        const c = dir.clone().multiplyScalar(r + 0.3).setY(y).addScaledVector(right, s * 5.8);
        const g = chunk(1.9, 4.6, 0.8);""")
open(p, 'w', encoding='utf-8').write(s)
print('look patch ok')
