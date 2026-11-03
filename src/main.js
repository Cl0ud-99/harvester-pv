import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createMaterials } from './lib/materials.js';
import { createSky } from './world/sky.js';
import { createTerrain, terrainH, SET } from './world/terrain.js';
import { createRing } from './world/ring.js';
import { createHarvester } from './world/harvester.js';
import { createProps } from './world/props.js';
import { createFlora } from './world/flora.js';
import { createDecals } from './world/decals.js';
import { createDust } from './world/dust.js';
import { createLavaWell } from './world/lava.js';
import { createPost } from './lib/post.js';
import { createCinema } from './cinema.js';
import { createHUD } from './hud.js';
import { clamp, lerp, smoothstep, damp } from './lib/util.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* ------------------------------------------------------------------ *
 *  renderer / scene
 * ------------------------------------------------------------------ */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance',
  stencil: false, alpha: false, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc89a72, 0.00125);
scene.background = new THREE.Color(0x1a1c20);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.6, 6000);
camera.position.set(104, 17, -96);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 74, 0);
controls.minDistance = 12;
controls.maxDistance = 520;
controls.maxPolarAngle = Math.PI * 0.497;
controls.enabled = false;

/* ------------------------------------------------------------------ *
 *  lights
 * ------------------------------------------------------------------ */
const sun = new THREE.DirectionalLight(0xffe2b8, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 2600;
sun.shadow.camera.left = -620;
sun.shadow.camera.right = 620;
sun.shadow.camera.top = 620;
sun.shadow.camera.bottom = -420;
sun.shadow.bias = -0.00012;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 1.6;
sun.target.position.set(0, 60, 0);
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0x8fb2d4, 0x5a4632, 0.95);
scene.add(hemi);

const rim = new THREE.DirectionalLight(0x89b6e0, 0.55);
rim.position.set(-160, 90, 180);
scene.add(rim);

const fill = new THREE.DirectionalLight(0x9fc0e0, 0.55);
fill.position.set(200, 60, 160);
scene.add(fill);

/* ------------------------------------------------------------------ *
 *  world
 * ------------------------------------------------------------------ */
const hud = {
  setLoad(p, step) {
    const f = document.getElementById('ldFill');
    const t = document.getElementById('ldStep');
    if (f) f.style.width = Math.round(p * 100) + '%';
    if (t && step) t.textContent = step;
  },
};
hud.setLoad(0.05, 'BUILDING SKY');

let sky, M, world = {}, lava, harvester;
const app = {
  scene, camera, renderer, controls,
  qualityLevel: 2,      // 0 LQ / 1 MQ / 2 HQ
  quality: { dof: false },
  mode: 'cinema',
};

async function build() {
  M = createMaterials();
  hud.setLoad(0.2, 'TEXTURING METAL');
  await nextFrame();

  sky = createSky(renderer, scene);
  sky.setTime(0.3, true);
  hud.setLoad(0.32, 'CARVING THE CANYON');
  await nextFrame();

  world.terrain = createTerrain(M, scene);
  hud.setLoad(0.5, 'RAISING THE MEGASTUCTURE');
  await nextFrame();

  harvester = createHarvester(M, scene);
  world.harvester = harvester;
  hud.setLoad(0.68, 'ASSEMBLING THE RING');
  await nextFrame();

  world.ring = createRing(M, scene);
  hud.setLoad(0.78, 'PLACING CARGO + MODULES');
  await nextFrame();

  createDecals(M, scene);
  world.dust = createDust(scene);
  createFlora(M, scene);
  world.props = createProps(M, scene);
  hud.setLoad(0.88, 'IGNITING THE WELL');
  await nextFrame();

  lava = createLavaWell(M, scene);
  world.lava = lava;

  hud.setLoad(0.96, 'COMPILING SHADERS');
  await nextFrame();
}

/* ------------------------------------------------------------------ *
 *  time of day
 * ------------------------------------------------------------------ */
let currentT = 0.3;
const sunPos = new THREE.Vector3();
app.setTime = function (t, instant = false) {
  currentT = clamp(t, 0, 1);
  sky.setTime(currentT);
  sun.color.copy(sky.uniforms.uSunColor.value);
  sunPos.copy(sky.sunDir).multiplyScalar(600);
  sun.position.copy(sunPos).add(new THREE.Vector3(0, 40, 0));
  const nightK = smoothstep(0.62, 1.0, currentT);
  sun.intensity = lerp(6.2, 0.0, nightK) * lerp(1.0, 0.70, currentT);
  hemi.intensity = lerp(0.95, 0.30, nightK);
  hemi.color.copy(new THREE.Color(0x9fc0dd)).lerp(new THREE.Color(0x24314a), nightK);
  rim.intensity = lerp(0.5, 0.25, nightK);
  fill.intensity = lerp(0.95, 0.30, nightK);
  if (lava) {
    lava.lavaLight2.intensity = lerp(10, 26, nightK);
  }
  if (app.post) {
    app.post.grade.uniforms.uExposure.value = lerp(0.98, 1.55, nightK);
    app.post.grade.uniforms.uRayStrength.value = lerp(0.55, 0.18, nightK);
  }
  if (app.hud && app.hud.timeSlider) app.hud.timeSlider.value = String(Math.round(currentT * 1000));
};

app.setFov = (f) => { camera.fov = f; camera.updateProjectionMatrix(); };

/* ------------------------------------------------------------------ *
 *  roam modes
 * ------------------------------------------------------------------ */
const player = { pos: new THREE.Vector3(48, 2, 26), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: true, bob: 0 };
let roam = 'orbit';
let pointerLocked = false;

app.setRoam = function (m) {
  roam = m;
  // leaving cinema must stop the shot camera AND its depth of field, otherwise
  // the bokeh pass keeps the last shot's focus while you fly/walk
  if (cinema) { cinema.state.active = false; cinema.state.exploring = m !== 'orbit'; cinema.state.paused = true; }
  if (post?.bokeh) post.bokeh.enabled = false;
  document.body.classList.toggle('roam', m !== 'orbit');
  if (post?.bokeh) post.bokeh.enabled = false;
  if (m === 'orbit') {
    controls.enabled = true;
    controls.target.copy(camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(30)));
    controls.update();
    document.exitPointerLock?.();
  } else {
    controls.enabled = false;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    player.pos.copy(camera.position);
    player.yaw = Math.atan2(-dir.x, -dir.z);
    player.pitch = Math.asin(clamp(dir.y, -1, 1));
    if (m === 'walk') {
      // drop to the deck if we are above it
      const r = Math.hypot(player.pos.x, player.pos.z);
      if (r > 30 && r < 78) player.pos.y = SET.deckY + 1.7;
    }
    canvas.requestPointerLock?.();
  }
  app.mode = m;
};

canvas.addEventListener('click', () => {
  if (roam !== 'orbit' && !pointerLocked) canvas.requestPointerLock?.();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  document.body.classList.toggle('locked', pointerLocked);
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = clamp(player.pitch + e.movementY * 0.0022, -1.45, 1.45);
});

const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  keys.add(e.code);
  if (e.code === 'Escape') document.exitPointerLock?.();
  if (e.code === 'KeyD') {
    app.quality.dof = !app.quality.dof;
    if (app.hud?.toast) app.hud.toast('DEPTH OF FIELD ' + (app.quality.dof ? 'ON' : 'OFF'));
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function updateRoam(dt) {
  if (roam === 'orbit') { if (controls.enabled) controls.update(); return; }
  const dir = new THREE.Vector3(Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), Math.cos(player.yaw) * Math.cos(player.pitch)).multiplyScalar(-1);
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 26 : 9) * (roam === 'fly' ? 2.2 : 1);

  if (roam === 'fly') {
    const mv = new THREE.Vector3();
    if (keys.has('KeyW')) mv.add(fwd);
    if (keys.has('KeyS')) mv.sub(fwd);
    if (keys.has('KeyD')) mv.add(right);
    if (keys.has('KeyA')) mv.sub(right);
    if (keys.has('Space')) mv.y += 1;
    if (keys.has('KeyC') || keys.has('KeyQ')) mv.y -= 1;
    if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(speed * 2.2 * dt);
    player.pos.add(mv);
    camera.position.copy(player.pos);
    camera.lookAt(player.pos.clone().add(dir));
    return;
  }

  // walk
  const mv = new THREE.Vector3();
  if (keys.has('KeyW')) mv.add(fwd);
  if (keys.has('KeyS')) mv.sub(fwd);
  if (keys.has('KeyD')) mv.add(right);
  if (keys.has('KeyA')) mv.sub(right);
  if (mv.lengthSq() > 0) mv.normalize();
  const want = mv.multiplyScalar(speed);
  player.vel.x = damp(player.vel.x, want.x, 14, dt);
  player.vel.z = damp(player.vel.z, want.z, 14, dt);

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;

  // bounds: stay on the deck annulus
  const r = Math.hypot(player.pos.x, player.pos.z);
  if (r < SET.pitR + 2.6) {
    const k = (SET.pitR + 2.6) / Math.max(r, 0.001);
    player.pos.x *= k; player.pos.z *= k;
  }
  if (r > SET.ringR - 1.8) {
    const k = (SET.ringR - 1.8) / r;
    player.pos.x *= k; player.pos.z *= k;
  }
  // column collisions
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const cx = Math.cos(a) * 52, cz = Math.sin(a) * 52;
    const dx = player.pos.x - cx, dz = player.pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d < 2.4 && d > 0.001) {
      player.pos.x = cx + (dx / d) * 2.4;
      player.pos.z = cz + (dz / d) * 2.4;
    }
  }

  const groundY = SET.deckY;
  if (keys.has('Space') && player.onGround) { player.vel.y = 6.2; player.onGround = false; }
  player.vel.y -= 18 * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= groundY + 1.72) {
    player.pos.y = groundY + 1.72;
    player.vel.y = 0;
    player.onGround = true;
  }

  const moving = Math.hypot(player.vel.x, player.vel.z) > 1.5 && player.onGround;
  player.bob += dt * (moving ? 9.5 : 0);
  const bobY = moving ? Math.sin(player.bob) * 0.035 : 0;
  const bobX = moving ? Math.cos(player.bob * 0.5) * 0.02 : 0;

  camera.position.set(player.pos.x + bobX, player.pos.y + bobY, player.pos.z);
  camera.lookAt(camera.position.clone().add(dir));
}

/* ------------------------------------------------------------------ *
 *  boot
 * ------------------------------------------------------------------ */
let post, cinema;

async function boot() {
  await build();

  post = createPost(renderer, scene, camera, { ao: false, dof: false });
  app.post = post;

  app.setTime(0.40, true);

  // shadow camera fit
  sun.shadow.camera.updateProjectionMatrix();

  cinema = createCinema(app, null);
  app.cinema = cinema;

  const hud2 = createHUD(app, cinema);
  app.hud = hud2;
  cinema.hud = hud2;

  hud2.setLoad(1.0, 'READY');
  await nextFrame();
  await nextFrame();

  renderer.compile(scene, camera);
  hud2.doneLoad();
  hud2.showTitle();
  cinema.start(0);

  window.__ready = true;
  window.__app = app;
  window.__THREE = THREE;
  window.__probe = (x, y, z) => {
    const rc = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0));
    return rc.intersectObject(scene, true).slice(0, 8).map((h) => ({
      name: h.object.name || '?', parent: h.object.parent?.name || '',
      y: +h.point.y.toFixed(2), dist: +h.distance.toFixed(1),
    }));
  };
  window.__cinema = cinema;
  window.__renderInfo = () => ({
    calls: renderer.info.render.calls,
    tris: renderer.info.render.triangles,
    fps: lastFps,
    t: currentT,
    shots: cinema.SHOTS.length,
  });
  window.__setCam = (pos, target, fov) => {
    cinema.state.active = false;
    cinema.state.exploring = true;
    controls.enabled = true;
    camera.position.fromArray(pos);
    controls.target.fromArray(target || [0, 60, 0]);
    if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.lookAt(controls.target);
    controls.update();
    document.body.classList.remove('cinema');
  };
  window.__setTime = (t) => app.setTime(t, true);
}

/* ------------------------------------------------------------------ *
 *  loop
 * ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let elapsed = 0;
let fpsAcc = 0, fpsFrames = 0, lastFps = 60, fpsTimer = 0;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (sky) sky.update(dt);
  if (harvester) harvester.update(dt, elapsed);
  if (lava) lava.update(dt, elapsed);
  if (world.props && world.props.update) world.props.update(dt, elapsed);
  if (world.dust) world.dust.update(dt, elapsed, camera);
  if (post) post.grade.uniforms.uTime.value = elapsed;

  if (cinema) cinema.update(dt);
  updateRoam(dt);
  if (roam !== 'orbit' && post?.bokeh && post.bokeh.enabled) post.bokeh.enabled = false;

  // sun glare uniform: project sun into screen space
  if (post) {
    const p = sky.uniforms.uSunDir.value.clone().multiplyScalar(1000).add(camera.position).project(camera);
    post.grade.uniforms.uSunPos.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const behind = sky.uniforms.uSunDir.value.dot(camera.getWorldDirection(new THREE.Vector3())) > 0.05;
    post.grade.uniforms.uSunVisible.value = p.z < 1 && behind ? 1 : 0;
  }

  renderer.info.reset();
  if (post && !window.__noPost) post.composer.render(dt);
  else renderer.render(scene, camera);

  // fps
  fpsAcc += dt; fpsFrames++; fpsTimer += dt;
  if (fpsTimer > 0.5) {
    lastFps = Math.round(fpsFrames / fpsAcc);
    if (app.hud) app.hud.fps(lastFps);
    fpsAcc = 0; fpsFrames = 0; fpsTimer = 0;
  }

  window.__fps = lastFps;
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post?.setSize(w, h);
});

app.applyQuality = () => {
  const lv = ['low', 'mid', 'high'][app.qualityLevel];
  post?.setQuality(lv);
  app.quality.dof = lv === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lv === 'low' ? 1 : 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  post?.setSize(window.innerWidth, window.innerHeight);
};

boot().then(() => frame()).catch((e) => {
  console.error('[boot-failed]', e && (e.stack || e.message) || e);
  const l = document.getElementById('ldStep');
  if (l) l.textContent = 'ERROR: ' + (e && e.message);
});
