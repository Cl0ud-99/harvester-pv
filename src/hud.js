import { clamp } from './lib/util.js';

const $ = (id) => document.getElementById(id);

export function createHUD(app, cinema) {
  const el = {
    shotNum: $('shotNum'), shotLabel: $('shotLabel'), shotBar: $('shotBar'),
    timecode: $('timecode'), fps: $('fps'),
    dots: $('dots'), play: $('btnPlay'),
    tabCinema: $('tabCinema'), tabExplore: $('tabExplore'),
    timeSlider: $('timeSlider'), fovSlider: $('fovSlider'),
    btnClean: $('btnClean'), btnSound: $('btnSound'), btnQuality: $('btnQuality'),
    title: $('titleCard'), end: $('endCard'), replay: $('btnReplay'), free: $('btnFree'),
    hint: $('hint'), loader: $('loader'), ldFill: $('ldFill'), ldStep: $('ldStep'),
    modeOrbit: $('modeOrbit'), modeWalk: $('modeWalk'), modeFly: $('modeFly'),
  };

  /* ---- shot dots ---- */
  el.dots.innerHTML = '';
  cinema.SHOTS.forEach((s, i) => {
    const d = document.createElement('i');
    d.title = `${s.num} ${s.label}`;
    d.onclick = () => { cinema.start(i); setPlaying(true); };
    el.dots.appendChild(d);
  });

  let playing = true;
  let clean = false;
  let sound = false;

  function setPlaying(v) {
    playing = v;
    el.play.textContent = v ? '❚❚' : '▶';
  }

  function updateShot(i, p, s) {
    el.shotNum.textContent = s.num;
    el.shotLabel.textContent = s.label;
    el.shotBar.style.width = (p * 100).toFixed(1) + '%';
    [...el.dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    const total = cinema.state.shotT;
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(Math.floor(total % 60)).padStart(2, '0');
    const ff = String(Math.floor((total % 1) * 24)).padStart(2, '0');
    el.timecode.textContent = `00:${mm}:${ss}:${ff}`;
  }

  function onShotStart(i) {
    el.title.classList.remove('show');
    setPlaying(true);
  }

  function onEnd() {
    el.end.classList.add('show');
    setPlaying(false);
  }

  function onExplore() {
    el.end.classList.remove('show');
    document.body.classList.add('explore');
    el.tabExplore.classList.add('active');
    el.tabCinema.classList.remove('active');
    setMode('orbit');
  }

  function setMode(m) {
    [['orbit', el.modeOrbit], ['walk', el.modeWalk], ['fly', el.modeFly]].forEach(([k, b]) => b && b.classList.toggle('on', k === m));
  }

  /* ---- buttons ---- */
  el.play.onclick = () => { cinema.toggle(); setPlaying(!cinema.state.paused); };
  el.tabCinema.onclick = () => { cinema.start(cinema.state.shot); setPlaying(true); el.tabCinema.classList.add('active'); el.tabExplore.classList.remove('active'); };
  el.tabExplore.onclick = () => { cinema.explore(); };

  el.timeSlider.oninput = (e) => {
    const t = Number(e.target.value) / 1000;
    if (!cinema.state.exploring) cinema.explore();
    app.setTime(t, true);
  };
  el.fovSlider.oninput = (e) => { app.setFov(Number(e.target.value)); };

  el.btnClean.onclick = () => toggleClean();
  el.btnSound.onclick = () => toggleSound();
  el.btnQuality.onclick = () => {
    app.qualityLevel = (app.qualityLevel + 1) % 3;
    el.btnQuality.textContent = ['LQ', 'MQ', 'HQ'][app.qualityLevel];
    app.applyQuality();
  };
  el.btnQuality.textContent = 'HQ';

  el.replay.onclick = () => { el.end.classList.remove('show'); cinema.start(0); setPlaying(true); };
  el.free.onclick = () => { el.end.classList.remove('show'); cinema.explore(); };
  el.modeOrbit.onclick = () => { app.setRoam('orbit'); setMode('orbit'); };
  el.modeWalk.onclick = () => { app.setRoam('walk'); setMode('walk'); };
  el.modeFly.onclick = () => { app.setRoam('fly'); setMode('fly'); };

  function toggleClean() {
    clean = !clean;
    document.body.classList.toggle('hidehud', clean);
    el.btnClean.classList.toggle('on', clean);
    el.btnClean.textContent = clean ? '▣' : '◻';
    el.btnClean.title = clean ? 'Show interface (H / Esc)' : 'Clean view (H)';
  }

  let audio = null;
  function toggleSound() {
    sound = !sound;
    el.btnSound.classList.toggle('on', sound);
    if (!audio) audio = createAmbient();
    if (sound) audio.start(); else audio.stop();
  }

  /* ---- keyboard ---- */
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // never swallow browser/OS combos
    switch (e.code) {
      case 'Space': e.preventDefault(); cinema.toggle(); setPlaying(!cinema.state.paused); break;
      case 'KeyE': cinema.explore(); break;
      case 'KeyH': toggleClean(); break;
      case 'Escape': if (document.body.classList.contains('hidehud')) toggleClean(); break;
      case 'KeyM': toggleSound(); break;
      case 'ArrowRight': cinema.start(Math.min(cinema.state.shot + 1, cinema.SHOTS.length - 1)); setPlaying(true); break;
      case 'ArrowLeft': cinema.start(Math.max(cinema.state.shot - 1, 0)); setPlaying(true); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': {
        const n = Number(e.code.slice(-1)) - 1;
        if (!document.body.classList.contains('roam')) { cinema.start(n); setPlaying(true); }
        break;
      }
      case 'KeyF': if (cinema.state.exploring) { app.setRoam('fly'); setMode('fly'); } break;
      case 'KeyV': if (cinema.state.exploring) { app.setRoam('walk'); setMode('walk'); } break;
      default: break;
    }
  });

  /* ---- loader ---- */
  function setLoad(p, step) {
    el.ldFill.style.width = Math.round(p * 100) + '%';
    if (step) el.ldStep.textContent = step;
  }
  function doneLoad() {
    el.loader.classList.add('done');
    setTimeout(() => el.loader.remove(), 1200);
  }

  function showTitle() {
    el.title.classList.add('show');
    setTimeout(() => el.title.classList.remove('show'), 4200);
  }

  function fps(v) { el.fps.textContent = v + ' FPS'; }

  return { updateShot, onShotStart, onEnd, onExplore, setPlaying, setLoad, doneLoad, showTitle, fps, setMode, toggleClean, timeSlider: el.timeSlider };
}

/* ---------------- procedural ambience ---------------- */
function createAmbient() {
  let ctx = null, started = false, nodes = [];
  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // low rumble
      const bufSize = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      const g = ctx.createGain(); g.gain.value = 0.12;
      src.connect(lp).connect(g).connect(ctx.destination);
      src.start();

      // molten hiss
      const buf2 = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d2 = buf2.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d2[i] = (Math.random() * 2 - 1) * 0.35;
      const src2 = ctx.createBufferSource(); src2.buffer = buf2; src2.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
      const g2 = ctx.createGain(); g2.gain.value = 0.012;
      src2.connect(bp).connect(g2).connect(ctx.destination);
      src2.start();

      // slow sine drone
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 43;
      const g3 = ctx.createGain(); g3.gain.value = 0.05;
      osc.connect(g3).connect(ctx.destination); osc.start();

      nodes = [src, src2, osc, g, g2, g3];
    }
    if (ctx.state === 'suspended') ctx.resume();
    started = true;
  }
  function stop() {
    if (!ctx) return;
    ctx.suspend();
    started = false;
  }
  return { start, stop };
}
