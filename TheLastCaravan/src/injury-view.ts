import { injuries } from './injuries.ts';
import type { Injury } from './injuries.ts';
import { t } from './locale.ts';

export const injuryLabel = (injury: Injury) =>
  injury.days
    ? t(
        injury.days === 1 ? '{0} · 1 recovery day' : '{0} · {1} recovery days',
        t(injuries[injury.kind].name),
        injury.days,
      )
    : t('Recovered from {0}', t(injuries[injury.kind].name));
