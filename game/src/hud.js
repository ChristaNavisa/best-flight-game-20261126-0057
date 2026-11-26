// ARUNIKA: the HUD. One job: the DOM instruments — altitude, speed,
// heading tape, artificial horizon, throttle and fuel, the mission
// checklist and the banners — kept in sync with the plane every frame.

import { planeHeadingDeg, planeKnots } from './plane.js';
import { clamp, rad2deg } from './math3d.js';

function $(id) {
  return document.getElementById(id);
}

function compassLetter(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// Build the compass tape: ticks every 15 degrees, labels every 45.
function buildCompassTape() {
  const tape = $('compass-tape');
  tape.innerHTML = '';
  for (let d = 0; d < 360; d += 15) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${(d / 360) * 100}%`;
    if (d % 45 === 0) {
      tick.classList.add('major');
      const lab = document.createElement('span');
      lab.textContent = d === 0 ? 'N' : d === 90 ? 'E' : d === 180 ? 'S' : d === 270 ? 'W' : String(d);
      tick.appendChild(lab);
    }
    tape.appendChild(tick);
  }
}

export function initHud() {
  buildCompassTape();
}

function updateCompass(headingDeg) {
  const tape = $('compass-tape');
  // Slide the tape so the current heading stays centred.
  tape.style.transform = `translateX(${50 - (headingDeg / 360) * 100}%)`;
  $('hdg-value').textContent = `${String(Math.round(headingDeg)).padStart(3, '0')}° ${compassLetter(headingDeg)}`;
}

function drawHorizon(canvas, plane) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.5, 0.5) * h * 0.9;
  ctx.translate(0, pitchPx);
  ctx.fillStyle = '#3f8fd0';
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-w, 0, w * 2, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(w, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 26, h / 2);
  ctx.lineTo(w / 2 - 8, h / 2);
  ctx.moveTo(w / 2 + 8, h / 2);
  ctx.lineTo(w / 2 + 26, h / 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

export function updateHud(state) {
  const plane = state.plane;
  const altFt = Math.max(0, Math.round(plane.pos[1] * 3.28));
  const knots = Math.round(planeKnots(plane));
  const hdg = planeHeadingDeg(plane);
  $('alt-value').textContent = altFt.toLocaleString('en-US');
  $('spd-value').textContent = String(knots);
  $('vsi-value').textContent = `${plane.verticalSpeed >= 0 ? '+' : ''}${Math.round(plane.verticalSpeed * 3.28 * 60)}`;
  updateCompass(hdg);
  drawHorizon($('horizon'), plane);

  const throttleBar = $('throttle-fill');
  throttleBar.style.width = `${Math.round(plane.throttle * 100)}%`;
  $('throttle-value').textContent = `${Math.round(plane.throttle * 100)}%`;
  const fuelBar = $('fuel-fill');
  fuelBar.style.width = `${Math.round(plane.fuel)}%`;
  fuelBar.classList.toggle('low', plane.fuel < 20);
  $('fuel-value').textContent = `${Math.round(plane.fuel)}%`;
  $('score-value').textContent = state.score.toLocaleString('en-US');
  $('time-value').textContent = formatTime(state.elapsed);

  // Next-ring pointer: an arrow at screen centre pointing toward it.
  const arrow = $('ring-arrow');
  if (state.nextRing && state.phase === 'flying') {
    const dx = state.nextRing.pos[0] - plane.pos[0];
    const dz = state.nextRing.pos[2] - plane.pos[2];
    const bearing = Math.atan2(dx, -dz);
    const rel = bearing - plane.yaw;
    const deg = ((rad2deg(rel) % 360) + 360) % 360;
    arrow.style.display = 'block';
    arrow.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    $('ring-dist').textContent = `RING ${state.nextRing.index + 1} · ${Math.round(Math.hypot(dx, dz))}m`;
  } else {
    arrow.style.display = 'none';
    $('ring-dist').textContent = state.phase === 'flying' ? 'ALL RINGS CLEAR' : '';
  }

  // Mission checklist.
  const items = document.querySelectorAll('#mission-list li');
  items[0].classList.toggle('done', state.ringsDone);
  items[0].classList.toggle('active', !state.ringsDone);
  items[1].classList.toggle('done', state.dropDone);
  items[1].classList.toggle('active', state.ringsDone && !state.dropDone);
  items[2].classList.toggle('done', state.landed);
  items[2].classList.toggle('active', state.ringsDone && state.dropDone && !state.landed);
  $('mission-count').textContent = `${state.objectivesDone}/3`;

  // Low-fuel warning.
  $('fuel-warning').style.display = plane.fuel < 20 && plane.fuel > 0 ? 'block' : 'none';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function showBanner(kind, title, sub) {
  const banner = $('banner');
  banner.className = `show ${kind}`;
  $('banner-title').textContent = title;
  $('banner-sub').textContent = sub || '';
}

export function hideBanner() {
  const banner = $('banner');
  banner.className = '';
}

export function setPhaseLabel(text) {
  $('phase-label').textContent = text;
}
