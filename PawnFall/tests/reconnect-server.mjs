import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { api } from '../src/server/api.mjs';
import { LanRealtime } from '../src/server/lan-realtime.mjs';
import { Battle } from '../src/shared/battle.mjs';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync(new URL('../drizzle/0000_multiplayer.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        const q = sqlite.prepare(sql);
        return {
          async first() {
            return q.get(...args) || null;
          },
          async run() {
            return { meta: { changes: Number(q.run(...args).changes) } };
          },
        };
      },
    };
  },
};
const clock = Date.now;
let now = clock();
Date.now = () => now;

async function call(path, token, data = {}) {
  const r = await api(
    new Request('https://game.test/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Game-Token': token } : {}) },
      body: JSON.stringify(data),
    }),
    { DB },
  );
  return { http: r.status, ...(await r.json()) };
}
let runtime;
try {
  const a = (await call('session', null, { name: 'A' })).token,
    b = (await call('session', null, { name: 'B' })).token;

  async function room() {
    const r = await call('matchmaking', a, { mode: 'coop', private: true });
    await call('matchmaking', b, { code: r.code });
    sqlite
      .prepare('UPDATE pf_rooms SET state=?,host_seen=?,guest_seen=?,updated=? WHERE id=?')
      .run(JSON.stringify(new Battle('coop').serialize()), now, now, now, r.room);
    return r;
  }
  const r = await room();
  const first = await call('room', a, { room: r.room });
  const t = first.time;
  now += 4000;
  let paused = await call('room', a, { room: r.room, input: { x: 1 } });
  assert(paused.reconnecting);
  assert.equal(paused.reconnectSeat, 1);
  assert.equal(paused.time, t);
  now += 5000;
  paused = await call('room', a, { room: r.room });
  assert.equal(paused.time, t);
  assert(paused.reconnectRemainingMs > 30000);
  const returned = await call('room', b, { room: r.room, input: {} });
  assert(!returned.reconnecting);
  assert.equal(returned.time, t, 'returning does not fast-forward the disconnected interval');
  now += 100;
  const continued = await call('room', a, { room: r.room });
  assert(continued.time > t);
  assert.equal(continued.status, 'playing');
  const outsider = (await call('session', null, { name: 'Other' })).token;
  assert.equal((await call('room', outsider, { room: r.room })).http, 404);
  now += 46000;
  const expired = await call('room', b, { room: r.room });
  assert.equal(
    expired.status,
    'ended',
    'expired returning heartbeat cannot revive a finished match',
  );
  const lan = await room();
  runtime = new LanRealtime(sqlite);
  clearInterval(runtime.timer);
  runtime.input(a, { room: lan.room, input: {} });
  const cached = runtime.rooms.get(lan.room);
  cached.seen[1] = now - 4000;
  cached.seen[0] = now;
  const before = cached.battle.time;
  runtime.previous = performance.now() - 80;
  runtime.tick();
  assert.equal(cached.battle.time, before);
  assert(runtime.snapshot(cached, 0).reconnecting);
  runtime.input(b, { room: lan.room, input: { x: 1 } });
  runtime.previous = performance.now() - 80;
  runtime.tick();
  assert(cached.battle.time > before);
  assert(!runtime.snapshot(cached, 0).reconnecting);
  cached.seen[1] = now - 46000;
  cached.seen[0] = now;
  runtime.tick();
  assert.equal(cached.battle.status, 'ended');
  console.log(
    'PASS: real-SQL hosted co-op pause, same-room return, no catch-up, expiry/auth protection; LAN simulation pause, resume and grace expiry.',
  );
} finally {
  runtime?.close();
  Date.now = clock;
  sqlite.close();
}
