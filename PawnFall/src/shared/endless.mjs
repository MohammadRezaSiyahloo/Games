import { difficultyById } from './combat-rules.mjs';

export function beginEndless(game) {
  game.endless = { encounter: 1, cleared: 0, startChapter: game.chapter };
  game.checkpointMode = 'fullrun';
  game.checkpoint = null;
}

export function endlessHealth(game) {
  return game.endless ? 1 + (game.endless.encounter - 1) * 0.035 : 1;
}

export function endlessDamage(game) {
  return game.endless ? 1 + (game.endless.encounter - 1) * 0.018 : 1;
}

export function advanceEndless(game) {
  const run = game.endless;
  run.cleared++;
  run.encounter++;
  game.wave = (run.encounter - 1) % 5;
  game.chapter = (run.startChapter + Math.floor((run.encounter - 1) / 5)) % 4;
  game.route = null;
  game.encounterEvent = null;
  game.eventResolvedWave = -1;
  game.hp = Math.min(100, game.hp + difficultyById(game.difficulty).heal);
  game.stamina = 100;
  if (game.wave === 0 && game.flasks < 3) game.flasks++;
  game.spawn();
  if (run.cleared % 10 === 0) {
    run.pendingMilestone = run.cleared;
    game.emit('endlessMilestone', { cleared: run.cleared });
  }
  game.beginIntermission();
}
