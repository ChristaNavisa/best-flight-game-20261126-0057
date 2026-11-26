// ARUNIKA: the island. One job: the heightfield, the runway, the river,
// the road, the town and the trees — all built once from a fixed seed, then
// handed to the renderer as a flat list of shaded triangles.

import { CONFIG, PALETTE } from './config.js';
import { makeNoise2D, mulberry32 } from './rng.js';
import { clamp, lerp, smoothstep, v3, v3cross, v3normalize } from './math3d.js';

const noise = makeNoise2D(20261126);
const rand = mulberry32(77031);

// --- heightfield -----------------------------------------------------------
const ROAD_POINTS = [
  [420, 0],
  [430, 160],
  [430, 330],
  [300, 430],
  [120, 470],
];
const RIVER_POINTS = [
  [-420, -760],
  [-380, -520],
  [-300, -320],
  [-360, -120],
  [-520, 60],
  [-700, 240],
  [-880, 420],
];

function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = clamp(t, 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

// How strongly the runway's flat pad claims a point (1 = fully flat).
export function runwayMask(x, z) {
  const r = CONFIG.runway;
  const dx = Math.max(r.x0 - 26 - x, 0, x - (r.x1 + 26));
  const dz = Math.abs(z - r.z) - (r.halfWidth + 26);
  const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  return 1 - smoothstep(0, 60, d);
}

function townMask(x, z) {
  const d = Math.hypot(x - CONFIG.townCenter.x, z - CONFIG.townCenter.z);
  return 1 - smoothstep(60, 170, d);
}

export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const mask = 1 - smoothstep(680, 1150, d);
  let h = 16 + 62 * noise(x * 0.0016, z * 0.0016) + 26 * noise(x * 0.005, z * 0.005);
  h = 8 + Math.max(0, h) * mask;
  // Flatten the runway pad and the town to their pads.
  h = lerp(h, CONFIG.runwayElevation, runwayMask(x, z));
  h = lerp(h, 30, townMask(x, z) * 0.9);
  // Carve the river valley a little.
  const riverD = distToPolyline(x, z, RIVER_POINTS);
  h -= 7 * (1 - smoothstep(0, 46, riverD)) * mask;
  return Math.max(h, 1.2);
}

// --- colour helpers ----------------------------------------------------------
function shade(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = clamp(factor, 0, 1.6);
  const cr = clamp(Math.round(r * f), 0, 255);
  const cg = clamp(Math.round(g * f), 0, 255);
  const cb = clamp(Math.round(b * f), 0, 255);
  return `rgb(${cr},${cg},${cb})`;
}

// Mix two hex colours by t (0 = a, 1 = b), returned as an rgb() string.
export function mixHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

export { shade };

// Sun direction (fixed, late-afternoon from the west).
export const SUN_DIR = v3normalize(v3(-0.55, 0.62, -0.35));

// Shade a triangle by its normal: faces toward the sun are brighter.
function faceShade(normal) {
  const d = Math.max(0, normal[0] * SUN_DIR[0] + normal[1] * SUN_DIR[1] + normal[2] * SUN_DIR[2]);
  return 0.72 + 0.38 * d;
}

function triNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = v3cross(u, w);
  const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

// A render triangle: { a, b, c, color, depth (filled per frame) }.
function pushTri(list, a, b, c, color) {
  const n = triNormal(a, b, c);
  list.push({ a, b, c, color: shade(color, faceShade(n)) });
}

// --- terrain mesh ------------------------------------------------------------
function groundColor(x, z, h) {
  if (h < 5.5) return PALETTE.sand;
  if (h > 95) return PALETTE.rock;
  const riverD = distToPolyline(x, z, RIVER_POINTS);
  if (riverD < 13) return PALETTE.river;
  const roadD = distToPolyline(x, z, ROAD_POINTS);
  if (roadD < 7) return PALETTE.asphalt;
  // Patchwork fields: stable per-cell hash picks a crop colour.
  const cell = Math.floor(x / 130) * 7 + Math.floor(z / 130) * 13;
  const pick = ((cell * 2654435761) >>> 0) % 100;
  if (pick < 22) return PALETTE.fieldWheat;
  if (pick < 40) return PALETTE.fieldGreen;
  if (pick < 52) return PALETTE.forest;
  const slopeShade = 0.92 + 0.16 * noise(x * 0.01, z * 0.01);
  return shade(pick < 76 ? PALETTE.grass : PALETTE.grassDark, slopeShade);
}

function buildTerrainTris() {
  const tris = [];
  const step = 60;
  const min = -1200;
  const max = 1200;
  const cols = Math.round((max - min) / step) + 1;
  const heights = new Float32Array(cols * cols);
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      heights[j * cols + i] = terrainHeight(min + i * step, min + j * step);
    }
  }
  for (let j = 0; j < cols - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const x0 = min + i * step;
      const z0 = min + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const h00 = heights[j * cols + i];
      const h10 = heights[j * cols + i + 1];
      const h01 = heights[(j + 1) * cols + i];
      const h11 = heights[(j + 1) * cols + i + 1];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const ch = (h00 + h10 + h01 + h11) / 4;
      const col = groundColor(cx, cz, ch);
      const a = v3(x0, h00, z0);
      const b = v3(x1, h10, z0);
      const c = v3(x0, h01, z1);
      const d = v3(x1, h11, z1);
      pushTri(tris, a, d, b, col);
      pushTri(tris, a, c, d, col);
    }
  }
  return tris;
}

// --- runway ------------------------------------------------------------------
function buildRunwayTris() {
  const tris = [];
  const r = CONFIG.runway;
  const y = CONFIG.runwayElevation + 0.35;
  const x0 = r.x0;
  const x1 = r.x1;
  const hw = r.halfWidth;
  const z = r.z;
  // Asphalt strip (wound so its normal points up, toward the sun).
  pushTri(tris, v3(x0, y, z - hw), v3(x1, y, z + hw), v3(x1, y, z - hw), PALETTE.runway);
  pushTri(tris, v3(x0, y, z - hw), v3(x0, y, z + hw), v3(x1, y, z + hw), PALETTE.runway);
  // Centreline dashes.
  for (let x = x0 + 24; x < x1 - 12; x += 42) {
    const y2 = y + 0.12;
    pushTri(tris, v3(x, y2, z - 1.4), v3(x + 22, y2, z + 1.4), v3(x + 22, y2, z - 1.4), PALETTE.runwayMark);
    pushTri(tris, v3(x, y2, z - 1.4), v3(x, y2, z + 1.4), v3(x + 22, y2, z + 1.4), PALETTE.runwayMark);
  }
  // Threshold bars at both ends.
  for (const tx of [x0 + 8, x1 - 8]) {
    const y2 = y + 0.12;
    pushTri(tris, v3(tx - 7, y2, z - hw + 3), v3(tx + 7, y2, z + hw - 3), v3(tx + 7, y2, z - hw + 3), PALETTE.runwayMark);
    pushTri(tris, v3(tx - 7, y2, z - hw + 3), v3(tx - 7, y2, z + hw - 3), v3(tx + 7, y2, z + hw - 3), PALETTE.runwayMark);
  }
  // Big "09" numerals as flat bars (stylised, readable from the air).
  const nx = x0 + 52;
  const y3 = y + 0.14;
  const bar = (bx, bz, w, dpt) => {
    pushTri(tris, v3(bx, y3, bz), v3(bx + w, y3, bz + dpt), v3(bx + w, y3, bz), PALETTE.runwayMark);
    pushTri(tris, v3(bx, y3, bz), v3(bx, y3, bz + dpt), v3(bx + w, y3, bz + dpt), PALETTE.runwayMark);
  };
  bar(nx, z - 9, 3, 18);
  bar(nx + 9, z - 9, 3, 18);
  bar(nx, z - 9, 12, 3);
  bar(nx, z + 6, 12, 3);
  return tris;
}

// --- town, hangar, windsock ----------------------------------------------------
function boxTris(tris, cx, cz, w, d, h, wallColor, roofColor) {
  const y0 = terrainHeight(cx, cz);
  const y1 = y0 + h;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const corners = [
    v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1),
    v3(x0, y1, z0), v3(x1, y1, z0), v3(x1, y1, z1), v3(x0, y1, z1),
  ];
  const faces = [
    [0, 1, 2, 3, wallColor], [4, 6, 5, 7, roofColor],
    [0, 4, 5, 1, wallColor], [1, 5, 6, 2, wallColor],
    [2, 6, 7, 3, wallColor], [3, 7, 4, 0, wallColor],
  ];
  for (const [i0, i1, i2, i3, col] of faces) {
    pushTri(tris, corners[i0], corners[i1], corners[i2], col);
    pushTri(tris, corners[i0], corners[i2], corners[i3], col);
  }
}

function buildTownTris() {
  const tris = [];
  const townRand = mulberry32(4417);
  for (let i = 0; i < 16; i++) {
    const a = townRand() * Math.PI * 2;
    const rr = 30 + townRand() * 110;
    const cx = CONFIG.townCenter.x + Math.cos(a) * rr;
    const cz = CONFIG.townCenter.z + Math.sin(a) * rr * 0.8;
    const w = 18 + townRand() * 22;
    const d = 16 + townRand() * 20;
    const h = 9 + townRand() * 16;
    const roof = townRand() < 0.5 ? PALETTE.townRoofA : PALETTE.townRoofB;
    boxTris(tris, cx, cz, w, d, h, PALETTE.townWall, roof);
  }
  // Hangar beside the runway, red roof, and a windsock mast.
  boxTris(tris, 470, -58, 46, 34, 16, '#ddd6c4', PALETTE.hangarRoof);
  const mastBase = terrainHeight(430, 52);
  const top = v3(430, mastBase + 16, 52);
  pushTri(tris, v3(429.4, mastBase, 51.4), v3(430.6, mastBase, 51.4), top, '#c8452c');
  pushTri(tris, v3(430.6, mastBase, 52.6), v3(429.4, mastBase, 52.6), top, '#c8452c');
  return tris;
}

// --- trees ---------------------------------------------------------------------
function buildTreeTris() {
  const tris = [];
  const treeRand = mulberry32(90210);
  let placed = 0;
  let tries = 0;
  while (placed < 150 && tries < 900) {
    tries++;
    const x = (treeRand() * 2 - 1) * 1050;
    const z = (treeRand() * 2 - 1) * 1050;
    const h = terrainHeight(x, z);
    if (h < 9 || h > 85) continue;
    if (runwayMask(x, z) > 0.05) continue;
    if (townMask(x, z) > 0.05) continue;
    if (distToPolyline(x, z, ROAD_POINTS) < 12) continue;
    const s = 5 + treeRand() * 5;
    const top = v3(x, h + s * 2.1, z);
    const b1 = v3(x - s * 0.7, h + s * 0.4, z);
    const b2 = v3(x + s * 0.7, h + s * 0.4, z);
    const b3 = v3(x, h + s * 0.4, z - s * 0.7);
    const b4 = v3(x, h + s * 0.4, z + s * 0.7);
    pushTri(tris, top, b1, b2, PALETTE.forest);
    pushTri(tris, top, b3, b4, PALETTE.grassDark);
    pushTri(tris, v3(x - 0.5, h, z), v3(x + 0.5, h, z), v3(x, h + s * 0.5, z), '#6b4a2f');
    placed++;
  }
  return tris;
}

// --- sea -----------------------------------------------------------------------
function buildSeaTris() {
  const tris = [];
  const y = CONFIG.seaLevel;
  const S = 5200;
  pushTri(tris, v3(-S, y, -S), v3(S, y, S), v3(S, y, -S), PALETTE.seaDeep);
  pushTri(tris, v3(-S, y, -S), v3(-S, y, S), v3(S, y, S), PALETTE.seaDeep);
  return tris;
}

// --- public build ---------------------------------------------------------------
let cached = null;

// All static world triangles, built once. The renderer adds the aircraft,
// rings, clouds and the drop crate per frame.
export function buildWorldTris() {
  if (cached) return cached;
  cached = [
    ...buildSeaTris(),
    ...buildTerrainTris(),
    ...buildRunwayTris(),
    ...buildTownTris(),
    ...buildTreeTris(),
  ];
  return cached;
}

// Clouds: billboard centres the renderer draws in screen space.
export function buildClouds() {
  const cloudRand = mulberry32(31337);
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const a = cloudRand() * Math.PI * 2;
    const r = 300 + cloudRand() * 1500;
    clouds.push({
      x: Math.cos(a) * r,
      y: 300 + cloudRand() * 160,
      z: Math.sin(a) * r,
      size: 90 + cloudRand() * 150,
      puffs: 3 + Math.floor(cloudRand() * 3),
    });
  }
  return clouds;
}
