import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  allEncounters,
  availableCampStories,
  canAfford,
  newGame,
  pendingEvent,
  quote,
  readSave,
  resolve,
  resolveCampStory,
  routes,
  travel,
} from '../src/game.ts';
import { campStories, newEncounters } from '../src/new-scenes.ts';
import { comicArt, sceneFor } from '../src/comic-scenes.ts';
import { comicView } from '../src/comic-view.ts';
import { dayView } from '../src/chronicle-view.ts';
import { letterNarrative, letterTitle } from '../src/letter.ts';
import { t, useLanguage } from '../src/locale.ts';
import { campView } from '../src/views.ts';

test('every road and camp encounter renders three panels with local art and bilingual dialogue', () => {
  const sources = [
    ...allEncounters,
    ...campStories,
    { id: 'lina-letter', title: letterTitle, narrative: letterNarrative(newGame('Hearth-01')) },
  ];
  for (const name of comicArt)
    assert.ok(existsSync(new URL('../public/art/comic-' + name + '.webp', import.meta.url)), name);
  for (const event of sources) {
    const scene = sceneFor(event.id);
    assert.ok(scene, event.id);
    assert.equal(scene.art.length, 3);
    const output = comicView(event.id, event.narrative, event.region ?? 0);
    assert.equal((output.match(/<figure/g) ?? []).length, 3);
    assert.ok(output.includes(scene.en), event.id);
    assert.ok(scene.art.every((art) => output.includes('data-art="' + art + '"')));
    useLanguage('fa');
    try {
      const persian = comicView(event.id, t(event.narrative), event.region ?? 0);
      assert.ok(persian.includes(scene.fa), event.id);
      assert.ok(!persian.includes(scene.en), event.id);
      assert.notEqual(t(event.narrative), event.narrative);
      assert.notEqual(t(event.title), event.title);
      for (const choice of event.choices ?? []) {
        assert.notEqual(t(choice.label), choice.label);
        assert.notEqual(t(choice.result), choice.result);
      }
    } finally {
      useLanguage('en');
    }
  }
});

test('a new encounter resolves into an illustrated outcome with its real resource and injury changes', () => {
  let g = newGame('woodbridge-test');
  g = { ...g, pending: 'woodbridge', seen: ['woodbridge'] };
  const safe = resolve(g, 0);
  assert.equal(safe.supplies.materials, g.supplies.materials - 2);
  const risk = resolve(g, 1);
  assert.equal(risk.crew[0].injury.kind, 'sprain');
  const outcome = risk.chronicle.at(-1);
  assert.equal(outcome.scene, 'woodbridge');
  assert.match(dayView(outcome), /travel-scene" data-art="trade"/);
  assert.match(dayView(outcome), /Sprained ankle/);
  assert.deepEqual(readSave(JSON.stringify(risk)), risk);
});

test('camp conversations have one-time outcomes and Mara’s marker lasts one leg', () => {
  const g = newGame('Hearth-01');
  assert.equal(availableCampStories(g).length, 3);
  assert.match(campView(g, 'talk', ''), /A Map from Memory/);
  const marked = resolveCampStory(g, 'mara-map', 0);
  assert.equal(marked.supplies.materials, g.supplies.materials - 1);
  assert.equal(availableCampStories(marked).length, 0);
  assert.equal(resolveCampStory(marked, 'bram-watch', 0), marked);
  const route = routes(g).find((place) => place.id === 'hollow');
  assert.equal(quote(marked, route).markedRoad, 3);
  assert.equal(quote(g, route).wagon - quote(marked, route).wagon, 3);
  const next = travel(marked, route.id);
  const event = pendingEvent(next);
  const cleared = resolve(
    next,
    event.choices.findIndex((choice) => canAfford(next, choice.supplies)),
  );
  assert.ok(!availableCampStories(cleared).some((story) => story.id === 'mara-map'));
  assert.ok(availableCampStories(cleared).some((story) => story.id === 'iona-tea'));
  assert.ok(!cleared.actions.includes('marked-road'));
  assert.match(dayView(marked.chronicle.at(-1)), /data-art="axle"/);
  assert.deepEqual(readSave(JSON.stringify(marked)), marked);
});

test('new expeditions can draw added road encounters and migrated seeds keep their old pool', () => {
  let added = 0;
  const newIds = new Set(newEncounters.map((e) => e.id));
  for (let i = 0; i < 80; i++) {
    const g = newGame('comic-' + i);
    const old = readSave(JSON.stringify({ ...g, version: 7 }));
    assert.equal(old.expandedEncounters, false);
    const location = routes(g)[0].id;
    if (newIds.has(travel(g, location).pending)) added++;
    assert.ok(!newIds.has(travel(old, location).pending));
  }
  assert.ok(added > 0);
});
