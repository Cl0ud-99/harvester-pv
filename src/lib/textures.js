import * as THREE from 'three';
import { mulberry32, fbm2, noise2, clamp, lerp } from './util.js';

const cache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function tex(cv, { srgb = true, repeat = [1, 1], aniso = 8, wrap = THREE.RepeatWrapping } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** Sobel height → normal map (linear-space). */
export function normalFromCanvas(src, strength = 2.2) {
  const s = src.width;
  const sctx = src.getContext('2d');
  const data = sctx.getImageData(0, 0, s, s).data;
  const h = new Float32Array(s * s);
  for (let i = 0; i < s * s; i++) {
    h[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }
  const out = canvas(s);
  const octx = out.getContext('2d');
  const img = octx.createImageData(s, s);
  const at = (x, y) => h[((y + s) % s) * s + ((x + s) % s)];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * s + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 *  ARMOUR PANEL — the signature Apex painted-metal sheet
 * ------------------------------------------------------------------ */
export function panelSet(key, o = {}) {
  if (cache.has(key)) return cache.get(key);
  const size = o.size || 1024;
  const base = o.base || '#d9d3c6';
  const seam = o.seam || 'rgba(28,26,24,0.55)';
  const accent = o.accent || null;
  const rows = o.rows || 4;
  const cols = o.cols || 4;
  const dirt = o.dirt ?? 0.55;
  const rust = o.rust ?? 0.35;
  const rnd = mulberry32(o.seed || 7);

  /* ---- albedo ---- */
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  // broad tonal blotches
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x / size * 3.1, y / size * 3.1, 4) * 0.5 + 0.5;
      const n2 = noise2(x * 0.06, y * 0.06) * 0.5 + 0.5;
      const k = 0.86 + n * 0.24 + n2 * 0.06;
      const i = (y * size + x) * 4;
      img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
    }
  }
  g.putImageData(img, 0, 0);

  // panel seams
  const cw = size / cols, ch = size / rows;
  g.lineWidth = Math.max(1.5, size / 512);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * ch;
      g.strokeStyle = seam;
      g.strokeRect(x + 0.5, y + 0.5, cw, ch);
      // inner highlight on the top-left of each plate
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.moveTo(x + 2, y + ch - 3); g.lineTo(x + 2, y + 2); g.lineTo(x + cw - 3, y + 2); g.stroke();
      // random sub-panel
      if (rnd() > 0.55) {
        g.strokeStyle = 'rgba(20,20,20,0.28)';
        const yy = y + ch * (0.3 + rnd() * 0.4);
        g.beginPath(); g.moveTo(x + 3, yy); g.lineTo(x + cw - 3, yy); g.stroke();
      }
    }
  }

  // rivets
  for (let i = 0; i < cols * rows * 10; i++) {
    const x = rnd() * size, y = rnd() * size;
    const rr = 1 + rnd() * 1.4;
    g.fillStyle = 'rgba(30,28,26,0.30)';
    g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.5, 0, 6.283); g.fill();
  }

  // blue accent stripe
  if (accent) {
    g.fillStyle = accent;
    g.globalAlpha = 0.92;
    g.fillRect(0, size * 0.62, size, size * 0.035);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, size * 0.62, size, size * 0.006);
  }

  // rust / grime streaks running down
  for (let i = 0; i < 90 * rust; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const len = (0.04 + rnd() * 0.3) * size;
    const w = 1 + rnd() * 7;
    const grd = g.createLinearGradient(x, y, x, y + len);
    const a = 0.02 + rnd() * 0.1 * rust;
    grd.addColorStop(0, `rgba(86,52,26,${a})`);
    grd.addColorStop(0.55, `rgba(120,70,32,${a * 0.7})`);
    grd.addColorStop(1, 'rgba(120,70,32,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, w, len);
  }
  // dirt pooling near seams
  for (let i = 0; i < 60 * dirt; i++) {
    const x = rnd() * size, y = rnd() * size;
    const r = (0.02 + rnd() * 0.07) * size;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(52,44,34,${0.05 + rnd() * 0.09})`);
    grd.addColorStop(1, 'rgba(52,44,34,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* ---- height (same seams, no colour) ---- */
  const hc = canvas(size);
  const h = hc.getContext('2d');
  h.fillStyle = '#808080';
  h.fillRect(0, 0, size, size);
  h.lineWidth = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * ch;
      h.strokeStyle = 'rgba(0,0,0,0.85)';
      h.strokeRect(x + 0.5, y + 0.5, cw, ch);
    }
  }
  for (let i = 0; i < 4000; i++) {
    const x = rnd() * size, y = rnd() * size;
    h.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},0.05)`;
    h.fillRect(x, y, 2, 2);
  }

  /* ---- roughness ---- */
  const rc = canvas(size);
  const r2 = rc.getContext('2d');
  r2.fillStyle = o.roughBase || '#8a8a8a';
  r2.fillRect(0, 0, size, size);
  for (let i = 0; i < 220 * dirt; i++) {
    const x = rnd() * size, y = rnd() * size;
    const rr = (0.01 + rnd() * 0.06) * size;
    const grd = r2.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, 'rgba(210,210,210,0.5)');
    grd.addColorStop(1, 'rgba(210,210,210,0)');
    r2.fillStyle = grd;
    r2.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 120 * rust; i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = (0.05 + rnd() * 0.25) * size;
    r2.fillStyle = 'rgba(240,240,240,0.35)';
    r2.fillRect(x, y, 1 + rnd() * 4, len);
  }

  const out = {
    map: tex(cv, { srgb: true, repeat: o.repeat || [1, 1] }),
    normalMap: tex(normalFromCanvas(hc, o.normalStrength || 1.1), { srgb: false, repeat: o.repeat || [1, 1] }),
    roughnessMap: tex(rc, { srgb: false, repeat: o.repeat || [1, 1] }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  GROUND — mossy volcanic soil + gravel, tileable-ish
 * ------------------------------------------------------------------ */
export function groundSet(o = {}) {
  const key = 'ground' + (o.seed || 0);
  if (cache.has(key)) return cache.get(key);
  const size = o.size || 2048;
  const rnd = mulberry32(31);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#5e5f30';
  g.fillRect(0, 0, size, size);

  // moss / grass patches via fbm
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm2(u * 5, v * 5, 5) * 0.5 + 0.5;
      const m = fbm2(u * 17 + 11, v * 17 - 7, 4) * 0.5 + 0.5;
      // very low frequency tint kills visible tiling at distance
      const macro = fbm2(u * 1.7 + 23, v * 1.7 - 9, 3) * 0.5 + 0.5;
      const dirt = clamp((0.52 - n) * 3.2, 0, 1);
      // grass #6d7a33 -> #98a544 ; dirt #5b4a34 -> #7a6042
      const gr = [lerp(88, 152, m) * (0.78 + macro * 0.44), lerp(102, 168, m) * (0.80 + macro * 0.36), lerp(44, 60, m) * (0.74 + macro * 0.5)];
      const dr = [lerp(84, 124, m) * (0.80 + macro * 0.38), lerp(68, 96, m) * (0.80 + macro * 0.34), lerp(46, 62, m) * (0.82 + macro * 0.3)];
      const i = (y * size + x) * 4;
      img.data[i] = lerp(gr[0], dr[0], dirt);
      img.data[i + 1] = lerp(gr[1], dr[1], dirt);
      img.data[i + 2] = lerp(gr[2], dr[2], dirt);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // gravel speckle
  for (let i = 0; i < 12000; i++) {
    const x = rnd() * size, y = rnd() * size, r = 0.5 + rnd() * 2.2;
    const t = rnd();
    g.fillStyle = t > 0.6 ? `rgba(150,144,128,${0.05 + rnd() * 0.10})` : `rgba(38,34,26,${0.05 + rnd() * 0.12})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // dry grass tufts streaks
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(${140 + rnd() * 40},${150 + rnd() * 30},${60 + rnd() * 30},${0.10 + rnd() * 0.18})`;
    g.lineWidth = 0.7 + rnd();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y - rnd() * 9); g.stroke();
  }

  // height
  const hc = canvas(size);
  const h = hc.getContext('2d');
  const himg = h.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2(x / size * 9, y / size * 9, 4) * 0.5 + 0.5;
      const v = 90 + n * 120 + (rnd() - 0.5) * 22;
      const i = (y * size + x) * 4;
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = v; himg.data[i + 3] = 255;
    }
  }
  h.putImageData(himg, 0, 0);

  const rc = canvas(size);
  const r2 = rc.getContext('2d');
  r2.fillStyle = '#d0d0d0'; r2.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const x = rnd() * size, y = rnd() * size, rr = 20 + rnd() * 120;
    const grd = r2.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, 'rgba(90,90,90,0.55)');
    grd.addColorStop(1, 'rgba(90,90,90,0)');
    r2.fillStyle = grd; r2.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  const out = {
    map: tex(cv, { srgb: true, repeat: o.repeat || [24, 24], aniso: 16 }),
    normalMap: tex(normalFromCanvas(hc, 2.0), { srgb: false, repeat: o.repeat || [24, 24] }),
    roughnessMap: tex(rc, { srgb: false, repeat: o.repeat || [24, 24] }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  DECK METAL — large brushed plates for the main deck, not concrete
 * ------------------------------------------------------------------ */
export function deckMetalSet(o = {}) {
  const fineMode = !!o.fine;
  const key = 'deckMetal' + (o.seed || 0) + (fineMode ? 'F' : '');
  if (cache.has(key)) return cache.get(key);
  const size = o.size || 1024;
  const rnd = mulberry32(91);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#45494c'; g.fillRect(0, 0, size, size);

  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // long horizontal brushed grain + a very low-frequency mottle
      const brushed = fbm2(u * (fineMode ? 150.0 : 58.0) + 6.0, v * (fineMode ? 5.0 : 2.4), 3) * 0.5 + 0.5;
      const fine = fbm2(u * (fineMode ? 320.0 : 170.0) - 3.0, v * (fineMode ? 16.0 : 9.0), 2) * 0.5 + 0.5;
      const macro = fbm2(u * 2.1 + 9.0, v * 2.1 - 4.0, 3) * 0.5 + 0.5;
      const tone = (fineMode ? 0.90 : 0.82) + brushed * (fineMode ? 0.06 : 0.10) + fine * (fineMode ? 0.02 : 0.015) + macro * 0.04;
      const i = (y * size + x) * 4;
      img.data[i] = clamp((fineMode ? 0.34 : 0.30) * 255 * tone, 0, 255);
      img.data[i + 1] = clamp((fineMode ? 0.36 : 0.32) * 255 * tone, 0, 255);
      img.data[i + 2] = clamp((fineMode ? 0.38 : 0.34) * 255 * tone, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // plates: 2x2 on the main deck; a finer, lower-contrast 4x4 on the upper deck
  const seam = (x0, y0, x1, y1, a = 1) => {
    g.strokeStyle = `rgba(24,26,28,${0.72 * a})`; g.lineWidth = fineMode ? 4.4 : 5;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = `rgba(180,190,196,${0.16 * a})`; g.lineWidth = fineMode ? 1.6 : 1.3;
    g.beginPath(); g.moveTo(x0 + 2, y0); g.lineTo(x1 + 2, y1); g.stroke();
  };
  const cells = fineMode ? 4 : 2;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * size;
    seam(0, p, size, p, fineMode ? 0.55 : 1);
    seam(p, 0, p, size, fineMode ? 0.55 : 1);
  }

  // sparse fasteners at plate corners
  const rivet = (x, y, rr) => {
    g.fillStyle = 'rgba(30,32,34,0.55)'; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(190,196,200,0.20)'; g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.4, 0, 6.283); g.fill();
  };
  if (!fineMode) {
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      for (let k = 0; k < 3; k++) rivet(sx * size + (sx ? -14 : 14) + (k - 1) * 9, sy * size + (sy ? -14 : 14), 2.2);
    }
  } else {
    for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) rivet((i / 4) * size, (j / 4) * size, 1.2);
  }
  // occasional long polish scratch, never a dense speckle field
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size, len = 12 + rnd() * 90;
    g.strokeStyle = `rgba(210,216,220,${0.04 + rnd() * 0.08})`;
    g.lineWidth = 0.5 + rnd() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (rnd() - 0.5) * 5); g.stroke();
  }

  // roughness: brushed zones are smoother; seams/edges are rougher
  const rc = canvas(size);
  const r2 = rc.getContext('2d');
  r2.fillStyle = '#b8b8b8'; r2.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const y = rnd() * size, h = 1 + rnd() * 3;
    r2.fillStyle = `rgba(130,130,130,${0.08 + rnd() * 0.12})`;
    r2.fillRect(0, y, size, h);
  }
  const rcells = fineMode ? 4 : 2;
  for (let i = 0; i <= rcells; i++) {
    const p = (i / rcells) * size;
    r2.fillStyle = `rgba(70,70,70,${fineMode ? 0.28 : 0.45})`;
    r2.fillRect(p, 0, fineMode ? 4 : 5, size);
    r2.fillRect(0, p, size, fineMode ? 4 : 5);
  }

  const hc = canvas(size); hc.getContext('2d').drawImage(cv, 0, 0);
  const out = {
    map: tex(cv, { srgb: true, repeat: [1, 1], aniso: 16 }),
    normalMap: tex(normalFromCanvas(hc, 0.55), { srgb: false, repeat: [1, 1], aniso: 16 }),
    roughnessMap: tex(rc, { srgb: false, repeat: [1, 1], aniso: 16 }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  ROUGH STONE DECK — coarse, non-directional granite/limestone slab
 * ------------------------------------------------------------------ */
export function stoneDeckSet(o = {}) {
  const key = 'stoneDeck' + (o.seed || 0);
  if (cache.has(key)) return cache.get(key);
  const size = 1024;
  const rnd = mulberry32(173);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  const rc = canvas(size);
  const r2 = rc.getContext('2d');
  const rimg = r2.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const macro = fbm2(u * 3.2 + 2.1, v * 3.2 - 1.7, 4) * 0.5 + 0.5;
      const grain = fbm2(u * 18.0 + 7.0, v * 18.0 - 2.0, 3) * 0.5 + 0.5;
      const micro = fbm2(u * 92.0 - 4.0, v * 92.0 + 9.0, 2) * 0.5 + 0.5;
      const pit = Math.pow(Math.abs(fbm2(u * 14.0 + 3.0, v * 14.0 + 8.0, 3)), 3.0);
      const base = 0.47 + macro * 0.17 + grain * 0.075 + micro * 0.035 - pit * 0.10;
      const warm = 0.5 + fbm2(u * 1.8 + 5.0, v * 1.8 - 2.0, 3) * 0.5;
      const i = (y * size + x) * 4;
      img.data[i] = clamp(base * lerp(1.01, 1.08, warm), 0, 1) * 255;
      img.data[i + 1] = clamp(base * lerp(0.985, 1.0, warm), 0, 1) * 255;
      img.data[i + 2] = clamp(base * lerp(0.92, 0.88, warm), 0, 1) * 255;
      img.data[i + 3] = 255;
      const rough = clamp(0.78 + (1 - macro) * 0.16 + (1 - micro) * 0.05, 0, 1);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rough * 255;
      rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  r2.putImageData(rimg, 0, 0);

  // quartz-like aggregate and dark pores
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * size, y = rnd() * size, rr = 0.6 + rnd() * 2.4;
    const light = rnd() > 0.42;
    g.fillStyle = light ? `rgba(224,218,201,${0.12 + rnd() * 0.18})` : `rgba(46,44,40,${0.10 + rnd() * 0.16})`;
    g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  // coarse cracks / bedding lines
  for (let i = 0; i < 22; i++) {
    let x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(30,28,25,${0.20 + rnd() * 0.25})`;
    g.lineWidth = 0.7 + rnd() * 1.8;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 24; k++) { x += (rnd() - 0.5) * 26; y += rnd() * 19 - 5; g.lineTo(x, y); }
    g.stroke();
  }

  const hc = canvas(size);
  hc.getContext('2d').drawImage(cv, 0, 0);
  const out = {
    map: tex(cv, { srgb: true, repeat: o.repeat || [1.6, 1.6], aniso: 16 }),
    normalMap: tex(normalFromCanvas(hc, o.normalStrength || 3.6), { srgb: false, repeat: o.repeat || [1.6, 1.6], aniso: 16 }),
    roughnessMap: tex(rc, { srgb: false, repeat: o.repeat || [1.6, 1.6], aniso: 16 }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  DRY SOIL — the ring outside the moss belt: ochre dirt, gravel, cracks
 * ------------------------------------------------------------------ */
export function dryGroundSet(o = {}) {
  const key = 'dryGround' + (o.seed || 0);
  if (cache.has(key)) return cache.get(key);
  const size = o.size || 1024;
  const rnd = mulberry32(73);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#6d5943';
  g.fillRect(0, 0, size, size);

  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm2(u * 5.0 + 4, v * 5.0 - 2, 5) * 0.5 + 0.5;
      const m = fbm2(u * 19 + 13, v * 19 + 7, 4) * 0.5 + 0.5;
      const macro = fbm2(u * 1.6 - 11, v * 1.6 + 5, 3) * 0.5 + 0.5;
      const pale = clamp((n - 0.46) * 2.3, 0, 1);
      const dust = [lerp(108, 166, m) * (0.82 + macro * 0.26), lerp(88, 136, m) * (0.8 + macro * 0.24), lerp(64, 98, m) * (0.8 + macro * 0.22)];
      const clay = [lerp(94, 128, m) * (0.8 + macro * 0.2), lerp(62, 82, m) * (0.8 + macro * 0.18), lerp(44, 58, m) * (0.8 + macro * 0.16)];
      const i = (y * size + x) * 4;
      img.data[i] = lerp(clay[0], dust[0], pale);
      img.data[i + 1] = lerp(clay[1], dust[1], pale);
      img.data[i + 2] = lerp(clay[2], dust[2], pale);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // gravel and dry pebbles
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * size, y = rnd() * size, r = 0.5 + rnd() * 2.1;
    g.fillStyle = rnd() > 0.45
      ? `rgba(190,174,145,${0.07 + rnd() * 0.14})`
      : `rgba(52,40,29,${0.06 + rnd() * 0.13})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  // baked mud cracks
  for (let i = 0; i < 36; i++) {
    let x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(42,31,22,${0.16 + rnd() * 0.24})`;
    g.lineWidth = 0.7 + rnd() * 1.5;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 9; k++) { x += (rnd() - 0.5) * 26; y += rnd() * 22 - 6; g.lineTo(x, y); }
    g.stroke();
  }
  // fine pale dust streaks
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(196,174,142,${0.05 + rnd() * 0.12})`;
    g.lineWidth = 0.6 + rnd();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 3); g.stroke();
  }

  const out = {
    map: tex(cv, { srgb: true, repeat: o.repeat || [52, 52], aniso: 16 }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  ROCK — stratified volcanic basalt
 * ------------------------------------------------------------------ */
export function rockSet(o = {}) {
  const key = 'rock' + (o.seed || 0);
  if (cache.has(key)) return cache.get(key);
  const size = 1024;
  const rnd = mulberry32(97);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const strata = Math.sin(v * 30 + fbm2(u * 4, v * 12, 3) * 2.6) * 0.5 + 0.5;
      const n = fbm2(u * 8, v * 8, 5) * 0.5 + 0.5;
      const crack = Math.pow(Math.abs(fbm2(u * 6 + 3, v * 6 - 2, 4)), 0.5);
      let base = 0.22 + n * 0.26 + strata * 0.075;
      const warm = clamp(0.5 + fbm2(u * 2.2, v * 2.2, 3), 0, 1);
      const r = clamp(base * lerp(1.0, 1.16, warm), 0, 1) * 255;
      const gg = clamp(base * lerp(0.97, 1.02, warm), 0, 1) * 255;
      const b = clamp(base * lerp(0.94, 0.86, warm), 0, 1) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = r * (0.72 + crack * 0.28);
      img.data[i + 1] = gg * (0.72 + crack * 0.28);
      img.data[i + 2] = b * (0.72 + crack * 0.28);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // ochre / lichen stains
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size, y = rnd() * size, rr = 30 + rnd() * 130;
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    const c = rnd() > 0.5 ? '138,110,62' : '96,104,54';
    grd.addColorStop(0, `rgba(${c},${0.08 + rnd() * 0.10})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // cracks
  for (let i = 0; i < 26; i++) {
    let x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(12,10,8,${0.25 + rnd() * 0.3})`;
    g.lineWidth = 0.8 + rnd() * 1.6;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 26; k++) { x += (rnd() - 0.5) * 22; y += rnd() * 20 - 4; g.lineTo(x, y); }
    g.stroke();
  }

  const hc = canvas(size);
  const h = hc.getContext('2d');
  h.drawImage(cv, 0, 0);

  const out = {
    map: tex(cv, { srgb: true, repeat: o.repeat || [2, 2] }),
    normalMap: tex(normalFromCanvas(hc, o.normalStrength || 3.2), { srgb: false, repeat: o.repeat || [2, 2] }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  TERRAIN ROCK — high-contrast layered mountain rock
 * ------------------------------------------------------------------ */
export function terrainRockSet(o = {}) {
  const key = 'terrainRock' + (o.seed || 0);
  if (cache.has(key)) return cache.get(key);
  const size = 1024;
  const rnd = mulberry32(131);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm2(u * 9 + 5, v * 9 - 3, 5) * 0.5 + 0.5;
      const fine = noise2(u * 74 + 2, v * 74 - 4) * 0.5 + 0.5;
      const strata = Math.sin(v * 44 + fbm2(u * 3, v * 9, 3) * 5.2) * 0.5 + 0.5;
      const crack = Math.pow(Math.abs(fbm2(u * 7 + 8, v * 7 - 1, 4)), 0.42);
      let base = 0.10 + n * 0.32 + strata * 0.25 + fine * 0.09;
      base *= 0.50 + crack * 0.50;
      const warm = clamp(0.5 + fbm2(u * 2.4, v * 2.4, 3), 0, 1);
      const r = clamp(base * lerp(1.02, 1.18, warm), 0, 1) * 255;
      const gg = clamp(base * lerp(0.96, 1.00, warm), 0, 1) * 255;
      const b = clamp(base * lerp(0.90, 0.82, warm), 0, 1) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // sediment partings
  for (let i = 0; i < 70; i++) {
    const y = rnd() * size;
    g.strokeStyle = 'rgba(22,18,15,' + (0.10 + rnd() * 0.22) + ')';
    g.lineWidth = 0.7 + rnd() * 2.2;
    g.beginPath();
    let yy = y;
    g.moveTo(0, yy);
    for (let x = 0; x <= size; x += 64) {
      yy += (rnd() - 0.5) * 18;
      g.lineTo(x, yy);
    }
    g.stroke();
  }
  // deep cracks
  for (let i = 0; i < 46; i++) {
    let x = rnd() * size, y = rnd() * size;
    g.strokeStyle = 'rgba(15,12,10,' + (0.35 + rnd() * 0.35) + ')';
    g.lineWidth = 0.8 + rnd() * 2.0;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 30; k++) { x += (rnd() - 0.5) * 20; y += rnd() * 22 - 4; g.lineTo(x, y); }
    g.stroke();
  }

  const hc = canvas(size);
  hc.getContext('2d').drawImage(cv, 0, 0);
  const out = {
    map: tex(cv, { srgb: true, repeat: [1, 1], aniso: 16, wrap: THREE.MirroredRepeatWrapping }),
    normalMap: tex(normalFromCanvas(hc, 4.2), { srgb: false, repeat: [1, 1], aniso: 16, wrap: THREE.MirroredRepeatWrapping }),
  };
  cache.set(key, out);
  return out;
}

/* ------------------------------------------------------------------ *
 *  HAZARD STRIPES / DECALS / TEXT
 * ------------------------------------------------------------------ */
export function hazardTex() {
  if (cache.has('hazard')) return cache.get('hazard');
  const size = 256;
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#c9a227'; g.fillRect(0, 0, size, size);
  g.fillStyle = '#1b1a18';
  g.save(); g.translate(0, 0); g.rotate(-0.6);
  for (let i = -size; i < size * 2; i += 44) g.fillRect(i, -size, 20, size * 3);
  g.restore();
  // wear
  const rnd = mulberry32(5);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(60,54,44,${0.05 + rnd() * 0.2})`;
    g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 6, 1 + rnd() * 6);
  }
  const t = tex(cv, { srgb: true, repeat: [1, 1] });
  cache.set('hazard', t);
  return t;
}

export function hLogoTex() {
  if (cache.has('hlogo')) return cache.get('hlogo');
  const size = 512;
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, size, size);
  // hexagon plate
  const cx = size / 2, cy = size / 2, R = size * 0.46;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.strokeStyle = '#2b3136'; g.lineWidth = size * 0.035; g.stroke();
  // H
  g.fillStyle = '#2b3136';
  const bw = size * 0.085, bh = size * 0.42;
  g.fillRect(cx - size * 0.17, cy - bh / 2, bw, bh);
  g.fillRect(cx + size * 0.17 - bw, cy - bh / 2, bw, bh);
  g.fillRect(cx - size * 0.17, cy - bw / 2, size * 0.34, bw);
  // small ticks
  g.strokeStyle = 'rgba(43,49,54,0.5)'; g.lineWidth = size * 0.012;
  g.beginPath(); g.arc(cx, cy, R * 0.82, 0, 6.283); g.stroke();
  const t = tex(cv, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  cache.set('hlogo', t);
  return t;
}

export function textTex(text, o = {}) {
  const key = 'txt:' + text + (o.color || '') + (o.size || '');
  if (cache.has(key)) return cache.get(key);
  const w = o.w || 1024, h = o.h || 128;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.font = `${o.weight || 600} ${o.size || Math.floor(h * 0.5)}px "Barlow Condensed","Bahnschrift","Arial Narrow",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = o.color || '#2b3136';
  g.letterSpacing = o.spacing || '10px';
  g.fillText(text, w / 2, h / 2);
  const t = tex(cv, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  cache.set(key, t);
  return t;
}

export function glowTex() {
  if (cache.has('glow')) return cache.get('glow');
  const size = 256;
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = tex(cv, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  cache.set('glow', t);
  return t;
}

/** Soft feathered smoke puff. */
export function smokeTex() {
  if (cache.has('smoke')) return cache.get('smoke');
  const size = 256;
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size - 0.5, v = y / size - 0.5;
      const d = Math.hypot(u, v) * 2;
      const n = fbm2(x / size * 4, y / size * 4, 5) * 0.5 + 0.5;
      const a = clamp((1 - d) * 1.25, 0, 1) * clamp(n * 1.5 - 0.25, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = tex(cv, { srgb: true, wrap: THREE.ClampToEdgeWrapping });
  cache.set('smoke', t);
  return t;
}

/** Turbulent noise used by the lava shader (R channel: heat, G: veins, B: crust). */
export function lavaNoiseTex() {
  if (cache.has('lavanoise')) return cache.get('lavanoise');
  const size = 512;
  const cv = canvas(size);
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n1 = fbm2(u * 4.0, v * 4.0 + 0.5, 5) * 0.5 + 0.5;
      const n2 = fbm2(u * 9.0 + 3.3, v * 9.0 - 1.7, 4) * 0.5 + 0.5;
      const n3 = fbm2(u * 2.0 - 5.1, v * 2.0 + 8.2, 3) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      img.data[i] = n1 * 255;
      img.data[i + 1] = n2 * 255;
      img.data[i + 2] = n3 * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = tex(cv, { srgb: false, wrap: THREE.RepeatWrapping, aniso: 4 });
  cache.set('lavanoise', t);
  return t;
}

/** Concrete / deck plating for walkways. */
export function deckSet() {
  const key = 'deck';
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const rnd = mulberry32(77);
  const cv = canvas(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#6e6a62'; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm2(x / size * 6, y / size * 6, 4) * 0.5 + 0.5;
    const k = 0.82 + n * 0.3;
    const i = (y * size + x) * 4;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  g.putImageData(img, 0, 0);
  // plating grid
  g.strokeStyle = 'rgba(22,20,18,0.5)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * size / 4, 0); g.lineTo(i * size / 4, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * size / 4); g.lineTo(size, i * size / 4); g.stroke();
  }
  // scuffs + oil
  for (let i = 0; i < 240; i++) {
    const x = rnd() * size, y = rnd() * size, r = 4 + rnd() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(28,24,20,${0.03 + rnd() * 0.12})`);
    grd.addColorStop(1, 'rgba(28,24,20,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(150,146,138,${rnd() * 0.12})`;
    g.fillRect(rnd() * size, rnd() * size, 1, 1 + rnd() * 3);
  }
  const hc = canvas(size); hc.getContext('2d').drawImage(cv, 0, 0);
  const rc = canvas(size);
  const r2 = rc.getContext('2d');
  r2.fillStyle = '#b4b4b4'; r2.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    const x = rnd() * size, y = rnd() * size, rr = 10 + rnd() * 60;
    const grd = r2.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, 'rgba(70,70,70,0.6)'); grd.addColorStop(1, 'rgba(70,70,70,0)');
    r2.fillStyle = grd; r2.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  const out = {
    map: tex(cv, { srgb: true, repeat: [1, 1] }),
    normalMap: tex(normalFromCanvas(hc, 1.2), { srgb: false, repeat: [1, 1] }),
    roughnessMap: tex(rc, { srgb: false, repeat: [1, 1] }),
  };
  cache.set(key, out);
  return out;
}
