import { crew } from './content.ts';
import { outfits } from './expansion.ts';
import type { Outfit } from './expansion.ts';
import { detours, journeyModes } from './frontier.ts';
import { openingIds } from './far-road.ts';
import type { Opening } from './far-road.ts';
import type { JourneyMode } from './frontier.ts';
import { alive } from './game.ts';
import type { Game } from './game.ts';

export const badges = [
  { id: 'arrived', name: 'The Lantern Gates', detail: 'Reach the Last City.', outfit: 'merchant' },
  {
    id: 'founders',
    name: 'The First Four',
    detail: 'Reach the city with all four founders alive.',
    outfit: 'field',
  },
  {
    id: 'sound',
    name: 'Sound Axles',
    detail: 'Reach the city with at least 80% wagon condition.',
    outfit: 'wright',
  },
  {
    id: 'fast',
    name: 'Before the Bells',
    detail: 'Reach the city by day 7, or by day 10 on the Far Road.',
  },
  { id: 'companion', name: 'A Place by the Fire', detail: 'Bring a recruit safely to the city.' },
  { id: 'ready', name: 'Roadworthy', detail: 'Reach the city with both upgrade slots filled.' },
  {
    id: 'detours',
    name: 'The Roads Less Traveled',
    detail: 'Reach the city after visiting all three optional detours.',
  },
] as const;
type Badge = (typeof badges)[number]['id'];
type Record = {
  id: string;
  seed: string;
  status: 'won' | 'lost';
  day: number;
  alive: number;
  crew: number;
  wagon: number;
  outfit: Outfit;
  classic: boolean;
  mode: JourneyMode;
  opening: Opening | null;
  expandedEncounters: boolean;
};
export type Profile = {
  records: Record[];
  badges: Badge[];
  finished: number;
  victories: number;
  settings: { sound: boolean; volume: number; motion: boolean; language: 'en' | 'fa' };
};
export const profileKey = 'last-caravan-profile-v1';
export const emptyProfile = (): Profile => ({
  records: [],
  badges: [],
  finished: 0,
  victories: 0,
  settings: { sound: false, volume: 45, motion: true, language: 'en' },
});
export function outfitsOpen(p: Profile): Outfit[] {
  return [
    'standard',
    ...badges.flatMap((b) => ('outfit' in b && p.badges.includes(b.id) ? [b.outfit] : [])),
  ];
}
export function recordRun(p: Profile, g: Game): Profile {
  if (g.status === 'travel' || p.records.some((record) => record.id === g.id)) return p;
  const win = g.status === 'won';
  const earned: Badge[] = [];
  if (win) {
    earned.push('arrived');
    if (g.crew.slice(0, crew.length).every((m) => m.health > 0)) earned.push('founders');
    if (g.wagon >= 80) earned.push('sound');
    if (g.day <= (g.mode === 'far' ? 10 : 7)) earned.push('fast');
    if (g.crew.slice(crew.length).some((m) => m.health > 0)) earned.push('companion');
    if (g.upgrades.length === 2) earned.push('ready');
    if (detours.every((stop) => g.path.includes(stop.id))) earned.push('detours');
  }
  const result: Record = {
    id: g.id,
    seed: g.seed,
    status: g.status,
    day: g.day,
    alive: alive(g),
    crew: g.crew.length,
    wagon: g.wagon,
    outfit: g.outfit,
    classic: g.classic,
    mode: g.mode,
    opening: g.opening,
    expandedEncounters: g.expandedEncounters,
  };
  return {
    ...p,
    finished: p.finished + 1,
    victories: p.victories + Number(win),
    badges: [...new Set([...p.badges, ...earned])],
    records: [result, ...p.records].slice(0, 24),
  };
}
export function readProfile(raw: string | null): Profile {
  const base = emptyProfile();
  if (!raw) return base;
  try {
    const p = JSON.parse(raw) as Profile;
    if (!Array.isArray(p.records) || !Array.isArray(p.badges)) return base;
    const count = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0);
    return {
      records: p.records
        .filter(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            typeof r.seed === 'string' &&
            ['won', 'lost'].includes(r.status) &&
            outfits.some((o) => o.id === r.outfit) &&
            [r.day, r.alive, r.crew, r.wagon].every((n) => Number.isInteger(n) && n >= 0),
        )
        .slice(0, 24)
        .map((r) => ({
          ...r,
          mode: journeyModes.find((m) => m.id === r.mode)?.id ?? 'standard',
          expandedEncounters: r.expandedEncounters === true,
          opening:
            r.mode === 'far'
              ? (openingIds.find((opening) => opening === r.opening) ?? 'child')
              : null,
        })),
      badges: badges.map((b) => b.id).filter((id) => p.badges.includes(id)),
      finished: count(p.finished),
      victories: count(p.victories),
      settings: {
        sound: p.settings?.sound === true,
        volume:
          typeof p.settings?.volume === 'number' && Number.isFinite(p.settings.volume)
            ? Math.max(0, Math.min(100, p.settings.volume))
            : base.settings.volume,
        motion: p.settings?.motion !== false,
        language: p.settings?.language === 'fa' ? 'fa' : 'en',
      },
    };
  } catch {
    return base;
  }
}
