p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()

s = s.replace("petalTop: 196,", "petalTop: 206,")
s = s.replace("crownTop: 200,", "crownTop: 210,")
s = s.replace("coreTop: 206,", "coreTop: 216,")
s = s.replace("petalR1: 96,", "petalR1: 106,")
s = s.replace("const w = lerp(22, 34, Math.pow(t, 1.05)) * wScale;",
              "const w = lerp(30, 62, Math.pow(t, 0.72)) * wScale;")
s = s.replace("const th = lerp(7.0, 3.0, Math.pow(t, 0.85));",
              "const th = lerp(8.5, 3.6, Math.pow(t, 0.85));")
# crown rises with the fins
s = s.replace("[[150, 16.6], [158, 21.2], [168, 23.5], [180, 22.5], [190, 19.4], [197, 15.6]]",
              "[[152, 16.6], [162, 21.4], [174, 24.0], [188, 23.2], [200, 19.8], [209, 15.8]]")
s = s.replace("[[152.0, 17.4, 1.7], [161.5, 22.0, 1.3]]",
              "[[154.0, 17.4, 1.7], [165.5, 22.4, 1.3]]")
s = s.replace("const hub = new THREE.CylinderGeometry(11.5, 14.5, 5.6, 8, 1, false);\nhub.rotateY(Math.PI / 8); hub.translate(0, 199.5, 0);",
              "const hub = new THREE.CylinderGeometry(11.5, 14.5, 5.6, 8, 1, false);\nhub.rotateY(Math.PI / 8); hub.translate(0, 211.5, 0);")
s = s.replace("hub2.rotateY(Math.PI / 8); hub2.translate(0, 204.5, 0);",
              "hub2.rotateY(Math.PI / 8); hub2.translate(0, 216.5, 0);")
s = s.replace("V(Math.cos(a) * 7.6, 204, Math.sin(a) * 7.6), V(Math.cos(a) * 12.0, 240 + (i % 3) * 7, Math.sin(a) * 12.0)",
              "V(Math.cos(a) * 7.6, 216, Math.sin(a) * 7.6), V(Math.cos(a) * 12.0, 252 + (i % 3) * 7, Math.sin(a) * 12.0)")
s = s.replace("beamGroup.position.y = 206;", "beamGroup.position.y = 218;")
s = s.replace("crownLight.position.set(0, 190, 0);", "crownLight.position.set(0, 200, 0);")
s = s.replace("logo.translate(dir.x * 17.75, H.logoY + 0.2, dir.z * 17.75);",
              "logo.translate(dir.x * 17.75, H.logoY + 0.2, dir.z * 17.75);")
s = s.replace("logoY: 172,", "logoY: 180,")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("const notch = Math.exp(-Math.pow(angDiff(Math.atan2(z, x), RIFT_A) / 0.46, 2));",
              "const notch = Math.exp(-Math.pow(angDiff(Math.atan2(z, x), RIFT_A) / 0.62, 2));")
s = s.replace("const gate = 1.0 - 0.86 * notch;", "const gate = 1.0 - 0.9 * notch;")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
