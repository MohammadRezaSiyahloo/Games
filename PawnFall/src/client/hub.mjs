import { CURSES, ROLES, curseById, roleById } from '../shared/run-options.mjs';
import { BESTIARY, bestiaryEntries } from '../shared/bestiary.mjs';
import { BOSS_RELICS, unlockedRelic, relicById } from '../shared/boss-relics.mjs';
import { PIECES } from '../shared/piece-abilities.mjs';
import { requiredPlays } from '../shared/loadout-unlocks.mjs';
import { WEAPONS } from '../shared/arsenal.mjs';
import { CHAPTERS, SKINS, ACHIEVEMENTS, TITLES } from '../shared/content.mjs';

export function createHub(progress, hooks) {
  const $ = (s) => document.querySelector(s);
  let tab = 'campaign',
    chapter = 0,
    mode = 'coop',
    searchGeneration = 0,
    searching = false,
    bestiarySelected = null;

  function show(next = 'campaign') {
    if (
      !['campaign', 'multiplayer', 'armory', 'honors', 'training', 'settings', 'bestiary'].includes(
        next,
      )
    )
      next = 'campaign';
    hooks.beforeShow?.();
    tab = next;
    document.querySelector('.hub').dataset.screen = next;
    $('#campaignSetup').open = false;
    $('#runOutcome').hidden =
      !['campaign', 'multiplayer'].includes(next) ||
      ($('#runChronicle').hidden && $('#deathRecap').hidden);
    $('#moreMenuToggle').classList.toggle(
      'active',
      ['training', 'bestiary', 'honors'].includes(next),
    );
    if (next !== 'campaign')
      for (const id of ['advancedRun', 'challengeMenu']) $('#' + id).open = false;
    const more = $('#moreMenu');
    if (more?.open) {
      more.open = false;
      $('#moreMenuToggle').focus({ preventScroll: true });
    }
    if (next === 'bestiary') {
      bestiarySelected = null;
      $('#bestiarySearch').value = '';
      $('#bestiaryFilter').value = 'all';
    }
    document
      .querySelectorAll('[data-tab]')
      .forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === next);
        if (b.dataset.tab === next) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
    for (let id of [
      'campaign',
      'multiplayer',
      'armory',
      'honors',
      'training',
      'settings',
      'bestiary',
    ])
      $('#panel-' + id).hidden = id !== next;
    render();
    const content = $('#hubContent');
    if (content) content.scrollTop = 0;
    $('#panel-' + next).scrollTop = 0;
    hooks.shown?.(next);
  }

  function renderBestiary() {
    const known = new Set(progress.data.encountered || []),
      entries = bestiaryEntries(
        [...known],
        $('#bestiaryFilter').value || 'all',
        $('#bestiarySearch').value || '',
      );
    $('#bestiaryCount').textContent = known.size + ' / ' + BESTIARY.length + ' encountered';
    $('#bestiaryGrid').innerHTML = entries
      .map(
        (e) =>
          `<button type="button" data-beast="${e.id}" ${known.has(e.id) ? '' : 'disabled'} class="bestiaryCard ${known.has(e.id) ? '' : 'undiscovered'}"><span>${known.has(e.id) ? e.symbol : '?'}</span><small>${e.group.toUpperCase()}</small><b>${known.has(e.id) ? e.name : 'Undiscovered'}</b><em>${known.has(e.id) ? 'Read moves and counters →' : 'Encounter this enemy in battle'}</em></button>`,
      )
      .join('');
    $('#bestiaryEmpty').hidden = entries.length > 0;
    document.querySelectorAll('[data-beast]').forEach(
      (b) =>
        (b.onclick = () => {
          if (!known.has(b.dataset.beast)) return;
          bestiarySelected = b.dataset.beast;
          renderBestiary();
          $('#bestiaryDetail').focus({ preventScroll: false });
        }),
    );
    const entry = entries.find((e) => e.id === bestiarySelected && known.has(e.id));
    $('#bestiaryDetail').hidden = !entry;
    if (entry) {
      $('#bestiaryName').textContent = entry.symbol + ' ' + entry.name;
      $('#bestiaryAttacks').textContent = entry.attacks;
      $('#bestiaryCounter').textContent = entry.counter;
    }
  }

  function closeBestiary() {
    const selected = bestiarySelected;
    bestiarySelected = null;
    renderBestiary();
    document.querySelector('[data-beast="' + selected + '"]')?.focus();
  }
  document.addEventListener('pointerdown', (e) => {
    const more = $('#moreMenu');
    if (more.open && !more.contains(e.target)) more.open = false;
  });
  $('#bestiarySearch').oninput = $('#bestiaryFilter').onchange = renderBestiary;
  $('#clearBestiaryFilter').onclick = () => {
    $('#bestiarySearch').value = '';
    $('#bestiaryFilter').value = 'all';
    bestiarySelected = null;
    renderBestiary();
  };
  $('#closeBestiaryDetail').onclick = closeBestiary;

  function render() {
    const p = progress.data;
    $('#curseSelect').value = curseById(p.curse).id;
    $('#roleSelect').value = roleById(p.coopRole).id;
    $('#curseDetail').textContent = curseById(p.curse).text;
    $('#roleDetail').textContent = roleById(p.coopRole).text;
    renderBestiary();
    $('#profileTitle').textContent = TITLES.find((t) => t.id === p.title)?.name || 'Wanderer';
    $('#careerStats').innerHTML =
      `<span><b>${p.completed.length}/4</b> REALMS CONQUERED</span><span><b>${p.stats.kills}</b> ENEMIES FELLED</span><span><b>${p.stats.souls.toLocaleString()}</b> SOULS CLAIMED</span>`;
    $('#chapters').innerHTML = CHAPTERS.map(
      (c, i) =>
        `<button class="chapterCard ${i === chapter ? 'selected' : ''}" style="--realm:${c.fog}" data-chapter="${i}"><small>CHAPTER ${['I', 'II', 'III', 'IV'][i]}</small><span>${['♜', '♝', '♞', '♛'][i]}</span><b>${c.name}</b><p>${c.subtitle}</p><i>${p.completed.includes(c.id) ? '✓ CONQUERED' : '5 ENCOUNTERS · ' + ['STANDARD', 'HARDENED', 'VETERAN', 'NIGHTMARE'][i]}</i></button>`,
    ).join('');
    document.querySelectorAll('[data-chapter]').forEach(
      (b) =>
        (b.onclick = () => {
          chapter = +b.dataset.chapter;
          hooks.chapter(chapter);
          render();
        }),
    );
    $('#relicSelect').innerHTML = BOSS_RELICS.filter((r) => unlockedRelic(r.id, p.stats) === r.id)
      .map((r) => `<option value="${r.id}">${r.name}</option>`)
      .join('');
    $('#relicSelect').value = unlockedRelic(p.bossRelic, p.stats);
    $('#relicDetail').textContent = relicById($('#relicSelect').value).text;
    const plays = p.stats.finishedPlays;
    for (const [slot, selector, items, label] of loadoutFields) {
      const select = $(selector);
      select.innerHTML = items
        .map((item) => {
          const goal = requiredPlays(slot, item.id);
          const locked = plays < goal;
          const requirement = locked ? ' · Locked (' + plays + '/' + goal + ' plays)' : '';
          return `<option value="${item.id}" ${locked ? 'disabled' : ''}>${label(item)}${requirement}</option>`;
        })
        .join('');
      select.value = p[slot];
    }
    $('#pieceDetail').textContent = PIECES.find((c) => c.id === p.chessClass)?.text || '';
    $('#weaponDetail').textContent = WEAPONS.find((w) => w.id === p.weapon)?.text || '';
    $('#skins').innerHTML = SKINS.map((s) => {
      let unlocked = !s.unlock || p.unlocked.includes(s.unlock),
        equipped = p.skin === s.id;
      return `<div class="skinCard ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}"><span class="skinPiece" style="--skin:${s.color}">♟</span><b>${s.name}</b><small>${s.tag}</small><button data-skin="${s.id}" ${!unlocked || equipped ? 'disabled' : ''}>${equipped ? '✓ EQUIPPED' : unlocked ? 'EQUIP' : 'LOCKED'}</button></div>`;
    }).join('');
    document.querySelectorAll('[data-skin]').forEach(
      (b) =>
        (b.onclick = () => {
          if (progress.equip(b.dataset.skin)) {
            hooks.skin();
            render();
          }
        }),
    );
    $('#honorCount').textContent = p.unlocked.length + ' / ' + ACHIEVEMENTS.length;
    $('#honors').innerHTML = ACHIEVEMENTS.map((a) => {
      const unlocked = p.unlocked.includes(a.id),
        v = a.key === 'chapters' ? p.completed.length : p.stats[a.key] || 0;
      return `<article class="honorCard ${unlocked ? 'unlocked' : ''}"><span>${unlocked ? '✦' : '◇'}</span><h3>${a.name}</h3><p>${a.text}</p><div class="progressbar"><i style="width:${Math.min(100, (100 * v) / a.goal)}%"></i></div><small>${unlocked ? '✓ COMPLETED' : Math.min(v, a.goal).toLocaleString() + ' / ' + a.goal.toLocaleString()}</small><div class="reward">REWARD · ${a.reward}</div></article>`;
    }).join('');
    $('#titleSelect').innerHTML = TITLES.filter((t) => !t.unlock || p.unlocked.includes(t.unlock))
      .map(
        (t) => `<option value="${t.id}" ${p.title === t.id ? 'selected' : ''}>${t.name}</option>`,
      )
      .join('');
    $('#titleSelect').onchange = (e) => progress.equipTitle(e.target.value);
  }

  function busy(value) {
    searching = !!value;
    document.querySelectorAll('[data-mode]').forEach((b) => (b.disabled = value));
    $('#displayName').disabled = value;
    $('#roomCode').disabled = value;
    for (let id of ['findMatch', 'privateMatch', 'joinMatch', 'versusFormat', 'coopDifficulty'])
      $('#' + id).disabled = value;
    $('#queueState').hidden = !value;
  }

  function queue(s) {
    busy(true);
    $('#queueTitle').textContent =
      s.mode === 'coop' ? 'Waiting for an ally…' : 'Finding a worthy rival…';
    $('#queueDetail').textContent = s.code?.startsWith('P')
      ? 'Share this code with a friend who has access to this site.'
      : 'Keep this screen open. The next player in this mode will join you.';
    $('#queueCode').textContent = s.code || '';
  }

  function find(options = {}) {
    const attempt = ++searchGeneration;
    progress.data.name =
      $('#displayName')
        .value.replace(/[<>\x00-\x1f]/g, '')
        .trim()
        .slice(0, 24) || 'Wanderer';
    progress.save();
    busy(true);
    $('#queueTitle').textContent = 'Connecting to the arena…';
    $('#queueDetail').textContent = 'Opening matchmaking';
    $('#queueCode').textContent = '';
    hooks
      .match(mode, {
        ...options,
        bestOf: Number($('#versusFormat').value) === 3 ? 3 : 1,
        difficulty: $('#coopDifficulty').value || 'standard',
      })
      .catch((e) => {
        if (attempt !== searchGeneration) return;
        busy(false);
        $('#networkNotice').textContent = e.message;
      });
  }
  document.querySelectorAll('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        hooks.navigate?.(b.dataset.tab);
        show(b.dataset.tab);
      }),
  );
  document.querySelectorAll('[data-mode]').forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        document
          .querySelectorAll('[data-mode]')
          .forEach((a) => a.classList.toggle('active', a === b));
      }),
  );
  for (const [id, items, key] of [
    ['curseSelect', CURSES, 'curse'],
    ['roleSelect', ROLES, 'coopRole'],
  ]) {
    $('#' + id).innerHTML = items.map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
    $('#' + id).onchange = (e) => {
      progress.data[key] = e.target.value;
      progress.save();
      render();
    };
  }
  const loadoutFields = [
    [
      'chessClass',
      '#pieceSelect',
      PIECES,
      (piece) => piece.symbol + ' ' + piece.name + ' · ' + piece.ability,
    ],
    [
      'weapon',
      '#weaponSelect',
      [...WEAPONS].sort((a, b) => requiredPlays('weapon', a.id) - requiredPlays('weapon', b.id)),
      (weapon) => weapon.name,
    ],
  ];
  for (const [slot, selector] of loadoutFields)
    $(selector).onchange = (e) => {
      if (!progress.equipLoadout(slot, e.target.value)) $(selector).value = progress.data[slot];
    };
  $('#relicSelect').onchange = (e) => progress.equipRelic(e.target.value);
  $('#displayName').value = progress.data.name;
  $('#findMatch').onclick = () => find();
  $('#privateMatch').onclick = () => find({ private: true });
  $('#joinMatch').onclick = () => {
    const code = $('#roomCode').value.trim().toUpperCase();
    if (code.length !== 6) {
      $('#networkNotice').textContent = 'Enter the six-character room code.';
      return;
    }
    find({ code });
  };
  $('#cancelMatch').onclick = () => {
    searchGeneration++;
    hooks.cancel();
    busy(false);
  };
  progress.changed = render;
  show();
  return {
    show,
    closeBestiary,
    selectChapter(n) {
      chapter = n;
      hooks.chapter(n);
      render();
    },
    render,
    queue,
    busy,
    invalidateSearch() {
      searchGeneration++;
      busy(false);
    },
    get searching() {
      return searching;
    },
    get tab() {
      return tab;
    },
  };
}
