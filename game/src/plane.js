// ARUNIKA: the aircraft. One job: the plane's shape (built from triangles
// in local space) and its arcade flight model (throttle, lift, banking
// turns, stall sink, fuel, ground handling, crashes and landings).

import { CONFIG, PALETTE } from './config.js';
import { aircraftBasis, clamp, deg2rad, lerp, localToWorld, smoothstep, v3, v3add, v3dot, v3normalize, v3scale } from './math3d.js';
import { terrainHeight } from './terrain.js';

// --- aircraft mesh (local space: nose -Z, up +Y, right +X) -------------------
// Each entry: [ [x,y,z] x3, colorKey ]. Built once, transformed per frame.
const BODY = PALETTE.planeBody;
const ACCENT = PALETTE.planeAccent;
const CANOPY = PALETTE.planeCanopy;
const DARK = '#3a3f45';

const PLANE_TRIS = [
  // Fuselage: nose to tail, top and bottom.
  [[0, 0.4, -6.4], [-0.9, 0.1, -2.5], [0.9, 0.1, -2.5], BODY],
  [[0, 0.4, -6.4], [0.9, 0.1, -2.5], [0.9, 0.1, 2.8], BODY],
  [[0, 0.4, -6.4], [0.9, 0.1, 2.8], [-0.9, 0.1, 2.8], BODY],
  [[0, 0.4, -6.4], [-0.9, 0.1, 2.8], [-0.9, 0.1, -2.5], BODY],
  [[0, -0.7, -5.6], [0.9, 0.1, -2.5], [-0.9, 0.1, -2.5], BODY],
  [[0, -0.7, -5.6], [-0.9, 0.1, -2.5], [-0.9, 0.1, 2.8], BODY],
  [[0, -0.7, -5.6], [-0.9, 0.1, 2.8], [0.9, 0.1, 2.8], BODY],
  [[0, -0.7, -5.6], [0.9, 0.1, 2.8], [0.9, 0.1, -2.5], BODY],
  // Tail cone.
  [[0, 0.1, 2.8], [-0.9, 0.1, 2.8], [0, 0.35, 6.2], ACCENT],
  [[0, 0.1, 2.8], [0, 0.35, 6.2], [0.9, 0.1, 2.8], ACCENT],
  [[0, -0.5, 2.8], [0.9, 0.1, 2.8], [0, 0.35, 6.2], ACCENT],
  [[0, -0.5, 2.8], [0, 0.35, 6.2], [-0.9, 0.1, 2.8], ACCENT],
  // Main wings (slightly swept, red tips).
  [[-0.8, 0.05, -1.2], [-8.6, 0.05, 0.6], [-8.6, 0.05, 1.6], BODY],
  [[-0.8, 0.05, -1.2], [-8.6, 0.05, 1.6], [-0.8, 0.05, 1.9], BODY],
  [[0.8, 0.05, -1.2], [0.8, 0.05, 1.9], [8.6, 0.05, 1.6], BODY],
  [[0.8, 0.05, -1.2], [8.6, 0.05, 1.6], [8.6, 0.05, 0.6], BODY],
  [[-8.6, 0.05, 0.6], [-9.4, 0.05, 0.7], [-9.4, 0.05, 1.5], ACCENT],
  [[-8.6, 0.05, 0.6], [-9.4, 0.05, 1.5], [-8.6, 0.05, 1.6], ACCENT],
  [[8.6, 0.05, 0.6], [8.6, 0.05, 1.6], [9.4, 0.05, 1.5], ACCENT],
  [[8.6, 0.05, 0.6], [9.4, 0.05, 1.5], [9.4, 0.05, 0.7], ACCENT],
  // Horizontal stabiliser.
  [[-0.5, 0.15, 5.4], [-3.4, 0.15, 6.4], [-3.4, 0.15, 7.0], BODY],
  [[-0.5, 0.15, 5.4], [-3.4, 0.15, 7.0], [-0.5, 0.15, 6.8], BODY],
  [[0.5, 0.15, 5.4], [0.5, 0.15, 6.8], [3.4, 0.15, 7.0], BODY],
  [[0.5, 0.15, 5.4], [3.4, 0.15, 7.0], [3.4, 0.15, 6.4], BODY],
  // Vertical fin.
  [[0, 0.1, 5.2], [0, 0.1, 7.0], [0, 2.4, 6.6], ACCENT],
  [[0, 0.1, 5.2], [0, 2.4, 6.6], [0, 2.4, 5.6], ACCENT],
  // Canopy (lit glass).
  [[-0.55, 0.35, -3.4], [0.55, 0.35, -3.4], [0.45, 1.05, -1.2], CANOPY],
  [[-0.55, 0.35, -3.4], [0.45, 1.05, -1.2], [-0.45, 1.05, -1.2], CANOPY],
  [[-0.45, 1.05, -1.2], [0.45, 1.05, -1.2], [0.35, 0.55, 0.4], CANOPY],
  [[-0.45, 1.05, -1.2], [0.35, 0.55, 0.4], [-0.35, 0.55, 0.4], CANOPY],
  // Landing gear legs and wheels.
  [[-0.7, -0.6, -2.2], [-0.7, -1.7, -2.2], [-0.5, -1.7, -2.2], DARK],
  [[0.7, -0.6, -2.2], [0.5, -1.7, -2.2], [0.7, -1.7, -2.2], DARK],
  [[-0.7, -1.7, -2.6], [-0.7, -1.7, -1.8], [-0.7, -1.2, -1.8], DARK],
  [[0.7, -1.7, -2.6], [0.7, -1.2, -1.8], [0.7, -1.7, -1.8], DARK],
];

// Propeller: a translucent blur disc at the nose (a spinning prop reads as
// a disc, not as two frozen blades) plus a dark hub.
const PROP_DISC = [];
for (let i = 0; i < 12; i++) {
  const a0 = (i / 12) * Math.PI * 2;
  const a1 = ((i + 1) / 12) * Math.PI * 2;
  PROP_DISC.push([
    [0, 0, -6.6],
    [Math.cos(a0) * 3.4, Math.sin(a0) * 3.4, -6.6],
    [Math.cos(a1) * 3.4, Math.sin(a1) * 3.4, -6.6],
    'rgba(205,205,215,0.20)',
  ]);
}
PROP_DISC.push([
  [0, 0, -6.7],
  [0.55, 0, -6.7],
  [0, 0.55, -6.7],
  '#3a3f45',
]);
PROP_DISC.push([
  [0, 0, -6.7],
  [0, -0.55, -6.7],
  [-0.55, 0, -6.7],
  '#3a3f45',
]);

// World-space triangles of the aircraft at its current pose.
export function planeWorldTris(plane, timeSeconds) {
  const basis = aircraftBasis(plane.yaw, plane.pitch, plane.roll);
  const tris = [];
  for (const [p0, p1, p2, color] of PLANE_TRIS) {
    tris.push({
      a: localToWorld(basis.matrix, p0, plane.pos),
      b: localToWorld(basis.matrix, p1, plane.pos),
      c: localToWorld(basis.matrix, p2, plane.pos),
      color,
    });
  }
  for (const [p0, p1, p2, color] of PROP_DISC) {
    tris.push({
      a: localToWorld(basis.matrix, p0, plane.pos),
      b: localToWorld(basis.matrix, p1, plane.pos),
      c: localToWorld(basis.matrix, p2, plane.pos),
      color,
    });
  }
  return tris;
}

// --- flight model -------------------------------------------------------------
export function createPlane() {
  return {
    pos: v3(40, CONFIG.runwayElevation + 1.2, 0),
    yaw: deg2rad(90), // facing east, down runway 09
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    gearDown: true,
    propSpin: 0,
  };
}

// One physics step. `input` is { pitch: -1..1, roll: -1..1, throttleDelta,
// brake }. Returns an event string: 'landed-soft' | 'landed-rough' |
// 'crashed-terrain' | 'crashed-water' | 'crashed-stall' | null.
export function stepPlane(plane, input, dt) {
  const wasAirborne = !plane.onGround;
  plane.throttle = clamp(plane.throttle + input.throttleDelta * dt, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Attitude follows the stick, with gentle auto-level on roll.
  plane.roll = clamp(plane.roll + input.roll * CONFIG.rollRate * dt, -1.1, 1.1);
  if (Math.abs(input.roll) < 0.05) plane.roll = lerp(plane.roll, 0, dt * 0.9);
  plane.pitch = clamp(plane.pitch + input.pitch * CONFIG.pitchRate * dt, -0.55, 0.5);
  if (plane.onGround) plane.pitch = clamp(plane.pitch, -0.08, 0.22);

  // Banking turns the nose: bank right (roll > 0) turns right, so the
  // compass heading grows.
  const turnRate = Math.sin(plane.roll) * CONFIG.turnAuthority * clamp(plane.speed / 45, 0.25, 1.4);
  plane.yaw += turnRate * dt;

  // Speed: thrust minus drag minus the cost of climbing.
  const basis = aircraftBasis(plane.yaw, plane.pitch, plane.roll);
  const climbFactor = Math.sin(plane.pitch);
  let accel = plane.throttle * CONFIG.maxThrustAccel;
  accel -= CONFIG.dragQuad * plane.speed * plane.speed + CONFIG.dragLin * plane.speed;
  accel -= CONFIG.climbBleed * climbFactor;
  if (input.brake) accel -= 26;
  plane.speed = clamp(plane.speed + accel * dt, 0, CONFIG.maxSpeed);

  // Lift: below stall speed the wing gives up and the plane sinks.
  const lift = smoothstep(CONFIG.stallSpeed, CONFIG.liftSpeed, plane.speed);
  const fwd = basis.forward;
  let vx = fwd[0] * plane.speed * lift;
  let vy = fwd[1] * plane.speed * lift - CONFIG.sinkWhenStalled * (1 - lift);
  let vz = fwd[2] * plane.speed * lift;
  if (plane.onGround) {
    // Rolling on the ground: stay glued, keep some steering.
    vy = 0;
    const groundSpeed = plane.speed;
    vx = fwd[0] * groundSpeed;
    vz = fwd[2] * groundSpeed;
    if (plane.speed > CONFIG.liftSpeed * 0.92 && plane.pitch > 0.06) {
      plane.onGround = false;
    }
  }
  plane.verticalSpeed = vy;
  plane.pos = v3add(plane.pos, [vx * dt, vy * dt, vz * dt]);

  // Fuel burn.
  plane.fuel = Math.max(0, plane.fuel - (CONFIG.fuelDrainIdle + plane.throttle * CONFIG.fuelDrainFull) * dt);

  // Ground / water contact.
  const ground = terrainHeight(plane.pos[0], plane.pos[2]);
  const clearance = plane.pos[1] - ground;
  if (clearance <= 1.1) {
    const r = CONFIG.runway;
    const onRunway =
      plane.pos[0] > r.x0 - 10 && plane.pos[0] < r.x1 + 10 &&
      Math.abs(plane.pos[2] - r.z) < r.halfWidth + 6;
    const inWater = ground < 5.5;
    if (inWater && !onRunway) {
      plane.pos[1] = ground + 1.1;
      return 'crashed-water';
    }
    if (!plane.onGround) {
      // Touchdown: judge it by sink rate, bank and speed.
      const hardSink = vy < -11;
      const banked = Math.abs(plane.roll) > 0.45;
      const tooFast = plane.speed > 62;
      plane.pos[1] = ground + 1.1;
      plane.onGround = true;
      plane.pitch = 0;
      if (hardSink || banked || tooFast) return 'crashed-terrain';
      // A soft landing counts only on the runway; a gentle touchdown
      // anywhere else is a rough field landing.
      return wasAirborne ? (vy > -6 && onRunway ? 'landed-soft' : 'landed-rough') : null;
    }
    plane.pos[1] = ground + 1.1;
    plane.onGround = true;
  } else if (clearance > 2.5) {
    plane.onGround = false;
  }

  // Terrain strike while flying (a hill in the way).
  if (!plane.onGround && clearance < 0.4) return 'crashed-terrain';
  return null;
}

// Heading in degrees, 0 = north, clockwise.
export function planeHeadingDeg(plane) {
  const basis = aircraftBasis(plane.yaw, plane.pitch, plane.roll);
  const f = basis.forward;
  let hdg = Math.atan2(f[0], -f[2]);
  if (hdg < 0) hdg += Math.PI * 2;
  return (hdg * 180) / Math.PI;
}

// Display speed in knots (1 m/s ~ 1.94 kt).
export function planeKnots(plane) {
  return plane.speed * 1.94;
}

export { v3normalize, v3dot, v3scale };
