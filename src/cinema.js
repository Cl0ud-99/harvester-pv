import * as THREE from 'three';
import { clamp, lerp, easeInOut } from './lib/util.js';

const V = (x, y, z) => [x, y, z];

/* Six shots. Time is the palette parameter (0 = bright afternoon, 1 = night). */
export const SHOTS = [
  {
    num: '01', label: 'ARRIVAL', dur: 12,
    time: [0.34, 0.30],
    focus: [330, 310], aperture: 0.00003, maxblur: 0.0028,
    a: { pos: V(288, 236, -252), target: V(0, 104, 0), fov: 48 },
    b: { pos: V(244, 200, -214), target: V(0, 112, 0), fov: 46 },
  },
  {
    num: '02', label: 'THE TOWER', dur: 11,
    time: [0.30, 0.28],
    focus: [180, 165], aperture: 0.00006, maxblur: 0.0038,
    a: { pos: V(96, 3.2, -34), target: V(0, 150, 0), fov: 62 },
    b: { pos: V(84, 4.0, -52), target: V(0, 162, 0), fov: 60 },
  },
  {
    num: '03', label: 'THE DECK', dur: 10,
    time: [0.38, 0.42],
    focus: [64, 58], aperture: 0.00008, maxblur: 0.004,
    a: { pos: V(114, 3.0, -78), target: V(56, 18, -40), fov: 54 },
    b: { pos: V(100, 3.6, -64), target: V(50, 22, -34), fov: 52 },
  },
  {
    num: '04', label: 'THE BASIN', dur: 9,
    time: [0.42, 0.47],
    focus: [190, 175], aperture: 0.00005, maxblur: 0.0032,
    a: { pos: V(158, 3.2, 96), target: V(0, 120, 0), fov: 54 },
    b: { pos: V(138, 3.6, 108), target: V(0, 128, 0), fov: 52 },
  },
  {
    num: '05', label: 'THE ARM', dur: 10,
    time: [0.47, 0.52],
    focus: [72, 66], aperture: 0.00009, maxblur: 0.004,
    a: { pos: V(58, 74, 46), target: V(0, 158, 0), fov: 52 },
    b: { pos: V(46, 92, 58), target: V(0, 168, 0), fov: 50 },
  },
  {
    num: '06', label: 'HARVEST', dur: 13,
    time: [0.56, 0.70],
    focus: [260, 240], aperture: 0.00005, maxblur: 0.003,
    a: { pos: V(238, 62, -196), target: V(0, 130, 0), fov: 40 },
    b: { pos: V(196, 44, -164), target: V(0, 140, 0), fov: 38 },
  },
];

export function createCinema(app, hud) {
  const { camera, controls } = app;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const tgtA = new THREE.Vector3(), tgtB = new THREE.Vector3();

  const state = {
    active: true,
    paused: false,
    exploring: false,
    ended: false,
    shot: 0,
    shotT: 0,
    time: SHOTS[0].time[0],
    drift: 0,
  };

  function apply(index, p, opts = {}) {
    const s = SHOTS[index];
    const e = opts.linear ? p : easeInOut(p);
    tmpA.fromArray(s.a.pos); tmpB.fromArray(s.b.pos);
    tgtA.fromArray(s.a.target); tgtB.fromArray(s.b.target);

    const pos = tmpA.clone().lerp(tmpB, e);
    const tgt = tgtA.clone().lerp(tgtB, e);

    // subtle handheld drift so stills do not feel locked-off
    const t = performance.now() * 0.001;
    const drift = opts.paused ? 0 : 0.06;
    pos.x += Math.sin(t * 0.7) * drift;
    pos.y += Math.sin(t * 0.53 + 1.3) * drift * 0.7;

    camera.position.copy(pos);
    camera.fov = lerp(s.a.fov, s.b.fov, e);
    camera.updateProjectionMatrix();
    camera.lookAt(tgt);

    if (controls) {
      controls.target.copy(tgt);
      controls.updateTarget?.();
    }

    // time of day
    const tt = lerp(s.time[0], s.time[1], e);
    state.time = tt;
    app.setTime(tt, opts.instantEnv);

    // depth of field: always focus on the shot's subject distance
    if (app.post?.bokeh) {
      app.post.bokeh.enabled = !!app.quality?.dof;
      const mb = app.post.bokeh.materialBokeh;
      if (mb) {
        const d = camera.position.distanceTo(tgt);
        mb.uniforms.focus.value = d;
        mb.uniforms.aperture.value = s.aperture;
        mb.uniforms.maxblur.value = s.maxblur;
      }
    }

    hud?.updateShot?.(index, p, s);
  }

  function start(i = 0) {
    state.shot = clamp(i, 0, SHOTS.length - 1);
    state.shotT = 0;
    state.active = true;
    state.paused = false;
    state.exploring = false;
    state.ended = false;
    if (controls) controls.enabled = false;
    document.body.classList.add('cinema');
    document.body.classList.remove('explore', 'roam', 'locked');
    app.setMode?.('cinema');
    apply(state.shot, 0, { instantEnv: true });
    hud?.onShotStart?.(state.shot);
  }

  function jump(i, p = 0) {
    state.shot = clamp(i, 0, SHOTS.length - 1);
    state.shotT = p * SHOTS[state.shot].dur;
    state.active = true;
    state.paused = true;
    state.exploring = false;
    if (controls) controls.enabled = false;
    document.body.classList.add('cinema');
    apply(state.shot, clamp(p, 0, 1), { paused: true, linear: true, instantEnv: true });
    hud?.onShotStart?.(state.shot);
    hud?.setPlaying?.(false);
  }

  function update(dt) {
    if (!state.active || state.paused || state.exploring) return;
    const s = SHOTS[state.shot];
    state.shotT += dt;
    const p = clamp(state.shotT / s.dur, 0, 1);
    apply(state.shot, p);
    if (p >= 1) {
      if (state.shot < SHOTS.length - 1) {
        start(state.shot + 1);
      } else {
        endFilm();
      }
    }
  }

  function endFilm() {
    state.active = false;
    state.ended = true;
    hud?.onEnd?.();
  }

  function pause() {
    state.paused = true;
    hud?.setPlaying?.(false);
  }
  function play() {
    if (state.ended) return start(0);
    state.paused = false;
    state.active = true;
    hud?.setPlaying?.(true);
  }
  function toggle() { state.paused ? play() : pause(); }

  function explore() {
    state.active = false;
    state.exploring = true;
    state.ended = false;
    if (controls) {
      controls.enabled = true;
      controls.target.copy(camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(25)));
      controls.update();
    }
    document.body.classList.remove('cinema');
    document.body.classList.add('explore');
    hud?.onExplore?.();
  }

  return { state, start, update, jump, pause, play, toggle, explore, endFilm, apply, SHOTS };
}
