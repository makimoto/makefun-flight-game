// The sortie: one continuous mail run in three acts, scored by the
// same functions in live play and in the scripted screenshot flight.
//   Act 1 TAKEOFF — leave the Sky Harbor strip cleanly.
//   Act 2 RINGS   — thread the six mail rings in order.
//   Act 3 DROP    — one low pass over Beacon Islet releases the parcel.
//   Act 4 LANDING — come home into the wind and land on the strip.
// Fuel and hull are the decisions: full throttle everywhere drinks the
// tank, and a sloppy arrival bends the aeroplane.

import { PHASES, SCORING } from './config.js';
import { LIGHTHOUSE } from './terrain.js';
import { angleDeltaDeg, judgeTouchdown } from './physics.js';

export const RINGS = [
  { x: 0, z: -950, alt: 120, name: 'Harbour Gate' },
  { x: 330, z: -1550, alt: 145, name: 'North Buoy' },
  { x: 920, z: -1850, alt: 165, name: 'Kite Shoulder' },
  { x: 1560, z: -1250, alt: 150, name: 'Coral Turn' },
  { x: 1520, z: -420, alt: 130, name: 'East Reach' },
  { x: 880, z: 60, alt: 115, name: 'Home Gate' },
];
export const RING_RADIUS = 46;

export const DROP_ZONE = { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, radius: 240, maxAlt: 95 };

export function createSortie() {
  return {
    phase: PHASES.TAKEOFF,
    timeSec: 0,
    score: 0,
    ringIndex: 0,
    ringsPassed: 0,
    ringSplits: [], // {name, offset} per ring, from the real crossing
    dropped: false,
    dropOffset: null,
    dropPoints: null,
    landing: null, // judgeTouchdown result once down
    takeoffClean: false,
    message: 'Throttle up with W. Rotate with ↓ past 55 kt.',
    messageUntil: 0,
    finished: false,
    crashed: false,
  };
}

function say(sortie, text, seconds = 3.5) {
  sortie.message = text;
  sortie.messageUntil = sortie.timeSec + seconds;
}

// Advance the mission by one frame. planeEvents are the strings
// stepFlight returned this frame ('liftoff', 'touchdown', ...).
export function stepMission(sortie, plane, planeEvents, dt) {
  if (sortie.finished) return;
  sortie.timeSec += dt;

  if (planeEvents.includes('ditching')) {
    sortie.crashed = true;
    sortie.finished = true;
    sortie.landing = { kind: 'ditching', onStrip: false, descent: 0, speed: plane.speed, lateral: 0, headingErr: 0, damage: 65 };
    plane.hull = Math.max(0, plane.hull - 65);
    say(sortie, 'Ditched in the sea!', 99);
    return;
  }

  if (planeEvents.includes('liftoff') && sortie.phase === PHASES.TAKEOFF) {
    sortie.phase = PHASES.RINGS;
    sortie.takeoffClean = plane.hull >= 100;
    say(sortie, 'Airborne! Follow the glowing mail rings — ring 1 ahead.');
  }

  if (sortie.phase === PHASES.RINGS && !plane.onGround) {
    // A ring is threaded when the plane crosses the ring's own plane:
    // the offset is the distance from the centre at that crossing, so
    // a dead-centre pass genuinely pays more than clipping the rim.
    const ring = RINGS[sortie.ringIndex];
    const dz = plane.z - ring.z;
    const prevDz = sortie._prevRingDz;
    sortie._prevRingDz = dz;
    const crossed = prevDz != null && prevDz !== 0 && Math.sign(dz) !== Math.sign(prevDz);
    const speared = Math.hypot(plane.x - ring.x, plane.alt - ring.alt, dz) < 12;
    // A crossing only counts near the ring itself: crossing its
    // latitude on the far side of the map neither threads nor
    // consumes the gate.
    const nearGate = Math.hypot(plane.x - ring.x, plane.alt - ring.alt) < 340;
    if (speared || (crossed && nearGate)) {
      const offset = Math.hypot(plane.x - ring.x, plane.alt - ring.alt);
      if (offset < RING_RADIUS || speared) {
        const center = Math.max(0, 1 - offset / RING_RADIUS);
        const gained = Math.round(SCORING.ringBase + SCORING.ringCenterBonus * center);
        sortie.score += gained;
        sortie.ringsPassed += 1;
        sortie.ringSplits.push({ name: ring.name, offset: Math.round(offset), gained });
        say(sortie, `Ring ${sortie.ringsPassed} — +${gained}. Next: ${RINGS[Math.min(sortie.ringIndex + 1, RINGS.length - 1)].name}.`);
      } else {
        sortie.ringSplits.push({ name: ring.name, offset: Math.round(offset), gained: 0 });
        say(sortie, `Missed ${ring.name} — ${Math.round(offset)} m wide. Carry on!`);
      }
      sortie.ringIndex += 1;
      sortie._prevRingDz = null;
      if (sortie.ringIndex >= RINGS.length) {
        sortie.phase = PHASES.DROP;
        say(sortie, `Ring run done! Parcel away over Beacon Islet — low, below ${DROP_ZONE.maxAlt} m.`);
      }
    }
  }

  if (sortie.phase === PHASES.DROP && !plane.onGround) {
    // The parcel goes at the closest point of a pass through the
    // zone itself: samples count only inside the 240 m radius and
    // below the drop ceiling, and the release must happen in or
    // just past the zone — never from a neighbouring valley.
    const d = Math.hypot(plane.x - DROP_ZONE.x, plane.z - DROP_ZONE.z);
    if (d < DROP_ZONE.radius && plane.alt <= DROP_ZONE.maxAlt) {
      if (sortie._dropClosest == null || d < sortie._dropClosest) sortie._dropClosest = d;
    }
    const leaving =
      sortie._dropClosest != null && d > sortie._dropClosest + 42 && d < DROP_ZONE.radius + 70;
    if ((leaving || d < 55) && plane.alt <= DROP_ZONE.maxAlt && sortie._dropClosest != null) {
      sortie.dropped = true;
      sortie.dropOffset = Math.round(sortie._dropClosest);
      // The drop pays like a ring does: a base for delivering at all,
      // plus a centre bonus that fades with the miss distance — a
      // 54 m pass earns well, but never the dead-centre money.
      const closeness = Math.max(0, 1 - sortie._dropClosest / DROP_ZONE.radius);
      sortie.dropPoints = Math.round(SCORING.dropBase + SCORING.dropCenterBonus * closeness);
      sortie.score += sortie.dropPoints;
      sortie.phase = PHASES.LANDING;
      say(sortie, `Parcel away — ${sortie.dropOffset} m from the light, +${sortie.dropPoints}! Now bring her home.`);
    }
  }

  if (planeEvents.includes('touchdown') && !sortie.landing) {
    // Only the first arrival is judged: a later bounce, re-landing or
    // crash after the report is written cannot rewrite it.
    const verdict = judgeTouchdown(plane);
    sortie.landing = verdict;
    plane.hull = Math.max(0, plane.hull - verdict.damage);
    if (verdict.kind === 'crash' || verdict.kind === 'ditching' || verdict.kind === 'terrain') {
      sortie.crashed = true;
      sortie.finished = true;
      say(sortie, verdict.kind === 'ditching' ? 'Ditched in the sea!' : 'Came down off the runway!', 99);
    } else {
      // A full landing score is earned only by arriving at the end of
      // the route. Putting down early is a safe abort, not a delivery:
      // it ends the sortie for a token score and no honours.
      const viaRoute = sortie.phase === PHASES.LANDING;
      if (!viaRoute) sortie.aborted = true;
      const points = !viaRoute
        ? 120
        : verdict.kind === 'smooth'
          ? SCORING.landingPerfect
          : verdict.kind === 'firm'
            ? SCORING.landingGood
            : 120;
      sortie.landingPoints = points;
      sortie.score += points;
      sortie.phase = PHASES.DONE;
      say(sortie, `Down safely — a ${verdict.kind} arrival.`, 99);
    }
  }

  if (plane.hull <= 0 && !sortie.finished) {
    sortie.crashed = true;
    sortie.finished = true;
    say(sortie, 'The Petrel is too bent to fly on.', 99);
  }
}

// Called once when the plane rolls to a stop after a landing (or the
// player ends the sortie): adds the bonuses the flight itself earned.
export function finaliseSortie(sortie, plane) {
  if (sortie.finalScore != null) return sortie.finalScore;
  const fuelBonus = sortie.crashed ? 0 : Math.round(plane.fuel) * SCORING.fuelBonusPerUnit;
  const timeBonus = sortie.crashed
    ? 0
    : Math.max(0, Math.round((SCORING.sortieParSeconds - sortie.timeSec) * SCORING.timeBonusPerSecond));
  const total = sortie.score + fuelBonus + timeBonus;
  sortie.finalScore = total;
  sortie.fuelBonus = fuelBonus;
  sortie.timeBonus = timeBonus;
  return total;
}

export function gradeFor(sortie) {
  const s = sortie.finalScore ?? sortie.score;
  if (sortie.crashed) return '—';
  // No parcel, no honours: an abort can land safely but never grade
  // above C, however much fuel and time it banks.
  if (!sortie.dropped) return s >= 1600 ? 'C' : 'D';
  if (s >= 3400) return 'S';
  if (s >= 2900) return 'A';
  if (s >= 2300) return 'B';
  if (s >= 1600) return 'C';
  return 'D';
}

// The current steering target for the HUD arrow and the autopilot:
// ring, drop zone, or — for the arrival — first the approach fix on
// the extended centreline, then the landing threshold. Pointing a
// pilot straight at the threshold from any bearing invites the
// oblique arrival the autopilot was built to avoid.
export function currentTarget(sortie, plane) {
  if (sortie.phase === PHASES.RINGS || sortie.phase === PHASES.TAKEOFF) {
    const ring = RINGS[Math.min(sortie.ringIndex, RINGS.length - 1)];
    return { x: ring.x, z: ring.z, alt: ring.alt, label: `RING ${sortie.ringIndex + 1} · ${ring.name}` };
  }
  if (sortie.phase === PHASES.DROP) {
    return { x: DROP_ZONE.x, z: DROP_ZONE.z, alt: 70, label: 'DROP · BEACON ISLET' };
  }
  // Landing: once the plane is south of the field, roughly on the
  // centreline, it is on final — the target is the threshold itself.
  // Only a plane still out of position routes via the approach fix;
  // pointing a pilot on final back at the fix behind them was the
  // old arrow bug (arrow hard right with the runway dead ahead).
  if (plane) {
    const onFinal = plane.z > 210 && Math.abs(plane.x) < 280;
    if (!onFinal && !(plane.z > 1000 && Math.abs(plane.x) < 280)) {
      return { x: 0, z: 1250, alt: 120, label: 'APPROACH FIX · SOUTH' };
    }
    if (plane.z <= 210) return { x: 0, z: -420, alt: 16, label: 'LAND · SKY HARBOR RWY 36' };
  }
  return { x: 0, z: 210, alt: 16, label: 'LAND · SKY HARBOR RWY 36' };
}

export function bearingTo(plane, target) {
  const deg = (Math.atan2(target.x - plane.x, -(target.z - plane.z)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function headingErrorTo(plane, target) {
  return angleDeltaDeg(bearingTo(plane, target), plane.headingDeg);
}
