p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
# the heightfield becomes a rolling basin + a hazy far ridge; the buttes are the canyon
s = s.replace("h += t1 * (8 + Math.pow(ridge1, 1.30) * 62) * gate;",
              "h += t1 * (6 + Math.pow(ridge1, 1.30) * 16) * gate;")
s = s.replace("h += t2 * (30 + Math.pow(ridge2, 1.25) * 210);",
              "h += t2 * (24 + Math.pow(ridge2, 1.25) * 78);")
# closer butte ring so it reads as the basin wall
s = s.replace("const r = 540 + rnd() * 260;", "const r = 430 + rnd() * 240;")
s = s.replace("put(a, 470 + rnd() * 120, 200 + rnd() * 140, 0.40, i + 2);",
              "put(a, 420 + rnd() * 110, 190 + rnd() * 150, 0.42, i + 2);")
open(p, 'w', encoding='utf-8').write(s)
print('cliff language unified')
