import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { crew, offers, places, regions, resources } from '../src/content.ts';
import { favors, lateStops } from '../src/far-road.ts';
import {
  forks,
  outfits,
  recruits,
  rolePerks,
  roles,
  upgrades,
  variants,
} from '../src/expansion.ts';
import {
  allEncounters,
  assign,
  cook,
  forage,
  install,
  newGame,
  recruit,
  resolve,
  rest,
  trade,
  travel,
  treat,
} from '../src/game.ts';
import { arrow, digits, journalText, percent, t, useLanguage } from '../src/locale.ts';
import { badges, emptyProfile, readProfile } from '../src/profile.ts';
import { campView, marketView, recordsView, settingsView, setupView } from '../src/views.ts';

const persian = /[\u0600-\u06ff]/;
const localized = (value) => {
  assert.notEqual(t(value), value, value);
  assert.match(t(value), persian, value);
};

test('Persian covers every location, encounter, option, recruit, and progression entry', () => {
  useLanguage('fa');
  for (const p of [...places, ...variants, ...forks]) {
    localized(p.name);
    localized(p.description);
  }
  for (const event of allEncounters) {
    localized(event.title);
    localized(event.narrative);
    for (const choice of event.choices) {
      localized(choice.label);
      localized(choice.result);
    }
  }
  for (const person of [...crew, ...recruits]) {
    for (const value of [person.name, person.trait, person.story]) localized(value);
  }
  for (const offer of offers) localized(offer.label);
  for (const text of [...regions, ...resources, ...roles, ...Object.values(rolePerks)])
    localized(text);
  for (const item of [...upgrades, ...outfits, ...badges]) {
    localized(item.name);
    localized(item.detail);
  }
  assert.equal(digits(123), '۱۲۳');
  assert.equal(percent(85), '۸۵٪');
  assert.equal(arrow(), '←');
  useLanguage('en');
  assert.equal(t('The Last Caravan'), 'The Last Caravan');
});

test('every literal translation key used by the interface has a Persian translation', () => {
  useLanguage('fa');
  for (const name of ['main', 'views', 'markup', 'chronicle-view', 'ending-view', 'comic-view']) {
    const source = ts.createSourceFile(
      name + '.ts',
      readFileSync(new URL('../src/' + name + '.ts', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        localized(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  useLanguage('en');
});

test('Persian views preserve stable action IDs and persist the language preference', () => {
  const profile = emptyProfile();
  profile.settings.language = 'fa';
  assert.equal(readProfile(JSON.stringify(profile)).settings.language, 'fa');
  assert.equal(readProfile('{"records":[],"badges":[]}').settings.language, 'en');
  useLanguage('fa');
  const game = newGame('Hearth-01');
  const atMarket = resolve(travel(game, 'pine'), 1);
  assert.match(settingsView(profile), /تنظیمات|صدای محیط/);
  assert.match(setupView(game, profile, undefined), /کاروان آغازین/);
  assert.match(marketView(atMarket, ''), /جذب نِسا فلینت/);
  assert.match(recordsView(profile), /دستاوردها/);
  assert.match(campView(game, 'supplies', ''), /تعمیر گاری/);
  assert.match(campView(game, 'workshop', ''), /چرخ آهن‌بند/);
  assert.match(
    campView(game, 'duties', ''),
    /value="Medic">درمانگر|value="Medic" selected>درمانگر/,
  );
  useLanguage('en');
});

test('journal messages stay switchable after travel, decisions, and camp management', () => {
  let game = newGame('Hearth-01');
  game = install(game, 'rack');
  game = forage(cook(game));
  game = resolve(travel(game, 'pine'), 1);
  game = trade(game, 'water');
  game = recruit(game);
  if (game.crew.length > 4) game = assign(game, 4, 'Guard');
  game.crew[0].health = 63;
  game = treat(game, 0);
  game = rest(game);
  useLanguage('fa');
  for (const entry of game.log) {
    assert.notEqual(journalText(entry.text), entry.text, entry.text);
    assert.match(journalText(entry.text), persian);
  }
  assert.equal(journalText('constructor'), 'constructor');
  useLanguage('en');
  assert.equal(journalText(game.log[0].text), game.log[0].text);
});
