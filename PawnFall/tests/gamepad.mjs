import assert from 'node:assert/strict';
import { GamepadInput, navigateGamepad, readGamepads } from '../src/client/gamepad.mjs';
const pad = {
  index: 0,
  id: 'Test controller',
  mapping: 'standard',
  connected: true,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
};
const input = new GamepadInput();
assert(input.sample([pad], 0).connected);
pad.buttons[7].pressed = true;
assert.deepEqual(input.sample([pad], 16).actions, ['heavy']);
assert.deepEqual(input.sample([pad], 32).actions, [], 'held triggers do not repeat attacks');
pad.buttons[7].pressed = false;
pad.axes = [0.05, 0.04, 0, 0];
assert.equal(input.sample([pad], 48).move.x, 0);
pad.axes = [1, 0, -1, 0];
const move = input.sample([pad], 64);
assert.equal(move.move.x, 1);
assert.equal(move.look.x, -1);
pad.buttons[4].pressed = true;
pad.buttons[0].pressed = true;
const held = input.sample([pad], 80);
assert(held.guard && held.revive);
assert(held.confirm);
assert(!input.sample([], 96).connected);
assert(!input.sample([pad], 112).confirm, 'reconnection does not invent button presses');
pad.axes = [0, 1, 0, 0];
assert.equal(input.sample([pad], 1000, true).nav, 1);
assert.equal(input.sample([pad], 1016, true).nav, 0);
assert.equal(input.sample([pad], 1200, true).nav, 1);
const doc = {
  activeElement: null,
  querySelector() {
    return surface;
  },
};
let clicks = 0,
  changes = 0;
const button = {
  tagName: 'BUTTON',
  hidden: false,
  getClientRects() {
    return [1];
  },
  focus() {
    doc.activeElement = this;
  },
  click() {
    clicks++;
  },
};
const slider = {
  tagName: 'INPUT',
  type: 'range',
  hidden: false,
  min: 0,
  max: 1,
  step: 0.1,
  value: '.5',
  getClientRects() {
    return [1];
  },
  focus() {
    doc.activeElement = this;
  },
  dispatchEvent() {
    changes++;
  },
};
const surface = {
  querySelectorAll() {
    return [button, slider];
  },
};
const view = { Event: class {} };
navigateGamepad(doc, view, { connected: true, nav: 1 });
assert.equal(doc.activeElement, button);
navigateGamepad(doc, view, { connected: true, confirm: true });
assert.equal(clicks, 1);
navigateGamepad(doc, view, { connected: true, nav: 1 });
assert.equal(doc.activeElement, slider);
navigateGamepad(doc, view, { connected: true, nav: 1, horizontal: true });
assert.equal(Number(slider.value), 0.6);
assert.equal(changes, 1);
console.log(
  'PASS: standard gamepad combat edges, dead zones, camera/movement axes, guard/revive holds, reconnect safety, menu repeat timing, button activation and slider adjustment.',
);

assert.deepEqual(
  readGamepads({
    getGamepads() {
      throw Error('Permissions policy');
    },
  }),
  [],
  'blocked gamepad access never breaks the game',
);
let dismissed = false;
const handled = navigateGamepad(
  {},
  {
    KeyboardEvent: class {},
    dispatchEvent() {
      dismissed = true;
    },
  },
  { connected: true, cancel: true },
  {
    controls: [
      {
        trigger: {
          getAttribute() {
            return 'true';
          },
        },
      },
    ],
  },
);
assert(handled && dismissed, 'dropdown cancellation is consumed before pause-menu back navigation');
