// ARUNIKA: small 3D math helpers. One job: vectors, rotations and the
// camera projection the software renderer uses. No library, no allocation
// in the hot path beyond plain arrays.

// --- scalars ---------------------------------------------------------------
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
// Shortest signed angle difference, in radians, wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// --- vectors (plain [x, y, z] arrays) --------------------------------------
export function v3(x, y, z) {
  return [x, y, z];
}
export function v3add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function v3sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function v3scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function v3dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function v3cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function v3length(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}
export function v3normalize(a) {
  const len = v3length(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

// --- rotations -------------------------------------------------------------
// Rotation matrices as 9-element row-major arrays.
function rotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function matMul(A, B) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    }
  }
  return out;
}
function matVec(M, v) {
  return [
    M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
    M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
    M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
  ];
}

// Aircraft orientation: local axes are right +X, up +Y, nose -Z.
// `yaw` IS the compass heading (0 = north, 90 = east, clockwise), `pitch`
// is nose-up positive, `roll` is bank-right positive. The yaw matrix is
// rotY(-yaw) so that a heading of 90 deg gives forward = +X (east).
export function aircraftBasis(yaw, pitch, roll) {
  const R = matMul(rotY(-yaw), matMul(rotX(pitch), rotZ(-roll)));
  return {
    forward: matVec(R, [0, 0, -1]),
    right: matVec(R, [1, 0, 0]),
    up: matVec(R, [0, 1, 0]),
    matrix: R,
  };
}

// Transform a point from aircraft-local space to world space.
export function localToWorld(matrix, local, origin) {
  const p = matVec(matrix, local);
  return [p[0] + origin[0], p[1] + origin[1], p[2] + origin[2]];
}

// --- camera ----------------------------------------------------------------
// A camera is { pos, forward, right, up, focal, width, height }.
// project() returns [sx, sy, depth] or null when behind the camera.
export function makeCamera(pos, lookAt, upHint, fovDegrees, width, height) {
  const forward = v3normalize(v3sub(lookAt, pos));
  const right = v3normalize(v3cross(forward, upHint));
  const up = v3cross(right, forward);
  const focal = height / 2 / Math.tan(deg2rad(fovDegrees) / 2);
  return { pos, forward, right, up, focal, width, height };
}

export function projectPoint(cam, p) {
  const d = v3sub(p, cam.pos);
  const cz = v3dot(d, cam.forward);
  if (cz < 0.6) return null;
  const cx = v3dot(d, cam.right);
  const cy = v3dot(d, cam.up);
  const s = cam.focal / cz;
  return [cam.width / 2 + cx * s, cam.height / 2 - cy * s, cz];
}
