import assert from 'node:assert/strict';
import { Game, stats, dist, ARENA } from '../src/shared/combat.mjs';
const step = (g, n, input = {}) => {
  for (let i = 0; i < n; i++) g.update(0.02, input);
};
const solo = (type = 'pawn') => {
  let g = new Game();
  g.reset();
  g.enemies = [
    {
      id: 'test',
      type,
      x: 0,
      z: 0,
      y: 0,
      face: 0,
      hp: stats[type].hp,
      max: stats[type].hp,
      state: 'approach',
      cooldown: 999,
      hitUntil: 0,
      count: 0,
      dead: false,
    },
  ];
  g.player.x = 0;
  g.player.z = 2.4;
  g.player.face = Math.PI;
  return g;
};
{
  let g = solo();
  g.enemies = [];
  g.clearAt = 999;
  const z = g.player.z;
  step(g, 10, { x: 0, z: -1 });
  assert(g.player.z < z - 0.5);
  assert(g.player.z > z - 1);
  step(g, 1000, { x: 1, z: 0 });
  assert(g.player.x <= ARENA);
  assert(g.player.x >= ARENA - 0.1);
}
{
  let g = solo();
  assert(g.attack());
  assert(!g.attack());
  step(g, 12);
  assert.equal(g.enemies[0].hp, 20);
  assert(g.stamina < 100);
  step(g, 15);
  assert(g.attack());
  step(g, 12);
  assert(g.enemies[0].dead);
  assert.equal(g.souls, 80);
  assert.equal(g.combo, 1);
  let before = g.souls;
  g.hitEnemy(g.enemies[0], 99);
  assert.equal(g.souls, before);
}
{
  let g = solo();
  g.stamina = 10;
  assert(!g.attack());
  assert(!g.dodge());
  assert.equal(g.stamina, 10);
  step(g, 50);
  assert(g.stamina > 30);
  assert(g.dodge(1, 0));
  assert(!g.hurtPlayer(50, { x: 0, z: 0 }));
  const x = g.player.x;
  step(g, 20);
  assert(g.player.x > x + 4);
  assert.equal(g.hp, 100);
}
{
  let g = solo();
  g.player.block = true;
  assert(!g.hurtPlayer(17, { x: 0, z: 0 }));
  assert.equal(g.hp, 100);
  assert.equal(g.stamina, 78);
  g.player.invuln = 0;
  assert(g.hurtPlayer(17, { x: 0, z: 4 }));
  assert.equal(g.hp, 83);
  g.player.invuln = 0;
  g.player.block = true;
  g.stamina = 0;
  g.hurtPlayer(17, { x: 0, z: 0 });
  assert.equal(g.hp, 66);
}
{
  let g = solo();
  g.hp = 30;
  assert(g.heal());
  assert.equal(g.hp, 78);
  assert.equal(g.flasks, 2);
  assert(!g.heal());
  step(g, 50);
  assert(g.heal());
  assert.equal(g.hp, 100);
  assert(!g.heal());
}
{
  let g = solo();
  g.mode = 'paused';
  let t = g.time,
    z = g.player.z;
  step(g, 100, { x: 0, z: -1 });
  assert.equal(g.time, t);
  assert.equal(g.player.z, z);
  assert(!g.attack());
}
for (const type of Object.keys(stats)) {
  let g = solo(type);
  let e = g.enemies[0];
  e.cooldown = 0;
  g.player.z = 2;
  if (type === 'bishop') g.player.z = 6;
  step(g, 2);
  assert.equal(e.state, 'windup', type + ' windup');
  step(g, Math.ceil(stats[type].windup / 0.02) + 3);
  assert.equal(e.state, 'attack', type + ' attack');
  if (type === 'bishop') assert(g.projectiles.length > 0);
  if (type === 'knight') {
    step(g, 10);
    assert(e.y > 1);
  }
  step(g, 120);
  assert(g.hp < 100, type + ' damage');
}
{
  let g = solo();
  g.enemies[0].x = g.player.x;
  g.enemies[0].z = g.player.z + 0.1;
  step(g, 1);
  assert(dist(g.enemies[0], g.player) >= 1.19);
}
{
  let g = solo();
  g.enemies[0].dead = true;
  step(g, 140);
  assert.equal(g.wave, 1);
  assert.equal(g.enemies.length, 3);
  if (g.mode === 'route') assert(g.chooseRoute('sanctuary'));
  assert.equal(g.mode, 'playing');
  assert.equal(g.upgradeChoices.length, 0, 'route is the only decision');
  g.wave = 4;
  g.arenaObjective = null;
  g.enemies.forEach((e) => (e.dead = true));
  g.clearAt = 0;
  step(g, 140);
  assert.equal(g.mode, 'won');
}
{
  let g = solo();
  g.hp = 5;
  g.hurtPlayer(10, { x: 0, z: 0 });
  assert.equal(g.mode, 'dead');
  assert.equal(g.hp, 0);
  assert(!g.attack());
  g.reset();
  assert.equal(g.hp, 100);
  assert.equal(g.stamina, 100);
  assert.equal(g.wave, 0);
  assert.equal(g.flasks, 3);
  assert.equal(g.souls, 0);
}
console.log(
  'PASS: continuous movement, bounds, collision, combos, damage, stamina, directional guard, dodge invulnerability, healing, pause, all five enemy attacks, waves, victory, death, reset.',
);
