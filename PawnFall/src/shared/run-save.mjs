import { Game, stats } from './combat.mjs';
import { UPGRADES, weaponById } from './arsenal.mjs';
import { PROMOTIONS } from './promotion.mjs';
import { EVENT_IDS } from './encounter-events.mjs';
import { ROUTES } from './routes.mjs';
import { curseById } from './run-options.mjs';
const MODES = ['playing', 'route', 'upgrade', 'promotion', 'event'];

function validTree(v, depth = 0) {
  if (depth > 22) return false;
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) < 1e9;
  if (typeof v === 'string') return v.length < 2200;
  if (v === null || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length <= 300 && v.every((x) => validTree(x, depth + 1));
  return (
    !!v &&
    typeof v === 'object' &&
    Object.entries(v).every(
      ([k, x]) =>
        !['__proto__', 'prototype', 'constructor', 'partners'].includes(k) &&
        validTree(x, depth + 1),
    )
  );
}

export function cleanRunSave(raw) {
  try {
    if (!raw || raw.version !== 1 || JSON.stringify(raw).length > 300000 || !validTree(raw))
      return null;
    const g = raw.game;
    if (
      g?.endless &&
      (!Number.isInteger(g.endless.encounter) ||
        g.endless.encounter < 1 ||
        !Number.isInteger(g.endless.cleared) ||
        g.endless.cleared !== g.endless.encounter - 1 ||
        !Number.isInteger(g.endless.startChapter) ||
        g.endless.startChapter < 0 ||
        g.endless.startChapter > 3)
    )
      return null;
    if (
      !g ||
      !MODES.includes(g.mode) ||
      !Number.isInteger(g.chapter) ||
      g.chapter < 0 ||
      g.chapter > 3 ||
      !Number.isFinite(g.hp) ||
      !Number.isFinite(g.stamina) ||
      !Number.isInteger(g.wave) ||
      g.wave < 0 ||
      g.wave > 4 ||
      g.hp <= 0 ||
      g.hp > 100 ||
      g.stamina < 0 ||
      g.stamina > 100 ||
      !Array.isArray(g.enemies) ||
      g.enemies.length > 45 ||
      g.projectiles?.length > 200 ||
      g.training ||
      g.partners
    )
      return null;
    if (
      !g.player ||
      !stats[g.player.type] ||
      !Number.isFinite(g.player.x) ||
      !Number.isFinite(g.player.z) ||
      Math.abs(g.player.x) > 10.6 ||
      Math.abs(g.player.z) > 10.6 ||
      !g.enemies.every(
        (e) =>
          stats[e.type] &&
          typeof e.id === 'string' &&
          e.id.length < 60 &&
          Math.abs(e.x) < 18 &&
          Math.abs(e.z) < 18 &&
          (!e.boss || ['castellan', 'confessor', 'fallenking'].includes(e.boss)),
      )
    )
      return null;
    const choices = {
      routeChoices: ROUTES.map((r) => r.id),
      upgradeChoices: UPGRADES.map((u) => u.id),
      promotionChoices: PROMOTIONS,
      eventChoices: EVENT_IDS,
    };
    for (const [key, ids] of Object.entries(choices))
      if (!Array.isArray(g[key]) || !g[key].every((id) => ids.includes(id))) return null;
    const required = {
      route: 'routeChoices',
      upgrade: 'upgradeChoices',
      promotion: 'promotionChoices',
      event: 'eventChoices',
    }[g.mode];
    if (required && !g[required].length) return null;
    for (const [id, n] of Object.entries(g.upgrades || {})) {
      const u = UPGRADES.find((u) => u.id === id);
      if (!u || !Number.isInteger(n) || n < 0 || n > u.max) return null;
    }
    const template = new Game(),
      clean = {};
    for (const key of [...Object.keys(template), 'checkpointMode', 'intermissionBudget'])
      if (Object.hasOwn(g, key) && key !== 'events') clean[key] = g[key];
    clean.weapon = weaponById(clean.weapon).id;
    clean.curse = curseById(clean.curse).id;
    clean.events = [];
    return {
      version: 1,
      game: clean,
      camera: {
        yaw: Number(raw.camera?.yaw) || 0,
        pitch: Math.max(3, Math.min(12, Number(raw.camera?.pitch) || 7)),
        zoom: Math.max(6, Math.min(16, Number(raw.camera?.zoom) || 10)),
      },
    };
  } catch {
    return null;
  }
}

export function captureRun(game, mode = game.mode, camera = {}) {
  if (game.training || game.partners || !MODES.includes(mode) || game.hp <= 0) return null;
  const data = JSON.parse(
    JSON.stringify(game, (k, v) =>
      ['partners', 'events', 'peer', 'presentationPlayer'].includes(k) ? undefined : v,
    ),
  );
  data.mode = mode;
  data.events = [];
  return cleanRunSave({ version: 1, game: data, camera });
}

export function restoreRun(game, raw) {
  const data = cleanRunSave(raw);
  if (!data) return false;
  game.reset(data.game.chapter);
  Object.assign(game, data.game);
  game.events = [];
  return data.camera;
}

export class RunStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.available = !!this.get();
  }

  get() {
    try {
      return cleanRunSave(
        JSON.parse(this.storage.getItem('pawnfall-solo-suspension-v1') || 'null'),
      );
    } catch {
      return null;
    }
  }

  save(game, mode, camera) {
    const data = captureRun(game, mode, camera);
    if (!data) return false;
    try {
      this.storage.setItem('pawnfall-solo-suspension-v1', JSON.stringify(data));
      this.available = true;
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      this.storage.removeItem('pawnfall-solo-suspension-v1');
      this.available = false;
    } catch {}
  }
}
