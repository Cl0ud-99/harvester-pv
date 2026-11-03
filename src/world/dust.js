import * as THREE from 'three';

/* soft round sprite — without it PointsMaterial renders hard squares */
function dotSprite() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Drifting ash / dust motes. Cheap atmosphere: keeps a 160 m box of particles
 * anchored to the camera, so density stays constant wherever you roam.
 */
export function createDust(scene, opts = {}) {
  const N = opts.count || 1100;
  const R = opts.radius || 80;
  const H = opts.height || 70;

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * R * 2;
    pos[i * 3 + 1] = Math.random() * H;
    pos[i * 3 + 2] = (Math.random() - 0.5) * R * 2;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xffd8a8,
    map: dotSprite(),
    size: 0.16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.30,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'dust';
  points.frustumCulled = false;
  scene.add(points);

  const center = new THREE.Vector3();

  return {
    points,
    update(dt, t, camera) {
      center.set(camera.position.x, 0, camera.position.z);
      const p = geo.attributes.position;
      for (let i = 0; i < N; i++) {
        const s = seed[i];
        let x = p.getX(i) + (0.55 + Math.sin(t * 0.3 + s) * 0.35) * dt;
        let y = p.getY(i) + (0.16 + Math.sin(t * 0.7 + s * 1.7) * 0.12) * dt;
        let z = p.getZ(i) + (Math.cos(t * 0.24 + s) * 0.42) * dt;

        // wrap inside a box that follows the camera
        const dx = x - center.x, dz = z - center.z;
        if (dx > R) x -= R * 2; else if (dx < -R) x += R * 2;
        if (dz > R) z -= R * 2; else if (dz < -R) z += R * 2;
        if (y > H) y -= H;

        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
    },
  };
}
