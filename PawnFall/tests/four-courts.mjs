import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { Game, stats } from '../src/shared/combat.mjs';
import {
  captureCheckpoint,
  cleanCheckpoint,
  restoreCheckpoint,
} from '../src/shared/checkpoints.mjs';
import { CheckpointStore } from '../src/client/checkpoint-store.mjs';
import { unlockedRelic } from '../src/shared/boss-relics.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { updateHazards, hazardContains } from '../src/shared/combat-rules.mjs';
import { buildRealmArenas, resolveArenaCamera, hazardAngle } from '../src/client/realm-arenas.mjs';
{
  const g = new Game();
  g.reset(1);
  Object.assign(g, {
    wave: 2,
    hp: 63,
    flasks: 1,
    souls: 420,
    time: 14,
    abilityReadyAt: 21,
    bossRelic: 'mirror',
    upgrades: { force: 2 },
  });
  g.player.x = 2;
  g.player.z = -3;
  g.spawn();
  const checkpoint = captureCheckpoint(g);
  const types = g.enemies.map((e) => [e.type, e.hp]);
  g.hp = 0;
  g.souls = 999;
  g.upgrades.force = 3;
  g.wave = 4;
  assert(restoreCheckpoint(g, checkpoint));
  assert.equal(g.wave, 2);
  assert.equal(g.hp, 63);
  assert.equal(g.flasks, 1);
  assert.equal(g.souls, 420);
  assert.equal(g.upgrades.force, 2);
  assert.equal(g.abilityReadyAt, 21);
  assert.equal(g.player.x, 2);
  assert.equal(g.player.z, -3);
  assert.equal(g.bossRelic, 'mirror');
  assert.deepEqual(
    g.enemies.map((e) => [e.type, e.hp]),
    types,
  );
  const saved = JSON.stringify(g.checkpoint);
  g.souls = 800;
  restoreCheckpoint(g, JSON.parse(saved));
  assert.equal(g.souls, 420, 'retry does not retain failed-attempt souls');
  assert.equal(cleanCheckpoint({ version: 1, chapter: 8, wave: 0 }), null);
  assert.equal(cleanCheckpoint({ ...checkpoint, flasks: 100 }).flasks, 12);
  const storage = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(k, v) {
      this.value = v;
    },
  };
  const store = new CheckpointStore(storage);
  store.save(checkpoint);
  assert.equal(new CheckpointStore(storage).get(1).wave, 2);
  store.clear(1);
  assert.equal(store.get(1), null);
  g.checkpointMode = 'fullrun';
  g.reset();
  assert.equal(g.checkpoint, null);
  assert(!restoreCheckpoint(g, checkpoint));
}
{
  assert.equal(unlockedRelic('siegebreaker', {}), 'none');
  assert.equal(unlockedRelic('siegebreaker', { castellanKills: 1 }), 'siegebreaker');
  assert.equal(unlockedRelic('mirror', { confessorKills: 1 }), 'mirror');
  const g = new Game();
  g.bossRelic = 'siegebreaker';
  g.reset();
  g.player.block = true;
  g.player.face = 0;
  g.player.x = 0;
  g.player.z = 0;
  g.hurtPlayer(20, { x: 0, z: 1 });
  assert.equal(g.stamina, 82);
  g.player.invuln = 0;
  g.player.state = 'idle';
  g.time = 1;
  assert(g.dodge());
  assert.equal(g.stamina, 50, 'seal increases roll cost by four');
  const m = new Game();
  m.bossRelic = 'mirror';
  m.reset();
  assert(m.ultimate());
  assert.equal(m.stamina, 60);
  assert.equal(m.abilityReadyAt, 14 * 0.8);
  const pvp = new Battle('versus', [{ bossRelic: 'siegebreaker' }, { bossRelic: 'mirror' }]);
  assert(pvp.games.every((g) => g.bossRelic === 'none'));
}
{
  const b = new Battle('coop', [{}, {}]);
  b.games[0].enemies.forEach((e) => (e.cooldown = 999));
  b.step(0.02);
  const e = b.games[0].enemies[0];
  e.hp = e.max = 500;
  e.guarding = false;
  e.x = 0;
  e.z = 0;
  e.state = 'approach';
  Object.assign(b.games[0].player, { x: 0, z: 2, face: Math.PI });
  Object.assign(b.games[1].player, { x: 0, z: 2, face: Math.PI });
  b.games[0].hitEnemy(e, 1, 80);
  assert.equal(e.openedBy, 'p0');
  b.setInput(1, { actions: [{ kind: 'heavy', n: 1 }] });
  for (let i = 0; i < 30; i++) b.step(0.02);
  assert(e.teamSpent);
  assert(b.events.some((ev) => ev.type === 'teamFinisher' && ev.seat === 1));
  assert.equal(e.hp, 405, 'partner heavy gains exactly 40 bonus damage');
  const saved = Battle.restore(JSON.parse(JSON.stringify(b.serialize())));
  assert(saved.games[0].enemies[0].teamSpent);
  const g = b.games[0];
  e.teamSpent = false;
  e.state = 'stagger';
  e.openedBy = 'p1';
  e.teamWindowEnd = g.time + 2;
  g.player.state = 'idle';
  g.player.attackKind = 'heavy';
  g.hitEnemy(e, 2, 0, true);
  assert(!e.teamSpent, 'burn ticks cannot consume a team finisher');
}
for (let realm = 0; realm < 4; realm++) {
  const g = new Game();
  g.reset(realm);
  g.wave = 1;
  g.hazardAt = 0;
  updateHazards(g, 0.02);
  const h = g.hazards[0];
  assert.equal(h.realm, realm);
  assert(h.fireAt - g.time >= 1.6);
  if (realm === 2) {
    assert.equal(h.shape, 'circle');
    assert(hazardContains(h, { x: h.x, z: h.z }));
    assert(!hazardContains(h, { x: h.x + 3, z: h.z }));
  } else if (realm === 3) {
    assert.equal(h.axis, 'diagA');
    assert(hazardContains(h, { x: 4, z: 4 }));
    assert(!hazardContains(h, { x: 4, z: -4 }));
  } else assert.equal(h.width || 0.85, realm === 1 ? 0.6 : 0.85);
}
{
  const scene = new THREE.Scene(),
    arenas = buildRealmArenas(THREE, scene);
  assert.equal(arenas.groups.length, 3);
  let instances = 0,
    batches = 0;
  scene.traverse((o) => {
    assert(o.position.toArray().every(Number.isFinite));
    if (o.isInstancedMesh) {
      batches++;
      instances += o.count;
      for (let i = 0; i < o.count; i++) {
        const m = new THREE.Matrix4();
        o.getMatrixAt(i, m);
        assert(m.elements.every(Number.isFinite));
      }
    }
  });
  assert(batches < 20 && instances > 100, 'new environments remain batched');
  for (let realm = 1; realm <= 3; realm++) {
    arenas.set(realm);
    assert.equal(arenas.groups.filter((g) => g.visible).length, 1);
    assert(arenas.groups[realm - 1].visible);
  }
  const aim = { x: 0, y: 1, z: 0 },
    desired = { x: 10, y: 1, z: 0 },
    box = { min: { x: 4, y: 0, z: -1 }, max: { x: 6, y: 3, z: 1 } };
  assert(
    resolveArenaCamera(aim, desired, [box]).x < 4,
    'camera stays in front of an occluding pillar',
  );
  assert.equal(resolveArenaCamera(aim, desired, []).x, 10);
  for (const axis of ['diagA', 'diagB']) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 30));
    mesh.rotation.set(-Math.PI / 2, 0, hazardAngle(axis));
    mesh.updateMatrixWorld();
    const p = new THREE.Vector3(0, 5, 0).applyMatrix4(mesh.matrixWorld);
    assert(
      hazardContains({ axis, lane: 0 }, p),
      'visible diagonal matches authoritative danger area',
    );
  }
}
console.log(
  'PASS: encounter checkpoint resources/cooldowns/build/position, persistence and full-run rules, boss relic tradeoffs/unlocks, PvP isolation, authoritative partner finisher, realm hazards, batched environments, diagonal warning geometry and camera occlusion.',
);

{
  const g = new Game();
  g.reset();
  g.player.x = 0;
  g.player.z = 9;
  const rook = {
    id: 'screen',
    type: 'rook',
    x: -3,
    z: 0,
    y: 0,
    face: 0,
    hp: 150,
    max: 150,
    state: 'approach',
    cooldown: 0,
    count: 0,
    guardCapable: true,
  };
  const bishop = {
    id: 'caster',
    type: 'bishop',
    x: -5,
    z: -6,
    y: 0,
    face: 0,
    hp: 85,
    max: 85,
    state: 'approach',
    cooldown: 999,
    count: 0,
  };
  g.enemies = [rook, bishop];
  g.update(0.02, { skipProgression: true });
  assert.equal(rook.covering, 'caster');
  assert(rook.z < 0, 'rook moves to screen its bishop');
  const p = new Game();
  p.reset();
  p.player.z = 6;
  const pawn = {
    id: 'pressure',
    type: 'pawn',
    x: 0,
    z: 4,
    y: 0,
    face: 0,
    hp: 52,
    max: 52,
    state: 'windup',
    until: 2,
    begin: 0,
    windupDuration: 0.95,
    targetId: 'player',
    target: { x: 0, z: 6 },
    count: 1,
  };
  const knight = {
    id: 'pincer',
    type: 'knight',
    x: 0,
    z: 1,
    y: 0,
    face: 0,
    hp: 100,
    max: 100,
    state: 'approach',
    cooldown: 0.3,
    count: 0,
  };
  p.enemies = [pawn, knight];
  p.update(0.02, { z: 1, skipProgression: true });
  assert(knight.squadTell);
  assert(
    p.events.some((e) => e.type === 'squadTell'),
    'coordinated knight pressure is telegraphed',
  );
}
