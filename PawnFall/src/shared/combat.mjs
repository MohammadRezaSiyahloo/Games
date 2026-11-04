import { updateTutorial } from './tutorial.mjs';
import { beginEndless, advanceEndless, endlessHealth, endlessDamage } from './endless.mjs';
import { curseById, activeRole, allyProtection } from './run-options.mjs';
import { beginIntermission } from './intermission.mjs';
import { updateArenaShifts } from './arena-shifts.mjs';
import { updateSecretCourt } from './secret-court.mjs';
import {
  createFallenKing,
  royalGuard,
  updateFallenKing,
  kingDamage,
  FALLEN_KING,
} from './fallen-king.mjs';
import { placeRival, rivalRetreat } from './rival.mjs';
import { offerEvent, chooseEvent, applyEventEncounter } from './encounter-events.mjs';
import { recordChronicle } from './run-chronicle.mjs';
import { offerPromotion, choosePromotion } from './promotion.mjs';
import {
  createArenaObjective,
  updateArenaObjective,
  encounterComplete,
  rewardArenaObjective,
  combatTargets,
  hurtObjective,
  objectiveFailureRecap,
} from './arena-objectives.mjs';
import {
  ROUTES,
  routeAvailable,
  applyEncounterRoute,
  rewardRoute,
  updateChampionWards,
} from './routes.mjs';
import { captureCheckpoint } from './checkpoints.mjs';
import { relicById } from './boss-relics.mjs';
import { validModifier } from './run-modifiers.mjs';
import { damageRecord } from './death-recap.mjs';
import { difficultyById, validDifficulty, postureByType, updateHazards } from './combat-rules.mjs';
import { updateEnemy } from './enemy-ai.mjs';
import { createCastellan, updateCastellan, bossDamage, CASTELLAN } from './bosses.mjs';
import { createConfessor, updateConfessor, confessorDamage, CONFESSOR } from './confessor.mjs';
import { weaponById, attackByKind, UPGRADES, upgradeOffers } from './arsenal.mjs';
import { pieceById, beginAbility, tickAbility } from './piece-abilities.mjs';
export const ARENA = 10.5;
export const stats = {
  pawn: { hp: 52, speed: 2.1, range: 2.3, windup: 0.95, damage: 17, recover: 1.15, souls: 80 },
  knight: { hp: 100, speed: 2.5, range: 5.8, windup: 1.15, damage: 24, recover: 1.6, souls: 160 },
  bishop: { hp: 85, speed: 1.8, range: 12, windup: 1.3, damage: 20, recover: 1.5, souls: 140 },
  rook: { hp: 150, speed: 1.35, range: 3.5, windup: 1.35, damage: 30, recover: 1.65, souls: 220 },
  king: { hp: 300, speed: 1.4, range: 3.2, windup: 1.2, damage: 24, recover: 1.4, souls: 500 },
  queen: { hp: 340, speed: 2.1, range: 4, windup: 1.2, damage: 26, recover: 1.1, souls: 600 },
};
import { FORMATIONS as formations, CHAPTERS } from './content.mjs';
export const titles = [
  'The opening gambit',
  'The broken cavalry',
  'The hollow clergy',
  'The iron guard',
  'The fallen queen',
  'The fallen king',
];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function angleLerp(a, b, t) {
  let d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
const norm = (x, z) => {
  let l = Math.hypot(x, z);
  return l ? [x / l, z / l] : [0, 0];
};

export class Game {
  constructor() {
    this.chapter = 0;
    this.serial = 0;
    this.events = [];
    this.mode = 'ready';
    this.reset();
    this.mode = 'ready';
  }

  reset(chapter = this.chapter || 0) {
    this.chapter = chapter;
    this.difficulty = validDifficulty(this.difficulty);
    this.training = null;
    this.curse = curseById(this.curse).id;
    this.coopRole = this.coopRole || 'balanced';
    this.streamlinedIntermission = false;
    this.bossRush = null;
    this.endless = null;
    this.secretFound = false;
    this.secretPortal = null;
    this.arenaShift = null;
    this.shiftAt = Infinity;
    this.shiftCount = 0;
    this.checkpoint = null;
    this.bossRelic = relicById(this.bossRelic).id;
    this.runModifier = validModifier(this.runModifier);
    this.damageHistory = [];
    this.journal = [];
    this.tactics = { light: 0, heavy: 0, blocks: 0 };
    this.rivalMemory = null;
    this.eventChoices = [];
    this.eventResolvedWave = -1;
    this.encounterEvent = null;
    this.teamMemory = [];
    this.deathRecap = null;
    this.hazards = [];
    this.hazardCount = 0;
    this.hazardAt = 8;
    this.mode = 'playing';
    this.bossTrial = false;
    this.weapon = weaponById(this.weapon).id;
    this.chessClass = pieceById(this.chessClass).id;
    this.abilityReadyAt = 0;
    this.upgrades = {};
    this.upgradeChoices = [];
    this.promotionChoices = [];
    this.promotionResolved = false;
    this.arenaObjective = null;
    this.routeChoices = [];
    this.route = null;
    this.pendingBlessings = 0;
    this.upgradePicks = 0;
    this.riposteUntil = 0;
    this.guardPressedAt = -10;
    this.guardReleasedAt = -10;
    this.guardHeld = false;
    this.time = 0;
    this.wave = 0;
    this.souls = 0;
    this.flasks = this.runModifier === 'scarce' ? 1 : 3;
    this.stamina = 100;
    this.hp = 100;
    this.combo = 0;
    this.lastAttack = -10;
    this.regenAt = 0;
    this.healUntil = 0;
    this.clearAt = 0;
    this.lock = null;
    this.projectiles = [];
    this.player = {
      id: 'player',
      type: this.chessClass,
      weapon: this.weapon,
      isAvatar: true,
      bossRelic: this.bossRelic,
      x: 0,
      z: 6,
      y: 0,
      face: Math.PI,
      state: 'idle',
      attackAt: -10,
      attackEnd: 0,
      attackHit: false,
      dodgeEnd: 0,
      invuln: 0,
      stagger: 0,
      block: false,
      dx: 0,
      dz: -1,
      speed: 0,
    };
    this.events = [];
    this.spawn();
  }

  emit(type, data = {}) {
    recordChronicle(this, type, data);
    if (type === 'swing') this.tactics[data.heavy ? 'heavy' : 'light']++;
    if (type === 'block') this.tactics.blocks++;
    if (type === 'stagger' && this.partners) {
      const e = this.enemies.find((e) => e.id === data.id);
      if (e) {
        e.openedBy = this.player.id;
        e.teamWindowEnd = this.time + 2.2;
        e.teamSpent = false;
      }
    }
    const objective = this.objective;
    if (
      objective &&
      !objective.paid &&
      type === objective.event &&
      objective.progress < objective.goal &&
      !this.training
    ) {
      objective.progress++;
      if (objective.progress === objective.goal)
        this.events.push({ type: 'objectiveComplete', reward: objective.reward });
    }
    this.events.push({ type, ...data });
  }

  rewardObjective() {
    const o = this.objective;
    if (o && !o.paid && o.progress >= o.goal && !this.training) {
      o.paid = true;
      this.souls += o.reward;
      this.emit('objectiveReward', { reward: o.reward });
    }
  }

  spawn() {
    const lineup = (formations[this.wave] || formations[4]).map((a) => [...a]);
    if (this.difficulty === 'pilgrim' && this.wave === 0) lineup[2][0] = 'pawn';
    if (this.endless && this.wave < 4) {
      const positions = [
        [-7, -6],
        [7, -4],
        [-6, 1],
        [6, -8],
      ];
      for (let i = 0; i < Math.min(4, Math.floor((this.endless.encounter - 1) / 10)); i++)
        lineup.push([i % 2 ? 'bishop' : 'knight', ...positions[i]]);
    }
    if (this.runModifier === 'patrol' && this.wave < 4) lineup.push(['knight', 7, -6]);
    if (this.chapter > 0 && this.wave > 0)
      lineup.push([this.chapter > 1 ? 'knight' : 'pawn', -7, 1]);
    if (this.chapter > 2 && this.wave > 2) lineup.push(['bishop', 7, -7]);
    if (this.chapter === 3 && this.wave === 4) lineup.push(['king', 0, -9]);
    const power = CHAPTERS[this.chapter].difficulty;
    this.enemies = lineup.map(([type, x, z], i) => ({
      id: 'e' + this.serial++,
      type,
      x,
      z,
      y: 0,
      face: 0,
      hp: Math.round(stats[type].hp * power),
      max: Math.round(stats[type].hp * power),
      state: 'approach',
      until: 0,
      cooldown: this.time + 0.8 + i * 0.3,
      role: i % 3 === 0 ? 'sentinel' : 'flanker',
      flankSide: i % 2 ? -1 : 1,
      guardCapable: type === 'rook' || (type === 'pawn' && (i % 3 === 0 || this.wave === 2)),
      maxPoise: postureByType[type],
      elite:
        (this.wave > 0 && i === 0) || (this.runModifier === 'patrol' && i === lineup.length - 1),
      hitUntil: 0,
      count: 0,
      target: null,
      activeHit: false,
      dead: false,
    }));
    if (this.chapter === 0 && this.wave === 4)
      this.enemies = [createCastellan('e' + this.serial++, this.time, this.partners?.length || 1)];
    if ((this.chapter === 1 && this.wave === 4) || (this.expedition && this.wave === 4))
      this.enemies = [createConfessor('e' + this.serial++, this.time, this.partners?.length || 1)];
    if (
      (this.chapter === 3 && this.wave === 4 && !this.expedition) ||
      (this.expedition && this.wave === 5)
    ) {
      this.enemies = [
        createFallenKing('e' + this.serial++, this.time, this.partners?.length || 1),
        royalGuard('e' + this.serial++, 'pawn', -4, -3, this.time),
        royalGuard('e' + this.serial++, 'bishop', 4, -6, this.time),
      ];
    }
    if (this.expedition && this.wave === 3)
      this.enemies = [createCastellan('e' + this.serial++, this.time, this.partners?.length || 1)];
    const rule = difficultyById(this.difficulty);
    for (const e of this.enemies) {
      const multiplier =
        (e.boss && this.difficulty === 'standard' ? 1 : rule.hp) * (e.elite ? 1.2 : 1);
      e.hp = e.max = Math.round(e.max * multiplier);
    }
    placeRival(this);
    applyEncounterRoute(this);
    applyEventEncounter(this);
    if (this.endless)
      for (const e of this.enemies) e.hp = e.max = Math.round(e.max * endlessHealth(this));
    this.arenaObjective = createArenaObjective(this);
    this.hazards = [];
    const objectives = [
      ['parry', 'Land a perfect parry', 1],
      ['stagger', 'Break enemy posture', 1],
      ['flank', 'Hit a guarded enemy from behind', 1],
      ['stagger', 'Break enemy posture twice', 2],
      ['parry', 'Parry the final court', 2],
    ];
    const [event, title, goal] = objectives[this.wave] || objectives[4];
    this.objective = { event, title, goal, progress: 0, reward: 120, paid: false };
    this.hazardAt = this.time + 7;
    this.shiftAt = this.time + 10;
    this.arenaShift = null;
    this.secretPortal = null;
    this.projectiles = [];
    this.clearAt = 0;
    this.emit('wave', {
      wave: this.wave,
      title: this.enemies[0]?.boss ? this.enemies[0].name : titles[this.wave],
    });
    captureCheckpoint(this);
  }

  setWeapon(id) {
    if (this.mode === 'playing' && this.time > 0) return false;
    this.weapon = weaponById(id).id;
    this.player.weapon = this.weapon;
    return true;
  }

  makeReinforcement(x) {
    const hp = Math.round(
      stats.knight.hp * CHAPTERS[this.chapter].difficulty * difficultyById(this.difficulty).hp,
    );
    return {
      id: 'e' + this.serial++,
      type: 'knight',
      x,
      z: -7,
      y: 0,
      face: 0,
      hp,
      max: hp,
      state: 'approach',
      until: 0,
      cooldown: this.time + 1.5,
      role: 'flanker',
      flankSide: x < 0 ? -1 : 1,
      maxPoise: postureByType.knight,
      count: 0,
      activeHit: false,
      dead: false,
    };
  }

  startEndless() {
    beginEndless(this);
  }

  startBossRush() {
    this.mode = 'playing';
    this.bossTrial = true;
    this.bossRush = { index: 0, completed: 0, damageTaken: 0, score: 0, finished: false };
    this.chapter = 0;
    this.wave = 4;
    this.flasks = 2;
    this.hp = 100;
    this.stamina = 100;
    this.upgrades = {};
    this.spawn();
  }

  advanceBossRush() {
    const r = this.bossRush;
    r.completed++;
    if (r.index < 2) {
      r.index++;
      this.chapter = [0, 1, 3][r.index];
      this.wave = 4;
      this.stamina = 100;
      this.spawn();
      this.player.state = 'idle';
      this.player.invuln = this.time + 1;
      this.emit('rushStage', { stage: r.index + 1 });
    } else {
      r.finished = true;
      r.score = Math.max(
        0,
        15000 - Math.floor(this.time * 10) - Math.floor(r.damageTaken * 8) + this.flasks * 250,
      );
      this.mode = 'won';
      this.emit('end', { won: true, trial: true, rush: true, score: r.score });
    }
  }

  beginIntermission() {
    beginIntermission(this);
  }

  finishIntermission() {
    this.streamlinedIntermission = false;
    this.mode = 'playing';
    captureCheckpoint(this);
    this.emit('intermissionComplete');
  }

  offerRoutes() {
    if (!routeAvailable(this)) {
      this.offerUpgrades();
      return false;
    }
    this.routeChoices = ROUTES.map((r) => r.id);
    this.mode = 'route';
    this.player.block = false;
    this.player.state = 'idle';
    return true;
  }

  chooseRoute(id) {
    if (this.mode !== 'route' || !this.routeChoices.includes(id)) return false;
    this.route = { id, paid: false };
    this.emit('routeChosen', { route: id });
    this.routeChoices = [];
    applyEncounterRoute(this);
    if (id === 'sanctuary') {
      this.hp = Math.min(100, this.hp + 25);
      this.flasks = Math.min(12, this.flasks + 1);
    }
    if (this.streamlinedIntermission) this.finishIntermission();
    else this.offerUpgrades();
    return true;
  }

  rewardRoute() {
    return rewardRoute(this);
  }

  offerUpgrades() {
    this.upgradePicks = this.upgradePicks || 1 + (this.pendingBlessings || 0);
    this.pendingBlessings = 0;
    this.upgradeChoices = upgradeOffers(this);
    if (!this.upgradeChoices.length) {
      this.upgradePicks = 0;
      this.finishIntermission();
      return;
    }
    this.mode = 'upgrade';
    this.player.block = false;
    this.player.state = 'idle';
    this.emit('upgradeOffered');
  }

  chooseUpgrade(id) {
    if (this.mode !== 'upgrade' || !this.upgradeChoices.includes(id)) return false;
    this.upgrades[id] = (this.upgrades[id] || 0) + 1;
    if (id === 'flask') this.flasks++;
    this.upgradeChoices = [];
    this.upgradePicks = Math.max(0, (this.upgradePicks || 1) - 1);
    if (this.upgradePicks) {
      this.offerUpgrades();
      return true;
    }
    if (this.streamlinedIntermission) {
      this.finishIntermission();
      this.emit('upgradeChosen', { upgrade: id });
      return true;
    }
    this.mode = 'playing';
    offerPromotion(this);
    if (this.mode === 'playing') offerEvent(this);
    if (this.mode === 'playing') captureCheckpoint(this);
    this.emit('upgradeChosen', { upgrade: id });
    return true;
  }

  choosePromotion(id) {
    if (!choosePromotion(this, id)) return false;
    if (this.streamlinedIntermission) {
      this.finishIntermission();
      return true;
    }
    offerEvent(this);
    if (this.mode === 'playing') captureCheckpoint(this);
    return true;
  }

  chooseEvent(id) {
    if (!chooseEvent(this, id)) return false;
    this.streamlinedIntermission = false;
    captureCheckpoint(this);
    return true;
  }

  ultimate() {
    const p = this.player;
    if (
      this.mode !== 'playing' ||
      this.hp <= 0 ||
      this.time < this.abilityReadyAt ||
      this.time < p.stagger ||
      this.time < p.attackEnd ||
      this.time < this.healUntil ||
      ['dodge', 'ability'].includes(p.state) ||
      !this.spend((this.bossRelic === 'mirror' ? 40 : 35) + activeRole(this).cost)
    )
      return false;
    this.abilityReadyAt =
      this.time + pieceById(this.chessClass).cooldown * (this.bossRelic === 'mirror' ? 0.8 : 1);
    beginAbility(this, p, this.chessClass);
    return true;
  }

  nearest(range = Infinity) {
    let list = this.enemies.filter(
      (e) => !e.dead && !e.illusions?.length && dist(e, this.player) < range,
    );
    list.sort((a, b) => dist(a, this.player) - dist(b, this.player));
    return list[0] || null;
  }

  toggleLock() {
    if (this.mode !== 'playing') return;
    this.lock = this.lock ? null : this.nearest(22)?.id;
    this.emit('lock');
  }

  spend(n) {
    if (this.stamina < n) return false;
    this.stamina -= n;
    this.regenAt = this.time + 0.55;
    return true;
  }

  heavyAttack() {
    return this.attack('heavy');
  }

  attack(kind = 'light') {
    let p = this.player;
    if (
      this.mode !== 'playing' ||
      ['dodge', 'ability'].includes(p.state) ||
      this.time < p.stagger ||
      this.time < p.attackEnd ||
      this.time < this.healUntil
    )
      return false;
    const weapon = attackByKind(this.weapon, kind);
    if (!this.spend(weapon.cost)) {
      this.emit('tired');
      return false;
    }
    this.combo = this.time - this.lastAttack < 1.05 ? (this.combo + 1) % 3 : 0;
    this.lastAttack = this.time;
    p.state = 'attack';
    p.attackKind = kind === 'heavy' ? 'heavy' : 'light';
    p.attackAt = this.time;
    p.attackEnd = this.time + weapon.duration;
    p.attackDuration = weapon.duration;
    p.weapon = weapon.id;
    p.riposte = this.time < this.riposteUntil;
    this.riposteUntil = 0;
    p.attackHit = false;
    p.block = false;
    let e = this.enemies.find((e) => e.id === this.lock && !e.dead) || this.nearest(3.7);
    if (e) p.face = Math.atan2(e.x - p.x, e.z - p.z);
    this.emit('swing', { combo: this.combo, heavy: p.attackKind === 'heavy' });
    return true;
  }

  dodge(mx = 0, mz = 0) {
    let p = this.player;
    if (
      this.mode !== 'playing' ||
      ['dodge', 'ability'].includes(p.state) ||
      this.time < p.stagger ||
      this.time < this.healUntil ||
      !this.spend(28 - 7 * (this.upgrades.fleet || 0) + (this.bossRelic === 'siegebreaker' ? 4 : 0))
    )
      return false;
    let [dx, dz] = norm(mx, mz);
    if (!dx && !dz) [dx, dz] = [Math.sin(p.face), Math.cos(p.face)];
    p.dx = dx;
    p.dz = dz;
    p.state = 'dodge';
    p.dodgeEnd = this.time + 0.43;
    p.invuln = this.time + 0.5;
    p.block = false;
    p.attackHit = true;
    p.attackEnd = 0;
    this.emit('dodge');
    return true;
  }

  heal() {
    let p = this.player;
    if (
      this.mode !== 'playing' ||
      this.flasks <= 0 ||
      this.hp >= 100 ||
      this.time < p.stagger ||
      ['dodge', 'ability'].includes(p.state) ||
      this.time < this.healUntil
    )
      return false;
    this.flasks--;
    this.hp = Math.min(100, this.hp + 48 * curseById(this.curse).heal);
    this.healUntil = this.time + 0.85;
    p.state = 'heal';
    p.attackEnd = 0;
    p.attackHit = true;
    this.emit('heal');
    return true;
  }

  hurtPlayer(damage, source) {
    let p = this.player;
    if (this.hp <= 0 || this.mode !== 'playing' || this.time < p.invuln) return false;
    let dx = source.x - p.x,
      dz = source.z - p.z,
      [nx, nz] = norm(dx, dz);
    let facing = nx * Math.sin(p.face) + nz * Math.cos(p.face);
    if (
      !source.unblockable &&
      p.block &&
      facing > -0.2 &&
      this.time - this.guardPressedAt <= 0.18 &&
      this.stamina >= 8
    ) {
      this.spend(8);
      this.stamina = Math.min(100, this.stamina + 20);
      this.riposteUntil = this.time + 1.8;
      p.invuln = this.time + 0.25;
      this.guardPressedAt = -10;
      this.hp = Math.min(100, this.hp + 10 * (this.upgrades.mercy || 0));
      const enemy =
        source.boss || source.type ? source : this.enemies.find((e) => e.id === source.source);
      if (enemy?.isAvatar) {
        enemy.stagger = this.time + 0.7;
        enemy.attackEnd = 0;
        enemy.attackHit = true;
        enemy.state = 'hurt';
      }
      if (enemy && enemy !== p && !enemy.isAvatar) {
        enemy.poise = (enemy.poise || 0) + 55;
        if (!enemy.boss || enemy.poise >= enemy.maxPoise) {
          enemy.state = 'stagger';
          enemy.until = this.time + 1.4;
          enemy.coreOpen = !!enemy.boss;
          enemy.poise = 0;
          enemy.stagger = this.time + 1.4;
          if (this.partners) {
            enemy.openedBy = p.id;
            enemy.teamWindowEnd = this.time + 2.2;
            enemy.teamSpent = false;
          }
        }
      }
      this.emit('parry', {
        x: p.x + nx * 0.65,
        z: p.z + nz * 0.65,
        steel: true,
        nx,
        nz,
        attacker: enemy?.id,
      });
      return false;
    }
    if (
      !source.unblockable &&
      p.block &&
      facing > -0.2 &&
      this.stamina >=
        (source.boss
          ? 38
          : source.attackKind === 'heavy'
            ? 34
            : this.weapon === 'twinblades'
              ? 30
              : this.bossRelic === 'siegebreaker'
                ? 18
                : 22)
    ) {
      this.spend(
        source.boss
          ? 38
          : source.attackKind === 'heavy'
            ? 34
            : this.weapon === 'twinblades'
              ? 30
              : this.bossRelic === 'siegebreaker'
                ? 18
                : 22,
      );
      p.invuln = this.time + 0.2;
      this.emit('block', { x: p.x + nx * 0.65, z: p.z + nz * 0.65, steel: true, nx, nz });
      return false;
    }
    const hpBefore = this.hp;
    this.hp = Math.max(
      0,
      this.hp -
        damage *
          (1 - 0.1 * (this.upgrades.resolve || 0)) *
          (this.time < (p.wardUntil || 0) ? 0.5 : 1) *
          curseById(this.curse).incoming *
          allyProtection(this),
    );
    if (this.training) this.hp = Math.max(1, this.hp);
    const actualDamage = hpBefore - this.hp;
    if (this.bossRush) this.bossRush.damageTaken += actualDamage;
    const record = damageRecord(this, source, actualDamage);
    this.damageHistory = [...(this.damageHistory || []), record].slice(-5);
    p.hitAt = this.time;
    p.hitUntil = this.time + 0.28;
    p.hitNX = -nx;
    p.hitNZ = -nz;
    p.hitStrength = source.attackKind === 'heavy' ? 0.35 : 0.2;
    if (!this.hp) {
      p.dead = true;
      p.downedAt = this.time;
      this.deathRecap = { ...record, recent: this.damageHistory.slice(-3) };
    }
    if (p.block && facing > -0.2) this.emit('guardBreak', { id: 'player' });
    p.invuln = this.time + 0.65;
    p.stagger = this.time + 0.28;
    p.state = 'hurt';
    p.ability = null;
    p.y = 0;
    p.attackHit = true;
    p.attackEnd = 0;
    if (source.state === 'attack' && !source.source)
      this.emit('steelImpact', { x: p.x + nx * 0.55, z: p.z + nz * 0.55, nx, nz, strength: 0.55 });
    this.emit('hurt', { id: 'player', damage });
    if (!this.hp) {
      this.mode = 'dead';
      this.emit('end', { won: false });
    }
    return true;
  }

  hitEnemy(e, damage, poise = damage, burn = false) {
    if (e.dead) return;
    if (
      !burn &&
      this.partners &&
      this.player.state === 'attack' &&
      this.player.attackKind === 'heavy' &&
      e.state === 'stagger' &&
      e.openedBy &&
      e.openedBy !== this.player.id &&
      this.time < e.teamWindowEnd &&
      !e.teamSpent
    ) {
      e.teamSpent = true;
      damage += 40;
      this.emit('teamFinisher', { id: e.id, x: e.x, z: e.z });
    }
    if (activeRole(this).id === 'controller' && this.player.state === 'ability' && !e.boss)
      e.slowUntil = this.time + 2;
    updateChampionWards(this);
    const frontal =
      Math.sin(e.face) * (this.player.x - e.x) + Math.cos(e.face) * (this.player.z - e.z) > 0;
    const guarded =
      !burn &&
      e.guarding &&
      frontal &&
      !this.player.riposte &&
      this.player.attackKind !== 'heavy' &&
      this.combo !== 2 &&
      this.weapon !== 'warhammer';
    const applied =
      (e.boss === 'fallenking'
        ? kingDamage(this, e, damage, poise)
        : e.boss === 'confessor'
          ? confessorDamage(this, e, damage, poise)
          : e.boss
            ? bossDamage(this, e, damage, poise)
            : damage) *
      (this.time < (e.wardUntil || 0) || e.championWarded ? 0.5 : 1) *
      (guarded ? 0.25 : 1);
    if (guarded) this.emit('enemyBlock', { id: e.id, x: e.x, z: e.z });
    if (!burn && e.guarding && !frontal && !e.isAvatar) {
      this.emit('flank', { id: e.id });
      if (e.champion === 'rook') {
        e.exposedUntil = this.time + 2;
        e.guarding = false;
        updateChampionWards(this);
      }
    }
    if (!burn && this.upgrades.ember) {
      e.burnTicks = 3;
      e.burnNext = this.time + 1;
      e.burnDamage = 4 * this.upgrades.ember;
    }
    if (!burn && this.player.state === 'attack') {
      const dx = this.player.x - e.x,
        dz = this.player.z - e.z,
        length = Math.hypot(dx, dz) || 1;
      this.emit('steelImpact', {
        x: e.x + (dx / length) * 0.5,
        z: e.z + (dz / length) * 0.5,
        nx: dx / length,
        nz: dz / length,
        strength: e.boss ? 0.9 : 0.4,
        y: ['queen', 'king'].includes(e.type) ? 1.65 : 1.2,
      });
    }
    if (rivalRetreat(this, e, applied)) {
      if (this.lock === e.id) this.lock = null;
      return;
    }
    e.hp -= applied;
    const awayX = e.x - this.player.x,
      awayZ = e.z - this.player.z,
      awayLength = Math.hypot(awayX, awayZ) || 1;
    e.hitAt = this.time;
    e.hitNX = awayX / awayLength;
    e.hitNZ = awayZ / awayLength;
    e.hitStrength = this.player.attackKind === 'heavy' ? 0.35 : 0.18;
    if (!burn && !e.boss && !e.isAvatar) {
      const push = guarded ? 0.06 : this.player.attackKind === 'heavy' ? 0.32 : 0.1;
      e.x += e.hitNX * push;
      e.z += e.hitNZ * push;
      this.clampActor(e);
    }
    e.hitUntil = this.time + 0.24;
    this.emit('hurt', {
      id: e.id,
      x: e.x,
      z: e.z,
      damage: applied,
      armored: guarded || (!!e.boss && !e.coreOpen),
    });
    if (e.hp <= 0) {
      e.dead = true;
      e.state = 'dead';
      e.ability = null;
      e.y = 0;
      e.until = this.time + 0.8;
      const bounty = this.training
        ? 0
        : e.boss
          ? e.boss === 'fallenking'
            ? FALLEN_KING.souls
            : e.boss === 'confessor'
              ? CONFESSOR.souls
              : CASTELLAN.souls
          : e.secret
            ? 350
            : e.eventDuel
              ? 180
              : e.rival && e.returning
                ? 400
                : stats[e.type].souls;
      this.souls += bounty;
      if (e.secret) {
        this.flasks = Math.min(12, this.flasks + 1);
        this.emit('secretCleared');
      }
      this.emit('kill', {
        id: e.id,
        x: e.x,
        z: e.z,
        souls: bounty,
        boss: e.boss || null,
        elite: !!e.elite,
      });
      if (e.champion) this.emit('championDefeated', { title: e.name || e.type });
      if (e.rival && e.returning) {
        for (const g of this.partners || [this])
          g.rivalMemory = { ...g.rivalMemory, defeated: true };
        this.emit('rivalDefeated', { id: e.id });
      }
      if (e.boss) this.emit('bossDefeated', { id: e.id, boss: e.boss, x: e.x, z: e.z });
      if (this.lock === e.id) this.lock = null;
    } else if (!e.boss) {
      const threshold = postureByType[e.type] * (e.champion ? 1.2 : 1);
      e.poise = (e.poise || 0) + poise;
      e.maxPoise = threshold;
      if (e.poise >= threshold && this.time >= (e.breakImmuneUntil || 0)) {
        e.poise = 0;
        e.state = 'stagger';
        e.ability = null;
        e.y = 0;
        e.until = this.time + 1.05;
        e.breakImmuneUntil = this.time + 3.5;
        this.emit('stagger', { id: e.id, x: e.x, z: e.z });
      } else if (
        !guarded &&
        e.type !== 'queen' &&
        e.type !== 'rook' &&
        e.state === 'approach' &&
        this.time >= (e.flinchImmuneUntil || 0)
      ) {
        e.flinchImmuneUntil = this.time + 1.1;
        e.cooldown = this.time + 0.5;
        e.state = 'stagger';
        e.until = this.time + 0.25;
      }
    }
  }

  hurtTarget(damage, source, target) {
    const g = this.partners?.find((g) => g.player === target) || this;
    const multiplier =
      (source.boss && this.difficulty !== 'standard') || source.state === 'ability'
        ? difficultyById(this.difficulty).damage
        : 1;
    if (hurtObjective(this, damage * multiplier, target)) return true;
    return g.hurtPlayer(damage * multiplier * endlessDamage(this), source);
  }

  clampActor(a) {
    a.x = clamp(a.x, -ARENA, ARENA);
    a.z = clamp(a.z, -ARENA, ARENA);
  }

  update(dt, input = {}) {
    if (this.mode !== 'playing') return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const t = this.time,
      p = this.player;
    let [mx, mz] = norm(input.x || 0, input.z || 0);
    if (t > this.regenAt)
      this.stamina = Math.min(
        100,
        this.stamina +
          dt *
            curseById(this.curse).regen *
            activeRole(this).regen *
            (input.block ? difficultyById(this.difficulty).guardRegen : 25) *
            (1 + 0.2 * (this.upgrades.breath || 0)),
      );
    const wantsGuard = !!input.block;
    if (
      wantsGuard &&
      !this.guardHeld &&
      t - this.guardReleasedAt >= 0.25 &&
      p.state !== 'attack' &&
      p.state !== 'ability' &&
      p.state !== 'dodge' &&
      t >= p.stagger &&
      t >= this.healUntil
    )
      this.guardPressedAt = t;
    if (!wantsGuard && this.guardHeld) this.guardReleasedAt = t;
    this.guardHeld = wantsGuard;
    p.block =
      !!input.block &&
      p.state !== 'dodge' &&
      p.state !== 'attack' &&
      p.state !== 'ability' &&
      t >= this.healUntil &&
      t >= p.stagger;
    let locked = this.enemies.find((e) => e.id === this.lock && !e.dead);
    if (locked)
      p.face = angleLerp(p.face, Math.atan2(locked.x - p.x, locked.z - p.z), Math.min(1, dt * 15));
    else this.lock = null;
    if (p.state === 'ability') {
      tickAbility(this, p);
    } else if (p.state === 'dodge') {
      p.x += p.dx * dt * 13;
      p.z += p.dz * dt * 13;
      p.y = Math.sin(clamp(1 - (p.dodgeEnd - t) / 0.43, 0, 1) * Math.PI) * 0.18;
      if (t >= p.dodgeEnd) {
        p.state = 'idle';
        p.y = 0;
      }
    } else if (t >= p.stagger && t >= this.healUntil) {
      if (p.state === 'attack') {
        let phase = t - p.attackAt;
        if (!p.attackHit && phase >= attackByKind(this.weapon, p.attackKind).hitAt) {
          p.attackHit = true;
          if (p.attackKind === 'heavy')
            this.emit('heavyImpact', { x: p.x, z: p.z, weapon: this.weapon });
          for (let e of this.enemies) {
            if (e.dead) continue;
            let d = dist(p, e),
              [nx, nz] = norm(e.x - p.x, e.z - p.z);
            const w = attackByKind(this.weapon, p.attackKind);
            if (d < w.range && nx * Math.sin(p.face) + nz * Math.cos(p.face) > w.arc) {
              const base =
                p.attackKind === 'heavy' ? w.damage : this.combo === 2 ? w.finisher : w.damage;
              const damage =
                base *
                (1 + 0.15 * (this.upgrades.force || 0)) *
                (p.riposte ? (w.id === 'rapier' ? 2.3 : 1.8) : 1) *
                curseById(this.curse).damage *
                (p.attackKind === 'heavy' ? curseById(this.curse).heavy : 1) *
                activeRole(this).damage;
              this.hitEnemy(
                e,
                Math.round(damage),
                base *
                  w.poise *
                  (1 + 0.3 * (this.upgrades.shatter || 0)) *
                  (p.attackKind === 'heavy' && this.bossRelic === 'siegebreaker' ? 1.25 : 1) *
                  (curseById(this.curse).poise || 1) *
                  activeRole(this).poise,
              );
            }
          }
          const retreat = attackByKind(this.weapon, p.attackKind).retreat || 0;
          p.x += Math.sin(p.face) * (retreat ? -retreat : 0.28);
          p.z += Math.cos(p.face) * (retreat ? -retreat : 0.28);
        }
        if (t >= p.attackEnd) p.state = 'idle';
      } else {
        p.state = p.block ? 'block' : mx || mz ? 'walk' : 'idle';
        let sprint = input.sprint && !p.block && this.stamina > 8 && (mx || mz);
        let speed = p.block ? 1.8 : sprint ? 5.6 : 3.8;
        if (sprint) {
          this.stamina = Math.max(0, this.stamina - dt * 12);
          this.regenAt = t + 0.3;
        }
        p.speed = mx || mz ? speed : 0;
        p.x += mx * dt * speed;
        p.z += mz * dt * speed;
        if ((mx || mz) && !locked)
          p.face = angleLerp(p.face, Math.atan2(mx, mz), Math.min(1, dt * 18));
      }
    } else if (t < this.healUntil) p.state = 'heal';
    this.clampActor(p);
    if (!input.skipAI)
      for (let e of this.enemies) {
        if (e.dead) continue;
        if (e.burnTicks > 0 && e.burnNext <= t) {
          e.burnTicks--;
          e.burnNext = t + 1;
          this.hitEnemy(e, e.burnDamage, 0, true);
          if (e.dead) continue;
        }
        if (e.boss === 'fallenking') {
          updateFallenKing(this, e, dt);
          continue;
        }
        if (e.boss === 'confessor') {
          updateConfessor(this, e, dt);
          continue;
        }
        if (e.boss) {
          updateCastellan(this, e, dt);
          continue;
        }
        if (e.state === 'ability') {
          tickAbility(this, e);
          continue;
        }
        if (e.state !== 'stagger') e.poise = Math.max(0, (e.poise || 0) - dt * 8);
        updateEnemy(this, e, dt, stats);
      }
    if (!input.skipAI) updateHazards(this, dt);
    if (this.training) {
      if (this.training.unlimited) {
        this.stamina = 100;
        this.flasks = this.runModifier === 'scarce' ? 1 : 3;
      }
      for (const e of this.enemies)
        if (e.dead && t >= e.until) {
          e.hp = e.max;
          e.dead = false;
          e.state = 'approach';
          e.cooldown = t + 1;
          e.poise = 0;
          e.count = 0;
          e.x = 0;
          e.z = 0;
        }
    }
    // Continuous collision keeps pieces solid without snapping them to chess tiles.
    const actors = [p, ...this.enemies.filter((e) => !e.dead && e.y < 1)];
    for (let i = 0; i < actors.length; i++)
      for (let j = i + 1; j < actors.length; j++) {
        let a = actors[i],
          b = actors[j],
          d = dist(a, b);
        const radius = (a.radius || 0.6) + (b.radius || 0.6);
        if (d > 0 && d < radius) {
          let k = ((radius - d) * 0.5) / d,
            dx = (b.x - a.x) * k,
            dz = (b.z - a.z) * k;
          a.x -= dx;
          a.z -= dz;
          b.x += dx;
          b.z += dz;
          this.clampActor(a);
          this.clampActor(b);
        }
      }
    if (!input.skipProjectiles)
      for (let b of this.projectiles) {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        for (const target of combatTargets(this))
          if (dist(b, target) < 0.7 && b.until > t) {
            this.hurtTarget(b.damage, b, target);
            b.until = 0;
          }
      }
    this.projectiles = this.projectiles.filter(
      (b) => b.until > t && Math.abs(b.x) < 14 && Math.abs(b.z) < 14,
    );
    if (!input.skipAI) {
      updateArenaObjective(this, dt, input);
      updateArenaShifts(this);
      updateSecretCourt(this, input, dt);
    }
    if (!input.skipProgression && this.arenaObjective?.failed) {
      this.mode = 'dead';
      this.deathRecap = objectiveFailureRecap();
      this.emit('end', { won: false, reason: 'kingFallen' });
      return;
    }
    updateTutorial(this, input);
    if (!this.training && !input.skipProgression && encounterComplete(this) && !this.clearAt) {
      this.clearAt = t + 2.5;
      this.rewardObjective();
      this.rewardRoute();
      rewardArenaObjective(this);
      this.emit('cleared');
    }
    if (!this.training && !input.skipProgression && this.clearAt && t > this.clearAt) {
      if (this.bossRush) {
        this.advanceBossRush();
        return;
      }
      if (this.endless) {
        advanceEndless(this);
        return;
      }
      if (this.wave === 4) {
        this.mode = 'won';
        this.emit('end', { won: true, trial: this.bossTrial });
      } else {
        this.wave++;
        this.route = null;
        this.hp = Math.min(100, this.hp + difficultyById(this.difficulty).heal);
        this.stamina = 100;
        this.spawn();
        this.beginIntermission();
      }
    }
  }
}
