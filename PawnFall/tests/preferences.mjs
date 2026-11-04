import assert from 'node:assert/strict';
import { Preferences, DEFAULT_BINDINGS } from '../src/client/preferences.mjs';
import { bindCombatKeys, bindActionButtons } from '../src/client/controls.mjs';
const storage = {
  value: null,
  getItem() {
    return this.value;
  },
  setItem(key, value) {
    this.value = value;
  },
};
const prefs = new Preferences(storage);
prefs.set({
  master: 5,
  sfx: -2,
  sensitivity: 99,
  quality: 'low',
  reducedEffects: true,
  difficulty: 'veteran',
});
assert.equal(prefs.data.master, 1);
assert.equal(prefs.data.sfx, 0);
assert.equal(prefs.data.sensitivity, 2);
assert.equal(prefs.rebind('j', 'KeyZ'), '');
assert(prefs.rebind('j', 'KeyE'));
assert.equal(prefs.rebind('g', 'KeyG'), '');
assert(prefs.rebind('j', 'Escape'));
assert(prefs.rebind('j', 'KeyP'));
const restored = new Preferences(storage);
assert.equal(restored.data.bindings.j, 'KeyZ');
assert.equal(restored.data.quality, 'low');
assert(restored.data.reducedEffects);
const events = {},
  actions = [],
  keys = new Set();
bindCombatKeys(
  {
    addEventListener(n, f) {
      events[n] = f;
    },
  },
  {
    keys,
    active: () => true,
    paused: () => false,
    reading: () => false,
    action: (a) => actions.push(a),
    togglePause() {},
    bindings: () => restored.data.bindings,
  },
);
const event = (code) => ({
  code,
  key: 'ت',
  target: { tagName: 'CANVAS' },
  preventDefault() {},
  stopPropagation() {},
});
events.keydown(event('KeyZ'));
assert.deepEqual(actions, ['attack']);
events.keyup(event('KeyZ'));
assert(!keys.has('j'));
events.keydown(event('KeyJ'));
assert.deepEqual(actions, ['attack'], 'old physical binding is inactive');
events.keydown(event('KeyF'));
assert(keys.has('r'));
events.keyup(event('KeyF'));
assert(!keys.has('r'));
events.keydown(event('KeyG'));
assert.equal(actions.at(-1), 'ping');
let revive = false,
  guard = false;
const listeners = {};
const button = {
  dataset: { action: 'revive' },
  classList: { toggle() {} },
  setAttribute() {},
  setPointerCapture() {},
  addEventListener(n, f) {
    listeners[n] = f;
  },
};
const handler = bindActionButtons([button], {
  active: () => true,
  focus() {},
  action() {},
  guard: (v) => (guard = v),
  revive: (v) => (revive = v),
});
listeners.pointerdown({ ...event(''), button: 0 });
assert(revive);
assert(!guard);
listeners.pointercancel();
assert(!revive);
listeners.pointerdown({ ...event(''), button: 0 });
handler.releaseAll();
assert(!revive);
console.log(
  'PASS: persistent settings, bounded volumes/sensitivity, graphics/reduced effects, duplicate/reserved key protection, rebound non-Latin input, revive hold/release/cancellation and ping input.',
);
