import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  procedural decals: warning plates, stencils, rust runs, scorch
 * ------------------------------------------------------------------ */
function canvasTex(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function warnTex() {
  return canvasTex(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    // yellow triangle
    g.beginPath();
    g.moveTo(0, -S * 0.42); g.lineTo(S * 0.42, S * 0.34); g.lineTo(-S * 0.42, S * 0.34); g.closePath();
    g.fillStyle = '#e8b529'; g.fill();
    g.lineWidth = S * 0.045; g.strokeStyle = '#1a1712'; g.stroke();
    // exclamation
    g.fillStyle = '#1a1712';
    g.fillRect(-S * 0.035, -S * 0.20, S * 0.07, S * 0.30);
    g.beginPath(); g.arc(0, S * 0.20, S * 0.045, 0, 7); g.fill();
    g.restore();
  });
}

function codeTex(text, sub) {
  return canvasTex(512, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20242a';
    g.font = `bold ${S * 0.30}px "Segoe UI", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, S / 2, S * 0.42);
    g.fillStyle = '#c9a227';
    g.fillRect(S * 0.18, S * 0.62, S * 0.64, S * 0.012);
    g.fillStyle = '#8d939c';
    g.font = `600 ${S * 0.075}px "Segoe UI", Arial, sans-serif`;
    g.fillText(sub, S / 2, S * 0.72);
  });
}

function rustTex() {
  return canvasTex(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      const x = S * 0.5 + (Math.random() - 0.5) * S * 0.20;
      const y = Math.random() * S;
      const h = 20 + Math.random() * 90;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, `rgba(122,64,26,${0.30 + Math.random() * 0.35})`);
      grd.addColorStop(1, 'rgba(122,64,26,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, 1.5 + Math.random() * 3.5, h);
    }
  });
}

function burnTex() {
  return canvasTex(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 40; i++) {
      const r = S * (0.10 + Math.random() * 0.30);
      const x = S * 0.5 + (Math.random() - 0.5) * S * 0.3;
      const y = S * 0.5 + (Math.random() - 0.5) * S * 0.3;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(16,12,10,0.55)');
      grd.addColorStop(1, 'rgba(16,12,10,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}

export function createDecals(M, scene) {
  const root = new THREE.Group();
  root.name = 'decals';

  const mkMat = (tex, tint = 0xffffff) => new THREE.MeshStandardMaterial({
    map: tex, color: tint, transparent: true, alphaTest: 0.12,
    roughness: 0.85, metalness: 0.05, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });

  const warn = mkMat(warnTex());
  const code1 = mkMat(codeTex('H-05', 'HAMMOND ROBOTICS · SITE 05'));
  const code2 = mkMat(codeTex('DANGER', 'MOLTEN CORE · DO NOT ENTER'));
  const rust = mkMat(rustTex());
  const burn = mkMat(burnTex());

  const addPlane = (mat, w, h, px, py, pz, yaw, tilt = 0) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (tilt) g.rotateX(tilt);
    g.rotateY(yaw);
    g.translate(px, py, pz);
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 4;
    root.add(m);
    return m;
  };

  /* stencils wrapped on the four column faces */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a), z = Math.sin(a);
    const yaw = Math.atan2(x, z);
    const rr = 20.9;

    addPlane(code1, 11, 11, x * rr, 74, z * rr, yaw);
    addPlane(warn, 5.0, 5.0, x * rr, 46, z * rr, yaw);

    // rust runs beneath the panel seams
    addPlane(rust, 7.0, 13.0, x * rr, 58, z * rr, yaw);
    addPlane(rust, 5.0, 9.0, x * rr, 30, z * rr, yaw);

    if (i % 2 === 0) addPlane(burn, 8.0, 8.0, x * rr, 88, z * rr, yaw);
  }

  /* deck-level markings, laid flat just above the plate */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const r = 58;
    addPlane(warn, 4.2, 4.2, Math.cos(a) * r, 0.08, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)), -Math.PI / 2);
  }
  addPlane(code2, 14, 14, 0, 0.08, 62, 0, -Math.PI / 2);

  scene.add(root);
  return { group: root };
}
