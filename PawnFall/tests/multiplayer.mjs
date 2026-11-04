import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { api } from '../src/server/api.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { Progression } from '../src/client/progression.mjs';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../drizzle/0000_multiplayer.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        const stmt = sqlite.prepare(sql);
        return {
          async first() {
            return stmt.get(...args) || null;
          },
          async run() {
            const x = stmt.run(...args);
            return { meta: { changes: Number(x.changes) } };
          },
        };
      },
    };
  },
};
let now = 1793415600000;
const originalNow = Date.now;
Date.now = () => now;

async function call(path, token, data = {}, owner) {
  const r = await api(
    new Request('https://game.test/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Game-Token': token } : {}),
        ...(owner ? { 'oai-authenticated-user-id': owner } : {}),
      },
      body: JSON.stringify(data),
    }),
    { DB },
  );
  return { status: r.status, ...(await r.json()) };
}
const a = (await call('session', null, { name: 'A' }, 'owner-a')).token,
  b = (await call('session', null, { name: 'B' }, 'owner-b')).token,
  c = (await call('session', null, { name: 'C' }, 'owner-c')).token;
assert.equal((await call('profile', 'wrong')).status, 401);
await call('profile', a, {
  name: 'A',
  weapon: 'warhammer',
  stats: { confessorKills: 1, parries: 20 },
  skin: 'pale',
  title: 'oracle',
});
await call('profile', b, { name: 'B', weapon: 'rapier' });
let room = await call('matchmaking', a, { mode: 'coop' });
assert(room.room);
let waiting = await call('room', a, { room: room.room });
assert.equal(waiting.status, 'waiting');
let vs = await call('matchmaking', c, { mode: 'versus' });
assert.notEqual(vs.room, room.room, 'modes do not cross-match');
let joined = await call('matchmaking', b, { mode: 'coop' });
assert.equal(joined.room, room.room);
assert.equal((await call('room', c, { room: room.room })).status, 404, 'room authorization');
let readySnap = await call('room', a, { room: room.room });
assert.equal(readySnap.phase, 'ready');
await call('room', a, { room: room.room, control: { kind: 'ready', series: 1, round: 1 } });
await call('room', b, { room: room.room, control: { kind: 'ready', series: 1, round: 1 } });
for (let i = 0; i < 7; i++) {
  now += 500;
  await call('room', a, { room: room.room });
  await call('room', b, { room: room.room });
}
assert.equal((await call('room', a, { room: room.room })).phase, 'combat');

now += 150;
let snap = await call('room', a, {
  room: room.room,
  input: { x: 1, z: 0, hp: 99999, actions: [{ n: 1, kind: 'dodge' }] },
});
assert.equal(snap.status, 'playing');
assert.equal(snap.players.length, 2);
assert.equal(snap.players[0].weapon, 'warhammer');
assert.equal(snap.players[1].weapon, 'rapier');
assert.equal(snap.seat, 0);
assert(snap.players[0].stamina < 100);
assert.equal(snap.players[0].hp, 100, 'client cannot set hp');
assert.equal(snap.acks[0], 1);
const stamina = snap.players[0].stamina;
now += 150;
snap = await call('room', a, { room: room.room, input: { actions: [{ n: 1, kind: 'dodge' }] } });
assert(snap.players[0].stamina >= stamina, 'actions are deduplicated');
now += 150;
let peer = await call('room', b, { room: room.room, input: { x: -1, z: 0 } });
assert.equal(peer.seat, 1);
assert.equal(peer.names[0], 'A');
await call('room', b, { room: room.room, leave: true });
assert.equal((await call('room', a, { room: room.room })).status, 'ended');
await call('room', c, { room: vs.room, leave: true });
let privateRoom = await call('matchmaking', a, { mode: 'versus', private: true });
assert(privateRoom.code.startsWith('P'));
let notPrivate = await call('matchmaking', b, { mode: 'versus' });
assert.notEqual(privateRoom.room, notPrivate.room);
await call('room', b, { room: notPrivate.room, leave: true });
let privateJoin = await call('matchmaking', b, { code: privateRoom.code });
assert.equal(privateJoin.room, privateRoom.room);
now += 13000;
let stale = await call('room', a, { room: privateRoom.room });
assert.equal(stale.status, 'ended');
assert.equal(stale.winner, 0, 'disconnected rival forfeits');
const prof = await call('profile', a, {
  name: 'A',
  stats: { kills: 1 },
  completed: [],
  skin: 'void',
});
assert.equal(prof.profile.skin, 'ivory', 'locked skin rejected');
assert(prof.profile.unlocked.includes('first_blood'));
const prof2 = await call('profile', a, { ...prof.profile, skin: 'ember' });
assert.equal(prof2.profile.skin, 'ember');
const bossProfile = await call('profile', a, {
  ...prof2.profile,
  stats: { ...prof2.profile.stats, castellanKills: 1 },
  skin: 'siege',
  title: 'siegebreaker',
});
assert.equal(bossProfile.profile.skin, 'siege');
assert.equal(bossProfile.profile.title, 'siegebreaker');
assert(bossProfile.profile.unlocked.includes('castellan'));
assert(
  bossProfile.profile.encountered.includes('castellan'),
  'existing boss victories unlock their bestiary entry',
);
const discovered = await call('profile', a, { encountered: ['pawn', 'bishop', 'invalid'] });
assert(discovered.profile.encountered.includes('pawn'));
assert(discovered.profile.encountered.includes('bishop'));
assert(discovered.profile.encountered.includes('castellan'));
assert(!discovered.profile.encountered.includes('invalid'));
const mergedDiscoveries = await call('profile', a, { encountered: ['knight'] });
assert(mergedDiscoveries.profile.encountered.includes('bishop'));
assert(mergedDiscoveries.profile.encountered.includes('knight'));
console.log(
  'PASS: real-SQL bestiary discovery validation, account merging and existing boss history migration.',
);

let battle = new Battle('versus', [
  { name: 'A', skin: 'ivory' },
  { name: 'B', skin: 'ivory' },
]);
battle.games[0].player.x = 0;
battle.games[0].player.z = 1;
battle.games[1].player.x = 0;
battle.games[1].player.z = -1;
for (let n = 1; n <= 8 && battle.status === 'playing'; n++) {
  battle.setInput(0, { actions: [{ n, kind: 'attack' }] });
  for (let i = 0; i < 24; i++) battle.step(0.03);
  battle = Battle.restore(JSON.parse(JSON.stringify(battle.serialize())));
}
assert.equal(battle.status, 'ended');
assert.equal(battle.winner, 0, 'authoritative duel victory');
battle = new Battle('coop', [
  { name: 'A', skin: 'ivory' },
  { name: 'B', skin: 'ivory' },
]);
battle.games[0].hp = 0;
battle.games[0].mode = 'dead';
battle.games[0].enemies.forEach((e) => (e.dead = true));
for (let i = 0; i < 100; i++) battle.step(0.03);
assert.equal(battle.wave, 1);
assert(battle.games[0].hp >= 40, 'downed teammate revives on clear');
assert.equal(battle.games[0].enemies, battle.games[1].enemies, 'shared enemy state');
const memory = new Map();
const storage = { getItem: (k) => memory.get(k), setItem: (k, v) => memory.set(k, v) };
let progression = new Progression(storage);
progression.add('kills');
assert(progression.data.unlocked.includes('first_blood'));
assert(progression.equip('ember'));
assert(!progression.equip('void'));
progression.data.completed = ['ashen', 'frost', 'verdant', 'eclipse'];
progression.check();
assert(progression.equip('void'));
const loaded = new Progression(storage);
assert.equal(loaded.data.skin, 'void');
// Full persisted series/ready/rematch flow, plus format isolation in the queue.
const d = (await call('session', null, { name: 'D' }, 'owner-d')).token;
const e = (await call('session', null, { name: 'E' }, 'owner-e')).token;
const f = (await call('session', null, { name: 'F' }, 'owner-f')).token;
const one = await call('matchmaking', f, { mode: 'versus', bestOf: 1 });
const three = await call('matchmaking', d, { mode: 'versus', bestOf: 3 });
assert.notEqual(one.room, three.room);
assert.equal(
  (await call('matchmaking', e, { mode: 'versus', bestOf: 3 })).room,
  three.room,
  'format-specific public matchmaking',
);
let series = await call('room', d, { room: three.room });
assert.equal(series.phase, 'ready');
assert.equal(series.bestOf, 3);
await call('room', d, { room: three.room, control: { kind: 'ready', series: 99, round: 1 } });
assert.deepEqual((await call('room', d, { room: three.room })).ready, [false, false]);

async function readyBoth(round) {
  await Promise.all([
    call('room', d, { room: three.room, control: { kind: 'ready', series: 1, round } }),
    call('room', e, { room: three.room, control: { kind: 'ready', series: 1, round } }),
  ]);
  for (let i = 0; i < 7; i++) {
    now += 500;
    await call('room', d, { room: three.room });
    await call('room', e, { room: three.room });
  }
  assert.equal((await call('room', d, { room: three.room })).phase, 'combat');
}

function loseGuest() {
  const row = sqlite.prepare('SELECT state FROM pf_rooms WHERE id=?').get(three.room);
  const state = JSON.parse(row.state);
  state.games[1].hp = 0;
  sqlite.prepare('UPDATE pf_rooms SET state=? WHERE id=?').run(JSON.stringify(state), three.room);
}
await readyBoth(1);
loseGuest();
now += 50;
series = await call('room', d, { room: three.room });
assert.equal(series.phase, 'roundEnd');
assert.deepEqual(series.scores, [1, 0]);
await readyBoth(1);
loseGuest();
now += 50;
series = await call('room', d, { room: three.room });
assert.equal(series.status, 'ended');
assert.deepEqual(series.scores, [2, 0]);
assert.equal(series.winner, 0);
series = await call('room', d, {
  room: three.room,
  control: { kind: 'rematch', series: 1, round: 2 },
});
assert.equal(series.status, 'ended');
assert.equal(series.rematch[0], true);
series = await call('room', e, {
  room: three.room,
  control: { kind: 'rematch', series: 1, round: 2 },
});
assert.equal(series.status, 'playing');
assert.equal(series.series, 2);
assert.equal(series.phase, 'ready');
assert.deepEqual(series.scores, [0, 0]);
await call('room', e, { room: three.room, leave: true });
series = await call('room', d, { room: three.room });
assert.equal(series.status, 'ended');
assert.equal(series.winner, 0);
assert.equal(series.peerConnected, false);
assert.equal(
  (await call('room', d, { room: three.room, control: { kind: 'rematch', series: 2, round: 1 } }))
    .series,
  2,
);
await call('room', f, { room: one.room, leave: true });
console.log(
  'PASS: real-SQL ready/countdown, format isolation, concurrent ready requests, full series scoring, persisted rematches and departure handling.',
);

const t1 = (await call('session', null, { name: 'T1' }, 'tactics-a')).token;
const t2 = (await call('session', null, { name: 'T2' }, 'tactics-b')).token;
const t3 = (await call('session', null, { name: 'T3' }, 'tactics-c')).token;
const trainingQueue = await call('matchmaking', t1, { mode: 'coop', difficulty: 'pilgrim' });
const veteranQueue = await call('matchmaking', t2, { mode: 'coop', difficulty: 'veteran' });
assert.notEqual(trainingQueue.room, veteranQueue.room, 'public co-op queues isolate difficulties');
const partner = await call('matchmaking', t3, { mode: 'coop', difficulty: 'pilgrim' });
assert.equal(partner.room, trainingQueue.room);
const difficultyState = await call('room', t3, { room: partner.room });
assert.equal(
  difficultyState.difficulty,
  'pilgrim',
  'chosen difficulty reaches the authoritative battle',
);
await call('room', t1, { room: trainingQueue.room, leave: true });
await call('room', t2, { room: veteranQueue.room, leave: true });
console.log(
  'PASS: real-SQL co-op difficulty queue isolation and authoritative difficulty startup.',
);

const relicToken = (await call('session', null, { name: 'Relic tester' }, 'relic-owner')).token;
let relicProfile = await call('profile', relicToken, { bossRelic: 'mirror' });
assert.equal(
  relicProfile.profile.bossRelic,
  'none',
  'locked relic cannot be selected through the API',
);
relicProfile = await call('profile', relicToken, {
  stats: { confessorKills: 1 },
  bossRelic: 'mirror',
});
assert.equal(relicProfile.profile.bossRelic, 'mirror');
const relicRoom = await call('matchmaking', relicToken, { mode: 'coop', private: true });
const relicGuest = (await call('session', null, { name: 'Relic ally' }, 'relic-guest')).token;
await call('matchmaking', relicGuest, { code: relicRoom.code });
const relicState = await call('room', relicToken, { room: relicRoom.room });
assert.equal(
  relicState.players[0].bossRelic,
  'mirror',
  'earned relic reaches authoritative co-op simulation',
);
await call('room', relicToken, { room: relicRoom.room, leave: true });
console.log('PASS: relic unlock validation, profile persistence and authoritative co-op loadout.');
Date.now = originalNow;
console.log(
  'PASS: real SQL schema, matchmaking, mode isolation, room authorization, action deduplication, private rooms, disconnects, profiles, reward gating, authoritative PvP, co-op revival, serialization, progression persistence.',
);
