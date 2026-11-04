export const EVENT_IDS = [
  'decline',
  'bargain',
  'duel',
  'temper',
  'forge:spear',
  'forge:greatsword',
  'forge:twinblades',
];

export function eventOffers(game) {
  if (
    game.training ||
    game.bossTrial ||
    game.wave < 1 ||
    game.wave > 3 ||
    game.eventResolvedWave === game.wave
  )
    return [];
  if (game.streamlinedIntermission && game.wave === 3) {
    const kind = game.expedition ? 'forge' : ['bargain', 'duel', 'forge', 'forge'][game.chapter];
    return kind === 'bargain'
      ? ['bargain', 'decline']
      : kind === 'duel'
        ? ['duel', 'decline']
        : ['temper', 'forge:spear', 'forge:greatsword', 'forge:twinblades', 'decline'];
  }
  return game.wave === 1
    ? ['bargain', 'decline']
    : game.wave === 2
      ? ['duel', 'decline']
      : ['temper', 'forge:spear', 'forge:greatsword', 'forge:twinblades', 'decline'];
}

export function eventInfo(id, game) {
  const names = { spear: 'Spear', greatsword: 'Greatsword', twinblades: 'Twin blades' };
  if (id === 'bargain')
    return {
      name: 'Bargain with the captive bishop',
      text: 'Pay 80 souls. Restore 25 vitality and receive one healing flask.',
      cost: 80,
    };
  if (id === 'duel')
    return {
      name: 'Accept the wounded knight’s challenge',
      text: 'An extra knight joins this encounter with 75 vitality. Defeat it for 180 bonus souls.',
      cost: 0,
    };
  if (id === 'temper')
    return {
      name: 'Temper your weapon',
      text: 'Pay 120 souls for one rank of Tempered Steel (+15% weapon damage).',
      cost: 120,
    };
  if (id.startsWith('forge:'))
    return {
      name: 'Forge a ' + names[id.slice(6)],
      text: 'Pay 160 souls to equip this weapon for the rest of the run. Your blessings remain.',
      cost: 160,
    };
  return {
    name: 'Continue your journey',
    text: 'Keep your souls and enter the next encounter.',
    cost: 0,
  };
}

export function offerEvent(game) {
  game.eventChoices = eventOffers(game);
  if (!game.eventChoices.length) return false;
  game.mode = 'event';
  game.player.state = 'idle';
  game.player.block = false;
  return true;
}

export function eventCanChoose(game, id) {
  return (
    !!game.eventChoices?.includes(id) &&
    game.souls >= eventInfo(id, game).cost &&
    (id !== 'temper' || (game.upgrades.force || 0) < 3)
  );
}

export function applyEventEncounter(game) {
  if (game.encounterEvent?.wave !== game.wave || game.encounterEvent.id !== 'duel') return;
  const e = game.makeReinforcement(-8);
  Object.assign(e, { name: 'The Wounded Knight', hp: 75, max: 75, eventDuel: true });
  game.enemies.push(e);
}

export function chooseEvent(game, id) {
  if (game.mode !== 'event' || !eventCanChoose(game, id)) return false;
  game.souls -= eventInfo(id, game).cost;
  game.eventResolvedWave = game.wave;
  game.eventChoices = [];
  game.encounterEvent = { wave: game.wave, id };
  if (id === 'bargain') {
    game.hp = Math.min(100, game.hp + 25);
    game.flasks = Math.min(12, game.flasks + 1);
  }
  if (id === 'temper') game.upgrades.force = (game.upgrades.force || 0) + 1;
  if (id.startsWith('forge:')) {
    game.weapon = id.slice(6);
    game.player.weapon = game.weapon;
  }
  if (id === 'duel') applyEventEncounter(game);
  game.mode = 'playing';
  game.emit('eventChosen', { choice: id });
  return true;
}
