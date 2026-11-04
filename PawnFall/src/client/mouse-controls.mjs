import { bindTouchCamera } from './touch-camera.mjs';
import { DEFAULT_BINDINGS } from './preferences.mjs';
import { KEY_ACTIONS } from './controls.mjs';

export function bindMouseControls(
  surface,
  { keys, active, focus, action, orbit, zoom, bindings = () => DEFAULT_BINDINGS },
) {
  const touch = bindTouchCamera(surface, { active, focus, orbit, zoom });
  const held = new Map();
  let drag = null;
  const suppress = (e) => {
    e.preventDefault();
    e.stopPropagation?.();
  };
  const release = (button) => {
    const token = held.get(button);
    if (token) keys.delete(token);
    held.delete(button);
  };
  const clear = () => {
    for (const button of held.keys()) release(button);
    drag = null;
    touch.clear();
  };
  surface.addEventListener('contextmenu', (e) => {
    if (active()) suppress(e);
  });
  surface.addEventListener('auxclick', (e) => {
    if (active()) suppress(e);
  });
  const down = (e) => {
    if (touch.down(e)) return;
    if (!e.pointerType && touch.recentlyTouched) return;
    if (!active() || ![0, 1, 2, 3, 4].includes(e.button)) return;
    if (held.has(e.button) || (drag && drag.button === e.button)) return;
    suppress(e);
    focus();
    if (Number.isInteger(e.pointerId)) surface.setPointerCapture(e.pointerId);
    const token = Object.entries(bindings()).find(([, code]) => code === 'Mouse' + e.button)?.[0];
    if (e.button === 1 || e.pointerType === 'touch') {
      if (e.pointerType !== 'touch' && token && !KEY_ACTIONS[token]) {
        held.set(e.button, token);
        keys.add(token);
      }
      drag = {
        id: e.pointerId,
        button: e.button,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        token: e.pointerType === 'touch' ? null : token,
      };
      return;
    }
    if (!token) return;
    held.set(e.button, token);
    keys.add(token);
    if (KEY_ACTIONS[token]) action(KEY_ACTIONS[token]);
  };
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('mousedown', down);
  surface.addEventListener('pointermove', (e) => {
    touch.move(e);
    if (!drag || drag.id !== e.pointerId || !active()) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 3 || drag.moved) {
      drag.moved = true;
      orbit(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
  });
  const up = (e) => {
    if (touch.up(e)) return;
    if (held.has(e.button)) suppress(e);
    release(e.button);
    if (
      drag &&
      (e.pointerId === undefined || drag.id === e.pointerId) &&
      drag.button === e.button
    ) {
      const click = drag;
      drag = null;
      suppress(e);
      if (!click.moved && active() && KEY_ACTIONS[click.token]) action(KEY_ACTIONS[click.token]);
    }
  };
  surface.addEventListener('pointerup', up);
  surface.addEventListener('mouseup', up);
  surface.ownerDocument?.defaultView?.addEventListener('mouseup', up);
  surface.addEventListener('pointercancel', clear);
  surface.addEventListener('lostpointercapture', (e) => {
    if (e?.pointerType !== 'touch') clear();
  });
  return { releaseAll: clear };
}
