import { curseById, roleById } from './run-options.mjs';
import { recordChronicle } from './run-chronicle.mjs';
import { EVENT_IDS } from './encounter-events.mjs';
import { PROMOTIONS } from './promotion.mjs';
import {
  createArenaObjective,
  encounterComplete,
  rewardArenaObjective,
  objectiveFailureRecap,
} from './arena-objectives.mjs';
import { ROUTES } from './routes.mjs';
import { validDifficulty, difficultyById } from './combat-rules.mjs';
import { Game, clamp, dist } from './combat.mjs';

export class Battle {
  constructor(mode = 'coop', players = [], options = {}) {
    this.mode = mode;
    this.difficulty = mode === 'coop' ? validDifficulty(options.difficulty) : 'standard';
    this.routeChoices = [];
    this.routeVotes = [null, null];
    this.pings = [];
    this.pingAt = [0, 0];
    this.status = 'playing';
    this.bestOf = mode === 'versus' && options.bestOf === 3 ? 3 : 1;
    this.phase = options.readyCheck ? 'ready' : 'combat';
    this.clock = 0;
    this.countdownUntil = 0;
    this.round = 1;
    this.series = 1;
    this.scores = [0, 0];
    this.ready = [false, false];
    this.rematch = [false, false];
    this.departed = [false, false];
    this.roundWinner = null;
    this.reason = null;
    this.time = 0;
    this.wave = 0;
    this.clearAt = 0;
    this.events = [];
    this.eventId = 0;
    this.winner = null;
    this.names = players.map((p) => p.name);
    this.skins = players.map((p) => p.skin);
    this.acks = [0, 0];
    this.inputs = [{}, {}];
    this.games = [new Game(), new Game()];
    for (let i = 0; i < 2; i++) {
      let g = this.games[i];
      g.difficulty = this.difficulty;
      g.checkpointMode = 'fullrun';
      g.curse = mode === 'coop' ? curseById(players[i]?.curse).id : 'none';
      g.coopRole = mode === 'coop' ? roleById(players[i]?.coopRole).id : 'balanced';
      g.bossRelic = mode === 'coop' ? players[i]?.bossRelic || 'none' : 'none';
      g.chessClass = players[i]?.chessClass || 'pawn';
      g.reset();
      g.expedition = mode === 'coop';
      g.setWeapon(players[i]?.weapon);
      g.player.x = i ? -2 : 2;
      g.player.z = mode === 'versus' ? (i ? -5 : 5) : 6;
      g.player.face = i ? 0 : Math.PI;
      g.events = [];
    }
    this.startingLoadouts = this.games.map((g) => ({
      weapon: g.weapon,
      chessClass: g.chessClass,
      bossRelic: g.bossRelic,
      curse: g.curse,
      coopRole: g.coopRole,
    }));
    if (mode === 'coop') this.games[0].arenaObjective = createArenaObjective(this.games[0]);
    this.connect();
  }

  connect() {
    if (this.mode === 'coop') {
      this.games[1].enemies = this.games[0].enemies;
      this.games[1].objective = this.games[0].objective;
      this.games[1].arenaObjective = this.games[0].arenaObjective;
      this.games[1].arenaShift = this.games[0].arenaShift;
      this.games[1].secretPortal = this.games[0].secretPortal;
      this.games[0].partners = this.games;
      this.games[1].partners = this.games;
    } else {
      for (let i = 0; i < 2; i++) {
        let g = this.games[i],
          other = this.games[1 - i];
        g.enemies = [other.player];
        g.hitEnemy = (e, damage) => {
          other.hurtPlayer(damage, g.player);
          if (!other.hp) g.emit('kill', { id: e.id, x: e.x, z: e.z, souls: 0 });
        };
      }
    }
  }

  static restore(data) {
    let b = Object.create(Battle.prototype);
    Object.assign(
      b,
      {
        difficulty: 'standard',
        pings: [],
        pingAt: [0, 0],
        bestOf: 1,
        phase: data.status === 'ended' ? 'ended' : 'combat',
        clock: 0,
        countdownUntil: 0,
        round: 1,
        series: 1,
        scores: [0, 0],
        ready: [false, false],
        rematch: [false, false],
        departed: [false, false],
        roundWinner: null,
        reason: null,
      },
      data,
    );
    b.games = data.games.map((d) => {
      const g = new Game();
      Object.assign(g, d);
      g.events = [];
      return g;
    });
    b.connect();
    return b;
  }

  serialize() {
    return {
      mode: this.mode,
      startingLoadouts: this.startingLoadouts,
      difficulty: this.difficulty,
      pings: this.pings,
      pingAt: this.pingAt,
      bestOf: this.bestOf,
      phase: this.phase,
      clock: this.clock,
      countdownUntil: this.countdownUntil,
      round: this.round,
      series: this.series,
      scores: this.scores,
      ready: this.ready,
      rematch: this.rematch,
      departed: this.departed,
      roundWinner: this.roundWinner,
      reason: this.reason,
      routeChoices: this.routeChoices || [],
      routeVotes: this.routeVotes || [null, null],
      status: this.status,
      time: this.time,
      wave: this.wave,
      clearAt: this.clearAt,
      events: this.events,
      eventId: this.eventId,
      winner: this.winner,
      names: this.names,
      skins: this.skins,
      acks: this.acks,
      inputs: this.inputs,
      games: this.games.map((g) => {
        const { partners, hitEnemy, ...rest } = g;
        return { ...rest, events: [] };
      }),
    };
  }

  emit(ev, seat = null) {
    this.events.push({ ...ev, seat, n: ++this.eventId });
    this.events = this.events.slice(-60);
  }

  setInput(seat, input = {}) {
    this.inputs[seat] = {
      x: clamp(Number(input.x) || 0, -1, 1),
      z: clamp(Number(input.z) || 0, -1, 1),
      block: !!input.block,
      sprint: !!input.sprint,
      revive: !!input.revive,
      actions: Array.isArray(input.actions)
        ? input.actions
            .slice(-12)
            .filter(
              (a) =>
                Number.isSafeInteger(a.n) &&
                a.n > 0 &&
                a.n < 1e9 &&
                [
                  'attack',
                  'heavy',
                  'ultimate',
                  'dodge',
                  'heal',
                  'lock',
                  'ping',
                  ...ROUTES.map((r) => 'route:' + r.id),
                  ...PROMOTIONS.map((id) => 'promote:' + id),
                  ...EVENT_IDS.map((id) => 'event:' + id),
                  ...[
                    'ember',
                    'mercy',
                    'fleet',
                    'force',
                    'breath',
                    'flask',
                    'resolve',
                    'shatter',
                  ].map((id) => 'upgrade:' + id),
                ].includes(a.kind),
            )
        : [],
    };
  }

  resetRound() {
    const acks = this.acks;
    const replacement = new Battle(
      this.mode,
      this.names.map((name, i) => ({
        name,
        skin: this.skins[i],
        weapon: this.startingLoadouts?.[i]?.weapon || this.games[i].weapon,
        chessClass: this.startingLoadouts?.[i]?.chessClass || this.games[i].chessClass,
        bossRelic: this.games[i].bossRelic,
        curse: this.startingLoadouts?.[i]?.curse || this.games[i].curse,
        coopRole: this.startingLoadouts?.[i]?.coopRole || this.games[i].coopRole,
      })),
      { difficulty: this.difficulty },
    );
    this.games = replacement.games;
    this.routeChoices = [];
    this.routeVotes = [null, null];
    this.pings = [];
    this.pingAt = [0, 0];
    this.time = 0;
    this.wave = 0;
    this.clearAt = 0;
    this.inputs = [{}, {}];
    this.acks = acks;
    this.connect();
  }

  control(seat, command) {
    if (
      !command ||
      command.series !== this.series ||
      command.round !== this.round ||
      this.departed.some(Boolean)
    )
      return;
    if (command.kind === 'ready' && ['ready', 'roundEnd'].includes(this.phase)) {
      this.ready[seat] = true;
      if (this.ready.every(Boolean)) {
        if (this.phase === 'roundEnd') {
          this.round++;
          this.resetRound();
        }
        this.phase = 'countdown';
        this.countdownUntil = this.clock + 3;
        this.emit({ type: 'countdown', round: this.round });
      }
    }
    if (command.kind === 'rematch' && this.status === 'ended') {
      this.rematch[seat] = true;
      if (this.rematch.every(Boolean)) {
        this.series++;
        this.round = 1;
        this.scores = [0, 0];
        this.ready = [false, false];
        this.rematch = [false, false];
        this.winner = null;
        this.roundWinner = null;
        this.reason = null;
        this.phase = 'ready';
        this.status = 'playing';
        this.resetRound();
        this.emit({ type: 'rematch' });
      }
    }
  }

  forfeit(seat) {
    this.departed[seat] = true;
    this.rematch = [false, false];
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.phase = 'ended';
    this.reason = 'disconnect';
    this.winner = this.mode === 'versus' ? 1 - seat : null;
    this.emit({ type: 'matchEnd', winner: this.winner, reason: 'disconnect' });
  }

  finishRound(winner) {
    this.roundWinner = winner;
    if (winner !== null) this.scores[winner]++;
    if (this.scores.some((n) => n >= Math.ceil(this.bestOf / 2)) || this.bestOf === 1) {
      this.status = 'ended';
      this.phase = 'ended';
      this.winner = winner;
      this.emit({ type: 'matchEnd', winner });
    } else {
      this.phase = 'roundEnd';
      this.ready = [false, false];
      this.emit({ type: 'roundEnd', winner, round: this.round, scores: [...this.scores] });
    }
  }

  step(dt) {
    if (this.status !== 'playing') return;
    this.clock += dt;
    if (this.phase !== 'combat') {
      for (let i = 0; i < 2; i++)
        for (const a of this.inputs[i]?.actions || []) this.acks[i] = Math.max(this.acks[i], a.n);
      if (this.phase === 'countdown' && this.clock >= this.countdownUntil) {
        this.phase = 'combat';
        this.inputs = [{}, {}];
        this.emit({ type: 'roundStart', round: this.round });
      }
      return;
    }
    if (this.routeChoices?.length) {
      for (let i = 0; i < 2; i++)
        for (const a of this.inputs[i]?.actions || []) {
          if (a.n <= this.acks[i]) continue;
          this.acks[i] = a.n;
          const id = a.kind.startsWith('route:') ? a.kind.slice(6) : '';
          if (this.routeChoices.includes(id)) this.routeVotes[i] = id;
        }
      if (this.routeVotes[0] && this.routeVotes[0] === this.routeVotes[1]) {
        const id = this.routeVotes[0];
        this.games[0].chooseRoute(id);
        const ally = this.games[1];
        ally.route = { id, paid: false };
        ally.emit('routeChosen', { route: id });
        ally.routeChoices = [];
        if (id === 'sanctuary') {
          ally.hp = Math.min(100, ally.hp + 25);
          ally.flasks = Math.min(12, ally.flasks + 1);
        }
        if (ally.streamlinedIntermission) ally.finishIntermission();
        else ally.offerUpgrades();
        this.routeChoices = [];
        this.connect();
      }
      return;
    }
    if (
      this.games.some(
        (g) => g.upgradeChoices?.length || g.promotionChoices?.length || g.eventChoices?.length,
      )
    ) {
      for (let i = 0; i < 2; i++)
        for (const a of this.inputs[i]?.actions || []) {
          if (a.n <= this.acks[i]) continue;
          this.acks[i] = a.n;
          if (a.kind.startsWith('upgrade:')) this.games[i].chooseUpgrade(a.kind.slice(8));
          if (a.kind.startsWith('promote:')) this.games[i].choosePromotion(a.kind.slice(8));
          if (a.kind.startsWith('event:')) this.games[i].chooseEvent(a.kind.slice(6));
        }
      return;
    }
    this.time += dt;
    for (let i = 0; i < 2; i++) this.games[i].interacting = !!this.inputs[i]?.revive;
    this.connect();
    for (let i = 0; i < 2; i++) {
      let g = this.games[i],
        input = this.inputs[i] || {},
        p = g.player;
      g.time = this.time - dt;
      p.id = 'p' + i;
      p.hp = g.hp;
      p.max = 100;
      p.dead = g.hp <= 0;
      const alive = g.hp > 0;
      if (!alive && this.mode === 'coop' && i === 0) g.mode = 'playing';
      for (const a of input.actions || []) {
        if (a.n <= this.acks[i]) continue;
        this.acks[i] = a.n;
        let accepted = false;
        if (alive) {
          if (a.kind === 'ultimate') accepted = g.ultimate();
          if (a.kind === 'attack') accepted = g.attack();
          if (a.kind === 'heavy') accepted = g.heavyAttack();
          if (a.kind === 'dodge') accepted = g.dodge(input.x, input.z);
          if (a.kind === 'heal') accepted = g.heal();
          if (a.kind === 'ping' && this.mode === 'coop' && this.time >= this.pingAt[i]) {
            this.pingAt[i] = this.time + 2;
            this.pings = this.pings.filter((p) => p.seat !== i);
            this.pings.push({ seat: i, x: p.x, z: p.z, until: this.time + 5 });
            this.emit({ type: 'teamPing', x: p.x, z: p.z }, i);
            accepted = true;
          }
          if (a.kind === 'lock') {
            g.toggleLock();
            accepted = true;
          }
        }
        this.emit({ type: 'actionAck', actionId: a.n, action: a.kind, accepted: !!accepted }, i);
      }
      g.update(dt, {
        ...input,
        x: alive && !input.revive ? input.x : 0,
        z: alive && !input.revive ? input.z : 0,
        skipAI: this.mode === 'versus' || i === 1,
        skipProjectiles: i === 1,
        skipProgression: true,
      });
      g.player.hp = g.hp;
      g.player.dead = !g.hp;
      for (let ev of g.events) {
        if (ev.type === 'end') continue;
        if (
          this.mode === 'coop' &&
          [
            'bossDefeated',
            'championDefeated',
            'rivalRetreat',
            'rivalDefeated',
            'teamCombo',
          ].includes(ev.type)
        ) {
          const other = this.games[1 - i];
          recordChronicle(other, ev.type, ev);
        }
        this.emit(ev, i);
      }
      g.events = [];
      if (!alive) g.mode = 'dead';
    }
    this.pings = this.pings.filter((p) => this.time < p.until);
    if (this.mode === 'coop') this.updateRevives(dt);
    if (this.mode === 'versus') {
      if (this.games.some((g) => !g.hp)) {
        this.finishRound(this.games[0].hp ? 0 : this.games[1].hp ? 1 : null);
      }
    } else {
      if (this.games[0].arenaObjective?.failed) {
        this.status = 'ended';
        this.winner = null;
        this.reason = 'kingFallen';
        for (const g of this.games) g.deathRecap = objectiveFailureRecap();
        this.emit({ type: 'matchEnd', winner: null, reason: 'kingFallen' });
      } else if (this.games.every((g) => !g.hp)) {
        this.status = 'ended';
        this.winner = null;
        this.emit({ type: 'matchEnd', winner: null });
      } else if (encounterComplete(this.games[0])) {
        if (!this.clearAt) {
          this.clearAt = this.time + 2.5;
          this.games[0].rewardObjective();
          rewardArenaObjective(this.games[0]);
          this.games[0].rewardRoute();
          this.games[1].rewardRoute();
          for (const ev of this.games[0].events) this.emit(ev, 0);
          this.games[0].events = [];
          for (const g of this.games) recordChronicle(g, 'cleared');
          this.emit({ type: 'cleared' });
        }
        if (this.time >= this.clearAt) {
          if (this.wave >= 5) {
            this.status = 'ended';
            this.winner = 'team';
            this.emit({ type: 'matchEnd', winner: 'team' });
          } else {
            this.wave++;
            this.clearAt = 0;
            this.games[0].chapter = [0, 1, 2, 3, 1, 3][this.wave];
            this.games[1].chapter = this.games[0].chapter;
            this.games[0].route = null;
            this.games[1].route = null;
            this.games[0].wave = this.wave;
            this.games[0].spawn();
            this.connect();
            this.games[0].events = [];
            for (let g of this.games) {
              g.wave = this.wave;
              g.hp = g.hp > 0 ? Math.min(100, g.hp + difficultyById(this.difficulty).heal) : 40;
              g.stamina = 100;
              g.mode = 'playing';
              g.player.dead = false;
              g.player.downedUntil = 0;
              g.player.eliminated = false;
              g.player.reviveProgress = 0;
              g.player.state = 'idle';
              g.player.invuln = this.time + 1;
              g.beginIntermission();
            }
            this.routeChoices = [...this.games[0].routeChoices];
            this.routeVotes = [null, null];
            this.connect();
            this.emit({ type: 'wave', wave: this.wave });
          }
        }
      }
    }
    if (
      this.time >= (this.mode === 'versus' ? 300 : 900) &&
      this.status === 'playing' &&
      this.phase === 'combat'
    ) {
      if (this.mode === 'versus')
        this.finishRound(
          this.games[0].hp === this.games[1].hp
            ? null
            : this.games[0].hp > this.games[1].hp
              ? 0
              : 1,
        );
      else {
        this.status = 'ended';
        this.winner = null;
        this.emit({ type: 'matchEnd', winner: null });
      }
    }
  }

  updateRevives(dt) {
    for (let i = 0; i < 2; i++) {
      const fallen = this.games[i],
        helper = this.games[1 - i],
        p = fallen.player;
      if (fallen.hp > 0) {
        p.downedUntil = 0;
        p.reviveProgress = 0;
        p.eliminated = false;
        continue;
      }
      if (!p.downedUntil) {
        p.downedUntil = this.time + 30;
        this.emit({ type: 'downed', until: p.downedUntil }, i);
      }
      p.eliminated = this.time >= p.downedUntil;
      const can =
        !p.eliminated &&
        helper.hp > 0 &&
        this.inputs[1 - i]?.revive &&
        dist(p, helper.player) < 2.4 &&
        helper.time >= helper.player.stagger &&
        !['attack', 'dodge', 'ability', 'heal'].includes(helper.player.state);
      p.reviveProgress = can ? Math.min(1, (p.reviveProgress || 0) + dt / 3) : 0;
      if (p.reviveProgress >= 1) {
        fallen.hp = 40;
        fallen.mode = 'playing';
        p.hp = 40;
        p.dead = false;
        p.state = 'idle';
        p.invuln = this.time + 1.2;
        p.downedUntil = 0;
        p.reviveProgress = 0;
        p.eliminated = false;
        this.emit({ type: 'revived' }, i);
      }
    }
  }

  snapshot(seat) {
    if (this.status === 'ended') this.phase = 'ended';
    return {
      routeChoices: this.routeChoices || [],
      routeVotes: this.routeVotes || [null, null],
      status: this.status,
      mode: this.mode,
      startingLoadouts: this.startingLoadouts,
      difficulty: this.difficulty,
      hazards: this.games[0].hazards || [],
      objective: this.games[0].objective,
      arenaObjective: this.mode === 'coop' ? this.games[0].arenaObjective : null,
      realm: this.games[0].chapter,
      arenaShift: this.games[0].arenaShift,
      secretPortal: this.games[0].secretPortal,
      pings: this.pings,
      bestOf: this.bestOf,
      phase: this.phase,
      clock: this.clock,
      countdownUntil: this.countdownUntil,
      round: this.round,
      series: this.series,
      scores: this.scores,
      ready: this.ready,
      rematch: this.rematch,
      departed: this.departed,
      roundWinner: this.roundWinner,
      reason: this.reason,
      time: this.time,
      wave: this.wave,
      winner: this.winner,
      seat,
      names: this.names,
      skins: this.skins,
      acks: this.acks,
      players: this.games.map((g) => ({
        ...g.player,
        hp: g.hp,
        souls: g.souls,
        stamina: g.stamina,
        flasks: g.flasks,
        combo: g.combo,
        weapon: g.weapon,
        chessClass: g.chessClass,
        abilityReadyAt: g.abilityReadyAt,
        bossRelic: g.bossRelic,
        curse: g.curse,
        coopRole: g.coopRole,
        upgrades: g.upgrades,
        upgradeChoices: g.upgradeChoices,
        promotionChoices: g.promotionChoices || [],
        promotionResolved: !!g.promotionResolved,
        eventChoices: g.eventChoices || [],
        journal:
          this.status === 'ended' || ['route', 'upgrade', 'promotion', 'event'].includes(g.mode)
            ? g.journal || []
            : undefined,
        rivalMemory: g.rivalMemory,
        upgradePicks: g.upgradePicks,
        route: g.route,
        choosing: g.mode === 'upgrade' || g.mode === 'promotion' || g.mode === 'event',
        deathRecap: g.deathRecap,
      })),
      enemies: this.mode === 'coop' ? this.games[0].enemies : [],
      projectiles: this.games[0].projectiles,
      souls: this.games.reduce((n, g) => n + g.souls, 0),
      events: this.events,
    };
  }
}
