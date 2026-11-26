// Sky Harbor — Island Mail Run: shared tuning constants.
// Every number the flight model, the missions and the renderer agree on
// lives here, so a screenshot can never promise a physics value the
// simulation does not actually use.

export const WORLD = {
  // Runway: a strip along the z axis on the main island. North is -z.
  runway: { x: 0, halfWidth: 24, zNorth: -520, zSouth: 320, thresholdZ: 210 },
  start: { x: 0, z: 250, headingDeg: 0 },
  seaLevel: 0,
};

export const PLANE = {
  maxSpeed: 82, // m/s at full throttle, level
  idleSpeed: 0,
  accel: 16, // m/s^2 of thrust at full throttle before drag
  dragK: 0.0024, // quadratic drag coefficient
  takeOffSpeed: 29,
  stallSpeed: 19,
  maxPitchDeg: 24,
  minPitchDeg: -20,
  rollRateDeg: 95, // how fast the pilot can roll into a bank
  turnPerBankDeg: 1.05, // heading degrees per second per degree of bank at cruise
  fuelCapacity: 100,
  fuelBurnFull: 0.62, // fuel units per second at full throttle
  fuelBurnIdle: 0.05,
  hullMax: 100,
};

export const SCORING = {
  ringBase: 300,
  ringCenterBonus: 150, // scaled by how centrally the ring was crossed
  dropBase: 200,
  dropCenterBonus: 400, // scaled by how close the pass came to the light
  landingPerfect: 600,
  landingGood: 350,
  fuelBonusPerUnit: 6,
  timeBonusPerSecond: 4,
  sortieParSeconds: 300,
};

export const CAMERA = {
  chaseDistance: 21,
  chaseHeight: 7.5,
  focal: 620, // pixels at 1280x800; render scales by canvas size
};

export const PHASES = {
  TAKEOFF: 'TAKEOFF',
  RINGS: 'RINGS',
  DROP: 'DROP',
  LANDING: 'LANDING',
  DONE: 'DONE',
  CRASHED: 'CRASHED',
};
