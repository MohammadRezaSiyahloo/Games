import assert from 'node:assert/strict';
import {
  BESTIARY,
  cleanDiscoveries,
  discoveriesFromStats,
  encounteredEntries,
  discoverEnemies,
  bestiaryEntries,
} from '../src/shared/bestiary.mjs';
import { Progression } from '../src/client/progression.mjs';
import { Preferences } from '../src/client/preferences.mjs';
import {
  TOUCH_IDS,
  cleanTouchLayouts,
  resolveTouchLayout,
  mobileActive,
  bindMobileControls,
} from '../src/client/mobile-controls.mjs';
import { CombatAudio, cueForEvent, cuePosition } from '../src/client/combat-audio.mjs';
const storage = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) || null, setItem: (k, v) => map.set(k, v) };
};
{
  const store = storage(),
    p = new Progression(store),
    game = {
      mode: 'ready',
      enemies: [
        { type: 'pawn' },
        { type: 'knight', rival: true },
        { type: 'bishop', champion: 'bishop' },
        { type: 'king', boss: 'fallenking' },
        { type: 'queen', isAvatar: true },
      ],
    };
  assert(!discoverEnemies(p, game));
  game.mode = 'playing';
  game.training = {};
  assert(!discoverEnemies(p, game));
  game.training = null;
  game.eventChoices = ['decline'];
  assert(!discoverEnemies(p, game));
  game.eventChoices = [];
  assert(discoverEnemies(p, game));
  assert(!discoverEnemies(p, game));
  assert.deepEqual(p.data.encountered, [
    'pawn',
    'knight',
    'rival',
    'bishop',
    'champion-bishop',
    'fallenking',
  ]);
  const again = new Progression(store);
  assert.deepEqual(again.data.encountered, p.data.encountered);
  again.merge({
    encountered: ['confessor', 'forged', 'pawn'],
    stats: {},
    completed: [],
    unlocked: [],
  });
  assert(again.data.encountered.includes('confessor'));
  assert(!again.data.encountered.includes('forged'));
  assert.equal(cleanDiscoveries(['pawn', 'pawn', 'bad', {}, null]).length, 1);
  assert.equal(BESTIARY.length, 13);
  const unknown = bestiaryEntries([], 'bosses', 'confessor');
  assert.equal(unknown.length, 0, 'search never exposes unknown names');
  assert.equal(bestiaryEntries(['confessor'], 'bosses', 'shadow')[0].id, 'confessor');
  assert.equal(bestiaryEntries([], 'all', 'undiscovered').length, 13);
  assert.deepEqual(
    encounteredEntries([
      { type: 'bishop', boss: 'confessor' },
      { type: 'rook', isAvatar: true },
    ]),
    ['confessor'],
  );
}
// Audio follows the existing mute/volume controls, has bounded voices, and has a distinct pattern per cue.
{
  const notes = [],
    pans = [];
  const param = () => ({
    value: 0,
    setValueAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createStereoPanner() {
      const pan = param();
      return {
        pan,
        connect() {
          pans.push(pan);
        },
        disconnect() {},
      };
    },
    createGain() {
      return { gain: param(), connect() {}, disconnect() {} };
    },
    createOscillator() {
      const n = {
        frequency: param(),
        connect() {},
        disconnect() {},
        start() {
          notes.push(this);
        },
        stop(t) {
          assert(t > ctx.currentTime);
        },
      };
      return n;
    },
  };
  const prefs = {
    audioEnabled: true,
    combatCues: true,
    directionalAudio: true,
    master: 0.8,
    sfx: 0.8,
  };
  const audio = new CombatAudio(
    () => ctx,
    () => prefs,
  );
  assert.equal(cueForEvent({ type: 'windup' }), 'windup');
  assert.equal(cueForEvent({ type: 'cast' }), 'projectile');
  assert.equal(cueForEvent({ type: 'guardBreak' }), 'guardbreak');
  assert.equal(cueForEvent({ type: 'parry' }), 'counter');
  assert.equal(cueForEvent({ type: 'abilityTell', enemy: false }), null);
  assert(audio.play('windup', { id: 'e', source: { x: 5, z: 0 }, player: { x: 0, z: 0 }, now: 0 }));
  assert(pans.at(-1).value > 0);
  assert(!audio.play('windup', { id: 'e', now: 100 }));
  ctx.currentTime = 1;
  assert(audio.play('projectile', { source: { x: -5, z: 0 }, player: { x: 0, z: 0 }, now: 1000 }));
  assert(pans.at(-1).value < 0);
  prefs.directionalAudio = false;
  assert(audio.play('counter', { now: 1300 }));
  assert.equal(pans.at(-1).value, 0);
  prefs.audioEnabled = false;
  assert(!audio.play('guardbreak', { now: 1600 }));
  prefs.audioEnabled = true;
  prefs.master = 0;
  assert(!audio.play('danger', { now: 1900 }));
  prefs.master = 0.8;
  assert(!audio.play('windup', { source: { x: 30, z: 0 }, player: { x: 0, z: 0 }, now: 2000 }));
  ctx.currentTime = 3;
  for (let i = 0; i < 6; i++) assert(audio.play('windup', { id: 'voice' + i, now: 3000 }));
  assert(!audio.play('windup', { id: 'overflow', now: 3000 }));
  assert(notes.some((n) => n.frequency.value === 880));
  assert(cuePosition({ x: 0, z: 5 }, { x: 0, z: 0 }, Math.PI / 2).pan < 0);
}
// Saved layouts are bounded, separate by orientation and mirror correctly without changing combat bindings.
{
  const store = storage(),
    p = new Preferences(store),
    bindings = { ...p.data.bindings };
  p.set({
    touchMode: 'on',
    touchScale: 100,
    touchOpacity: -3,
    touchLeftHanded: true,
    touchLayouts: {
      portrait: { attack: { x: 20, y: -10 }, unknown: { x: 0.5, y: 0.5 } },
      landscape: { guard: { x: 0.5, y: 0.7 } },
    },
  });
  assert.equal(p.data.touchScale, 1.35);
  assert.equal(p.data.touchOpacity, 0.35);
  assert.deepEqual(p.data.bindings, bindings);
  assert(!p.data.touchLayouts.portrait.unknown);
  assert.equal(p.data.touchLayouts.portrait.attack.x, 0.97);
  const h = new Preferences(store);
  assert.deepEqual(h.data.touchLayouts, p.data.touchLayouts);
  assert(mobileActive(h.data, { width: 1200, coarse: false }));
  assert(!mobileActive({ ...h.data, touchMode: 'off' }, { width: 390, coarse: true }));
  for (const [w, height] of [
    [320, 568],
    [390, 844],
    [568, 320],
    [844, 390],
  ])
    for (const scale of [0.85, 1, 1.35])
      for (const left of [false, true]) {
        const layout = resolveTouchLayout({ touchScale: scale, touchLeftHanded: left }, w, height),
          a = Object.entries(layout);
        assert.equal(a.length, 10);
        for (const [id, v] of a) {
          assert(v.size >= 48, id + ' is at least a 48px touch target');
          assert(v.x - v.size / 2 >= 0 && v.x + v.size / 2 <= w);
          assert(v.y - v.size / 2 >= 0 && v.y + v.size / 2 <= height);
        }
        for (let i = 0; i < a.length; i++)
          for (let j = i + 1; j < a.length; j++)
            assert(
              Math.hypot(a[i][1].x - a[j][1].x, a[i][1].y - a[j][1].y) >=
                (a[i][1].size + a[j][1].size) * 0.46,
              'controls do not overlap at ' + w + 'x' + height + ' ' + scale,
            );
      }
  const standard = resolveTouchLayout({}, 840, 390),
    left = resolveTouchLayout({ touchLeftHanded: true }, 840, 390);
  assert(standard.move.x < 420 && left.move.x > 420);
  assert.deepEqual(cleanTouchLayouts(null), {});
}
// Editor binds real pointer handlers and commits on release, cancelling safely on navigation/resize.
{
  const prefs = new Preferences(storage()),
    elements = new Map(),
    listeners = new Map(),
    buttons = new Map();
  let releases = 0;
  const $ = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        style: {},
        classList: { toggle() {} },
        value: '',
        checked: false,
        getBoundingClientRect() {
          return { left: 0, top: 0, width: 840, height: 390 };
        },
      });
    return elements.get(id);
  };
  const doc = {
    body: { classList: { toggle() {} } },
    querySelector: $,
    querySelectorAll(selector) {
      if (selector !== '[data-mobile-control]') return [];
      return TOUCH_IDS.map((id) => {
        if (!buttons.has(id))
          buttons.set(id, { style: {}, dataset: { mobileControl: id }, setPointerCapture() {} });
        return buttons.get(id);
      });
    },
  };
  const view = {
      addEventListener(k, fn) {
        listeners.set(k, fn);
      },
    },
    ui = bindMobileControls(
      prefs,
      $,
      view,
      doc,
      () => ({ width: 840, height: 390, coarse: true }),
      () => releases++,
    );
  assert(ui.active);
  const attack = buttons.get('attack');
  attack.onpointerdown({ button: 0, pointerId: 1, preventDefault() {} });
  attack.onpointermove({ clientX: 420, clientY: 300, preventDefault() {} });
  attack.onpointerup();
  assert.equal(prefs.data.touchLayouts.landscape.attack.x, 0.5);
  assert(releases > 0);
  $('#mobilePreviewOrientation').value = 'portrait';
  $('#mobilePreviewOrientation').onchange();
  assert.equal($('#mobilePreview').style.maxWidth, '290px');
  ui.update({ coop: true });
  assert.equal($('#mobileRevive').hidden, false);
  assert.equal($('#mobilePing').hidden, false);
  ui.update({ ritual: true });
  assert.equal($('#mobileRevive').hidden, false);
  assert.equal($('#mobilePing').hidden, true);
  $('#resetMobileLayout').onclick();
  assert.deepEqual(prefs.data.touchLayouts, {});
  assert.equal(prefs.data.touchScale, 1);
  listeners.get('resize')();
}
console.log(
  'PASS: encounter-only bestiary persistence/search, cue differentiation/mute/panning/voice bounds, saved touch editor, safe non-overlapping targets, orientation/left-hand layouts, reset and contextual mobile actions.',
);

assert.deepEqual(
  discoveriesFromStats({ castellanKills: 1, confessorKills: 0, fallenKingKills: 2 }),
  ['castellan', 'fallenking'],
);
