p = 'src/world/lava.js'
s = open(p, encoding='utf-8').read()

anchor = "  /* floating embers */"
add = """  /* warm bounce onto the deck rim: lava light spilling over the lip */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const L = new THREE.PointLight(0xff8a3c, 260, 120, 2.0);
    L.position.set(Math.cos(a) * (SET.pitR - 4), 2.5, Math.sin(a) * (SET.pitR - 4));
    group.add(L);
  }

  /* floating embers */"""

assert anchor in s
s = s.replace(anchor, add, 1)
open(p, 'w', encoding='utf-8').write(s)
print('lava bounce added')
