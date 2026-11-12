import type { Game } from './game.ts';

export const injuries = {
  sprain: { name: 'Sprained ankle', days: 2 },
  cut: { name: 'Deep cut', days: 3 },
  exposure: { name: 'Exposure', days: 2 },
} as const;
export type InjuryKind = keyof typeof injuries;
export type Injury = { kind: InjuryKind; days: number };
export function validInjury(injury: Injury | undefined, allowRecovered = false) {
  return (
    injury === undefined ||
    (injury !== null &&
      Object.hasOwn(injuries, injury.kind) &&
      Number.isInteger(injury.days) &&
      injury.days >= (allowRecovered ? 0 : 1) &&
      injury.days <= injuries[injury.kind].days)
  );
}
function injuryTarget(g: Game, target?: number) {
  if (target !== undefined && g.crew[target]?.health) return target;
  const activeScout = g.crew.findIndex((m) => m.health && m.role === 'Scout');
  return activeScout >= 0 ? activeScout : g.crew.findIndex((m) => m.health > 0);
}

export function plannedInjury(g: Game, kind: InjuryKind | undefined, target?: number) {
  if (!kind) return null;
  const index = injuryTarget(g, target);
  const days = injuries[kind].days;
  if (index < 0 || (g.crew[index].injury?.days ?? 0) > days) return null;
  return { index, injury: { kind, days } };
}
