// Tiny WebAudio sound set: an engine hum that follows the throttle,
// a chime for each ring, a soft thud for the parcel and a rumble for
// touchdown. No audio files — everything is oscillators, so the game
// stays fully offline. Browsers require a gesture, so start() is
// called from the Start button.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;

  function start() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    } catch {
      ctx = null;
    }
  }

  function blip(freq, dur, type = 'sine', vol = 0.16, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  return {
    start,
    update(plane) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 55 + plane.throttle * 65 + plane.speed * 0.35;
      engineGain.gain.value = plane.onGround && plane.throttle < 0.03 ? 0.004 : 0.02 + plane.throttle * 0.035;
    },
    ring() {
      blip(880, 0.18, 'sine', 0.18);
      blip(1318, 0.26, 'sine', 0.16, 0.07);
    },
    drop() {
      blip(520, 0.3, 'triangle', 0.2);
      blip(340, 0.4, 'triangle', 0.16, 0.1);
    },
    touchdown(hard) {
      blip(hard ? 90 : 130, 0.35, 'square', 0.12);
    },
    crash() {
      blip(70, 0.8, 'sawtooth', 0.24);
      blip(48, 1.0, 'square', 0.18, 0.08);
    },
  };
}
