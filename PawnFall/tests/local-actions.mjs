import { Battle } from '../src/shared/battle.mjs';
import assert from 'node:assert/strict';
import { LocalActionPresentation } from '../src/client/local-action-presentation.mjs';
const p = {
  state: 'idle',
  hp: 100,
  stamina: 100,
  weapon: 'longsword',
  attackAt: 0,
  dodgeEnd: 0,
  stagger: 0,
};
const local = new LocalActionPresentation();
local.begin('attack', 1, p, 100, 1);
let pose = local.sample(p, 116, {}, 1);
assert.equal(pose.state, 'attack');
assert(pose.visualAttackPhase > 0 && pose.visualAttackPhase < 0.1);
assert.equal(p.state, 'idle');
assert.equal(p.stamina, 100);
local.confirm([{ type: 'actionAck', seat: 0, actionId: 1, accepted: false }], 0, p);
assert.equal(local.sample(p, 130, {}, 1).state, 'idle');
local.begin('attack', 2, p, 200, 1);
const attacking = { ...p, state: 'attack', attackAt: 1.05 };
local.confirm([{ type: 'actionAck', seat: 0, actionId: 2, accepted: true }], 0, attacking);
pose = local.sample(attacking, 400, {}, 1.2);
assert(Math.abs(pose.visualAttackPhase - 0.2 / 0.48) < 1e-9, 'confirmation preserves local phase');
assert.equal(
  local.sample(attacking, 700, {}, 1.6).state,
  'idle',
  'late server pose cannot replay a completed swing',
);
local.reset();
local.begin('dodge', 3, p, 800, 2);
assert.equal(local.sample(p, 816, {}, 2).state, 'dodge');
assert.equal(local.sample({ ...p, state: 'hurt', stagger: 3 }, 820, {}, 2).state, 'hurt');
assert.equal(local.preview, null);
assert.equal(local.sample(p, 900, { block: true }, 3).state, 'block');
assert.equal(
  local.sample({ ...p, state: 'block' }, 916, {}, 3).state,
  'idle',
  'release guard immediately',
);
local.begin('attack', 4, { ...p, stamina: 0 }, 1000, 3);
assert.equal(local.preview, null, 'insufficient stamina does not predict a swing');
console.log(
  'PASS: immediate cosmetic actions, rejection, confirmation continuity, no replay, hurt cancellation, guard release and authoritative resources.',
);

const battle = new Battle('versus', [{ name: 'A' }, { name: 'B' }]);
battle.setInput(0, {
  actions: [
    { n: 1, kind: 'attack' },
    { n: 2, kind: 'attack' },
  ],
});
battle.step(1 / 60);
const acks = battle.events.filter((e) => e.type === 'actionAck');
assert.deepEqual(
  acks.map((e) => [e.actionId, e.accepted, e.seat]),
  [
    [1, true, 0],
    [2, false, 0],
  ],
);
battle.step(1 / 60);
assert.equal(
  battle.events.filter((e) => e.type === 'actionAck').length,
  2,
  'retried input does not repeat action confirmations',
);
battle.games[0].hp = 0;
battle.setInput(0, { actions: [{ n: 3, kind: 'dodge' }] });
battle.step(1 / 60);
assert.equal(
  battle.acks[0],
  3,
  'dead-player actions are consumed rather than replayed after revival',
);
assert.equal(battle.events.find((e) => e.actionId === 3)?.accepted, false);

local.reset();
local.begin('attack', 5, p, 1200, 4);
local.begin('dodge', 6, p, 1250, 4);
assert.equal(
  local.sample(p, 1266, {}, 4).state,
  'dodge',
  'roll anticipation can interrupt an attack',
);

local.reset();
local.begin('dodge', 7, p, 1400, 5, { x: -1, z: 0 });
const roll = local.sample(p, 1416, {}, 5);
assert.equal(roll.dx, -1);
assert.equal(roll.dz, 0, 'predicted roll preserves input direction before confirmation');
