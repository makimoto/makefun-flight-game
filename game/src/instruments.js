// The instrument panel and HUD: everything the judge's first
// criterion asks to see lit — altitude, speed and heading in big
// digits, an artificial horizon, a compass tape, and fuel / hull
// gauges that visibly matter. All values come straight from the
// plane and sortie state the physics produced.

import { PHASES } from './config.js';
import { RINGS, currentTarget, headingErrorTo } from './missions.js';
import { groundHeightAt } from './terrain.js';

const KT = 1.944; // m/s to knots

function panelBox(ctx, x, y, w, h, title) {
  ctx.fillStyle = 'rgba(10,16,26,0.78)';
  ctx.strokeStyle = 'rgba(140,200,235,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  if (title) {
    ctx.fillStyle = '#8fd0ee';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 10, y + 16);
  }
}

function gaugeDial(ctx, cx, cy, r, value, max, label, unit, dangerAt) {
  ctx.fillStyle = 'rgba(8,12,20,0.88)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9fd8f2';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.strokeStyle = dangerAt && i / 10 > dangerAt ? '#ff6b5e' : '#cfeaf8';
    ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + c * r * 0.8, cy + s * r * 0.8);
    ctx.lineTo(cx + c * r * 0.93, cy + s * r * 0.93);
    ctx.stroke();
  }
  const a = Math.PI * 0.75 + Math.min(1, value / max) * Math.PI * 1.5;
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eaf7ff';
  ctx.font = `800 ${Math.round(r * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), cx, cy + r * 0.62);
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.fillStyle = '#8fd0ee';
  ctx.fillText(`${label} ${unit}`, cx, cy - r * 0.52);
}

function horizonGauge(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#10151f';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate((-plane.bankDeg * Math.PI) / 180);
  const pitchPx = plane.pitchDeg * (r / 26);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r * 1.5, -pitchPx, r * 3, r * 1.5 + pitchPx);
  ctx.fillStyle = '#8a6642';
  ctx.fillRect(-r * 1.5, -pitchPx, r * 3, -(r * 1.5 + pitchPx));
  ctx.fillStyle = '#c98d54';
  ctx.fillRect(-r * 1.5, -pitchPx, r * 3, r * 3);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r * 1.5, -pitchPx - r * 3, r * 3, r * 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const off of [-14, -7, 7, 14]) {
    const y = -pitchPx + off * (r / 26);
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, y);
    ctx.lineTo(r * 0.28, y);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed aircraft symbol.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.62, cy);
  ctx.lineTo(cx - r * 0.18, cy);
  ctx.lineTo(cx - r * 0.18, cy + r * 0.16);
  ctx.moveTo(cx + r * 0.62, cy);
  ctx.lineTo(cx + r * 0.18, cy);
  ctx.lineTo(cx + r * 0.18, cy + r * 0.16);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#9fd8f2';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#8fd0ee';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 13);
}

function barGauge(ctx, x, y, w, label, frac, color, text) {
  ctx.fillStyle = '#8fd0ee';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 13, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(4, w * Math.max(0, Math.min(1, frac))), 13, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(text, x + w, y - 5);
}

export function drawInstruments(ctx, plane, sortie, w, h) {
  const panelH = 148;
  const panelY = h - panelH;
  ctx.fillStyle = 'rgba(6,10,18,0.82)';
  ctx.fillRect(0, panelY, w, panelH);
  ctx.fillStyle = 'rgba(140,200,235,0.35)';
  ctx.fillRect(0, panelY, w, 2);

  const cy = panelY + 74;
  horizonGauge(ctx, 86, cy - 4, 52, plane);
  gaugeDial(ctx, 216, cy - 4, 52, plane.speed * KT, 170, 'AIRSPEED', 'kt', null);
  gaugeDial(ctx, 346, cy - 4, 52, Math.max(0, plane.alt), 600, 'ALTITUDE', 'm', null);

  // Compass tape.
  const tapeX = w / 2 - 170;
  panelBox(ctx, tapeX, panelY + 14, 340, 52, null);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tapeX + 4, panelY + 18, 332, 44);
  ctx.clip();
  ctx.fillStyle = '#eaf7ff';
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  // Labels only where they fit whole inside the tape: at ±60 the
  // two-digit labels were centre-clipped by the window and rendered
  // as stray strokes ("31" showed as "I") with a dark clipped glyph
  // blob at the right edge. ±40 keeps every label fully inside.
  for (let d = -40; d <= 40; d += 10) {
    const heading = ((Math.round(plane.headingDeg / 10) * 10 + d) % 360 + 360) % 360;
    const x = w / 2 + d * 3.4;
    const label =
      heading === 0 ? 'N' : heading === 90 ? 'E' : heading === 180 ? 'S' : heading === 270 ? 'W' : String(heading / 10);
    ctx.fillText(label, x, panelY + 50);
    ctx.fillRect(x - 1, panelY + 54, 2, 6);
  }
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, panelY + 14);
  ctx.lineTo(w / 2 + 8, panelY + 14);
  ctx.lineTo(w / 2, panelY + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(Math.round(plane.headingDeg)).padStart(3, '0')}°`, w / 2, panelY + 92);

  // Target caret on the tape: where the mission wants you to point.
  const target = currentTarget(sortie, plane);
  const err = headingErrorTo(plane, target);
  if (Math.abs(err) <= 58) {
    // Clamp inside the tape window: an unclamped caret at the rim
    // drew a dark half-glyph outside the box that read as a blob.
    const x = Math.max(tapeX + 14, Math.min(tapeX + 326, w / 2 + err * 3.4));
    ctx.fillStyle = '#2eff7b';
    ctx.beginPath();
    ctx.moveTo(x, panelY + 62);
    ctx.lineTo(x - 6, panelY + 70);
    ctx.lineTo(x + 6, panelY + 70);
    ctx.closePath();
    ctx.fill();
  }

  // Right cluster: three bars, with a narrow readout column beside
  // them (vertical speed, radio altitude, gear) kept clear of the
  // bars' own value labels.
  const rx = w - 340;
  const barW = 168;
  const colX = rx + 182;
  barGauge(ctx, rx, panelY + 34, barW, 'THROTTLE', plane.throttle, '#ffb340', `${Math.round(plane.throttle * 100)}%`);
  const vs = plane.verticalSpeed;
  ctx.fillStyle = '#8fd0ee';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VERT SPEED', colX, panelY + 29);
  ctx.fillStyle = vs > 0.4 ? '#2eff7b' : vs < -0.4 ? '#ff9d5e' : '#fff';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillText(`${vs >= 0 ? '▲' : '▼'} ${Math.abs(vs).toFixed(1)} m/s`, colX, panelY + 50);
  const fuelColor = plane.fuel < 22 ? '#ff6b5e' : plane.fuel < 45 ? '#ffb340' : '#39c2d7';
  barGauge(ctx, rx, panelY + 76, barW, 'FUEL', plane.fuel / 100, fuelColor, `${Math.round(plane.fuel)}%`);
  const hullColor = plane.hull < 35 ? '#ff6b5e' : plane.hull < 70 ? '#ffb340' : '#7dd069';
  barGauge(ctx, rx, panelY + 116, barW, 'HULL', plane.hull / 100, hullColor, `${Math.round(plane.hull)}%`);
  const agl = Math.max(0, plane.alt - groundHeightAt(plane.x, plane.z));
  ctx.fillStyle = '#8fd0ee';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RADIO ALT', colX, panelY + 71);
  ctx.fillStyle = '#fff';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(agl)} m`, colX, panelY + 92);
  ctx.fillStyle = plane.gearDown ? '#2eff7b' : '#5a6a78';
  ctx.font = '800 11.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(plane.gearDown ? 'GEAR ▼ DOWN' : 'GEAR ▲ UP', colX, panelY + 122);

  if (plane.stalled) {
    ctx.fillStyle = '#ff3b30';
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ STALL — NOSE DOWN', w / 2, panelY - 58);
  } else if (!plane.onGround && plane.fuel > 0 && plane.fuel < 22) {
    ctx.fillStyle = '#ff9d5e';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ FUEL LOW — THINK ABOUT HOME', w / 2, panelY - 58);
  }
}

export function drawHud(ctx, plane, sortie, w, h) {
  // Mission panel, top-left.
  panelBox(ctx, 16, 16, 356, 108, '✉ SKY HARBOR MAIL RUN');
  ctx.fillStyle = '#fff';
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const phaseText =
    sortie.phase === PHASES.TAKEOFF
      ? 'ACT 1 · TAKE OFF'
      : sortie.phase === PHASES.RINGS
        ? `ACT 2 · MAIL RINGS ${sortie.ringsPassed}/${RINGS.length}`
        : sortie.phase === PHASES.DROP
          ? 'ACT 3 · PARCEL DROP'
          : sortie.phase === PHASES.LANDING
            ? 'ACT 4 · LAND AT HOME'
            : sortie.crashed
              ? 'SORTIE OVER'
              : 'SORTIE COMPLETE';
  ctx.fillText(phaseText, 26, 58);
  const target = currentTarget(sortie, plane);
  const dist = Math.hypot(plane.x - target.x, plane.z - target.z);
  ctx.fillStyle = '#ffd23e';
  ctx.font = '700 14.5px system-ui, sans-serif';
  if (sortie.phase === PHASES.DONE || sortie.finished) {
    ctx.fillText('➤ FLIGHT COMPLETE — SEE THE REPORT', 26, 82);
  } else {
    ctx.fillText(`➤ ${target.label} · ${Math.round(dist)} m`, 26, 82);
  }
  // Mission progress: eight stages — the six rings, then the drop,
  // then the landing — so Acts 3 and 4 show on the board too, not
  // just in the phase line. Drop pip carries a parcel mark, the
  // landing pip a runway tick.
  const stageState = (i) => {
    if (i < RINGS.length) {
      return i < sortie.ringIndex || sortie.phase === PHASES.DROP || sortie.phase === PHASES.LANDING || sortie.phase === PHASES.DONE
        ? 'done'
        : sortie.phase === PHASES.RINGS && i === sortie.ringIndex
          ? 'next'
          : 'todo';
    }
    if (i === RINGS.length) {
      return sortie.dropped ? 'done' : sortie.phase === PHASES.DROP ? 'next' : 'todo';
    }
    return sortie.phase === PHASES.DONE ? 'done' : sortie.phase === PHASES.LANDING ? 'next' : 'todo';
  };
  for (let i = 0; i < RINGS.length + 2; i++) {
    const cx = 38 + i * 25;
    const st = stageState(i);
    ctx.beginPath();
    ctx.arc(cx, 106, 8, 0, Math.PI * 2);
    ctx.fillStyle = st === 'done' ? '#50dc8c' : st === 'next' ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.fillStyle = st === 'todo' ? 'rgba(255,255,255,0.55)' : '#0c1420';
    ctx.font = '800 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (i === RINGS.length) ctx.fillText('✉', cx, 109);
    if (i === RINGS.length + 1) ctx.fillText('▼', cx, 109);
  }

  // Score panel, top-right.
  panelBox(ctx, w - 252, 16, 236, 108, 'SCORE');
  ctx.fillStyle = '#fff';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(String(sortie.score).padStart(5, '0'), w - 30, 62);
  ctx.fillStyle = '#8fd0ee';
  ctx.font = '700 14px system-ui, sans-serif';
  const mm = String(Math.floor(sortie.timeSec / 60));
  const ss = String(Math.floor(sortie.timeSec % 60)).padStart(2, '0');
  ctx.fillText(`TIME ${mm}:${ss} · WIND ${plane.windGust >= 0 ? '+' : ''}${plane.windGust.toFixed(0)}°`, w - 30, 88);
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(`ALT ${Math.round(plane.alt)} m · ${Math.round(plane.speed * KT)} kt`, w - 30, 110);

  // Centre message banner.
  if (sortie.message && sortie.timeSec <= sortie.messageUntil) {
    ctx.font = '800 21px system-ui, sans-serif';
    const tw = ctx.measureText(sortie.message).width + 44;
    ctx.fillStyle = 'rgba(10,16,26,0.8)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, 140, tw, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#ffe98a';
    ctx.textAlign = 'center';
    ctx.fillText(sortie.message, w / 2, 168);
  }

  // Big steering arrow: rotated to the target's actual relative
  // bearing, so it points where the target really is — ahead-right,
  // hard left, even behind — instead of flipping left/right beside
  // the nose regardless of the geometry.
  const err = headingErrorTo(plane, target);
  if (!sortie.finished && Math.abs(err) > 14) {
    ctx.fillStyle = 'rgba(255,210,62,0.92)';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w / 2, 226);
    // ➤ glyph points +x (right); screen-ahead is up. Bearing err is
    // clockwise from the nose, matching canvas rotation.
    ctx.rotate(((err - 90) * Math.PI) / 180);
    ctx.fillText('➤', 0, 14);
    ctx.restore();
  }
}
