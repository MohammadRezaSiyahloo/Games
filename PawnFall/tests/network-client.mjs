import assert from 'node:assert/strict';
import { NetworkClient } from '../src/client/network.mjs';
const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
{
  const c = new NetworkClient(),
    first = deferred(),
    cleanup = deferred();
  let searches = 0;
  c.request = async (path, body) => {
    if (path === 'session') return { token: 'token' };
    if (path === 'profile') return { profile: body };
    if (path === 'matchmaking') {
      searches++;
      return searches === 1 ? first.promise : { room: 'fresh' };
    }
    if (path === 'room' && body.leave) {
      assert.equal(body.room, 'old');
      await cleanup.promise;
      return { left: true };
    }
    throw Error(path);
  };
  const old = c.find('coop', { name: 'test' });
  await flush();
  assert.equal(searches, 1);
  await c.leave();
  const fresh = c.find('coop', { name: 'test' });
  await flush();
  assert.equal(searches, 1);
  first.resolve({ room: 'old' });
  await flush();
  assert.equal(searches, 1, 'new search waits for cancelled room cleanup');
  cleanup.resolve();
  assert((await old).cancelled);
  assert.equal((await fresh).room, 'fresh');
  assert.equal(c.room, 'fresh');
}
for (const fails of [false, true]) {
  const c = new NetworkClient(),
    poll = deferred();
  let errors = 0,
    states = 0;
  c.room = 'same-room';
  c.lastReceive = 0;
  c.onError = () => errors++;
  c.onState = () => states++;
  c.request = async (path, body) => (body.leave ? { left: true } : poll.promise);
  c.tick(20000, {});
  await c.leave();
  c.room = 'same-room';
  if (fails) poll.reject(Error('old connection'));
  else poll.resolve({ status: 'ended', players: [{}, {}], seat: 0 });
  await flush();
  assert.equal(errors, 0);
  assert.equal(states, 0, 'late response from old generation ignored even if room ID repeats');
}
{
  const c = new NetworkClient(),
    session = deferred();
  let sessions = 0;
  c.request = async () => {
    sessions++;
    return session.promise;
  };
  const a = c.connect('one'),
    b = c.connect('one');
  assert.equal(sessions, 1, 'concurrent profile sync and matchmaking share connection');
  session.resolve({ token: 'one-session' });
  await Promise.all([a, b]);
  assert.equal(c.token, 'one-session');
}
{
  const c = new NetworkClient();
  c.room = 'waiting-room';
  let snapshot;
  c.onState = (s) => (snapshot = s);
  c.request = async () => ({ status: 'waiting', mode: 'coop', code: 'P12345' });
  c.tick(100, {});
  await flush();
  assert.equal(snapshot.status, 'waiting');
  assert(Number.isFinite(c.ping));
  let sent;
  c.request = async (path, body) => {
    sent = body.control;
    return { status: 'playing', series: 2, round: 1, phase: 'ready' };
  };
  c.command('ready', { series: 2, round: 1 });
  c.tick(1000, {});
  await flush();
  assert.deepEqual(sent, { kind: 'ready', series: 2, round: 1 });
  assert.equal(c.pendingControl, null);
  c.request = async () => {
    throw Error('offline');
  };
  c.tick(3000, {});
  await flush();
  assert.equal(c.failures, 1);
  assert.equal(c.room, 'waiting-room', 'waiting lobby keeps polling');
}
console.log(
  'PASS: cancel/requeue serialization, cancelled-room cleanup, stale poll responses and failures, shared session startup, and waiting-room persistence.',
);
