export const BOSS_RELICS = [
  {
    id: 'none',
    name: 'No relic',
    text: 'Standard stamina costs and ability timing.',
    unlock: null,
  },
  {
    id: 'siegebreaker',
    name: 'Castellan’s Seal',
    text: 'Heavy attacks deal 25% more posture damage. Normal guards cost 18 stamina; rolls cost 4 more.',
    unlock: 'castellanKills',
  },
  {
    id: 'mirror',
    name: 'Confessor’s Mirror',
    text: 'Piece abilities recharge 20% faster, but cost 40 stamina instead of 35.',
    unlock: 'confessorKills',
  },
];
export const relicById = (id) => BOSS_RELICS.find((r) => r.id === id) || BOSS_RELICS[0];
export const unlockedRelic = (id, stats = {}) => {
  const relic = relicById(id);
  return !relic.unlock || stats[relic.unlock] > 0 ? relic.id : 'none';
};
