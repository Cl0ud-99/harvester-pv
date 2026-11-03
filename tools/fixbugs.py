# 1. DOF: focus on the subject, shallower aperture
p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("""    // depth of field
    if (app.post?.bokeh) {
      app.post.bokeh.enabled = !!app.quality?.dof;
      if (app.post.bokeh.materialBokeh) {
        app.post.bokeh.materialBokeh.uniforms.focus.value = lerp(s.focus[0], s.focus[1], e);
        app.post.bokeh.materialBokeh.uniforms.aperture.value = s.aperture;
        app.post.bokeh.materialBokeh.uniforms.maxblur.value = s.maxblur;
      }
    }""", """    // depth of field: always focus on the shot's subject distance
    if (app.post?.bokeh) {
      app.post.bokeh.enabled = !!app.quality?.dof;
      const mb = app.post.bokeh.materialBokeh;
      if (mb) {
        const d = camera.position.distanceTo(tgt);
        mb.uniforms.focus.value = d;
        mb.uniforms.aperture.value = s.aperture;
        mb.uniforms.maxblur.value = s.maxblur;
      }
    }""")
s = s.replace("aperture: 0.00012, maxblur: 0.005,", "aperture: 0.000045, maxblur: 0.0035,")
s = s.replace("aperture: 0.00016, maxblur: 0.005,", "aperture: 0.00006, maxblur: 0.0038,")
s = s.replace("aperture: 0.00024, maxblur: 0.006,", "aperture: 0.00008, maxblur: 0.004,")
s = s.replace("aperture: 0.00014, maxblur: 0.005,", "aperture: 0.00005, maxblur: 0.0032,")
s = s.replace("aperture: 0.00026, maxblur: 0.006,", "aperture: 0.00009, maxblur: 0.004,")
s = s.replace("aperture: 0.00012, maxblur: 0.004,", "aperture: 0.00005, maxblur: 0.003,")
open(p, 'w', encoding='utf-8').write(s)

# 2. mouse Y inverted + no DOF in roam
p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.45, 1.45);",
              "player.pitch = clamp(player.pitch + e.movementY * 0.0022, -1.45, 1.45);")
s = s.replace("""  if (m === 'orbit') {
    controls.enabled = true;""", """  if (post?.bokeh) post.bokeh.enabled = false;
  if (m === 'orbit') {
    controls.enabled = true;""")
open(p, 'w', encoding='utf-8').write(s)

# 3. dead blacks: stronger ambient + cool fill, softer AO, lifted shadows
p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("const hemi = new THREE.HemisphereLight(0x7fa8cf, 0x4a3a28, 0.42);",
              "const hemi = new THREE.HemisphereLight(0x8fb2d4, 0x5a4632, 0.95);")
s = s.replace("hemi.intensity = lerp(0.58, 0.12, nightK);", "hemi.intensity = lerp(0.95, 0.30, nightK);")
s = s.replace("const fill = new THREE.DirectionalLight(0xffb070, 0.22);",
              "const fill = new THREE.DirectionalLight(0x9fc0e0, 0.55);")
s = s.replace("fill.position.set(120, 30, 60);", "fill.position.set(-140, 70, 120);")
s = s.replace("fill.intensity = lerp(0.22, 0.05, nightK);", "fill.intensity = lerp(0.55, 0.18, nightK);")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()
s = s.replace("gtao.blendIntensity = 0.6;", "gtao.blendIntensity = 0.32;")
s = s.replace("uLift: { value: new THREE.Vector3(0.0, 0.016, 0.042) },",
              "uLift: { value: new THREE.Vector3(0.020, 0.030, 0.052) },")
s = s.replace("uExposure: { value: 1.0 },", "uExposure: { value: 1.04 },")
open(p, 'w', encoding='utf-8').write(s)

# 4. one cliff language: heightfield becomes a base mound, buttes carry the silhouette
p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("h += t1 * (10 + Math.pow(ridge1, 1.30) * 210) * gate;",
              "h += t1 * (8 + Math.pow(ridge1, 1.30) * 62) * gate;")
s = s.replace("h += t2 * (40 + Math.pow(ridge2, 1.25) * 300);",
              "h += t2 * (30 + Math.pow(ridge2, 1.25) * 210);")
open(p, 'w', encoding='utf-8').write(s)
print('fixes applied')
