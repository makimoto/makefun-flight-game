// Keyboard and mouse input, gathered into one axes object the
// physics understands. Axes are smoothed by the physics itself, so
// this file only tracks what is held right now.

export function createInput() {
  const keys = new Set();
  const axes = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
  let throttleLevel = 0; // W/S (and ↑/↓ on the slider keys) set a level

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  // Mouse: hold on the left/right half of the sky to bank, move up or
  // down to pitch, wheel for throttle — so the game plays mouse-only.
  let mouse = null;
  window.addEventListener('pointermove', (e) => {
    mouse = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
  });
  window.addEventListener('wheel', (e) => {
    throttleLevel = Math.max(0, Math.min(1, throttleLevel - Math.sign(e.deltaY) * 0.08));
  }, { passive: true });

  function read(dt) {
    if (keys.has('KeyW')) throttleLevel = Math.min(1, throttleLevel + dt * 0.7);
    if (keys.has('KeyS')) throttleLevel = Math.max(0, throttleLevel - dt * 0.7);
    axes.throttle = throttleLevel;
    axes.pitch =
      (keys.has('ArrowDown') || keys.has('KeyI') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyK') ? 1 : 0);
    axes.roll = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    axes.yaw = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
    // Mouse steering fills only the axes the keyboard is not using,
    // per axis — holding W for throttle must not kill mouse pitch.
    if (mouse) {
      if (axes.roll === 0) axes.roll = Math.max(-1, Math.min(1, (mouse.x - 0.5) * 2.4));
      if (axes.pitch === 0) axes.pitch = Math.max(-1, Math.min(1, (0.52 - mouse.y) * 2.2));
    }
    return axes;
  }

  return {
    read,
    setThrottle(v) {
      throttleLevel = Math.max(0, Math.min(1, v));
    },
    get throttleLevel() {
      return throttleLevel;
    },
    destroy() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    },
  };
}
