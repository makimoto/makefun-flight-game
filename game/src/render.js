// Chase-view renderer: a true perspective projection of the terrain
// data, drawn with Canvas 2D paths. The camera sits behind and above
// the Petrel, looking along its heading; every island, ring and
// building on screen is the same world object the physics can hit.

import { CAMERA } from './config.js';
import { CLOUDS, DEPOT, ISLANDS, LIGHTHOUSE, MOUNTAINS, PATCHES, TOWN, TREES, groundHeightAt, islandHeightAt } from './terrain.js';
import { RINGS, RING_RADIUS } from './missions.js';
import { drawAircraft } from './aircraft.js';

const DEG = Math.PI / 180;

// Project a world point into screen space for a camera.
// cam: {x, z, alt, headingDeg, pitchDeg, w, h}
export function makeProjector(cam) {
  const focal = CAMERA.focal * (cam.w / 1280);
  const ch = Math.cos(cam.headingDeg * DEG);
  const sh = Math.sin(cam.headingDeg * DEG);
  const cp = Math.cos(cam.pitchDeg * DEG);
  const sp = Math.sin(cam.pitchDeg * DEG);
  // The projected horizon of a pitched camera: a far ground point
  // lands here, so the sky/sea split must use the same line.
  const horizonY = cam.h * 0.44 + Math.tan(cam.pitchDeg * DEG) * focal;
  return function project(x, y, z, clampNear = false) {
    const dx = x - cam.x;
    const dz = z - cam.z;
    const dy = y - cam.alt;
    // Yaw into camera space: forward is -z world at heading 0.
    const fwd = dx * sh - dz * ch;
    const right = dx * ch + dz * sh;
    // Pitch: rotate forward/up.
    const up = dy * cp - fwd * sp;
    let depth = fwd * cp + dy * sp;
    if (depth < 2) {
      if (!clampNear) return null;
      depth = 2; // ground shapes: keep the point, far off-screen
    }
    return {
      x: Math.max(-6000, Math.min(7000, cam.w / 2 + (right / depth) * focal)),
      y: Math.max(-4000, Math.min(5000, horizonY - (up / depth) * focal)),
      depth,
      scale: focal / depth,
    };
  };
}

function poly(ctx, pts, fill, stroke) {
  if (pts.some((p) => !p)) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function ellipsePoints(x, z, rx, rz, y, n = 26) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + Math.cos(a) * rx, y, z + Math.sin(a) * rz]);
  }
  return pts;
}

export function drawScene(ctx, plane, sortie, w, h, timeMs) {
  const camPitch = -plane.pitchDeg * 0.45 - 2;
  const behind = {
    x: plane.x - Math.sin(plane.headingDeg * DEG) * CAMERA.chaseDistance,
    z: plane.z + Math.cos(plane.headingDeg * DEG) * CAMERA.chaseDistance,
  };
  const cam = {
    x: behind.x,
    z: behind.z,
    alt: plane.alt + CAMERA.chaseHeight,
    headingDeg: plane.headingDeg,
    pitchDeg: camPitch,
    w,
    h,
  };
  const project = makeProjector(cam);
  const horizonY = h * 0.44 + Math.tan(camPitch * DEG) * CAMERA.focal * (w / 1280);

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 4);
  sky.addColorStop(0, '#2e6db4');
  sky.addColorStop(0.65, '#7db8dd');
  sky.addColorStop(1, '#cfe8f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 4);
  // Sun with a warm glow, high left.
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.13, 6, w * 0.78, h * 0.13, 120);
  sun.addColorStop(0, 'rgba(255,244,190,0.95)');
  sun.addColorStop(0.25, 'rgba(255,236,160,0.55)');
  sun.addColorStop(1, 'rgba(255,236,160,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(w * 0.78 - 130, h * 0.13 - 130, 260, 260);

  // Sea.
  const sea = ctx.createLinearGradient(0, horizonY, 0, h);
  sea.addColorStop(0, '#3d8fa8');
  sea.addColorStop(0.4, '#2a7396');
  sea.addColorStop(1, '#17567c');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  // Sea sparkle lanes.
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = horizonY + 14 + i * i * 9 + ((timeMs / 90 + i * 37) % 22);
    if (y > h - 150) continue;
    ctx.beginPath();
    ctx.moveTo(w * 0.08 + ((i * 173) % 300), y);
    ctx.lineTo(w * 0.3 + ((i * 173) % 300), y);
    ctx.stroke();
  }

  // Islands: sand rim then grass dome, far to near.
  const islandsSorted = [...ISLANDS].sort(
    (a, b) => Math.hypot(b.x - plane.x, b.z - plane.z) - Math.hypot(a.x - plane.x, a.z - plane.z),
  );
  for (const isl of islandsSorted) {
    // Points behind the camera project to null; draw the visible arc
    // rather than dropping the whole island when we fly over it.
    const sandPts = ellipsePoints(isl.x, isl.z, isl.rx + isl.sand, isl.rz + isl.sand, 1.2)
      .map((p) => project(p[0], p[1], p[2], true))
      .filter(Boolean);
    if (sandPts.length >= 3) poly(ctx, sandPts, '#e6d194');
    const grassPts = ellipsePoints(isl.x, isl.z, isl.rx, isl.rz, 3.2)
      .map((p) => project(p[0], p[1], p[2], true))
      .filter(Boolean);
    if (grassPts.length >= 3) {
      const g = ctx.createLinearGradient(0, horizonY, 0, h);
      g.addColorStop(0, '#5da354');
      g.addColorStop(1, '#3c7a3c');
      poly(ctx, grassPts, g);
    }
  }

  // Grass mottling: flat darker patches lying on the island domes.
  for (const p of PATCHES) {
    if (Math.hypot(p.x - plane.x, p.z - plane.z) > 3400) continue;
    const y = islandHeightAt(p.x, p.z) + 3.6;
    if (y < 4) continue;
    const pts = ellipsePoints(p.x, p.z, p.r, p.r * 0.72, y, 14)
      .map((q) => project(q[0], q[1], q[2], true))
      .filter(Boolean);
    if (pts.length >= 3) poly(ctx, pts, p.tone > 0.5 ? 'rgba(46,102,50,0.35)' : 'rgba(126,166,80,0.30)');
  }

  // Mountains: cones with snow caps.
  const mountsSorted = [...MOUNTAINS].sort(
    (a, b) => Math.hypot(b.x - plane.x, b.z - plane.z) - Math.hypot(a.x - plane.x, a.z - plane.z),
  );
  for (const m of mountsSorted) {
    // Base is the island dome alone: groundHeightAt would add the
    // cone's own height a second time and double every peak.
    const baseY = islandHeightAt(m.x, m.z);
    const apex = project(m.x, baseY + m.h, m.z);
    const left = project(m.x - m.r, baseY, m.z);
    const right = project(m.x + m.r, baseY, m.z);
    if (!apex || !left || !right) continue;
    poly(ctx, [left, apex, right], '#7a7f8a');
    const snowL = { x: apex.x + (left.x - apex.x) * 0.72, y: apex.y + (left.y - apex.y) * 0.28 };
    const snowR = { x: apex.x + (right.x - apex.x) * 0.72, y: apex.y + (right.y - apex.y) * 0.28 };
    poly(ctx, [apex, snowL, snowR], '#f4f7f7');
  }

  // Trees: little dark pines, only when near enough to read.
  for (const t of TREES) {
    const d = Math.hypot(t.x - plane.x, t.z - plane.z);
    if (d > 1500) continue;
    const p = project(t.x, groundHeightAt(t.x, t.z) + 9 * t.s, t.z);
    if (!p) continue;
    const s = Math.max(1.2, p.scale * 9 * t.s * 0.12);
    ctx.fillStyle = '#2c5d31';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.2);
    ctx.lineTo(p.x - s * 0.8, p.y);
    ctx.lineTo(p.x + s * 0.8, p.y);
    ctx.closePath();
    ctx.fill();
  }

  // Town blocks: simple lit boxes.
  for (const b of TOWN) {
    const d = Math.hypot(b.x - plane.x, b.z - plane.z);
    if (d > 2600) continue;
    const gy = groundHeightAt(b.x, b.z);
    const corners = [
      [b.x - b.w / 2, b.z - b.d / 2],
      [b.x + b.w / 2, b.z - b.d / 2],
      [b.x + b.w / 2, b.z + b.d / 2],
      [b.x - b.w / 2, b.z + b.d / 2],
    ];
    const top = corners.map(([x, z]) => project(x, gy + b.h, z));
    const base = corners.map(([x, z]) => project(x, gy, z));
    if (top.some((p) => !p) || base.some((p) => !p)) continue;
    poly(ctx, [base[0], base[1], top[1], top[0]], `hsl(${b.hue} 30% 42%)`);
    poly(ctx, [base[1], base[2], top[2], top[1]], `hsl(${b.hue} 32% 52%)`);
    poly(ctx, top, `hsl(${b.hue} 26% 68%)`);
  }

  // Lighthouse: white/red tower with a rotating beam at the drop zone.
  {
    const gy = groundHeightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
    const base = project(LIGHTHOUSE.x, gy, LIGHTHOUSE.z);
    const topP = project(LIGHTHOUSE.x, gy + LIGHTHOUSE.height, LIGHTHOUSE.z);
    if (base && topP) {
      const widthHere = Math.max(2, base.scale * 5);
      ctx.strokeStyle = '#f2efe6';
      ctx.lineWidth = widthHere;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(topP.x, topP.y);
      ctx.stroke();
      ctx.strokeStyle = '#c8402a';
      ctx.lineWidth = widthHere * 0.9;
      const midY = base.y + (topP.y - base.y) * 0.55;
      ctx.beginPath();
      ctx.moveTo(base.x, midY - widthHere * 0.5);
      ctx.lineTo(topP.x, midY + (topP.y - base.y) * 0.12);
      ctx.stroke();
      const beamA = timeMs / 900;
      ctx.fillStyle = 'rgba(255,240,170,0.30)';
      ctx.beginPath();
      ctx.moveTo(topP.x, topP.y);
      ctx.lineTo(topP.x + Math.cos(beamA) * 190, topP.y + Math.sin(beamA) * 46);
      ctx.lineTo(topP.x + Math.cos(beamA + 0.16) * 190, topP.y + Math.sin(beamA + 0.16) * 46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath();
      ctx.arc(topP.x, topP.y, Math.max(2, widthHere * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRunway(ctx, project);
  drawDepot(ctx, project);

  // Clouds as soft billboards.
  for (const c of CLOUDS) {
    const drift = ((timeMs / 1000) * 3 + c.x) % 7200;
    const p = project(drift - 3600 + 0, c.alt, c.z);
    if (!p || p.depth > 5200) continue;
    const s = p.scale * c.s * 0.42;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    for (const [ox, oy, r] of [[0, 0, 1], [-0.8, 0.16, 0.66], [0.85, 0.14, 0.7], [0.1, -0.3, 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(p.x + ox * s * 2, p.y + oy * s, s * r * 1.7, s * r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mail rings: only rings still to fly are drawn — the next one
  // burns gold, the rest wait in cyan. A passed ring vanishes: in the
  // old build the whole spent course floated over the landing shot
  // and read as live targets that were not there.
  RINGS.forEach((ring, i) => {
    const state = i < sortie.ringIndex || sortie.phase === 'DROP' || sortie.phase === 'LANDING' || sortie.phase === 'DONE'
      ? 'done'
      : i === sortie.ringIndex
        ? 'next'
        : 'todo';
    if (state !== 'done') drawRing(ctx, project, ring, state, timeMs);
  });

  // Drop marker over the lighthouse while the parcel is aboard.
  if (sortie.phase === 'DROP') {
    const p = project(LIGHTHOUSE.x, 108, LIGHTHOUSE.z);
    if (p) {
      const r = Math.max(14, p.scale * 30);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y + Math.sin(timeMs / 300) * 5, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.font = `700 ${Math.max(13, r * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▼ DROP HERE — FLY LOW', p.x, p.y - r - 8);
    }
  }

  // Distance haze: a soft band at the horizon so far terrain melts
  // into the sky instead of ending in a hard cut.
  const haze = ctx.createLinearGradient(0, horizonY - 26, 0, horizonY + 150);
  haze.addColorStop(0, 'rgba(207,232,242,0)');
  haze.addColorStop(0.35, 'rgba(207,232,242,0.28)');
  haze.addColorStop(1, 'rgba(207,232,242,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizonY - 26, w, 176);

  // The aircraft's ground shadow: grounds the plane in the world and
  // quietly reads as height to the eye watching the approach.
  {
    const gy = groundHeightAt(plane.x, plane.z);
    const agl = Math.max(0, plane.alt - gy);
    const sp = project(plane.x, gy + 0.8, plane.z);
    if (sp && agl < 320) {
      const fade = Math.max(0, 1 - agl / 320);
      ctx.fillStyle = `rgba(18,30,20,${0.34 * fade})`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, Math.max(3, sp.scale * 6.2), Math.max(1.5, sp.scale * 1.9), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The aircraft, centre-frame, floating with the pitch.
  const planeScale = (w / 1280) * 15.5;
  const planeX = w / 2;
  const planeY = h * 0.60 + plane.pitchDeg * 2.2;
  ctx.save();
  ctx.translate(planeX, planeY);
  drawAircraft(ctx, plane, planeScale, timeMs);
  ctx.restore();

  // Speed streaks at pace.
  if (plane.speed > 55) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = h * 0.2 + ((i * 131 + timeMs / 6) % (h * 0.5));
      const x = (i * 269 + (timeMs / 2) % 200) % w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 46, y);
      ctx.stroke();
    }
  }
  return { horizonY };
}

function drawRunway(ctx, project) {
  const rwy = { x: 0, halfWidth: 24, zNorth: -520, zSouth: 320 };
  const gy = (x, z) => groundHeightAt(x, z) + 0.4;
  const corners = [
    project(rwy.x - rwy.halfWidth, gy(rwy.x, rwy.zSouth), rwy.zSouth, true),
    project(rwy.x + rwy.halfWidth, gy(rwy.x, rwy.zSouth), rwy.zSouth, true),
    project(rwy.x + rwy.halfWidth, gy(rwy.x, rwy.zNorth), rwy.zNorth, true),
    project(rwy.x - rwy.halfWidth, gy(rwy.x, rwy.zNorth), rwy.zNorth, true),
  ];
  poly(ctx, corners, '#4a4d55');
  // Centreline dashes.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  for (let z = 280; z > -500; z -= 56) {
    const a = project(0, gy(0, z), z);
    const b = project(0, gy(0, z - 26), z - 26);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, a.scale * 0.9);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at the landing (south) end.
  for (const off of [-15, -5, 5, 15]) {
    const a = project(off - 3, gy(0, 300), 300);
    const b = project(off + 3, gy(0, 268), 268);
    if (a && b) poly(ctx, [a, b, project(off + 3, gy(0, 268), 268), project(off - 3, gy(0, 300), 300)], '#f5f5f0');
  }
  // Edge lights.
  for (let z = 310; z > -510; z -= 62) {
    for (const side of [-27, 27]) {
      const p = project(side, gy(0, z), z);
      if (!p) continue;
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.4, p.scale * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Big runway numbers at the threshold.
  const num = project(0, gy(0, 0) + 0.5, 238);
  if (num && num.depth < 900) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `800 ${Math.max(10, num.scale * 15)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('36', num.x, num.y);
  }
}

function drawDepot(ctx, project) {
  const gy = groundHeightAt(DEPOT.x, DEPOT.z) + 0.3;
  const base = [
    project(DEPOT.x - 16, gy, DEPOT.z - 10),
    project(DEPOT.x + 16, gy, DEPOT.z - 10),
    project(DEPOT.x + 16, gy, DEPOT.z + 10),
    project(DEPOT.x - 16, gy, DEPOT.z + 10),
  ];
  poly(ctx, base, '#b8452c');
  const top = project(DEPOT.x, gy + 9, DEPOT.z);
  const b0 = project(DEPOT.x - 16, gy, DEPOT.z - 10);
  const b1 = project(DEPOT.x + 16, gy, DEPOT.z - 10);
  if (top && b0 && b1) poly(ctx, [b0, b1, top], '#7c2d1c');
}

function drawRing(ctx, project, ring, state, timeMs) {
  const color =
    state === 'next' ? '#ffd23e' : state === 'done' ? 'rgba(80,220,140,0.55)' : 'rgba(90,200,235,0.75)';
  const pts = [];
  const segs = 30;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    // Rings stand vertical, facing roughly along the route (facing the
    // incoming pilot): their plane is perpendicular to the z axis run.
    pts.push(project(ring.x + Math.cos(a) * RING_RADIUS, ring.alt + Math.sin(a) * RING_RADIUS, ring.z));
  }
  if (pts.some((p) => !p)) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = state === 'next' ? 7 : 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = state === 'next' ? 16 + Math.sin(timeMs / 200) * 6 : 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (state === 'next') {
    const top = project(ring.x, ring.alt + RING_RADIUS + 14, ring.z);
    if (top) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = '800 21px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ ${ring.name.toUpperCase()}`, top.x, top.y);
    }
  }
}
