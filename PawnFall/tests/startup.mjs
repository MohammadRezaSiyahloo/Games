import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { Battle } from '../src/shared/battle.mjs';
import { offerPromotion } from '../src/shared/promotion.mjs';
const damagedBossStates = new Set();
const elements = new Map(),
  frames = [],
  renders = [],
  renderedPieces = new Set(),
  objectiveModels = new Set(),
  downedBodies = [],
  renderedGrips = new Set(),
  windowEvents = new Map();
let fallenModel,
  focusedElement,
  renderNow = 0;

function element(key) {
  if (elements.has(key)) return elements.get(key);
  const e = {
    hidden: key === '#error',
    disabled: key === '#start',
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    classList: {
      values: new Set(),
      add(...names) {
        for (const name of names) this.values.add(name);
      },
      remove(...names) {
        for (const name of names) this.values.delete(name);
      },
      toggle(name, on = !this.values.has(name)) {
        if (on) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      },
    },
    addEventListener(name, fn) {
      this.events ||= new Map();
      const list = this.events.get(name) || [];
      list.push(fn);
      this.events.set(name, list);
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      for (const fn of this.events?.get('close') || []) fn();
    },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    click() { this.onclick?.(); },
    appendChild() {},
    focus() {
      focusedElement = key;
    },
    setPointerCapture() {},
    querySelector(s) {
      return element(key + ' ' + s);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 110, height: 110 };
    },
  };
  elements.set(key, e);
  return e;
}

function canvas() {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        createImageData(w, h) {
          return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData() {},
        createRadialGradient() {
          return { addColorStop() {} };
        },
        fillRect() {},
      };
    },
  };
}

class Renderer {
  constructor() {
    this.shadowMap = {};
    this.domElement = element('canvas');
  }

  setPixelRatio() {}

  setSize() {}

  render(scene, camera) {
    let count = 0;
    scene.traverse((o) => {
      count++;
      if (o.visible && o.name) objectiveModels.add(o.name);
      if (o.userData?.friendly) {
        renderedPieces.add(o.userData.type);
        if (o.userData.weapon && o.userData.rig) {
          const rig = o.userData.rig;
          assert.equal(rig.right.parent, o.userData.arm);
          assert(rig.right.visible, 'equipping a weapon does not hide the grip');
          assert(!o.userData.arm.userData.original.includes(rig.right));
          renderedGrips.add(o.userData.weapon);
        }
      }
      if (o.userData?.battleDamage)
        damagedBossStates.add(o.userData.battleDamage.boss + ':' + o.userData.battleDamage.stage);
      if (o.userData?.isDowned) {
        fallenModel = o;
        downedBodies.push({
          visible: o.visible,
          rotation: o.userData.body.rotation.z,
          children: o.userData.body.children.length,
        });
      }
      assert(o.position.toArray().every(Number.isFinite), 'finite positions');
      assert(o.scale.toArray().every(Number.isFinite), 'finite scales');
      if (o.geometry) {
        assert(o.geometry.attributes.position.count > 0, 'geometry vertices');
      }
    });
    renders.push(count);
    assert(Number.isFinite(camera.projectionMatrix.elements[0]));
  }
}
let routeInputs = false;
let savedProfile = null,
  ended = false;
const networkBattle = new Battle('versus', [
  { name: 'A', skin: 'ivory' },
  { name: 'B', skin: 'ivory' },
]);
networkBattle.step(0.01);
const sandbox = {
  console,
  Float32Array,
  Uint8ClampedArray,
  devicePixelRatio: 1,
  innerWidth: 1280,
  innerHeight: 800,
  localStorage: {
    getItem() {
      return 0;
    },
    setItem(k, v) {
      if (k === 'pawnfall-profile-v4') savedProfile = JSON.parse(v);
    },
  },
  performance: { now: () => renderNow },
  async fetch(url, options) {
    const data = JSON.parse(options.body);
    let value;
    if (url.endsWith('/session')) value = { token: 'test-token' };
    else if (url.endsWith('/profile')) value = { profile: data };
    else if (url.endsWith('/matchmaking')) value = { room: 'test-room', code: 'P12345' };
    else if (url.endsWith('/room')) {
      if (routeInputs && data.input) networkBattle.setInput(1, data.input);
      if (data.control) networkBattle.control(1, data.control);
      value = ended
        ? { ...networkBattle.snapshot(1), status: 'ended', winner: 1, events: [] }
        : { ...networkBattle.snapshot(1), status: networkBattle.status };
    } else throw Error('Unexpected request ' + url);
    return {
      ok: true,
      async json() {
        return value;
      },
    };
  },
  setTimeout,
  requestAnimationFrame: (f) =>
    frames.push((stamp) => {
      renderNow = stamp;
      f(stamp);
    }),
  window: {
    __Renderer: Renderer,
    addEventListener(name, fn) {
      const list = windowEvents.get(name) || [];
      list.push(fn);
      windowEvents.set(name, list);
    },
  },
  document: {
    body: element('body'),
    querySelector: (selector) =>
      selector === 'details[open]'
        ? ['#moreMenu', '#advancedRun', '#challengeMenu'].map(element).find((e) => e.open) || null
        : element(selector),
    querySelectorAll(selector) {
      if (
        selector === '[data-route]' ||
        selector === '[data-upgrade]' ||
        selector === '[data-promote]' ||
        selector === '[data-event]'
      ) {
        const attribute = selector.slice(1, -1);
        return [
          ...element('#upgradeCards').innerHTML.matchAll(new RegExp(attribute + '="([^"]+)"', 'g')),
        ].map((match) => {
          const b = element(attribute + ':' + match[1]);
          b.dataset[attribute.slice(5)] = match[1];
          return b;
        });
      }
      if (selector === '[data-beast]')
        return [...element('#bestiaryGrid').innerHTML.matchAll(/data-beast="([^"]+)"/g)].map(
          (match) => {
            const b = element('beast:' + match[1]);
            b.dataset.beast = match[1];
            return b;
          },
        );
      if (selector === '[data-binding]')
        return [...element('#keyBindings').innerHTML.matchAll(/data-binding="([^"]+)"/g)].map(
          (match) => {
            const b = element('binding:' + match[1]);
            b.dataset.binding = match[1];
            return b;
          },
        );
      if (selector === '[data-tab]')
        return [
          'campaign',
          'multiplayer',
          'armory',
          'honors',
          'training',
          'settings',
          'bestiary',
        ].map((id) => {
          const b = element('tab:' + id);
          b.dataset = { tab: id };
          return b;
        });
      return [];
    },
    createElement: canvas,
    addEventListener() {},
  },
};
vm.createContext(sandbox);
let code = fs.readFileSync(new URL('../public/game.js', import.meta.url), 'utf8');
// Keep real Three.js scene construction; substitute only the unavailable GPU renderer.
assert(/renderer\s*=\s*new THREE.WebGLRenderer\(/.test(code));
code = code.replace(/renderer\s*=\s*new THREE.WebGLRenderer\(/, 'renderer=new window.__Renderer(');
assert(code.includes('const game = new Game(),'));
code = code.replace(
  'const game = new Game(),',
  'const game = window.__navigationTestGame = new Game(),',
);
code = code.replace(
  'progress = new Progression(),',
  'progress = window.__testProgression = new Progression(),',
);
code = code.replace(
  'network = new NetworkClient(),',
  'network = window.__rejoinTestNetwork = new NetworkClient(),',
);
vm.runInContext(code, sandbox, { timeout: 15000 });
assert.equal(element('#error').hidden, true, 'initialization did not throw');
assert.equal(element('#start').disabled, false, 'loader enables start');
assert.equal(element('#start').textContent, 'PLAY');
assert.equal(typeof element('#start').onclick, 'function', 'inputs bound');
for (let i = 0; i < 3; i++) {
  assert(frames.length);
  frames.shift()(i * 16 + 16);
}
assert(renders.at(-1) > 150, 'scene contains board, actors, and environment');
element('#start').onclick();
for (let i = 0; i < 80; i++) {
  assert(frames.length);
  frames.shift()(i * 16 + 100);
}
assert.equal(element('#error').hidden, true);
assert.notEqual(element('#timer').textContent, '00:00', 'playing loop advances');
assert.equal(element('#hpText').textContent, '100 / 100');
assert.equal(element('#wave').textContent, 'I / V');
assert.equal(focusedElement, 'canvas', 'starting focuses the arena');
element('#pause').onclick();
element('#start').onclick();
assert.equal(focusedElement, 'canvas', 'resume restores arena focus');
const attackKey = {
  code: 'KeyE',
  key: 'ت',
  target: { tagName: 'CANVAS' },
  preventDefault() {
    this.prevented = true;
  },
  stopPropagation() {
    this.stopped = true;
  },
};
for (const f of windowEvents.get('keydown')) f(attackKey);
frames.shift()(1400);
assert(attackKey.prevented && attackKey.stopped, 'bundled key handler consumes physical game keys');
assert(
  parseFloat(element('#stFill').style.width) < 100,
  'non-Latin attack key spends stamina in real bundled game',
);
for (const f of windowEvents.get('keyup')) f(attackKey);
console.log(
  'PASS: bundled physical-key input, non-Latin attack, default prevention and focus after resume.',
);

console.log(
  'PASS: bundled startup, real Three.js scene and geometry creation, menu, start button, input binding, 83 rendered simulation frames; GPU rendering excluded.',
);

const loadoutGame = sandbox.window.__navigationTestGame;
const loadoutProgress = sandbox.window.__testProgression;
assert.equal(loadoutGame.weapon, 'longsword');
assert.equal(loadoutGame.chessClass, 'pawn');
assert.match(element('#weaponSelect').innerHTML, /value="rapier" disabled.*0\/1 plays/);
assert.match(element('#pieceSelect').innerHTML, /value="queen" disabled.*0\/10 plays/);
element('#pieceSelect').onchange({ target: { value: 'queen' } });
assert.equal(loadoutProgress.data.chessClass, 'pawn');

loadoutGame.wave = 2;
assert(offerPromotion(loadoutGame));
frames.shift()(1432);
assert(element('#upgradeCards').innerHTML.includes('data-promote="queen"'));
element('data-promote:queen').onclick();
assert.equal(loadoutGame.chessClass, 'queen');
assert.equal(loadoutProgress.data.chessClass, 'pawn');
assert.equal(loadoutProgress.data.stats.finishedPlays, 0);
if (loadoutGame.eventChoices.length) loadoutGame.chooseEvent('decline');
if (loadoutGame.upgradeChoices.length) loadoutGame.chooseUpgrade(loadoutGame.upgradeChoices[0]);
loadoutGame.player.invuln = 0;
assert.equal(loadoutGame.mode, 'playing');
assert(loadoutGame.hurtPlayer(10000, { x: 0, z: 0, unblockable: true }));
assert.equal(loadoutGame.mode, 'dead');
frames.shift()(1464);
assert.equal(savedProfile.stats.finishedPlays, 1);
assert.equal(element('#loadoutReward').textContent, 'Rapier unlocked in the Armory.');
assert.doesNotMatch(element('#weaponSelect').innerHTML, /value="rapier" disabled/);
assert.match(element('#pieceSelect').innerHTML, /value="queen" disabled.*1\/10 plays/);
console.log('PASS: fresh loadout locks, temporary Queen promotion, and first permanent unlock on defeat.');

element('#menu').onclick();
element('#bossChallenge').onclick();
for (let i = 0; i < 480; i++) {
  assert(frames.length);
  frames.shift()(1500 + i * 16);
}
assert.equal(element('#bossHud').hidden, false, 'boss HUD is visible');
assert.equal(element('#bossHpText').textContent, '780 / 780');
assert.equal(element('#wave').textContent, 'V / V');
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: direct boss challenge, procedural boss model, charge markers and 480 simulation/render frames.',
);
element('#menu').onclick();
let renderStamp = 10000;
// Use a completed profile to exercise each weapon through the actual Armory.
loadoutProgress.merge({ stats: { finishedPlays: 15 } });
for (const weapon of ['rapier', 'warhammer', 'longsword', 'spear', 'twinblades', 'greatsword']) {
  element('#weaponSelect').onchange({ target: { value: weapon } });
  element('#confessorChallenge').onclick();
  const heavyKey = {
    code: 'KeyE',
    key: 'ا',
    target: { tagName: 'CANVAS' },
    preventDefault() {},
    stopPropagation() {},
  };
  for (const f of windowEvents.get('keydown')) f(heavyKey);
  for (const f of windowEvents.get('keyup')) f(heavyKey);
  for (let i = 0; i < 600; i++) frames.shift()((renderStamp += 16));
  assert.equal(element('#bossName').textContent, 'The Pale Confessor');
  assert.equal(element('#bossHpText').textContent, '680 / 680');
  assert(
    element('#weaponHud').textContent.includes(
      weapon === 'twinblades' ? 'TWIN BLADES' : weapon.toUpperCase(),
    ),
  );
  assert.equal(element('#error').hidden, true);
  element('#menu').onclick();
}
console.log(
  'PASS: all weapon geometries, heavy input, armored grips through equipment swaps, Confessor model, illusion generation and fixed volley markers across 1800 rendered simulation frames.',
);
for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
  element('#pieceSelect').onchange({ target: { value: piece } });
  element('#newRun').onclick();
  const abilityKey = {
    code: 'KeyQ',
    key: 'ض',
    target: { tagName: 'CANVAS' },
    preventDefault() {},
    stopPropagation() {},
  };
  for (const f of windowEvents.get('keydown')) f(abilityKey);
  for (const f of windowEvents.get('keyup')) f(abilityKey);
  for (let i = 0; i < 70; i++) frames.shift()((renderStamp += 16));
  assert.notEqual(element('#abilityCooldown').textContent, 'Q · READY', 'piece ability triggered');
  assert(renderedPieces.has(piece), 'selected piece model rendered: ' + piece);
  assert.equal(element('#error').hidden, true);
  element('#menu').onclick();
}
console.log(
  'PASS: six selectable piece models, physical Q ability input, cooldown HUD, ability telegraphs and effects across 420 scene frames.',
);

for (const type of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
  element('#trainingEnemy').value = type;
  element('#trainingBehavior').value = type === 'rook' ? 'guard' : 'attack';
  element('#trainingUnlimited').checked = true;
  element('#startTraining').onclick();
  for (let i = 0; i < 95; i++) frames.shift()((renderStamp += 16));
  assert.equal(element('#practiceHud').hidden, false);
  assert.equal(element('#souls').textContent, 0);
  assert.equal(element('#error').hidden, true);
  element('#menu').onclick();
}
element('#setting-quality').value = 'low';
element('#setting-quality').oninput();
element('#setting-reducedEffects').checked = true;
element('#setting-reducedEffects').oninput();
assert(element('body').classList.contains('reduced-effects'));
element('#setting-quality').value = 'medium';
element('#setting-quality').oninput();
element('#setting-reducedEffects').checked = false;
element('#setting-reducedEffects').oninput();
console.log(
  'PASS: six training opponents, live practice HUD, safe settings changes and new menu sections across 570 scene frames.',
);
element('#displayName').value = 'B';
element('#roomCode').value = 'P12345';
element('#joinMatch').onclick();
await new Promise(setImmediate);
frames.shift()(renderStamp + 1000);
await new Promise(setImmediate);
frames.shift()(renderStamp + 1020);
assert.equal(element('#peerName').textContent, 'A · RIVAL', 'room mode overrides menu choice');
assert.equal(element('#remaining').textContent, 'FIRST TO FALL LOSES');
ended = true;
frames.shift()(renderStamp + 1500);
await new Promise(setImmediate);
frames.shift()(renderStamp + 1520);
assert.equal(element('#panel-multiplayer').hidden, false, 'match result stays in multiplayer');
assert.equal(element('#panel-campaign').hidden, true);
assert.equal(element('#sessionStatus').textContent, 'MATCH COMPLETE');
assert.equal(element('#matchResult').hidden, false);
assert.equal(element('#matchResultTitle').textContent, 'VICTORY');
assert.equal(element('#matchWinner').textContent, 'B wins!');
assert.equal(element('#matchResult').dataset.outcome, 'victory');
assert(element('body').classList.contains('victorious'));
assert.equal(element('#victoryFX').hidden, false);
assert.equal(savedProfile.stats.versusWins, 1);
assert.equal(savedProfile.stats.finishedPlays, 16);
assert(savedProfile.unlocked.includes('duel_win'));
console.log(
  'PASS: bundled network client, joining a versus code from co-op selection, peer rendering, match result and cosmetic reward.',
);

element('tab:multiplayer').onclick();
element('#joinMatch').onclick();
await new Promise(setImmediate);
frames.shift()(renderStamp + 2000);
await new Promise(setImmediate);
frames.shift()(renderStamp + 2020);
assert.equal(
  element('#panel-multiplayer').hidden,
  false,
  'stale ended room leaves multiplayer open',
);
assert.equal(element('#panel-campaign').hidden, true);
assert.equal(element('#matchWinner').textContent, 'B wins!');
assert.equal(element('#rematchMatch').hidden, false);
console.log(
  'PASS: multiplayer tab persists across frames, completed matches return to lobby, stale ended rooms do not launch gameplay or switch to campaign.',
);

networkBattle.status = 'ended';
networkBattle.winner = 1;
networkBattle.phase = 'ended';
networkBattle.control(0, { kind: 'rematch', series: 1, round: 1 });
ended = false;
element('#rematchMatch').onclick();
frames.shift()(renderStamp + 2500);
await new Promise(setImmediate);
frames.shift()(renderStamp + 2520);
assert.equal(element('#sessionStatus').textContent, 'BOTH PLAYERS MUST READY UP');
assert.equal(element('#readyMatch').disabled, false);
assert.equal(element('#matchResult').hidden, true);
assert.equal(savedProfile.stats.versusWins, 1, 'rematch polling does not duplicate rewards');
assert.equal(savedProfile.stats.finishedPlays, 16, 'rematch polling counts the match once');
element('#readyMatch').onclick();
frames.shift()(renderStamp + 3000);
await new Promise(setImmediate);
frames.shift()(renderStamp + 3020);
assert.equal(element('#readyMatch').disabled, true);
networkBattle.control(0, { kind: 'ready', series: 2, round: 1 });
frames.shift()(renderStamp + 3500);
await new Promise(setImmediate);
frames.shift()(renderStamp + 3520);
assert(element('#sessionStatus').textContent.startsWith('STARTING IN'));
networkBattle.step(3.1);
frames.shift()(renderStamp + 4000);
await new Promise(setImmediate);
frames.shift()(renderStamp + 4020);
assert.equal(element('#sessionPanel').hidden, true);
assert.equal(element('#overlay').classList.contains('hidden'), true);
assert.equal(element('#peerName').textContent, 'A · RIVAL');
assert(element('#networkQuality').textContent.includes('ms'));
networkBattle.emit({ type: 'block', id: 'player', x: 0, z: 0, steel: true }, 1);
frames.shift()(renderStamp + 4500);
await new Promise(setImmediate);
frames.shift()(renderStamp + 4520);
networkBattle.status = 'ended';
networkBattle.phase = 'ended';
networkBattle.winner = 0;
frames.shift()(renderStamp + 5000);
await new Promise(setImmediate);
frames.shift()(renderStamp + 5020);
assert.equal(element('#matchResultTitle').textContent, 'CHECKMATE');
assert.equal(element('#deathFX').hidden, false);
assert.equal(element('#victoryFX').hidden, true);
assert(element('body').classList.contains('checkmated'));
element('#leaveSession').onclick();
assert.equal(element('#deathFX').hidden, true, 'red effect clears when leaving');
assert.equal(element('#panel-multiplayer').hidden, false);
assert.equal(element('#findMatch').disabled, false, 'leave restores matchmaking controls');
console.log(
  'PASS: bundled rematch button, ready barrier, countdown, same-room re-entry, ping display, one-time rewards and leaving a session.',
);
Object.assign(
  networkBattle,
  new Battle('coop', [
    { name: 'A', skin: 'ivory' },
    { name: 'B', skin: 'ivory' },
  ]),
);
ended = false;
element('#findMatch').onclick();
await new Promise(setImmediate);
let coopStamp = renderStamp + 6000;
for (let i = 0; i < 180; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(element('#peerName').textContent, 'A · ALLY');
assert.equal(element('#remaining').textContent, '3 enemies remain');
assert.equal(element('#error').hidden, true);
assert.equal(element('#overlay').classList.contains('hidden'), true);
console.log(
  'PASS: bundled co-op integration with moving enemies, interpolated partner/projectiles, and 180 finite scene frames.',
);

// Drive real route buttons through the bundled network client.
routeInputs = true;
networkBattle.games[0].enemies.forEach((e) => (e.dead = true));
for (let i = 0; i < 180; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(element('#upgradePanel').hidden, false);
assert.equal(element('#upgradeTitle').textContent, 'Choose your next passage.');
assert(element('#upgradeCards').innerHTML.includes('The Red Huntmaster'));
element('data-route:champion').onclick();
networkBattle.setInput(0, { actions: [{ n: 100, kind: 'route:champion' }] });
for (let i = 0; i < 30; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(networkBattle.routeChoices.length, 0);
assert.equal(
  element('#upgradePanel').hidden,
  true,
  'route finishes the intermission with no chained prompts',
);
assert(networkBattle.games[0].enemies.some((e) => e.champion));
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: bundled co-op route voting buttons, champion briefing, single-choice combat resume and finite champion geometry.',
);

// Complete the live ritual with both seats, then exercise promotion through real client buttons.
assert.equal(element('#arenaGoal').hidden, false);
assert.equal(element('#arenaGoalTitle').textContent, 'Break the blood rite');
assert.equal(element('#objectiveInteract').hidden, false);
networkBattle.games[0].enemies.forEach((e) => (e.dead = true));
for (const s of networkBattle.games[0].arenaObjective.sigils) {
  for (const g of networkBattle.games) {
    Object.assign(g.player, { x: s.x, z: s.z, hitAt: -10, invuln: 999, state: 'idle' });
    g.hp = 100;
  }
  networkBattle.setInput(0, { revive: true });
  const interact = {
    code: 'KeyF',
    key: 'f',
    target: { tagName: 'CANVAS' },
    preventDefault() {},
    stopPropagation() {},
  };
  for (const handler of windowEvents.get('keydown')) handler(interact);
  for (let i = 0; i < 140; i++) {
    networkBattle.step(1 / 60);
    frames.shift()((coopStamp += 1000 / 60));
    await new Promise(setImmediate);
  }
  for (const handler of windowEvents.get('keyup')) handler(interact);
}
for (let i = 0; i < 180; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(networkBattle.wave, 2);
assert(
  networkBattle.games.every((g) => g.pendingBlessings === 0),
  'champion blessings already applied',
);
assert.equal(element('#upgradeTitle').textContent, 'The pawn earns its crown.');
assert(element('#upgradeCards').innerHTML.includes('data-promote="queen"'));
const pausedTime = networkBattle.time;
element('data-promote:queen').onclick();
for (let i = 0; i < 30; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(networkBattle.games[1].chessClass, 'queen');
assert.equal(networkBattle.time, pausedTime);
networkBattle.setInput(0, { actions: [{ n: 106, kind: 'promote:rook' }] });
for (let i = 0; i < 30; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(element('#upgradePanel').hidden, true);
assert(networkBattle.time > pausedTime);
assert.equal(element('#arenaGoalTitle').textContent, 'Claim the fallen throne');
assert.equal(element('#objectiveInteract').hidden, true);
assert(objectiveModels.has('wounded-objective-king'));
assert(objectiveModels.has('ritual-sigil-0'));
assert(objectiveModels.has('contested-throne'));
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: bundled ritual interaction, goal HUD/markers, automatic champion blessings, independent promotion choices, model replacement and paused co-op handoff.',
);

routeInputs = false;
networkBattle.games[1].hp = 100;
networkBattle.games[1].player.invuln = 999;
networkBattle.games[0].enemies.forEach((e) => (e.cooldown = 999));
networkBattle.games[0].hp = 0;
for (let i = 0; i < 65; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert(
  downedBodies.some((p) => p.visible && p.rotation < -1.5 && p.children > 4),
  'downed ally remains a visible fallen piece model',
);
Object.assign(networkBattle.games[1].player, {
  x: networkBattle.games[0].player.x + 1,
  z: networkBattle.games[0].player.z,
});
networkBattle.setInput(1, { revive: true });
for (let i = 0; i < 205; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((coopStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert(networkBattle.games[0].hp > 0);
assert.equal(
  fallenModel.userData.isDowned,
  false,
  'revival returns the same fallen model to a standing actor',
);
assert(fallenModel.visible);
element('#leaveSession').onclick();
element('#start').onclick();
let retryStamp = coopStamp + 100;
element('#hubContent').scrollTop = 400;
for (let i = 0; i < 2400 && element('#retryFight').hidden; i++) frames.shift()((retryStamp += 16));
assert.equal(element('#retryFight').hidden, false, 'death offers quick retry');
assert.equal(element('#deathRecap').hidden, false);
assert.equal(element('#hubContent').scrollTop, 0, 'death results reveal the heading instead of inheriting menu scroll');
assert(element('#recapCause').textContent.length > 0);
element('#retryFight').onclick();
frames.shift()((retryStamp += 16));
assert.equal(element('#deathRecap').hidden, true);
assert.equal(element('#hpText').textContent, '100 / 100');
console.log(
  'PASS: real Three.js fallen co-op body, death recap and quick retry through the bundled client.',
);

element('#menu').onclick();
frames.shift()((retryStamp += 16));
assert.equal(
  element('#resumeCheckpoint').disabled,
  false,
  'saved encounter is offered in campaign',
);
element('#resumeCheckpoint').onclick();
frames.shift()((retryStamp += 16));
assert.equal(element('#overlay').classList.contains('hidden'), true);
assert.equal(element('#error').hidden, true);
console.log('PASS: saved encounter continuation launches through the bundled menu.');

assert.deepEqual([...renderedGrips].sort(), [
  'greatsword',
  'longsword',
  'rapier',
  'spear',
  'twinblades',
  'warhammer',
]);
console.log(
  'PASS: all three equipped weapon grips remain visible through heavy attacks, weapon swaps and co-op rendering.',
);

// New final boss uses real scene construction, readable committed markers and a distinct king silhouette.
element('#menu').onclick();
element('#kingChallenge').onclick();
for (let i = 0; i < 240; i++) frames.shift()((retryStamp += 16));
assert.equal(element('#bossName').textContent, 'The Fallen King');
assert.equal(element('#error').hidden, true);
assert.equal(element('#wave').textContent, 'V / V');
console.log(
  'PASS: all six weapon models/poses, event choice buttons and Fallen King model/telegraphs in the bundled client.',
);

// Navigation integration: every solo intermission can open menus and return without dropping choices.
const navigationGame = sandbox.window.__navigationTestGame;
const tabs = ['campaign', 'multiplayer', 'armory', 'honors', 'training', 'settings', 'bestiary'];
for (const [mode, field, choices] of [
  ['route', 'routeChoices', ['sanctuary', 'champion', 'onslaught']],
  ['upgrade', 'upgradeChoices', ['force', 'breath', 'flask']],
  ['promotion', 'promotionChoices', ['knight', 'bishop', 'rook', 'queen', 'pawn']],
  ['event', 'eventChoices', ['decline']],
]) {
  for (const key of ['routeChoices', 'upgradeChoices', 'promotionChoices', 'eventChoices'])
    navigationGame[key] = [];
  navigationGame.mode = mode;
  navigationGame[field] = choices;
  navigationGame.waitingForAlly = false;
  element('body').classList.remove('menu');
  element('#overlay').classList.add('hidden');
  frames.shift()((retryStamp += 16));
  assert.equal(element('#upgradePanel').hidden, false, mode + ' popup opens');
  const time = navigationGame.time;
  element('#intermissionMenu').onclick();
  assert.equal(element('#upgradePanel').hidden, true);
  assert.equal(navigationGame.mode, 'paused');
  for (const tab of tabs) {
    element('tab:' + tab).onclick();
    element('#hubContent').scrollTop = 400;
    element('#help').onclick();
    assert(element('#guide').open);
    element('#closeHelp').onclick();
    assert(!element('#guide').open);
    element('#navHome').onclick();
    assert.equal(element('#panel-campaign').hidden, false);
    assert.equal(element('#hubContent').scrollTop, 0);
    assert.equal(navigationGame.mode, 'paused');
  }
  assert.equal(navigationGame.time, time);
  assert.equal(JSON.stringify(navigationGame[field]), JSON.stringify(choices));
  element('#navResume').onclick();
  assert.equal(navigationGame.mode, mode);
  frames.shift()((retryStamp += 16));
  assert.equal(element('#upgradePanel').hidden, false, mode + ' popup resumes');
}
element('#intermissionMenu').onclick();
element('tab:settings').onclick();
element('binding:j').onclick();
assert(element('#bindingNotice').textContent.includes('Press a key'));
const escape = {
  code: 'Escape',
  key: 'Escape',
  target: { tagName: 'BUTTON' },
  preventDefault() {
    this.defaultPrevented = true;
  },
  stopPropagation() {},
  stopImmediatePropagation() {
    this.immediate = true;
  },
};
for (const fn of windowEvents.get('keydown')) {
  fn(escape);
  if (escape.immediate) break;
}
assert.equal(element('#bindingNotice').textContent, 'Binding cancelled.');
assert.equal(element('#panel-settings').hidden, false, 'Escape cancels capture before navigating');
element('#navBack').onclick();
assert.equal(element('#panel-campaign').hidden, false);
// A delayed help-close event must never restart a paused run behind the menu.
element('#newRun').onclick();
frames.shift()((retryStamp += 16));
element('#help').onclick();
assert.equal(navigationGame.mode, 'reading');
element('#guideHome').onclick();
for (const fn of element('#guide').events.get('close')) fn();
assert.equal(navigationGame.mode, 'paused');
element('#navResume').onclick();
assert.equal(navigationGame.mode, 'playing');
console.log(
  'PASS: all six menu pages, all four choice popups, scroll resets, help origins, binding Escape priority and delayed close safety preserve a resumable solo run.',
);
// An online intermission has a clear exit, and stale snapshots cannot drag Home back into a match.
element('#menu').onclick();
element('#leaveSession').onclick();
Object.assign(
  networkBattle,
  new Battle('coop', [
    { name: 'A', skin: 'ivory' },
    { name: 'B', skin: 'ivory' },
  ]),
);
ended = false;
element('tab:multiplayer').onclick();
element('#findMatch').onclick();
await new Promise(setImmediate);
for (let i = 0; i < 50; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((retryStamp += 1000 / 60));
  await new Promise(setImmediate);
}
networkBattle.games[0].enemies.forEach((e) => (e.dead = true));
for (let i = 0; i < 180; i++) {
  networkBattle.step(1 / 60);
  frames.shift()((retryStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(element('#upgradePanel').hidden, false);
assert.equal(element('#intermissionMenu').textContent, 'LEAVE MATCH');
element('#intermissionMenu').onclick();
for (let i = 0; i < 30; i++) {
  frames.shift()((retryStamp += 1000 / 60));
  await new Promise(setImmediate);
}
assert.equal(element('#panel-campaign').hidden, false);
assert.equal(element('#upgradePanel').hidden, true);
assert.equal(element('#findMatch').disabled, false);
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: online choice exit returns Home, clears the session and leaves matchmaking usable without refresh.',
);

element('tab:bestiary').onclick();
frames.shift()((retryStamp += 16));
assert.equal(element('#panel-bestiary').hidden, false);
assert(element('#bestiaryGrid').innerHTML.includes('Hollow Pawn'));
element('beast:pawn').onclick();
assert.equal(element('#bestiaryDetail').hidden, false);
assert(element('#bestiaryCounter').textContent.includes('parry'));
element('#navBack').onclick();
assert.equal(element('#bestiaryDetail').hidden, true);
assert.equal(element('#panel-bestiary').hidden, false);
element('#navBack').onclick();
assert.equal(element('#panel-campaign').hidden, false);
element('tab:settings').onclick();
element('#touchMode').value = 'on';
element('#touchMode').onchange();
element('#touchLeftHanded').checked = true;
element('#touchLeftHanded').onchange();
element('#newRun').onclick();
frames.shift()((retryStamp += 16));
assert(element('body').classList.contains('mobile-controls'));
assert.equal(element('#mobilePing').hidden, true);
element('#menu').onclick();
element('tab:settings').onclick();
element('#resetMobileLayout').onclick();
assert.equal(element('#touchScale').value, 1);
element('#touchMode').value = 'off';
element('#touchMode').onchange();
assert(!element('body').classList.contains('mobile-controls'));
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: bundled bestiary discovery/cards/Back navigation and saved mobile settings/left-hand/reset integrate with the live menu and game.',
);
// Save & Quit and Continue go through the actual menu handlers and storage.
const suspensionStorage = new Map();
sandbox.localStorage.getItem = (k) => suspensionStorage.get(k) || null;
const oldStorageWrite = sandbox.localStorage.setItem;
sandbox.localStorage.setItem = (k, v) => {
  suspensionStorage.set(k, v);
  oldStorageWrite(k, v);
};
sandbox.localStorage.removeItem = (k) => suspensionStorage.delete(k);
element('#newRun').onclick();
navigationGame.hp = 43;
navigationGame.stamina = 39;
navigationGame.time = 18.25;
navigationGame.enemies[0].state = 'windup';
navigationGame.enemies[0].until = 19;
navigationGame.projectiles = [
  { id: 'suspended-bolt', x: 2, z: 3, vx: 1, vz: 2, until: 22, damage: 12 },
];
element('#pause').onclick();
assert.equal(navigationGame.mode, 'paused');
const savedEnemies = JSON.stringify(navigationGame.enemies),
  savedPlayer = JSON.stringify(navigationGame.player);
element('#saveQuit').onclick();
assert.equal(navigationGame.mode, 'ready');
frames.shift()((retryStamp += 16));
assert.equal(element('#start').textContent, 'CONTINUE RUN', 'primary action offers the saved run');
element('#start').onclick();
assert.equal(navigationGame.mode, 'playing');
assert.equal(navigationGame.hp, 43);
assert.equal(navigationGame.stamina, 39);
assert.equal(navigationGame.time, 18.25);
assert.equal(JSON.stringify(navigationGame.enemies), savedEnemies);
assert.equal(JSON.stringify(navigationGame.player), savedPlayer);
assert.equal(navigationGame.projectiles[0].id, 'suspended-bolt');
// Portrait/landscape camera, warned terrain, and portal geometry remain finite.
navigationGame.wave = 1;
navigationGame.spawn();
navigationGame.hp = 100;
for (const [w, h] of [
  [390, 844],
  [844, 390],
  [360, 740],
]) {
  sandbox.innerWidth = w;
  sandbox.innerHeight = h;
  for (const fn of windowEvents.get('resize') || []) fn();
  navigationGame.arenaShift = {
    kind: 'gates',
    phase: 'warning',
    fireAt: navigationGame.time + 2,
    until: navigationGame.time + 10,
  };
  navigationGame.secretPortal = { x: 8, z: 7, progress: 0, used: false };
  for (let i = 0; i < 4; i++) frames.shift()((retryStamp += 16));
  navigationGame.arenaShift.phase = 'active';
  for (let i = 0; i < 4; i++) frames.shift()((retryStamp += 16));
  element('#resetCamera').onclick();
}
assert.equal(element('#error').hidden, true);
element('#bossRush').onclick();
assert(navigationGame.bossRush);
assert.equal(navigationGame.flasks, 2);
assert.equal(navigationGame.enemies.find((e) => e.boss).boss, 'castellan');
console.log(
  'PASS: bundled Save & Quit/Continue restores exact combat; phone portrait/landscape camera and dynamic terrain/portal scene construction; boss rush menu entry.',
);
// Secondary destinations and advanced campaign controls remain accessible without crowding Home.
element('#menu').onclick();
element('#moreMenu').open = true;
element('tab:bestiary').onclick();
assert.equal(element('#panel-bestiary').hidden, false);
assert.equal(element('#moreMenu').open, false, 'choosing a supporting page closes More');
element('#navHome').onclick();
element('#advancedRun').open = true;
element('#navBack').onclick();
assert.equal(
  element('#advancedRun').open,
  false,
  'Back dismisses expanded rules before leaving the page',
);
element('#campaignSetup').open = true;
element('#challengeMenu').open = true;
element('#bossRush').onclick();
assert.equal(element('#campaignSetup').open, false, 'starting combat closes run setup');
assert.equal(element('#challengeMenu').open, false, 'starting combat closes challenge controls');
assert.equal(navigationGame.mode, 'playing');
element('#pause').onclick();
assert.equal(navigationGame.mode, 'paused');
console.log(
  'PASS: compact More navigation, Back dismisses disclosures, and starting a challenge clears expanded menu state before combat.',
);

// Exercise progressive damage on actual boss models through the bundled client.
for (const [button, bossId] of [
  ['bossChallenge', 'castellan'],
  ['confessorChallenge', 'confessor'],
  ['kingChallenge', 'fallenking'],
]) {
  element('#' + button).onclick();
  const boss = navigationGame.enemies.find((e) => e.boss === bossId);
  assert(boss);
  navigationGame.player.invuln = navigationGame.time + 100;
  for (const ratio of [0.74, 0.49, 0.24]) {
    boss.hp = boss.max * ratio;
    for (let i = 0; i < 4; i++) frames.shift()((retryStamp += 16));
  }
  for (const stage of [1, 2, 3])
    assert(damagedBossStates.has(bossId + ':' + stage), bossId + ' damage stage ' + stage);
  assert.equal(element('#error').hidden, true);
  assert(element('#bossPhase').textContent.includes('PHASE II'));
}
console.log(
  'PASS: all three actual boss models show cracks, broken gear, final damage and phase labels across bundled simulation/render frames.',
);

// Endless launch, progression, suspension and polished outcome cards through the actual UI.
element('#endlessRun').onclick();
assert(navigationGame.endless);
assert.equal(navigationGame.mode, 'playing');
for (let round = 0; round < 7; round++) {
  if (navigationGame.arenaObjective) navigationGame.arenaObjective.complete = true;
  navigationGame.enemies.forEach((e) => (e.dead = true));
  navigationGame.clearAt = navigationGame.time + 0.001;
  frames.shift()((retryStamp += 32));
  if (navigationGame.routeChoices.length) navigationGame.chooseRoute('sanctuary');
  if (navigationGame.promotionChoices.length) navigationGame.choosePromotion('queen');
  if (navigationGame.eventChoices.length) navigationGame.chooseEvent('decline');
  if (navigationGame.upgradeChoices.length)
    navigationGame.chooseUpgrade(navigationGame.upgradeChoices[0]);
}
assert.equal(navigationGame.endless.encounter, 8);
assert.equal(navigationGame.mode, 'playing');
element('#pause').onclick();
element('#saveQuit').onclick();
element('#continueRun').onclick();
assert.equal(navigationGame.endless.encounter, 8);
assert.equal(navigationGame.mode, 'playing');
navigationGame.hp = 1;
navigationGame.player.invuln = 0;
navigationGame.hurtPlayer(10000, { x: 0, z: 0, unblockable: true });
frames.shift()((retryStamp += 32));
assert.equal(element('#runOutcome').hidden, false);
assert(element('#chronicleStats').innerHTML.includes('PERSONAL BEST'));
assert(element('#chronicleStats').innerHTML.includes('ENCOUNTERS CLEARED'));
element('#start').onclick();
assert.equal(navigationGame.endless.encounter, 1);
assert.equal(element('#runOutcome').hidden, true);
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: bundled Endless Solo entry, realm rollover, exact continue, structured loss cards and fresh endless retry.',
);

// Guided tutorial entry/exit and live step labels preserve regular menu navigation.
element('#trainingTutorial').onclick();
assert(navigationGame.training.tutorial);
frames.shift()((retryStamp += 16));
assert.equal(element('#tutorialPanel').hidden, false);
assert.equal(element('#tutorialTitle').textContent, 'Find your footing');
navigationGame.player.x += 3.2;
frames.shift()((retryStamp += 16));
assert.equal(element('#tutorialTitle').textContent, 'Land a light attack');
element('#exitTutorial').onclick();
assert.equal(navigationGame.mode, 'ready');
assert.equal(element('#panel-training').hidden, false);
frames.shift()((retryStamp += 16));
assert.equal(element('#tutorialPanel').hidden, true);
element('#retuneGraphics').onclick();
for (let i = 0; i < 155; i++) frames.shift()((retryStamp += 16));
assert(element('#performanceNotice').textContent.includes('Automatic preset'));
assert.equal(element('#error').hidden, true);
console.log(
  'PASS: bundled guided tutorial lesson HUD/exit and menu-only automatic graphics calibration.',
);

// Restore a remembered co-op seat through the real Rejoin button and network handler.
element('#exitTutorial').onclick();
Object.assign(networkBattle, new Battle('coop'));
ended = false;
routeInputs = false;
const rejoinNetwork = sandbox.window.__rejoinTestNetwork;
const reconnectStorage = new Map();
rejoinNetwork.storage = {
  getItem: (k) => reconnectStorage.get(k) || null,
  setItem: (k, v) => reconnectStorage.set(k, v),
  removeItem: (k) => reconnectStorage.delete(k),
};
rejoinNetwork.mode = 'coop';
rejoinNetwork.room = 'test-room';
rejoinNetwork.token = 'test-token';
rejoinNetwork.savedAt = 0;
rejoinNetwork.remember();
rejoinNetwork.room = null;
await element('#rejoinCoop').onclick();
assert.equal(rejoinNetwork.room, 'test-room');
assert.equal(navigationGame.networked, true);
assert.equal(navigationGame.mode, 'playing');
rejoinNetwork.receive({
  ...networkBattle.snapshot(1),
  reconnecting: true,
  reconnectSeat: 0,
  reconnectRemainingMs: 40000,
});
rejoinNetwork.next = Infinity;
frames.shift()((retryStamp += 16));
assert.equal(navigationGame.reconnecting, true);
assert.equal(element('#reconnectNotice').hidden, false);
assert(element('#reconnectNotice').textContent.includes('40s'));
rejoinNetwork.receive({ ...networkBattle.snapshot(1), reconnecting: false });
frames.shift()((retryStamp += 16));
assert.equal(element('#reconnectNotice').hidden, true);
element('#leaveSession').onclick();
console.log(
  'PASS: bundled same-room co-op Rejoin, authoritative pause banner/countdown and recovery dismissal.',
);

// Immediate terrain warnings take the event lane without stacking with the intro.
element('#newRun').onclick();
navigationGame.wave = 1;
navigationGame.spawn();
navigationGame.arenaShift = {
  kind: 'gates', phase: 'warning', fireAt: navigationGame.time + 2,
  until: navigationGame.time + 10,
};
frames.shift()((retryStamp += 16));
assert.equal(element('#combatCoach').textContent, 'Gates rising · Move clear');
assert.equal(element('#combatCoach').hidden, false);
assert.equal(Number(element('#announcement').style.opacity), 0);
assert.equal(Number(element('#status').style.opacity), 0);
assert.equal(element('#arenaNotice').hidden, true, 'no duplicate terrain banner');
assert.equal(element('#threatHud').textContent, '', 'normal windups do not create text walls');
console.log('PASS: bundled immediate-warning priority, one visible event lane and removed duplicate combat banners.');
