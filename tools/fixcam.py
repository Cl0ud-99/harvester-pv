p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    a: { pos: V(322, 226, -282), target: V(0, 92, 0), fov: 40 },
    b: { pos: V(268, 190, -232), target: V(0, 100, 0), fov: 38 },""",
"""    a: { pos: V(246, 182, -214), target: V(0, 94, 0), fov: 42 },
    b: { pos: V(206, 156, -180), target: V(0, 102, 0), fov: 40 },""")
s = s.replace("focus: [320, 300], aperture: 0.000045, maxblur: 0.0035,",
              "focus: [330, 310], aperture: 0.00003, maxblur: 0.0028,")
open(p, 'w', encoding='utf-8').write(s)
print('shot0 moved inside the ring')
