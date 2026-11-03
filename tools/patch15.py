p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    a: { pos: V(46, 2.4, 16), target: V(0, -26, -2), fov: 58 },
    b: { pos: V(40, 2.1, 24), target: V(0, -32, 0), fov: 56 },""",
"""    a: { pos: V(158, 3.2, 96), target: V(0, 120, 0), fov: 54 },
    b: { pos: V(138, 3.6, 108), target: V(0, 128, 0), fov: 52 },""")
s = s.replace("focus: [40, 36], aperture: 0.0003, maxblur: 0.007,", "focus: [190, 175], aperture: 0.00014, maxblur: 0.005,")
s = s.replace("num: '04', label: 'THE WELL'", "num: '04', label: 'THE BASIN'")
open(p, 'w', encoding='utf-8').write(s)

p = 'sheet.html'
s = open(p, encoding='utf-8').read()
s = s.replace("<figcaption>04 THE WELL</figcaption>", "<figcaption>04 THE BASIN</figcaption>")
open(p, 'w', encoding='utf-8').write(s)
print('shot4 -> basin')
