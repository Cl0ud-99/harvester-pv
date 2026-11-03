import re
p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()

s = s.replace("""    if (radius < 460) {
      const d = Math.abs(angDiff(angle, RIFT_A));
      if (d < 0.30) return;
      if (d < 0.44 && radius < 320) return;
    }""", """    if (radius < 520) {
      const d = Math.abs(angDiff(angle, RIFT_A));
      if (d < 0.30) return;
      if (d < 0.46 && radius < 420) return;
    }
    // never let a butte swallow the hero camera station
    if (radius < 620) {
      const px = Math.cos(angle) * radius, pz = Math.sin(angle) * radius;
      if (Math.hypot(px - CAM_X, pz - CAM_Z) < 165) return;
    }""")

s = s.replace("""  const heroes = [
    [-0.14, 372, 196, 0.62], [-1.44, 396, 248, 0.58], [-0.92, 470, 150, 0.70],
    [2.30, 388, 216, 0.60], [3.12, 430, 262, 0.55], [4.40, 402, 176, 0.66],
    [5.36, 366, 224, 0.58], [0.88, 408, 158, 0.68], [2.70, 512, 300, 0.50],
  ];""", """  const heroes = [
    [-0.20, 470, 200, 0.48], [-1.30, 500, 250, 0.44], [-0.86, 600, 160, 0.56],
    [2.30, 520, 220, 0.46], [3.12, 566, 268, 0.42], [4.40, 540, 180, 0.52],
    [5.36, 492, 230, 0.45], [0.88, 560, 164, 0.54], [2.70, 660, 310, 0.40],
  ];""")

s = s.replace("const r = 390 + rnd() * 190;", "const r = 520 + rnd() * 220;")
s = s.replace("put(a, r, 170 + rnd() * 190, 0.52 + rnd() * 0.22, i + 1);", "put(a, r, 170 + rnd() * 190, 0.42 + rnd() * 0.18, i + 1);")
s = s.replace("const r = 460 + rnd() * 360;", "const r = 560 + rnd() * 420;")
s = s.replace("put(a, r, 120 + rnd() * 250, 0.50 + rnd() * 0.28, i);", "put(a, r, 120 + rnd() * 250, 0.38 + rnd() * 0.20, i);")
s = s.replace("const r = 900 + rnd() * 560;", "const r = 1040 + rnd() * 640;")
s = s.replace("put(a, r, 200 + rnd() * 300, 0.48 + rnd() * 0.30, i + 3, 0.24, false);", "put(a, r, 200 + rnd() * 300, 0.40 + rnd() * 0.26, i + 3, 0.24, false);")
s = s.replace("const RIFT_A = -0.72;", "const RIFT_A = -0.72;\nconst CAM_R = 300;\nconst CAM_X = Math.cos(RIFT_A) * CAM_R;\nconst CAM_Z = Math.sin(RIFT_A) * CAM_R;")

open(p, 'w', encoding='utf-8').write(s)
print('terrain patched')
