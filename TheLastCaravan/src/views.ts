import { offers } from './content.ts';
import { outfits, rolePerks, roles, upgrades, upgradeSlots } from './expansion.ts';
import {
  alive,
  availableCampStories,
  canTrade,
  capacityFor,
  cargo,
  cookMorale,
  fit,
  forageYield,
  maxCrew,
  memberName,
  recruitOffer,
  repairGain,
  roleFit,
} from './game.ts';
import type { Game } from './game.ts';
import { bondLevel, journeyModes, maxBond } from './frontier.ts';
import { badges, outfitsOpen } from './profile.ts';
import type { Profile } from './profile.ts';
import { button, actionRow, changes, disabled, esc } from './markup.ts';
import { injuryLabel } from './injury-view.ts';
import { injuries } from './injuries.ts';
import { arrow, digits, journalText, percent, t } from './locale.ts';

export type CampTab = 'supplies' | 'workshop' | 'duties' | 'bonds' | 'talk';
const campTabs = ['supplies', 'workshop', 'duties', 'bonds', 'talk'] as const;
const campNames = {
  supplies: 'Camp actions',
  workshop: 'Workshop',
  duties: 'Crew duties',
  bonds: 'Relationships',
  talk: 'Talk by the fire',
};

const feedback = (note: string) =>
  note ? `<div class="camp-note" role="status">${esc(journalText(note))}</div>` : '';
function bondsView(g: Game) {
  const pairs = g.crew
    .flatMap((a, i) =>
      g.crew.flatMap((b, j) => {
        if (j <= i || !a.health || !b.health) return [];
        return [{ i, j, level: bondLevel(g, a.id, b.id) }];
      }),
    )
    .sort((a, b) => b.level - a.level);
  const watched = g.actions.includes('watch');
  return `<p class="camp-hint">${t('Bonded travelers steady each other in hardship. Losing a close companion costs morale.')}</p>
    <p class="camp-hint">${t(watched ? 'The crew has already shared a watch at this stop.' : 'Choose two travelers to share a watch. It costs 1 food and restores 5 morale to both.')}</p>
    <div class="choices">${
      pairs
        .map(({ i, j, level }) =>
          actionRow(
            t('{0} and {1}', t(memberName(g, i)), t(memberName(g, j))),
            t('Bond {0}/{1}', level, maxBond) +
              ' · ' +
              t(level >= maxBond ? 'Closest companions' : 'Share a watch'),
            'watch',
            i + '-' + j,
            watched || level >= maxBond || g.supplies.food < 1,
          ),
        )
        .join('') || `<p>${t('Two living travelers are needed to share a watch.')}</p>`
    }</div>`;
}
function conversationView(g: Game) {
  const stories = availableCampStories(g);
  if (!stories.length)
    return `<p class="camp-hint">${t('No one has more to say at this stop.')}</p>`;
  return `<p class="camp-hint">${t('Choose a conversation. You can have one at each stop.')}</p>
    <div class="choices">${stories
      .map((story) =>
        actionRow(
          t(story.title),
          t(
            memberName(
              g,
              g.crew.findIndex((m) => m.id === story.person),
            ),
          ) +
            ' · ' +
            t('Open conversation'),
          'open-talk',
          story.id,
          false,
        ),
      )
      .join('')}</div>`;
}
export function campView(g: Game, tab: CampTab, note: string) {
  const count = alive(g);
  const rested = g.actions.includes('rest');
  const cooked = g.actions.includes('cook');
  const foraged = g.actions.includes('forage');
  const forageCost = { water: -2, ...forageYield(g) };
  const full = g.upgrades.length >= upgradeSlots;
  const section =
    tab === 'supplies'
      ? `<div class="choices">
    ${actionRow(t('Repair the wagon'), t('2 materials · up to +{0} condition · currently {1}%', repairGain(g), g.wagon), 'repair', '', g.wagon === 100 || g.supplies.materials < 2)}
    ${actionRow(t('Cook a hot meal'), cooked ? t('Already cooked at this stop') : t('2 food · +4 health and +{0} morale each', cookMorale(g)), 'cook', '', cooked || g.supplies.food < 2)}
    ${actionRow(t('Forage nearby'), foraged ? t('Already foraged at this stop') : `${t('1 day')} · ${changes(forageCost)}`, 'forage', '', foraged || !canTrade(g, forageCost))}
    ${actionRow(t('Rest for a day'), rested ? t('Already rested at this stop') : t('1 day · {0} food and {1} water · +10 health and +9 morale each', count, count) + (g.crew.some((m) => m.injury) ? ' · ' + t('Two days of injury recovery') : ''), 'rest', '', rested || g.supplies.food < count || g.supplies.water < count)}
    ${g.crew.map((m, i) => actionRow(t('Treat {0}', t(memberName(g, i))), `${t('1 medicine')} · ${m.health ? t('{0}% health', m.health) + ' · ' + t('up to +{0} health', roleFit(g, 'Medic') ? 30 : 18) + (m.injury ? ' · ' + t('Clears {0}', t(injuries[m.injury.kind].name)) : '') : t('Fallen')}`, 'treat', String(i), g.supplies.medicine < 1 || !m.health || (m.health === 100 && !m.injury))).join('')}
    </div>`
      : tab === 'talk'
        ? conversationView(g)
        : tab === 'bonds'
          ? bondsView(g)
          : tab === 'workshop'
            ? `<p class="camp-hint">${t('{0} / {1} upgrade slots filled. Choose what this wagon will carry for the rest of the journey.', g.upgrades.length, upgradeSlots)}</p><div class="choices">${upgrades
                .map((u) => {
                  const installed = g.upgrades.includes(u.id);
                  const cost = installed
                    ? t('Installed')
                    : full
                      ? t('All upgrade slots filled')
                      : t('{0} materials and {1} coins', u.materials, u.coins);
                  return actionRow(
                    t(u.name),
                    `${cost} · ${t(u.detail)}`,
                    'install',
                    u.id,
                    installed ||
                      full ||
                      g.supplies.materials < u.materials ||
                      g.supplies.coins < u.coins,
                  );
                })
                .join('')}</div>`
            : `<p class="camp-hint">${t('Choosing an occupied duty swaps assignments. Perks require at least 40 health and 35 morale.')}</p><div class="duty-list">
      ${g.crew
        .map((m, i) => {
          const name = t(memberName(g, i));
          return `<div class="duty"><div><label for="duty-${i}">${name}</label><span>${m.health ? (m.injury ? injuryLabel(m.injury) : fit(g, i) ? t(rolePerks[m.role]) : t('Off duty · {0}% health, {1}% morale', m.health, m.morale)) : t('Fallen')}</span></div>
      <select id="duty-${i}" data-duty="${i}" aria-label="${t('Duty for {0}', name)}"${disabled(!m.health)}>${roles.map((role) => `<option value="${role}"${role === m.role ? ' selected' : ''}>${t(role)}</option>`).join('')}</select></div>`;
        })
        .join('')}</div>`;
  return `<div class="camp-layout"><div><div class="camp-stage" data-region="${g.current}" aria-label="${t('Isometric caravan campsite')}"><canvas aria-hidden="true"></canvas><span class="camp-render-status">${t('Lighting the campfire…')}</span></div>
    <div class="camp-ledger" aria-label="${t('Camp supplies')}">${Object.entries(g.supplies)
      .map(([key, amount]) => `<span>${digits(amount)} ${t(key)}</span>`)
      .join('')}</div></div>
    <div><div class="camp-tabs" aria-label="${t('Camp controls')}">${campTabs.map((id) => button(t(campNames[id]), 'camp-tab', `data-id="${id}" aria-pressed="${id === tab}"`, id === tab ? 'alt active' : 'alt')).join('')}</div>
    ${feedback(note)}${section}</div></div>`;
}
export function marketView(g: Game, note: string) {
  const candidate = recruitOffer(g);
  return `<p>${t('{0} coins on hand', g.supplies.coins)} · ${t('{0} / {1} cargo', cargo(g.supplies), capacityFor(g))}</p>${feedback(note)}<div class="choices">
  ${offers.map((o) => actionRow(t(o.label), changes(o.cost), 'trade', o.id, !canTrade(g, o.cost))).join('')}
  ${candidate ? actionRow(t('Recruit {0}', t(candidate.name)), `${t('{0} coins', candidate.price)} · ${t(candidate.role)} · ${t(candidate.perk)} ${t(alive(g) >= maxCrew ? 'The crew is full.' : 'Adds a traveler’s rations to every leg.')}`, 'recruit', '', g.supplies.coins < candidate.price || alive(g) >= maxCrew) : ''}
  </div>`;
}
export function setupView(g: Game, p: Profile, replay: Profile['records'][number] | undefined) {
  const unlocked = outfitsOpen(p);
  const mode = journeyModes.find((m) => m.id === replay?.mode) ?? journeyModes[0];
  const chosen =
    outfits.find((o) => o.id === replay?.outfit && unlocked.includes(o.id)) ?? outfits[0];
  return `<p>${t('Choose a seed to replay a route, or leave it blank to chart a new road.')}</p>
    ${g.log.length > 1 && g.status === 'travel' ? `<p class="warning">${t('Starting over replaces the expedition saved on this device.')}</p>` : ''}
    <form id="new-form"><label for="seed-input">${t('World seed')} <span>${t('optional')}</span></label>
      <input id="seed-input" name="seed" dir="auto" maxlength="32" value="${esc(replay?.seed ?? '')}" placeholder="${t('e.g. Hearth-01')}" autocomplete="off">
      <label for="journey-mode">${t('Expedition route')}</label><select id="journey-mode" name="mode">${journeyModes.map((m) => `<option value="${m.id}"${m.id === mode.id ? ' selected' : ''}>${t(m.name)}</option>`).join('')}</select>
      <p class="outfit-info" id="mode-info">${t(mode.detail)}</p>
      <label for="outfit">${t('Starting caravan')}</label><select id="outfit" name="outfit">${outfits.map((o) => `<option value="${o.id}"${o.id === chosen.id ? ' selected' : ''}${disabled(!unlocked.includes(o.id))}>${t(o.name)}${unlocked.includes(o.id) ? '' : ' · ' + t('Locked')}</option>`).join('')}</select>
      <p class="outfit-info" id="outfit-info">${t(chosen.detail)}</p>
      <button class="primary" type="submit">${t('Begin journey')} ${arrow()}</button></form>`;
}
export function recordsView(p: Profile) {
  return `<div class="result-stats"><div><strong>${digits(p.finished)}</strong><span>${t('Completed runs')}</span></div><div><strong>${digits(p.victories)}</strong><span>${t('Arrivals')}</span></div><div><strong><bdi>${digits(p.badges.length)}/${digits(badges.length)}</bdi></strong><span>${t('Achievements')}</span></div></div>
    <h3 class="subhead">${t('Achievements')}</h3><div class="badge-list">${badges.map((b) => `<article class="${p.badges.includes(b.id) ? 'earned' : ''}"><strong>${p.badges.includes(b.id) ? '◆' : '◇'} ${t(b.name)}</strong><span>${t(b.detail)}${'outfit' in b ? ' ' + t('Unlocks {0}.', t(outfits.find((o) => o.id === b.outfit)!.name)) : ''}</span></article>`).join('')}</div>
    <h3 class="subhead">${t('Recent expeditions')}</h3>${
      p.records.length
        ? `<div class="choices">${p.records
            .map((r, i) =>
              actionRow(
                `${t(r.status === 'won' ? 'Arrived' : 'Lost')} · ${t(journeyModes.find((m) => m.id === r.mode)?.name ?? 'The Road East')} · <bdi>${esc(r.seed)}</bdi>`,
                t(
                  'Day {0} · {1}/{2} alive · Wagon {3}% · Replay this seed',
                  r.day,
                  r.alive,
                  r.crew,
                  r.wagon,
                ),
                'replay',
                String(i),
                false,
              ),
            )
            .join('')}</div>`
        : `<p>${t('Your completed expeditions will appear here.')}</p>`
    }`;
}
export function settingsView(p: Profile, backupNote = '') {
  return `<div class="settings-list">
    <label><span><strong>${t('Language')}</strong><small>${t('Choose the language used throughout the game.')}</small></span><select data-setting="language" aria-label="${t('Language')}"><option value="en" lang="en"${p.settings.language === 'en' ? ' selected' : ''}>English</option><option value="fa" lang="fa"${p.settings.language === 'fa' ? ' selected' : ''}>فارسی</option></select></label>
    <label><span><strong>${t('Atmospheric audio')}</strong><small>${t('Regional wind, campfire, and action cues.')}</small></span><input type="checkbox" data-setting="sound"${p.settings.sound ? ' checked' : ''}></label>
    <label><span><strong>${t('Volume')}</strong><small id="volume-label">${percent(p.settings.volume)}</small></span><input type="range" min="0" max="100" value="${p.settings.volume}" data-setting="volume" aria-describedby="volume-label"></label>
    <label><span><strong>${t('Camp animation')}</strong><small>${t('Animate the campfire and the travelers at camp.')}</small></span><input type="checkbox" data-setting="motion"${p.settings.motion ? ' checked' : ''}></label></div>
    <h3 class="subhead">${t('Portable saves')}</h3><p>${t('Move this expedition, its records, and settings to another browser using a JSON file.')}</p>
    ${button(t('Export progress'), 'export-save')}
    <form id="backup-form">
      <span>${t('Import a saved expedition')}</span>
      <div class="backup-picker">
        <input id="backup-file" name="backup" type="file" accept=".json,application/json" aria-describedby="backup-name" required>
        <label class="secondary" for="backup-file">${t('Choose a backup file')}</label>
        <span id="backup-name" dir="auto">${t('No file chosen')}</span>
      </div>
      <p class="warning">${t('Importing replaces the expedition and records on this device.')}</p>
      <button class="secondary" type="submit">${t('Replace local progress')}</button>
    </form>${feedback(backupNote)}`;
}
