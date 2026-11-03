import * as THREE from 'three';
import { SET } from './terrain.js';
import { Assembler } from '../lib/assembler.js';
import { chunk, tube, torus, mergeList, mulberry32, lerp } from '../lib/util.js';

const TAU = Math.PI * 2;

function scaleUV(geo, s) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s);
  uv.needsUpdate = true;
  return geo;
}

/** Flat annular sector slab, facing +Y. */
export function ringSector(rIn, rOut, h, a0, a1, seg = 96) {
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
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.16, bevelSegments: 1, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function createRing(M, scene) {
  const root = new THREE.Group();
  root.name = 'station';
  const A = new Assembler(root, M);
  const rnd = mulberry32(4242);
  const R = SET.ringR;
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
  const saucer = ringSector(P + 8, R + 1.5, 1.8, ARC0, ARC1, 150);
  scaleUV(saucer, 0.15);
  saucer.translate(0, SET.deck2Y, 0);
  A.add(saucer, 'deck');

  const saucerUnder = ringSector(P + 8.5, R + 1.0, 0.7, ARC0, ARC1, 150);
  scaleUV(saucerUnder, 0.25);
  saucerUnder.translate(0, SET.deck2Y - 0.7, 0);
  A.add(saucerUnder, 'darkSteel');

  // outer fascia of the overhang with a blue band + glass
  const fascia = new THREE.CylinderGeometry(R + 1.6, R + 1.6, 2.4, 150, 1, true, ARC0, ARC1 - ARC0);
  fascia.translate(0, SET.deck2Y + 0.9, 0);
  // A.add(fascia, 'armour');  // removed

  const fasciaBlue = new THREE.CylinderGeometry(R + 1.75, R + 1.75, 0.75, 150, 1, true, ARC0, ARC1 - ARC0);
  fasciaBlue.translate(0, SET.deck2Y - 0.35, 0);
  // A.add(fasciaBlue, 'armourBlue');  // removed

  const fasciaGlass = new THREE.CylinderGeometry(R + 1.7, R + 1.7, 0.9, 150, 1, true, ARC0, ARC1 - ARC0);
  fasciaGlass.translate(0, SET.deck2Y + 1.55, 0);
  // A.add(fasciaGlass, 'glass');  // removed

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
    const c = new THREE.CylinderGeometry(1.25, 1.65, SET.deck2Y, 10, 3);
    c.translate(x, SET.deck2Y / 2, z);
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
  for (const a of ARM) {
    const x = Math.cos(a), z = Math.sin(a);
    const yaw = Math.atan2(x, z);
    for (let k = 0; k < 3; k++) {
      const r0 = 64 + k * 11;
      const g = chunk(9.0, 1.4, 11.0, x * (r0 + 5), -0.4, z * (r0 + 5), yaw);
      arms.push(g);
      const post = chunk(1.2, 9.0, 1.2, x * (r0 + 8), 4.2, z * (r0 + 8), yaw);
      armTrim.push(post);
    }
    const rail = chunk(30, 0.14, 0.14, x * 78, 5.4, z * 78, yaw);
    armTrim.push(rail);
    armHazard.push(chunk(8.4, 0.12, 1.2, x * 66, 0.32, z * 66, yaw));
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
  scene.add(root);
  return { group: root };
}
