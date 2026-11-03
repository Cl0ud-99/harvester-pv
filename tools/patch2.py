import io, re
p = 'src/world/sky.js'
s = open(p, encoding='utf-8').read()
s = s.replace('sunAz: -0.20', 'sunAz: -0.34').replace('sunAz: -0.18', 'sunAz: -0.32')
s = s.replace('sunAz: -0.16', 'sunAz: -0.30').replace('sunAz: -0.14', 'sunAz: -0.28')
s = s.replace('sunAz: -0.12', 'sunAz: -0.26')
open(p, 'w', encoding='utf-8').write(s)

p = 'src/main.js'
s = open(p, encoding='utf-8').read()
s = s.replace('sun.shadow.camera.left = -190;', 'sun.shadow.camera.left = -300;')
s = s.replace('sun.shadow.camera.right = 190;', 'sun.shadow.camera.right = 300;')
s = s.replace('sun.shadow.camera.top = 220;', 'sun.shadow.camera.top = 340;')
s = s.replace('sun.shadow.camera.bottom = -120;', 'sun.shadow.camera.bottom = -160;')
s = s.replace('sun.shadow.camera.far = 1000;', 'sun.shadow.camera.far = 1500;')
s = s.replace("sunPos.copy(sky.sunDir).multiplyScalar(420);", "sunPos.copy(sky.sunDir).multiplyScalar(600);")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
