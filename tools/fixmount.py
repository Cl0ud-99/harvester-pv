p = 'src/lib/materials.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  M.moss = new THREE.MeshStandardMaterial({""",
"""  M.rockVC = new THREE.MeshStandardMaterial({
    map: rock.map, normalMap: rock.normalMap, normalScale: new THREE.Vector2(2.3, 2.3),
    color: 0xffffff, vertexColors: true, metalness: 0.03, roughness: 0.93, envMapIntensity: 0.20,
  });

  M.moss = new THREE.MeshStandardMaterial({""")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""  const merged = mergeList(geos);
  const mesh = new THREE.Mesh(merged, M.rock);""",
"""  const merged = mergeList(geos);

  // paint the buttes with the same palette as the ground so the two cliff
  // languages read as one landscape: mossy feet, basalt flanks, pale crowns
  {
    const p3 = merged.attributes.position;
    const cols = new Float32Array(p3.count * 3);
    const cMossA = new THREE.Color(0x5f6d2e);
    const cMossB = new THREE.Color(0x7d7a35);
    const cRockA = new THREE.Color(0x544d46);
    const cRockB = new THREE.Color(0x6d665d);
    const cTop = new THREE.Color(0x7e766c);
    const tmp = new THREE.Color();
    for (let i = 0; i < p3.count; i++) {
      const x = p3.getX(i), y = p3.getY(i), z = p3.getZ(i);
      const n = fbm2(x * 0.02 + 7, z * 0.02 - 3, 3) * 0.5 + 0.5;
      const foot = 1 - smoothstep(-2, 34, y);
      const high = smoothstep(90, 260, y);
      tmp.copy(cRockA).lerp(cRockB, n);
      tmp.lerp(cMossA.clone().lerp(cMossB, n), foot * 0.85);
      tmp.lerp(cTop, high * 0.55);
      // vertical streak variation
      tmp.multiplyScalar(0.9 + 0.18 * (fbm2(x * 0.09, z * 0.09, 2) * 0.5 + 0.5));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    merged.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  const mesh = new THREE.Mesh(merged, M.rockVC);""")
open(p, 'w', encoding='utf-8').write(s)
print('butte vertex colours added')
