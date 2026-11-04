import { Progression } from '../src/client/progression.mjs';
import assert from 'node:assert/strict';
import { Game, stats, dist } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { DIFFICULTIES, updateHazards } from '../src/shared/combat-rules.mjs';
import { configureTraining, recordPractice } from '../src/shared/training.mjs';
const step = (g, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds / 0.02); i++)
    g.update(0.02, { ...input, skipProgression: true });
};

function single(type = 'pawn', difficulty = 'standard') {
  const g = new Game();
  g.difficulty = difficulty;
  g.reset();
  configureTraining(g, stats, { enemy: type, unlimited: false });
  g.training = null;
  g.objective = null;
  g.player.x = 0;
  g.player.z = 2;
  g.player.face = Math.PI;
  const e = g.enemies[0];
  e.cooldown = 0;
  e.face = 0;
  return g;
}
{
  const g = new Game();
  assert(
    g.enemies.some((e) => e.guardCapable),
    'opening introduces a frontal guard',
  );
  assert(g.enemies.filter((e) => e.role === 'flanker').length === 2);
  assert(
    g.enemies.some((e) => e.type === 'knight'),
    'opening includes a committed leap to punish careless pressure',
  );
  const first = g.enemies.map((e) => e.hp);
  g.difficulty = 'nightmare';
  g.reset();
  assert(g.enemies.every((e, i) => e.hp > first[i]));
  const timings = [];
  for (const id of Object.keys(DIFFICULTIES)) {
    const g = single('pawn', id);
    g.update(0.02, { skipProgression: true });
    timings.push(g.enemies[0].until - g.time);
    assert.equal(g.enemies[0].state, 'windup');
  }
  assert(
    timings.every((v, i) => !i || v < timings[i - 1]),
    'higher difficulty shortens telegraphs',
  );
}
for (const difficulty of Object.keys(DIFFICULTIES)) {
  const g = new Game();
  g.difficulty = difficulty;
  g.reset();
  g.hp = 100;
  g.player.z = 1.5;
  g.enemies.forEach((e, i) => Object.assign(e, { x: (i - 1) * 1.3, z: 0, cooldown: 0 }));
  g.update(0.02, { skipProgression: true });
  assert.equal(
    g.enemies.filter((e) => e.state === 'windup').length,
    DIFFICULTIES[difficulty].attackers,
  );
}
{
  const g = single('knight');
  g.player.z = 6;
  g.enemies[0].cooldown = 10;
  g.update(0.02, { skipProgression: true });
  assert(Math.abs(g.enemies[0].x) > 0.01, 'knights approach from a flank');
  const b = single('bishop');
  b.enemies[0].cooldown = 10;
  const before = dist(b.player, b.enemies[0]);
  b.update(0.02, { skipProgression: true });
  assert(dist(b.player, b.enemies[0]) > before, 'bishops retreat from close pressure');
  const p = single();
  p.update(0.02, { skipProgression: true });
  step(p, 0.5);
  const facing = p.enemies[0].face;
  p.player.x = 5;
  step(p, 0.1);
  assert.equal(p.enemies[0].face, facing, 'committed attacks do not track a late dodge');
}
{
  const g = single('queen');
  g.player.invuln = 100;
  step(g, 4);
  const tells = g.events.filter((e) => e.type === 'windup');
  assert.equal(tells.length, 3);
  assert.equal(tells.filter((e) => e.kind === 'chain').length, 2);
  assert.equal(g.enemies[0].state, 'recover', 'three strikes end in a punish window');
}
{
  const guarded = () => {
    const g = single();
    const e = g.enemies[0];
    e.guarding = true;
    e.guardCapable = true;
    e.hp = e.max = 200;
    g.time = 1;
    return g;
  };
  let g = guarded();
  g.hitEnemy(g.enemies[0], 32);
  assert.equal(g.enemies[0].hp, 192);
  g = guarded();
  g.combo = 2;
  g.hitEnemy(g.enemies[0], 46);
  assert.equal(g.enemies[0].hp, 154);
  g = guarded();
  g.weapon = 'warhammer';
  g.hitEnemy(g.enemies[0], 55);
  assert.equal(g.enemies[0].hp, 145);
  g = guarded();
  g.player.z = -2;
  g.hitEnemy(g.enemies[0], 32);
  assert.equal(g.enemies[0].hp, 168);
  assert(g.events.some((e) => e.type === 'flank'));
  g = guarded();
  g.hitEnemy(g.enemies[0], 32);
  g.hitEnemy(g.enemies[0], 32);
  assert.equal(g.enemies[0].state, 'stagger', 'guarded hits still build posture');
}
{
  const g = new Game();
  g.reset();
  g.time = 1;
  g.player.z = 0;
  g.player.face = 0;
  g.player.block = true;
  g.guardPressedAt = 1;
  g.hurtPlayer(20, { x: 0, z: 1, type: 'pawn' });
  assert.equal(g.objective.progress, 1);
  assert.equal(g.souls, 0, 'bonus requires clearing the encounter');
  g.rewardObjective();
  assert.equal(g.souls, 120);
  g.rewardObjective();
  assert.equal(g.souls, 120, 'bonus cannot pay twice');
  g.wave = 2;
  g.spawn();
  assert(
    g.enemies.some((e) => e.guardCapable),
    'flanking bonus has a guarded target',
  );
}
{
  const g = single();
  g.wave = 1;
  g.hazardAt = 0;
  g.player.x = 0;
  g.player.z = 6;
  updateHazards(g, 0.02);
  assert.equal(g.hazards.length, 1);
  const h = g.hazards[0];
  g.player[h.axis] = h.lane;
  g.time = h.fireAt - 0.01;
  updateHazards(g, 0.02);
  assert.equal(g.hp, 100);
  g.time = h.fireAt + 0.01;
  g.player.block = true;
  g.guardPressedAt = g.time;
  updateHazards(g, 0.02);
  const hp = g.hp;
  assert(hp < 100, 'arena strike deals damage after its visible tell');
  updateHazards(g, 0.02);
  assert.equal(g.hp, hp, 'same strike hits each player at most once');
  g.time = h.until + 0.01;
  updateHazards(g, 0.02);
  assert.equal(g.hazards.length, 0);
}
{
  const g = new Game();
  g.reset();
  configureTraining(g, stats, { enemy: 'pawn', behavior: 'dummy' });
  g.hurtPlayer(1000, { x: 0, z: 0 });
  assert.equal(g.hp, 1);
  assert.equal(g.mode, 'playing');
  g.hitEnemy(g.enemies[0], 1000);
  assert.equal(g.souls, 0);
  step(g, 1);
  assert(!g.enemies[0].dead);
  assert.equal(g.wave, 0);
  assert.equal(g.mode, 'playing');
  assert.equal(g.stamina, 100);
  assert.equal(g.objective, null);
  recordPractice(g, { type: 'parry' });
  recordPractice(g, { type: 'hurt', id: 'sparring', damage: 32 });
  assert.equal(g.training.parries, 1);
  assert.equal(g.training.damage, 32);
}
const coop = () => {
  const b = new Battle('coop', [{ name: 'A' }, { name: 'B' }], { difficulty: 'veteran' });
  b.games[0].enemies.forEach((e) => (e.cooldown = 999));
  b.games[0].hp = 0;
  Object.assign(b.games[0].player, { x: 0, z: 5 });
  Object.assign(b.games[1].player, { x: 1, z: 5 });
  return b;
};
const advance = (b, s) => {
  for (let i = 0; i < Math.ceil(s / 0.02); i++) b.step(0.02);
};
{
  let b = coop();
  b.setInput(1, { revive: true });
  advance(b, 1);
  assert(b.games[0].player.reviveProgress > 0.3);
  const saved = JSON.parse(JSON.stringify(b.serialize()));
  b = Battle.restore(saved);
  assert.equal(b.difficulty, 'veteran');
  assert(b.games[0].player.reviveProgress > 0.3);
  b.setInput(1, {});
  b.step(0.02);
  assert.equal(b.games[0].player.reviveProgress, 0, 'releasing interrupts revival');
  b.setInput(1, { revive: true });
  b.games[1].player.x = 8;
  advance(b, 0.2);
  assert.equal(b.games[0].player.reviveProgress, 0, 'must stay nearby');
  b.games[1].player.x = 1;
  advance(b, 0.8);
  b.games[1].hurtPlayer(5, { x: 0, z: 4 });
  b.step(0.02);
  assert.equal(b.games[0].player.reviveProgress, 0, 'taking damage interrupts revival');
  advance(b, 3.6);
  assert.equal(b.games[0].hp, 40);
  assert(!b.games[0].player.dead);
  assert(b.events.some((e) => e.type === 'revived'));
  b = coop();
  advance(b, 30.1);
  assert(b.games[0].player.eliminated);
  b.setInput(1, { revive: true });
  advance(b, 3.2);
  assert.equal(b.games[0].hp, 0, 'expired downed window cannot be revived manually');
}
{
  const b = coop();
  b.games[0].hp = 100;
  b.setInput(1, { actions: [{ kind: 'ping', n: 1 }] });
  b.step(0.02);
  assert.equal(b.pings.length, 1);
  assert.equal(b.pings[0].seat, 1);
  b.setInput(1, { actions: [{ kind: 'ping', n: 2 }] });
  b.step(0.02);
  assert.equal(b.events.filter((e) => e.type === 'teamPing').length, 1, 'pings rate limited');
  advance(b, 5.1);
  assert.equal(b.pings.length, 0);
  assert.equal(b.snapshot(0).difficulty, 'veteran');
  const pvp = new Battle('versus', [{}, {}], { difficulty: 'nightmare' });
  assert.equal(pvp.difficulty, 'standard', 'PvP does not inherit campaign multipliers');
}
console.log(
  'PASS: difficulty timing/attacker budgets, opening guard and flanks, bishop retreat, committed aim, queen chains, guard counters, objective rewards, warned hazards, safe training, authoritative revives, expiry, persistence, ping throttling and PvP isolation.',
);

const career = new Progression({
  getItem() {
    return null;
  },
  setItem() {},
});
career.event({ type: 'objectiveReward', reward: 120 }, 'ashen');
assert.equal(career.data.stats.souls, 120, 'claimed objective bonus persists in career souls');
// Sharper Court: healing creates pressure without skipping the readable tell.
{
  const { updateEnemy } = await import('../src/shared/enemy-ai.mjs');

  function chase(difficulty, state) {
    const g = single('pawn', difficulty);
    g.player.z = 8;
    g.player.state = state;
    const e = g.enemies[0];
    e.role = 'sentinel';
    e.cooldown = 20;
    const before = dist(e, g.player);
    updateEnemy(g, e, 0.05, stats);
    return before - dist(e, g.player);
  }
  assert(
    chase('standard', 'heal') > chase('standard', 'idle') * 1.25,
    'flask recovery prompts a faster direct approach',
  );
  assert.equal(
    chase('pilgrim', 'heal'),
    chase('pilgrim', 'idle'),
    'Pilgrim keeps its forgiving pace',
  );
  const g = single('pawn');
  g.player.state = 'heal';
  g.enemies[0].cooldown = 0;
  updateEnemy(g, g.enemies[0], 0.02, stats);
  assert.equal(g.enemies[0].state, 'windup');
  assert(g.enemies[0].until - g.time >= 0.38, 'pursuit never bypasses the attack tell');
  for (const id of ['pilgrim', 'standard', 'veteran', 'nightmare']) {
    const g = new Game();
    g.difficulty = id;
    g.reset();
    g.stamina = 40;
    g.time = 1;
    g.update(0.05, { block: true, skipAI: true, skipProgression: true });
    assert(Math.abs(g.stamina - (40 + 0.05 * DIFFICULTIES[id].guardRegen)) < 1e-8);
  }
  const b = new Battle('coop');
  b.games[0].hp = 5;
  b.games[1].hp = 0;
  if (b.games[0].arenaObjective) b.games[0].arenaObjective.complete = true;
  b.games[0].enemies.forEach((e) => (e.dead = true));
  for (let i = 0; i < 150; i++) b.step(0.02);
  assert.equal(b.wave, 1);
  assert.equal(b.games[0].hp, 15, 'a living ally receives only the declared healing');
  assert.equal(b.games[1].hp, 40, 'encounter clear still revives a downed ally');
}
console.log(
  'PASS: flask pursuit preserves attack tells, Pilgrim isolation, difficulty-specific guard recovery and honest co-op intermission healing.',
);
