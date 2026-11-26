// ARUNIKA: mission objects. One job: the sky rings, the supply-drop crate
// and the landing target — where they are, when the plane passes them, and
// what they are worth.

import { CONFIG, DROP_TARGET, RING_COURSE } from './config.js';
import { terrainHeight } from './terrain.js';
import { v3 } from './math3d.js';

// Ring positions: fixed x/z from the course, altitude above the terrain.
export function buildRings() {
  return RING_COURSE.map((r, i) => ({
    index: i,
    pos: v3(r.x, Math.max(terrainHeight(r.x, r.z) + r.alt, 90), r.z),
    radius: 26,
    passed: false,
  }));
}

// True when the plane's nose crosses the ring's disc (within its radius,
// close to its plane). The rings face the course direction loosely; the
// disc test uses distance to the ring centre in 3D, which reads the same
// from the chase camera.
export function ringPassed(ring, planePos, prevPos) {
  if (ring.passed) return false;
  const dNow = Math.hypot(
    planePos[0] - ring.pos[0],
    planePos[1] - ring.pos[1],
    planePos[2] - ring.pos[2],
  );
  const dPrev = Math.hypot(
    prevPos[0] - ring.pos[0],
    prevPos[1] - ring.pos[1],
    prevPos[2] - ring.pos[2],
  );
  // Crossing the disc: closest approach inside the ring, moving through it.
  const crossed = dPrev > ring.radius * 0.9 && dNow <= ring.radius && dNow < dPrev;
  const inside = dNow <= ring.radius * 0.85;
  if (crossed || inside) {
    ring.passed = true;
    return true;
  }
  return false;
}

export function nextRing(rings) {
  return rings.find((r) => !r.passed) || null;
}

export function ringsRemaining(rings) {
  return rings.filter((r) => !r.passed).length;
}

// --- supply drop --------------------------------------------------------------
export function createCrate() {
  return {
    active: false,
    landed: false,
    hit: false,
    pos: v3(0, 0, 0),
    vel: v3(0, 0, 0),
  };
}

export function dropCrate(crate, plane) {
  if (crate.active) return false;
  crate.active = true;
  crate.landed = false;
  crate.pos = [plane.pos[0], plane.pos[1] - 2, plane.pos[2]];
  crate.vel = [0, -2, 0];
  return true;
}

// Falls with gravity until it meets the ground; reports 'hit' | 'miss' once.
export function stepCrate(crate, dt) {
  if (!crate.active || crate.landed) return null;
  crate.vel[1] -= CONFIG.gravity * dt;
  crate.pos = [
    crate.pos[0] + crate.vel[0] * dt,
    crate.pos[1] + crate.vel[1] * dt,
    crate.pos[2] + crate.vel[2] * dt,
  ];
  const ground = terrainHeight(crate.pos[0], crate.pos[2]);
  if (crate.pos[1] <= ground + 1) {
    crate.pos[1] = ground + 1;
    crate.landed = true;
    const d = Math.hypot(crate.pos[0] - DROP_TARGET.x, crate.pos[2] - DROP_TARGET.z);
    crate.hit = d <= DROP_TARGET.radius;
    return crate.hit ? 'hit' : 'miss';
  }
  return null;
}

// Crate mesh: a small supply box with a parachute canopy while falling.
export function crateTris(crate) {
  if (!crate.active) return [];
  const tris = [];
  const [x, y, z] = crate.pos;
  const s = 2.2;
  const box = (cx, cy, cz, w, h, d, col) => {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const c = [
      v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1),
      v3(x0, y1, z0), v3(x1, y1, z0), v3(x1, y1, z1), v3(x0, y1, z1),
    ];
    const faces = [[0, 1, 2, 3], [4, 6, 5, 7], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
    for (const [i0, i1, i2, i3] of faces) {
      tris.push({ a: c[i0], b: c[i1], c: c[i2], color: col });
      tris.push({ a: c[i0], b: c[i2], c: c[i3], color: col });
    }
  };
  box(x, y, z, s, s, s, '#c8452c');
  if (!crate.landed) {
    // Parachute canopy: a shallow dome above the crate.
    const cy = y + s * 2.6;
    const canopy = [
      [x - 5, cy, z], [x + 5, cy, z], [x, cy + 2.4, z],
      [x, cy, z - 5], [x, cy, z + 5], [x, cy + 2.4, z],
    ];
    for (let i = 0; i < canopy.length; i += 3) {
      tris.push({ a: v3(...canopy[i]), b: v3(...canopy[i + 1]), c: v3(...canopy[i + 2]), color: '#f2efe2' });
    }
  }
  return tris;
}
