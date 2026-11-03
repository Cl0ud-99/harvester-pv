p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    a: { pos: V(64, 3.4, 46), target: V(14, 30, -8), fov: 50 },
    b: { pos: V(50, 3.8, 60), target: V(8, 26, -14), fov: 48 },""",
"""    a: { pos: V(114, 3.0, -78), target: V(56, 18, -40), fov: 54 },
    b: { pos: V(100, 3.6, -64), target: V(50, 22, -34), fov: 52 },""")
s = s.replace("focus: [58, 52], aperture: 0.00022, maxblur: 0.006,", "focus: [64, 58], aperture: 0.00024, maxblur: 0.006,")
open(p, 'w', encoding='utf-8').write(s)
print('shot3 fixed')
