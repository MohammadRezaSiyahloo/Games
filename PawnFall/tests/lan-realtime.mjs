import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { LanRealtime } from '../src/server/lan-realtime.mjs';
import { api } from '../src/server/api.mjs';
import { readStateFrames, NetworkClient } from '../src/client/network.mjs';
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
let checkpoints = 0;
const runtime = new LanRealtime({
  prepare(sql) {
    if (sql.startsWith('UPDATE')) checkpoints++;
    return sqlite.prepare(sql);
  },
});
const server = http.createServer(async (req, res) => {
  try {
    const bytes = [];
    for await (const c of req) bytes.push(c);
    const body = Buffer.concat(bytes).toString();
    const data = body ? JSON.parse(body) : {};
    if (req.url === '/api/stream') {
      if (runtime.stream(req.headers['x-game-token'], data, res)) return;
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.url === '/api/room') {
      const r = runtime.input(req.headers['x-game-token'], data);
      if (r) {
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.body));
        return;
      }
    }
    const response = await api(
      new Request('http://game.test' + req.url, { method: 'POST', headers: req.headers, body }),
      { DB },
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch (e) {
    res.writeHead(500);
    res.end(e.message);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const post = (path, token, data = {}) =>
  fetch(origin + '/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Game-Token': token } : {}) },
    body: JSON.stringify(data),
  });
const call = async (path, token, data) => {
  const r = await post(path, token, data);
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
};
const readers = [],
  controllers = [],
  states = [[], []],
  tasks = [];

async function until(predicate) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 7000) throw Error('Timed out waiting for streamed state');
    await new Promise((r) => setTimeout(r, 10));
  }
}
try {
  const a = (await call('session', null, { name: 'A' })).token,
    b = (await call('session', null, { name: 'B' })).token;
  const room = await call('matchmaking', a, { mode: 'versus', bestOf: 3, private: true });
  await call('matchmaking', b, { code: room.code });
  const initial = await call('room', a, { room: room.room });
  assert.equal(initial.transport, 'lan-stream');
  assert.equal(initial.phase, 'ready');
  assert.equal(
    (await post('stream', 'bad', { room: room.room })).status,
    403,
    'stream authorization',
  );
  // Exercise the shipping browser client against the same real HTTP server.
  const cToken = (await call('session', null, { name: 'Client' })).token;
  const dToken = (await call('session', null, { name: 'Partner' })).token;
  const clientRoom = await call('matchmaking', cToken, { mode: 'versus', private: true });
  await call('matchmaking', dToken, { code: clientRoom.code });
  const originalFetch = globalThis.fetch;
  const client = new NetworkClient();
  client.token = cToken;
  client.room = clientRoom.room;
  const received = [];
  client.onState = (s) => received.push(s);
  globalThis.fetch = (url, options) =>
    originalFetch(String(url).startsWith('/') ? origin + url : url, options);
  try {
    client.tick(performance.now(), {});
    await until(() => client.streaming && received.length > 1);
    assert.equal(received.at(-1).transport, 'lan-stream');
    client.command('ready', received.at(-1));
    client.tick(performance.now(), {});
    await until(() => received.at(-1).ready[0]);
    client.streamController.abort();
    await until(() => !client.streamController);
    const count = received.length;
    client.next = 0;
    client.tick(performance.now(), {});
    await until(() => received.length > count);
    assert.equal(client.streaming, false, 'HTTP snapshots resume after stream failure');
    await client.leave();
  } finally {
    client.streamController?.abort();
    globalThis.fetch = originalFetch;
  }

  for (const [i, token] of [a, b].entries()) {
    const controller = new AbortController();
    controllers.push(controller);
    const response = await fetch(origin + '/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Game-Token': token },
      body: JSON.stringify({ room: room.room }),
      signal: controller.signal,
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const reader = response.body.getReader();
    readers.push(reader);
    tasks.push(
      (async () => {
        let buffer = '';
        const decoder = new TextDecoder();
        try {
          while (true) {
            const c = await reader.read();
            if (c.done) break;
            buffer += decoder.decode(c.value, { stream: true });
            const p = readStateFrames(buffer);
            buffer = p.rest;
            states[i].push(...p.states);
          }
        } catch {}
      })(),
    );
  }
  await until(() => states.every((s) => s.length > 0));
  await call('room', a, { room: room.room, control: { kind: 'ready', series: 1, round: 1 } });
  await call('room', b, { room: room.room, control: { kind: 'ready', series: 1, round: 1 } });
  await until(() => states.every((s) => s.at(-1).phase === 'combat' && s.at(-1).time > 0.1));
  assert(states[0].length > 40, 'steady snapshots without any room polling');
  const x = states[0].at(-1).players[0].x;
  const ack = await call('room', a, {
    room: room.room,
    input: { x: 1, z: 0, actions: [{ n: 1, kind: 'dodge' }] },
  });
  assert.equal(ack.streamed, true, 'input response sends only acknowledgements while streaming');
  await until(() => states[0].at(-1).acks[0] === 1 && states[0].at(-1).players[0].x > x);
  await new Promise((r) => setTimeout(r, 180));
  assert.equal(
    states[0].flatMap((s) => s.events).filter((e) => e.type === 'dodge').length,
    1,
    'effects sent once per stream',
  );
  assert.equal(states[1].flatMap((s) => s.events).filter((e) => e.type === 'dodge').length, 1);
  await call('room', b, { room: room.room, leave: true });
  await until(() => states[0].at(-1).status === 'ended');
  assert.equal(states[0].at(-1).winner, 0);
  assert.equal(states[0].at(-1).peerConnected, false);
  assert.equal(
    sqlite.prepare('SELECT status FROM pf_rooms WHERE id=?').get(room.room).status,
    'ended',
  );
  assert(checkpoints < 20, 'checkpoints are not written every simulation frame');
  console.log(
    'PASS: two authorized real HTTP streams, autonomous 60 Hz simulation, 20 Hz state delivery, ready/countdown, movement/action acknowledgements, single-delivery effects, forfeit and bounded database checkpointing.',
  );
} finally {
  for (const c of controllers) c.abort();
  runtime.close();
  await Promise.all(tasks);
  for (const r of readers) r.releaseLock();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  sqlite.close();
}
const fragments = readStateFrames('data: {"time":1}\n\ndata: {"time":');
assert.deepEqual(fragments.states, [{ time: 1 }]);
assert.equal(readStateFrames(fragments.rest + '2}\n\n').states[0].time, 2);
