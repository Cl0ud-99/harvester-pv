p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
start = s.index('export const SHOTS = [')
end = s.index('];', start) + 2
new = '''export const SHOTS = [
  {
    num: '01', label: 'ARRIVAL', dur: 12,
    time: [0.34, 0.30],
    focus: [320, 300], aperture: 0.00012, maxblur: 0.005,
    a: { pos: V(316, 108, -276), target: V(0, 112, 0), fov: 44 },
    b: { pos: V(262, 84, -226), target: V(0, 118, 0), fov: 42 },
  },
  {
    num: '02', label: 'THE TOWER', dur: 11,
    time: [0.30, 0.28],
    focus: [180, 165], aperture: 0.00016, maxblur: 0.005,
    a: { pos: V(96, 3.2, -34), target: V(0, 150, 0), fov: 62 },
    b: { pos: V(84, 4.0, -52), target: V(0, 162, 0), fov: 60 },
  },
  {
    num: '03', label: 'THE DECK', dur: 10,
    time: [0.38, 0.42],
    focus: [58, 52], aperture: 0.00022, maxblur: 0.006,
    a: { pos: V(62, 2.6, 34), target: V(12, 34, -6), fov: 46 },
    b: { pos: V(52, 3.0, 52), target: V(6, 30, -18), fov: 44 },
  },
  {
    num: '04', label: 'THE WELL', dur: 9,
    time: [0.42, 0.47],
    focus: [40, 36], aperture: 0.0003, maxblur: 0.007,
    a: { pos: V(46, 2.4, 16), target: V(0, -26, -2), fov: 58 },
    b: { pos: V(40, 2.1, 24), target: V(0, -32, 0), fov: 56 },
  },
  {
    num: '05', label: 'THE ARM', dur: 10,
    time: [0.47, 0.52],
    focus: [72, 66], aperture: 0.00026, maxblur: 0.006,
    a: { pos: V(58, 74, 46), target: V(0, 158, 0), fov: 52 },
    b: { pos: V(46, 92, 58), target: V(0, 168, 0), fov: 50 },
  },
  {
    num: '06', label: 'HARVEST', dur: 13,
    time: [0.56, 0.70],
    focus: [260, 240], aperture: 0.00012, maxblur: 0.004,
    a: { pos: V(238, 62, -196), target: V(0, 130, 0), fov: 40 },
    b: { pos: V(196, 44, -164), target: V(0, 140, 0), fov: 38 },
  },
];'''
s = s[:start] + new + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('shots updated')
