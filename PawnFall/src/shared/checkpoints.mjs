import { curseById } from './run-options.mjs';
import { cleanJournal } from './run-chronicle.mjs';
import { EVENT_IDS } from './encounter-events.mjs';
import { cleanRoute } from './routes.mjs';
import { weaponById, UPGRADES } from './arsenal.mjs';
import { pieceById } from './piece-abilities.mjs';
import { validModifier } from './run-modifiers.mjs';
import { validDifficulty } from './combat-rules.mjs';
const bounded = (n, a, b, fallback) =>
  Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : fallback;

export function captureCheckpoint(game) {
  if (
    game.training ||
    game.endless ||
    game.bossTrial ||
    game.checkpointMode === 'fullrun' ||
    game.partners
  )
    return null;
  const checkpoint = {
    version: 1,
    journal: cleanJournal(game.journal),
    tactics: { ...game.tactics },
    rivalMemory: game.rivalMemory,
    encounterEvent: game.encounterEvent,
    eventResolvedWave: game.eventResolvedWave,
    route: cleanRoute(game.route),
    chapter: game.chapter,
    wave: game.wave,
    difficulty: game.difficulty,
    runModifier: game.runModifier,
    weapon: game.weapon,
    curse: game.curse,
    secretFound: !!game.secretFound,
    chessClass: game.chessClass,
    promotionResolved: !!game.promotionResolved,
    bossRelic: game.bossRelic || 'none',
    upgrades: { ...game.upgrades },
    hp: game.hp,
    flasks: game.flasks,
    souls: game.souls,
    time: game.time,
    abilityRemaining: Math.max(0, game.abilityReadyAt - game.time),
    player: { x: game.player.x, z: game.player.z, face: game.player.face },
  };
  game.checkpoint = checkpoint;
  return checkpoint;
}

export function cleanCheckpoint(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Number.isInteger(data.chapter) ||
    data.chapter < 0 ||
    data.chapter > 3 ||
    !Number.isInteger(data.wave) ||
    data.wave < 0 ||
    data.wave > 4
  )
    return null;
  const upgrades = {};
  for (const u of UPGRADES)
    if (data.upgrades?.[u.id])
      upgrades[u.id] = Math.floor(bounded(data.upgrades[u.id], 0, u.max, 0));
  return {
    ...data,
    curse: curseById(data.curse).id,
    secretFound: !!data.secretFound,
    journal: cleanJournal(data.journal),
    tactics: Object.fromEntries(
      ['light', 'heavy', 'blocks'].map((k) => [
        k,
        Math.floor(bounded(data.tactics?.[k], 0, 10000, 0)),
      ]),
    ),
    rivalMemory: data.rivalMemory
      ? {
          escaped: !!data.rivalMemory.escaped,
          defeated: !!data.rivalMemory.defeated,
          adaptation: ['sentinel', 'hunter', 'breaker'].includes(data.rivalMemory.adaptation)
            ? data.rivalMemory.adaptation
            : 'sentinel',
        }
      : null,
    encounterEvent:
      data.encounterEvent?.wave === data.wave && EVENT_IDS.includes(data.encounterEvent.id)
        ? { wave: data.wave, id: data.encounterEvent.id }
        : null,
    eventResolvedWave: data.eventResolvedWave === data.wave ? data.wave : -1,
    route: cleanRoute(data.route),
    weapon: weaponById(data.weapon).id,
    chessClass: pieceById(data.chessClass).id,
    promotionResolved: data.wave >= 2 && !!data.promotionResolved,
    difficulty: validDifficulty(data.difficulty),
    runModifier: validModifier(data.runModifier),
    upgrades,
    hp: bounded(data.hp, 1, 100, 100),
    flasks: Math.floor(bounded(data.flasks, 0, 12, 3)),
    souls: Math.floor(bounded(data.souls, 0, 1e7, 0)),
    time: bounded(data.time, 0, 36000, 0),
    abilityRemaining: bounded(data.abilityRemaining, 0, 120, 0),
    player: {
      x: bounded(data.player?.x, -10.5, 10.5, 0),
      z: bounded(data.player?.z, -10.5, 10.5, 6),
      face: bounded(data.player?.face, -1000, 1000, Math.PI),
    },
  };
}

export function restoreCheckpoint(game, data = game.checkpoint) {
  const c = cleanCheckpoint(data);
  if (!c || game.partners || game.checkpointMode === 'fullrun') return false;
  game.difficulty = c.difficulty;
  game.runModifier = c.runModifier;
  game.weapon = c.weapon;
  game.curse = c.curse;
  game.chessClass = c.chessClass;
  game.bossRelic = c.bossRelic;
  game.reset(c.chapter);
  game.secretFound = c.secretFound;
  Object.assign(game, {
    wave: c.wave,
    journal: c.journal,
    tactics: c.tactics,
    rivalMemory: c.rivalMemory,
    encounterEvent: c.encounterEvent,
    eventResolvedWave: c.eventResolvedWave,
    route: c.route,
    promotionResolved: c.promotionResolved,
    upgrades: c.upgrades,
    hp: c.hp,
    flasks: c.flasks,
    souls: c.souls,
    time: c.time,
    stamina: 100,
    abilityReadyAt: c.time + c.abilityRemaining,
    clearAt: 0,
    mode: 'playing',
    checkpointMode: 'encounter',
  });
  Object.assign(game.player, c.player);
  game.player.invuln = c.time + 1;
  game.events = [];
  game.spawn();
  game.journal = c.journal;
  captureCheckpoint(game);
  return true;
}
