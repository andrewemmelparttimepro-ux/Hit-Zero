// Touch joystick (iPad-first) + WASD/arrow keys for desktop.
// Touch anywhere on the left 60% of the screen to summon the stick.
// .vector is a normalized {x, y} in screen space (renderer maps it 1:1).

const RADIUS = 52; // max knob travel px

export function createJoystick() {
  const el = document.createElement('div');
  el.className = 'arc-joy';
  const knob = document.createElement('div');
  knob.className = 'arc-joy-knob';
  el.appendChild(knob);
  document.body.appendChild(el);

  const state = { vector: { x: 0, y: 0 }, active: false };
  let pointerId = null;
  let origin = null;

  function setKnob(dx, dy) {
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  window.addEventListener('pointerdown', (e) => {
    // ignore taps on HUD buttons/panels and the right action cluster
    if (e.target.closest('button, .arc-actions, .arc-wheel, .arc-style-panel, .arc-hud-tr, .arc-game')) return;
    if (pointerId !== null) return;
    if (e.clientX > window.innerWidth * 0.62) return;
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    el.style.left = (origin.x - 66) + 'px';
    el.style.top = (origin.y - 66) + 'px';
    el.classList.add('on');
    state.active = true;
    setKnob(0, 0);
  }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId || !origin) return;
    let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx = dx / d * RADIUS; dy = dy / d * RADIUS; }
    setKnob(dx, dy);
    // dead zone then linear
    const dead = 8;
    if (d < dead) { state.vector.x = 0; state.vector.y = 0; return; }
    state.vector.x = dx / RADIUS;
    state.vector.y = dy / RADIUS;
  }, { passive: true });

  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null; origin = null;
    el.classList.remove('on');
    state.active = false;
    state.vector.x = 0; state.vector.y = 0;
  }
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });

  // ── keyboard (desktop) ──
  const keys = new Set();
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  function syncKeys() {
    if (pointerId !== null) return; // touch wins
    let x = 0, y = 0;
    if (keys.has('up')) y -= 1;
    if (keys.has('down')) y += 1;
    if (keys.has('left')) x -= 1;
    if (keys.has('right')) x += 1;
    const d = Math.hypot(x, y) || 1;
    state.vector.x = x / d;
    state.vector.y = y / d;
  }
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); syncKeys(); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) { keys.delete(k); syncKeys(); }
  });
  window.addEventListener('blur', () => { keys.clear(); syncKeys(); });

  return state;
}
