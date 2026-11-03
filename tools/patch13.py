p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    a: { pos: V(316, 108, -276), target: V(0, 112, 0), fov: 44 },
    b: { pos: V(262, 84, -226), target: V(0, 118, 0), fov: 42 },""",
"""    a: { pos: V(322, 226, -282), target: V(0, 92, 0), fov: 40 },
    b: { pos: V(268, 190, -232), target: V(0, 100, 0), fov: 38 },""")
s = s.replace("""    a: { pos: V(62, 2.6, 34), target: V(12, 34, -6), fov: 46 },
    b: { pos: V(52, 3.0, 52), target: V(6, 30, -18), fov: 44 },""",
"""    a: { pos: V(64, 3.4, 46), target: V(14, 30, -8), fov: 50 },
    b: { pos: V(50, 3.8, 60), target: V(8, 26, -14), fov: 48 },""")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/ring.js'
s = open(p, encoding='utf-8').read()
s = s.replace("const L = new THREE.PointLight(0xffb066, 55, 90, 2.0);", "const L = new THREE.PointLight(0xffb066, 170, 130, 2.0);")
s = s.replace("const L = new THREE.PointLight(0xffd2a0, 40, 46, 2.0);", "const L = new THREE.PointLight(0xffd2a0, 110, 70, 2.0);")
open(p, 'w', encoding='utf-8').write(s)
print('shots tuned')
