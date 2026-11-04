import { COOP_RECONNECT_MS } from '../shared/connection-recovery.mjs';

export function readStateFrames(buffer) {
  const frames = buffer.split('\n\n');
  const rest = frames.pop();
  const states = [];
  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.slice(6))
      .join('\n');
    if (data) states.push(JSON.parse(data));
  }
  return { states, rest };
}

export class NetworkClient {
  constructor(storage) {
    if (storage === undefined)
      try {
        storage = globalThis.sessionStorage;
      } catch {}
    this.storage = storage;
    this.mode = null;
    this.savedAt = 0;
    this.token = null;
    this.room = null;
    this.seat = 0;
    this.actions = [];
    this.actionId = 0;
    this.eventId = 0;
    this.connected = false;
    this.busy = false;
    this.next = 0;
    this.lastReceive = 0;
    this.onState = () => {};
    this.onError = () => {};
    this.generation = 0;
    this.lastInput = {};
    this.leaving = Promise.resolve();
    this.connecting = null;
    this.searching = Promise.resolve();
    this.pendingControl = null;
    this.ping = null;
    this.failures = 0;
    this.streaming = false;
    this.streamController = null;
    this.streamRetryAt = 0;
    this.phase = null;
  }

  async request(path, body) {
    const r = await fetch('/api/' + path, {
      method: 'POST',
      signal: globalThis.AbortSignal?.timeout?.(8000),
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'X-Game-Token': this.token } : {}),
      },
      body: JSON.stringify(body || {}),
    });
    let data;
    try {
      data = await r.json();
    } catch {
      throw Error('The multiplayer server is unavailable. Solo play is available offline.');
    }
    if (!r.ok) throw Object.assign(Error(data.error || 'Connection failed'), { status: r.status });
    return data;
  }

  async connect(name) {
    if (!this.token) {
      if (!this.connecting)
        this.connecting = this.request('session', { name })
          .then((s) => {
            this.token = s.token;
          })
          .finally(() => {
            this.connecting = null;
          });
      await this.connecting;
    }
    this.connected = true;
  }

  async profile(data) {
    await this.connect(data.name);
    return (await this.request('profile', data)).profile;
  }

  async find(mode, profile, options = {}) {
    const generation = ++this.generation;
    const previous = this.searching;
    let complete;
    this.searching = new Promise((resolve) => {
      complete = resolve;
    });
    await previous;
    try {
      await this.leaving;
      if (generation !== this.generation) return { cancelled: true };
      await this.connect(profile.name);
      await this.profile(profile);
      if (generation !== this.generation) return { cancelled: true };
      let r = await this.request('matchmaking', { mode, ...options });
      if (generation !== this.generation) {
        await this.request('room', { room: r.room, leave: true });
        return { cancelled: true };
      }
      this.room = r.room;
      this.mode = mode;
      this.pendingControl = null;
      this.failures = 0;
      this.eventId = 0;
      this.actions = [];
      this.actionId = 0;
      this.next = 0;
      this.lastReceive = performance.now();
      return r;
    } finally {
      complete();
    }
  }

  recovery() {
    try {
      const s = JSON.parse(this.storage?.getItem('pawnfall-coop-rejoin-v1') || 'null');
      if (
        s?.mode !== 'coop' ||
        typeof s.token !== 'string' ||
        s.token.length > 128 ||
        typeof s.room !== 'string' ||
        s.room.length > 128 ||
        !Number.isFinite(s.savedAt) ||
        Date.now() - s.savedAt > COOP_RECONNECT_MS ||
        Date.now() < s.savedAt
      )
        return null;
      return s;
    } catch {
      return null;
    }
  }

  clearRecovery() {
    try {
      this.storage?.removeItem('pawnfall-coop-rejoin-v1');
    } catch {}
  }

  remember() {
    if (this.mode !== 'coop' || !this.room || !this.token) return;
    const now = Date.now();
    if (now - this.savedAt < 500) return;
    this.savedAt = now;
    try {
      this.storage?.setItem(
        'pawnfall-coop-rejoin-v1',
        JSON.stringify({
          mode: 'coop',
          token: this.token,
          room: this.room,
          seat: this.seat,
          actionId: this.actionId,
          eventId: this.eventId,
          savedAt: now,
        }),
      );
    } catch {}
  }

  async resume() {
    const saved = this.recovery();
    if (!saved) throw Error('The co-op rejoin window has expired.');
    await this.leaving;
    this.generation++;
    this.token = saved.token;
    this.room = saved.room;
    this.mode = 'coop';
    this.seat = saved.seat === 1 ? 1 : 0;
    this.actionId = Math.max(0, Number(saved.actionId) || 0);
    this.eventId = Math.max(0, Number(saved.eventId) || 0);
    this.actions = [];
    this.pendingControl = null;
    this.failures = 0;
    this.next = 0;
    this.lastReceive = performance.now();
    try {
      const state = await this.request('room', { room: this.room, after: this.eventId, input: {} });
      this.receive(state);
      return state;
    } catch (error) {
      this.room = null;
      if ([401, 403, 404, 410].includes(error.status)) this.clearRecovery();
      throw error;
    }
  }

  receive(s) {
    this.lastReceive = performance.now();
    if (s.mode) this.mode = s.mode;
    if (s.reconnecting) {
      this.actions = [];
      this.pendingControl = null;
    }
    this.phase =
      s.status === 'waiting'
        ? 'waiting'
        : s.phase || (s.status === 'playing' ? 'combat' : s.status);
    if (s.seat !== undefined) {
      this.seat = s.seat;
      this.actionId = Math.max(this.actionId, s.acks?.[s.seat] || 0);
      this.actions = this.actions.filter((a) => a.n > (s.acks?.[s.seat] || 0));
    }
    const events = (s.events || []).filter((e) => e.n > this.eventId);
    for (const e of events) this.eventId = Math.max(this.eventId, e.n);
    if (['ended', 'cancelled', 'disconnected'].includes(s.status)) this.clearRecovery();
    else this.remember();
    this.onState(s, events);
  }

  async startStream() {
    if (
      this.streamController ||
      !this.room ||
      performance.now() < this.streamRetryAt ||
      typeof AbortController === 'undefined'
    )
      return;
    const controller = new AbortController(),
      room = this.room,
      generation = this.generation;
    this.streamController = controller;
    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Game-Token': this.token },
        body: JSON.stringify({ room, after: this.eventId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body?.getReader) throw Error('Stream unavailable');
      this.streaming = true;
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = '';
      try {
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (this.room !== room || this.generation !== generation) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 1024 * 1024) throw Error('Stream frame too large');
          const parsed = readStateFrames(buffer);
          buffer = parsed.rest;
          if (parsed.states.length) {
            const latest = parsed.states.at(-1);
            latest.events = parsed.states.flatMap((s) => s.events || []);
            this.receive(latest);
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch {
    } finally {
      if (this.streamController === controller) {
        this.streamController = null;
        this.streaming = false;
        this.streamRetryAt = performance.now() + 1500;
        this.next = 0;
      }
    }
  }

  command(kind, state) {
    if (this.room && state)
      this.pendingControl = { kind, series: state.series, round: state.round };
    this.next = 0;
  }

  action(kind) {
    if (this.room) {
      this.actions.push({ kind, n: ++this.actionId });
      this.next = 0;
      return this.actionId;
    }
  }

  tick(now, input) {
    if (this.streaming && performance.now() - this.lastReceive > 1500) {
      this.streamController?.abort();
      this.streaming = false;
    }
    if (!this.room || this.busy || now < this.next) return;
    this.next = now + (this.phase === 'combat' ? (this.streaming ? 40 : 50) : 200);
    this.busy = true;
    this.lastInput = input;
    const room = this.room,
      generation = this.generation;
    const started = performance.now(),
      control = this.pendingControl;
    this.request('room', {
      room,
      control,
      after: this.eventId,
      input: { ...input, actions: this.actions.slice(-12) },
    })
      .then((s) => {
        if (this.room !== room || this.generation !== generation) return;
        const elapsed = Math.max(0, performance.now() - started);
        this.ping = this.ping === null ? elapsed : this.ping * 0.7 + elapsed * 0.3;
        this.failures = 0;
        if (this.pendingControl === control) this.pendingControl = null;
        if (s.streamed) {
          this.actions = this.actions.filter((a) => a.n > (s.acks?.[this.seat] || 0));
        } else {
          this.receive(s);
          if (s.transport === 'lan-stream') this.startStream();
        }
      })
      .catch((e) => {
        if (this.room !== room || this.generation !== generation) return;
        this.failures++;
        if (this.mode === 'coop') {
          this.actions = [];
          this.pendingControl = null;
        }
        this.next = performance.now() + Math.min(3000, 250 * 2 ** Math.min(4, this.failures));
        this.onError(e.message);
        if (
          performance.now() - this.lastReceive >
          (this.mode === 'coop' ? COOP_RECONNECT_MS : 15000)
        ) {
          this.streamController?.abort();
          this.streaming = false;
          this.room = null;
          this.clearRecovery();
          this.generation++;
          this.onState({ status: 'disconnected' });
        }
      })
      .finally(() => {
        this.busy = false;
      });
  }

  async leave() {
    this.clearRecovery();
    this.generation++;
    this.streamController?.abort();
    this.streaming = false;
    const room = this.room;
    this.room = null;
    this.actions = [];
    this.pendingControl = null;
    // Serialize leaving with the next search, so the server cannot hand back the old room.
    const prior = this.leaving;
    this.leaving = prior.then(async () => {
      if (room)
        try {
          await this.request('room', { room, leave: true });
        } catch {}
    });
    await this.leaving;
  }
}
