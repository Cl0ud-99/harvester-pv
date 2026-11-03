import re

p = 'src/lib/materials.js'
s = open(p, encoding='utf-8').read()
s = s.replace("color: 0x8a8076, metalness: 0.03, roughness: 0.88, envMapIntensity: 0.22, flatShading: false,",
              "color: 0x6f675e, metalness: 0.03, roughness: 0.93, envMapIntensity: 0.20, flatShading: false,")
s = s.replace("map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(1.7, 1.7),",
              "map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(2.3, 2.3),")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("boxUV(g, 0.05, x * 0.004, z * 0.004);", "boxUV(g, 0.16, x * 0.004, z * 0.004);")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    for (let k = 0; k < 7; k++) {
      const t = 0.12 + k * 0.07;
      const p = armPose(ang, t);
      for (const s of [-1, 0, 1]) {
        const c = p.c.clone().addScaledVector(right, s * p.w * 0.26).addScaledVector(dir, p.t * 0.52);
        const g = chunk(p.w * 0.13, lerp(5.2, 3.0, t), 0.8);
        g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
        g.translate(c.x, c.y, c.z);
        slots.push(g);
      }
    }""", """    for (let k = 0; k < 10; k++) {
      const t = 0.10 + k * 0.055;
      const p = armPose(ang, t);
      const c = p.c.clone().addScaledVector(dir, p.t * 0.52);
      const g = chunk(p.w * 0.52, 0.85, 0.55);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
      g.translate(c.x, c.y, c.z);
      slots.push(g);
    }""")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/ring.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  A.finish();
  scene.add(root);
  return { group: root };""", """  /* under-saucer practicals so the deck edge is not a black void */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const L = new THREE.PointLight(0xffb066, 55, 90, 2.0);
    L.position.set(Math.cos(a) * 60, -7.5, Math.sin(a) * 60);
    root.add(L);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const L = new THREE.PointLight(0xffd2a0, 40, 46, 2.0);
    L.position.set(Math.cos(a) * 46, 3.6, Math.sin(a) * 46);
    root.add(L);
  }

  A.finish();
  scene.add(root);
  return { group: root };""")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/sky.js'
s = open(p, encoding='utf-8').read()
s = s.replace("haze: 0.45", "haze: 0.30").replace("haze: 0.5,", "haze: 0.34,").replace("haze: 0.58", "haze: 0.38")
open(p, 'w', encoding='utf-8').write(s)
print('patch7 ok')
