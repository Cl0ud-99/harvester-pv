import * as THREE from 'three';
import { SET } from './terrain.js';
import { Assembler } from '../lib/assembler.js';
import { chunk, tube, mergeList, mulberry32, lerp, clamp } from '../lib/util.js';

const TAU = Math.PI * 2;

function scaleUV(geo, s) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
  uv.needsUpdate = true;
  return geo;
}

/** Flat annular sector slab, facing +Y. */
export function ringSector(rIn, rOut, h, a0, a1, seg = 96, bevel = 0.16, bevelSeg = 2) {
  const shape = new THREE.Shape();
  const full = Math.abs((a1 - a0) - Math.PI * 2) < 1e-4;
  if (full) {
    // full annulus must be built as a hole, otherwise the arcs share endpoints
    // and earcut collapses it into a solid disc
    shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  } else {
    shape.absarc(0, 0, rOut, a0, a1, false);
    shape.absarc(0, 0, rIn, a1, a0, true);
    shape.closePath();
  }
  const bevelThickness = Math.min(Math.abs(bevel), h * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness, bevelSegments: bevelSeg, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Narrow annular-sector strip laid on a sloped face. */
function ringChamferBand(rOuter, yOuter, rInner, yInner, a0, a1, seg = 150) {
  const pos = [], uv = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = a0 + (a1 - a0) * t;
    const ca = Math.cos(a), sa = Math.sin(a);
    pos.push(ca * rOuter, yOuter, -sa * rOuter);
    pos.push(ca * rInner, yInner, -sa * rInner);
    uv.push(t, 0, t, 1);
  }
  const idx = [];
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical annular wall following a partial arc (never a closed cylinder). */
function ringWall(r, y0, y1, a0, a1, seg = 150) {
  const pos = [], uv = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = a0 + (a1 - a0) * t;
    const ca = Math.cos(a), sa = Math.sin(a);
    pos.push(ca * r, y0, -sa * r);
    pos.push(ca * r, y1, -sa * r);
    uv.push(t, 0, t, 1);
  }
  const idx = [];
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createRing(M, scene) {
  const root = new THREE.Group();
  root.name = 'station';
  const A = new Assembler(root, M);
  const rnd = mulberry32(4242);
  const R = SET.ringR;
  const deckMode = new URLSearchParams(location.search).get('deck');
  const P = SET.pitR;

  /* ---------------- skirt / hull under the deck ---------------- */
  // saucer hull: lathe profile -> a proper rounded megastructure underside
  const prof = [
    [R + 0.6, 0.6], [R + 1.2, -1.4], [R + 0.4, -4.0], [R - 3.0, -8.0],
    [R - 10.0, -12.5], [R - 20.0, -16.0], [P + 9.0, -19.0], [P + 4.0, -22.0],
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
  A.add(mergeList(catRail), 'steel');

  const skirtBand = new THREE.CylinderGeometry(R + 0.15, R + 0.15, 1.5, 72, 1, true);
  skirtBand.translate(0, -1.0, 0);
  A.add(skirtBand, 'armourBlue');

  const skirtLip = new THREE.CylinderGeometry(R + 0.7, R + 0.7, 1.5, 72, 1, true);
  skirtLip.translate(0, 0.4, 0);
  A.add(skirtLip, 'armour');

  // dark glass band around the hull
  const glassBand = new THREE.CylinderGeometry(R - 0.6, R - 0.6, 3.2, 72, 1, true);
  glassBand.translate(0, -6.4, 0);
  A.add(glassBand, 'glass');

  // hull ribs
  const ribs = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const b = chunk(1.4, 14, 2.4);
    b.rotateY(-a);
    b.translate(Math.cos(a) * (R - 1.2), -8.0, Math.sin(a) * (R - 1.2));
    ribs.push(b);
  }
  A.add(mergeList(ribs), 'steel');

  /* ---------------- deck surface ---------------- */
  const deck = ringSector(P + 1.0, R, 1.2, 0, TAU, 160);
  scaleUV(deck, 0.016);                       // much larger tiles -> far less obvious tiling
  deck.translate(0, -1.2, 0);
  {
    // bake large-scale wear into vertex colours so no two areas look identical
    const pos = deck.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.031 + Math.cos(z * 0.024) * 1.7) * 0.5
              + Math.sin(z * 0.017 - x * 0.011) * 0.35
              + Math.sin((x + z) * 0.006) * 0.15;
      const tone = 0.80 + (n * 0.5 + 0.5) * 0.34;
      cols[i * 3] = tone * 1.02; cols[i * 3 + 1] = tone; cols[i * 3 + 2] = tone * 0.97;
    }
    deck.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  A.add(deck, 'deckVC');



  // hazard band + paint lines
  const hz = ringSector(P + 1.2, P + 3.0, 0.05, 0, TAU, 160);
  scaleUV(hz, 0.5);
  hz.translate(0, 0.03, 0);
  // hz removed

  for (const [r0, r1] of [[P + 6.4, P + 6.7], [R - 16.0, R - 15.7], [R - 6.0, R - 5.7]]) {
    const g = ringSector(r0, r1, 0.04, 0, TAU, 160);
    g.translate(0, 0.02, 0);
    A.add(g, 'paint');
  }

  // tread / grooved strips
  const treads = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * TAU;
    for (const rr of [P + 16, P + 24, R - 11]) {
      const g = chunk(2.6, 0.10, 0.55);
      g.rotateY(-a);
      g.translate(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
      treads.push(g);
    }
  }
  // tread plates removed

  /* ---------------- outer parapet + railings ---------------- */
  const parapet = ringSector(R - 1.2, R + 0.5, 1.6, 0, TAU, 160);
  scaleUV(parapet, 0.35);
  parapet.translate(0, 0, 0);
  A.add(parapet, 'armour');

  const parapetTop = ringSector(R - 1.25, R + 0.55, 0.10, 0, TAU, 160);
  scaleUV(parapetTop, 0.4);
  parapetTop.translate(0, 1.6, 0);
  A.add(parapetTop, 'hazard');

  // railings around the pit and the outer edge
  const rails = [];
  const railRing = (radius, y0, h) => {
    const N = 150;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const a2 = ((i + 1) / N) * TAU;
      const p1 = new THREE.Vector3(Math.cos(a) * radius, y0 + h, Math.sin(a) * radius);
      const p2 = new THREE.Vector3(Math.cos(a2) * radius, y0 + h, Math.sin(a2) * radius);
      rails.push(tube(p1, p2, 0.07, 0.07, 5));
      rails.push(tube(p1.clone().setY(y0 + h * 0.5), p2.clone().setY(y0 + h * 0.5), 0.05, 0.05, 5));
      if (i % 3 === 0) rails.push(tube(new THREE.Vector3(p1.x, y0, p1.z), p1, 0.075, 0.075, 5));
    }
  };
  railRing(R - 2.4, 0, 1.15);
  railRing(P + 4.2, 0, 1.05);
  A.add(mergeList(rails), 'steel');

  /* ---------------- upper saucer overhang (covered corridor) ---------------- */
  const ARC0 = Math.PI * 0.16, ARC1 = Math.PI * 1.86;
  // second-level platform: double the old slab thickness and give the
  // outer edge a real armour chamfer instead of a paper-thin plate
  const saucerBevel = 3.0;
  const saucerH = 3.1752; // 4.536 m minus 30%
  const saucerOuterR = (R + 1.5) * 0.884; // 99.84 m max reach -15%
  const saucer = ringSector(P + 8, saucerOuterR, saucerH, ARC0, ARC1, 150, saucerBevel, 1);
  scaleUV(saucer, 0.06);
  saucer.translate(0, SET.deck2Y - 1.8, 0);
  A.add(saucer, deckMode === 'stone3' ? 'deckUpperBlack' : 'deckUpper');

  // lit inner liner on the downward face so the underside is not a black void
  const saucerBottomY = SET.deck2Y - 1.8 - Math.min(saucerBevel, saucerH * 0.45);
  const underPlate = ringSector(P + 9, saucerOuterR - 1.2, 0.18, ARC0, ARC1, 150, 0.04);
  scaleUV(underPlate, 0.06);
  underPlate.translate(0, saucerBottomY - 1.2, 0);
  A.add(underPlate, 'deckUnder');

  // one yellow concentric paint ring, centred on the second-level platform
  const saucerTopY = SET.deck2Y - 1.8 + saucerH + Math.min(saucerBevel, saucerH * 0.45) + 0.03;

  if (deckMode === 'stone3') {
    // v3: staggered stone slabs, visible service hardware and a three-part rim.
    const deckTop = saucerTopY + 0.02;
    const hideBlackEdge = true;
    const baseShellPreview = new URLSearchParams(location.search).get('baseshell') === '1';
    if (baseShellPreview) {
      // full 0.1 m outward-expanded casing, copied from the base saucer shape
      const shellH = saucerH + 0.20;
      const baseShell = ringSector(
        P + 8 - 0.10, saucerOuterR + 0.10, shellH,
        ARC0, ARC1, 150, Math.min(saucerBevel + 0.03, shellH * 0.45), 1,
      );
      baseShell.translate(0, SET.deck2Y - 1.8 - 0.10, 0);
      A.add(baseShell, 'deckUpperBlack');
    }
    // carry the outer edge skin a little past the C cut so it wraps the
    // bevel that the base saucer's extrude leaves protruding into the gap
    const EDGE_OVER = 0.000;
    const EDGE_A0 = ARC0 - EDGE_OVER;
    const EDGE_A1 = ARC1 + EDGE_OVER;
    // The base saucer's positive extrude bevel leaves a small triangular
    // "end cheek" beyond each C cut. Clone those actual triangles (only the
    // part outside the arc) and lift them 3.5 cm along their own normals.
    // This gives an armour skin that follows the real chamfer path exactly.
    function extractEndCheek(src, a0, a1, margin = 0.09, yMin = -1e9, yMax = 1e9, lift = 0.06) {
      const pos = src.attributes.position;
      const nor = src.attributes.normal;
      const uv = src.attributes.uv;
      const idx = src.index;
      const op = [], on = [], ou = [];
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const TAU = Math.PI * 2;
      for (let t = 0; t < triCount; t++) {
        const ia = idx ? idx.getX(t * 3) : t * 3;
        const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        const ax = pos.getX(ia), ay = pos.getY(ia), az = pos.getZ(ia);
        const bx = pos.getX(ib), by = pos.getY(ib), bz = pos.getZ(ib);
        const cx = pos.getX(ic), cy = pos.getY(ic), cz = pos.getZ(ic);
        let a = Math.atan2(-(az + bz + cz) / 3, (ax + bx + cx) / 3);
        if (a < 0) a += TAU;
        // include a short strip inside each cut as well, so the white skin
        // overlaps and covers the black shell's end instead of leaving it
        // poking through at the junction
        const beyond = (a > a1 && a < a1 + margin) || (a < a0 && a > a0 - margin);
        if (!beyond) continue;
        const my = (ay + by + cy) / 3;
        if (my < yMin || my > yMax) continue;
        for (const i of [ia, ib, ic]) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
          op.push(x + nx * lift, y + ny * lift, z + nz * lift);
          on.push(nx, ny, nz);
          ou.push(uv ? uv.getX(i) : x * 0.07, uv ? uv.getY(i) : y * 0.07);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(on, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(ou, 2));
      return g;
    }
    function buildEndCheekSolid(src, a0, a1, thick, lift = 0.06, margin = 0.09) {
      const pos = src.attributes.position;
      const nor = src.attributes.normal;
      const uv = src.attributes.uv;
      const idx = src.index;
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const TAU = Math.PI * 2;
      const selected = [];
      const vmap = new Map();
      const edges = new Map();
      function rec(i) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        const key = [x.toFixed(4), y.toFixed(4), z.toFixed(4)].join(',');
        let r = vmap.get(key);
        if (!r) {
          r = { x, y, z, nx, ny, nz, u: uv ? uv.getX(i) : x * 0.07, v: uv ? uv.getY(i) : y * 0.07 };
          vmap.set(key, r);
        }
        return { key, r };
      }
      for (let t = 0; t < triCount; t++) {
        const ia = idx ? idx.getX(t * 3) : t * 3;
        const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        const ax = pos.getX(ia), ay = pos.getY(ia), az = pos.getZ(ia);
        const bx = pos.getX(ib), by = pos.getY(ib), bz = pos.getZ(ib);
        const cx = pos.getX(ic), cy = pos.getY(ic), cz = pos.getZ(ic);
        let a = Math.atan2(-(az + bz + cz) / 3, (ax + bx + cx) / 3);
        if (a < 0) a += TAU;
        const beyond = (a > a1 && a < a1 + margin) || (a < a0 && a > a0 - margin);
        if (!beyond) continue;
        const ra = rec(ia), rb = rec(ib), rc = rec(ic);
        selected.push([ra, rb, rc]);
        for (const [u, v] of [[ra.key, rb.key], [rb.key, rc.key], [rc.key, ra.key]]) {
          const k = u < v ? u + '|' + v : v + '|' + u;
          edges.set(k, (edges.get(k) || 0) + 1);
        }
      }

      const P = [], U = [], I = [];
      function put(r, off, u, v) {
        P.push(r.x + r.nx * off, r.y + r.ny * off, r.z + r.nz * off);
        U.push(u, v);
        return P.length / 3 - 1;
      }
      for (const tri of selected) {
        const o = tri.map((r) => put(r.r, lift, r.r.u, r.r.v));
        I.push(o[0], o[1], o[2]);
        const q = tri.map((r) => put(r.r, lift - thick, r.r.u, r.r.v));
        I.push(q[0], q[2], q[1]);
      }
      for (const [k, count] of edges) {
        if (count !== 1) continue;
        const [ka, kb] = k.split('|');
        const A = vmap.get(ka), B = vmap.get(kb);
        if (!A || !B) continue;
        const a0v = put(A, lift, A.u, A.v);
        const a1v = put(A, lift - thick, A.u, A.v);
        const b1v = put(B, lift - thick, B.u, B.v);
        const b0v = put(B, lift, B.u, B.v);
        I.push(a0v, a1v, b1v, a0v, b1v, b0v);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      g.computeVertexNormals();
      return g;
    }
    const cheekArmor = buildEndCheekSolid(saucer, ARC0, ARC1, 0.10, 0.06);
    if (!hideBlackEdge) A.add(cheekArmor, 'deckEdgeDark');


    // inner service tray and recessed drainage ring
    const innerTray = ringSector(P + 8.4, 63.2, 0.10, ARC0, ARC1, 120, 0.025);
    innerTray.translate(0, deckTop, 0);
    A.add(innerTray, 'darkSteel');

    const drain = ringSector(57.2, 58.1, 0.055, ARC0, ARC1, 120, 0.02);
    drain.translate(0, deckTop + 0.02, 0);
    A.add(drain, 'darkSteel');

    const innerRim = ringSector(62.4, 63.4, 0.24, ARC0, ARC1, 120, 0.03);
    innerRim.translate(0, deckTop + 0.02, 0);
    A.add(innerRim, 'steel');

    // drain slots, service hatches, vents and warning tabs
    const grates = [], hatches = [], vents = [], tabs = [];
    for (let i = 0; i < 24; i++) {
      const a = lerp(ARC0, ARC1, (i + 0.5) / 24);
      grates.push(chunk(1.8, 0.05, 0.42, Math.cos(a) * 57.65, deckTop + 0.10, Math.sin(a) * 57.65, -a));
    }
    for (let i = 0; i < 6; i++) {
      const a = lerp(ARC0 + 0.035, ARC1 - 0.035, (i + 0.5) / 6);
      const r = 60.0;
      hatches.push(chunk(4.2, 0.16, 2.0, Math.cos(a) * r, deckTop + 0.10, Math.sin(a) * r, -a));
      tabs.push(chunk(1.2, 0.07, 0.42, Math.cos(a) * 61.5, deckTop + 0.18, Math.sin(a) * 61.5, -a));
    }
    for (let i = 0; i < 10; i++) {
      const a = lerp(ARC0 + 0.02, ARC1 - 0.02, (i + 0.5) / 10);
      vents.push(chunk(2.5, 0.065, 0.85, Math.cos(a) * 61.5, deckTop + 0.09, Math.sin(a) * 61.5, -a));
    }
    A.add(mergeList(grates), 'steel');
    A.add(mergeList(hatches), 'armourDirty');
    A.add(mergeList(vents), 'darkSteel');
    A.add(mergeList(tabs), 'hazard');

    // stone field: four radial bands, staggered joints inside eight unequal bays
    const bayT = [0, 0.11, 0.235, 0.36, 0.49, 0.625, 0.74, 0.875, 1];
    const stoneBands = [
      [63.8, 68.7],
      [69.1, 71.8],
      [72.8, 76.2],
      [76.6, 79.0],
    ];
    const stonePieces = [[], [], []];
    for (let bay = 0; bay < bayT.length - 1; bay++) {
      const bayA0 = lerp(ARC0, ARC1, bayT[bay]) + 0.007;
      const bayA1 = lerp(ARC0, ARC1, bayT[bay + 1]) - 0.007;
      for (let bi = 0; bi < stoneBands.length; bi++) {
        const [r0, r1] = stoneBands[bi];
        const n = [2, 3, 2, 3][bi];
        const phase = (bi % 2) * 0.35 + (bay % 3) * 0.12;
        for (let p = 0; p < n; p++) {
          let t0 = (p + phase) / n;
          let t1 = (p + 1 + phase) / n;
          t0 = clamp(t0, 0, 0.96);
          t1 = clamp(t1, t0 + 0.04, 1);
          const a0 = lerp(bayA0, bayA1, t0) + 0.0025;
          const a1 = lerp(bayA0, bayA1, t1) - 0.0025;
          if (a1 <= a0) continue;
          const h = 0.28 + rnd() * 0.16;
          const g = ringSector(r0 + 0.14, r1 - 0.14, h, a0, a1, 10, 0.032 + rnd() * 0.02);
          scaleUV(g, 0.06);
          g.translate(0, deckTop + 0.01, 0);
          stonePieces[(bay * 3 + bi + p) % 3].push(g);
        }
      }
    }
    A.add(mergeList(stonePieces[0]), 'deckUpperStone');
    A.add(mergeList(stonePieces[1]), 'deckUpperStoneLight');
    A.add(mergeList(stonePieces[2]), 'deckUpperStoneDark');

    // structural ribs in the widened bay joints
    const ribs = [];
    for (let i = 1; i < bayT.length - 1; i++) {
      const a = lerp(ARC0, ARC1, bayT[i]);
      ribs.push(tube(
        new THREE.Vector3(Math.cos(a) * 63.6, deckTop + 0.10, Math.sin(a) * 63.6),
        new THREE.Vector3(Math.cos(a) * 79.0, deckTop + 0.10, Math.sin(a) * 79.0),
        0.14, 0.14, 6,
      ));
    }
    A.add(mergeList(ribs), 'steel');

    // recessed yellow inlay with metal lips
    const channel = ringSector(71.8, 72.8, 0.10, ARC0, ARC1, 150, 0.02);
    channel.translate(0, deckTop + 0.01, 0);
    A.add(channel, 'darkSteel');
    const lips = [];
    for (const [r0, r1] of [[71.58, 71.8], [72.8, 73.0]]) {
      const lip = ringSector(r0, r1, 0.045, ARC0, ARC1, 150, 0.012);
      lip.translate(0, deckTop + 0.11, 0);
      lips.push(lip);
    }
    A.add(mergeList(lips), 'steel');
    const inlay = ringSector(72.08, 72.42, 0.03, ARC0, ARC1, 150, 0.012);
    inlay.translate(0, deckTop + 0.15, 0);
    A.add(inlay, 'paint');

    // Continuous outer profile: curb top -> upper chamfer -> vertical side
    // -> lower chamfer -> underside. The base saucer stays underneath as backing.
    const gutter = ringSector(79.1, 80.2, 0.16, ARC0, ARC1, 150, 0.03);
    gutter.translate(0, deckTop + 0.01, 0);
    A.add(gutter, 'darkSteel');
    const curb = ringSector(80.2, 82.7, 0.52, ARC0, ARC1, 150, 0.06);
    curb.translate(0, deckTop + 0.01, 0);
    A.add(curb, 'armour');

    const edgeTopY = deckTop + 0.53;       // top of the white curb
    const baseTopY = saucerTopY;            // top face of the base saucer
    const baseBottomY = saucerBottomY;      // underside of the base saucer
    const bulgeY = baseTopY - 1.4;          // widest point of the barrel profile
    const bulgeR = 87.96;

    function buildSolidEdgeShell(a0, a1, seg, thick) {
      const outer = [
        [82.70, edgeTopY],
        [84.96, baseTopY],
        [bulgeR, bulgeY],
        [bulgeR, baseBottomY + 1.4],
        [84.96, baseBottomY],
      ];
      const inner = [];
      for (let i = 0; i < outer.length; i++) {
        let nx = 0, ny = 0;
        for (const j of [i - 1, i]) {
          if (j < 0 || j >= outer.length - 1) continue;
          const dx = outer[j + 1][0] - outer[j][0];
          const dy = outer[j + 1][1] - outer[j][1];
          const len = Math.hypot(dx, dy) || 1;
          nx += dy / len;
          ny += -dx / len;
        }
        const n = Math.hypot(nx, ny) || 1;
        inner.push([outer[i][0] + (nx / n) * thick, outer[i][1] + (ny / n) * thick]);
      }

      const pos = [], uv = [], idx = [];
      function put(r, y, a, u, v) {
        pos.push(Math.cos(a) * r, y, -Math.sin(a) * r);
        uv.push(u, v);
        return pos.length / 3 - 1;
      }
      function quad(a, b, c, d) {
        idx.push(a, b, c, a, c, d);
      }
      for (let s = 0; s < seg; s++) {
        const aa = a0 + (a1 - a0) * (s / seg);
        const ab = a0 + (a1 - a0) * ((s + 1) / seg);
        for (let i = 0; i < outer.length - 1; i++) {
          const v0 = put(outer[i][0], outer[i][1], aa, s / seg, i / (outer.length - 1));
          const v1 = put(outer[i + 1][0], outer[i + 1][1], aa, s / seg, (i + 1) / (outer.length - 1));
          const v2 = put(outer[i + 1][0], outer[i + 1][1], ab, (s + 1) / seg, (i + 1) / (outer.length - 1));
          const v3 = put(outer[i][0], outer[i][1], ab, (s + 1) / seg, i / (outer.length - 1));
          quad(v0, v1, v2, v3);

          const w0 = put(inner[i][0], inner[i][1], aa, s / seg, i / (outer.length - 1));
          const w1 = put(inner[i][0], inner[i][1], ab, (s + 1) / seg, i / (outer.length - 1));
          const w2 = put(inner[i + 1][0], inner[i + 1][1], ab, (s + 1) / seg, (i + 1) / (outer.length - 1));
          const w3 = put(inner[i + 1][0], inner[i + 1][1], aa, s / seg, (i + 1) / (outer.length - 1));
          quad(w0, w1, w2, w3);
        }
        const t0 = put(outer[0][0], outer[0][1], aa, s / seg, 0);
        const t1 = put(inner[0][0], inner[0][1], aa, s / seg, 1);
        const t2 = put(inner[0][0], inner[0][1], ab, (s + 1) / seg, 1);
        const t3 = put(outer[0][0], outer[0][1], ab, (s + 1) / seg, 0);
        quad(t0, t1, t2, t3);

        const b0 = put(outer[outer.length - 1][0], outer[outer.length - 1][1], aa, s / seg, 0);
        const b1 = put(outer[outer.length - 1][0], outer[outer.length - 1][1], ab, (s + 1) / seg, 0);
        const b2 = put(inner[inner.length - 1][0], inner[inner.length - 1][1], ab, (s + 1) / seg, 1);
        const b3 = put(inner[inner.length - 1][0], inner[inner.length - 1][1], aa, s / seg, 1);
        quad(b0, b1, b2, b3);
      }
      for (const [a, flip] of [[a0, false], [a1, true]]) {
        for (let i = 0; i < outer.length - 1; i++) {
          const p0 = put(outer[i][0], outer[i][1], a, i / outer.length, 0);
          const p1 = put(outer[i + 1][0], outer[i + 1][1], a, (i + 1) / outer.length, 0);
          const p2 = put(inner[i + 1][0], inner[i + 1][1], a, (i + 1) / outer.length, 1);
          const p3 = put(inner[i][0], inner[i][1], a, i / outer.length, 1);
          if (flip) quad(p0, p3, p2, p1);
          else quad(p0, p1, p2, p3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    if (!hideBlackEdge) A.add(buildSolidEdgeShell(ARC0, ARC1, 180, 0.10), 'deckEdgeDark');

    // segmented blue accent on the curb
    const blue = [];
    for (let i = 0; i < 12; i++) {
      const a0 = lerp(ARC0, ARC1, (i + 0.5) / 12) + 0.006;
      const a1 = lerp(ARC0, ARC1, (i + 0.5) / 12) + 0.043;
      const g = ringSector(80.65, 81.15, 0.04, a0, a1, 8, 0.012);
      g.translate(0, deckTop + 0.55, 0);
      blue.push(g);
    }
    A.add(mergeList(blue), 'armourBlue');

    // curb clamps
    const clamps = [];
    for (let i = 0; i < 8; i++) {
      const a = lerp(ARC0, ARC1, (i + 0.5) / 8);
      clamps.push(chunk(2.2, 0.20, 1.05, Math.cos(a) * 81.5, deckTop + 0.56, Math.sin(a) * 81.5, -a));
    }
    A.add(mergeList(clamps), 'darkSteel');

  } else if (deckMode === 'stone2') {
    // v2: a stone field framed by an inner service tray and an outer armour curb.
    // The base saucer stays dark metal so every seam has a dark structural read.
    const deckTop = saucerTopY + 0.02;

    const innerTray = ringSector(P + 8.4, 63.2, 0.10, ARC0, ARC1, 120, 0.025);
    innerTray.translate(0, deckTop, 0);
    A.add(innerTray, 'darkSteel');

    const innerRim = ringSector(62.5, 63.4, 0.22, ARC0, ARC1, 120, 0.03);
    innerRim.translate(0, deckTop + 0.02, 0);
    A.add(innerRim, 'steel');

    // four stone bands; the 71.8–72.8 gap is the inlaid yellow channel
    const stoneBands = [
      [63.7, 68.7],
      [69.1, 71.8],
      [72.8, 76.2],
      [76.6, 79.2],
    ];
    const stoneLight = [], stoneDark = [];
    const bays = 8;
    for (let bay = 0; bay < bays; bay++) {
      const a0 = lerp(ARC0, ARC1, bay / bays) + 0.007;
      const a1 = lerp(ARC0, ARC1, (bay + 1) / bays) - 0.007;
      const splits = bay % 3 === 1 ? 2 : 1;
      for (let sp = 0; sp < splits; sp++) {
        const s0 = lerp(a0, a1, sp / splits) + 0.003;
        const s1 = lerp(a0, a1, (sp + 1) / splits) - 0.003;
        for (let bi = 0; bi < stoneBands.length; bi++) {
          const [r0, r1] = stoneBands[bi];
          const ph = 0.28 + rnd() * 0.13;
          const g = ringSector(r0 + 0.14, r1 - 0.14, ph, s0, s1, 10, 0.045);
          scaleUV(g, 0.06);
          g.translate(0, deckTop + 0.01, 0);
          ((bay + bi + sp * 2) % 3 === 0 ? stoneDark : stoneLight).push(g);
        }
      }
    }
    A.add(mergeList(stoneLight), 'deckUpperStone');
    A.add(mergeList(stoneDark), 'deckUpperStoneDark');

    const channel = ringSector(71.8, 72.8, 0.09, ARC0, ARC1, 150, 0.02);
    channel.translate(0, deckTop + 0.02, 0);
    A.add(channel, 'darkSteel');
    const inlay = ringSector(72.08, 72.42, 0.03, ARC0, ARC1, 150, 0.015);
    inlay.translate(0, deckTop + 0.13, 0);
    A.add(inlay, 'paint');

    // outer gutter, raised armour curb and blue trim
    const gutter = ringSector(79.1, 80.3, 0.12, ARC0, ARC1, 150, 0.03);
    gutter.translate(0, deckTop + 0.01, 0);
    A.add(gutter, 'darkSteel');
    const curb = ringSector(80.3, 84.2, 0.55, ARC0, ARC1, 150, 0.07);
    curb.translate(0, deckTop + 0.01, 0);
    A.add(curb, 'armour');
    const trim = new THREE.CylinderGeometry(82.3, 82.3, 0.09, 150, 1, true, ARC0, ARC1 - ARC0);
    trim.translate(0, deckTop + 0.59, 0);
    A.add(trim, 'armourBlue');

    // clamps on the curb and service hardware inside the tray
    const clamps = [], vents = [], hatches = [];
    for (let i = 0; i < 16; i++) {
      const a = lerp(ARC0, ARC1, (i + 0.5) / 16);
      clamps.push(chunk(2.0, 0.18, 0.9, Math.cos(a) * 81.8, deckTop + 0.58, Math.sin(a) * 81.8, -a));
      if (i < 12) {
        vents.push(chunk(2.2, 0.08, 0.8, Math.cos(a) * 60.0, deckTop + 0.12, Math.sin(a) * 60.0, -a));
      }
      if (i % 3 === 0) {
        hatches.push(chunk(3.2, 0.18, 1.7, Math.cos(a) * 58.4, deckTop + 0.12, Math.sin(a) * 58.4, -a));
      }
    }
    A.add(mergeList(clamps), 'darkSteel');
    A.add(mergeList(vents), 'darkSteel');
    A.add(mergeList(hatches), 'steel');
  } else {
    // raised armour plates with recessed seams; real relief instead of a flat decal
    const panelBands = [57.5, 64.8, 72.1, 79.4, 84.0];
    const panelSegs = 28;
    const panelGeos = [];
    for (let b = 0; b < panelBands.length - 1; b++) {
      for (let j = 0; j < panelSegs; j++) {
        const a0 = lerp(ARC0, ARC1, j / panelSegs);
        const a1 = lerp(ARC0, ARC1, (j + 1) / panelSegs);
        const ph = 0.12 + rnd() * 0.07;
        const g = ringSector(
          panelBands[b] + 0.18, panelBands[b + 1] - 0.18,
          ph, a0 + 0.004, a1 - 0.004, 8, 0.025,
        );
        scaleUV(g, 0.06);
        g.translate(0, saucerTopY + 0.01, 0);
        panelGeos.push(g);
      }
    }
    A.add(mergeList(panelGeos), 'deckUpper');

    // align the yellow ring with the central concentric panel seam
    const saucerMidR = panelBands[2];
    const saucerRing = ringSector(saucerMidR - 0.16, saucerMidR + 0.16, 0.04, ARC0, ARC1, 150, 0.025);
    saucerRing.translate(0, saucerTopY + 0.03, 0);
    A.add(saucerRing, 'paint');
  }

  // second yellow line centred on the sloped upper chamfer face
  const chamferInnerR = saucerOuterR - saucerBevel;
  const chamferOuterR = saucerOuterR;
  const slopeMidR = lerp(chamferInnerR, chamferOuterR, 0.5);
  const slopeMidY = lerp(saucerTopY - 0.03, saucerTopY - saucerBevel + 0.03, 0.5);
  const chamferRing = ringChamferBand(
    slopeMidR + 0.15, slopeMidY - 0.035,
    slopeMidR - 0.15, slopeMidY + 0.035,
    ARC0, ARC1, 150,
  );
  A.add(chamferRing, 'paint');

  // soffit lamps under the overhang
  const lamps = [];
  for (let i = 0; i < 46; i++) {
    const a = lerp(ARC0 + 0.05, ARC1 - 0.05, i / 45);
    const g = new THREE.BoxGeometry(1.3, 0.14, 0.5);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 54, SET.deck2Y - 0.85, Math.sin(a) * 54);
    lamps.push(g);
  }
  A.add(mergeList(lamps), 'emitWhite');

  /* ---------------- support columns ---------------- */
  const cols = [], colTrim = [];
  const COLN = 9;
  for (let i = 0; i < COLN; i++) {
    const a = lerp(ARC0 + 0.16, ARC1 - 0.16, i / (COLN - 1));
    const r = P + 12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const c = new THREE.CylinderGeometry(1.25, 1.65, SET.deck2Y + 5.0, 10, 3);
    c.translate(x, (SET.deck2Y - 5.0) / 2, z);
    cols.push(c);
    for (const t of [0.25, 0.75]) {
      const ring = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 10, 1, true);
      ring.translate(x, SET.deck2Y * t, z);
      colTrim.push(ring);
    }
    colTrim.push(chunk(4.2, 1.0, 4.2, x, 0.5, z, -a));
    // hazard wrap at the base
    colTrim.push(new THREE.CylinderGeometry(1.85, 1.85, 1.4, 10, 1, false).translate(x, 1.5, z));
  }
  A.add(mergeList(cols), 'armourDirty');
  A.add(mergeList(colTrim), 'hazard');

  /* ---------------- yellow pipe run on pylons ---------------- */
  const pipes = [], pylons = [], collars = [];
  for (const [radius, y, thick] of [[46.0, 4.6, 1.25], [43.0, 7.4, 0.85]]) {
    const arcSeg = 120;
    for (let i = 0; i < arcSeg; i++) {
      const a0 = lerp(ARC0 + 0.04, ARC1 - 0.04, i / arcSeg);
      const a1 = lerp(ARC0 + 0.04, ARC1 - 0.04, (i + 1) / arcSeg);
      pipes.push(tube(
        new THREE.Vector3(Math.cos(a0) * radius, y, Math.sin(a0) * radius),
        new THREE.Vector3(Math.cos(a1) * radius, y, Math.sin(a1) * radius),
        thick, thick, 10,
      ));
      if (i % 5 === 0) {
        const g = new THREE.CylinderGeometry(thick + 0.16, thick + 0.16, 0.45, 10, 1, true);
        g.rotateZ(Math.PI / 2);
        g.rotateY(-a0);
        g.translate(Math.cos(a0) * radius, y, Math.sin(a0) * radius);
        collars.push(g);
      }
    }
  }
  // pylons holding the pipes
  for (let i = 0; i < 14; i++) {
    const a = lerp(ARC0 + 0.1, ARC1 - 0.1, i / 13);
    const r = 46;
    pylons.push(chunk(1.5, 8.4, 1.5, Math.cos(a) * r, 4.2, Math.sin(a) * r, -a));
    pylons.push(chunk(2.4, 0.5, 2.4, Math.cos(a) * r, 0.25, Math.sin(a) * r, -a));
  }
  A.add(mergeList(pipes), 'yellowPipe');
  A.add(mergeList(collars), 'darkSteel');
  A.add(mergeList(pylons), 'armourDirty');
  // closed pipe ends: flange ring + rounded plug so the runs terminate deliberately
  const endCaps = [], endFlanges = [];
  for (const [radius, y, thick] of [[46.0, 4.6, 1.25], [43.0, 7.4, 0.85]]) {
    for (const [aa, dir] of [[ARC0 + 0.02, -1], [ARC1 - 0.02, 1]]) {
      const px = Math.cos(aa) * radius, pz = Math.sin(aa) * radius;
      const t = new THREE.Vector3(-Math.sin(aa), 0, Math.cos(aa)).multiplyScalar(dir).normalize();

      const sph = new THREE.SphereGeometry(thick * 1.06, 16, 10);
      sph.scale(1.0, 1.0, 1.0);
      sph.translate(px + t.x * thick * 0.35, y, pz + t.z * thick * 0.35);
      endCaps.push(sph);

      const fl = new THREE.CylinderGeometry(thick * 1.4, thick * 1.4, 0.5, 16, 1, false);
      fl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), t));
      fl.translate(px, y, pz);
      endFlanges.push(fl);
    }
  }
  A.add(mergeList(endCaps), 'yellowPipe');
  A.add(mergeList(endFlanges), 'darkSteel');


  /* ---------------- gantry arms reaching out from the deck ---------------- */
  const arms = [], armTrim = [], armHazard = [];
  const ARM = [0.55, 2.35, 3.95, 5.6];
  const gantryShift = R - 82;   // keep gantries outside the expanded deck edge
  for (const a of ARM) {
    const x = Math.cos(a), z = Math.sin(a);
    const yaw = Math.atan2(x, z);
    for (let k = 0; k < 3; k++) {
      const r0 = 64 + k * 11 + gantryShift;
      const g = chunk(9.0, 1.4, 11.0, x * (r0 + 5), -0.4, z * (r0 + 5), yaw);
      arms.push(g);
      const post = chunk(1.2, 9.0, 1.2, x * (r0 + 8), 4.2, z * (r0 + 8), yaw);
      armTrim.push(post);
    }
    const rail = chunk(30, 0.14, 0.14, x * (78 + gantryShift), 5.4, z * (78 + gantryShift), yaw);
    armTrim.push(rail);
    armHazard.push(chunk(8.4, 0.12, 1.2, x * (66 + gantryShift), 0.32, z * (66 + gantryShift), yaw));
  }
  A.add(mergeList(arms), 'deck');
  A.add(mergeList(armTrim), 'steel');
  // gantry hazard strip removed

  /* ---------------- deck clutter: vents, boxes, drums ---------------- */
  const crates = [], drumG = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU;
    const r = P + 10 + rnd() * 14;
    if (r > R - 4) continue;
    const s = 1.0 + rnd() * 2.2;
    crates.push(chunk(s, s * 0.75, s * 1.3, Math.cos(a) * r, s * 0.38, Math.sin(a) * r, rnd() * 3.14));
  }
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU;
    const r = P + 12 + rnd() * 16;
    const c = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 12, 1, false);
    c.translate(Math.cos(a) * r, 0.7, Math.sin(a) * r);
    drumG.push(c);
  }
  A.add(mergeList(crates), 'armourDirty');
  /* ---- inner shaft catwalks: two maintenance rings inside the well ---- */
  const walks = [], walkRails = [], walkBrackets = [];
  for (const [yy, rIn, rOut] of [[-11, 30.0, 38.0], [-24, 24.0, 32.0]]) {
    const slab = ringSector(rIn, rOut, 0.5, 0, TAU, 120);
    scaleUV(slab, 0.3);
    slab.translate(0, yy, 0);
    walks.push(slab);

    // railing on the inner edge
    const N = 96;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
      const p1 = new THREE.Vector3(Math.cos(a0) * (rIn + 0.6), yy + 1.15, Math.sin(a0) * (rIn + 0.6));
      const p2 = new THREE.Vector3(Math.cos(a1) * (rIn + 0.6), yy + 1.15, Math.sin(a1) * (rIn + 0.6));
      walkRails.push(tube(p1, p2, 0.07, 0.07, 5));
      walkRails.push(tube(p1.clone().setY(yy + 0.6), p2.clone().setY(yy + 0.6), 0.05, 0.05, 5));
      if (i % 2 === 0) walkRails.push(tube(new THREE.Vector3(p1.x, yy + 0.5, p1.z), p1, 0.06, 0.06, 5));
    }

    // diagonal brackets tying the walkway back to the shaft wall
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      walkBrackets.push(tube(
        new THREE.Vector3(Math.cos(a) * rOut, yy - 0.2, Math.sin(a) * rOut),
        new THREE.Vector3(Math.cos(a) * (rIn + 1.0), yy - 3.4, Math.sin(a) * (rIn + 1.0)),
        0.16, 0.16, 5,
      ));
    }
  }
  A.add(mergeList(walks), 'deck');
  A.add(mergeList(walkRails), 'steel');
  A.add(mergeList(walkBrackets), 'darkSteel');

  A.add(mergeList(drumG), 'orange');

  /* practicals: deck floodlights */
  const floods = [];
  for (let i = 0; i < 10; i++) {
    const a = lerp(ARC0 + 0.2, ARC1 - 0.2, i / 9);
    const r = 49;
    const g = new THREE.BoxGeometry(1.1, 0.7, 0.5);
    g.rotateY(-a);
    g.translate(Math.cos(a) * r, SET.deck2Y - 2.2, Math.sin(a) * r);
    floods.push(g);
  }
  A.add(mergeList(floods), 'emitOrange');

  /* under-saucer practicals so the deck edge is not a black void */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.2;
    const L = new THREE.PointLight(0xffb066, 340, 150, 2.0);
    L.position.set(Math.cos(a) * 60, -7.5, Math.sin(a) * 60);
    root.add(L);
  }
  // deck lamps removed: the lava bounce + shaft lights already cover this zone

  A.finish();
  if (new URLSearchParams(location.search).get('deck') === 'stone') {
    const upper = root.getObjectByName('deckUpper');
    if (upper) upper.material = M.deckUpperStone;
  }
  scene.add(root);
  return { group: root };
}
