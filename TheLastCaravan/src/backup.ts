import { readSave } from './game.ts';
import type { Game } from './game.ts';
import { readProfile } from './profile.ts';
import type { Profile } from './profile.ts';

const format = 'the-last-caravan';
export const backupLimit = 1_000_000;
export const exportProgress = (game: Game, profile: Profile) =>
  JSON.stringify({ format, version: 1, game, profile }, null, 2);
export function importProgress(raw: string): { game: Game; profile: Profile } | null {
  if (raw.length > backupLimit) return null;
  try {
    const data = JSON.parse(raw);
    if (
      data?.format !== format ||
      data.version !== 1 ||
      !Array.isArray(data.profile?.records) ||
      !Array.isArray(data.profile?.badges)
    )
      return null;
    const game = readSave(JSON.stringify(data.game));
    if (!game) return null;
    return { game, profile: readProfile(JSON.stringify(data.profile)) };
  } catch {
    return null;
  }
}
