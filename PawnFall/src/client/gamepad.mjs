export function readGamepads(nav = globalThis.navigator) {
  try {
    return nav?.getGamepads?.() || [];
  } catch {
    return [];
  }
}
const axis = (x, y) => {
  const n = Math.hypot(x || 0, y || 0);
  if (n < 0.18) return { x: 0, y: 0 };
  const k = Math.min(1, (n - 0.18) / 0.82) / n;
  return { x: x * k, y: y * k };
};

export class GamepadInput {
  constructor() {
    this.previous = [];
    this.id = null;
    this.menuAt = 0;
  }

  sample(pads, now, menu = false) {
    const pad = [...(pads || [])].find((p) => p?.connected && p.mapping === 'standard');
    if (!pad) {
      this.id = null;
      this.previous = [];
      return { connected: false, move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: [] };
    }
    const held = pad.buttons.map((b) => !!b.pressed || b.value > 0.55);
    const fresh = this.id !== pad.index;
    this.id = pad.index;
    const press = (i) => !fresh && held[i] && !this.previous[i];
    const move = axis(pad.axes[0], pad.axes[1]),
      look = axis(pad.axes[2], pad.axes[3]);
    const actions = [];
    for (const [i, kind] of [
      [5, 'attack'],
      [7, 'heavy'],
      [2, 'heal'],
      [3, 'ultimate'],
      [1, 'dodge'],
      [10, 'sprint'],
      [11, 'lock'],
      [6, 'lock'],
      [12, 'ping'],
    ])
      if (press(i)) actions.push(kind);
    let nav = 0;
    if (menu && now >= this.menuAt) {
      nav =
        held[13] || move.y > 0.55
          ? 1
          : held[12] || move.y < -0.55
            ? -1
            : held[15] || move.x > 0.55
              ? 1
              : held[14] || move.x < -0.55
                ? -1
                : 0;
      if (nav) this.menuAt = now + 180;
    }
    const horizontal = !!held[14] || !!held[15] || Math.abs(move.x) > 0.55;
    const result = {
      horizontal,
      connected: true,
      name: pad.id,
      move,
      look,
      actions,
      guard: !!held[4],
      revive: !!held[0],
      sprint: !!held[10],
      pause: press(9),
      confirm: press(0),
      cancel: press(1),
      nav,
    };
    this.previous = held;
    return result;
  }
}

export function navigateGamepad(doc, view, input, dropdowns) {
  if (!input.connected || !(input.nav || input.confirm || input.cancel)) return;
  const open = dropdowns?.controls.find((c) => c.trigger.getAttribute('aria-expanded') === 'true');
  if (open && (input.nav || input.confirm || input.cancel)) {
    const key = input.cancel
      ? 'Escape'
      : input.confirm
        ? 'Enter'
        : input.nav > 0
          ? 'ArrowDown'
          : 'ArrowUp';
    view.dispatchEvent(new view.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    return true;
  }
  const surface =
    doc.querySelector('dialog[open]') ||
    doc.querySelector('#upgradePanel:not([hidden])') ||
    doc.querySelector('#overlay:not(.hidden)');
  if (!surface) return;
  const items = [
    ...surface.querySelectorAll(
      'summary,button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),a[href]',
    ),
  ].filter((el) => !el.hidden && el.getClientRects().length);
  if (!items.length) return;
  if (input.nav && input.horizontal && doc.activeElement?.type === 'range') {
    const el = doc.activeElement;
    el.value = String(
      Math.max(
        Number(el.min),
        Math.min(Number(el.max), Number(el.value) + input.nav * Number(el.step || 0.05)),
      ),
    );
    el.dispatchEvent(new view.Event('input', { bubbles: true }));
    return;
  }
  if (input.nav) {
    const current = items.indexOf(doc.activeElement);
    items[(current + input.nav + items.length) % items.length].focus();
  }
  if (input.confirm) {
    const active = doc.activeElement;
    if (items.includes(active)) {
      if (active.tagName === 'INPUT' && active.type === 'range') return;
      active.click();
    } else items[0].focus();
  }
}
