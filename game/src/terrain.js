// The Sky Harbor archipelago: islands, town, lighthouse, mountains and
// the airfield, all as plain world data (metres, x east, z south).
// The renderer projects these shapes; the physics reads groundHeightAt
// from the same data, so what you see is exactly what you can hit.

export const ISLANDS = [
  // Main island: airfield, town and the mountain ridge.
  { name: 'Sky Harbor Island', x: 60, z: -260, rx: 1500, rz: 1750, sand: 46 },
  // Lighthouse islet, south-west.
  { name: 'Beacon Islet', x: -980, z: 760, rx: 360, rz: 330, sand: 30 },
  // Northern pine island.
  { name: 'Pine Island', x: -1750, z: -1500, rx: 560, rz: 470, sand: 36 },
  // Eastern resort island.
  { name: 'Coral Island', x: 1950, z: 700, rx: 640, rz: 520, sand: 38 },
  // Far southern speck.
  { name: 'Gull Rock', x: 700, z: 1750, rx: 300, rz: 240, sand: 24 },
];

export const MOUNTAINS = [
  { x: 1010, z: -1080, r: 330, h: 210, name: 'Mount Kite' },
  { x: 1250, z: -620, r: 270, h: 165 },
  { x: 880, z: -1480, r: 240, h: 150 },
  { x: -1150, z: -350, r: 260, h: 130 },
];

export const LIGHTHOUSE = { x: -980, z: 700, height: 54 };

export const DEPOT = { x: -95, z: 120, name: 'Fuel depot' };

// Town of Sky Harbor: deterministic pseudo-random blocks east of the strip.
function buildTown() {
  const blocks = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 42; i++) {
    const gx = 330 + (i % 7) * 78 + rnd() * 26;
    const gz = -880 + Math.floor(i / 7) * 92 + rnd() * 30;
    blocks.push({
      x: gx,
      z: gz,
      w: 26 + rnd() * 22,
      d: 24 + rnd() * 20,
      h: 14 + rnd() * 30,
      hue: [18, 32, 200, 8, 42][i % 5],
    });
  }
  return blocks;
}
export const TOWN = buildTown();

// Pine trees scattered on the islands (deterministic).
function buildTrees() {
  const trees = [];
  let seed = 31;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (const isl of ISLANDS) {
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * 0.82;
      const x = isl.x + Math.cos(a) * isl.rx * rr;
      const z = isl.z + Math.sin(a) * isl.rz * rr;
      if (Math.abs(x) < 90 && z > -620 && z < 420) continue; // keep the strip clear
      if (Math.hypot(x - 560, z + 640) < 330) continue; // keep the town clear
      trees.push({ x, z, s: 0.8 + rnd() * 0.7 });
    }
  }
  return trees;
}
export const TREES = buildTrees();

// Grass mottling: darker meadow patches scattered on the islands
// (deterministic), so the domes do not read as one flat billiard
// cloth. Each patch sits inside its island's rim.
export const PATCHES = [];
{
  let seed = 53;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (const isl of ISLANDS) {
    for (let i = 0; i < 15; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * 0.78;
      PATCHES.push({
        x: isl.x + Math.cos(a) * isl.rx * rr,
        z: isl.z + Math.sin(a) * isl.rz * rr,
        r: 90 + rnd() * 190,
        tone: rnd(),
      });
    }
  }
}

// Clouds: soft billboards drifting slowly east.
export const CLOUDS = [];
{
  let seed = 97;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    CLOUDS.push({
      x: (rnd() - 0.5) * 7000,
      z: (rnd() - 0.5) * 7000,
      alt: 260 + rnd() * 220,
      s: 120 + rnd() * 200,
    });
  }
}

export function islandHeightAt(x, z) {
  let h = -6; // seabed under water
  for (const isl of ISLANDS) {
    const dx = (x - isl.x) / isl.rx;
    const dz = (z - isl.z) / isl.rz;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1) {
      const dome = 14 * (1 - d2) + 3;
      if (dome > h) h = dome;
    }
  }
  return h;
}

function mountainHeightAt(x, z) {
  let h = 0;
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) {
      const cone = m.h * (1 - d / m.r);
      if (cone > h) h = cone;
    }
  }
  return h;
}

// Height of solid ground at a world point; <= 0 means open sea.
export function groundHeightAt(x, z) {
  return Math.max(islandHeightAt(x, z), mountainHeightAt(x, z));
}
