p = 'src/world/ring.js'
s = open(p, encoding='utf-8').read()

old_under = """  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const L = new THREE.PointLight(0xffb066, 170, 130, 2.0);
    L.position.set(Math.cos(a) * 60, -7.5, Math.sin(a) * 60);
    root.add(L);
  }"""
new_under = """  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.2;
    const L = new THREE.PointLight(0xffb066, 340, 150, 2.0);
    L.position.set(Math.cos(a) * 60, -7.5, Math.sin(a) * 60);
    root.add(L);
  }"""
assert old_under in s
s = s.replace(old_under, new_under, 1)

old_deck = """  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const L = new THREE.PointLight(0xffd2a0, 110, 70, 2.0);
    L.position.set(Math.cos(a) * 46, 3.6, Math.sin(a) * 46);
    root.add(L);
  }"""
assert old_deck in s
s = s.replace(old_deck, "  // deck lamps removed: the lava bounce + shaft lights already cover this zone", 1)

open(p, 'w', encoding='utf-8').write(s)
print('lights 34 -> 22')
