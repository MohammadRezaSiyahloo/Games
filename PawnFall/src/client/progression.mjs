import { cleanDiscoveries, discoveriesFromStats } from '../shared/bestiary.mjs';
import { unlockedRelic } from '../shared/boss-relics.mjs';
import { ACHIEVEMENTS, SKINS, TITLES } from '../shared/content.mjs';
import {
  availableLoadout,
  finishedPlays,
  LOADOUT_UNLOCKS,
  requiredPlays,
  STARTING_LOADOUT,
} from '../shared/loadout-unlocks.mjs';

export const freshProfile = () => ({
  name: 'Wanderer',
  skin: 'ivory',
  ...STARTING_LOADOUT,
  bossRelic: 'none',
  curse: 'none',
  coopRole: 'balanced',
  title: 'wanderer',
  stats: {
    finishedPlays: 0,
    kills: 0,
    castellanKills: 0,
    confessorKills: 0,
    fallenKingKills: 0,
    parries: 0,
    blocks: 0,
    dodges: 0,
    wins: 0,
    frostWins: 0,
    versusWins: 0,
    coopWins: 0,
    souls: 0,
    clears: 0,
    perfects: 0,
  },
  completed: [],
  encountered: [],
  unlocked: [],
  updated: 0,
});

export class Progression {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.data = freshProfile();
    try {
      Object.assign(this.data, JSON.parse(storage.getItem('pawnfall-profile-v4') || '{}'));
    } catch {}
    const plays = finishedPlays(this.data.stats);
    this.data.stats = { ...freshProfile().stats, ...this.data.stats, finishedPlays: plays };
    this.normalizeLoadout();
    this.data.encountered = cleanDiscoveries([
      ...cleanDiscoveries(this.data.encountered),
      ...discoveriesFromStats(this.data.stats),
    ]);
    this.changed = () => {};
    this.onAward = () => {};
    this.damaged = false;
    this.netDirty = false;
  }

  save() {
    this.data.updated = Date.now();
    this.netDirty = true;
    try {
      this.storage.setItem('pawnfall-profile-v4', JSON.stringify(this.data));
    } catch {}
    this.changed();
  }

  add(key, n = 1) {
    this.data.stats[key] = (this.data.stats[key] || 0) + n;
    this.check();
    this.save();
  }

  check() {
    for (const a of ACHIEVEMENTS) {
      const value = a.key === 'chapters' ? this.data.completed.length : this.data.stats[a.key] || 0;
      if (value >= a.goal && !this.data.unlocked.includes(a.id)) {
        this.data.unlocked.push(a.id);
        this.onAward(a);
      }
    }
  }

  event(ev, chapter) {
    if (ev.type === 'hurt' && ev.id === 'player') this.damaged = true;
    if (ev.type === 'kill') {
      this.add('kills');
      this.add('souls', ev.souls || 0);
    }
    if (['objectiveReward', 'arenaObjectiveReward'].includes(ev.type))
      this.add('souls', ev.reward || 0);
    if (ev.type === 'bossDefeated')
      this.add(
        ev.boss === 'fallenking'
          ? 'fallenKingKills'
          : ev.boss === 'confessor'
            ? 'confessorKills'
            : 'castellanKills',
      );
    if (ev.type === 'parry') this.add('parries');
    if (ev.type === 'block') this.add('blocks');
    if (ev.type === 'dodge') this.add('dodges');
    if (ev.type === 'wave') this.damaged = false;
    if (ev.type === 'cleared') {
      this.add('clears');
      if (!this.damaged) this.add('perfects');
    }
    if (ev.type === 'end' && ev.won && !ev.trial) {
      if (!this.data.completed.includes(chapter)) this.data.completed.push(chapter);
      this.add('wins');
      if (chapter === 'frost') this.add('frostWins');
    }
  }

  normalizeLoadout() {
    for (const slot of ['weapon', 'chessClass'])
      this.data[slot] = availableLoadout(slot, this.data[slot], this.data.stats);
  }

  equipLoadout(slot, id) {
    if (requiredPlays(slot, id) > this.data.stats.finishedPlays) return false;
    this.data[slot] = id;
    this.save();
    return true;
  }

  recordFinishedPlay() {
    this.add('finishedPlays');
    return LOADOUT_UNLOCKS.find((item) => item.plays === this.data.stats.finishedPlays);
  }

  equip(skin) {
    const s = SKINS.find((s) => s.id === skin);
    if (!s || (s.unlock && !this.data.unlocked.includes(s.unlock))) return false;
    this.data.skin = skin;
    this.save();
    return true;
  }

  equipRelic(id) {
    if (unlockedRelic(id, this.data.stats) !== id) return false;
    this.data.bossRelic = id;
    this.save();
    return true;
  }

  equipTitle(id) {
    const t = TITLES.find((t) => t.id === id);
    if (!t || (t.unlock && !this.data.unlocked.includes(t.unlock))) return false;
    this.data.title = id;
    this.save();
    return true;
  }

  merge(remote) {
    if (!remote) return;
    const local = this.data;
    local.stats.finishedPlays = Math.max(local.stats.finishedPlays, finishedPlays(remote.stats));
    for (const k of Object.keys(local.stats).filter((k) => k !== 'finishedPlays'))
      local.stats[k] = Math.max(local.stats[k] || 0, remote.stats?.[k] || 0);
    local.encountered = cleanDiscoveries([
      ...(local.encountered || []),
      ...cleanDiscoveries(remote.encountered),
      ...discoveriesFromStats(local.stats),
    ]);
    local.completed = [...new Set([...local.completed, ...(remote.completed || [])])];
    local.unlocked = [...new Set([...local.unlocked, ...(remote.unlocked || [])])];
    this.check();
    this.save();
  }
}
