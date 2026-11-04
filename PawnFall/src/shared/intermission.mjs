import { upgradeOffers } from './arsenal.mjs';
import { offerPromotion } from './promotion.mjs';
import { offerEvent } from './encounter-events.mjs';

export function automaticBlessing(game) {
  const id = upgradeOffers(game)[0];
  if (!id) return;
  game.upgrades[id] = (game.upgrades[id] || 0) + 1;
  if (id === 'flask') game.flasks = Math.min(12, game.flasks + 1);
  game.emit('autoBlessing', { upgrade: id });
}

export function beginIntermission(game) {
  game.streamlinedIntermission = true;
  game.intermissionBudget = 1;
  const bonus = game.pendingBlessings || 0;
  game.pendingBlessings = 0;
  for (let i = 0; i < bonus; i++) automaticBlessing(game);
  if (game.wave === 1) {
    automaticBlessing(game);
    game.offerRoutes();
  } else if (game.wave === 2 && game.chessClass === 'pawn' && !game.promotionResolved) {
    automaticBlessing(game);
    offerPromotion(game);
  } else if (game.wave === 3) {
    automaticBlessing(game);
    offerEvent(game);
  } else if (game.wave >= 5) {
    automaticBlessing(game);
    game.finishIntermission();
  } else game.offerUpgrades();
}
