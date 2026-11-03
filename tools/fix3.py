import re

# ---- 1. one deck material: drop the glossy "apron" overlay ----
p = 'src/world/ring.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  // polished inner apron (reads reflective near the pit)
  const apron = ringSector(P + 1.0, P + 12.0, 0.16, 0, TAU, 160);
  scaleUV(apron, 0.22);
  apron.translate(0, 0.0, 0);
  A.add(apron, 'deckWet');""", "")
open(p, 'w', encoding='utf-8').write(s)

# ---- 2. tower core runs down into the lava ----
p = 'src/world/harvester.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  const core = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 9.6, H.coreTop + 10, 40, 1, true), coreMat);
  core.position.y = (H.coreTop - 10) / 2;""",
"""  const core = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 9.6, H.coreTop + 52, 40, 1, true), coreMat);
  core.position.y = (H.coreTop - 42) / 2;""")

# column shell + cage posts also continue into the pool
s = s.replace("""  const colGeos = [], colTrim = [], colVents = [];""",
"""  // skirt that carries the armoured column down into the molten pool
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(15.4, 17.2, 46, 8, 1, false),
    M.armourDirty,
  );
  skirt.rotation.y = Math.PI / 8;
  skirt.position.y = -23;
  skirt.castShadow = true; skirt.receiveShadow = true;
  root.add(skirt);

  const colGeos = [], colTrim = [], colVents = [];""")

s = s.replace("cage.push(tube(V(Math.cos(a) * 16.8, 0, Math.sin(a) * 16.8), V(Math.cos(a) * 14.4, H.crownTop, Math.sin(a) * 14.4), 0.5, 0.38, 5));",
              "cage.push(tube(V(Math.cos(a) * 16.8, -42, Math.sin(a) * 16.8), V(Math.cos(a) * 14.4, H.crownTop, Math.sin(a) * 14.4), 0.5, 0.38, 5));")
open(p, 'w', encoding='utf-8').write(s)

# ---- 3. shaft walls: warm soil, lit from the lava, not dead black ----
p = 'src/world/lava.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  const wallMat = M.rockDark.clone();
  wallMat.side = THREE.BackSide;""",
"""  const wallMat = M.rockDark.clone();
  wallMat.side = THREE.BackSide;
  wallMat.color = new THREE.Color(0x8a6a4c);
  wallMat.emissive = new THREE.Color(0x3a1204);
  wallMat.emissiveIntensity = 0.55;
  wallMat.roughness = 0.86;
  wallMat.envMapIntensity = 0.15;""")
s = s.replace("""  const lavaLight2 = new THREE.PointLight(0xff9a44, 16, 60, 2.0);
  lavaLight2.position.set(0, 2, 0);
  group.add(lavaLight2);""",
"""  const lavaLight2 = new THREE.PointLight(0xff9a44, 16, 60, 2.0);
  lavaLight2.position.set(0, 2, 0);
  group.add(lavaLight2);

  // bounce lights so the shaft walls are readable instead of pure black
  for (const [yy, ii, dd] of [[-8, 160, 120], [-20, 140, 110], [-31, 120, 100]]) {
    const L = new THREE.PointLight(0xff7b30, ii, dd, 2.0);
    L.position.set(0, yy, 0);
    group.add(L);
  }""")
open(p, 'w', encoding='utf-8').write(s)

# terrain: paint the carved shaft walls as warm soil
p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    const patch = fbm2(x * 0.055 + 9, z * 0.055 - 3, 2);""",
"""    const inner = 1 - smoothstep(SET.pitR + 2, SET.pitR + 26, Math.hypot(x, z));
    if (inner > 0.002) tmp.lerp(new THREE.Color(0x8a5f3e), inner * 0.85);
    const patch = fbm2(x * 0.055 + 9, z * 0.055 - 3, 2);""")
open(p, 'w', encoding='utf-8').write(s)
print('three fixes applied')
