import assert from 'node:assert/strict';
import { createCustomSelects } from '../src/client/custom-select.mjs';

class Element {
  constructor(doc, tag = 'div') {
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.disabled = false;
    this._text = '';
    const classes = new Set();
    this.classList = {
      add: (x) => classes.add(x),
      remove: (x) => classes.delete(x),
      toggle: (x, on) => (on ? classes.add(x) : classes.delete(x)),
      contains: (x) => classes.has(x),
    };
  }

  append(...children) {
    this.children.push(...children);
    for (const c of children) c.parent = this;
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  set textContent(v) {
    this._text = v;
    this.children = [];
  }

  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }

  setAttribute(k, v) {
    this.attrs[k] = v;
  }

  removeAttribute(k) {
    delete this.attrs[k];
  }

  addEventListener(n, f) {
    (this.listeners[n] ||= []).push(f);
  }

  dispatchEvent(e) {
    for (const f of this.listeners[e.type] || []) f(e);
    this['on' + e.type]?.(e);
    return true;
  }

  fire(type, options = {}) {
    const e = {
      type,
      target: this,
      preventDefault() {
        this.prevented = true;
      },
      stopImmediatePropagation() {
        this.stopped = true;
      },
      ...options,
    };
    this.dispatchEvent(e);
    return e;
  }

  focus() {
    this.doc.activeElement = this;
  }

  contains(target) {
    return target === this || this.children.some((c) => c.contains(target));
  }

  insertAdjacentElement(_, el) {
    this.sibling = el;
  }

  getBoundingClientRect() {
    return { left: 760, top: 500, bottom: 550, width: 220 };
  }

  scrollIntoView() {}
}
const doc = {
  activeElement: null,
  listeners: {},
  createElement(tag) {
    return new Element(this, tag);
  },
  querySelectorAll() {
    return this.selects;
  },
  addEventListener(n, f) {
    (this.listeners[n] ||= []).push(f);
  },
};
doc.body = new Element(doc, 'body');
const windowEvents = {};
doc.defaultView = {
  innerWidth: 800,
  innerHeight: 600,
  Event: class {
    constructor(type, opts) {
      this.type = type;
      Object.assign(this, opts);
    }
  },
  addEventListener(n, f) {
    windowEvents[n] = f;
  },
};
const select = new Element(doc, 'select');
select.id = 'soloDifficulty';
select.value = 'standard';
select.options = [
  { value: 'pilgrim', textContent: 'Pilgrim · Learn the court' },
  { value: 'standard', textContent: 'Standard · Balanced' },
  { value: 'veteran', textContent: 'Veteran · Faster', disabled: true },
  { value: 'nightmare', textContent: 'Nightmare · Relentless' },
];
const other = new Element(doc, 'select');
other.id = 'weaponSelect';
other.value = 'sword';
other.options = [{ value: 'sword', textContent: 'Sword' }];
doc.selects = [select, other];
let changes = 0,
  inputs = 0;
select.onchange = () => changes++;
select.addEventListener('input', () => inputs++);
const ui = createCustomSelects(doc),
  c = ui.controls[0];
assert.equal(select.hidden, true);
assert.equal(select.tabIndex, -1);
assert.equal(c.trigger.attrs.role, 'combobox');
assert.equal(c.value.textContent, 'Standard');
assert.equal(c.buttons[1].attrs['aria-selected'], 'true');
c.trigger.focus();
c.trigger.fire('click');
assert.equal(c.list.hidden, false);
assert.equal(c.trigger.attrs['aria-expanded'], 'true');
assert.equal(c.list.style.left, '528px');
assert.equal(c.list.style.bottom, '108px', 'popup flips upward near viewport edge');
const key = (k) => {
  const e = {
    key: k,
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
  };
  windowEvents.keydown(e);
  return e;
};
key('ArrowDown');
assert.equal(c.active, 3, 'keyboard skips disabled options');
key('Enter');
assert.equal(select.value, 'nightmare');
assert.equal(changes, 1);
assert.equal(inputs, 1);
assert.equal(c.list.hidden, true);
assert.equal(doc.activeElement, c.trigger);
c.trigger.fire('click');
key('Home');
assert.equal(c.active, 0);
key('Escape');
assert.equal(select.value, 'nightmare', 'Escape cancels');
c.trigger.fire('click');
key('p');
assert.equal(c.active, 0, 'typeahead finds an option');
key('Enter');
assert.equal(select.value, 'pilgrim');
c.trigger.fire('click');
select.disabled = true;
ui.sync();
assert(c.trigger.disabled);
assert(c.list.hidden);
const before = changes;
c.buttons[1].fire('click');
assert.equal(changes, before, 'disabled selects cannot change through popup');
select.disabled = false;
select.value = 'standard';
ui.sync();
assert.equal(c.value.textContent, 'Standard', 'external state updates trigger');
select.options.push({ value: 'new', textContent: 'New unlocked option' });
ui.sync();
assert.equal(c.buttons.length, 5, 'dynamic unlocked titles rebuild safely');
c.trigger.fire('click');
ui.controls[1].trigger.fire('click');
assert(c.list.hidden, 'opening another dropdown closes the first');
key('Tab');
assert(ui.controls[1].list.hidden, 'Tab dismisses without trapping focus');
c.trigger.fire('click');
doc.listeners.pointerdown[0]({ target: doc.body });
assert(c.list.hidden, 'outside click dismisses');
c.trigger.fire('click');
doc.listeners.scroll[0]({ target: c.list });
assert(!c.list.hidden, 'scrolling options keeps menu open');
doc.listeners.scroll[0]({ target: doc.body });
assert(c.list.hidden, 'scrolling the page dismisses detached popup');
console.log(
  'PASS: custom dropdown selection/save events, keyboard navigation, disabled options, Escape/Tab dismissal, typeahead, viewport positioning, external state, dynamic titles and outside interaction.',
);

c.trigger.fire('click');
assert(ui.opened);
assert(ui.dismiss());
assert(!ui.opened);
assert.equal(doc.activeElement, c.trigger);
assert(!ui.dismiss());
console.log('PASS: navigation dismissal closes dropdowns and restores their trigger focus.');
