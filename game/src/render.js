// ARUNIKA: the renderer. One job: turn the world (terrain triangles, the
// aircraft, rings, clouds, the crate) into one canvas frame — sky, painter's
// algorithm, fog, and the cockpit panel when the pilot sits inside.

import { CONFIG, PALETTE } from './config.js';
import { makeCamera, projectPoint, v3, v3add, v3dot, v3normalize, v3scale, v3sub, clamp, lerp } from './math3d.js';
import { SUN_DIR, buildClouds } from './terrain.js';

const clouds = buildClouds();

// --- sky ---------------------------------------------------------------------
function paintSky(ctx, cam, width, height) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // Sun disc, projected from far along the sun direction.
  const sunPos = v3add(cam.pos, v3scale(SUN_DIR, 4000));
  const sp = projectPoint(cam, sunPos);
  if (sp) {
    const glow = ctx.createRadialGradient(sp[0], sp[1], 4, sp[0], sp[1], 120);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.25, 'rgba(255,230,160,0.55)');
    glow.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sp[0] - 130, sp[1] - 130, 260, 260);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sp[0], sp[1], 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintClouds(ctx, cam) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    const p = projectPoint(cam, v3(c.x, c.y, c.z));
    if (!p) continue;
    const scale = cam.focal / p[2];
    const w = c.size * scale;
    if (w < 4) continue;
    ctx.globalAlpha = clamp(1.15 - p[2] / 4200, 0.25, 0.85);
    for (let i = 0; i < c.puffs; i++) {
      const ox = (i - c.puffs / 2) * w * 0.55;
      const oy = Math.sin(i * 2.4) * w * 0.12;
      ctx.beginPath();
      ctx.ellipse(p[0] + ox, p[1] + oy, w * 0.42, w * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// --- triangles -----------------------------------------------------------------
// Fog: distant triangles fade toward the haze colour.
function fogColor(color, depth) {
  const t = clamp((depth - 900) / 2600, 0, 0.72);
  if (t <= 0) return color;
  const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return color;
  const r = Math.round(lerp(+m[1], 207, t));
  const g = Math.round(lerp(+m[2], 224, t));
  const b = Math.round(lerp(+m[3], 234, t));
  return `rgb(${r},${g},${b})`;
}

function drawTriangles(ctx, cam, tris, cullBackfaces = true) {
  // Project once, cull, then sort far-to-near.
  const items = [];
  for (const t of tris) {
    const pa = projectPoint(cam, t.a);
    if (!pa || pa[2] < 3) continue;
    const pb = projectPoint(cam, t.b);
    if (!pb || pb[2] < 3) continue;
    const pc = projectPoint(cam, t.c);
    if (!pc || pc[2] < 3) continue;
    // Backface cull in screen space: in y-down screen coordinates a
    // front-facing triangle (its normal toward the camera) winds
    // counter-clockwise, so its cross product is negative; keep those.
    // Small solids (the aircraft, the crate) are drawn double-sided: their
    // faces are wound for shape, not for one viewpoint.
    if (cullBackfaces) {
      const cross =
        (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
      if (cross >= 0) continue;
    }
    const depth = (pa[2] + pb[2] + pc[2]) / 3;
    items.push({ pa, pb, pc, depth, color: t.color });
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) {
    ctx.fillStyle = fogColor(it.color, it.depth);
    ctx.beginPath();
    ctx.moveTo(it.pa[0], it.pa[1]);
    ctx.lineTo(it.pb[0], it.pb[1]);
    ctx.lineTo(it.pc[0], it.pc[1]);
    ctx.closePath();
    ctx.fill();
  }
}

// --- rings (screen space, drawn after the world) --------------------------------
export function drawRings(ctx, cam, rings, timeSeconds) {
  const sorted = [...rings].sort((a, b) => {
    const da = v3dot(v3sub(a.pos, cam.pos), cam.forward);
    const db = v3dot(v3sub(b.pos, cam.pos), cam.forward);
    return db - da;
  });
  for (const ring of sorted) {
    const p = projectPoint(cam, ring.pos);
    if (!p) continue;
    const depth = p[2];
    if (depth < 4) continue;
    const radius = (cam.focal * ring.radius) / depth;
    if (radius < 3) continue;
    const pulse = 0.75 + 0.25 * Math.sin(timeSeconds * 3 + ring.index);
    const isNext = !ring.passed && rings.find((r) => !r.passed) === ring;
    const color = ring.passed ? '#8fe388' : isNext ? PALETTE.ringNext : PALETTE.ring;
    ctx.save();
    ctx.globalAlpha = ring.passed ? 0.5 : clamp(1.2 - depth / 3600, 0.45, 1) * pulse;
    ctx.lineWidth = Math.max(2, radius * 0.14);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, radius * 0.04);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p[0], p[1], radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    // Ring number, readable at a glance.
    if (radius > 26) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(radius * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ring.index + 1), p[0], p[1] - radius - 14);
    }
    ctx.restore();
  }
}

// --- drop target marker -----------------------------------------------------------
export function drawDropTarget(ctx, cam, target) {
  const p = projectPoint(cam, v3(target.x, 8, target.z));
  if (!p || p[2] < 4) return;
  const radius = (cam.focal * target.radius) / p[2];
  if (radius < 4) return;
  ctx.save();
  ctx.globalAlpha = clamp(1.1 - p[2] / 3200, 0.4, 0.95);
  ctx.strokeStyle = PALETTE.targetRing;
  ctx.lineWidth = Math.max(2, radius * 0.1);
  ctx.setLineDash([radius * 0.25, radius * 0.18]);
  ctx.beginPath();
  ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// --- cockpit panel ------------------------------------------------------------------
function gauge(ctx, cx, cy, r, label, value01, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#10141a';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d4a58';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Lit tick ring.
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * clamp(value01, 0, 1));
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Needle.
  const a = Math.PI * 0.75 + Math.PI * 1.5 * clamp(value01, 0, 1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = '#cfe0ea';
  ctx.font = `bold ${Math.max(9, Math.round(r * 0.24))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, r * 0.52);
  ctx.restore();
}

export function drawCockpitPanel(ctx, width, height, plane, timeSeconds) {
  const panelH = Math.round(height * 0.3);
  const top = height - panelH;
  // Dashboard body.
  const g = ctx.createLinearGradient(0, top, 0, height);
  g.addColorStop(0, '#232a33');
  g.addColorStop(1, '#0d1117');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, top + 26);
  ctx.quadraticCurveTo(width / 2, top - 22, width, top + 26);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a5563';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 26);
  ctx.quadraticCurveTo(width / 2, top - 22, width, top + 26);
  ctx.stroke();

  const cy = top + panelH * 0.56;
  const r = Math.min(44, panelH * 0.34);
  const knots = plane.speed * 1.94;
  const altFt = Math.max(0, plane.pos[1]) * 3.28;
  gauge(ctx, width * 0.16, cy, r, 'KTS', knots / 200, '#7fd4ff');
  gauge(ctx, width * 0.32, cy, r, 'ALT', altFt / 6000, '#8fe388');
  gauge(ctx, width * 0.5, cy, r * 1.15, 'RPM', plane.throttle, '#ffd23e');
  gauge(ctx, width * 0.68, cy, r, 'FUEL', plane.fuel / 100, plane.fuel < 20 ? '#ff5a4e' : '#8fe388');
  gauge(ctx, width * 0.84, cy, r, 'VSI', clamp((plane.verticalSpeed + 12) / 24, 0, 1), '#e6a8ff');

  // Glareshield: a low nose ridge the pilot sees, not a mountain.
  ctx.fillStyle = '#1b2129';
  ctx.beginPath();
  ctx.moveTo(width * 0.46, top - 4);
  ctx.lineTo(width * 0.5, top - 22);
  ctx.lineTo(width * 0.54, top - 4);
  ctx.closePath();
  ctx.fill();
  // Warning lamp when fuel is low.
  if (plane.fuel < 20 && Math.sin(timeSeconds * 6) > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(width * 0.5, top - 32, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- frame ---------------------------------------------------------------------------
export function renderFrame(ctx, width, height, view, worldTris, planeTris, rings, crateTrisList, plane, timeSeconds) {
  const cam = makeCamera(view.camPos, view.lookAt, v3(0, 1, 0), CONFIG.fovDegrees, width, height);
  paintSky(ctx, cam, width, height);
  paintClouds(ctx, cam);
  drawTriangles(ctx, cam, worldTris);
  drawTriangles(ctx, cam, planeTris, false);
  if (crateTrisList.length) drawTriangles(ctx, cam, crateTrisList, false);
  drawRings(ctx, cam, rings, timeSeconds);
  drawDropTarget(ctx, cam, { x: 430, z: 330, radius: 34 });
  if (view.mode === 'cockpit') drawCockpitPanel(ctx, width, height, plane, timeSeconds);
  return cam;
}
