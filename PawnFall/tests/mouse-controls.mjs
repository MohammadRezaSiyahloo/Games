import assert from 'node:assert/strict';
import { bindMouseControls } from '../src/client/mouse-controls.mjs';
import { bindCombatKeys } from '../src/client/controls.mjs';
import {
  Preferences,
  DEFAULT_BINDINGS,
  LEGACY_BINDINGS,
  keyLabel,
} from '../src/client/preferences.mjs';
const events = {},
  keys = new Set(),
  actions = [],
  camera = [];
let active = true;
const surface = {
  addEventListener(n, f) {
    events[n] = f;
  },
  setPointerCapture() {},
};
const mouse = bindMouseControls(surface, {
  keys,
  active: () => active,
  focus() {},
  action: (k) => actions.push(k),
  orbit: (x, y) => camera.push([x, y]),
});
const fire = (type, button = 0, extra = {}) => {
  const e = {
    button,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    preventDefault() {
      this.prevented = true;
    },
    stopPropagation() {},
    ...extra,
  };
  events[type](e);
  return e;
};
fire('pointerdown');
assert.deepEqual(actions, ['attack'], 'left mouse attacks immediately');
fire('mousedown', 0, { pointerId: undefined });
assert.equal(actions.length, 1, 'compatibility mouse event does not double attack');
fire('mousedown', 2, { pointerId: undefined });
assert(keys.has('k'), 'right guard can be held while left mouse is down');
fire('mouseup', 0, { pointerId: undefined });
assert(keys.has('k'), 'releasing attack does not release guard');
fire('pointerup', 2);
assert(!keys.has('k'));
fire('pointerdown', 1);
fire('pointerup', 1);
assert.equal(actions.at(-1), 'lock');
const locks = actions.length;
fire('pointerdown', 1);
fire('pointermove', 1, { clientX: 20, clientY: 8 });
fire('pointerup', 1, { clientX: 20, clientY: 8 });
assert.equal(actions.length, locks, 'camera drag does not trigger lock');
assert.deepEqual(camera.at(-1), [20, 8]);
fire('pointerdown', 3);
assert.equal(actions.at(-1), 'ping');
assert(fire('auxclick', 3).prevented);
fire('pointerup', 3);
fire('pointerdown', 2);
events.lostpointercapture();
assert(!keys.has('k'));
fire('pointerdown', 2);
mouse.releaseAll();
assert(!keys.has('k'));
active = false;
const before = actions.length;
fire('pointerdown');
assert.equal(actions.length, before, 'menus do not trigger combat');
active = true;
fire('pointerdown', 0, { pointerType: 'touch' });
fire('pointermove', 0, { pointerType: 'touch', clientX: 10 });
fire('pointerup', 0, { pointerType: 'touch', clientX: 10 });
assert.equal(actions.length, before, 'touch camera gestures do not attack');
const keyboard = {},
  pressed = [];
bindCombatKeys(
  {
    addEventListener(n, f) {
      keyboard[n] = f;
    },
  },
  {
    keys: new Set(),
    active: () => true,
    paused: () => false,
    reading: () => false,
    action: (a) => pressed.push(a),
    togglePause() {},
  },
);
for (const code of ['KeyQ', 'KeyE', 'KeyR', 'KeyF'])
  keyboard.keydown({
    code,
    key: 'ت',
    target: { tagName: 'CANVAS' },
    preventDefault() {},
    stopPropagation() {},
  });
assert.deepEqual(
  pressed,
  ['ultimate', 'heavy', 'heal'],
  'Q/E/R use physical keys and F is held revive',
);
for (const code of ['KeyJ', 'KeyK', 'KeyH'])
  keyboard.keydown({
    code,
    key: 'j',
    target: { tagName: 'CANVAS' },
    preventDefault() {
      throw Error('legacy key should not be intercepted');
    },
    stopPropagation() {},
  });
assert.deepEqual(pressed, ['ultimate', 'heavy', 'heal']);
const old = new Preferences({
  getItem() {
    return JSON.stringify({ bindings: LEGACY_BINDINGS });
  },
  setItem() {},
});
assert.deepEqual(old.data.bindings, DEFAULT_BINDINGS, 'old untouched defaults migrate');
const custom = new Preferences({
  getItem() {
    return JSON.stringify({ bindings: { ...LEGACY_BINDINGS, j: 'KeyZ' } });
  },
  setItem() {},
});
assert.equal(custom.data.bindings.j, 'KeyZ');
assert.equal(custom.data.bindings.k, 'KeyK', 'custom layouts are retained');
assert.equal(custom.rebind('j', 'Mouse4'), '');
assert.equal(custom.data.bindings.j, 'Mouse4');
assert.equal(keyLabel('Mouse0'), 'LMB');
console.log(
  'PASS: immediate mouse attack, simultaneous guard, compatibility-event deduplication, middle click/drag separation, side-button ping, cancellation, touch gestures, Q/E/R/F defaults, removed J/K/H aliases, migration and mouse rebinding.',
);

const middleEvents = {},
  middleKeys = new Set();
bindMouseControls(
  {
    addEventListener(n, f) {
      middleEvents[n] = f;
    },
    setPointerCapture() {},
  },
  {
    keys: middleKeys,
    active: () => true,
    focus() {},
    action() {},
    orbit() {},
    bindings: () => ({ ...DEFAULT_BINDINGS, k: 'Mouse1', e: 'Mouse2' }),
  },
);
middleEvents.pointerdown({
  button: 1,
  pointerId: 1,
  clientX: 0,
  clientY: 0,
  preventDefault() {},
  stopPropagation() {},
});
assert(middleKeys.has('k'), 'rebound middle mouse supports held actions');
middleEvents.pointerup({ button: 1, pointerId: 1, preventDefault() {}, stopPropagation() {} });
assert(!middleKeys.has('k'));
