// Screenshot scenes, the honest way: there is ONE canonical mail run,
// flown by an autopilot through the real physics and mission code.
// Each named scene is a moment in that single flight, captured by
// re-running the simulation to that moment — so the score, fuel, ring
// count and clock on every screenshot come from the same flight and
// can never contradict each other.

import { createAircraft } from './aircraft.js';
import { stepFlight, angleDeltaDeg } from './physics.js';
import { createSortie, stepMission, currentTarget, bearingTo, headingErrorTo, DROP_ZONE, RINGS } from './missions.js';
import { groundHeightAt } from './terrain.js';
import { WORLD } from './config.js';

// A competent, gentle autopilot: steer to the mission target, hold a
// sensible altitude, and fly a stabilised final approach to land.
export function autopilotInput(plane, sortie, dt) {
  const input = { throttle: 0.8, pitch: 0, roll: 0, yaw: 0 };
  const target = currentTarget(sortie);
  const err = angleDeltaDeg(bearingTo(plane, target), plane.headingDeg);
  const distT = Math.hypot(plane.x - target.x, plane.z - target.z);

  if (plane.onGround) {
    if (sortie.phase === 'DONE' || sortie.finished) {
      input.throttle = 0;
      return input;
    }
    // Takeoff roll: full throttle, gentle rudder to the centreline,
    // rotate once fast enough.
    input.throttle = 1;
    input.yaw = Math.max(-1, Math.min(1, -plane.x * 0.04));
    input.pitch = plane.speed > 30 ? 0.55 : 0;
    return input;
  }

  // Bank toward the target, proportional and capped.
  input.roll = Math.max(-1, Math.min(1, err / 38));

  let targetAlt = target.alt;
  let targetSpeed = 52;
  if (sortie.phase === 'LANDING') {
    // Two-stage arrival: first the approach fix on the extended
    // centreline south of the field, then a stabilised final down a
    // ~5 degree glidepath to the threshold. Aiming straight at the
    // threshold from any angle just orbits it.
    const fix = { x: 0, z: 1250 };
    const distFix = Math.hypot(plane.x - fix.x, plane.z - fix.z);
    const onFinal =
      plane._onFinal ||
      (distFix < 200 && Math.abs(angleDeltaDeg(plane.headingDeg, 0)) < 28);
    plane._onFinal = onFinal;
    const aimZ = WORLD.runway.thresholdZ + 40;
    const distA = onFinal ? Math.hypot(plane.x - 0, plane.z - aimZ) : distFix;
    const ground = groundHeightAt(0, aimZ);
    const pastThreshold = plane.z < aimZ;
    const glideAlt = pastThreshold ? ground : ground + Math.max(0, distA) * 0.095 + (onFinal ? 0 : 60);
    targetAlt = glideAlt;
    targetSpeed = onFinal ? (distA < 500 ? 29 : 38) : 48;
    // On final, fly the runway heading with a gentle centreline
    // correction — never pure-pursuit the threshold point, which
    // spirals as you reach it.
    const desiredHeading = onFinal
      ? Math.max(-20, Math.min(20, -plane.x * 0.16))
      : bearingTo(plane, fix);
    const errA = angleDeltaDeg(desiredHeading, plane.headingDeg);
    const bankCap = onFinal ? 0.5 : 1;
    input.roll = Math.max(-bankCap, Math.min(bankCap, errA / 30));
    const aglNow = plane.alt - groundHeightAt(plane.x, plane.z);
    if (onFinal && aglNow < 30) {
      // Flare: hold a gentle settle (-1.6 m/s, firmer once over the
      // strip so she does not float its whole length), throttle idle.
      const settle = plane.z < WORLD.runway.thresholdZ ? -2.6 : -1.6;
      const wantPitchDeg = (Math.asin(Math.max(-0.2, Math.min(0.2, settle / Math.max(plane.speed, 20)))) * 180) / Math.PI;
      input.pitch = Math.max(-1, Math.min(1, wantPitchDeg / 20 - plane.verticalSpeed * 0.04));
      input.throttle = 0.03;
      input.roll = Math.max(-0.3, Math.min(0.3, errA / 36));
      return input;
    }
  } else if (sortie.phase === 'DROP') {
    targetAlt = 74;
    targetSpeed = 46;
  }

  const altErr = targetAlt - plane.alt;
  input.pitch = Math.max(-1, Math.min(1, altErr / 55 - plane.verticalSpeed * 0.05));
  input.throttle = Math.max(0.25, Math.min(1, 0.72 + (targetSpeed - plane.speed) * 0.03));
  return input;
}

// Run the canonical flight. onStep(plane, sortie, step) may return
// 'stop' to halt early. Returns the final {plane, sortie, steps}.
export function simulateCanonicalFlight(onStep, maxSteps = 60 * 60 * 6) {
  const plane = createAircraft();
  const sortie = createSortie();
  const dt = 1 / 60;
  let step = 0;
  let stopped = false;
  while (step < maxSteps) {
    const input = autopilotInput(plane, sortie, dt);
    const before = { rings: sortie.ringsPassed, phase: sortie.phase };
    const events = stepFlight(plane, input, dt, sortie.timeSec);
    stepMission(sortie, plane, events, dt);
    step += 1;
    if (onStep && onStep(plane, sortie, step, before) === 'stop') {
      stopped = true;
      break;
    }
    if (sortie.finished && plane.speed < 0.5) break;
    if (sortie.phase === 'DONE' && plane.onGround && plane.speed < 1) break;
  }
  return { plane, sortie, steps: step, stopped };
}

// Scene definitions: each is a predicate over the live simulation.
export const SHOT_SCENES = {
  cover(plane, sortie) {
    // The Act 3 drop approach (Quick review: the old takeoff cover
    // was 40% grey runway with no sea in frame): low over the sea on
    // the run-in to Beacon Islet, lighthouse and drop marker ahead,
    // gear down, the whole panel lit. A real frame of the same
    // canonical flight — the sim simply runs on into the DROP phase.
    if (sortie.phase !== 'DROP' || plane.onGround) return false;
    const dist = Math.hypot(plane.x - DROP_ZONE.x, plane.z - DROP_ZONE.z);
    return (
      dist > 340 &&
      dist < 560 &&
      plane.alt <= DROP_ZONE.maxAlt &&
      Math.abs(headingErrorTo(plane, DROP_ZONE)) < 22
    );
  },
  rings(plane, sortie, step, before) {
    // The frame the fifth ring is crossed: turning for home over the
    // main island, town and strip ahead, one ring still to thread.
    return before && before.rings === 4 && sortie.ringsPassed === 5;
  },
  landing(plane, sortie) {
    // On final: south of the threshold, on the centreline, aligned
    // with the runway and low — the strip fills the view ahead.
    if (sortie.phase !== 'LANDING' || plane.onGround) return false;
    const agl = plane.alt - groundHeightAt(plane.x, plane.z);
    const dist = Math.hypot(plane.x, plane.z - WORLD.runway.thresholdZ);
    return (
      agl < 82 &&
      dist < 760 &&
      plane.z > 480 &&
      Math.abs(plane.x) < 80 &&
      Math.abs(plane.bankDeg) < 18 &&
      Math.abs(angleDeltaDeg(plane.headingDeg, 0)) < 7
    );
  },
  end(plane, sortie) {
    return (sortie.phase === 'DONE' || sortie.finished) && plane.onGround && plane.speed < 2;
  },
};

// Fly the canonical run until a named scene's moment, then return the
// state exactly as the simulation produced it.
export function flyToScene(name) {
  const pred = SHOT_SCENES[name];
  if (!pred) return simulateCanonicalFlight(null, 60 * 30);
  if (name === 'rings') {
    // Capture a breath after the crossing so the +points banner and
    // the next ring are both in frame.
    let extra = -1;
    return simulateCanonicalFlight((plane, sortie, step, before) => {
      if (extra > 0) {
        extra -= 1;
        if (extra === 0) return 'stop';
      } else if (pred(plane, sortie, step, before)) {
        extra = 30;
      }
      return null;
    });
  }
  return simulateCanonicalFlight((plane, sortie, step, before) =>
    pred(plane, sortie, step, before) ? 'stop' : null,
  );
}

export { RINGS };
