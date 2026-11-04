import { connectionRecovery, COOP_RECONNECT_MS } from '../shared/connection-recovery.mjs';
import { Battle } from '../shared/battle.mjs';
// The LAN process owns a live simulation. SQLite checkpoints retain room recovery;
// input delivery and simulation frames do not write to the database.

export class LanRealtime {
  constructor(sqlite) {
    this.db = sqlite;
    this.rooms = new Map();
    this.previous = performance.now();
    this.timer = setInterval(() => this.tick(), 1000 / 60);
    this.timer.unref();
  }

  authorize(token, id) {
    const cached = this.rooms.get(String(id || ''));
    if (
      cached &&
      typeof token === 'string' &&
      (cached.row.host === token || cached.row.guest === token)
    )
      return {
        row: { ...cached.row, status: cached.battle.status },
        seat: cached.row.host === token ? 0 : 1,
      };
    if (
      typeof token !== 'string' ||
      token.length !== 64 ||
      !this.db.prepare('SELECT id FROM pf_sessions WHERE id=?').get(token)
    )
      return null;
    const row = this.db.prepare('SELECT * FROM pf_rooms WHERE id=?').get(String(id || ''));
    if (!row || (row.host !== token && row.guest !== token)) return null;
    return { row, seat: row.host === token ? 0 : 1 };
  }

  load(row) {
    let room = this.rooms.get(row.id);
    if (!room) {
      room = {
        row,
        battle: Battle.restore(JSON.parse(row.state)),
        seen: [row.host_seen, row.guest_seen],
        inputAt: [0, 0],
        inputs: [{}, {}],
        streams: new Set(),
        broadcastAt: 0,
        checkpointAt: 0,
        lastUsed: Date.now(),
        accumulator: 0,
      };
      this.rooms.set(row.id, room);
    }
    return room;
  }

  snapshot(room, seat, after = 0) {
    const s = room.battle.snapshot(seat);
    s.events = s.events.filter((e) => e.n > after);
    return {
      room: room.row.id,
      code: room.row.code,
      peerConnected: !room.battle.departed[1 - seat] && Date.now() - room.seen[1 - seat] < 2500,
      ...connectionRecovery(room.battle.mode, room.seen, Date.now()),
      transport: 'lan-stream',
      ...s,
    };
  }

  input(token, data) {
    const auth = this.authorize(token, data.room);
    if (!auth) return { status: 404, body: { error: 'Room not found.' } };
    const { row, seat } = auth;
    if (row.status === 'waiting' || row.status === 'cancelled') return null;
    const room = this.load(row),
      b = room.battle,
      now = Date.now();
    room.lastUsed = now;
    if (b.mode === 'coop' && now - room.seen[seat] > COOP_RECONNECT_MS) b.forfeit(seat);
    room.seen[seat] = now;
    if (data.leave) {
      b.forfeit(seat);
      this.checkpoint(room);
      this.broadcast(room);
      return { status: 200, body: { left: true } };
    }
    room.inputs[seat] = data.input || {};
    room.inputAt[seat] = now;
    b.setInput(seat, room.inputs[seat]);
    b.control(seat, data.control);
    // Controls take effect immediately; snapshots still arrive at a steady cadence.
    if (data.control) {
      this.checkpoint(room);
      this.broadcast(room);
    }
    const streaming = [...room.streams].some((s) => s.seat === seat && !s.res.destroyed);
    return {
      status: 200,
      body: streaming
        ? { streamed: true, acks: b.acks }
        : this.snapshot(room, seat, Number(data.after) || 0),
    };
  }

  stream(token, data, res) {
    const auth = this.authorize(token, data.room);
    if (!auth) return false;
    if (auth.row.status === 'waiting' || auth.row.status === 'cancelled') return false;
    const room = this.load(auth.row);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const stream = { res, seat: auth.seat, after: Number(data.after) || 0 };
    room.streams.add(stream);
    room.lastUsed = Date.now();
    res.on('close', () => room.streams.delete(stream));
    this.send(room, stream);
    return true;
  }

  send(room, stream) {
    if (stream.res.destroyed) {
      room.streams.delete(stream);
      return;
    }
    // Drop an obsolete frame for a slow reader rather than accumulating latency.
    if (stream.res.writableLength > 128 * 1024) return;
    const state = this.snapshot(room, stream.seat, stream.after);
    stream.res.write('data: ' + JSON.stringify(state) + '\n\n');
    for (const e of state.events) stream.after = Math.max(stream.after, e.n);
  }

  broadcast(room) {
    for (const stream of room.streams) this.send(room, stream);
  }

  checkpoint(room) {
    const b = room.battle;
    this.db
      .prepare(
        'UPDATE pf_rooms SET state=?,status=?,updated=?,host_seen=?,guest_seen=?,version=version+1 WHERE id=?',
      )
      .run(
        JSON.stringify(b.serialize()),
        b.status,
        Date.now(),
        room.seen[0],
        room.seen[1],
        room.row.id,
      );
    room.checkpointAt = Date.now();
  }

  tick() {
    const stamp = performance.now(),
      elapsed = Math.min(0.1, Math.max(0, (stamp - this.previous) / 1000)),
      now = Date.now();
    this.previous = stamp;
    for (const [id, room] of this.rooms) {
      const b = room.battle;
      if (b.status === 'playing') {
        for (let i = 0; i < 2; i++) {
          if (now - room.seen[i] > (b.mode === 'coop' ? COOP_RECONNECT_MS : 12000)) b.forfeit(i);
          b.setInput(i, now - room.inputAt[i] < 350 ? room.inputs[i] : {});
        }
        const recovery = connectionRecovery(b.mode, room.seen, now);
        if (recovery.reconnecting) room.accumulator = 0;
        else room.accumulator += elapsed;
        while (room.accumulator >= 1 / 60) {
          b.step(1 / 60);
          room.accumulator -= 1 / 60;
        }
      }
      const interval = b.status === 'ended' ? 500 : 50;
      if (now - room.broadcastAt >= interval) {
        this.broadcast(room);
        room.broadcastAt = now;
      }
      if (now - room.checkpointAt >= 1000) this.checkpoint(room);
      if (!room.streams.size && now - room.lastUsed > (b.mode === 'coop' ? 60000 : 30000)) {
        this.checkpoint(room);
        this.rooms.delete(id);
      }
    }
  }

  close() {
    clearInterval(this.timer);
    for (const room of this.rooms.values()) {
      this.checkpoint(room);
      for (const s of room.streams) s.res.end();
    }
    this.rooms.clear();
  }
}
