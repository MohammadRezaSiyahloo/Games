export const TOUCH_IDS = [
  'move',
  'lock',
  'heal',
  'ultimate',
  'heavy',
  'guard',
  'dodge',
  'revive',
  'attack',
  'ping',
];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function cleanTouchLayouts(value) {
  const out = {};
  for (const orientation of ['landscape', 'portrait']) {
    const layout = value?.[orientation];
    if (!layout || typeof layout !== 'object') continue;
    out[orientation] = {};
    for (const id of TOUCH_IDS) {
      const p = layout[id];
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y))
        out[orientation][id] = { x: clamp(p.x, 0.03, 0.97), y: clamp(p.y, 0.25, 0.95) };
    }
  }
  return out;
}

export function defaultTouchLayout(orientation) {
  const portrait = orientation === 'portrait',
    xs = portrait ? [0.55, 0.73, 0.91] : [0.7, 0.82, 0.94],
    ys = portrait ? [0.67, 0.78, 0.89] : [0.45, 0.64, 0.83],
    out = { move: { x: portrait ? 0.17 : 0.13, y: 0.8 } };
  TOUCH_IDS.slice(1).forEach((id, i) => (out[id] = { x: xs[i % 3], y: ys[Math.floor(i / 3)] }));
  return out;
}

export function mobileActive(p, { width, coarse = false }) {
  return p.touchMode === 'on' || (p.touchMode !== 'off' && (coarse || width < 700));
}

export function resolveTouchLayout(p, width, height) {
  const orientation = width > height ? 'landscape' : 'portrait',
    saved = cleanTouchLayouts(p.touchLayouts)[orientation] || {},
    out = {};
  const size = Math.max(
      48,
      Math.min(76, 56 * (p.touchScale || 1), (width - 32) / 5.2, (height - 86) / 3.4),
    ),
    attackSize = Math.max(54, size * 1.12),
    pitch = attackSize + 6;
  const defaultPoint = (id) => {
    if (id === 'move')
      return { x: width * (orientation === 'portrait' ? 0.17 : 0.13), y: height * 0.8 };
    const i = TOUCH_IDS.indexOf(id) - 1;
    return {
      x: width - 12 - attackSize / 2 - (2 - (i % 3)) * pitch,
      y: height - 12 - attackSize / 2 - (2 - Math.floor(i / 3)) * pitch,
    };
  };
  const placed = [];
  for (const id of TOUCH_IDS) {
    const side =
        id === 'move'
          ? Math.max(84, Math.min(130, 110 * (p.touchScale || 1), width * 0.28, height - 100))
          : id === 'attack'
            ? attackSize
            : size,
      half = side / 2;
    const bound = (a) => ({
      x: clamp(a.x, half + 12, width - half - 12),
      y: clamp(a.y, Math.min(74 + half, height - half - 12), height - half - 12),
      size: side,
    });
    const mirror = (a) => ({ x: p.touchLeftHanded ? width - a.x : a.x, y: a.y });
    const fallback = bound(mirror(defaultPoint(id))),
      raw = saved[id] ? { x: saved[id].x * width, y: saved[id].y * height } : defaultPoint(id);
    let a = bound(mirror(raw));
    const free = (v) =>
      placed.every((b) => Math.hypot(v.x - b.x, v.y - b.y) >= (v.size + b.size) * 0.48);
    if (!free(a)) {
      a = fallback;
      if (!free(a)) {
        let found = null;
        for (let y = height - half - 12; y >= 74 + half && !found; y -= side + 6)
          for (let x = width - half - 12; x >= half + 12; x -= side + 6) {
            const candidate = bound({ x, y });
            if (free(candidate)) {
              found = candidate;
              break;
            }
          }
        if (found) a = found;
      }
    }
    out[id] = a;
    placed.push(a);
  }
  return out;
}

export function bindMobileControls(prefs, $, view, doc, viewport, release = () => {}) {
  let drag = null,
    editor = 'landscape',
    last = '',
    active = false;
  const label = {
    move: 'MOVE',
    lock: 'LOCK',
    heal: 'HEAL',
    ultimate: 'ABILITY',
    heavy: 'HEAVY',
    guard: 'GUARD',
    dodge: 'ROLL',
    revive: 'HOLD USE',
    attack: 'ATTACK',
    ping: 'PING',
  };
  const element = (id) =>
    id === 'move'
      ? $('#joystick')
      : id === 'revive'
        ? $('#mobileRevive')
        : id === 'ping'
          ? $('#mobilePing')
          : doc.querySelector('#touch [data-action="' + id + '"]');

  function renderPreview() {
    const w = editor === 'landscape' ? 840 : 390,
      h = editor === 'landscape' ? 390 : 780,
      layout = resolveTouchLayout(prefs.data, w, h);
    $('#mobilePreview').style.aspectRatio = w + '/' + h;
    $('#mobilePreview').style.maxWidth = editor === 'portrait' ? '290px' : '700px';
    $('#mobilePreview').style.maxHeight = 'none';
    $('#mobilePreview').innerHTML = TOUCH_IDS.map(
      (id) =>
        `<button type="button" data-mobile-control="${id}" aria-label="Drag ${label[id]} control" style="left:${(layout[id].x / w) * 100}%;top:${(layout[id].y / h) * 100}%">${label[id]}</button>`,
    ).join('');
    doc.querySelectorAll('[data-mobile-control]').forEach((b) => {
      b.onpointerdown = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        drag = { id: b.dataset.mobileControl, previous: prefs.data.touchLayouts };
        b.focus?.();
        b.setPointerCapture?.(e.pointerId);
      };
      b.onpointermove = (e) => {
        if (!drag || drag.id !== b.dataset.mobileControl) return;
        e.preventDefault();
        const r = $('#mobilePreview').getBoundingClientRect(),
          x = clamp((e.clientX - r.left) / r.width, 0.03, 0.97),
          y = clamp((e.clientY - r.top) / r.height, 0.25, 0.95);
        b.style.left = x * 100 + '%';
        b.style.top = y * 100 + '%';
        drag.point = { x: prefs.data.touchLeftHanded ? 1 - x : x, y };
      };
      b.onpointerup = () => {
        if (!drag) return;
        if (drag.point)
          prefs.set({
            touchLayouts: {
              ...prefs.data.touchLayouts,
              [editor]: { ...(prefs.data.touchLayouts?.[editor] || {}), [drag.id]: drag.point },
            },
          });
        drag = null;
        renderPreview();
        apply(true);
        $('#mobileLayoutNotice').textContent = 'Layout saved for ' + editor + '.';
      };
      b.onkeydown = (e) => {
        const d = {
          ArrowLeft: [-0.02, 0],
          ArrowRight: [0.02, 0],
          ArrowUp: [0, -0.02],
          ArrowDown: [0, 0.02],
        }[e.key];
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        const id = b.dataset.mobileControl,
          x = clamp(layout[id].x / w + d[0], 0.03, 0.97),
          y = clamp(layout[id].y / h + d[1], 0.25, 0.95);
        prefs.set({
          touchLayouts: {
            ...prefs.data.touchLayouts,
            [editor]: {
              ...(prefs.data.touchLayouts?.[editor] || {}),
              [id]: { x: prefs.data.touchLeftHanded ? 1 - x : x, y },
            },
          },
        });
        renderPreview();
        apply(true);
        doc.querySelector('[data-mobile-control="' + id + '"]')?.focus?.();
        $('#mobileLayoutNotice').textContent = 'Layout saved. Arrow keys move the focused control.';
      };
      b.onpointercancel = () => {
        drag = null;
        renderPreview();
      };
    });
  }

  function apply(force = false) {
    const v = viewport(),
      key = JSON.stringify([
        prefs.data.touchMode,
        prefs.data.touchLayouts,
        prefs.data.touchScale,
        prefs.data.touchOpacity,
        prefs.data.touchLeftHanded,
        v.width,
        v.height,
        v.coarse,
      ]);
    active = mobileActive(prefs.data, v);
    doc.body.classList.toggle('mobile-controls', active);
    if (!force && key === last) return;
    last = key;
    if (last && force) release();
    const safe = view.getComputedStyle?.($('#touch'));
    const inset = {
      left: parseFloat(safe?.paddingLeft) || 0,
      right: parseFloat(safe?.paddingRight) || 0,
      top: parseFloat(safe?.paddingTop) || 0,
      bottom: parseFloat(safe?.paddingBottom) || 0,
    };
    const layout = resolveTouchLayout(
      prefs.data,
      Math.max(240, v.width - inset.left - inset.right),
      Math.max(240, v.height - inset.top - inset.bottom),
    );
    for (const id of TOUCH_IDS) {
      const el = element(id);
      if (!el) continue;
      const a = layout[id];
      Object.assign(el.style, {
        left: a.x + inset.left + 'px',
        top: a.y + inset.top + 'px',
        right: 'auto',
        bottom: 'auto',
        width: a.size + 'px',
        height: a.size + 'px',
        opacity: String(prefs.data.touchOpacity),
      });
    }
  }
  for (const id of ['touchScale', 'touchOpacity']) {
    $('#' + id).value = prefs.data[id];
    $('#' + id).oninput = () => {
      prefs.set({ [id]: Number($('#' + id).value) });
      apply(true);
      renderPreview();
    };
  }
  for (const id of ['touchLeftHanded', 'touchLockAssist', 'mobilePerformance']) {
    $('#' + id).checked = prefs.data[id];
    $('#' + id).onchange = () => {
      prefs.set({ [id]: $('#' + id).checked });
      apply(true);
      renderPreview();
    };
  }
  $('#touchMode').value = prefs.data.touchMode;
  $('#touchMode').onchange = () => {
    prefs.set({ touchMode: $('#touchMode').value });
    apply(true);
  };
  $('#mobilePreviewOrientation').onchange = () => {
    drag = null;
    editor = $('#mobilePreviewOrientation').value === 'portrait' ? 'portrait' : 'landscape';
    renderPreview();
  };
  $('#resetMobileLayout').onclick = () => {
    drag = null;
    prefs.set({ touchLayouts: {}, touchScale: 1, touchOpacity: 0.85, touchLeftHanded: false });
    $('#touchScale').value = 1;
    $('#touchOpacity').value = 0.85;
    $('#touchLeftHanded').checked = false;
    renderPreview();
    apply(true);
    $('#mobileLayoutNotice').textContent = 'Default touch layout restored.';
  };
  view.addEventListener('resize', () => {
    drag = null;
    apply(true);
    renderPreview();
  });
  renderPreview();
  apply();
  return {
    get active() {
      return active;
    },
    apply,
    cancel() {
      if (!drag) return;
      drag = null;
      renderPreview();
    },
    update({ coop = false, ritual = false } = {}) {
      apply();
      $('#mobileRevive').hidden = !coop && !ritual;
      $('#mobilePing').hidden = !coop;
      $('#mobileRevive').textContent = ritual ? 'HOLD USE' : 'REVIVE';
    },
  };
}
