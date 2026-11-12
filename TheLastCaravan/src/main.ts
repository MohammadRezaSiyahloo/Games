import './style.css';
import { regions, resources } from './content.ts';
import type { Choice } from './content.ts';
import {
  alive,
  assign,
  availableCampStories,
  campStoryChoice,
  canAfford,
  capacityFor,
  cargo,
  cook,
  decideLetter,
  encounterEffect,
  fit,
  forage,
  gameWorld,
  heavyAt,
  here,
  install,
  isBypass,
  memberName,
  morale,
  newGame,
  option,
  pendingEvent,
  quote,
  readSave,
  recruit,
  repair,
  resolve,
  resolveCampStory,
  rest,
  roadDaysToCity,
  routes,
  saveKey,
  setRations,
  shareWatch,
  shortfall,
  trade,
  travel,
  traveler,
  treat,
} from './game.ts';
import type { Game } from './game.ts';
import { outfits, rolePerks } from './expansion.ts';
import type { Outfit, Role, Upgrade } from './expansion.ts';
import { emptyProfile, outfitsOpen, profileKey, readProfile, recordRun } from './profile.ts';
import { actionRow, button, changes, disabled, esc, signed } from './markup.ts';
import { campView, marketView, recordsView, settingsView, setupView } from './views.ts';
import type { CampTab } from './views.ts';
import { RoadAudio } from './audio.ts';
import { icon } from './icons.ts';
import { arrow, digits, isPersian, journalText, percent, t, useLanguage } from './locale.ts';
import { enablePeyda } from './peyda.ts';
import { bondSupport, detours, journeyModes } from './frontier.ts';
import { backupLimit, exportProgress, importProgress } from './backup.ts';
import { pagesForLeg } from './chronicle.ts';
import { chronicleView, dayTrack, dayView } from './chronicle-view.ts';
import { rollCallView } from './ending-view.ts';
import { favorAtStop, favors } from './far-road.ts';
import { plannedInjury } from './injuries.ts';
import { injuryLabel } from './injury-view.ts';
import { comicView } from './comic-view.ts';
import {
  letterChoices,
  letterEnding,
  letterIntro,
  letterNarrative,
  letterPending,
  letterTitle,
} from './letter.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
type Dialog =
  | 'new'
  | 'camp'
  | 'market'
  | 'event'
  | 'result'
  | 'guide'
  | 'records'
  | 'settings'
  | 'day'
  | 'letter'
  | 'camp-talk';
const load = () => {
  try {
    return readSave(localStorage.getItem(saveKey));
  } catch {
    return null;
  }
};
const runId = () =>
  Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(36)).join('-');
let game = load() ?? newGame('Hearth-01', 'standard', runId(), false, 'far');
let profile = emptyProfile();
try {
  profile = readProfile(localStorage.getItem(profileKey));
} catch {}
let selected = routes(game)[0]?.id ?? game.current;
let openDialog: Dialog | null = null;
let inspected: number | null = null;
let storageAvailable = true;
let activeTab = 'map';
let roadNote = '';
let campNote = '';
let backupNote = '';
let talkingTo: string | null = null;
let reading: { indices: number[]; position: number; returnTo: 'camp' | 'journey' } | null = null;
function readDays(indices: number[], returnTo: 'camp' | 'journey' = 'journey') {
  if (!indices.length) return;
  reading = { indices, position: 0, returnTo };
  openDialog = 'day';
}
let campTab: CampTab = 'supplies';
let replay: (typeof profile.records)[number] | undefined;
let sceneKey = '';
let disposeScene: (() => void) | undefined;
const audio = new RoadAudio();
const kindIcon = { camp: 'fire', wild: 'mountain', market: 'tower', city: 'city' };
const kindLabel = {
  camp: 'Campsite',
  wild: 'Wilderness',
  market: 'Settlement',
  city: 'Destination',
};
const canManage = () => game.status === 'travel' && !game.pending && !letterPending(game);
function nextRoadDialog(): Dialog | null {
  if (game.status !== 'travel') return 'result';
  if (game.pending) return 'event';
  return letterPending(game) ? 'letter' : null;
}
const asset = (file: string) => `${import.meta.env.BASE_URL}art/${file}`;
const meter = (value: number, className = '') =>
  `<span class="meter ${className}"><span style="width:${value}%"></span></span>`;
const nav = (name: string, id: string) =>
  `<button class="nav-btn ${activeTab === id ? 'active' : ''}" data-act="nav" data-id="${id}" ${activeTab === id ? 'aria-current="location"' : ''}>${icon(id, 18)} ${t(name)}</button>`;

function save() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(game));
    localStorage.setItem(profileKey, JSON.stringify(profile));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}
const recovered = recordRun(profile, game);
if (recovered !== profile) {
  profile = recovered;
  save();
}
function choose(id: string) {
  if (routes(game).some((p) => p.id === id)) selected = id;
}
function setGame(next: Game) {
  if (game === next) return;
  game = next;
  profile = recordRun(profile, game);
  save();
}
function header() {
  return `<header class="topbar"><div class="top-inner">
    <a href="#top" class="brand"><img src="${asset('mark.svg')}" width="34" height="34" alt=""><span>${t('THE LAST CARAVAN')}<small>${t('EXPEDITION EDITION')}</small></span></a>
    <nav aria-label="${t('Expedition')}">${nav('World Map', 'map')}${nav('Crew', 'crew')}${nav('Journal', 'journal')}${button(icon('shield', 17) + ' ' + t('Records'), 'records', '', 'nav-btn')}</nav>
    <div class="top-actions">${button(icon('info', 17) + '<span>' + t('How to play') + '</span>', 'guide', 'aria-label="' + t('How to play') + '"', 'quiet help')}${button(icon('settings', 19), 'settings', 'aria-label="' + t('Settings') + '"', 'quiet help')}${button(isPersian() ? 'English' : 'فارسی', 'language', `lang="${isPersian() ? 'en' : 'fa'}" aria-label="${isPersian() ? 'Switch to English' : 'تغییر زبان به فارسی'}"`, 'quiet lang-btn')}${button(t('New expedition'), 'new', '', 'secondary new-btn')}</div>
  </div></header>`;
}
function hero() {
  return `<section class="hero" aria-label="${t('The Last Caravan')}">
    <div class="hero-content"><span class="eyebrow hero-kicker"><i></i> ${t('SURVIVAL STRATEGY')} <b>◆</b> ${t('EXPEDITION EDITION')}</span>
    <h1>${t('The Last Caravan')}</h1>
    <p>${t('One wagon. A dying kingdom. Get your people home.')}</p>
    <div class="hero-meta"><span>${icon('compass', 16)} ${t(regions[here(game).region])}</span><span>${icon('clock', 16)} ${t('Day {0}', digits(String(game.day).padStart(2, '0')))}</span></div></div>
    <span class="hero-corner" aria-hidden="true">✧</span>
  </section>`;
}
function ledger() {
  return `<section class="ledger" aria-label="${t('Caravan supplies')}">
    ${resources.map((key) => `<div class="stat ${key}"><span class="stat-icon">${icon(key, 23)}</span><div><span class="stat-label">${t(key)}</span><strong>${digits(game.supplies[key])}</strong></div></div>`).join('')}
    <div class="stat wagon"><span class="stat-icon">${icon('wagon', 23)}</span><div><span class="stat-label">${t('Wagon')}</span><strong>${digits(game.wagon)}<small>${isPersian() ? '٪' : '%'}</small></strong></div>${meter(game.wagon, 'wagon-meter')}</div>
    <div class="stat spirit"><span class="stat-icon">${icon('heart', 23)}</span><div><span class="stat-label">${t('Morale')}</span><strong>${digits(morale(game))}<small>${isPersian() ? '٪' : '%'}</small></strong></div>${meter(morale(game), 'spirit-meter')}</div>
  </section>`;
}
function map() {
  const w = gameWorld(game);
  const reachable = routes(game).map((p) => p.id);
  const canSelect = game.status === 'travel';
  const node = (id: string) => w.nodes.find((n) => n.id === id)!;
  return `<div class="map-card"><div class="map-scroll" tabindex="0" aria-label="${t('Map of the road east. Scroll horizontally on small screens.')}"><div class="map${game.mode === 'far' ? ' map-far' : ''}">
    <div class="map-frame" aria-hidden="true"></div>
    <div class="map-region green">${t('THE GREENWILD')}</div><div class="map-region frost">${t('THE FROSTMARCH')}</div><div class="map-region ash">${t('THE ASHEN EXPANSE')}</div>
    <div class="map-compass" aria-hidden="true"><span>${t('N')}</span>${icon('compass', 43)}</div>
    <svg aria-hidden="true" class="map-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      ${w.edges
        .map(([from, to]) => {
          const a = node(from),
            b = node(to);
          const path = game.path.some((id, i) => id === from && game.path[i + 1] === to);
          const current = from === game.current && canSelect;
          const emphasis = current && to === selected;
          const bypass = isBypass(game, to, from);
          const x1 = a.x * 10,
            y1 = a.y * 10,
            x2 = b.x * 10,
            y2 = b.y * 10,
            mid = (x1 + x2) / 2;
          const line = bypass
            ? `M${x1} ${y1} Q${mid} ${Math.max(140, Math.min(y1, y2) - 350)},${x2} ${y2}`
            : `M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}`;
          return `<path class="${bypass ? 'bypass ' : ''}${path ? 'traveled' : emphasis ? 'chosen' : current ? 'reachable' : ''}" d="${line}"/>`;
        })
        .join('')}
    </svg>
    ${w.nodes
      .map((p) => {
        const now = p.id === game.current,
          visited = game.path.includes(p.id);
        const reachableNow = canSelect && reachable.includes(p.id);
        const style = `left:${p.x}%;top:${p.y}%`;
        const classes = `node ${now ? 'current' : visited ? 'visited' : reachableNow ? 'reachable-node' : 'future'} ${reachableNow && selected === p.id ? 'selected' : ''} ${p.kind} ${p.lane === 3 ? 'detour' : p.lane === 4 ? 'family-route' : ''}`;
        const content = `<span class="node-dot">${icon(kindIcon[p.kind], 17)}</span><span class="node-label">${t(p.name)}</span>`;
        return reachableNow
          ? `<button class="${classes}" style="${style}" data-act="select" data-id="${p.id}" aria-pressed="${selected === p.id}">${content}</button>`
          : `<div class="${classes}" style="${style}" ${now ? 'aria-current="location"' : ''}>${content}</div>`;
      })
      .join('')}
    <span class="map-index" aria-hidden="true">${isPersian() ? '۱' : 'I'} <b>·</b> ${t('THE ROAD EAST')}</span>
  </div></div><div class="map-legend"><span><i class="legend-current"></i> ${t('Current stop')}</span><span><i class="legend-reach"></i> ${t('Available route')}</span><span><i class="legend-future"></i> ${t('Ahead')}</span>${game.mode !== 'standard' ? `<span><i class="legend-bypass"></i> ${t('Ridge bypass')}</span>` : ''}<span class="seed">${t('SEED')} <b><bdi>${esc(game.seed)}</bdi></b>${game.classic ? ' · ' + t('CLASSIC ATLAS') : ''}</span></div></div>`;
}
function diaryButton() {
  return pagesForLeg(game).length
    ? button(icon('journal', 17) + ' ' + t('Read the road diary'), 'latest-diary')
    : '';
}
function routeCard() {
  const available = routes(game);
  const place = available.find((p) => p.id === selected);
  if (game.status !== 'travel')
    return `<aside class="route card"><span class="eyebrow">${t('EXPEDITION COMPLETE')}</span><h3>${t(game.status === 'won' ? 'The gates are open' : 'The road ends here')}</h3><p>${esc(t(game.reason))}</p>${button(t('View expedition results') + ' ' + icon('arrow', 18), 'result', '', 'primary')}${diaryButton()}</aside>`;
  if (!place) return '';
  const cost = quote(game, place);
  const remaining = roadDaysToCity(game, place.id);
  const shortage = shortfall(game, place);
  const lethal = game.wagon <= cost.wagon;
  const pending = pendingEvent(game);
  const letter = letterPending(game);
  const onward = routes(game, place.id);
  const detour = detours.some((stop) => stop.id === place.id);
  const favor = favorAtStop(place.id);
  const weatherCosts = { water: -cost.weatherWater };
  return `<aside class="route card" aria-label="${t('Route planning')}">
    <div class="panel-caption"><span class="eyebrow">${t('PLAN YOUR NEXT LEG')}</span>${icon('compass', 21)}</div>
    <div class="route-title"><span class="route-icon">${icon(kindIcon[place.kind], 25)}</span><div><h3>${t(place.name)}</h3><span>${t(favor ? favors[favor].label : cost.bypass ? 'Ridge bypass' : detour ? 'Optional detour' : kindLabel[place.kind])} · ${t(regions[place.region])}</span></div></div>
    <p>${t(place.description)}</p>
    ${
      game.path.length === 1 && game.letter === 'started'
        ? `<div class="road-note letter-note">${icon('journal', 17)} <div><strong>${t(letterTitle)}</strong><p>${t(letterIntro)}</p></div></div>`
        : ''
    }
    ${cost.bypass ? `<p class="ration-detail">${t('This bypass skips a stop. It trades wagon wear for a different route into the mountains.')}</p>` : ''}
    ${roadNote ? `<div class="road-note" role="status">${icon('journal', 17)} <span>${esc(journalText(roadNote))}</span></div>` : ''}
    <div class="route-cost"><span>${icon('clock', 17)} <strong>${digits(cost.days)}</strong> ${t(cost.days === 1 ? 'day' : 'days')}</span><span>${icon('food', 17)} <strong>${digits(cost.food)}</strong> ${t('food')}</span><span>${icon('water', 17)} <strong>${digits(cost.water)}</strong> ${t('water')}</span><span>${icon('wagon', 17)} <strong><bdi dir="ltr">−${digits(cost.wagon)}</bdi></strong> ${t('wagon')}</span></div>
    ${
      cost.injuryFood || cost.injuryWear
        ? `<div class="injury-route">${icon('medicine', 17)} <span>${t('Injured crew add to this leg’s cost.')}</span>
      ${cost.injuryFood ? `<bdi dir="ltr">+${digits(cost.injuryFood)}</bdi> ${t('food')}` : ''}
      ${cost.injuryWear ? `<bdi dir="ltr">+${digits(cost.injuryWear)}</bdi> ${t('wagon wear')}` : ''}</div>`
        : ''
    }
    ${cost.markedRoad ? `<div class="condition">${icon('map', 16)} ${t('Mara’s marker reduces wagon wear by {0}.', cost.markedRoad)}</div>` : ''}
    <p class="road-estimate">${
      remaining.min === remaining.max
        ? t('{0} travel days to the city via this stop', cost.days + remaining.min)
        : t(
            '{0}–{1} travel days to the city via this stop',
            cost.days + remaining.min,
            cost.days + remaining.max,
          )
    }</p>
    ${place.find ? `<div class="route-find">${t('On arrival')} ${changes(place.find)}</div>` : ''}
    ${onward.length ? `<div class="onward"><span class="eyebrow">${t('ONWARD FROM HERE')}</span><div>${onward.map((p) => `<span title="${t(kindLabel[p.kind])}">${icon(kindIcon[p.kind], 14)} ${t(p.name)}</span>`).join('')}</div></div>` : ''}
    ${
      cost.weather
        ? `<div class="forecast"><span class="eyebrow">${t('Departure forecast')}</span><strong>${t(cost.weather)}</strong><div>
      ${changes(weatherCosts)}${cost.weatherWear ? `<span class="loss"><bdi dir="ltr">−${digits(cost.weatherWear)}</bdi> ${t('wagon')}</span>` : ''}
      ${cost.weatherMorale ? `<span class="loss">${t('Up to −{0} morale each', cost.weatherMorale)}</span>` : ''}
    </div></div>`
        : ''
    }
    ${cost.condition ? `<div class="condition">${icon('compass', 16)} ${t(cost.condition)}</div>` : ''}
    ${shortage.health || lethal ? `<p class="warning">${lethal ? t('The wagon cannot survive this leg. Repair it before leaving.') : t('Short by {0} food and {1} water. Each traveler loses {2} health and {3} morale.', shortage.food, shortage.water, shortage.health, shortage.morale)}</p>` : ''}
    ${
      pending || letter
        ? ''
        : `<label class="ration-picker" for="rations"><span>${t('Travel rations')}</span><select id="rations"><option value="normal"${game.ration === 'normal' ? ' selected' : ''}>${t('Standard')}</option><option value="lean"${game.ration === 'lean' ? ' selected' : ''}>${t('Lean')}</option></select></label>
    ${cost.rationMorale ? `<p class="ration-detail">${t('Lean rations cost each traveler {0} health and {1} morale on this leg.', cost.rationHealth, cost.rationMorale)}</p>` : ''}`
    }
    ${game.bonds.length && (shortage.morale || cost.rationMorale || cost.weatherMorale) ? `<p class="ration-detail">${t('Bonds can soften morale loss.')}</p>` : ''}
    ${
      pending
        ? button(t('Resolve encounter') + ' ' + icon('arrow', 19), 'event', '', 'primary')
        : letter
          ? button(t('Read Tomas’s letter') + ' ' + icon('arrow', 19), 'letter', '', 'primary')
          : button(
              t('Travel to {0}', t(place.name)) + icon('arrow', 19),
              'travel',
              'data-id="' + place.id + '"',
              'primary',
            )
    }
    ${diaryButton()}
    <div class="route-alts" aria-label="${t('Next destinations')}">${available.map((p) => button(t(p.name), 'select', `data-id="${p.id}" aria-pressed="${selected === p.id}"`, p.id === selected ? 'alt active' : 'alt')).join('')}</div>
  </aside>`;
}
function crewCard(i: number) {
  const member = game.crew[i],
    c = traveler(member.id);
  const support = bondSupport(game, i);
  return `<button class="crew-card ${inspected === i ? 'expanded' : ''}" data-act="inspect" data-id="${i}" aria-expanded="${inspected === i}">
    <div class="portrait portrait-${member.id} ${!member.health ? 'fallen' : ''}" aria-hidden="true"></div>
    <div class="crew-info"><span class="eyebrow">${t(member.role)}</span><h3>${t(c.name)}</h3><div class="crew-health">${icon('heart', 14)} <span>${member.health ? t('{0}% health', member.health) : t('Fallen')}</span>${meter(member.health)}</div>${member.injury ? `<span class="crew-injury">${injuryLabel(member.injury)}</span>` : ''}</div>
    ${inspected === i ? `<span class="crew-details"><strong>${t(c.trait)}</strong> · ${t(c.story)}<br><span>${t(rolePerks[member.role])} ${'price' in c ? t(c.perk) : ''} ${support ? t('Steadies morale by up to {0} during hardship.', support) : ''} ${member.health ? t('Morale {0}%.', member.morale) + (fit(game, i) ? '' : ' ' + t('Off duty.')) : ''}</span></span>` : ''}
  </button>`;
}
function main() {
  return `<main id="top">${hero()}${ledger()}
  <section class="section" id="map" aria-labelledby="map-heading">
    <div class="section-head"><div><div class="eyebrow">${t('01 / EXPEDITION ATLAS')}</div><h2 id="map-heading">${t(journeyModes.find((mode) => mode.id === game.mode)!.name)}</h2></div>
      <div class="map-toolbar"><span class="current-place"><i></i> ${t(here(game).name)}</span>${button(icon('fire', 17) + ' ' + t('Camp'), 'camp', disabled(!canManage()))}${here(game).kind === 'market' ? button(icon('coins', 17) + ' ' + t('Market'), 'market', disabled(!canManage())) : ''}</div></div>
    <div class="planning">${map()}${routeCard()}</div>
  </section>
  <section class="section" id="crew" aria-labelledby="crew-heading"><div class="section-head"><div><div class="eyebrow">${t('02 / YOUR TRAVELERS')}</div><h2 id="crew-heading">${t('The Caravan Crew')}</h2></div><span class="section-meta">${t('{0} of {1} traveling', alive(game), game.crew.length)}</span></div><div class="crew-grid">${game.crew.map((_, i) => crewCard(i)).join('')}</div></section>
  <section class="section" id="journal" aria-labelledby="journal-heading"><div class="section-head"><div><div class="eyebrow">${t('03 / ROAD NOTES')}</div><h2 id="journal-heading">${t('Expedition Journal')}</h2></div><span class="section-meta">${t('{0} / {1} cargo', cargo(game.supplies), capacityFor(game))}</span></div>
  ${chronicleView(game.chronicle)}
  <details class="journal-ledger"${game.chronicle.length ? '' : ' open'}><summary>${t('Detailed expedition ledger')}</summary>
  <ul class="journal">${game.log.map((e) => `<li><span>${t('DAY {0}', digits(String(e.day).padStart(2, '0')))}</span><p>${esc(journalText(e.text))}</p></li>`).join('')}</ul></details></section>
  <footer><span>${t('THE LAST CARAVAN')} <b>◆</b> ${t('EXPEDITION EDITION')}</span><span>${t(storageAvailable ? 'Progress saves on this device.' : 'This browser could not save your progress.')}</span></footer>
  </main>`;
}
function effect(choice: Choice) {
  const target = t(
    choice.target === undefined ? 'each' : memberName(game, choice.target).split(' ')[0],
  );
  const setback = plannedInjury(game, choice.injury, choice.target);
  const status = setback
    ? `<span class="loss">${icon('medicine', 15)} ${t(memberName(game, setback.index))} · ${injuryLabel(setback.injury)}</span>`
    : '';
  return (
    status +
      changes(choice.supplies) +
      (choice.wagon
        ? `<span class="${choice.wagon > 0 ? 'gain' : 'loss'}"><bdi dir="ltr">${signed(choice.wagon)}</bdi> ${t('wagon')}</span>`
        : '') +
      (choice.health
        ? `<span class="${choice.health > 0 ? 'gain' : 'loss'}"><bdi dir="ltr">${signed(choice.health)}</bdi> ${t('health')} · ${target}</span>`
        : '') +
      (choice.morale
        ? `<span class="${choice.morale > 0 ? 'gain' : 'loss'}"><bdi dir="ltr">${signed(choice.morale)}</bdi> ${t('morale')} · ${target}</span>`
        : '') || t('Continue the journey')
  );
}
function dialog() {
  if (!openDialog) return '';
  let title = '',
    kicker = '',
    body = '';
  if (openDialog === 'new') {
    title = 'Begin a new expedition';
    kicker = 'THE ROAD EAST';
    body = setupView(game, profile, replay);
  } else if (openDialog === 'records') {
    title = 'Expedition Records';
    kicker = 'THE ROAD REMEMBERS';
    body = recordsView(profile);
  } else if (openDialog === 'settings') {
    title = 'Settings';
    kicker = 'EXPEDITION PREFERENCES';
    body = settingsView(profile, backupNote);
  } else if (openDialog === 'guide') {
    title = 'Keep your people alive';
    kicker = 'TRAVELER’S HANDBOOK';
    body = `<ol class="guide-list"><li><strong>${t('Choose the next leg.')}</strong> ${t('Select a highlighted destination on the map. Each leg shows days, supplies, and wagon wear before you commit.')}</li>
      <li><strong>${t('Check the ledgers.')}</strong> ${t('A shortage costs everyone health and morale. The Ashen Expanse uses extra water. Above {0} cargo, each travel day costs one extra food, and each leg adds two wagon wear. Lean rations stretch food at a cost to health and morale.', heavyAt(game))}</li>
      <li><strong>${t('Read what happened on the road.')}</strong> ${t('Each travel day has a diary page. After an encounter, its outcome shows the actual changes to the caravan.')}</li>
      <li><strong>${t('Make the call.')}</strong> ${t('Every stop before the city brings an encounter. Options show what you stand to spend and gain. The journal records the outcome.')}</li>
      <li><strong>${t('Make camp and trade.')}</strong> ${t('Cook, forage, treat injuries, or outfit the wagon at camp. Settlements sell supplies, and some offer recruits. Assign crew duties in camp. Perks require at least 40 health and 35 morale.')}</li>
      <li><strong>${t('Treat injuries or swap duties.')}</strong> ${t('An injured traveler loses their duty perk. Medicine clears the injury, a rest day counts as two recovery days, and travel counts as one per day.')}</li>
      <li><strong>${t('Read the weather.')}</strong> ${t('On the longer routes, the departure forecast shows what weather adds to this leg. The forecast can change when a camp action advances time.')}</li>
      <li><strong>${t('Give the crew time together.')}</strong> ${t('Under Relationships at camp, two travelers can share a watch. A strong bond protects morale on the road.')}</li>
      <li><strong>${t('Reach the Last City.')}</strong> ${t('The expedition ends if the wagon breaks or the last traveler dies.')}</li></ol>`;
  } else if (openDialog === 'camp') {
    title = here(game).name;
    kicker = 'CAMP MANAGEMENT';
    body = campView(game, campTab, campNote);
  } else if (openDialog === 'market') {
    title = here(game).name;
    kicker = 'SETTLEMENT MARKET';
    body = marketView(game, campNote);
  } else if (openDialog === 'day' && reading) {
    const { indices, position, returnTo } = reading;
    const page = game.chronicle[indices[position]];
    kicker = 'Road diary';
    const final = position === indices.length - 1;
    const nextLabel = final
      ? returnTo === 'camp'
        ? 'Return to camp'
        : game.status !== 'travel'
          ? 'View expedition results'
          : game.pending
            ? 'Face the encounter'
            : letterPending(game)
              ? 'Read Tomas’s letter'
              : 'Return to the map'
      : 'Next page';
    body = `${dayView(page)}<div class="day-nav">
      ${button(t('Previous page'), 'day-back', disabled(position === 0))}
      ${dayTrack(
        indices.map((index) => game.chronicle[index]),
        position,
      )}
      ${button(t(nextLabel) + ' ' + icon('arrow', 18), 'day-next', '', 'primary')}</div>`;
  } else if (openDialog === 'letter' && letterPending(game)) {
    title = letterTitle;
    kicker = t('ROAD ENCOUNTER / DAY {0}', game.day);
    body = `${comicView('lina-letter', t(letterNarrative(game)), here(game).region, Boolean(game.crew.find((member) => member.id === 'tomas' && member.health)))}
      <div class="choices comic-choices">${Object.entries(letterChoices(game))
        .map(([id, choice]) => {
          const preview = effect({
            label: choice.label,
            result: choice.text,
            supplies: { food: -choice.food },
            morale: choice.morale,
            target:
              choice.scope === 'Tomas'
                ? game.crew.findIndex((member) => member.id === 'tomas')
                : undefined,
          });
          return actionRow(
            t(choice.label),
            preview,
            'letter-choice',
            id,
            game.supplies.food < choice.food,
          );
        })
        .join('')}</div>`;
  } else if (openDialog === 'event') {
    const event = pendingEvent(game);
    if (!event) return '';
    title = event.title;
    kicker = t('ROAD ENCOUNTER / DAY {0}', game.day);
    const story = t(event.narrative);
    const narrative = story.split(/(?<=[.!?؟])\s/)[0];
    body = `${comicView(event.id, game.crew.every((m) => m.health) ? story : narrative, here(game).region)}
      <div class="choices comic-choices">${event.choices
        .map((c, i) => {
          const choice = encounterEffect(game, c);
          let label = t(c.label);
          if (c.target !== undefined && choice.target !== undefined && c.target !== choice.target) {
            label = label.replace(
              t(memberName(game, c.target).split(' ')[0]),
              t(memberName(game, choice.target).split(' ')[0]),
            );
          }
          return actionRow(
            label,
            effect(choice),
            'resolve',
            String(i),
            !canAfford(game, choice.supplies),
          );
        })
        .join('')}</div>`;
  } else if (openDialog === 'camp-talk' && talkingTo) {
    const conversation = availableCampStories(game).find((story) => story.id === talkingTo);
    if (!conversation) return '';
    title = conversation.title;
    kicker = 'Camp conversation';
    body = `${comicView(conversation.id, t(conversation.narrative), here(game).region)}
      <div class="choices comic-choices">${conversation.choices
        .map((_, index) => {
          const choice = campStoryChoice(game, conversation.id, index)!;
          const marker = choice.markRoad
            ? `<span class="gain">${t('Up to 3 less wagon wear on the next leg')}</span>`
            : '';
          return actionRow(
            t(choice.label),
            effect(choice) + marker,
            'talk-choice',
            String(index),
            !canAfford(game, choice.supplies),
          );
        })
        .join(
          '',
        )}</div><div class="comic-back">${button(t('Return to camp'), 'back-to-camp')}</div>`;
  } else if (openDialog === 'result') {
    title = game.status === 'won' ? 'The Last City' : 'Journey’s End';
    kicker = game.status === 'won' ? 'EXPEDITION SURVIVED' : 'EXPEDITION LOST';
    const ending = letterEnding(game);
    const epilogue = ending
      ? t(ending.text, ending.bearer === undefined ? '' : t(memberName(game, ending.bearer)))
      : '';
    body = `<p>${esc(t(game.reason))}</p>${epilogue ? `<div class="letter-epilogue"><span class="eyebrow">${t(letterTitle)}</span><p>${esc(epilogue)}</p></div>` : ''}<div class="result-stats"><div><strong><bdi>${digits(alive(game))}/${digits(game.crew.length)}</bdi></strong><span>${t('Travelers alive')}</span></div><div><strong>${digits(game.day)}</strong><span>${t('Expedition day')}</span></div><div><strong>${percent(game.wagon)}</strong><span>${t('Wagon condition')}</span></div></div>
      ${rollCallView(game)}
      <p class="result-path">${game.path.map((id) => t(gameWorld(game).nodes.find((n) => n.id === id)!.name)).join(' ' + arrow() + ' ')}</p>${button(t('Start another expedition') + ' ' + icon('arrow', 18), 'new', '', 'primary')}`;
  }
  return `<dialog class="dialog-${openDialog}" aria-labelledby="dialog-title"><div class="dialog-shell"><div class="dialog-top"><span class="eyebrow">${t(kicker)}</span>${button(icon('cross', 22), 'close', 'aria-label="' + t('Close dialog') + '"', 'icon-btn')}</div>${openDialog === 'day' ? '' : `<h2 id="dialog-title">${esc(t(title))}</h2>`}${body}</div></dialog>`;
}
function render() {
  useLanguage(profile.settings.language);
  document.documentElement.lang = profile.settings.language;
  document.documentElement.dir = isPersian() ? 'rtl' : 'ltr';
  document.title = t('The Last Caravan');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      'content',
      t(
        'Lead four travelers across a dying kingdom. A survival strategy game of hard roads and scarce supplies.',
      ),
    );

  if (isPersian()) enablePeyda();
  const focus =
    document.activeElement instanceof HTMLButtonElement ? document.activeElement.dataset : null;
  const oldScroll = app.querySelector('.map-scroll')?.scrollLeft ?? 0;
  const oldDialog = app.querySelector('dialog');
  const oldDialogScroll = oldDialog?.classList.contains('dialog-' + openDialog)
    ? oldDialog.scrollTop
    : 0;
  const openNotes = [...app.querySelectorAll<HTMLDetailsElement>('.chronicle-list details')].map(
    (entry) => entry.open,
  );
  const oldStage = app.querySelector<HTMLElement>('.camp-stage');
  const animate =
    profile.settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const members = game.crew.filter((m) => m.health > 0).map((m) => m.id);
  const nextScene =
    openDialog === 'camp' ? JSON.stringify([game.current, members, game.wagon > 35, animate]) : '';
  const keepScene = oldStage && sceneKey === nextScene;
  if (!keepScene) {
    disposeScene?.();
    disposeScene = undefined;
  }
  sceneKey = nextScene;
  app.innerHTML = header() + main() + dialog();
  const notes = app.querySelectorAll<HTMLDetailsElement>('.chronicle-list details');
  if (notes.length === openNotes.length)
    notes.forEach((entry, i) => {
      entry.open = openNotes[i];
    });
  if (keepScene) app.querySelector('.camp-stage')?.replaceWith(oldStage);
  app.querySelector('.map-scroll')?.scrollTo(oldScroll, 0);
  const mapScroll = app.querySelector<HTMLElement>('.map-scroll');
  const current = app.querySelector<HTMLElement>('.node.current');
  if (mapScroll && current && mapScroll.scrollWidth > mapScroll.clientWidth) {
    const x = current.offsetLeft,
      left = mapScroll.scrollLeft,
      width = mapScroll.clientWidth;
    if (x < left + 35 || x > left + width - 55) mapScroll.scrollLeft = x - width / 2;
  }
  const modal = app.querySelector('dialog');
  if (modal) {
    modal.showModal();
    if (openDialog === 'camp' && !keepScene) {
      const stage = modal.querySelector<HTMLElement>('.camp-stage')!;
      const canvas = stage.querySelector('canvas')!;
      const status = stage.querySelector<HTMLElement>('.camp-render-status')!;
      const options = { region: here(game).region, members, condition: game.wagon, animate };
      void import('./camp-scene.ts')
        .then(({ mountCamp }) => {
          if (!stage.isConnected || sceneKey !== nextScene) return;
          disposeScene = mountCamp(canvas, options);
          status.hidden = true;
        })
        .catch(() => {
          if (!stage.isConnected) return;
          canvas.hidden = true;
          status.textContent = t('Campsite illustration · 3D unavailable on this device');
        });
    }
    modal.scrollTop = oldDialogScroll;
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      openDialog = null;
      render();
    });
  }
  audio.configure(profile.settings, here(game).region, openDialog === 'camp');
  if (focus?.act) {
    const scope = modal ?? app;
    const replacement = [...scope.querySelectorAll<HTMLButtonElement>('[data-act]')].find(
      (el) => el.dataset.act === focus.act && el.dataset.id === focus.id && !el.disabled,
    );
    replacement?.focus({ preventScroll: true });
  }
}
function campAction(next: Game) {
  if (next === game) return;
  const spentDay = next.day > game.day;
  campNote = next.log[0].text;
  setGame(next);
  audio.cue('camp');
  if (spentDay) readDays([game.chronicle.length - 1], 'camp');
}
function endCue() {
  audio.cue(game.status === 'won' ? 'win' : 'loss');
}
app.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
  if (!el || el.disabled) return;
  const { act, id } = el.dataset;
  audio.configure(profile.settings, here(game).region, openDialog === 'camp', true);
  switch (act) {
    case 'nav':
      activeTab = id!;
      render();
      document.getElementById(id!)?.scrollIntoView({ behavior: 'smooth' });
      return;
    case 'language':
      profile.settings.language = isPersian() ? 'en' : 'fa';
      save();
      break;
    case 'select':
      choose(id!);
      break;
    case 'inspect':
      inspected = inspected === Number(id) ? null : Number(id);
      break;
    case 'travel': {
      roadNote = '';
      const next = travel(game, id!);
      if (next === game) return;
      setGame(next);
      if (game.status === 'travel') audio.cue('travel');
      else endCue();
      selected = routes(game)[0]?.id ?? game.current;
      readDays(pagesForLeg(game));
      break;
    }
    case 'resolve': {
      const choice = pendingEvent(game)?.choices[Number(id)];
      const next = resolve(game, Number(id));
      if (next === game) return;
      if (choice) roadNote = option(game, choice).result;
      setGame(next);
      if (game.status === 'travel') audio.cue('resolve');
      else endCue();
      readDays([game.chronicle.length - 1]);
      break;
    }
    case 'letter-choice': {
      if (id !== 'finish' && id !== 'keep') return;
      const next = decideLetter(game, id);
      if (next === game) return;
      setGame(next);
      audio.cue('resolve');
      readDays([game.chronicle.length - 1]);
      break;
    }
    case 'latest-diary':
      readDays(pagesForLeg(game));
      break;
    case 'day-jump': {
      const position = Number(id);
      if (
        reading &&
        Number.isInteger(position) &&
        position >= 0 &&
        position < reading.indices.length
      )
        reading.position = position;
      break;
    }
    case 'day-back':
      if (reading && reading.position > 0) reading.position--;
      break;
    case 'day-next':
      if (!reading) return;
      if (reading.position + 1 < reading.indices.length) reading.position++;
      else {
        openDialog = reading.returnTo === 'camp' ? 'camp' : nextRoadDialog();
        reading = null;
      }
      break;
    case 'trade':
      campAction(trade(game, id!));
      break;
    case 'recruit':
      campAction(recruit(game));
      break;
    case 'repair':
      campAction(repair(game));
      break;
    case 'rest':
      campAction(rest(game));
      break;
    case 'cook':
      campAction(cook(game));
      break;
    case 'forage':
      campAction(forage(game));
      break;
    case 'treat':
      campAction(treat(game, Number(id)));
      break;
    case 'install':
      campAction(install(game, id as Upgrade));
      break;
    case 'watch': {
      const [first, second] = (id ?? '').split('-').map(Number);
      campAction(shareWatch(game, first, second));
      break;
    }
    case 'export-save': {
      const url = URL.createObjectURL(
        new Blob([exportProgress(game, profile)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'the-last-caravan-save.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    case 'settings':
      backupNote = '';
      openDialog = act;
      break;
    case 'open-talk':
      if (!availableCampStories(game).some((story) => story.id === id)) return;
      talkingTo = id!;
      openDialog = 'camp-talk';
      break;
    case 'talk-choice': {
      if (!talkingTo) return;
      const next = resolveCampStory(game, talkingTo, Number(id));
      if (next === game) return;
      setGame(next);
      talkingTo = null;
      campNote = '';
      audio.cue('camp');
      readDays([game.chronicle.length - 1], 'camp');
      break;
    }
    case 'back-to-camp':
      talkingTo = null;
      openDialog = 'camp';
      break;
    case 'camp-tab':
      campTab = id as CampTab;
      campNote = '';
      break;
    case 'camp':
      campTab = 'supplies';
      campNote = '';
      openDialog = act;
      break;
    case 'market':
      campNote = '';
      openDialog = act;
      break;
    case 'replay':
      replay = profile.records[Number(id)];
      openDialog = 'new';
      break;
    case 'new':
      replay = undefined;
      openDialog = 'new';
      break;
    case 'event':
    case 'letter':
    case 'result':
    case 'guide':
    case 'records':
      openDialog = act;
      break;
    case 'close':
      openDialog = null;
      break;
    default:
      return;
  }
  render();
});
app.addEventListener('submit', async (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id === 'backup-form') {
    e.preventDefault();
    const file = new FormData(form).get('backup');
    let imported = null;
    if (file instanceof File && file.size <= backupLimit) {
      try {
        imported = importProgress(await file.text());
      } catch {}
    }
    if (!form.isConnected || openDialog !== 'settings') return;
    if (imported) {
      game = imported.game;
      profile = recordRun(imported.profile, game);
      selected = routes(game)[0]?.id ?? game.current;
      inspected = null;
      roadNote = '';
      campNote = '';
      replay = undefined;
      reading = null;
      save();
    }
    backupNote = imported
      ? 'Progress imported.'
      : 'The selected file is not a valid Caravan backup.';
    render();
    return;
  }
  if (form.id !== 'new-form') return;
  e.preventDefault();
  const data = new FormData(e.target as HTMLFormElement);
  const seed =
    String(data.get('seed')).trim() ||
    'Road-' + crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
  const outfit = String(data.get('outfit')) as Outfit;
  if (!outfitsOpen(profile).includes(outfit)) return;
  const mode = journeyModes.find((route) => route.id === data.get('mode'))?.id ?? 'far';
  const sameSeed = replay?.seed === seed;
  const opening = sameSeed && mode === 'far' ? (replay?.opening ?? undefined) : undefined;
  setGame(
    newGame(
      seed,
      outfit,
      runId(),
      Boolean(replay?.classic && sameSeed && mode === 'standard'),
      mode,
      opening,
      sameSeed && replay?.mode === mode ? replay.expandedEncounters : true,
    ),
  );
  selected = routes(game)[0].id;
  openDialog = null;
  inspected = null;
  reading = null;
  roadNote = '';
  campNote = '';
  activeTab = 'map';
  render();
  document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' });
});
app.addEventListener('change', (e) => {
  const control = e.target as HTMLInputElement | HTMLSelectElement;
  if (control.id === 'rations') {
    setGame(setRations(game, control.value === 'lean' ? 'lean' : 'normal'));
    render();
    app.querySelector<HTMLElement>('#rations')?.focus({ preventScroll: true });
  } else if (control.dataset.duty !== undefined) {
    campAction(assign(game, Number(control.dataset.duty), control.value as Role));
    render();
    app.querySelector<HTMLElement>('#duty-' + control.dataset.duty)?.focus({ preventScroll: true });
  } else if (control instanceof HTMLInputElement && control.id === 'backup-file') {
    const name = app.querySelector('#backup-name');
    if (name) name.textContent = control.files?.[0]?.name ?? t('No file chosen');
  } else if (control.dataset.setting === 'language') {
    profile.settings.language = control.value === 'fa' ? 'fa' : 'en';
    save();
    render();
    app.querySelector<HTMLElement>('[data-setting="language"]')?.focus({ preventScroll: true });
  } else if (control.id === 'journey-mode') {
    const detail = journeyModes.find((m) => m.id === control.value)?.detail ?? '';
    app.querySelector('#mode-info')!.textContent = t(detail);
  } else if (control.id === 'outfit') {
    const detail = outfits.find((o) => o.id === control.value)?.detail ?? '';
    app.querySelector('#outfit-info')!.textContent = t(detail);
  } else if (
    control instanceof HTMLInputElement &&
    (control.dataset.setting === 'sound' || control.dataset.setting === 'motion')
  ) {
    profile.settings[control.dataset.setting] = control.checked;
    save();
    audio.configure(profile.settings, here(game).region, openDialog === 'camp', true);
  }
});
app.addEventListener('input', (e) => {
  const control = e.target as HTMLInputElement;
  if (control.dataset.setting !== 'volume') return;
  profile.settings.volume = control.valueAsNumber;
  const label = app.querySelector('#volume-label');
  if (label) label.textContent = percent(control.valueAsNumber);
  save();
  audio.configure(profile.settings, here(game).region, openDialog === 'camp', true);
});
render();
