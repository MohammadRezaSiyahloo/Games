import { showChronicle, saveChronicleCard } from '../src/client/run-chronicle.mjs';
import assert from 'node:assert/strict';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { createFallenKing, updateFallenKing } from '../src/shared/fallen-king.mjs';
import { weaponById, WEAPONS, attackByKind } from '../src/shared/arsenal.mjs';
import { offerEvent, eventCanChoose } from '../src/shared/encounter-events.mjs';
import { captureCheckpoint, restoreCheckpoint } from '../src/shared/checkpoints.mjs';
import { teamAbility } from '../src/shared/team-abilities.mjs';
import { abilityGeometry } from '../src/shared/piece-abilities.mjs';
import {
  chronicleData,
  chronicleText,
  cleanJournal,
  recordChronicle,
} from '../src/shared/run-chronicle.mjs';
import { attackPose, heavyAttackPose } from '../src/client/attack-animation.mjs';
import { weaponStance, heavyBodyPose } from '../src/client/combat-motion.mjs';
import { Progression } from '../src/client/progression.mjs';

function at(wave = 1, chapter = 0) {
  const g = new Game();
  g.reset(chapter);
  g.wave = wave;
  g.spawn();
  return g;
}

function intermission(g) {
  while (g.upgradeChoices.length) g.chooseUpgrade(g.upgradeChoices[0]);
  if (g.promotionChoices.length) g.choosePromotion('pawn');
  if (g.eventChoices.length) g.chooseEvent('decline');
}
// Six actual weapons: costs, timing, range/arc and continuous distinct poses.
assert.equal(WEAPONS.length, 6);
assert.equal(weaponById('invalid').id, 'longsword');
for (const id of ['spear', 'twinblades', 'greatsword']) {
  const g = new Game();
  g.reset();
  g.setWeapon(id);
  g.player.x = g.player.z = 0;
  g.player.face = 0;
  const w = weaponById(id),
    e = {
      id: 't',
      type: 'pawn',
      hp: 2000,
      max: 2000,
      x: 0,
      z: w.range - 0.2,
      y: 0,
      state: 'approach',
      cooldown: 999,
      face: 0,
      dead: false,
    };
  g.enemies = [e];
  assert(g.attack());
  assert.equal(g.stamina, 100 - w.cost);
  for (let i = 0; i < Math.ceil((w.hitAt + 0.01) / 0.01); i++)
    g.update(0.01, { skipAI: true, skipProgression: true });
  assert(e.hp < 2000);
  for (const heavy of [false, true])
    for (let i = 0; i <= 200; i++) {
      const pose = heavy ? heavyAttackPose(i / 200, id) : attackPose(i / 200, id, i % 3);
      assert(Object.values(pose).every(Number.isFinite));
      assert(Object.values(heavyBodyPose(i / 200, id)).every(Number.isFinite));
    }
  assert.equal(weaponStance(id).support, id === 'twinblades' ? 0 : 1);
  assert(attackByKind(id, 'heavy').damage > w.damage);
}
assert(weaponById('spear').range > weaponById('greatsword').range);
assert(weaponById('twinblades').duration < weaponById('longsword').duration);
// The final monarch exists in the last realm, with a bounded court and two distinct phases.
{
  const g = at(4, 3),
    king = g.enemies[0];
  assert.equal(king.boss, 'fallenking');
  assert.equal(g.enemies.filter((e) => e.royal).length, 2);
  assert.equal(g.arenaObjective, null);
  g.hp = 10000;
  g.player.invuln = 999;
  let command = false;
  for (let i = 0; i < 600; i++) {
    g.time += 0.02;
    updateFallenKing(g, king, 0.02);
    command ||= g.events.some((e) => e.type === 'royalCommand');
    assert(g.enemies.filter((e) => e.royal && !e.dead).length <= 2);
  }
  assert(command);
  const hp = king.hp;
  g.hitEnemy(king, 20, 0);
  assert(king.hp < hp);
  king.hp = king.max * 0.49;
  g.time += 0.02;
  updateFallenKing(g, king, 0.02);
  assert.equal(king.phase, 2);
  assert(g.enemies.filter((e) => e.royal).every((e) => e.dead));
  assert(king.stolenBishop);
  let cross = false,
    double = false;
  for (let i = 0; i < 1000; i++) {
    g.time += 0.02;
    updateFallenKing(g, king, 0.02);
    cross ||= king.attackKind === 'royalCross';
    double ||= king.attackKind === 'doubleSweep';
    assert([king.x, king.z, king.until].every(Number.isFinite));
  }
  assert(cross && double);
  assert(g.enemies.filter((e) => e.royal).every((e) => e.dead));
  const souls = g.souls;
  g.hitEnemy(king, 1e6, 0);
  assert.equal(g.souls - souls, 2400);
  assert(g.journal.some((e) => e.type === 'bossDefeated' && e.boss === 'fallenking'));
}
// Killing the bishop before the sacrifice prevents the stolen cross attack.
{
  const g = at(4, 3),
    k = g.enemies[0];
  g.enemies.filter((e) => e.type === 'bishop').forEach((e) => (e.dead = true));
  k.hp = k.max * 0.4;
  updateFallenKing(g, k, 0.02);
  assert(!k.stolenBishop);
}
// First duel retreats without a kill bounty; return learns a counter, and defeat is permanent for this run.
for (const [key, adaptation] of [
  ['light', 'sentinel'],
  ['heavy', 'hunter'],
  ['blocks', 'breaker'],
]) {
  const g = at(1);
  const r = g.enemies.find((e) => e.rival);
  assert(r && !r.returning);
  g.tactics[key] = 10;
  const souls = g.souls;
  g.hitEnemy(r, 1e6, 0);
  assert(r.escaped && r.dead);
  assert.equal(g.souls, souls);
  assert.equal(g.rivalMemory.adaptation, adaptation);
  g.wave = 3;
  g.spawn();
  const returned = g.enemies.find((e) => e.rival);
  assert(returned.returning);
  assert.equal(returned.adaptation, adaptation);
  g.hitEnemy(returned, 1e6, 0);
  assert(g.rivalMemory.defeated);
  assert(g.journal.some((e) => e.type === 'rivalDefeated'));
  const h = new Game();
  assert(restoreCheckpoint(h, captureCheckpoint(g)));
  assert.equal(h.rivalMemory.adaptation, adaptation);
}
{
  const b = new Battle('coop');
  b.games[0].wave = 3;
  b.games[0].spawn();
  assert(b.games[0].enemies.some((e) => e.rival && e.returning));
  assert(b.games[0].enemies.some((e) => e.boss === 'castellan'));
}
// Events respect wallets, upgrade caps, free exits and checkpoint recreation without duplicate rewards.
for (const id of [
  'bargain',
  'duel',
  'temper',
  'forge:spear',
  'forge:greatsword',
  'forge:twinblades',
]) {
  const wave = id === 'bargain' ? 1 : id === 'duel' ? 2 : 3,
    g = at(wave);
  g.souls = 500;
  g.hp = 40;
  g.flasks = 2;
  offerEvent(g);
  const count = g.enemies.length;
  assert(eventCanChoose(g, id));
  assert(g.chooseEvent(id));
  assert(!g.chooseEvent(id));
  assert.equal(g.mode, 'playing');
  if (id === 'bargain') {
    assert.equal(g.hp, 65);
    assert.equal(g.flasks, 3);
    assert.equal(g.souls, 420);
  }
  if (id === 'duel') {
    assert.equal(g.enemies.length, count + 1);
    const e = g.enemies.find((e) => e.eventDuel);
    assert.equal(e.hp, 75);
    g.hitEnemy(e, 1e6);
    assert.equal(g.souls, 680);
  }
  if (id === 'temper') assert.equal(g.upgrades.force, 1);
  if (id.startsWith('forge:')) assert.equal(g.weapon, id.slice(6));
  const c = captureCheckpoint(g),
    h = new Game();
  assert(restoreCheckpoint(h, c));
  assert.equal(h.weapon, g.weapon);
  assert.equal(h.souls, g.souls);
  assert.equal(h.flasks, g.flasks);
  assert.equal(h.enemies.filter((e) => e.eventDuel).length, id === 'duel' ? 1 : 0);
  assert.equal(h.eventResolvedWave, h.wave);
}
{
  const g = at(3);
  g.souls = 0;
  offerEvent(g);
  assert(!g.chooseEvent('temper'));
  assert(!g.chooseEvent('forge:spear'));
  assert(g.chooseEvent('decline'));
}
{
  const g = at(3);
  g.souls = 999;
  g.upgrades.force = 3;
  offerEvent(g);
  assert(!g.chooseEvent('temper'));
}
// Geometry, timing and seat ownership gate team combinations; a cast may be consumed only once.

function cast(kind, from, target) {
  const a = { kind, from, aim: { x: 0, z: 1 }, target: target || from, corner: from };
  return a;
}
{
  const b = new Battle('coop', [{ chessClass: 'rook' }, { chessClass: 'bishop' }]),
    [a, c] = b.games;
  const e = a.enemies[0];
  Object.assign(e, { x: 0, z: 0, hp: 1000, max: 1000, guarding: false });
  a.player.id = 'p0';
  c.player.id = 'p1';
  const rook = cast('rook', { x: -5, z: 0 }, { x: 5, z: 0 }),
    bishop = cast('bishop', { x: 0, z: 0 });
  teamAbility(a, a.player, rook, abilityGeometry(rook));
  c.time = 0.5;
  teamAbility(c, c.player, bishop, abilityGeometry(bishop));
  assert(c.events.some((e) => e.type === 'teamCombo' && e.kind === 'crossing'));
  assert(e.hp < 1000);
  const hp = e.hp;
  teamAbility(c, c.player, bishop, abilityGeometry(bishop));
  assert.equal(e.hp, hp, 'spent cast cannot trigger twice');
  const restored = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert(restored.games[0].teamMemory.some((e) => e.spent));
}
{
  const b = new Battle('coop'),
    [a, c] = b.games;
  a.player.id = 'p0';
  c.player.id = 'p1';
  const king = cast('king', { x: 0, z: 0 }),
    queen = cast('queen', { x: 1, z: 1 });
  teamAbility(a, a.player, king, abilityGeometry(king));
  c.time = 1;
  teamAbility(c, c.player, queen, abilityGeometry(queen));
  assert.equal(c.player.wardUntil, 5);
  assert.equal(a.player.wardUntil, 5);
}
{
  const b = new Battle('coop'),
    [a, c] = b.games;
  const king = cast('king', { x: 0, z: 0 }),
    queen = cast('queen', { x: 10, z: 10 });
  teamAbility(a, a.player, king, abilityGeometry(king));
  c.time = 1;
  teamAbility(c, c.player, queen, abilityGeometry(queen));
  assert(!c.player.wardUntil);
}
// Intermission barriers consume commands once and serialize event choices.
{
  let b = new Battle('coop');
  b.games.forEach((g) => {
    g.wave = 3;
    g.souls = 500;
    offerEvent(g);
  });
  const t = b.time;
  b.setInput(0, { actions: [{ n: 1, kind: 'event:forge:spear' }] });
  b.step(0.02);
  assert.equal(b.games[0].weapon, 'spear');
  assert.equal(b.time, t);
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  b.step(0.02);
  assert.equal(b.games[0].souls, 340);
  b.setInput(1, { actions: [{ n: 1, kind: 'event:decline' }] });
  b.step(0.02);
  b.step(0.02);
  assert(b.time > t);
  const v = new Battle('versus');
  v.setInput(0, { actions: [{ n: 1, kind: 'event:forge:spear' }] });
  v.step(0.02);
  assert.equal(v.games[0].weapon, 'longsword');
}
// Chronicle is bounded, survives retries, and contains actual paths rather than invented outcomes.
{
  const g = at(1);
  recordChronicle(g, 'routeChosen', { route: 'champion' });
  recordChronicle(g, 'promoted', { piece: 'bishop' });
  recordChronicle(g, 'championDefeated', { title: 'The Ashen Cantor' });
  recordChronicle(g, 'eventChosen', { choice: 'bargain' });
  recordChronicle(g, 'rivalDefeated');
  recordChronicle(g, 'cleared');
  const d = chronicleData(g, 'Victory'),
    text = chronicleText(d);
  assert(text.includes('\n'));
  assert(text.includes('champion'));
  assert(text.includes('The Ashen Cantor'));
  assert.equal(d.promotion, 'bishop');
  assert.equal(d.rival, 'Defeated');
  for (let i = 0; i < 200; i++) recordChronicle(g, 'teamCombo', { kind: 'ward' });
  assert.equal(g.journal.length, 100);
  assert.equal(cleanJournal([{ type: 'unknown', wave: 0 }]).length, 0);
  const p = new Progression();
  p.event({ type: 'bossDefeated', boss: 'fallenking' }, 'eclipse');
  assert.equal(p.data.stats.fallenKingKills, 1);
  assert.equal(p.data.stats.castellanKills, 0);
  assert(p.data.unlocked.includes('regicide'));
}
console.log(
  'PASS: Fallen King court/sacrifice/counters/rewards, learned rival, six weapons/poses, priced events/checkpoints, authoritative team combinations, choice barriers, chronicle and Regicide reward.',
);

{
  const g = at(1),
    nodes = new Map();
  const text = [];
  let share;
  const ctx = {
    fillRect() {},
    strokeRect() {},
    fillText(t) {
      text.push(t);
    },
    measureText(t) {
      return { width: t.length * 12 };
    },
  };
  const doc = {
    querySelector(id) {
      if (!nodes.has(id)) nodes.set(id, {});
      return nodes.get(id);
    },
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        getContext() {
          return ctx;
        },
        toBlob(callback) {
          callback(new Blob(['card'], { type: 'image/png' }));
        },
      };
    },
  };
  const data = showChronicle(g, 'Victory', doc);
  assert.equal(nodes.get('#runChronicle').hidden, false);
  assert(nodes.get('#chronicleText').textContent.includes('PAWNFALL'));
  await saveChronicleCard(data, doc, {
    canShare() {
      return true;
    },
    async share(payload) {
      share = payload;
    },
  });
  assert.equal(share.files[0].name, 'pawnfall-run-chronicle.png');
  assert.equal(share.files[0].type, 'image/png');
  assert(text.some((t) => t === 'VICTORY'));
  console.log(
    'PASS: chronicle result presentation, multiline copy text and shareable PNG export contract.',
  );
}

{
  let b = new Battle('coop', [
    { weapon: 'spear', chessClass: 'pawn' },
    { weapon: 'rapier', chessClass: 'bishop' },
  ]);
  b.games[0].weapon = 'greatsword';
  b.games[0].chessClass = 'queen';
  b = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  b.resetRound();
  assert.equal(b.games[0].weapon, 'spear');
  assert.equal(b.games[0].chessClass, 'pawn');
  assert.equal(b.games[1].chessClass, 'bishop');
  assert(!b.games[0].promotionResolved);
  assert(!b.games[0].journal.some((e) => e.type === 'promoted'));
  assert.equal(b.snapshot(0).players[0].journal, undefined);
  b.status = 'ended';
  assert(Array.isArray(b.snapshot(0).players[0].journal));
  console.log(
    'PASS: rematches restore original loadouts; active LAN snapshots omit full chronicle history.',
  );
}

{
  const g = at(1);
  g.tactics = { light: 2, heavy: 7, blocks: 4 };
  const h = new Game();
  assert(restoreCheckpoint(h, captureCheckpoint(g)));
  assert.deepEqual(h.tactics, g.tactics);
  const b = new Battle('coop');
  const e = b.games[0].enemies[0];
  e.champion = 'pawn';
  e.name = 'Test champion';
  b.games[0].hitEnemy(e, 100000, 0);
  b.step(0.02);
  assert(b.games[1].journal.some((row) => row.type === 'championDefeated'));
  console.log(
    'PASS: checkpoints preserve rival learning inputs and co-op chronicles include shared champion victories.',
  );
}
