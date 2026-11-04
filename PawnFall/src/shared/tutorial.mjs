import { configureTraining } from './training.mjs';
export const TUTORIAL_STEPS = [
  { id: 'move', title: 'Find your footing', text: 'Move three units around the practice board.' },
  {
    id: 'attack',
    title: 'Land a light attack',
    text: 'Move into sword range and hit the pawn with a light attack.',
  },
  {
    id: 'heavy',
    title: 'Commit to a heavy',
    text: 'Land a heavy attack. Notice the longer windup and stamina cost.',
  },
  {
    id: 'dodge',
    title: 'Roll to safety',
    text: 'Move in a direction and roll. You are briefly invulnerable during the roll.',
  },
  {
    id: 'block',
    title: 'Hold your guard',
    text: 'Face the pawn and hold Guard through a strike. A normal block is required here.',
  },
  {
    id: 'parry',
    title: 'Time a perfect parry',
    text: 'Release Guard for a moment, then tap it just before the strike lands. Holding guard does not count.',
  },
  {
    id: 'ability',
    title: 'Use your piece ability',
    text: 'Use your pawn ability. It advances, then strikes the two forward diagonals. Aim a diagonal at the pawn.',
  },
  {
    id: 'stamina',
    title: 'Recover your stamina',
    text: 'Release Guard and stop sprinting. Let stamina recover to 85.',
  },
];

export function configureTutorial(game, stats) {
  game.difficulty = 'pilgrim';
  game.curse = 'none';
  game.bossRelic = 'none';
  game.chessClass = 'pawn';
  game.player.type = 'pawn';
  game.setWeapon('longsword');
  configureTraining(game, stats, { enemy: 'pawn', behavior: 'dummy', unlimited: false });
  game.player.x = 0;
  game.player.z = 5;
  game.player.face = Math.PI;
  game.training.tutorial = { step: 0, moved: 0, previous: { x: 0, z: 5 }, complete: false };
  const e = game.enemies[0];
  e.hp = e.max = 100000;
  e.guardCapable = false;
}

function next(game) {
  const t = game.training.tutorial;
  t.step++;
  t.moved = 0;
  t.previous = { x: game.player.x, z: game.player.z };
  game.hp = 100;
  game.stamina = 100;
  game.regenAt = game.time;
  game.player.state = 'idle';
  game.player.attackEnd = 0;
  game.player.ability = null;
  game.player.block = false;
  game.guardHeld = false;
  game.training.behavior = ['block', 'parry'].includes(TUTORIAL_STEPS[t.step]?.id)
    ? 'attack'
    : 'dummy';
  const e = game.enemies[0];
  Object.assign(e, {
    x: 0,
    z: 0,
    y: 0,
    state: 'approach',
    cooldown: game.time + 1.2,
    until: 0,
    dead: false,
    hp: e.max,
    count: 0,
    ability: null,
  });
  if (['block', 'parry', 'ability'].includes(TUTORIAL_STEPS[t.step]?.id)) {
    game.player.x = 0;
    game.player.z = 2.2;
    game.player.face = Math.PI;
  }
  if (TUTORIAL_STEPS[t.step]?.id === 'ability') {
    game.player.z = 4.5;
    e.x = 1.4;
    e.z = 0.3;
    game.abilityReadyAt = game.time;
  }
  if (TUTORIAL_STEPS[t.step]?.id === 'stamina') game.stamina = 20;
  if (t.step >= TUTORIAL_STEPS.length) {
    t.complete = true;
    game.training.behavior = 'dummy';
    game.emit('tutorialComplete');
  } else game.emit('tutorialStep', { step: t.step });
}

export function tutorialEvent(game, ev) {
  const t = game.training?.tutorial;
  if (!t || t.complete) return;
  const id = TUTORIAL_STEPS[t.step].id;
  if (
    (id === 'attack' &&
      ev.type === 'hurt' &&
      ev.id !== 'player' &&
      game.player.state === 'attack' &&
      game.player.attackKind !== 'heavy') ||
    (id === 'heavy' &&
      ev.type === 'hurt' &&
      ev.id !== 'player' &&
      game.player.attackKind === 'heavy') ||
    (id === 'dodge' && ev.type === 'dodge') ||
    (id === 'block' && ev.type === 'block') ||
    (id === 'parry' && ev.type === 'parry') ||
    (id === 'ability' &&
      ev.type === 'hurt' &&
      ev.id !== 'player' &&
      game.player.state === 'ability')
  )
    next(game);
}

export function updateTutorial(game, input = {}) {
  const t = game.training?.tutorial;
  if (!t || t.complete) return;
  const id = TUTORIAL_STEPS[t.step].id;
  if (id === 'move') {
    t.moved += Math.hypot(game.player.x - t.previous.x, game.player.z - t.previous.z);
    t.previous = { x: game.player.x, z: game.player.z };
    if (t.moved >= 3) next(game);
  } else if (id === 'stamina' && game.stamina >= 85 && !input.block && !input.sprint) next(game);
}
