p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()

# 1) fatter arms
s = s.replace("""const ARM_PROFILE = [
  [0.00, 17, 26, 14.0],
  [0.30, 42, 30, 12.6],
  [0.62, 66, 34, 11.0],
  [0.86, 83, 38, 9.6],
  [1.00, 92, 36, 8.6],
];""", """const ARM_PROFILE = [
  [0.00, 16, 30, 18.0],
  [0.30, 40, 36, 17.0],
  [0.62, 64, 42, 15.5],
  [0.86, 82, 46, 14.0],
  [1.00, 92, 44, 13.0],
];""")

# 2) vertical ribs on the column instead of window-like slats
s = s.replace("""  for (const ang of PETAL_ANGLES) {
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    for (let k = 0; k < 7; k++) {
      const t = 0.14 + k * 0.12;
      const y = lerp(4, 96, t);
      const r = lerp(22.0, 19.6, t);
      for (const s of [-1, 1]) {
        const c = dir.clone().multiplyScalar(r + 0.3).setY(y).addScaledVector(right, s * 5.8);
        const g = chunk(1.9, 4.6, 0.8);
        g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
        g.translate(c.x, c.y, c.z);
        colVents.push(g);
      }
    }
  }""", """  for (const ang of PETAL_ANGLES) {
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const right = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    // full-height vertical ribs: hard-surface spine, not windows
    for (const s of [-1, 0, 1]) {
      const c = dir.clone().multiplyScalar(21.0).addScaledVector(right, s * 6.2);
      const g = new THREE.BoxGeometry(2.2, 100, 1.6);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
      g.translate(c.x, 44, c.z);
      colVents.push(g);
    }
    // inset dark panel band with a single vertical shade band
    const pnl = new THREE.BoxGeometry(9.0, 62, 0.7);
    pnl.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
    pnl.translate(dir.x * 21.0, 58, dir.z * 21.0);
    colVents.push(pnl);
  }""")

# 3) wide flat crown canopy instead of a bullet
s = s.replace("""  const crownProfile = [[150, 19.0], [160, 24.0], [178, 26.0], [196, 25.0], [207, 21.0], [214, 15.0]];""",
              """  const crownProfile = [[150, 20.0], [156, 30.0], [168, 52.0], [182, 58.0], [194, 56.0], [202, 40.0], [208, 24.0]];""")
s = s.replace("""  for (const [y, r, hh] of [[154.0, 20.4, 1.9], [166.0, 25.4, 1.4]]) {""",
              """  for (const [y, r, hh] of [[153.0, 21.0, 2.2], [170.0, 54.0, 1.6]]) {""")
s = s.replace("""    const plate = new THREE.PlaneGeometry(24.0, 26.0);
    plate.rotateY(yaw);
    plate.translate(dir.x * 20.4, H.logoY, dir.z * 20.4);
    A.add(plate, 'armourDirty');

    const logo = new THREE.PlaneGeometry(14.0, 14.0);
    logo.rotateY(yaw);
    logo.translate(dir.x * 20.8, H.logoY + 1.0, dir.z * 20.8);""",
              """    const plate = new THREE.PlaneGeometry(46.0, 30.0);
    plate.rotateY(yaw);
    plate.translate(dir.x * 40.0, H.logoY, dir.z * 40.0);
    A.add(plate, 'armourDirty');

    const logo = new THREE.PlaneGeometry(20.0, 20.0);
    logo.rotateY(yaw);
    logo.translate(dir.x * 40.4, H.logoY + 1.5, dir.z * 40.4);""")
s = s.replace("logoY: 180,", "logoY: 178,")
s = s.replace("""  const cheeks = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 2;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const g = chunk(7.0, 44, 12.0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
    g.translate(dir.x * 21.6, 176, dir.z * 21.6);
    cheeks.push(g);
  }
  A.add(mergeList(cheeks), 'steel');""", """  const cheeks = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 2;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const g = chunk(9.0, 30, 16.0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(dir.x, dir.z)));
    g.translate(dir.x * 46, 180, dir.z * 46);
    cheeks.push(g);
  }
  A.add(mergeList(cheeks), 'steel');""")
open(p, 'w', encoding='utf-8').write(s)
print('tower v3')
