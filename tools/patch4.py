p = 'src/world/ring.js'
s = open(p, encoding='utf-8').read()

old = """  const skirt = new THREE.CylinderGeometry(R, 46, 20, 72, 1, true);
  skirt.translate(0, -10, 0);
  A.add(skirt, 'armourDirty');"""
new = """  // saucer hull: lathe profile -> a proper rounded megastructure underside
  const prof = [
    [R + 0.6, 0.6], [R + 1.2, -1.4], [R + 0.4, -4.0], [R - 3.0, -8.0],
    [R - 10.0, -12.5], [R - 20.0, -16.0], [R - 34.0, -19.0], [R - 50.0, -21.0], [14.0, -22.0],
  ].map(([r, y]) => new THREE.Vector2(Math.max(2, r), y));
  const skirt = new THREE.LatheGeometry(prof, 96);
  A.add(skirt, 'armourDirty');

  // big blue band riding the hull shoulder
  const band = new THREE.LatheGeometry([
    new THREE.Vector2(R + 1.4, -1.2), new THREE.Vector2(R + 1.5, -3.0), new THREE.Vector2(R + 0.6, -4.6),
  ], 96);
  A.add(band, 'armourBlue');

  // lower catwalk ring hugging the hull
  const cat = ringSector(R - 12.0, R - 8.0, 1.2, 0, TAU, 128);
  scaleUV(cat, 0.3);
  cat.translate(0, -12.6, 0);
  A.add(cat, 'deck');
  const catRail = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU;
    const a2 = ((i + 1) / 120) * TAU;
    const rr = R - 8.4;
    catRail.push(tube(new THREE.Vector3(Math.cos(a) * rr, -11.4, Math.sin(a) * rr), new THREE.Vector3(Math.cos(a2) * rr, -11.4, Math.sin(a2) * rr), 0.07, 0.07, 5));
    if (i % 4 === 0) catRail.push(tube(new THREE.Vector3(Math.cos(a) * rr, -12.6, Math.sin(a) * rr), new THREE.Vector3(Math.cos(a) * rr, -11.4, Math.sin(a) * rr), 0.08, 0.08, 5));
  }
  A.add(mergeList(catRail), 'steel');"""
assert old in s
s = s.replace(old, new)
open(p, 'w', encoding='utf-8').write(s)
print('ring patched')
