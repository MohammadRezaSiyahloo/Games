export const STARTING_LOADOUT = { weapon: 'longsword', chessClass: 'pawn' };

export const LOADOUT_UNLOCKS = [
  { slot: 'weapon', id: 'rapier', plays: 1 },
  { slot: 'chessClass', id: 'knight', plays: 2 },
  { slot: 'weapon', id: 'spear', plays: 3 },
  { slot: 'chessClass', id: 'bishop', plays: 4 },
  { slot: 'weapon', id: 'warhammer', plays: 5 },
  { slot: 'chessClass', id: 'rook', plays: 6 },
  { slot: 'weapon', id: 'twinblades', plays: 8 },
  { slot: 'chessClass', id: 'queen', plays: 10 },
  { slot: 'weapon', id: 'greatsword', plays: 12 },
  { slot: 'chessClass', id: 'king', plays: 15 },
];

const count = (value) => Math.min(1e8, Math.max(0, Math.floor(Number(value) || 0)));

export function finishedPlays(stats = {}) {
  // Older profiles tracked wins but did not track finished defeats.
  return count(
    stats?.finishedPlays ??
      (count(stats?.wins) + count(stats?.coopWins) + count(stats?.versusWins)),
  );
}

export function requiredPlays(slot, id) {
  if (STARTING_LOADOUT[slot] === id) return 0;
  return LOADOUT_UNLOCKS.find((item) => item.slot === slot && item.id === id)?.plays ?? Infinity;
}

export function availableLoadout(slot, id, stats) {
  return finishedPlays(stats) >= requiredPlays(slot, id) ? id : STARTING_LOADOUT[slot];
}
