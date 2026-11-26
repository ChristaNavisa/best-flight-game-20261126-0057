// ARUNIKA: screenshot staging. One job: the ?shot=1..4 poses the game
// loads into, so each screenshot is a real render of the game in a scene
// that shows it at its best. Gameplay is untouched; these poses only set
// the starting state before the first frame.

import { CONFIG } from './config.js';
import { deg2rad, v3 } from './math3d.js';
import { buildRings } from './rings.js';

// Heading (deg, 0 = north) that points from `from` toward `to`.
function headingToward(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  let h = Math.atan2(dx, -dz);
  return h;
}

export function applyShotPreset(state, shot, hooks) {
  const plane = state.plane;
  const runway = CONFIG.runway;
  const hideMenu = () => {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
  };

  if (shot === '1') {
    // Cover: chase view, island + runway ahead, next ring in frame.
    plane.pos = v3(-140, 250, -330);
    plane.yaw = headingToward(plane.pos, [200, 26, 0]);
    plane.pitch = 0.0;
    plane.roll = 0.04;
    plane.speed = 62;
    plane.throttle = 0.72;
    plane.onGround = false;
    state.rings = buildRings();
    state.nextRing = state.rings[0];
    state.phase = 'flying';
    state.cameraMode = 'chase';
    hideMenu();
  } else if (shot === '2') {
    // Cockpit view: instruments lit, ring 1 dead ahead, town below.
    plane.pos = v3(-140, 175, -330);
    plane.yaw = headingToward(plane.pos, [120, 0, -260]);
    plane.pitch = -0.04;
    plane.roll = -0.05;
    plane.speed = 58;
    plane.throttle = 0.66;
    plane.verticalSpeed = -2.8;
    plane.onGround = false;
    state.rings = buildRings();
    state.nextRing = state.rings[0];
    state.phase = 'flying';
    state.cameraMode = 'cockpit';
    hideMenu();
  } else if (shot === '3') {
    // Landing approach: low over the runway threshold, gear down, "09" ahead.
    plane.pos = v3(runway.x0 - 260, 62, 6);
    plane.yaw = deg2rad(90);
    plane.pitch = -0.03;
    plane.roll = 0;
    plane.speed = 44;
    plane.throttle = 0.38;
    plane.verticalSpeed = -1.5;
    plane.onGround = false;
    state.rings = buildRings();
    state.rings.forEach((r) => (r.passed = true));
    state.ringsDone = true;
    state.dropDone = true;
    state.objectivesDone = 2;
    state.nextRing = null;
    state.phase = 'flying';
    state.cameraMode = 'chase';
    document.getElementById('phase-label').textContent = 'FINAL APPROACH — RUNWAY 09 AHEAD';
    hideMenu();
  } else if (shot === '4') {
    // Through the ring: close on ring 3, sea and island behind it.
    const ring = buildRings()[2];
    state.rings = buildRings();
    state.rings[0].passed = true;
    state.rings[1].passed = true;
    state.nextRing = state.rings[2];
    plane.pos = v3(ring.pos[0] - 150, ring.pos[1] + 8, ring.pos[2] + 170);
    plane.yaw = headingToward(plane.pos, ring.pos);
    plane.pitch = -0.02;
    plane.roll = 0.18;
    plane.speed = 66;
    plane.throttle = 0.78;
    plane.verticalSpeed = -1.6;
    plane.onGround = false;
    state.ringsDone = false;
    state.objectivesDone = 0;
    state.phase = 'flying';
    state.cameraMode = 'chase';
    hideMenu();
  }
}
