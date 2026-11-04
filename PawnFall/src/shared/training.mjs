import { difficultyById, postureByType } from './combat-rules.mjs';

export function configureTraining(game, stats, options = {}) {
  const type = Object.hasOwn(stats, options.enemy) ? options.enemy : 'pawn';
  game.runModifier = 'none';
  game.checkpoint = null;
  game.flasks = 3;
  game.training = {
    behavior: ['attack', 'guard', 'dummy'].includes(options.behavior) ? options.behavior : 'attack',
    unlimited: options.unlimited !== false,
    hits: 0,
    parries: 0,
    blocks: 0,
    dodges: 0,
    damage: 0,
    taken: 0,
  };
  const hp = Math.round(stats[type].hp * difficultyById(game.difficulty).hp);
  game.enemies = [
    {
      id: 'sparring',
      type,
      x: 0,
      z: 0,
      y: 0,
      face: 0,
      hp,
      max: hp,
      state: 'approach',
      until: 0,
      cooldown: game.time + 1,
      count: 0,
      activeHit: false,
      hitUntil: 0,
      dead: false,
      guardCapable: type === 'rook' || options.behavior === 'guard',
      maxPoise: postureByType[type],
      flankSide: 1,
    },
  ];
  game.objective = null;
  game.arenaObjective = null;
  game.promotionChoices = [];
  game.hazards = [];
  game.projectiles = [];
  game.events = [];
  game.clearAt = 0;
  game.souls = 0;
}

export function recordPractice(game, event) {
  const t = game.training;
  if (!t) return;
  if (event.type === 'hurt') {
    if (event.id === 'player') t.taken += event.damage || 0;
    else {
      t.hits++;
      t.damage += event.damage || 0;
    }
  }
  if (event.type === 'parry') t.parries++;
  if (event.type === 'block') t.blocks++;
  if (event.type === 'dodge') t.dodges++;
}
