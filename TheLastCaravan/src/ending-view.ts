import type { Game } from './game.ts';
import { traveler } from './game.ts';
import { favors } from './far-road.ts';
import { letterTitle } from './letter.ts';
import { digits, journalText, t } from './locale.ts';
import { esc } from './markup.ts';
import { icon } from './icons.ts';

export function rollCallView(g: Game) {
  if (g.status === 'travel') return '';
  const returnText = g.favor ? favors[g.favor].returnText : null;
  const rememberFavor = returnText
    ? g.chronicle.find((page) => page.changes.some((c) => c.reason === returnText))
    : undefined;
  const memory = [...g.chronicle]
    .reverse()
    .find(
      (page) => page.kind === 'encounter' && !page.changes.some((c) => c.reason === letterTitle),
    );
  const cards = g.crew
    .map((member) => {
      const loss = !member.health;
      const death = loss
        ? g.chronicle.find((page) =>
            page.changes.some((c) =>
              c.crew.some((m) => m.id === member.id && m.state === 'fallen'),
            ),
          )
        : undefined;
      const status = loss
        ? death
          ? t('Fell on day {0}', death.day)
          : t('Fallen')
        : t(g.status === 'won' ? 'Entered the city' : 'Survived the expedition');
      return `<li class="roll-person ${loss ? 'fell' : ''}"><span class="portrait portrait-${member.id} ${loss ? 'fallen' : ''}" aria-hidden="true"></span>
      <div><strong>${t(traveler(member.id).name)}</strong><span>${status}</span></div></li>`;
    })
    .join('');
  const remembered = rememberFavor ? returnText : memory?.story;
  const rememberedDay = rememberFavor?.day ?? memory?.day;
  return `<section class="roll-call" aria-label="${t('Crew roll call')}">
    <div class="roll-heading">${icon('crew', 18)} <h3>${t('Crew roll call')}</h3></div>
    <ul>${cards}</ul>
    ${
      remembered
        ? `<div class="roll-memory"><span class="eyebrow">${t('A moment from the road')} · ${t('Day {0}', digits(rememberedDay!))}</span>
      <p>${esc(journalText(remembered))}</p></div>`
        : ''
    }
  </section>`;
}
