import { connectionRecovery } from '../shared/connection-recovery.mjs';
import { curseById, roleById } from '../shared/run-options.mjs';
import { unlockedRelic } from '../shared/boss-relics.mjs';
import { validDifficulty } from '../shared/combat-rules.mjs';
import { pieceById } from '../shared/piece-abilities.mjs';
import { cleanDiscoveries, discoveriesFromStats } from '../shared/bestiary.mjs';
import { weaponById } from '../shared/arsenal.mjs';
import { Battle } from '../shared/battle.mjs';
import { SKINS, ACHIEVEMENTS, TITLES } from '../shared/content.mjs';
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const safeName = (s) =>
  String(s || 'Wanderer')
    .replace(/[<>\x00-\x1f]/g, '')
    .trim()
    .slice(0, 24) || 'Wanderer';
const uid = () => crypto.randomUUID().replaceAll('-', '');

async function body(req) {
  try {
    let raw = await req.text();
    if (raw.length > 16000) throw Error('Payload too large');
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(Error('Invalid request'), { status: 400 });
  }
}

async function one(db, sql, ...args) {
  return db
    .prepare(sql)
    .bind(...args)
    .first();
}

async function run(db, sql, ...args) {
  return db
    .prepare(sql)
    .bind(...args)
    .run();
}

function cleanProfile(p = {}) {
  const stats = {};
  for (let k of [
    'kills',
    'castellanKills',
    'confessorKills',
    'fallenKingKills',
    'parries',
    'blocks',
    'dodges',
    'wins',
    'frostWins',
    'versusWins',
    'coopWins',
    'souls',
    'clears',
    'perfects',
  ])
    stats[k] = Math.min(1e8, Math.max(0, Math.floor(Number(p.stats?.[k]) || 0)));
  let completed = [
    ...new Set(
      (Array.isArray(p.completed) ? p.completed : []).filter((x) =>
        ['ashen', 'frost', 'verdant', 'eclipse'].includes(x),
      ),
    ),
  ];
  const unlocked = ACHIEVEMENTS.filter(
    (a) => (a.key === 'chapters' ? completed.length : stats[a.key] || 0) >= a.goal,
  ).map((a) => a.id);
  const skin =
    SKINS.find((s) => s.id === p.skin && (!s.unlock || unlocked.includes(s.unlock)))?.id || 'ivory';
  const title =
    TITLES.find((t) => t.id === p.title && (!t.unlock || unlocked.includes(t.unlock)))?.id ||
    'wanderer';
  return {
    name: safeName(p.name),
    stats,
    completed,
    encountered: cleanDiscoveries([
      ...cleanDiscoveries(p.encountered),
      ...discoveriesFromStats(stats),
    ]),
    unlocked,
    skin,
    title,
    weapon: weaponById(p.weapon).id,
    chessClass: pieceById(p.chessClass).id,
    bossRelic: unlockedRelic(p.bossRelic, stats),
    curse: curseById(p.curse).id,
    coopRole: roleById(p.coopRole).id,
    updated: Date.now(),
  };
}

function mergeProfile(a, b) {
  let stats = {};
  for (let k of Object.keys(cleanProfile().stats))
    stats[k] = Math.max(a?.stats?.[k] || 0, b?.stats?.[k] || 0);
  return cleanProfile({
    ...b,
    stats,
    encountered: cleanDiscoveries([
      ...cleanDiscoveries(a?.encountered),
      ...cleanDiscoveries(b?.encountered),
    ]),
    completed: [...new Set([...(a?.completed || []), ...(b?.completed || [])])],
  });
}

export async function api(request, env) {
  let url = new URL(request.url),
    path = url.pathname,
    db = env.DB;
  if (!db)
    return json(
      { error: 'Multiplayer storage is unavailable. Solo play is still available.' },
      503,
    );
  try {
    if (path === '/api/health') return json({ ok: true, protocol: 1 });
    const data = request.method === 'POST' ? await body(request) : {};
    if (path === '/api/session' && request.method === 'POST') {
      const id = uid() + uid(),
        owner = request.headers.get('oai-authenticated-user-id') || id;
      await run(
        db,
        'INSERT INTO pf_sessions(id,owner,name,skin,created) VALUES(?,?,?,?,?)',
        id,
        owner,
        safeName(data.name),
        'ivory',
        Date.now(),
      );
      return json({ token: id });
    }
    const token = request.headers.get('X-Game-Token') || '',
      session =
        token.length === 64 ? await one(db, 'SELECT * FROM pf_sessions WHERE id=?', token) : null;
    if (!session) return json({ error: 'Session expired. Reopen multiplayer to reconnect.' }, 401);
    if (path === '/api/profile') {
      let row = await one(db, 'SELECT data FROM pf_profiles WHERE owner=?', session.owner),
        profile = row ? JSON.parse(row.data) : cleanProfile({ name: session.name });
      if (request.method === 'POST') {
        profile = mergeProfile(profile, data);
        await run(
          db,
          'INSERT INTO pf_profiles(owner,data,updated) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data,updated=excluded.updated',
          session.owner,
          JSON.stringify(profile),
          Date.now(),
        );
        await run(
          db,
          'UPDATE pf_sessions SET name=?,skin=? WHERE id=?',
          profile.name,
          profile.skin,
          token,
        );
      }
      return json({ profile });
    }
    if (path === '/api/matchmaking' && request.method === 'POST') {
      const now = Date.now(),
        mode = data.mode === 'versus' ? 'versus' : 'coop';
      let old = await one(
        db,
        "SELECT id FROM pf_rooms WHERE (host=? OR guest=?) AND status IN ('waiting','playing') AND updated>? LIMIT 1",
        token,
        token,
        now - 20000,
      );
      if (old) return json({ room: old.id });
      const profile = await one(db, 'SELECT data FROM pf_profiles WHERE owner=?', session.owner);
      const me = profile ? JSON.parse(profile.data) : { name: session.name, skin: session.skin };
      if (data.code) {
        let r = await one(
          db,
          "SELECT * FROM pf_rooms WHERE code=? AND status='waiting' AND host<>? AND updated>?",
          String(data.code).toUpperCase().slice(0, 6),
          token,
          now - 20000,
        );
        if (!r) return json({ error: 'Room not found or no longer waiting.' }, 404);
        return await join(db, r, token, me, now);
      }
      if (!data.private) {
        let r = await one(
          db,
          "SELECT * FROM pf_rooms WHERE mode=? AND status='waiting' AND host<>? AND updated>? AND code NOT LIKE 'P%' AND COALESCE(json_extract(state,'$.bestOf'),1)=? AND COALESCE(json_extract(state,'$.difficulty'),'standard')=? ORDER BY updated ASC LIMIT 1",
          mode,
          token,
          now - 12000,
          mode === 'versus' && data.bestOf === 3 ? 3 : 1,
          mode === 'coop' ? validDifficulty(data.difficulty) : 'standard',
        );
        if (r) {
          let result = await join(db, r, token, me, now);
          if (result.status !== 409) return result;
        }
      }
      const id = uid(),
        code = (data.private ? 'P' : 'R') + uid().slice(0, 5).toUpperCase();
      await run(
        db,
        "INSERT INTO pf_rooms(id,code,mode,host,status,state,updated,host_seen) VALUES(?,?,?,?,'waiting',?,?,?)",
        id,
        code,
        mode,
        token,
        JSON.stringify({
          bestOf: mode === 'versus' && data.bestOf === 3 ? 3 : 1,
          difficulty: mode === 'coop' ? validDifficulty(data.difficulty) : 'standard',
          host: {
            name: me.name,
            skin: me.skin,
            weapon: me.weapon,
            chessClass: me.chessClass,
            bossRelic: me.bossRelic,
            curse: me.curse,
            coopRole: me.coopRole,
          },
        }),
        now,
        now,
      );
      return json({ room: id, code });
    }
    if (path === '/api/room' && request.method === 'POST') {
      let r = await one(db, 'SELECT * FROM pf_rooms WHERE id=?', String(data.room || ''));
      if (!r || (r.host !== token && r.guest !== token))
        return json({ error: 'Room not found.' }, 404);
      const seat = r.host === token ? 0 : 1,
        now = Date.now();
      if (data.leave) {
        if (r.status !== 'waiting' && r.status !== 'cancelled') {
          for (let attempt = 0; attempt < 5; attempt++) {
            r = await one(db, 'SELECT * FROM pf_rooms WHERE id=?', r.id);
            const b = Battle.restore(JSON.parse(r.state));
            b.forfeit(seat);
            const saved = await run(
              db,
              'UPDATE pf_rooms SET state=?,status=?,updated=?,version=version+1 WHERE id=? AND version=?',
              JSON.stringify(b.serialize()),
              b.status,
              now,
              r.id,
              r.version,
            );
            if (saved.meta.changes) break;
          }
        } else
          await run(
            db,
            "UPDATE pf_rooms SET status='cancelled',updated=? WHERE id=? AND status='waiting'",
            now,
            r.id,
          );
        return json({ left: true });
      }
      const col = seat ? 'guest' : 'host';
      const expiredRejoin = r.mode === 'coop' && now - Number(r[col + '_seen']) > 45000;
      await run(
        db,
        `UPDATE pf_rooms SET ${col}_seen=?,${col}_input=?,updated=CASE WHEN status='waiting' THEN ? ELSE updated END WHERE id=?`,
        now,
        JSON.stringify(data.input || {}),
        now,
        r.id,
      );
      if (r.status === 'waiting')
        return json({ room: r.id, code: r.code, status: 'waiting', mode: r.mode });
      for (let attempt = 0; attempt < 5; attempt++) {
        r = await one(db, 'SELECT * FROM pf_rooms WHERE id=?', r.id);
        if (r.status === 'cancelled') return json({ status: 'cancelled' });
        let b = Battle.restore(JSON.parse(r.state));
        if (r.status === 'playing' || data.control) {
          b.control(seat, data.control);
          const recovery = connectionRecovery(r.mode, [r.host_seen, r.guest_seen], now);
          if (expiredRejoin || recovery.expired >= 0) {
            b.forfeit(expiredRejoin ? seat : recovery.expired);
          } else if (!recovery.reconnecting) {
            b.setInput(0, now - r.host_seen < 700 ? JSON.parse(r.host_input) : {});
            b.setInput(1, now - r.guest_seen < 700 ? JSON.parse(r.guest_input) : {});
            let remain = Math.min(0.5, Math.max(0, (now - r.updated) / 1000));
            while (remain > 0) {
              let dt = Math.min(1 / 30, remain);
              b.step(dt);
              remain -= dt;
            }
          }
          const saved = await run(
            db,
            'UPDATE pf_rooms SET state=?,version=version+1,updated=?,status=? WHERE id=? AND version=?',
            JSON.stringify(b.serialize()),
            now,
            b.status === 'ended' ? 'ended' : 'playing',
            r.id,
            r.version,
          );
          if (!saved.meta.changes) continue;
        }
        return json({
          room: r.id,
          code: r.code,
          peerConnected: !b.departed[1 - seat] && now - (seat ? r.host_seen : r.guest_seen) < 2500,
          ...connectionRecovery(r.mode, [r.host_seen, r.guest_seen], now),
          ...b.snapshot(seat),
          events: b.events.filter((e) => e.n > (Number(data.after) || 0)),
        });
      }
      return json({ error: 'The arena is busy. Retrying…' }, 409);
    }
    return json({ error: 'Route not found' }, 404);
  } catch (e) {
    console.error('Game API failure', e.message);
    return json(
      { error: e.status === 400 ? e.message : 'The arena server could not complete that request.' },
      e.status || 500,
    );
  }
}

async function join(db, r, token, me, now) {
  let waiting = JSON.parse(r.state),
    b = new Battle(
      r.mode,
      [
        waiting.host,
        {
          name: me.name,
          skin: me.skin,
          weapon: me.weapon,
          chessClass: me.chessClass,
          bossRelic: me.bossRelic,
          curse: me.curse,
          coopRole: me.coopRole,
        },
      ],
      {
        readyCheck: true,
        bestOf: waiting.bestOf,
        difficulty: waiting.difficulty,
      },
    );
  let result = await run(
    db,
    "UPDATE pf_rooms SET guest=?,status='playing',state=?,updated=?,guest_seen=?,version=version+1 WHERE id=? AND status='waiting' AND guest IS NULL",
    token,
    JSON.stringify(b.serialize()),
    now,
    now,
    r.id,
  );
  return result.meta.changes
    ? json({ room: r.id, code: r.code })
    : json({ error: 'Another player joined first. Try matchmaking again.' }, 409);
}
