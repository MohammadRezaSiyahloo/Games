import { DEFAULT_BINDINGS } from './preferences.mjs';
// Browser input routing. Physical key codes keep controls stable across keyboard layouts.
const codes = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  KeyJ: 'j',
  KeyH: 'h',
  KeyQ: 'q',
  KeyK: 'k',
  KeyE: 'e',
  KeyF: 'f',
  KeyP: 'p',
  KeyR: 'r',
  KeyG: 'g',
  Space: ' ',
  Escape: 'Escape',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
};
const handled = new Set(Object.values(codes));

function keyName(e, bindings = DEFAULT_BINDINGS) {
  const custom = Object.entries(bindings).find(([, code]) => code === e.code);
  if (custom) return custom[0];
  if (e.code === 'ShiftRight' && bindings.Shift === 'ShiftLeft') return 'Shift';
  if (['Escape', 'KeyP', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    return codes[e.code];
  return null;
}
export const KEY_ACTIONS = {
  q: 'ultimate',
  j: 'attack',
  h: 'heavy',
  ' ': 'dodge',
  f: 'heal',
  e: 'lock',
  g: 'ping',
};

export function bindCombatKeys(
  target,
  { keys, active, paused, reading, action, togglePause, bindings = () => DEFAULT_BINDINGS },
) {
  const down = (e) => {
    if (reading() || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable)
      return;
    const k = keyName(e, bindings());
    if (!handled.has(k) || (!active() && !(paused() && (k === 'Escape' || k === 'p')))) return;
    // Preserve native activation of focused buttons, including upgrade choices.
    if (e.target?.tagName === 'BUTTON' && k === ' ') return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape' || k === 'p') {
      if (!e.repeat) togglePause();
      return;
    }
    keys.add(k);
    if (e.repeat) return;
    const name = KEY_ACTIONS[k];
    if (name) action(name);
  };
  const up = (e) => {
    const k = keyName(e, bindings());
    const held = keys.delete(k);
    if (held && active() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  target.addEventListener('keydown', down, true);
  target.addEventListener('keyup', up, true);
  return { down, up };
}

export function bindActionButtons(buttons, { active, focus, action, guard, revive = () => {} }) {
  const held = new Set(),
    heldRevives = new Set();
  const setGuard = () => guard(held.size > 0);
  const paint = (b, on) => {
    b.classList.toggle('pressed', on);
    if (['guard', 'revive'].includes(b.dataset.action)) b.setAttribute('aria-pressed', String(on));
  };

  function release(b) {
    held.delete(b);
    heldRevives.delete(b);
    revive(heldRevives.size > 0);
    paint(b, false);
    setGuard();
  }
  for (const b of buttons) {
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (!active()) return;
      focus();
      b.setPointerCapture(e.pointerId);
      paint(b, true);
      if (b.dataset.action === 'guard') {
        held.add(b);
        setGuard();
      } else if (b.dataset.action === 'revive') {
        heldRevives.add(b);
        revive(true);
      } else action(b.dataset.action);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      b.addEventListener(name, () => release(b));
    // Keyboard and assistive activation produce detail=0; pointer clicks already ran above.
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.detail !== 0 || !active()) return;
      if (b.dataset.action === 'guard') {
        if (held.has(b)) held.delete(b);
        else held.add(b);
        paint(b, held.has(b));
        setGuard();
      } else if (b.dataset.action === 'revive') {
        if (heldRevives.has(b)) heldRevives.delete(b);
        else heldRevives.add(b);
        revive(heldRevives.size > 0);
        paint(b, heldRevives.has(b));
      } else action(b.dataset.action);
    });
  }
  return {
    releaseAll() {
      held.clear();
      heldRevives.clear();
      revive(false);
      for (const b of buttons) paint(b, false);
      setGuard();
    },
  };
}
