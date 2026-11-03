p = 'src/world/props.js'
s = open(p, encoding='utf-8').read()
s = s.replace("groundProps(104, 152, 54);", "groundProps(104, 150, 30);")
s = s.replace("const s = 2.0 + rnd() * 2.6;", "const s = 1.8 + rnd() * 1.8;")
s = s.replace("A.add(mergeList(cYellow), 'yellowTrim');", "A.add(mergeList(cYellow), 'armourDirty');")
s = s.replace("A.add(mergeList(cRed), 'red');", "A.add(mergeList(cRed), 'rust');")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()
s = s.replace("new THREE.CylinderGeometry(11.4, 12.6, H.coreTop + 10, 40, 1, true)",
              "new THREE.CylinderGeometry(8.4, 9.6, H.coreTop + 10, 40, 1, true)")
s = s.replace("f.position.set(Math.cos(a) * 10.0, (H.coreTop - 24) / 2, Math.sin(a) * 10.0);",
              "f.position.set(Math.cos(a) * 7.6, (H.coreTop - 24) / 2, Math.sin(a) * 7.6);")
s = s.replace("const coreLight = new THREE.PointLight(0xff7a2a, 280, 480, 2.0);",
              "const coreLight = new THREE.PointLight(0xff7a2a, 180, 420, 2.0);")
s = s.replace("coreLight.intensity = 280 * f;", "coreLight.intensity = 180 * f;")
open(p, 'w', encoding='utf-8').write(s)
print('cleanup ok')
