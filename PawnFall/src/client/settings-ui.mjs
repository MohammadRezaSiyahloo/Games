import { DEFAULT_BINDINGS, BINDING_LABELS, keyLabel } from './preferences.mjs';
import { difficultyById } from '../shared/combat-rules.mjs';

export function bindSettings(prefs, $, changed) {
  let listening = null,
    mouseBindingEvent = null;
  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      listening = null;
    }),
  );
  const paint = () => {
    $('#keyBindings').innerHTML = Object.entries(BINDING_LABELS)
      .map(
        ([token, label]) =>
          `<button type="button" data-binding="${token}" class="${listening === token ? 'listening' : ''}"><span>${label}</span><kbd>${listening === token ? 'PRESS KEY' : keyLabel(prefs.data.bindings[token])}</kbd></button>`,
      )
      .join('');
    document.querySelectorAll('[data-binding]').forEach(
      (b) =>
        (b.onclick = () => {
          listening = b.dataset.binding;
          $('#bindingNotice').textContent = 'Press a key or mouse button. Escape cancels.';
          paint();
        }),
    );
    document.querySelectorAll('[data-action]').forEach((b) => {
      const token = {
        attack: 'j',
        heavy: 'h',
        guard: 'k',
        dodge: ' ',
        ultimate: 'q',
        heal: 'f',
        lock: 'e',
        revive: 'r',
        ping: 'g',
      }[b.dataset.action];
      if (token && b.querySelector('kbd'))
        b.querySelector('kbd').textContent = keyLabel(prefs.data.bindings[token]);
    });
    $('.controlList').innerHTML =
      Object.entries(BINDING_LABELS)
        .map(
          ([token, label]) =>
            `<div><kbd>${keyLabel(prefs.data.bindings[token])}</kbd><span>${label}</span></div>`,
        )
        .join('') +
      '<div><kbd>MMB DRAG / SCROLL</kbd><span>Orbit / camera distance</span></div><div><kbd>P / ESC</kbd><span>Pause (solo)</span></div>';
    $('#difficultyHint').textContent = difficultyById(prefs.data.difficulty).hint;
  };
  for (const key of ['master', 'sfx', 'ambience', 'sensitivity', 'quality', 'reducedEffects']) {
    const el = $('#setting-' + key);
    if (key === 'reducedEffects') el.checked = prefs.data[key];
    else el.value = prefs.data[key];
    el.oninput = () => {
      prefs.set({
        ...(key === 'quality' ? { qualityMode: 'manual' } : {}),
        [key]:
          key === 'reducedEffects' ? el.checked : key === 'quality' ? el.value : Number(el.value),
      });
      changed();
    };
  }
  $('#soloDifficulty').value = prefs.data.difficulty;
  $('#coopDifficulty').value = prefs.data.difficulty;
  $('#soloDifficulty').onchange = (e) => {
    prefs.set({ difficulty: e.target.value });
    paint();
  };
  $('#resetBindings').onclick = () => {
    listening = null;
    prefs.set({ bindings: { ...DEFAULT_BINDINGS } });
    $('#bindingNotice').textContent = 'Default controls restored.';
    changed();
    paint();
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (listening === null) return;
      e.preventDefault();
      e.stopImmediatePropagation?.();
      e.stopPropagation();
      if (e.code === 'Escape') {
        listening = null;
        $('#bindingNotice').textContent = 'Binding cancelled.';
        paint();
        return;
      }
      if (e.repeat || e.isComposing) return;
      const error = prefs.rebind(listening, e.code);
      $('#bindingNotice').textContent = error || 'Binding saved.';
      if (!error) {
        listening = null;
        changed();
      }
      paint();
    },
    true,
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (listening === null) {
        mouseBindingEvent = null;
        return;
      }
      if (e.target?.closest?.('[data-ui-nav],[data-tab]')) {
        listening = null;
        mouseBindingEvent = null;
        paint();
        return;
      }
      mouseBindingEvent = { button: e.button, at: performance.now() };
      e.preventDefault();
      e.stopImmediatePropagation?.();
      e.stopPropagation();
      const error = prefs.rebind(listening, 'Mouse' + e.button);
      $('#bindingNotice').textContent = error || 'Mouse binding saved.';
      if (!error) {
        listening = null;
        changed();
      }
      paint();
    },
    true,
  );
  for (const name of ['click', 'contextmenu', 'auxclick'])
    window.addEventListener(
      name,
      (e) => {
        if (
          mouseBindingEvent &&
          e.button === mouseBindingEvent.button &&
          performance.now() - mouseBindingEvent.at < 500
        ) {
          e.preventDefault();
          e.stopImmediatePropagation?.();
          e.stopPropagation();
          mouseBindingEvent = null;
        }
      },
      true,
    );
  paint();
  changed();
  return {
    get listening() {
      return listening !== null;
    },
    cancel() {
      if (listening === null) return false;
      listening = null;
      mouseBindingEvent = null;
      $('#bindingNotice').textContent = 'Binding cancelled.';
      paint();
      return true;
    },
  };
}
