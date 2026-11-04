import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/shared/combat.mjs';
import { Battle } from '../src/shared/battle.mjs';
import { endlessHealth, endlessDamage } from '../src/shared/endless.mjs';
import { captureRun, restoreRun } from '../src/shared/run-save.mjs';
import { chronicleData } from '../src/shared/run-chronicle.mjs';
import { showChronicle } from '../src/client/run-chronicle.mjs';
const g = new Game();
g.reset();
g.startEndless();
const realms = new Set();
let victories = 0;
for (let i = 0; i < 125; i++) {
  assert.equal(g.endless.encounter, i + 1);
  assert.equal(g.wave, i % 5);
  realms.add(g.chapter);
  assert(g.enemies.length <= 18, 'reinforcement count remains bounded');
  if (g.arenaObjective) g.arenaObjective.complete = true;
  g.enemies.forEach((e) => (e.dead = true));
  g.clearAt = g.time + 0.001;
  g.update(0.02, { skipAI: true });
  victories += g.events.filter((e) => e.type === 'end' && e.won).length;
  g.events = [];
  let clicks = 0;
  if (g.routeChoices.length) {
    assert(g.chooseRoute('sanctuary'));
    clicks++;
  } else if (g.promotionChoices.length) {
    assert(g.choosePromotion('queen'));
    clicks++;
  } else if (g.eventChoices.length) {
    assert(g.chooseEvent('decline'));
    clicks++;
  } else if (g.upgradeChoices.length) {
    assert(g.chooseUpgrade(g.upgradeChoices[0]));
    clicks++;
  }
  assert(clicks <= 1);
  assert.equal(g.mode, 'playing');
  if (i === 72) {
    const save = captureRun(g);
    assert(save);
    const h = new Game();
    assert(restoreRun(h, JSON.parse(JSON.stringify(save))));
    assert.deepEqual(h.endless, g.endless);
    assert.deepEqual(h.enemies, g.enemies);
  }
}
assert.equal(realms.size, 4);
assert.equal(victories, 0);
assert.equal(g.endless.cleared, 125);
assert.equal(chronicleData(g).encounters, 125, 'totals survive bounded journal history');
assert(endlessHealth(g) > 1);
assert(endlessDamage(g) > 1);
g.hp = 1;
g.player.invuln = 0;
g.hurtPlayer(10000, { x: 0, z: 0, unblockable: true });
assert.equal(g.mode, 'dead');
assert(g.events.some((e) => e.type === 'end' && !e.won));
g.reset();
assert.equal(g.endless, null);
assert.equal(endlessDamage(g), 1);
const b = new Battle('versus');
assert(b.games.every((g) => g.endless === null));
const nodes = new Map(),
  doc = {
    querySelector(id) {
      if (!nodes.has(id)) nodes.set(id, {});
      return nodes.get(id);
    },
  };
g.journal = [{ type: 'championDefeated', wave: 1, time: 1, title: '<img src=x onerror=bad>' }];
showChronicle(g, 'Victory', doc);
assert(nodes.get('#chronicleStats').innerHTML.includes('ENCOUNTERS CLEARED'));
assert(nodes.get('#chronicleBuild').innerHTML.includes('YOUR FINAL BUILD'));
assert(!nodes.get('#chronicleDetails').innerHTML.includes('<img'));
assert(nodes.get('#chronicleDetails').innerHTML.includes('&lt;img'));
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'),
  css = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
assert(!/chessbound/i.test(html), 'retired branding is absent');
assert(
  /\.hubNav\s*\{\s*overflow:\s*visible;\s*position:\s*relative;\s*z-index:\s*30;?\s*\}/.test(css),
  'More has an unclipped layer above the scroll surface',
);
assert(
  css.includes('#hubContent::-webkit-scrollbar') &&
    css.replace(/\s+/g, '').includes('scrollbar-width:none'),
  'menu scrollbars are concealed without disabling scrolling',
);
assert(html.includes('id="endlessRun"'));
console.log(
  'PASS: 125 endless encounters, four realms, escalating bounded squads, no final win, one-choice breaks, exact suspension/death/reset; structured escaped result stats, More clipping fix, hidden scrollbars and Pawnfall branding.',
);
