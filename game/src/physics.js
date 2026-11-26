// Flight model: a forgiving but honest arcade simulation. Throttle
// makes speed, speed and pitch make climb, bank makes heading, and the
// ground always has the last word. stepFlight advances the plane by dt
// seconds under an input {throttle, pitch, roll, yaw} of -1..1 axes
// (throttle 0..1) and returns a list of event strings for the caller.

import { PLANE, WORLD } from './config.js';
import { groundHeightAt } from './terrain.js';

const DEG = Math.PI / 180;

export function headingVector(headingDeg) {
  const h = headingDeg * DEG;
  return { x: Math.sin(h), z: -Math.cos(h) };
}

export function angleDeltaDeg(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// Seeded gust field: smooth pseudo-noise over time, stronger at low
// altitude near the sea where the landing happens.
export function gustAt(timeSec, alt) {
  const base =
    Math.sin(timeSec * 0.43) * 0.6 + Math.sin(timeSec * 1.31 + 1.7) * 0.4;
  const lowAltBoost = alt < 60 ? 1.6 : 1.0;
  return base * 2.4 * lowAltBoost; // degrees of heading push / roll push
}

export function stepFlight(plane, input, dt, timeSec) {
  const events = [];
  const ground = groundHeightAt(plane.x, plane.z);
  const agl = plane.alt - ground;

  // Pilot controls shape attitude first.
  const targetBank = input.roll * 52;
  plane.bankDeg += (targetBank - plane.bankDeg) * Math.min(1, dt * 4.2);
  const gust = gustAt(timeSec, Math.max(agl, 0));
  plane.windGust = gust;
  if (!plane.onGround) plane.bankDeg += gust * dt * 2.2;

  if (plane.onGround) {
    plane.pitchDeg += (input.pitch * 10 - plane.pitchDeg) * Math.min(1, dt * 5);
    plane.pitchDeg = Math.max(-2, Math.min(14, plane.pitchDeg));
  } else {
    const targetPitch = input.pitch * (input.pitch > 0 ? PLANE.maxPitchDeg : -PLANE.minPitchDeg);
    plane.pitchDeg += (targetPitch - plane.pitchDeg) * Math.min(1, dt * 2.6);
  }

  // Throttle and fuel. An empty tank means a glider, not a stop.
  plane.throttle += (input.throttle - plane.throttle) * Math.min(1, dt * 2.4);
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0;
    if (!events.includes('fuel-empty')) events.push('fuel-empty');
  } else {
    const burn =
      (PLANE.fuelBurnIdle + (PLANE.fuelBurnFull - PLANE.fuelBurnIdle) * plane.throttle) * dt;
    plane.fuel = Math.max(0, plane.fuel - burn);
  }

  // Speed: thrust against quadratic drag, plus a slope term so dives
  // genuinely gain speed and climbs bleed it.
  const thrust = plane.throttle * PLANE.accel;
  const drag = PLANE.dragK * plane.speed * plane.speed;
  const slope = -Math.sin(plane.pitchDeg * DEG) * 6.5 * (plane.onGround ? 0 : 1);
  plane.speed = Math.max(0, plane.speed + (thrust - drag + slope) * dt);
  if (plane.onGround && plane.throttle < 0.05) {
    plane.speed = Math.max(0, plane.speed - 9 * dt); // brakes / rolling friction
  }
  if (plane.onGround && ground <= 0.01) {
    // Water is not a runway: a taxi into the sea bogs down fast and
    // the sortie is over as a ditching, not a free second airfield.
    plane.speed = Math.max(0, plane.speed - 30 * dt);
    if (plane.speed < 2) events.push('ditching');
  }

  // Heading follows bank; rudder (yaw) helps on the ground and in
  // slow flight.
  const turnRate =
    Math.sin(plane.bankDeg * DEG) * PLANE.turnPerBankDeg * 52 * (plane.onGround ? 0 : 1) +
    input.yaw * (plane.onGround ? 26 : 7);
  plane.headingDeg = (plane.headingDeg + turnRate * dt + gust * dt * (plane.onGround ? 0 : 0.7) + 360) % 360;

  // Move along the heading.
  const dir = headingVector(plane.headingDeg);
  plane.x += dir.x * plane.speed * dt;
  plane.z += dir.z * plane.speed * dt;

  // Vertical: climb from pitch and excess speed; stall drops the nose.
  plane.stalled = !plane.onGround && plane.speed < PLANE.stallSpeed;
  if (plane.onGround) {
    plane.alt = ground;
    plane.verticalSpeed = 0;
    const canFly = plane.speed >= PLANE.takeOffSpeed && plane.pitchDeg > 4 && ground > 1;
    if (canFly) {
      plane.onGround = false;
      plane.verticalSpeed = 2.2;
      events.push('liftoff');
    }
  } else {
    let climb = Math.sin(plane.pitchDeg * DEG) * plane.speed;
    climb -= Math.max(0, (PLANE.stallSpeed + 6 - plane.speed)) * 0.22; // mush below best-glide
    if (plane.stalled) climb -= 5.5;
    plane.verticalSpeed += (climb - plane.verticalSpeed) * Math.min(1, dt * 2.2);
    plane.alt += plane.verticalSpeed * dt;

    if (plane.alt <= ground + 0.01) {
      plane.alt = ground;
      plane.onGround = true;
      plane.touchdownDescent = plane.verticalSpeed; // judged after this step
      events.push('touchdown');
      plane.verticalSpeed = 0;
    }
  }

  // Gear is a real state with a sensible automatic cycle: down on
  // the ground and on approach, retracted in the cruise. Altitude
  // (not AGL) is the trigger, with a hysteresis band so it cannot
  // chatter: up above 110 m, back down below 95 m. The low drop run
  // (~74 m) and every landing final stay gear-down; the ring cruise
  // (115–165 m) flies clean.
  if (plane.onGround) plane.gearDown = true;
  else if (plane.alt > 110) plane.gearDown = false;
  else if (plane.alt < 95) plane.gearDown = true;

  plane.propPhase += dt * (4 + plane.throttle * 40);
  return events;
}

// Judge a touchdown the moment it happens. Reads only the plane's own
// state and the runway geometry, so live play and the scripted
// screenshot flight are scored by exactly the same ruler.
export function judgeTouchdown(plane) {
  const rwy = WORLD.runway;
  const onStrip =
    Math.abs(plane.x - rwy.x) <= rwy.halfWidth && plane.z >= rwy.zNorth && plane.z <= rwy.zSouth;
  const headingErr = Math.abs(angleDeltaDeg(plane.headingDeg, 0));
  const descent = -(plane.touchdownDescent ?? plane.verticalSpeed);
  const result = {
    onStrip,
    headingErr,
    descent,
    speed: plane.speed,
    lateral: Math.abs(plane.x - rwy.x),
    kind: 'crash',
    damage: 0,
  };
  if (!onStrip) {
    result.kind = plane.alt <= 0.5 && groundHeightAt(plane.x, plane.z) <= 0 ? 'ditching' : 'terrain';
    result.damage = 65;
    return result;
  }
  if (descent > 9 || plane.speed > 46 || headingErr > 24) {
    result.kind = 'hard';
    result.damage = 34;
  } else if (descent > 5.5 || plane.speed > 38 || headingErr > 12) {
    result.kind = 'firm';
    result.damage = 10;
  } else {
    result.kind = 'smooth';
    result.damage = 0;
  }
  return result;
}
