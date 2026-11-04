import { weaponById, attackByKind } from '../shared/arsenal.mjs';
// Cosmetic anticipation only: hits, movement, resources and invulnerability stay authoritative.

export class LocalActionPresentation {
  reset() {
    this.preview = null;
  }

  begin(kind, id, player, now, time, direction = {}) {
    if (
      !['attack', 'heavy', 'dodge'].includes(kind) ||
      player.dead ||
      player.hp <= 0 ||
      time < player.stagger ||
      ['ability', 'heal', 'hurt', 'dodge'].includes(player.state)
    )
      return;
    if (
      this.preview &&
      now < this.preview.started + this.preview.duration * 1000 &&
      !(kind === 'dodge' && this.preview.kind === 'attack')
    )
      return;
    if (['attack', 'heavy'].includes(kind) && player.state === 'attack') return;
    const weapon = attackByKind(player.weapon, kind === 'heavy' ? 'heavy' : 'light');
    const cost =
      kind !== 'dodge'
        ? weapon.cost
        : 28 - 7 * (player.upgrades?.fleet || 0) + (player.bossRelic === 'siegebreaker' ? 4 : 0);
    if (player.stamina < cost) return;
    this.preview = {
      kind: kind === 'heavy' ? 'attack' : kind,
      attackKind: kind === 'heavy' ? 'heavy' : 'light',
      id,
      dx: direction.x || direction.z ? direction.x || 0 : Math.sin(player.face || 0),
      dz: direction.x || direction.z ? direction.z || 0 : Math.cos(player.face || 0),
      started: now,
      duration: kind !== 'dodge' ? weapon.duration : 0.43,
      token: kind !== 'dodge' ? player.attackAt : player.dodgeEnd,
      confirmed: false,
      combo:
        player.attackDuration && time - player.attackAt < 1.05 ? ((player.combo || 0) + 1) % 3 : 0,
    };
  }

  confirm(events, seat, player) {
    const p = this.preview;
    if (!p) return;
    for (const event of events)
      if (event.type === 'actionAck' && event.seat === seat && event.actionId === p.id) {
        if (!event.accepted) {
          this.reset();
          return;
        }
        p.confirmed = true;
        p.token = p.kind === 'attack' ? player.attackAt : player.dodgeEnd;
      }
  }

  sample(player, now, input, time) {
    const result = { ...player };
    const p = this.preview;
    if (
      player.dead ||
      player.hp <= 0 ||
      time < player.stagger ||
      ['hurt', 'ability', 'heal'].includes(player.state)
    )
      this.reset();
    if (this.preview) {
      const phase = Math.max(0, (now - p.started) / (p.duration * 1000));
      const token = p.kind === 'attack' ? player.attackAt : player.dodgeEnd;
      if (
        now - p.started > Math.max(1600, p.duration * 1000 + 500) ||
        (p.confirmed && (player.state !== p.kind || token !== p.token))
      )
        this.reset();
      else if (phase < 1) {
        result.state = p.kind;
        if (p.kind === 'attack') {
          result.visualAttackPhase = phase;
          result.attackKind = p.attackKind;
          result.attackDuration = p.duration;
          result.combo = p.combo;
        } else {
          result.visualDodgePhase = phase;
          result.dx = p.dx;
          result.dz = p.dz;
        }
        return result;
      } else if (player.state === p.kind && (!p.confirmed || token === p.token)) {
        // A late confirmation must not replay the same locally completed swing/roll.
        result.state = 'idle';
        return result;
      }
    }
    if (['idle', 'walk', 'block'].includes(result.state))
      result.state = input.block ? 'block' : input.x || input.z ? 'walk' : 'idle';
    return result;
  }
}
