import { LEGACY_BINDINGS } from '../src/client/preferences.mjs';
import assert from 'node:assert/strict';
import { bindCombatKeys, bindActionButtons } from '../src/client/controls.mjs';
import { Game } from '../src/shared/combat.mjs';

class Surface {
  constructor(action) {
    this.listeners = {};
    this.dataset = { action };
    this.attrs = {};
    this.classList = { toggle() {} };
  }

  addEventListener(name, fn, capture) {
    (this.listeners[name] ||= []).push(fn);
    if (name === 'keydown') assert.equal(capture, true);
  }

  setPointerCapture(id) {
    this.pointer = id;
  }

  setAttribute(k, v) {
    this.attrs[k] = v;
  }

  fire(name, options = {}) {
    const e = {
      key: '',
      code: '',
      target: { tagName: 'CANVAS' },
      button: 0,
      pointerId: 1,
      detail: 1,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
      ...options,
    };
    for (const fn of this.listeners[name] || []) fn(e);
    return e;
  }
}
const game = new Game();
game.reset();
game.clearAt = 999;
game.enemies = [];
const surface = new Surface(),
  keys = new Set();
let reading = false,
  focuses = 0,
  guard = false;
const active = () => game.mode === 'playing' && !reading;
const action = (kind) => {
  if (kind === 'attack') game.attack();
  if (kind === 'dodge') game.dodge();
  if (kind === 'heal') game.heal();
};
bindCombatKeys(surface, {
  bindings: () => LEGACY_BINDINGS,
  keys,
  active,
  paused: () => game.mode === 'paused',
  reading: () => reading,
  action,
  togglePause: () => {
    game.mode = game.mode === 'paused' ? 'playing' : 'paused';
  },
});
let e = surface.fire('keydown', { code: 'KeyJ', key: 'ت' });
assert.equal(game.player.state, 'attack', 'physical attack key works in Persian layout');
assert(e.prevented && e.stopped);
const stamina = game.stamina;
surface.fire('keydown', { code: 'KeyJ', key: 'ت', repeat: true });
assert.equal(game.stamina, stamina);
surface.fire('keyup', { code: 'KeyJ', key: 'ت' });
assert(!keys.has('j'));
game.reset();
game.enemies = [];
game.clearAt = 999;
surface.fire('keydown', { code: 'KeyK', key: 'ن' });
game.update(0.02, { block: keys.has('k') });
assert(game.player.block, 'physical guard key works');
surface.fire('keyup', { code: 'KeyK', key: 'k' });
game.update(0.02, { block: keys.has('k') });
assert(!game.player.block, 'keyup independent of layout');
e = surface.fire('keydown', { code: 'KeyJ', key: 'j', target: { tagName: 'INPUT' } });
assert(!e.prevented);
assert.notEqual(game.player.state, 'attack');
e = surface.fire('keydown', { code: 'KeyJ', key: 'j', ctrlKey: true });
assert(!e.prevented, 'browser shortcuts preserved');
surface.fire('keydown', { code: 'Escape', key: 'Escape' });
assert.equal(game.mode, 'paused');
surface.fire('keydown', { code: 'Escape', key: 'Escape' });
assert.equal(game.mode, 'playing');
game.mode = 'upgrade';
e = surface.fire('keydown', { code: 'Space', key: ' ', target: { tagName: 'BUTTON' } });
assert(!e.prevented, 'upgrade buttons retain keyboard activation');
game.mode = 'playing';
reading = true;
e = surface.fire('keydown', { code: 'KeyJ', key: 'j' });
assert(!e.prevented);
reading = false;
const attack = new Surface('attack'),
  block = new Surface('guard'),
  heal = new Surface('heal');
const buttons = bindActionButtons([attack, block, heal], {
  active,
  focus: () => focuses++,
  action,
  guard: (v) => (guard = v),
});
game.reset();
attack.fire('pointerdown');
assert.equal(game.player.state, 'attack');
assert.equal(focuses, 1);
assert.equal(attack.pointer, 1);
let count = game.events.filter((e) => e.type === 'swing').length;
attack.fire('click');
assert.equal(
  game.events.filter((e) => e.type === 'swing').length,
  count,
  'no duplicate click attack',
);
for (const release of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  game.reset();
  block.fire('pointerdown');
  game.update(0.02, { block: guard });
  assert(game.player.block);
  block.fire(release);
  game.update(0.02, { block: guard });
  assert(!game.player.block);
  assert.equal(block.attrs['aria-pressed'], 'false');
}
block.fire('pointerdown');
buttons.releaseAll();
assert(!guard, 'focus loss releases held guard');
block.fire('click', { detail: 0 });
assert(guard, 'keyboard/assistive button activation');
block.fire('click', { detail: 0 });
assert(!guard);
game.reset();
game.hp = 30;
heal.fire('pointerdown');
assert.equal(game.hp, 78, 'HUD healing button reaches combat');
game.mode = 'paused';
buttons.releaseAll();
block.fire('pointerdown');
assert(!guard, 'controls inactive in menus');
console.log(
  'PASS: physical J/K on non-Latin layouts, repeat suppression, captured game keys, native menu/text shortcuts, keyboard pause/resume, clickable attack/heal, hold-to-guard, pointer cancellation, blur cleanup and assistive activation.',
);
