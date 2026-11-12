import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAfford,
  decideLetter,
  newGame,
  pendingEvent,
  readSave,
  resolve,
  routes,
  travel,
} from '../src/game.ts';
import {
  letterChoices,
  letterEnding,
  letterIntro,
  letterNarrative,
  letterPending,
  letterTitle,
} from '../src/letter.ts';
import { journalText, t, useLanguage } from '../src/locale.ts';

const start = () => newGame('Hearth-01', 'standard', 'letter-test', false, 'frontier');
function clearRoad(g) {
  const event = pendingEvent(g);
  return event
    ? resolve(
        g,
        event.choices.findIndex((choice) => canAfford(g, choice.supplies)),
      )
    : g;
}
function atLetter() {
  let g = clearRoad(travel(start(), 'pine'));
  g = travel(g, 'pass');
  assert.ok(g.pending);
  assert.equal(letterPending(g), false);
  return clearRoad(g);
}
function towardGate(game) {
  let g = game;
  for (const id of ['bridge', 'station', 'city']) {
    g.supplies = { food: 12, water: 12, medicine: 3, coins: 12, materials: 4 };
    g = clearRoad(travel(g, id));
    assert.equal(g.current, id);
  }
  return g;
}

test('the opening introduces Lina and the story waits for the next road encounter to finish', () => {
  const g = start();
  assert.equal(g.chronicle[0].changes[0].reason, letterIntro);
  assert.equal(decideLetter(g, 'keep'), g);
  const pending = atLetter();
  assert.equal(letterPending(pending), true);
  assert.equal(travel(pending, routes(pending)[0].id), pending);
  assert.deepEqual(readSave(JSON.stringify(pending)), pending);
});

test('finishing costs a ration and records the actual morale gain; keeping the draft is free', () => {
  const g = atLetter();
  g.crew[3].morale = 98;
  const finished = decideLetter(g, 'finish');
  assert.equal(finished.letter, 'sealed');
  assert.equal(finished.supplies.food, g.supplies.food - 1);
  assert.equal(finished.crew[3].morale, 100);
  assert.equal(finished.chronicle.at(-1).changes[0].crew[0].morale, 2);
  assert.equal(decideLetter(finished, 'finish'), finished);
  g.supplies.food = 0;
  assert.equal(decideLetter(g, 'finish'), g);
  const draft = decideLetter(g, 'keep');
  assert.equal(draft.letter, 'draft');
  assert.deepEqual(draft.supplies, g.supplies);
  assert.equal(draft.chronicle.at(-1).changes[0].reason, letterTitle);
});

test('completed and unfinished letters pay off differently when Tomas reaches Lina', () => {
  const pending = atLetter();
  const completed = towardGate(decideLetter(pending, 'finish'));
  const draft = towardGate(decideLetter(pending, 'keep'));
  assert.equal(completed.status, 'won');
  assert.equal(draft.status, 'won');
  assert.match(letterEnding(completed).text, /reads the letter slowly/);
  assert.match(letterEnding(draft).text, /finish the sentence aloud/);
  assert.ok(
    completed.chronicle
      .at(-1)
      .changes.some((change) => change.reason === letterEnding(completed).text),
  );
});

test('the crew can write a remembrance and the closest surviving companion delivers it', () => {
  const g = atLetter();
  g.crew[3].health = 0;
  g.crew[3].morale = 0;
  g.bonds = [{ a: 'bram', b: 'tomas', strength: 2 }];
  assert.match(letterNarrative(g), /inside Tomas’s coat/);
  assert.match(letterChoices(g).finish.label, /write Lina a note/);
  const finished = decideLetter(g, 'finish');
  assert.equal(finished.crew[1].morale, g.crew[1].morale + 3);
  const won = towardGate(finished);
  assert.equal(won.status, 'won');
  assert.equal(letterEnding(won).bearer, 1);
  assert.match(won.chronicle.at(-1).changes.at(-1).reason, /Bram Holt finds Lina/);
  useLanguage('fa');
  try {
    assert.match(journalText(won.chronicle.at(-1).changes.at(-1).reason), /برام هولت/);
    assert.match(t(letterNarrative(g)), /نامه/);
  } finally {
    useLanguage('en');
  }
});

test('if Tomas falls after sealing the letter, the diary identifies who picks it up', () => {
  let g = decideLetter(atLetter(), 'finish');
  g.crew[3].health = 3;
  g.supplies.food = 2;
  g.supplies.water = 4;
  g = travel(g, 'bridge');
  assert.equal(g.crew[3].health, 0);
  assert.match(
    g.log.find((entry) => entry.text.includes('somewhere dry')).text,
    /Mara Voss takes Lina/,
  );
  const change = g.chronicle.at(-1).changes.find((c) => c.reason.includes('somewhere dry'));
  assert.ok(change);
  const won = towardGateFromBridge(g);
  assert.equal(won.status, 'won');
  assert.match(won.chronicle.at(-1).changes.at(-1).reason, /Mara Voss finds Lina/);
});
function towardGateFromBridge(game) {
  let g = clearRoad(game);
  for (const id of ['station', 'city']) {
    g.supplies = { food: 12, water: 12, medicine: 3, coins: 12, materials: 4 };
    g = clearRoad(travel(g, id));
  }
  return g;
}

test('an older save keeps its diary without receiving a mid-journey story prompt', () => {
  const { letter, ...previous } = clearRoad(travel(start(), 'pine'));
  const migrated = readSave(JSON.stringify({ ...previous, version: 4 }));
  assert.equal(migrated.letter, 'absent');
  assert.deepEqual(migrated.chronicle, previous.chronicle);
  assert.equal(letterPending(clearRoad(travel(migrated, 'pass'))), false);
});

test('the ridge bypass still leaves room for the letter’s choice and road callback', () => {
  let g = clearRoad(travel(start(), 'ridge'));
  g.supplies.food = 14;
  g.supplies.water = 14;
  g = clearRoad(travel(g, 'bridge'));
  assert.equal(letterPending(g), true);
  g = decideLetter(g, 'keep');
  g.supplies.food = 10;
  g.supplies.water = 10;
  g = travel(g, 'station');
  assert.ok(g.chronicle.at(-1).changes.some((c) => c.reason.startsWith('At the next halt, Tomas')));
});
