export const PROMOTIONS = ['knight', 'bishop', 'rook', 'queen', 'pawn'];

export function promotionEligible(game) {
  return (
    !game.training &&
    !game.bossTrial &&
    game.wave >= 2 &&
    game.chessClass === 'pawn' &&
    !game.promotionResolved
  );
}

export function offerPromotion(game) {
  if (!promotionEligible(game)) return false;
  game.promotionChoices = [...PROMOTIONS];
  game.mode = 'promotion';
  game.player.block = false;
  game.player.state = 'idle';
  game.emit('promotionOffered');
  return true;
}

export function choosePromotion(game, id) {
  if (game.mode !== 'promotion' || !game.promotionChoices?.includes(id) || !PROMOTIONS.includes(id))
    return false;
  game.promotionResolved = true;
  game.promotionChoices = [];
  game.chessClass = id;
  Object.assign(game.player, {
    type: id,
    state: 'idle',
    block: false,
    ability: null,
    y: 0,
    wardUntil: 0,
  });
  game.abilityReadyAt = game.time;
  game.mode = 'playing';
  game.emit('promoted', { piece: id });
  return true;
}
