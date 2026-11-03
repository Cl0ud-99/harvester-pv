# 1) ground texture: 2048px + large-scale macro variation so tiling is not obvious
p = 'src/lib/textures.js'
s = open(p, encoding='utf-8').read()
s = s.replace("const size = o.size || 1024;\n  const rnd = mulberry32(31);", "const size = o.size || 2048;\n  const rnd = mulberry32(31);")
s = s.replace("""      const n = fbm2(u * 5, v * 5, 5) * 0.5 + 0.5;
      const m = fbm2(u * 17 + 11, v * 17 - 7, 4) * 0.5 + 0.5;
      const dirt = clamp((0.52 - n) * 3.2, 0, 1);""",
"""      const n = fbm2(u * 5, v * 5, 5) * 0.5 + 0.5;
      const m = fbm2(u * 17 + 11, v * 17 - 7, 4) * 0.5 + 0.5;
      // very low frequency tint kills visible tiling at distance
      const macro = fbm2(u * 1.7 + 23, v * 1.7 - 9, 3) * 0.5 + 0.5;
      const dirt = clamp((0.52 - n) * 3.2, 0, 1);""")
s = s.replace("""      const gr = [lerp(88, 152, m), lerp(102, 168, m), lerp(44, 60, m)];
      const dr = [lerp(84, 124, m), lerp(68, 96, m), lerp(46, 62, m)];""",
"""      const gr = [lerp(88, 152, m) * (0.78 + macro * 0.44), lerp(102, 168, m) * (0.80 + macro * 0.36), lerp(44, 60, m) * (0.74 + macro * 0.5)];
      const dr = [lerp(84, 124, m) * (0.80 + macro * 0.38), lerp(68, 96, m) * (0.80 + macro * 0.34), lerp(46, 62, m) * (0.82 + macro * 0.3)];""")
open(p, 'w', encoding='utf-8').write(s)

# 2) fewer repeats + 2k map
p = 'src/lib/materials.js'
s = open(p, encoding='utf-8').read()
s = s.replace("const ground = groundSet({ repeat: [60, 60] });", "const ground = groundSet({ repeat: [30, 30], size: 2048 });")
open(p, 'w', encoding='utf-8').write(s)

# 3) grass belt shrinks to roughly half the area; mountains untouched
p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    const n = fbm2(x * 0.018 + 4, z * 0.018, 3) * 0.5 + 0.5;
    tmp.copy(cMoss).lerp(cMossDry, clamp(n * 1.2 - 0.15, 0, 1));""",
"""    const n = fbm2(x * 0.018 + 4, z * 0.018, 3) * 0.5 + 0.5;
    const macro = fbm2(x * 0.0035 + 17, z * 0.0035 - 5, 3) * 0.5 + 0.5;
    // moss belt only out to ~330 m (about half the previous grass area)
    const mossMask = 1 - smoothstep(210, 335, Math.hypot(x, z));
    tmp.copy(cMoss).lerp(cMossDry, clamp(n * 1.2 - 0.15, 0, 1));
    tmp.lerp(cDirt, (1 - mossMask) * 0.72);
    tmp.multiplyScalar(0.84 + macro * 0.34);""")
open(p, 'w', encoding='utf-8').write(s)
print('grass: 2k texture, less tiling, half area')
