# A. restore the ring of canyon mountains around the basin
p = 'src/world/terrain.js'
s = open(p, encoding='utf-8').read()
s = s.replace("h += t1 * (6 + Math.pow(ridge1, 1.30) * 16) * gate;",
              "h += t1 * (14 + Math.pow(ridge1, 1.30) * 165) * gate;")
s = s.replace("h += t2 * (24 + Math.pow(ridge2, 1.25) * 78);",
              "h += t2 * (40 + Math.pow(ridge2, 1.25) * 240);")
open(p, 'w', encoding='utf-8').write(s)

# B/C/D. kill the blur: DOF off by default + tight depth range + less grain/CA
p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace("quality: { dof: true },", "quality: { dof: false },")
s = s.replace("const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 7000);",
              "const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.6, 6000);")
s = s.replace("window.addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'Escape') document.exitPointerLock?.(); });",
              """window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Escape') document.exitPointerLock?.();
  if (e.code === 'KeyD') {
    app.quality.dof = !app.quality.dof;
    if (app.hud?.toast) app.hud.toast('DEPTH OF FIELD ' + (app.quality.dof ? 'ON' : 'OFF'));
  }
});""")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/cinema.js'
s = open(p, encoding='utf-8').read()
s = s.replace("app.post.bokeh.enabled = !!app.quality?.dof;", "app.post.bokeh.enabled = !!app.quality?.dof;")
open(p, 'w', encoding='utf-8').write(s)

p = 'src/lib/post.js'
s = open(p, encoding='utf-8').read()
s = s.replace("bokeh.enabled = opts.dof !== false;", "bokeh.enabled = !!opts.dof;")
s = s.replace("{ focus: 60, aperture: 0.00025, maxblur: 0.006 }", "{ focus: 60, aperture: 0.00004, maxblur: 0.0028 }")
s = s.replace("uGrain: { value: 0.016 },", "uGrain: { value: 0.006 },")
s = s.replace("uCA: { value: 0.0014 },", "uCA: { value: 0.00055 },")
open(p, 'w', encoding='utf-8').write(s)
print('ring restored + blur fixed')
