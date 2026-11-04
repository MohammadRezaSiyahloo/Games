export const CURSES = [
  {
    id: 'none',
    name: 'No curse',
    text: 'No additional bonus or cost.',
    damage: 1,
    heavy: 1,
    regen: 1,
    incoming: 1,
    heal: 1,
  },
  {
    id: 'blood',
    name: 'Blood Oath',
    text: 'Heavy attacks deal 35% more damage. Stamina regenerates 28% slower.',
    damage: 1,
    heavy: 1.35,
    regen: 0.72,
    incoming: 1,
    heal: 1,
  },
  {
    id: 'glass',
    name: 'Glass Crown',
    text: 'All weapon attacks deal 22% more damage. Incoming damage increases by 25%.',
    damage: 1.22,
    heavy: 1,
    regen: 1,
    incoming: 1.25,
    heal: 1,
  },
  {
    id: 'hollow',
    name: 'Hollow Heart',
    text: 'Weapon posture damage increases by 40%. Flasks heal 30% less.',
    damage: 1,
    heavy: 1,
    regen: 1,
    incoming: 1,
    heal: 0.7,
    poise: 1.4,
  },
];
export const ROLES = [
  {
    id: 'balanced',
    name: 'Balanced',
    text: 'Standard co-op combat.',
    damage: 1,
    poise: 1,
    regen: 1,
    cost: 0,
  },
  {
    id: 'guardian',
    name: 'Guardian',
    text: 'While guarding, protect allies within 4.5 units from 20% of incoming damage. Your stamina regeneration is 10% slower.',
    damage: 1,
    poise: 1,
    regen: 0.9,
    cost: 0,
  },
  {
    id: 'breaker',
    name: 'Breaker',
    text: 'Deal 35% more posture damage, but 10% less weapon damage. Create openings for team finishers.',
    damage: 0.9,
    poise: 1.35,
    regen: 1,
    cost: 0,
  },
  {
    id: 'controller',
    name: 'Controller',
    text: 'Piece abilities slow regular enemies for two seconds, but cost five more stamina.',
    damage: 1,
    poise: 1,
    regen: 1,
    cost: 5,
  },
];
export const curseById = (id) => CURSES.find((c) => c.id === id) || CURSES[0];
export const roleById = (id) => ROLES.find((r) => r.id === id) || ROLES[0];
export const activeRole = (g) => (g.partners ? roleById(g.coopRole) : ROLES[0]);

export function allyProtection(game) {
  return game.partners?.some(
    (g) =>
      g !== game &&
      g.hp > 0 &&
      g.coopRole === 'guardian' &&
      g.player.block &&
      Math.hypot(g.player.x - game.player.x, g.player.z - game.player.z) < 4.5,
  )
    ? 0.8
    : 1;
}
