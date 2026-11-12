import type { Change, DayPage } from './chronicle.ts';
import { resources } from './content.ts';
import { allEncounters, traveler } from './game.ts';
import { sceneFor } from './comic-scenes.ts';
import { letterTitle } from './letter.ts';
import { icon } from './icons.ts';
import { digits, journalText, t } from './locale.ts';
import { button, esc, signed } from './markup.ts';
import { injuryLabel } from './injury-view.ts';

const kindLabel = {
  opening: 'Opening camp',
  travel: 'From the road',
  camp: 'At camp',
  market: 'At the market',
  encounter: 'After the encounter',
};
const kindIcon = {
  opening: 'fire',
  travel: 'compass',
  camp: 'fire',
  market: 'coins',
  encounter: 'shield',
};
export const pageLabel = (page: DayPage) => t(kindLabel[page.kind]);
export const pageHeading = (page: DayPage) =>
  page.kind === 'travel' ? t('Toward {0}', t(page.place)) : t(page.place);

const historicalScenes = new Map(allEncounters.map((event) => [event.title, event.id]));
historicalScenes.set(letterTitle, 'lina-letter');
function outcomeArt(page: DayPage) {
  const id =
    page.scene ?? page.changes.map((change) => historicalScenes.get(change.reason)).find(Boolean);
  const scene = sceneFor(id);
  return scene ? ` data-art="${scene.art[2]}"` : '';
}
const number = (day: number) => digits(String(day).padStart(2, '0'));
const hasImpact = (entry: Change) =>
  Boolean(
    entry.wagon ||
      entry.crew.length ||
      entry.shortage ||
      resources.some((key) => entry.supplies[key]),
  );

function tile(value: number, label: string, glyph: string) {
  if (!value) return '';
  return `<span class="impact-tile ${value > 0 ? 'gain' : 'loss'}">
    ${icon(glyph, 20)}<span><bdi dir="ltr">${signed(value)}</bdi><small>${t(label)}</small></span></span>`;
}
function crewImpact(entry: Change) {
  return entry.crew
    .map(
      (person) => `<li class="crew-impact ${person.state === 'fallen' ? 'fallen' : ''}">
    <span class="portrait portrait-${person.id} ${person.state === 'fallen' ? 'fallen' : ''}" aria-hidden="true"></span>
    <span class="crew-impact-content"><strong>${t(traveler(person.id).name)}</strong>
    ${person.injury ? `<span class="crew-state ${person.injury.days ? 'loss' : 'gain'}">${injuryLabel(person.injury)}</span>` : ''}
    ${person.state === 'joined' ? `<span class="crew-state gain">${t('Joined the caravan')}</span>` : person.state === 'fallen' ? `<span class="crew-state loss">${t('Fallen')}</span>` : ''}</span>
    <span class="crew-impact-values">${tile(person.health, 'health', 'heart')}${tile(person.morale, 'morale', 'shield')}</span>
  </li>`,
    )
    .join('');
}
function detail(entry: Change) {
  const supplies =
    resources.map((key) => tile(entry.supplies[key] ?? 0, key, key)).join('') +
    tile(entry.wagon, 'wagon', 'wagon');
  const crew = crewImpact(entry);
  return `<li class="impact-group">
    <p class="impact-cause">${esc(journalText(entry.reason))}</p>
    ${supplies ? `<div class="impact-tiles">${supplies}</div>` : ''}
    ${entry.shortage ? `<p class="impact-warning">${icon('info', 16)} ${t('Missing {0} food and {1} water on this day.', entry.shortage.food, entry.shortage.water)}</p>` : ''}
    ${crew ? `<ul class="crew-impacts">${crew}</ul>` : ''}
  </li>`;
}
export function dayView(page: DayPage, compact = false) {
  const impacts = page.changes.filter(hasImpact);
  const notes = page.changes.filter((entry) => !hasImpact(entry));
  return `<article class="travel-card region-${page.region} ${compact ? 'compact' : ''}">
    ${
      compact
        ? ''
        : `<div class="travel-scene"${outcomeArt(page)}>
      <div class="travel-scene-copy">
        <span class="travel-stamp">${icon(kindIcon[page.kind], 17)} ${t('Day {0}', number(page.day))} <span aria-hidden="true">◆</span> ${pageLabel(page)}</span>
        <h2 id="dialog-title">${esc(pageHeading(page))}</h2>
      </div>
    </div>`
    }
    <div class="travel-card-body">
      <div class="travel-narration">
        <span class="eyebrow">${icon('journal', 15)} ${t('The day’s story')}</span>
        <p class="travel-story">${esc(journalText(page.story))}</p>
        ${notes.length ? `<div class="travel-asides">${notes.map((entry) => `<p>${esc(journalText(entry.reason))}</p>`).join('')}</div>` : ''}
      </div>
      <div class="travel-impact">
        <span class="eyebrow">${icon('wagon', 16)} ${t('Caravan impact')}</span>
        ${impacts.length ? `<ul class="impact-groups">${impacts.map(detail).join('')}</ul>` : `<p class="no-impact">${t('No supplies or crew condition changed.')}</p>`}
      </div>
    </div>
  </article>`;
}
export function chronicleView(pages: readonly DayPage[]) {
  return `<div class="chronicle-list">${pages
    .map(
      (
        page,
        i,
      ) => `<details class="chronicle-card region-${page.region}"${i === pages.length - 1 ? ' open' : ''}>
    <summary>
      <span class="chronicle-thumb"${outcomeArt(page)} aria-hidden="true">${icon(kindIcon[page.kind], 19)}</span>
      <span class="chronicle-title"><span class="eyebrow" aria-label="${t('Day {0} of the expedition', page.day)}">${t('Day {0}', number(page.day))} · ${pageLabel(page)}</span>
      <strong>${esc(pageHeading(page))}</strong></span>
      ${icon('chevron', 17)}
    </summary>
    ${dayView(page, true)}</details>`,
    )
    .reverse()
    .join('')}</div>`;
}
export function dayTrack(pages: readonly DayPage[], position: number) {
  if (pages.length < 2) return '';
  return `<div class="day-track" role="group" aria-label="${t('Days on this leg')}">
    ${pages
      .map((page, i) =>
        button(
          number(page.day),
          'day-jump',
          `data-id="${i}" aria-label="${t('Day {0}', page.day)}"${i === position ? ' aria-current="step"' : ''}`,
          'day-stop' + (i === position ? ' active' : ''),
        ),
      )
      .join('')}
  </div>`;
}
