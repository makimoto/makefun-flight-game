// Sky Harbor — Island Mail Run: the game loop and the screens.
// Live play runs the same stepFlight + stepMission pair the
// screenshot autopilot uses; the only difference is whose hands are
// on the controls.

import { createAircraft } from './aircraft.js';
import { stepFlight } from './physics.js';
import { createSortie, stepMission, finaliseSortie, gradeFor } from './missions.js';
import { drawScene } from './render.js';
import { drawInstruments, drawHud } from './instruments.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { flyToScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('start-overlay');
const endOverlay = document.getElementById('end-overlay');
const shotName = new URLSearchParams(location.search).get('shot');

let plane = createAircraft();
let sortie = createSortie();
let input = null;
let audio = null;
let running = false;
let lastTs = 0;
let prevRings = 0;
let prevPhase = sortie.phase;
let endShown = false;
let endTimer = 0;
let crashPlayed = false;

function resize() {
  canvas.width = Math.min(window.innerWidth, 1280);
  canvas.height = Math.min(window.innerHeight, 800);
}
window.addEventListener('resize', resize);
resize();

function renderFrame(timeMs) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScene(ctx, plane, sortie, canvas.width, canvas.height, timeMs);
  drawHud(ctx, plane, sortie, canvas.width, canvas.height);
  drawInstruments(ctx, plane, sortie, canvas.width, canvas.height);
}

function showEnd() {
  if (endShown) return;
  endShown = true;
  const total = finaliseSortie(sortie, plane);
  const title = document.getElementById('end-title');
  const stats = document.getElementById('end-stats');
  const grade = document.getElementById('end-grade');
  title.textContent = sortie.crashed
    ? '✉ THE MAIL DID NOT ARRIVE'
    : sortie.dropped
      ? '✉ MAIL DELIVERED — SORTIE COMPLETE'
      : '✉ BACK SAFELY — MAIL NOT DELIVERED';
  grade.textContent = gradeFor(sortie);
  const landingText = sortie.landing
    ? `${sortie.landing.kind.toUpperCase()} · ${Math.round(sortie.landing.descent * 10) / 10} m/s down · ${Math.round(sortie.landing.speed * 1.944)} kt`
    : 'never landed';
  const rows = [
    ['Rings threaded', `${sortie.ringsPassed} / 6`],
    ...sortie.ringSplits.map((r) => [`· ${r.name}`, `+${r.gained} (${r.offset} m off centre)`]),
    ['Parcel drop', sortie.dropped ? `+600 · away, ${sortie.dropOffset} m from the light` : 'not delivered'],
    ['Landing', sortie.landingPoints != null ? `+${sortie.landingPoints} · ${landingText}` : landingText],
    ['Flight time', `${Math.floor(sortie.timeSec / 60)}:${String(Math.floor(sortie.timeSec % 60)).padStart(2, '0')}`],
    ['Fuel left', `${Math.round(plane.fuel)}% → +${sortie.fuelBonus ?? 0}`],
    ['Time bonus', `+${sortie.timeBonus ?? 0}`],
    ['Hull remaining', `${Math.round(plane.hull)}%`],
  ];
  stats.innerHTML = rows
    .map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`)
    .join('') +
    `<div class="row total"><span>FINAL SCORE</span><b>${total}</b></div>`;
  endOverlay.classList.remove('hidden');
}

function frame(ts) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  const axes = input.read(dt);
  const events = stepFlight(plane, axes, dt, sortie.timeSec);
  stepMission(sortie, plane, events, dt);
  if (audio) {
    audio.update(plane);
    if (sortie.ringsPassed > prevRings) audio.ring();
    if (sortie.phase !== prevPhase && sortie.phase === 'LANDING') audio.drop();
    if (events.includes('touchdown')) audio.touchdown(sortie.landing && sortie.landing.damage > 20);
    if (sortie.crashed && !crashPlayed) {
      crashPlayed = true;
      audio.crash();
    }
  }
  prevRings = sortie.ringsPassed;
  prevPhase = sortie.phase;
  window.__skyHarbor = { plane, sortie };
  renderFrame(ts);
  // The report arrives when the sortie is truly over: a crash ends it
  // at once (no waiting for a wreck to stop sliding), a landing ends
  // it at the stop — and a bounce back into the air keeps it open
  // until the plane is down for good.
  const settled =
    (sortie.phase === 'DONE' || sortie.crashed) && plane.onGround && plane.speed < 0.6;
  if (sortie.crashed || settled) {
    endTimer += dt;
    if (endTimer > 0.9) {
      running = false;
      showEnd();
      return;
    }
  } else {
    endTimer = 0;
  }
  requestAnimationFrame(frame);
}

function startGame() {
  plane = createAircraft();
  sortie = createSortie();
  prevRings = 0;
  prevPhase = sortie.phase;
  endShown = false;
  endTimer = 0;
  crashPlayed = false;
  if (!input) input = createInput();
  input.setThrottle(0);
  if (!audio) audio = createAudio();
  audio.start();
  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  running = true;
  lastTs = performance.now();
  requestAnimationFrame(frame);
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('again-btn').addEventListener('click', startGame);

// Screenshot mode: fly the canonical run to the requested moment and
// hold that exact simulated frame. The end scene shows the real
// results panel the flight earned.
if (shotName) {
  startOverlay.classList.add('hidden');
  const flown = flyToScene(shotName);
  plane = flown.plane;
  sortie = flown.sortie;
  if (shotName === 'end') {
    renderFrame(1200);
    showEnd();
  } else {
    renderFrame(1200);
  }
  window.__shotReady = true;
  window.__shotState = {
    score: sortie.score,
    rings: sortie.ringsPassed,
    phase: sortie.phase,
    fuel: Math.round(plane.fuel),
    alt: Math.round(plane.alt),
    steps: flown.steps,
  };
} else {
  renderFrame(0);
}
