// The mail plane "Petrel": its state, and the hand-drawn chase-view
// sprite. The state is a plain object the physics steps and the
// renderer reads; nothing here knows about the DOM.

import { PLANE, WORLD } from './config.js';

export function createAircraft() {
  return {
    x: WORLD.start.x,
    z: WORLD.start.z,
    alt: 0, // metres above sea level; ground roll while alt <= ground
    headingDeg: WORLD.start.headingDeg,
    pitchDeg: 0,
    bankDeg: 0,
    speed: 0, // m/s along the flight direction
    verticalSpeed: 0, // m/s, positive climbing
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    hull: PLANE.hullMax,
    onGround: true,
    gearDown: true,
    propPhase: 0,
    stalled: false,
    windGust: 0,
  };
}

// Draw the Petrel from behind: fuselage, high wing, tail feathers, a
// spinning prop disc and the red mail livery. ctx is translated to the
// plane's screen position and scaled so 1 unit = 1 metre of wingspan.
export function drawAircraft(ctx, plane, scale, timeMs) {
  const bank = (plane.bankDeg * Math.PI) / 180;
  ctx.save();
  ctx.rotate(bank * 0.85);
  const s = scale;
  const propBlur = plane.throttle > 0.03 || plane.speed > 2;

  // Tailplane and fin (furthest from camera).
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.moveTo(-0.28 * s, -3.1 * s);
  ctx.lineTo(-2.5 * s, -2.2 * s);
  ctx.lineTo(-2.5 * s, -1.55 * s);
  ctx.lineTo(-0.28 * s, -2.0 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.28 * s, -3.1 * s);
  ctx.lineTo(2.5 * s, -2.2 * s);
  ctx.lineTo(2.5 * s, -1.55 * s);
  ctx.lineTo(0.28 * s, -2.0 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8402a';
  ctx.beginPath();
  ctx.moveTo(-0.3 * s, -3.15 * s);
  ctx.lineTo(0, -4.6 * s);
  ctx.lineTo(0.3 * s, -3.15 * s);
  ctx.closePath();
  ctx.fill();

  // Fuselage: tapered body running away from the camera.
  const body = ctx.createLinearGradient(0, -3.4 * s, 0, 0.9 * s);
  body.addColorStop(0, '#f4f1e8');
  body.addColorStop(0.55, '#fdfcf7');
  body.addColorStop(1, '#d9d4c6');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-0.32 * s, -3.3 * s);
  ctx.quadraticCurveTo(-0.95 * s, -1.2 * s, -0.88 * s, 0.55 * s);
  ctx.quadraticCurveTo(-0.8 * s, 1.05 * s, 0, 1.1 * s);
  ctx.quadraticCurveTo(0.8 * s, 1.05 * s, 0.88 * s, 0.55 * s);
  ctx.quadraticCurveTo(0.95 * s, -1.2 * s, 0.32 * s, -3.3 * s);
  ctx.closePath();
  ctx.fill();

  // Mail livery cheatline.
  ctx.fillStyle = '#c8402a';
  ctx.beginPath();
  ctx.moveTo(-0.9 * s, -0.15 * s);
  ctx.lineTo(0.9 * s, -0.15 * s);
  ctx.lineTo(0.86 * s, 0.28 * s);
  ctx.lineTo(-0.86 * s, 0.28 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fdfcf7';
  ctx.font = `700 ${0.34 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('MAIL', 0, 0.22 * s);

  // Cockpit glass.
  const glass = ctx.createLinearGradient(0, -1.9 * s, 0, -0.7 * s);
  glass.addColorStop(0, '#7fb6cf');
  glass.addColorStop(1, '#2d5a74');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(-0.52 * s, -1.75 * s);
  ctx.quadraticCurveTo(0, -2.05 * s, 0.52 * s, -1.75 * s);
  ctx.quadraticCurveTo(0.45 * s, -0.95 * s, 0, -0.9 * s);
  ctx.quadraticCurveTo(-0.45 * s, -0.95 * s, -0.52 * s, -1.75 * s);
  ctx.closePath();
  ctx.fill();

  // Main wing (nearest the camera, across the lower body).
  const wing = ctx.createLinearGradient(-5.6 * s, 0, 5.6 * s, 0);
  wing.addColorStop(0, '#d8542e');
  wing.addColorStop(0.18, '#f0ead9');
  wing.addColorStop(0.5, '#fdfcf7');
  wing.addColorStop(0.82, '#f0ead9');
  wing.addColorStop(1, '#d8542e');
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-5.6 * s, 0.62 * s);
  ctx.lineTo(-0.8 * s, 0.18 * s);
  ctx.lineTo(0.8 * s, 0.18 * s);
  ctx.lineTo(5.6 * s, 0.62 * s);
  ctx.lineTo(5.35 * s, 1.02 * s);
  ctx.lineTo(0.7 * s, 0.62 * s);
  ctx.lineTo(-0.7 * s, 0.62 * s);
  ctx.lineTo(-5.35 * s, 1.02 * s);
  ctx.closePath();
  ctx.fill();

  // Wheels when the gear is down.
  if (plane.gearDown) {
    ctx.fillStyle = '#22242a';
    ctx.beginPath();
    ctx.arc(-0.95 * s, 1.32 * s, 0.3 * s, 0, Math.PI * 2);
    ctx.arc(0.95 * s, 1.32 * s, 0.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a8578';
    ctx.lineWidth = 0.09 * s;
    ctx.beginPath();
    ctx.moveTo(-0.7 * s, 0.8 * s);
    ctx.lineTo(-0.95 * s, 1.15 * s);
    ctx.moveTo(0.7 * s, 0.8 * s);
    ctx.lineTo(0.95 * s, 1.15 * s);
    ctx.stroke();
  }

  // Prop disc at the nose (drawn last, in front of the fuselage foot).
  if (propBlur) {
    const spin = 0.25 + 0.35 * Math.sin(timeMs / 40);
    ctx.fillStyle = `rgba(40,42,48,${0.16 + plane.throttle * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 1.08 * s, 1.55 * s, 0.34 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(240,240,235,${spin})`;
    ctx.lineWidth = 0.07 * s;
    ctx.beginPath();
    ctx.moveTo(-1.5 * s, 1.08 * s);
    ctx.lineTo(1.5 * s, 1.08 * s);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#2c2e33';
    ctx.lineWidth = 0.13 * s;
    ctx.beginPath();
    ctx.moveTo(-1.45 * s, 1.08 * s);
    ctx.lineTo(1.45 * s, 1.08 * s);
    ctx.stroke();
  }

  // Navigation lights.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-5.5 * s, 0.8 * s, 0.14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2eff7b';
  ctx.beginPath();
  ctx.arc(5.5 * s, 0.8 * s, 0.14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
