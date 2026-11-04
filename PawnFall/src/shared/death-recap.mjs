export function damageRecord(game, source, damage) {
  const enemy = source.source ? game.enemies.find((e) => e.id === source.source) : source;
  const arena = String(source.source || '').startsWith('hazard:');
  const type = enemy?.type || 'unknown';
  return {
    time: game.time,
    damage: Math.round(damage * 10) / 10,
    source: arena
      ? 'Arena strike'
      : enemy?.name ||
        (enemy?.isAvatar
          ? 'Rival'
          : type === 'unknown'
            ? 'Incoming attack'
            : type[0].toUpperCase() + type.slice(1)),
    attack: arena
      ? 'Marked lane'
      : source.attackKind === 'heavy'
        ? 'Heavy attack'
        : source.source
          ? 'Projectile'
          : enemy?.attackKind ||
            (enemy?.type === 'knight'
              ? 'Leaping strike'
              : enemy?.comboStep
                ? 'Combo strike'
                : 'Melee strike'),
    tip: arena
      ? 'Leave the marked area before it turns red.'
      : type === 'knight'
        ? 'Dodge sideways after the knight commits to its landing.'
        : type === 'bishop'
          ? 'Move across the projectile path, then close the distance.'
          : type === 'queen'
            ? 'Wait for all three strikes before punishing the recovery.'
            : source.attackKind === 'heavy'
              ? 'Parry the windup or evade. Heavy blows drain more guard stamina.'
              : game.stamina < 22
                ? 'Create space and release guard to recover stamina.'
                : 'Face the attacker to guard, or roll through the committed strike.',
  };
}
