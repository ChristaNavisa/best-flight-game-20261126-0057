// ARUNIKA: the game loop. One job: states (menu, flying, landed, crashed,
// complete), the mission flow, the camera, and one frame per animation tick.

import { CONFIG, DROP_TARGET } from './config.js';
import { createPlane, stepPlane, planeWorldTris, planeHeadingDeg } from './plane.js';
import { buildRings, nextRing, ringPassed, ringsRemaining, createCrate, dropCrate, stepCrate, crateTris } from './rings.js';
import { buildWorldTris, terrainHeight } from './terrain.js';
import { renderFrame } from './render.js';
import { initHud, updateHud, showBanner, hideBanner, setPhaseLabel } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { applyShotPreset } from './shots.js';
import { aircraftBasis, clamp, deg2rad, lerp, v3, v3add, v3scale } from './math3d.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  phase: 'menu', // menu | flying | landed | crashed | complete
  plane: createPlane(),
  rings: buildRings(),
  crate: createCrate(),
  score: 0,
  elapsed: 0,
  timeSeconds: 0,
  ringsDone: false,
  dropDone: false,
  landed: false,
  objectivesDone: 0,
  nextRing: null,
  cameraMode: 'chase',
  camPos: v3(0, 40, 60),
  camLook: v3(0, 26, 0),
  crashReason: '',
  shotMode: null,
};

const worldTris = buildWorldTris();
const audio = createAudio();
const input = createInput(canvas);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
}

function resetSortie() {
  state.plane = createPlane();
  state.rings = buildRings();
  state.crate = createCrate();
  state.score = 0;
  state.elapsed = 0;
  state.ringsDone = false;
  state.dropDone = false;
  state.landed = false;
  state.objectivesDone = 0;
  state.nextRing = nextRing(state.rings);
  state.crashReason = '';
  state.camPos = v3(40 - 27, 40, 60);
  hideBanner();
  setPhaseLabel('ON THE RUNWAY');
}

function startFlying() {
  if (state.phase === 'flying') return;
  resetSortie();
  state.phase = 'flying';
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  audio.ensure();
  setPhaseLabel('TAKE OFF — THROTTLE UP');
}

function endSortie(kind, title, sub) {
  state.phase = kind;
  showBanner(kind === 'crashed' ? 'crash' : 'win', title, sub);
  if (kind === 'crashed') audio.thud();
  setPhaseLabel(kind === 'crashed' ? 'CRASHED' : 'SORTIE COMPLETE');
}

function updateCamera(dt) {
  const plane = state.plane;
  const basis = aircraftBasis(plane.yaw, plane.pitch, plane.roll);
  let targetPos;
  let targetLook;
  if (state.cameraMode === 'cockpit') {
    targetPos = v3add(plane.pos, v3add(v3scale(basis.up, 1.7), v3scale(basis.forward, 1.4)));
    targetLook = v3add(plane.pos, v3scale(basis.forward, 120));
  } else {
    targetPos = v3add(plane.pos, v3add(v3scale(basis.forward, -CONFIG.chaseDistance), v3scale(basis.up, CONFIG.chaseHeight)));
    // Keep the chase camera out of the ground.
    const ground = terrainHeight(targetPos[0], targetPos[2]);
    if (targetPos[1] < ground + 3) targetPos[1] = ground + 3;
    targetLook = v3add(plane.pos, v3add(v3scale(basis.forward, 34), v3(0, 2, 0)));
  }
  const snap = state.cameraMode === 'cockpit' ? 1 : 1 - Math.exp(-dt * 7);
  state.camPos = [
    lerp(state.camPos[0], targetPos[0], snap),
    lerp(state.camPos[1], targetPos[1], snap),
    lerp(state.camPos[2], targetPos[2], snap),
  ];
  state.camLook = [
    lerp(state.camLook[0], targetLook[0], snap),
    lerp(state.camLook[1], targetLook[1], snap),
    lerp(state.camLook[2], targetLook[2], snap),
  ];
  return { mode: state.cameraMode, camPos: state.camPos, lookAt: state.camLook };
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  state.timeSeconds += dt;

  if (state.phase === 'flying' && !state.shotMode) {
    state.elapsed += dt;
    const plane = state.plane;
    const prevPos = [...plane.pos];
    const stick = input.read(dt);
    const event = stepPlane(plane, stick, dt);
    state.nextRing = nextRing(state.rings);

    // Rings.
    if (state.nextRing && ringPassed(state.nextRing, plane.pos, prevPos)) {
      state.score += CONFIG.ringPoints;
      audio.chime('ring');
      if (ringsRemaining(state.rings) === 0) {
        state.ringsDone = true;
        state.objectivesDone = 1;
        setPhaseLabel('RINGS CLEAR — DROP THE CRATE ON THE YELLOW CIRCLE');
        showBanner('info', 'RING RUN CLEAR', '+1,250 — now drop the crate on the yellow circle by the town');
        setTimeout(hideBanner, 2600);
      } else {
        setPhaseLabel(`RING ${state.nextRing.index + 1} OF 5`);
      }
      state.nextRing = nextRing(state.rings);
    }

    // Crate.
    const crateEvent = stepCrate(state.crate, dt);
    if (crateEvent === 'hit') {
      state.score += CONFIG.dropPoints;
      state.dropDone = true;
      state.objectivesDone = 2;
      audio.chime('drop');
      setPhaseLabel('SUPPLY DELIVERED — LAND ON RUNWAY 09');
      showBanner('info', 'SUPPLY DELIVERED', '+500 — now bring her home: land on runway 09');
      setTimeout(hideBanner, 2600);
    } else if (crateEvent === 'miss') {
      showBanner('info', 'CRATE MISSED THE TARGET', 'The crate landed outside the circle — no points, keep flying');
      setTimeout(hideBanner, 2400);
    }

    // Touchdown / crash.
    if (event === 'landed-soft' || event === 'landed-rough') {
      state.landed = true;
      const soft = event === 'landed-soft';
      state.score += soft ? CONFIG.landingSoftPoints : CONFIG.landingRoughPoints;
      if (state.ringsDone && state.dropDone) {
        state.objectivesDone = 3;
        endSortie(
          'complete',
          'SORTIE COMPLETE',
          `Rings, drop and landing — score ${state.score.toLocaleString('en-US')} in ${Math.round(state.elapsed)}s. Press R to fly again.`,
        );
        audio.chime('win');
      } else {
        setPhaseLabel('LANDED — PRESS R TO FLY AGAIN');
        showBanner(
          'info',
          soft ? 'SMOOTH LANDING' : 'ROUGH LANDING',
          `+${soft ? CONFIG.landingSoftPoints : CONFIG.landingRoughPoints} — but the sortie is not finished yet. Press R to fly again.`,
        );
      }
    } else if (event === 'crashed-terrain') {
      state.crashReason = 'terrain';
      endSortie('crashed', 'CRASHED', 'You hit the ground too hard. Press R to fly again.');
    } else if (event === 'crashed-water') {
      state.crashReason = 'water';
      endSortie('crashed', 'DITCHED IN THE SEA', 'The plane went into the water. Press R to fly again.');
    }

    // Fuel out while airborne: a glide to whatever is below.
    if (plane.fuel <= 0 && !plane.onGround) {
      setPhaseLabel('FUEL EMPTY — GLIDING');
    }

    audio.update(plane.throttle, clamp(plane.speed / CONFIG.maxSpeed, 0, 1), true);
  }

  // Render every frame, in every phase (the menu shows the island too).
  const view = updateCamera(dt);
  // In cockpit mode the canvas panel carries the gauges; hide the DOM
  // instruments so they do not cover them, and lift the buttons above
  // the dashboard so they do not cover the VSI gauge either.
  const instruments = document.getElementById('instruments');
  if (instruments) instruments.style.visibility = state.cameraMode === 'cockpit' ? 'hidden' : 'visible';
  document.body.classList.toggle('cockpit', state.cameraMode === 'cockpit');
  const planeTris = planeWorldTris(state.plane, state.timeSeconds);
  renderFrame(
    ctx,
    canvas.width,
    canvas.height,
    view,
    worldTris,
    planeTris,
    state.rings,
    crateTris(state.crate),
    state.plane,
    state.timeSeconds,
  );
  if (state.phase !== 'menu') updateHud(state);
}

function bindUi() {
  document.getElementById('start-btn').addEventListener('click', () => {
    audio.ensure();
    startFlying();
  });
  document.querySelectorAll('.mission-card').forEach((card) => {
    card.addEventListener('click', () => {
      audio.ensure();
      startFlying();
    });
  });
  document.getElementById('restart-btn').addEventListener('click', () => {
    resetSortie();
    state.phase = 'flying';
    hideBanner();
  });
  document.getElementById('camera-btn').addEventListener('click', () => {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
  });
  document.getElementById('mute-btn').addEventListener('click', (e) => {
    const muted = audio.toggleMute();
    e.target.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  });
  const thrUp = document.getElementById('thr-up');
  const thrDown = document.getElementById('thr-down');
  thrUp.addEventListener('mousedown', () => input.keys.add('ShiftLeft'));
  thrUp.addEventListener('mouseup', () => input.keys.delete('ShiftLeft'));
  thrDown.addEventListener('mousedown', () => input.keys.add('ControlLeft'));
  thrDown.addEventListener('mouseup', () => input.keys.delete('ControlLeft'));
  input.onDrop = () => {
    if (state.phase !== 'flying') return;
    if (dropCrate(state.crate, state.plane)) {
      setPhaseLabel('CRATE AWAY — WATCH WHERE IT LANDS');
    }
  };
  input.onToggleCamera = () => {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
  };
  input.onRestart = () => {
    if (state.phase === 'menu') return;
    resetSortie();
    state.phase = 'flying';
  };
  input.onMute = () => {
    audio.toggleMute();
  };
  window.addEventListener('resize', resize);
}

function boot() {
  resize();
  initHud();
  input.attach();
  bindUi();
  resetSortie();
  state.phase = 'menu';
  // Screenshot staging (?shot=1..4) starts the game in a fixed pose.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    state.shotMode = shot;
    applyShotPreset(state, shot, { startFlying, terrainHeight });
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    // Snap the chase camera to the preset pose at once: the camera lerps
    // over frames, and a screenshot may only run a few of them.
    updateCamera(10);
  }
  requestAnimationFrame(frame);
}

boot();
