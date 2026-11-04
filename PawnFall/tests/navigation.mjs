import assert from 'node:assert/strict';
import { backDestination, bindNavigation } from '../src/client/navigation.mjs';
const base = { menu: true, tab: 'campaign' };
assert.equal(backDestination(base), null);
for (const tab of ['multiplayer', 'armory', 'honors', 'training', 'settings', 'bestiary'])
  assert.equal(backDestination({ ...base, tab }), 'campaign');
assert.equal(backDestination({ ...base, dropdown: true, binding: true, guide: true }), 'dropdown');
assert.equal(backDestination({ ...base, binding: true, guide: true }), 'binding');
assert.equal(backDestination({ ...base, guide: true, playing: true }), 'guide');
assert.equal(backDestination({ ...base, intermission: true, menu: false }), 'pause');
assert.equal(backDestination({ ...base, paused: true }), 'resume');
assert.equal(backDestination({ ...base, paused: true, tab: 'settings' }), 'campaign');
assert.equal(backDestination({ ...base, connected: true, intermission: true }), 'leave');
assert.equal(backDestination({ ...base, result: true }), 'home');
assert.equal(backDestination({ ...base, menu: false, playing: true }), 'pause');
let state = { ...base, intermission: true },
  backs = 0,
  focus;
const first = {
    hidden: false,
    getClientRects() {
      return [1];
    },
    focus() {
      focus = this;
      doc.activeElement = this;
    },
  },
  last = { ...first };
const root = {
  querySelectorAll() {
    return [first, last];
  },
};
const doc = {
  activeElement: last,
  querySelector() {
    return root;
  },
};
const listeners = new Map(),
  ops = [];
const history = {
  state: {},
  replaceState(s) {
    this.state = s;
    ops.push('replace');
  },
  pushState(s) {
    this.state = s;
    ops.push('push');
  },
  back() {
    ops.push('back');
  },
};
const view = {
  history,
  addEventListener(name, fn) {
    listeners.set(name, fn);
  },
};
const n = bindNavigation(view, doc, {
  state: () => state,
  back: () => {
    backs++;
    return !!backDestination(state);
  },
});

function key(key, extra = {}) {
  const e = {
    key,
    code: key,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    ...extra,
  };
  n.keydown(e);
  return e;
}
assert.deepEqual(ops, ['replace', 'push']);
assert(key('Tab').defaultPrevented);
assert.equal(focus, first);
assert(key('Tab', { shiftKey: true }).defaultPrevented);
assert.equal(focus, last);
assert(key('Escape').defaultPrevented);
assert.equal(backs, 1);
key('Escape', { defaultPrevented: true });
assert.equal(backs, 1, 'rebinding/dropdown escape is not handled twice');
key('Escape', { repeat: true });
assert.equal(backs, 1, 'held escape does not race through screens');
n.popstate({ state: { pawnfallNav: 'base' } });
assert.equal(ops.at(-1), 'push', 'phone Back stays inside app while closing a screen');
state = { ...base };
n.popstate({ state: { pawnfallNav: 'base' } });
assert.equal(ops.at(-1), 'back', 'home does not trap browser navigation');
state = { ...base, guide: true };
doc.activeElement = {};
assert(key('Tab').defaultPrevented);
assert.equal(focus, first, 'modal focus returns from background UI');
assert.doesNotThrow(
  () => bindNavigation({ addEventListener() {} }, doc, { state: () => base, back: () => false }),
  'restricted browser history has an in-app fallback',
);
console.log(
  'PASS: every menu back destination, transient-first dismissal, Escape precedence, focus containment, browser/phone Back and non-trapping home navigation.',
);

assert.equal(backDestination({ ...base, tab: 'bestiary', bestiary: true }), 'bestiary');
