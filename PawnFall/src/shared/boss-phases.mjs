// Shared phase bookkeeping and descriptions. Boss-specific attacks stay in their own modules.
export function phaseChangeReady(boss) {
  return boss.phase === 1 && boss.hp > 0 && boss.hp <= boss.max * 0.5;
}

export function enterSecondPhase(game, boss, duration) {
  boss.phase = 2;
  boss.phaseAt = game.time;
  boss.state = 'enrage';
  boss.coreOpen = false;
  boss.begin = game.time;
  boss.until = game.time + duration;
}

export function emitBossPhase(game, boss) {
  game.emit('bossPhase', { id: boss.id, boss: boss.boss, phase: boss.phase, x: boss.x, z: boss.z });
}

export function bossDamageStage(boss) {
  if (!boss?.boss || !(boss.max > 0)) return 0;
  if (boss.phase >= 2) return boss.hp <= boss.max * 0.25 ? 3 : 2;
  return boss.hp <= boss.max * 0.75 ? 1 : 0;
}
const LABELS = {
  castellan: ['ARMOR INTACT', 'PLATING CRACKED', 'PLATING SHATTERED', 'SIEGE ENGINE RUINED'],
  confessor: ['VEIL INTACT', 'MITRE CRACKED', 'STAFF FRACTURED', 'RITE UNRAVELING'],
  fallenking: ['CROWN INTACT', 'ROYAL ARMOR SCARRED', 'CROWN & SWORD BROKEN', 'LAST OF THE CROWN'],
};

export function bossPhaseLabel(boss) {
  return LABELS[boss.boss]?.[bossDamageStage(boss)] || '';
}

export function bossCombatHint(boss) {
  if (boss.state === 'stagger') return 'POSTURE BROKEN · STRIKE NOW';
  if (boss.boss === 'fallenking') {
    if (boss.coreOpen) return 'THE CROWN IS EXPOSED · STRIKE NOW';
    if (boss.state === 'enrage') return 'ROYAL SACRIFICE · CROWN & BLADE SHATTER';
    if (boss.attackKind === 'royalCross') return 'COMMITTED CROSS · LEAVE BOTH MARKED LANES';
    if (boss.attackKind === 'doubleSweep') return 'BROKEN BLADE · DODGE BOTH SWEEPS, THEN PUNISH';
    if (boss.attackKind === 'edict')
      return 'ROYAL EDICT · KILL THE BISHOP TO PREVENT ITS SACRIFICE';
    return 'SWORD SWEEP · LEAVE THE MARKED CIRCLE';
  }
  if (boss.boss === 'confessor') {
    if (boss.coreOpen) return 'RITE BROKEN · STRIKE NOW';
    if (boss.state === 'enrage') return 'STAFF FRACTURED · THE VEIL IS TORN';
    if (boss.attackKind === 'mirrors') return 'THE REAL BISHOP CASTS A SHADOW';
    return boss.phase >= 2
      ? 'FRACTURED STAFF · EXPECT A DELAYED SECOND VOLLEY'
      : 'CROSSED BOLTS · WATCH THE GAPS';
  }
  if (boss.coreOpen) return 'CORE EXPOSED · DAMAGE INCREASED';
  if (boss.state === 'enrage') return 'PLATING SHATTERED · THE SIEGE ENGINE AWAKENS';
  if (boss.state === 'windup')
    return boss.attackKind === 'charge'
      ? 'SIEGE CHARGE · LEAVE THE LANE'
      : boss.attackKind === 'cross'
        ? 'CROSS-BOARD STRIKE · SEEK A CORNER'
        : boss.phase >= 2
          ? 'DOUBLE HAMMER FALL · DODGE BOTH IMPACTS'
          : 'HAMMER FALL · CLEAR THE CIRCLE';
  return boss.phase >= 2
    ? 'BROKEN HAMMER · BAIT THE DOUBLE SLAM OR CROSS STRIKE'
    : 'ARMOR INTACT · BAIT THE ATTACK';
}
