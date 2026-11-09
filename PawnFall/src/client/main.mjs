import { NoticeGate } from './hud-notices.mjs';
import { configureTutorial, tutorialEvent, TUTORIAL_STEPS } from '../shared/tutorial.mjs';
import { PerformanceTuner } from './performance-tuner.mjs';
import { EndlessRecords } from './endless-records.mjs';
import { bossPhaseLabel, bossCombatHint } from '../shared/boss-phases.mjs';
import { RunStore, restoreRun } from '../shared/run-save.mjs';
import { ROUTES, CHAMPIONS } from '../shared/routes.mjs';
import { bindMouseControls } from './mouse-controls.mjs';
import { restoreCheckpoint, captureCheckpoint } from '../shared/checkpoints.mjs';
import { CheckpointStore } from './checkpoint-store.mjs';
import { relicById } from '../shared/boss-relics.mjs';
import { GamepadInput, navigateGamepad, readGamepads } from './gamepad.mjs';
import { RUN_MODIFIERS } from '../shared/run-modifiers.mjs';
import { createCustomSelects } from './custom-select.mjs';
import { Preferences, keyLabel } from './preferences.mjs';
import { bindSettings } from './settings-ui.mjs';
import { difficultyById } from '../shared/combat-rules.mjs';
import { configureTraining, recordPractice } from '../shared/training.mjs';
import { LocalActionPresentation } from './local-action-presentation.mjs';
import {
  RemoteMotion,
  reconcileAvatar,
  interpolateAvatar,
  matchResult,
} from './multiplayer-presentation.mjs';
import { discoverEnemies } from '../shared/bestiary.mjs';
import { CombatAudio } from './combat-audio.mjs';
import { bindMobileControls } from './mobile-controls.mjs';
import { bindNavigation, backDestination } from './navigation.mjs';
import { eventInfo, eventCanChoose } from '../shared/encounter-events.mjs';
import { showChronicle, saveChronicleCard } from './run-chronicle.mjs';
import { chronicleText } from '../shared/run-chronicle.mjs';
import { PIECES, pieceById } from '../shared/piece-abilities.mjs';
import { bindCombatKeys, bindActionButtons } from './controls.mjs';
import * as THREE from '../../public/vendor/three.module.js';
import { weaponById, UPGRADES } from '../shared/arsenal.mjs';
import { Game, stats, titles, clamp, dist, angleLerp } from '../shared/combat.mjs';
import { CHAPTERS, SKINS, ACHIEVEMENTS, TITLES } from '../shared/content.mjs';
import { createVisuals } from './rendering.mjs';
import { Progression } from './progression.mjs';
import { NetworkClient } from './network.mjs';
import { createHub } from './hub.mjs';
const $ = (s) => document.querySelector(s),
  PI = Math.PI,
  TAU = PI * 2;
const preferences = new Preferences();
const performanceTuner = new PerformanceTuner(preferences);
const endlessRecords = new EndlessRecords();
const gamepad = new GamepadInput();
const checkpoints = new CheckpointStore();
const runs = new RunStore();
let padState = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, actions: [] };
let retryKind = null;
let lastChronicle = null;
const combatAudio = new CombatAudio(
  () => audio,
  () => preferences.data,
);
let mobileControls, joystickRelease;
let suspendedMode = null,
  settingsUI,
  helpOriginFocus = null,
  helpOpen = false;
const game = new Game(),
  keys = new Set(),
  progress = new Progression(),
  network = new NetworkClient(),
  remoteMotion = new RemoteMotion(),
  localActions = new LocalActionPresentation();
const view = {
  yaw: 0,
  pitch: 6.8,
  zoom: 10,
  shake: 0,
  renderTime: 0,
  announceUntil: 0,
  statusUntil: 0,
  preferences: preferences.data,
};
let customSelects,
  mouseControls,
  actionButtons,
  muted = !preferences.data.audioEnabled,
  ambience,
  audio,
  best = 0,
  lastStamp = 0,
  freezeHelp = false,
  guardTouch = false,
  stick = { x: 0, y: 0 },
  chapter = 0,
  online = false,
  onlineState = null,
  selectedMode = 'coop',
  syncAt = 0,
  awards = [],
  visuals,
  hub,
  awardUntil = 0,
  matchFinished = false,
  lastTheme = null,
  activeRoundKey = null,
  lobbyPhaseKey = null;
const awardedSeries = new Set();
let soundWindow = 0,
  soundSlots = 0;

function takeSoundSlot() {
  const now = performance.now();
  if (now - soundWindow >= 100) {
    soundWindow = now;
    soundSlots = 0;
  }
  return ++soundSlots <= 8;
}
try {
  best = +localStorage.getItem('pawnfall-3d-best') || 0;
} catch {}

function audioFx(kind) {
  if (muted || preferences.data.master === 0 || preferences.data.sfx === 0 || !takeSoundSlot())
    return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    let o = audio.createOscillator(),
      g = audio.createGain(),
      settings = {
        swing: [170, 0.14, 'sawtooth'],
        heavy: [110, 0.24, 'sawtooth'],
        hit: [78, 0.18, 'triangle'],
        hurt: [54, 0.26, 'sawtooth'],
        dodge: [230, 0.13, 'sine'],
        heal: [620, 0.5, 'sine'],
        block: [350, 0.12, 'square'],
        parry: [980, 0.28, 'triangle'],
        armor: [180, 0.09, 'square'],
        exposed: [120, 0.2, 'triangle'],
        posture: [70, 0.35, 'sawtooth'],
        wave: [220, 0.6, 'triangle'],
        cast: [710, 0.25, 'sine'],
      },
      [f, d, type] = settings[kind] || settings.hit;
    o.type = type;
    o.frequency.setValueAtTime(f, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(f * 0.3, audio.currentTime + d);
    g.gain.setValueAtTime(
      Math.max(0.0001, 0.055 * preferences.data.master * preferences.data.sfx),
      audio.currentTime,
    );
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + d);
  } catch {}
}

function impactSound(heavy = false) {
  if (muted || preferences.data.master === 0 || preferences.data.sfx === 0 || !takeSoundSlot())
    return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const duration = heavy ? 0.13 : 0.075,
      buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate),
      samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const source = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      gain = audio.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = heavy ? 780 : 2200;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(
      Math.max(0.0001, (heavy ? 0.12 : 0.075) * preferences.data.master * preferences.data.sfx),
      audio.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    source.start();
    audioFx(heavy ? 'hurt' : 'hit');
  } catch {}
}

function enableAudio() {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {}
}

function updateAmbience() {
  if (!audio) return;
  try {
    if (!ambience) {
      const gain = audio.createGain();
      gain.gain.value = 0;
      gain.connect(audio.destination);
      for (const frequency of [55, 82.4]) {
        const o = audio.createOscillator();
        o.type = 'sine';
        o.frequency.value = frequency;
        o.connect(gain);
        o.start();
      }
      ambience = gain;
    }
    const volume = muted
      ? 0
      : 0.012 *
        preferences.data.master *
        preferences.data.ambience *
        (game.mode === 'playing' ? 1 : 0.3);
    if (ambience.pawnfallVolume !== volume) {
      ambience.gain.setTargetAtTime(volume, audio.currentTime, 0.2);
      ambience.pawnfallVolume = volume;
    }
  } catch {}
}

function applyPreferences() {
  enableAudio();
  resetCombatInput();
  document.body.classList.toggle('reduced-effects', preferences.data.reducedEffects);
  if (preferences.data.reducedEffects) {
    view.shake = 0;
    view.hitPause = 0;
  }
  $('#sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  $('#bottomHint').innerHTML =
    `<span><kbd>${['w', 'a', 's', 'd'].map((k) => keyLabel(preferences.data.bindings[k])).join('')}</kbd> Move</span><span><kbd>${keyLabel(preferences.data.bindings.j)}</kbd> Attack</span><span><kbd>${keyLabel(preferences.data.bindings.k)}</kbd> Guard</span><span><kbd>${keyLabel(preferences.data.bindings[' '])}</kbd> Roll</span><span>MMB drag to orbit · Scroll to zoom</span>`;
  updateAmbience();
}

function startTutorial() {
  game.mode = 'ready';
  start();
  configureTutorial(game, stats);
  visuals.syncActors();
  announce('PLAYABLE TUTORIAL', 'Steel, stamina and timing');
}

function exitTutorial(campaign = false) {
  game.training = null;
  game.mode = 'ready';
  document.body.classList.remove('tutorial');
  if (campaign) {
    hub.show('campaign');
    start();
  } else showMenu('training');
}

function startTraining() {
  game.mode = 'ready';
  start();
  configureTraining(game, stats, {
    enemy: $('#trainingEnemy').value,
    behavior: $('#trainingBehavior').value,
    unlimited: $('#trainingUnlimited').checked,
  });
  visuals.syncActors();
  announce('TRAINING · NO PROGRESSION', 'Practice. Read. Respond.');
}

function readEndlessBest(difficulty = game.difficulty) {
  return endlessRecords.best(difficulty);
}

function startEndless() {
  game.mode = 'ready';
  start({ endless: true });
  announce('ENDLESS SOLO', 'Survive the endless court');
}

function startRush() {
  game.mode = 'ready';
  hub.selectChapter(0);
  start({ boss: true });
  game.startBossRush();
  retryKind.type = 'rush';
  processEvents();
  visuals.syncActors();
  announce('THREE CROWNS · TWO FLASKS', 'The boss rush begins');
}

function saveQuit() {
  if (online || game.training || game.mode !== 'paused') return;
  if (!runs.save(game, suspendedMode, view)) {
    status('Could not save. Your run is still paused.');
    return;
  }
  game.mode = 'ready';
  suspendedMode = null;
  resetCombatInput();
  showMenu('campaign');
  status('RUN SAVED · Continue from this exact moment');
}

function startBossChallenge(realm = 0, retry = null) {
  hub.selectChapter(realm);
  game.mode = 'ready';
  start({ ...(retry ? { retry } : {}), boss: true });
  retryKind = { ...retryKind, type: 'boss', realm };
  game.bossTrial = true;
  game.wave = 4;
  game.spawn();
  visuals.syncActors();
  processEvents();
  status(
    realm === 3
      ? 'Face the Fallen King and his doomed court'
      : realm === 1
        ? 'Defeat the Confessor to earn Pale Oracle'
        : 'Defeat the Castellan to earn Siegebreaker',
  );
}

const notices = new NoticeGate();

function announce(top, title) {
  if (!notices.accept(top + ' ' + title, view.renderTime, { priority: 2, duration: 2.6 })) return;
  $('#status').style.opacity = 0;
  $('#status').hidden = true;
  $('#announcement').hidden = false;
  view.statusUntil = 0;
  $('#announceSmall').textContent = top;
  $('#announceTitle').textContent = title;
  view.announceUntil = view.renderTime + 2.6;
  $('#announcement').style.opacity = '1';
}

function status(t) {
  const priority = /UNDER ATTACK|GUARD BROKEN|ALLY DOWN|Not enough stamina|Could not|cannot pause/i.test(t) ? 3 : 1;
  if (!notices.accept(t, view.renderTime, { priority, duration: 2.2 })) return;
  $('#announcement').style.opacity = 0;
  $('#announcement').hidden = true;
  $('#status').hidden = false;
  view.announceUntil = 0;
  $('#status').textContent = t;
  $('#status').style.opacity = 1;
  view.statusUntil = view.renderTime + 2.2;
}

function processEvents() {
  for (let ev of game.events) {
    combatAudio.event(
      ev,
      game,
      view.yaw,
      performance.now(),
      online ? 'p' + network.seat : 'player',
    );
    if (
      !online &&
      !game.training &&
      !game.bossTrial &&
      ['wave', 'upgradeChosen', 'promoted', 'eventChosen', 'intermissionComplete'].includes(
        ev.type,
      ) &&
      !game.eventChoices?.length &&
      !game.promotionChoices?.length &&
      !game.routeChoices?.length &&
      !game.upgradeChoices?.length &&
      game.mode === 'playing'
    ) {
      const c = captureCheckpoint(game);
      if (c) checkpoints.save(c);
    }
    if (game.training) {
      recordPractice(game, ev);
      tutorialEvent(game, ev);
    } else if (!ev.remote) progress.event(ev, CHAPTERS[chapter].id);
    switch (ev.type) {
      case 'tutorialStep':
        visuals.syncActors();
        status('LESSON COMPLETE');
        break;
      case 'tutorialComplete':
        preferences.set({ tutorialCompleted: true });
        announce('TUTORIAL COMPLETE', 'Your first court awaits');
        break;
      case 'endlessMilestone':
        if (game.endless) game.endless.pendingMilestone = ev.cleared;
        break;
      case 'autoBlessing':
        status(
          'BLESSING GRANTED · ' + (UPGRADES.find((u) => u.id === ev.upgrade)?.name || ev.upgrade),
        );
        break;
      case 'arenaShiftTell':
        // The contextual warning carries this cue while the ground telegraph remains visible.
        break;
      case 'arenaShiftImpact':
        visuals.spawnParticles(ev.x, ev.z, '#c7a182', 18);
        break;
      case 'secretRevealed':
        status('SECRET COURT · GOLD PORTAL IN THE FAR CORNER · HOLD INTERACT TO ENTER');
        break;
      case 'secretEntered':
        announce('OPTIONAL CHALLENGE', 'The Nameless Regent');
        visuals.syncActors();
        break;
      case 'secretCleared':
        status('SECRET COURT CLEARED · 350 SOULS + ONE FLASK');
        break;
      case 'rushStage':
        chapter = game.chapter;
        visuals.applyTheme(CHAPTERS[chapter]);
        visuals.syncActors();
        announce('BOSS RUSH · ' + ev.stage + ' / 3', CHAPTERS[chapter].name);
        break;
      case 'eventChosen':
        visuals.syncActors();
        break;
      case 'rivalRetreat':
        announce('SER VEYR RETREATS', 'He will remember how you fought.');
        break;
      case 'rivalDefeated':
        announce('RIVAL DEFEATED', 'Ser Veyr’s final stand.');
        break;
      case 'teamCombo':
        visuals.shockwave(ev.x, ev.z, true, ev.kind === 'ward' ? '#bce4ff' : '#ffd984');
        visuals.spawnParticles(ev.x, ev.z, '#ffe3a2', 28);
        status(
          ev.kind === 'ward'
            ? 'CASTLING ALLIANCE · BOTH ALLIES WARDED'
            : 'CROSSING JUDGEMENT · COMBINATION STRIKE',
        );
        audioFx('heavy');
        break;
      case 'royalSacrifice':
        visuals.spawnParticles(ev.x, ev.z, '#b73445', 45);
        status('THE KING SACRIFICES HIS COURT');
        break;
      case 'royalCommand':
        status('ROYAL EDICT · THE GUARDS ADVANCE');
        break;
      case 'promoted':
        visuals.syncActors();
        if (!online) visuals.applySkin(SKINS.find((s) => s.id === progress.data.skin) || SKINS[0]);
        if (!ev.remote) {
          announce(
            ev.piece === 'pawn'
              ? 'HOLD YOUR RANK'
              : 'PROMOTED TO ' + pieceById(ev.piece).name.toUpperCase(),
            pieceById(ev.piece).ability,
          );
          visuals.shockwave(game.player.x, game.player.z, true, '#e9c67c');
          audioFx('wave');
        }
        break;
      case 'arenaObjectiveComplete':
        status('ARENA GOAL COMPLETE · FINISH THE ENCOUNTER');
        audioFx('wave');
        break;
      case 'arenaObjectiveReward':
        status('ARENA GOAL CLAIMED · +' + ev.reward + ' SOULS');
        break;
      case 'sigilBroken':
        visuals.spawnParticles(ev.x, ev.z, '#d85d61', 24, 0.6);
        visuals.shockwave(ev.x, ev.z, false, '#f3c879');
        audioFx('cast');
        break;
      case 'kingHurt':
        if (ev.hp > 0) status('THE KING IS UNDER ATTACK · ' + Math.ceil(ev.hp) + ' VITALITY');
        break;
      case 'wave':
        if (game.endless) {
          chapter = game.chapter;
          visuals.applyTheme(CHAPTERS[chapter]);
          endlessRecords.record(game.difficulty, game.endless.cleared, game.time);
          game.endless.best = readEndlessBest();
        }
        visuals.syncActors();
        announce(
          game.endless
            ? 'ENDLESS · ENCOUNTER ' + game.endless.encounter
            : 'ENCOUNTER ' + ['I', 'II', 'III', 'IV', 'V', 'VI'][game.wave],
          ev.title,
        );
        audioFx('wave');
        break;
      case 'swing':
        audioFx(ev.heavy ? 'heavy' : 'swing');
        break;
      case 'heavyImpact':
        if (ev.weapon === 'warhammer') {
          visuals.shockwave(ev.x, ev.z, true, '#e3d5ac');
          impactSound(true);
        }
        break;
      case 'dodge':
        audioFx('dodge');
        break;
      case 'hurt':
        if (ev.id === 'player') {
          view.shake = 0.24;
          $('#hitFlash').style.opacity = '1';
          setTimeout(() => ($('#hitFlash').style.opacity = '0'), 170);
          audioFx('hurt');
        } else {
          view.shake = ev.armored ? 0.035 : 0.12;
          view.hitPause = ev.armored ? 0.018 : 0.055;
          visuals.spawnParticles(
            ev.x,
            ev.z,
            ev.armored ? '#b9a17d' : '#ffe0a0',
            ev.armored ? 10 : 24,
          );
          if (ev.armored) visuals.steelSparks(ev.x, ev.z);
          audioFx(ev.armored ? 'armor' : 'exposed');
        }
        break;
      case 'abilityTell':
        break;
      case 'abilityImpact':
        visuals.shockwave(ev.x, ev.z, true, ev.kind === 'bishop' ? '#c4ddff' : '#f7ecc2');
        visuals.spawnParticles(ev.x, ev.z, '#e9e4cf', 18);
        audioFx('cast');
        break;
      case 'steelImpact':
        visuals.steelSparks(ev.x, ev.z, ev.strength || 0.55, ev.nx, ev.nz, ev.y || 1.2);
        impactSound();
        break;
      case 'parry':
        visuals.react(ev.remote ? 'peer' : 'player', 'parry', ev);
        if (ev.attacker)
          visuals.react(
            ev.attacker === 'p' + network.seat
              ? 'player'
              : ev.attacker === 'p' + (1 - network.seat)
                ? 'peer'
                : ev.attacker,
            'stagger',
            ev,
          );
        visuals.steelSparks(ev.x, ev.z, 1.6, ev.nx, ev.nz);
        visuals.spawnParticles(ev.x, ev.z, '#b9eeff', 36, 1.3);
        visuals.shockwave(ev.x, ev.z, false, '#a6e7ff');
        audioFx('parry');
        view.shake = 0.14;
        view.hitPause = 0.07;
        status('PERFECT PARRY · RIPOSTE READY');
        break;
      case 'block':
        visuals.react(ev.remote ? 'peer' : 'player', 'block', ev);
        visuals.steelSparks(ev.x ?? game.player.x, ev.z ?? game.player.z, 1.1, ev.nx, ev.nz);
        visuals.spawnParticles(game.player.x, game.player.z, '#ffe3ac', 24, 1.3);
        audioFx('block');
        view.shake = 0.06;
        break;
      case 'objectiveComplete':
        status('BONUS OBJECTIVE COMPLETE · CLEAR TO CLAIM +' + ev.reward + ' SOULS');
        audioFx('wave');
        break;
      case 'routeReward':
        if (!ev.remote && ev.route !== 'sanctuary')
          status(
            ev.route === 'champion'
              ? 'CHAMPION ROUTE CLEARED · +200 SOULS · EXTRA BLESSING'
              : 'ONSLAUGHT CLEARED · +150 SOULS · +1 FLASK',
          );
        break;
      case 'objectiveReward':
        status('BONUS CLAIMED · +' + ev.reward + ' SOULS');
        break;
      case 'enemyBlock':
        visuals.react(ev.id, 'block', ev);
        audioFx('armor');
        break;
      case 'guardBreak':
        visuals.react(ev.id || (ev.remote ? 'peer' : 'player'), 'stagger', ev);
        status('GUARD BROKEN · RECOVER YOUR STAMINA');
        audioFx('posture');
        break;
      case 'squadTell':
        break;
      case 'hazardTell':
        audioFx('cast');
        break;
      case 'teamFinisher':
        visuals.finishMotion(ev.remote ? 'peer' : 'player', ev.id, true);
        visuals.finishMotion(ev.remote ? 'player' : 'peer', null, true);
        visuals.shockwave(ev.x, ev.z, true, '#d4e8ff');
        visuals.steelSparks(ev.x, ev.z, 1.3);
        status('TEAM FINISHER · +40 BASE DAMAGE');
        audioFx('heavy');
        break;
      case 'teamPing':
        break;
      case 'revived':
        status('ALLY REVIVED · BACK TO THE FIGHT');
        audioFx('heal');
        break;
      case 'downed':
        status('ALLY DOWN · HOLD REVIVE NEAR THEM');
        break;
      case 'kill':
        if (ev.boss || ev.elite) visuals.finishMotion(ev.remote ? 'peer' : 'player', ev.id);
        visuals.spawnParticles(ev.x, ev.z, '#fda953', 32);
        break;
      case 'heal':
        visuals.spawnParticles(game.player.x, game.player.z, '#bbd387', 30);
        visuals.shockwave(game.player.x, game.player.z, false, '#c2d488');
        audioFx('heal');
        status('+48 VITALITY');
        break;
      case 'slam':
        visuals.shockwave(ev.x, ev.z, ev.large);
        visuals.spawnParticles(ev.x, ev.z, '#ffb66d', ev.large ? 26 : 12, 0.2);
        view.shake = ev.boss ? 0.3 : 0.14;
        impactSound(!!ev.boss);
        break;
      case 'bossTell':
        if (ev.boss === 'fallenking') {
          status(
            ev.kind === 'edict'
              ? 'ROYAL EDICT · KILL THE BISHOP TO PREVENT ITS SACRIFICE'
              : ev.kind === 'royalCross'
                ? 'ROYAL CROSS · LEAVE BOTH MARKED LANES'
                : ev.kind === 'doubleSweep'
                  ? 'TWO SWORD SWEEPS · DODGE BOTH'
                  : 'ROYAL SWEEP · CLEAR THE GOLD RING',
          );
          break;
        }
        status(
          ev.boss === 'confessor'
            ? ev.kind === 'mirrors'
              ? 'MIRROR RITE · THE REAL BISHOP CASTS A SHADOW'
              : 'CROSSED BOLTS · WATCH THE GAPS'
            : ev.kind === 'charge'
              ? 'SIEGE CHARGE · LEAVE THE LANE'
              : ev.kind === 'cross'
                ? 'CROSS-BOARD STRIKE · CLEAR BOTH LANES'
                : 'HAMMER FALL · CLEAR THE CIRCLE',
        );
        break;
      case 'bossPhase':
        announce(
          'PHASE II',
          ev.boss === 'fallenking'
            ? 'The king sacrifices his court'
            : ev.boss === 'confessor'
              ? 'The veil is torn'
              : 'The siege engine awakens',
        );
        view.shake = 0.3;
        impactSound(true);
        break;
      case 'coreOpen':
        status(ev.boss === 'confessor' ? 'RITE BROKEN · STRIKE NOW' : 'CORE EXPOSED · STRIKE NOW');
        break;
      case 'stagger':
        visuals.react(ev.id, 'stagger', ev);
        view.hitPause = 0.075;
        view.shake = 0.18;
        audioFx('posture');
        visuals.spawnParticles(ev.x, ev.z, '#ffe2a1', 32);
        status(ev.boss ? 'POSTURE BROKEN · STRIKE NOW' : 'POSTURE BROKEN');
        break;
      case 'bossCross':
        view.shake = 0.25;
        impactSound(true);
        visuals.shockwave(ev.x, ev.z, true);
        break;
      case 'bossDefeated':
        announce(
          'BOSS DEFEATED',
          ev.boss === 'confessor' ? 'The Pale Confessor falls' : 'The Iron Castellan falls',
        );
        view.shake = 0.3;
        impactSound(true);
        status('BOSS RELIC UNLOCKED · EQUIP IN ARMORY');
        break;
      case 'cast':
        audioFx('cast');
        break;
      case 'cleared':
        announce('THE BOARD GROWS QUIET', 'Encounter cleared');
        break;
      case 'tired':
        status('Not enough stamina');
        break;
      case 'end':
        finish(ev.won);
        break;
    }
  }
  game.events = [];
}

function checkmateEffect(lost, won = false) {
  document.body.classList.toggle('run-result', lost || won);
  document.body.classList.toggle('victorious', won);
  $('#victoryFX').hidden = !won;
  document.body.classList.toggle('checkmated', lost);
  $('#deathFX').hidden = !lost;
}

function finish(won) {
  if (won && !game.bossTrial) checkpoints.clear(game.chapter);
  checkmateEffect(!won, won);
  document.body.classList.add('menu');
  $('#overlay').classList.remove('hidden');
  $('#overline').textContent = won
    ? 'THE SMALLEST PIECE CLAIMS THE CROWN'
    : 'THE BOARD DEMANDS ANOTHER SOUL';
  $('#title').innerHTML = won
    ? '<span class="victoryTitle">VICTORY</span><em class="victorySubtitle">The crown is yours.</em>'
    : '<span class="checkmateTitle">CHECKMATE</span>';
  $('#description').textContent = won
    ? 'Five encounters survived. ' +
      game.souls +
      ' souls claimed. The fallen court bows to its new sovereign.'
    : 'Encounter ' +
      (game.wave + 1) +
      ' · ' +
      game.souls +
      ' souls claimed. Read the windup, face your shield toward the blow, and return to the fight.';
  if (!won && game.arenaObjective?.failed)
    $('#description').textContent =
      'The wounded king has fallen. Intercept his attackers and protect him on your next attempt.';
  $('#start').textContent = won ? 'PLAY AGAIN' : 'START NEW RUN';
  $('#pause').textContent = 'PAUSE';
  showDeathRecap(won ? null : game.deathRecap);
  if (won) {
    visuals.playerModel.userData.crown.visible = true;
    visuals.shockwave(game.player.x, game.player.z, true, '#ffdb87');
    visuals.spawnParticles(game.player.x, game.player.z, '#ffdb87', 80);
  }
  if (game.bossTrial && won) {
    $('#description').textContent =
      'Boss defeated. Your skin and title are available in the armory. This challenge does not count as a full campaign clear.';
    $('#start').textContent = 'CONTINUE CAMPAIGN';
  }
  if (game.bossRush)
    $('#description').textContent =
      'THREE CROWNS · ' +
      game.bossRush.completed +
      '/3 defeated · ' +
      (won ? game.bossRush.score + ' points · ' : '') +
      Math.floor(game.time) +
      ' seconds · ' +
      game.flasks +
      ' flasks left.';
  if (game.endless)
    $('#description').textContent =
      'Endless Solo · ' +
      game.endless.cleared +
      ' encounters cleared. Every court sharpens the next.';
  lastChronicle = showChronicle(
    game,
    game.endless ? 'Endless · Checkmate' : won ? 'Victory' : 'Checkmate',
  );
  $('#chronicleFeedback').textContent = '';
  // Results replace the scrolled menu. Always reveal the summary from its top.
  $('#hubContent').scrollTop = 0;
  $('#panel-campaign').scrollTop = 0;
  if (game.souls > best) {
    best = game.souls;
    try {
      localStorage.setItem('pawnfall-3d-best', best);
    } catch {}
  }
}

function focusArena() {
  visuals.renderer.domElement.focus({ preventScroll: true });
}

function showDeathRecap(recap, onlineMatch = false) {
  $('#deathRecap').hidden = !recap;
  $('#runOutcome').hidden =
    (!recap && $('#runChronicle').hidden) ||
    ($('#panel-campaign').hidden && $('#panel-multiplayer').hidden);
  $('#retryFight').hidden = onlineMatch || !recap;
  $('#retryFight').textContent =
    game.checkpointMode === 'encounter' && game.checkpoint && !game.bossTrial
      ? 'RETRY ENCOUNTER'
      : 'QUICK RETRY';
  if (!recap) return;
  $('#recapCause').textContent = recap.source + ' · ' + recap.attack;
  $('#recapDamage').textContent =
    recap.attack === 'The king has fallen'
      ? 'The protection objective was lost.'
      : recap.damage + ' damage on the final hit';
  $('#recapTip').textContent = recap.tip;
  $('#recapRecent').textContent = (recap.recent || [])
    .map((h) => h.source + ' ' + h.damage)
    .join('  ·  ');
}

function retryFight() {
  if (online) return;
  if (retryKind?.type === 'endless') {
    game.mode = 'ready';
    start({ retry: retryKind, endless: true });
  } else if (retryKind?.type === 'rush') startRush();
  else if (retryKind?.type === 'boss') startBossChallenge(retryKind.realm, retryKind);
  else {
    game.mode = 'ready';
    if (game.checkpointMode === 'encounter' && game.checkpoint)
      start({ checkpoint: game.checkpoint });
    else start({ retry: retryKind });
  }
}

function resetCombatInput() {
  joystickRelease?.();
  keys.clear();
  guardTouch = false;
  stick = { x: 0, y: 0 };
  mouseControls?.releaseAll();
  actionButtons?.releaseAll();
}

function combatActive() {
  return (
    game.mode === 'playing' &&
    !game.eventChoices?.length &&
    !game.promotionChoices?.length &&
    !game.routeChoices?.length &&
    !game.upgradeChoices?.length &&
    !game.waitingForAlly &&
    !(online && (game.reconnecting || network.failures)) &&
    !$('#guide').open
  );
}

function start(options = {}) {
  notices.reset();
  view.announceUntil = view.statusUntil = 0;
  $('#announcement').style.opacity = $('#status').style.opacity = 0;
  for (const id of ['moreMenu', 'campaignSetup', 'advancedRun', 'challengeMenu']) $('#' + id).open = false;
  closeHelp();
  customSelects?.close();
  settingsUI?.cancel();
  $('#runChronicle').hidden = true;
  const suspension = options.suspension;
  const saved = options?.checkpoint;
  const retry =
    options?.retry ||
    (suspension
      ? { ...suspension.game, modifier: suspension.game.runModifier }
      : saved
        ? { ...saved, modifier: saved.runModifier }
        : null);
  if (retry) {
    chapter = retry.chapter;
    hub.selectChapter(chapter);
  }
  enableAudio();
  if (game.mode === 'paused') {
    resume();
    return;
  }
  suspendedMode = null;
  if (network.room) network.leave();
  online = false;
  game.peer = null;
  game.reconnecting = false;
  game.waitingForAlly = false;
  checkmateEffect(false);
  game.chessClass = retry?.chessClass || progress.data.chessClass;
  game.weapon = retry?.weapon || progress.data.weapon;
  game.difficulty = retry?.difficulty || preferences.data.difficulty;
  game.runModifier = retry?.modifier || $('#runModifier').value || 'none';
  game.bossRelic = retry?.bossRelic || progress.data.bossRelic || 'none';
  game.curse = retry?.curse || progress.data.curse || 'none';
  game.coopRole = progress.data.coopRole || 'balanced';
  game.checkpointMode = saved ? 'encounter' : $('#checkpointMode').value || 'encounter';
  game.reset(chapter);
  if (options.endless) {
    game.startEndless();
    try {
      game.endless.best = readEndlessBest();
    } catch {}
  }
  if (saved) restoreCheckpoint(game, saved);
  if (suspension) restoreRun(game, suspension);
  if (options.boss) {
    game.bossTrial = true;
    game.checkpoint = null;
  }
  retryKind = {
    type: game.endless ? 'endless' : 'campaign',
    chapter: game.endless?.startChapter ?? chapter,
    difficulty: game.difficulty,
    modifier: game.runModifier,
    weapon: game.weapon,
    chessClass: game.chessClass,
    bossRelic: game.bossRelic,
    curse: game.curse,
  };
  showDeathRecap(null);
  game.networked = false;
  view.shake = 0;
  view.hitPause = 0;
  visuals.applyTheme(CHAPTERS[chapter]);
  visuals.syncActors();
  visuals.applySkin(SKINS.find((s) => s.id === progress.data.skin));
  visuals.playerModel.userData.crown.visible = false;
  view.yaw = 0;
  view.zoom = 10;
  if (suspension) {
    Object.assign(view, suspension.camera);
    if (game.bossRush) retryKind.type = 'rush';
    if (game.endless) retryKind.type = 'endless';
  } else runs.clear();
  resetCombatInput();
  document.body.classList.remove('menu');
  $('#overlay').classList.add('hidden');
  $('#pause').innerHTML = 'PAUSE <kbd>ESC</kbd>';
  $('#bottomHint').style.opacity = 1;
  focusArena();
  processEvents();
}

function pause() {
  if (!['playing', 'route', 'upgrade', 'promotion', 'event'].includes(game.mode)) return;
  if (online) {
    resetCombatInput();
    status('Online matches cannot pause. Use LEAVE MATCH to exit.');
    return;
  }
  resetCombatInput();
  suspendedMode = game.mode;
  game.mode = 'paused';
  customSelects?.close();
  settingsUI?.cancel();
  $('#upgradePanel').hidden = true;
  hub.show('campaign');
  $('#overline').textContent = 'A BREATH BETWEEN BATTLES';
  $('#title').innerHTML = 'The board<br><em>waits.</em>';
  $('#description').textContent = 'Your fight will continue exactly where you left it.';
  $('#start').textContent = 'RESUME RUN';
  $('#overlay').classList.remove('hidden');
  document.body.classList.add('menu');
  $('#pause').textContent = 'RESUME';
}

function resume() {
  for (const id of ['moreMenu', 'campaignSetup', 'advancedRun', 'challengeMenu']) $('#' + id).open = false;
  closeHelp();
  customSelects?.close();
  settingsUI?.cancel();
  chapter = game.chapter;
  hub.selectChapter(chapter);
  game.mode = suspendedMode || 'playing';
  suspendedMode = null;
  $('#overlay').classList.add('hidden');
  document.body.classList.remove('menu');
  $('#pause').innerHTML = 'PAUSE <kbd>ESC</kbd>';
  resetCombatInput();
  focusArena();
}

function togglePause() {
  if (game.mode === 'paused') resume();
  else pause();
}

function movement() {
  let x =
      (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0) +
      stick.x +
      (padState.move?.x || 0),
    z =
      (keys.has('s') || keys.has('ArrowDown') ? 1 : 0) -
      (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) +
      stick.y +
      (padState.move?.y || 0);
  return {
    x: x * Math.cos(view.yaw) + z * Math.sin(view.yaw),
    z: -x * Math.sin(view.yaw) + z * Math.cos(view.yaw),
  };
}

function action(name) {
  if (online && (game.reconnecting || network.failures)) return;
  if (
    combatActive() &&
    mobileControls?.active &&
    preferences.data.touchLockAssist &&
    ['attack', 'heavy'].includes(name) &&
    !game.lock &&
    game.nearest(7)
  )
    action('lock');
  if (
    game.eventChoices?.length ||
    game.promotionChoices?.length ||
    game.routeChoices?.length ||
    game.upgradeChoices?.length ||
    game.waitingForAlly
  )
    return;
  if (online) {
    if (game.mode !== 'playing') return;
    const actionId = network.action(name);
    localActions.begin(name, actionId, game.player, performance.now(), game.time, movement());
    if (name === 'lock') game.toggleLock();
    return;
  }
  if (name === 'ultimate') game.ultimate();
  if (name === 'attack') game.attack();
  if (name === 'heavy') game.heavyAttack();
  if (name === 'dodge') {
    let m = movement();
    game.dodge(m.x, m.z);
  }
  if (name === 'heal') game.heal();
  if (name === 'lock') game.toggleLock();
}

function bind() {
  $('#runModifier').innerHTML = Object.entries(RUN_MODIFIERS)
    .map(([id, m]) => `<option value="${id}">${m.name} · ${m.text}</option>`)
    .join('');
  $('#retryFight').onclick = retryFight;
  $('#resumeCheckpoint').onclick = () => {
    $('#continueRun').hidden = !runs.available || game.mode === 'paused' || !!network.room;
    const c = checkpoints.get(chapter);
    if (c) {
      game.mode = 'ready';
      start({ checkpoint: c });
    }
  };
  customSelects = createCustomSelects(document);
  settingsUI = bindSettings(preferences, $, applyPreferences);
  mobileControls = bindMobileControls(
    preferences,
    $,
    window,
    document,
    () => ({
      width: innerWidth,
      height: innerHeight,
      coarse: window.matchMedia?.('(pointer:coarse)').matches || false,
    }),
    resetCombatInput,
  );
  view.mobileControlsActive = mobileControls.active;
  for (const key of ['combatCues', 'directionalAudio']) {
    $('#' + key).checked = preferences.data[key];
    $('#' + key).onchange = () => preferences.set({ [key]: $('#' + key).checked });
  }
  $('#previewCombatAudio').onclick = () => {
    if (muted) {
      $('#combatAudioNotice').textContent = 'Turn sound on in the header, then preview the cues.';
      return;
    }
    enableAudio();
    ['windup', 'projectile', 'guardbreak', 'counter'].forEach((kind, i) =>
      setTimeout(() => combatAudio.play(kind, { id: 'preview', now: performance.now() }), i * 400),
    );
    $('#combatAudioNotice').textContent = 'Windup · projectile · broken guard · successful parry.';
  };
  $('#startTraining').onclick = startTraining;
  $('#startTutorial').onclick = $('#trainingTutorial').onclick = startTutorial;
  $('#exitTutorial').onclick = () => exitTutorial();
  $('#finishTutorial').onclick = () => exitTutorial(true);
  $('#rejoinCoop').onclick = async () => {
    try {
      $('#rejoinCoop').disabled = true;
      await network.resume();
    } catch (e) {
      $('#networkNotice').textContent = e.message;
    } finally {
      $('#rejoinCoop').disabled = false;
    }
  };
  $('#retuneGraphics').onclick = () => {
    performanceTuner.reset();
    $('#performanceNotice').textContent = 'Measuring while the menu is open…';
  };
  $('#qualityMode').value = preferences.data.qualityMode;
  $('#qualityMode').onchange = () => {
    if ($('#qualityMode').value === 'auto') performanceTuner.reset();
    else preferences.set({ qualityMode: 'manual' });
  };
  $('#menu').onclick = goHome;
  $('#navBack').onclick = navigateBack;
  $('#navHome').onclick = goHome;
  $('#navResume').onclick = resume;
  $('#saveQuit').onclick = saveQuit;
  $('#continueRun').onclick = () => {
    const s = runs.get();
    if (s) {
      game.mode = 'ready';
      start({ suspension: s });
    }
  };
  $('#bossRush').onclick = startRush;
  $('#endlessRun').onclick = startEndless;
  $('#resetCamera').onclick = () => {
    view.yaw = 0;
    view.pitch = 6.8;
    view.zoom = 10;
    view.manualOrbit = 0;
  };
  $('#newRun').onclick = () => {
    game.mode = 'ready';
    suspendedMode = null;
    start();
  };
  $('#intermissionMenu').onclick = goHome;
  $('.brand').onclick = (e) => {
    e.preventDefault();
    goHome();
  };
  $('#readyMatch').onclick = () => network.command('ready', onlineState);
  $('#rematchMatch').onclick = () => network.command('rematch', onlineState);
  $('#leaveSession').onclick = () =>
    returnToLobby('You left the room. You can find another match.');
  $('#bossChallenge').onclick = () => startBossChallenge(0);
  $('#confessorChallenge').onclick = () => startBossChallenge(1);
  $('#kingChallenge').onclick = () => startBossChallenge(3);
  $('#copyChronicle').onclick = async () => {
    try {
      await navigator.clipboard.writeText(chronicleText(lastChronicle));
      $('#chronicleFeedback').textContent = 'Summary copied.';
    } catch {
      $('#chronicleFeedback').textContent =
        'Copy is unavailable. Select the summary text or save the card.';
    }
  };
  $('#saveChronicle').onclick = async () => {
    try {
      await saveChronicleCard(lastChronicle);
      $('#chronicleFeedback').textContent = 'Your card is ready to share.';
    } catch (error) {
      $('#chronicleFeedback').textContent =
        error.name === 'AbortError'
          ? 'Sharing cancelled.'
          : 'Could not save the card. Copy the summary instead.';
    }
  };
  $('#start').onclick = () => {
    if (game.mode === 'ready' && !network.room) {
      if (runs.available) { $('#continueRun').click(); return; }
      if (checkpoints.get(chapter)) { $('#resumeCheckpoint').click(); return; }
    }
    if (game.endless && ['dead', 'won'].includes(game.mode)) {
      game.mode = 'ready';
      start({ retry: retryKind, endless: true });
    } else start();
  };
  $('#pause').onclick = togglePause;
  $('#sound').onclick = () => {
    muted = !muted;
    preferences.set({ audioEnabled: !muted });
    $('#sound').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    if (!muted) {
      enableAudio();
      audioFx('wave');
    }
    updateAmbience();
  };
  const showHelp = () => {
    if ($('#guide').open) return;
    resetCombatInput();
    customSelects?.close();
    settingsUI?.cancel();
    helpOriginFocus = document.activeElement || $('#help');
    helpOpen = true;
    freezeHelp = game.mode === 'playing' && !online;
    $('#back').textContent = game.mode === 'playing' ? 'RETURN TO FIGHT' : 'BACK TO MENU';
    if (freezeHelp) game.mode = 'reading';
    $('#guide').showModal();
    $('#closeHelp').focus();
  };
  $('#help').onclick = $('#learn').onclick = showHelp;
  $('#closeHelp').onclick = $('#back').onclick = closeHelp;
  $('#guideHome').onclick = goHome;
  $('#guide').addEventListener('close', restoreHelp);
  $('#guide').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeHelp();
  });
  $('#guide').addEventListener('click', (e) => {
    if (e.target !== $('#guide')) return;
    const r = $('#guide').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeHelp();
  });
  bindCombatKeys(window, {
    keys,
    active: combatActive,
    paused: () => game.mode === 'paused' && hub?.tab === 'campaign',
    reading: () => !!$('#guide').open,
    action,
    togglePause,
    bindings: () => preferences.data.bindings,
  });
  bindNavigation(window, document, { state: navigationState, back: navigateBack });

  window.addEventListener('blur', () => {
    resetCombatInput();
    if (game.mode === 'playing' && !online) pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resetCombatInput();
      if (!online) pause();
    }
  });
  window.addEventListener('resize', visuals.resize);
  let c = visuals.renderer.domElement;
  c.tabIndex = 0;
  mouseControls = bindMouseControls(c, {
    keys,
    active: combatActive,
    focus: focusArena,
    action,
    bindings: () => preferences.data.bindings,
    zoom: (ratio) => {
      view.zoom = clamp(view.zoom * ratio, 6, 16);
      view.manualOrbit = 2;
    },
    orbit: (dx, dy) => {
      view.manualOrbit = 2;
      view.yaw -= dx * 0.006 * preferences.data.sensitivity;
      view.pitch = clamp(view.pitch + dy * 0.028 * preferences.data.sensitivity, 3, 12);
    },
  });
  c.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom = clamp(view.zoom + e.deltaY * 0.006, 6, 16);
    },
    { passive: false },
  );
  const joy = $('#joystick'),
    knob = joy.querySelector('i');
  let joyId = null;

  function joyMove(e) {
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / Math.max(20, r.width * 0.36),
      y = (e.clientY - r.top - r.height / 2) / Math.max(20, r.height * 0.36),
      l = Math.max(1, Math.hypot(x, y));
    stick = { x: x / l, y: y / l };
    knob.style.transform = `translate(${stick.x * r.width * 0.25}px,${stick.y * r.height * 0.25}px)`;
  }
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    joy.setPointerCapture(joyId);
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) joyMove(e);
  });
  joystickRelease = () => {
    const pointer = joyId;
    joyId = null;
    stick = { x: 0, y: 0 };
    knob.style.transform = '';
    if (pointer !== null)
      try {
        joy.releasePointerCapture?.(pointer);
      } catch {}
  };
  for (let ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    joy.addEventListener(ev, (e) => {
      if (e.pointerId === joyId) {
        joyId = null;
        stick = { x: 0, y: 0 };
        knob.style.transform = '';
      }
    });
  actionButtons = bindActionButtons([...document.querySelectorAll('[data-action]')], {
    active: combatActive,
    focus: focusArena,
    action,
    guard: (value) => {
      guardTouch = value;
    },
    revive: (on) => {
      if (on) keys.add('r');
      else keys.delete('r');
    },
  });
}

function updateHUD() {
  $('#hpFill').style.width = game.hp + '%';
  $('#hpText').textContent = Math.ceil(game.hp) + ' / 100';
  $('#stFill').style.width = game.stamina + '%';
  $('#souls').textContent = game.souls;
  $('#flasks').textContent = game.flasks;
  let s = Math.floor(game.time);
  $('#timer').textContent =
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  $('#wave').textContent = game.endless
    ? game.endless.encounter + ' / ∞'
    : ['I', 'II', 'III', 'IV', 'V', 'VI'][game.wave] +
      (online && selectedMode === 'coop' ? ' / VI' : ' / V');
  let n = game.enemies.filter((e) => !e.dead).length;
  $('#remaining').textContent = game.bossRush
    ? 'Boss ' + (game.bossRush.index + 1) + ' / 3'
    : n + ' enem' + (n === 1 ? 'y' : 'ies') + ' remain';
  let target = game.enemies.find((e) => e.id === game.lock && !e.dead);
  const boss = game.enemies.find((e) => e.boss && !e.dead);
  $('#bossHud').hidden = !boss;
  if (boss) {
    $('#bossName').textContent = boss.name;
    $('#bossSubtitle').textContent =
      boss.boss === 'fallenking'
        ? 'LAST SOVEREIGN OF THE ECLIPSE COURT'
        : boss.boss === 'confessor'
          ? 'KEEPER OF THE PALE CATHEDRAL'
          : 'SIEGE ENGINE OF THE ASHEN COURT';
    $('#bossHp').style.width = (100 * Math.max(0, boss.hp)) / boss.max + '%';
    $('#bossHpText').textContent = Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.max;
    $('#bossPoise').style.width = (100 * (boss.poise || 0)) / boss.maxPoise + '%';
    $('#bossPhase').textContent =
      'PHASE ' + (boss.phase === 2 ? 'II' : 'I') + ' · ' + bossPhaseLabel(boss);
    $('#bossHud').classList.toggle('exposed', !!boss.coreOpen);
    $('#bossHint').textContent = bossCombatHint(boss);
    $('#bossHint').hidden = !boss.coreOpen;
  }
  const piece = pieceById(game.chessClass);
  const remaining = Math.max(0, (game.abilityReadyAt || 0) - game.time);
  $('#abilityName').textContent = piece.symbol + ' ' + piece.ability;
  $('#abilityCooldown').textContent = remaining > 0 ? Math.ceil(remaining) + 's' : 'Q · READY';
  $('#abilityFill').style.width =
    100 * (1 - remaining / (piece.cooldown * (game.bossRelic === 'mirror' ? 0.8 : 1))) + '%';
  $('#weaponHud').textContent =
    weaponById(game.weapon).name.toUpperCase() +
    (game.player.riposte && game.player.state === 'attack' ? ' · RIPOSTE' : '') +
    (game.bossRelic && game.bossRelic !== 'none' ? ' · ' + relicById(game.bossRelic).name : '');
  $('#targetHud').hidden = !target || !!target.boss;
  $('#reticle').hidden = !target;
  if (target) {
    $('#championHint').textContent = target.championHint || '';
    $('#championHint').hidden = !(target.champion || target.rival) || target.state !== 'stagger';
    $('#targetName').textContent =
      target.boss || target.champion || target.rival
        ? target.name
        : target.type === 'queen'
          ? 'The Fallen Queen'
          : (target.elite ? 'Elite ' : '') +
            target.type[0].toUpperCase() +
            target.type.slice(1) +
            (target.guarding ? ' · GUARDING' : '');
    $('#targetPoise').style.width = (100 * (target.poise || 0)) / (target.maxPoise || 100) + '%';
    $('#targetFill').style.width = (100 * target.hp) / target.max + '%';
    let v = new THREE.Vector3(target.x, (target.y || 0) + 1.4, target.z).project(visuals.camera);
    $('#reticle').style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px';
    $('#reticle').style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
    if (v.z > 1) $('#reticle').hidden = true;
  }
  $('#bottomHint').hidden = game.time > 10 || !!game.training;
  $('#peerHud').hidden = !online || !game.peer;
  if (online && game.peer) {
    $('#peerName').textContent =
      (onlineState?.names?.[1 - network.seat] || 'Player') +
      (selectedMode === 'coop' ? ' · ALLY' : ' · RIVAL');
    $('#peerHp').style.width = game.peer.hp + '%';
    $('#connectionState').textContent = game.peer.dead
      ? game.peer.eliminated
        ? 'FALLEN · REVIVES ON CLEAR'
        : 'DOWNED · ' +
          Math.max(0, Math.ceil((game.peer.downedUntil || game.time) - game.time)) +
          's TO REVIVE'
      : 'ONLINE · ' + selectedMode.toUpperCase();
    $('#remaining').textContent =
      selectedMode === 'versus' ? 'FIRST TO FALL LOSES' : $('#remaining').textContent;
  }
}

function updateCombatGuidance() {
  const practice = game.training;
  const objective = game.objective;
  const arena = game.arenaObjective;
  $('#objectiveHud').textContent =
    !practice && game.mode === 'playing' && (!online || selectedMode === 'coop') && objective
      ? `Bonus · ${objective.title} · ${objective.progress}/${objective.goal}`
      : '';
  const arenaVisible =
    !practice && (!online || selectedMode === 'coop') && !!arena && game.mode === 'playing';
  $('#arenaGoal').hidden = !arenaVisible || !!practice?.tutorial;
  $('#objectiveHud').hidden = arenaVisible || !!practice?.tutorial;
  $('#objectiveInteract').hidden = !(arenaVisible && arena.kind === 'ritual' && !arena.complete);
  if (arenaVisible) {
    $('#arenaGoalTitle').textContent = arena.title;
    let detail;
    if (arena.complete) detail = 'Secured · Finish the encounter.';
    else if (arena.kind === 'capture')
      detail =
        (arena.contested
          ? 'Contested · Clear the ring'
          : arena.occupied
            ? 'Hold the ring'
            : 'Enter the gold ring') +
        ' ' +
        Math.floor(arena.progress) +
        '/' +
        arena.goal +
        's';
    else if (arena.kind === 'ritual') {
      const sigil = arena.sigils.find(
        (s) => !s.broken && Math.hypot(game.player.x - s.x, game.player.z - s.z) < 1.8,
      );
      detail =
        arena.progress +
        '/3 sigils broken · ' +
        (sigil
          ? 'Hold ' +
            keyLabel(preferences.data.bindings.r) +
            ' · Stand still'
          : 'At a red sigil, hold ' +
            keyLabel(preferences.data.bindings.r) +
            ' to break');
    } else
      detail =
        'King: ' +
        Math.ceil(arena.king.hp) +
        '/' +
        arena.king.max +
        ' vitality · ' +
        Math.floor(arena.progress) +
        '/' +
        arena.goal +
        's · Protect the king';
    if ($('#arenaGoalDetail').textContent !== detail) $('#arenaGoalDetail').textContent = detail;
    const channel =
      arena.kind === 'ritual'
        ? arena.sigils.find((s) => !s.broken && s.progress > 0)?.progress || 0
        : 0;
    $('#arenaGoalFill').style.width =
      100 *
        (arena.kind === 'ritual'
          ? (arena.progress + channel / 2) / 3
          : arena.progress / arena.goal) +
      '%';
  }
  $('#practiceHud').hidden = !practice || !!practice.tutorial;
  const label = (token) => keyLabel(preferences.data.bindings[token]);
  if (practice)
    $('#practiceHud').textContent =
      `Practice · ${practice.hits} hits · ${Math.round(practice.damage)} damage · ${practice.parries} parries`;
  const danger = game.enemies.find((e) =>
    !e.dead && e.unblockable && ['windup', 'ability'].includes(e.state) &&
    Math.hypot(e.x - game.player.x, e.z - game.player.z) < 7 &&
    (!online || e.targetId === 'p' + network.seat));
  const warning = game.arenaShift?.phase === 'warning';
  const nearPortal = game.secretPortal && !game.secretPortal.used &&
    Math.hypot(game.player.x - game.secretPortal.x, game.player.z - game.secretPortal.z) < 4;
  $('#combatCoach').textContent = game.mode !== 'playing' || practice?.tutorial ? ''
    : danger ? 'Unblockable · Dodge'
    : warning ? (game.arenaShift.kind === 'gates' ? 'Gates rising · Move clear' : 'Pillar falling · Move clear')
    : game.hazards?.length ? 'Arena strike · Leave the marked area'
    : game.stamina < 22 ? 'Low stamina · Release guard'
    : nearPortal ? 'Secret court · Hold ' + (view.mobileControlsActive ? 'USE' : label('r'))
    : practice?.behavior === 'guard' ? 'Flank the guard or land a heavy attack'
    : '';
  // Normal enemy windups are communicated by animation and ground markers.
  $('#threatHud').textContent = '';
  const immediateDanger = danger || warning || game.hazards?.length;
  $('#combatCoach').hidden = !immediateDanger && view.renderTime < notices.until;
  if (immediateDanger || view.renderTime >= notices.until) {
    $('#announcement').hidden = $('#status').hidden = true;
    $('#announcement').style.opacity = $('#status').style.opacity = 0;
    view.announceUntil = view.statusUntil = 0;
  }
  const coop = online && selectedMode === 'coop' && game.mode === 'playing';
  $('#teamControls').hidden = !coop;
  $('#teamHud').hidden = !coop;
  if (coop) {
    const down = game.player.dead ? game.player : game.peer?.dead ? game.peer : null;
    const opening = game.enemies.find(
      (e) =>
        !e.dead &&
        e.state === 'stagger' &&
        !e.teamSpent &&
        e.openedBy &&
        e.openedBy !== 'p' + network.seat &&
        e.teamWindowEnd > game.time,
    );
    const ping = game.pings?.find((p) => p.seat !== network.seat && p.until > game.time);
    $('#teamHud').textContent = down
      ? down.eliminated
        ? 'FALLEN · returns when this encounter clears.'
        : `Downed · ${Math.max(0, Math.ceil((down.downedUntil || game.time) - game.time))}s · ${Math.round((down.reviveProgress || 0) * 100)}% revived · ${game.player.dead ? 'Wait for your ally' : 'Hold ' + label('r') + ' nearby'}`
      : opening
        ? `TEAM OPENING · Heavy attack (${label('h')}) now for bonus damage!`
        : ping
          ? `ALLY PING · ${String.fromCharCode(65 + Math.min(7, Math.max(0, Math.floor((ping.x + 10.5) / 2.625))))}${8 - Math.min(7, Math.max(0, Math.floor((ping.z + 10.5) / 2.625)))}`
          : '';
    $('#teamHud').hidden = !$('#teamHud').textContent;
  }
}

function restoreHelp() {
  if (!helpOpen) return;
  helpOpen = false;
  if (freezeHelp && game.mode === 'reading') game.mode = 'playing';
  freezeHelp = false;
  const origin = helpOriginFocus;
  helpOriginFocus = null;
  if (combatActive()) focusArena();
  else origin?.focus?.({ preventScroll: true });
}

function closeHelp() {
  if (!$('#guide').open) return false;
  $('#guide').close();
  restoreHelp();
  return true;
}

function navigationState() {
  return {
    dropdown: !!customSelects?.opened,
    disclosure:
      document.body.classList.contains('menu') && !!document.querySelector('details[open]'),
    binding: !!settingsUI?.listening,
    guide: !!$('#guide').open,
    bestiary: hub?.tab === 'bestiary' && !$('#bestiaryDetail').hidden,
    connected: !!(online || network.room || hub?.searching),
    intermission:
      ['route', 'upgrade', 'promotion', 'event'].includes(game.mode) ||
      (!document.body.classList.contains('menu') && !!game.waitingForAlly),
    menu: document.body.classList.contains('menu'),
    tab: hub?.tab || 'campaign',
    paused: game.mode === 'paused',
    result: ['dead', 'won'].includes(game.mode),
    playing: game.mode === 'playing',
  };
}

function navigateBack() {
  const destination = backDestination(navigationState());
  if (destination === 'dropdown') customSelects.dismiss();
  else if (destination === 'disclosure') {
    const d = document.querySelector('details[open]');
    if (d) {
      d.open = false;
      d.querySelector('summary')?.focus();
    }
  } else if (destination === 'binding') settingsUI.cancel();
  else if (destination === 'guide') closeHelp();
  else if (destination === 'bestiary') hub.closeBestiary();
  else if (destination === 'leave') goHome();
  else if (destination === 'campaign') {
    customSelects?.close();
    settingsUI?.cancel();
    hub.show('campaign');
    $('#navHome').focus();
  } else if (destination === 'pause') pause();
  else if (destination === 'resume') resume();
  else if (destination === 'home') goHome();
  return !!destination;
}

function goHome() {
  closeHelp();
  customSelects?.close();
  settingsUI?.cancel();
  resetCombatInput();
  if (online || network.room || hub?.searching) {
    returnToLobby('You left the session. Choose a mode when you are ready.');
    hub.show('campaign');
  } else if (['playing', 'route', 'upgrade', 'promotion', 'event'].includes(game.mode)) {
    pause();
  } else if (game.mode === 'paused') hub.show('campaign');
  else showMenu('campaign');
  $('#navHome').focus({ preventScroll: true });
}

function updateNavigation() {
  const s = navigationState();
  const destination = backDestination(s);
  $('#navBack').disabled = !destination;
  $('#navBack').textContent = destination === 'leave' ? 'LEAVE SESSION' : '← BACK';
  $('#navResume').hidden = !s.paused;
  $('#saveQuit').hidden = !s.paused || online || !!game.training;
  $('#newRun').hidden = !(s.paused || (game.mode === 'ready' && (runs.available || checkpoints.get(chapter)))) || !!network.room;
  document.querySelector('.hub').classList.toggle('homeIdle', s.tab === 'campaign' && !s.paused && !s.result && !s.connected);
  $('#navLocation').textContent =
    ({
      campaign: 'Play',
      multiplayer: 'Multiplayer',
      armory: 'Armory',
      honors: 'Honors',
      training: 'Training',
      settings: 'Settings',
      bestiary: 'Bestiary',
    }[s.tab] || 'Campaign') + (s.paused ? ' · RUN PAUSED' : '');
  $('#intermissionMenu').textContent = online ? 'LEAVE MATCH' : 'BACK TO MENU';
}

function showMenu(tab = 'campaign') {
  closeHelp();
  customSelects?.close();
  settingsUI?.cancel();
  suspendedMode = null;
  $('#upgradePanel').hidden = true;
  $('#runChronicle').hidden = true;
  checkmateEffect(false);
  showDeathRecap(null);
  hub.busy(false);
  $('#sessionPanel').hidden = true;
  game.networked = false;
  view.shake = 0;
  view.hitPause = 0;
  resetCombatInput();
  game.mode = 'ready';
  game.waitingForAlly = false;
  game.eventChoices = [];
  game.promotionChoices = [];
  game.routeChoices = [];
  game.routeVotes = [];
  game.upgradeChoices = [];
  document.body.classList.add('menu');
  $('#overlay').classList.remove('hidden');
  $('#overline').textContent = 'FOUR REALMS. ONE UNBROKEN SOUL.';
  $('#title').innerHTML = 'Claim your<br><em>kingdom.</em>';
  $('#description').textContent =
    'A fallen kingdom. A sword in your hand. Enter the court and earn your crown.';
  $('#start').textContent = 'PLAY';
  hub.show(tab);
  $('#menu').textContent = 'MENU';
}

function selectChapter(n) {
  chapter = n;
  visuals.applyTheme(CHAPTERS[n]);
  lastTheme = n;
}

function returnToLobby(message) {
  hub?.invalidateSearch();
  $('#runChronicle').hidden = true;
  $('#sessionPanel').hidden = true;
  lobbyPhaseKey = null;
  activeRoundKey = null;
  network.leave();
  online = false;
  onlineState = null;
  game.peer = null;
  game.events = [];
  showMenu('multiplayer');
  hub.busy(false);
  $('#networkNotice').textContent = message;
}

async function beginMatch(mode, options) {
  enableAudio();
  resetCombatInput();
  game.mode = 'ready';
  game.events = [];
  game.eventChoices = [];
  game.promotionChoices = [];
  game.routeChoices = [];
  game.routeVotes = [];
  game.upgradeChoices = [];
  game.waitingForAlly = false;
  online = false;
  onlineState = null;
  $('#matchResult').hidden = true;
  selectedMode = mode;
  matchFinished = false;
  activeRoundKey = null;
  lobbyPhaseKey = null;
  $('#sessionPanel').hidden = true;
  const r = await network.find(mode, progress.data, options);
  if (r.cancelled) return;
  hub.queue({ ...r, mode });
}

function showSessionLobby(s, events = []) {
  for (const ev of events)
    if (
      ev.type === 'bossDefeated' ||
      (ev.seat === s.seat && ['kill', 'parry', 'block', 'dodge'].includes(ev.type))
    )
      progress.event(ev, CHAPTERS[chapter].id);
  const key = [network.room, s.series, s.round, s.phase, s.status].join(':');
  online = true;
  onlineState = s;
  selectedMode = s.mode;
  network.seat = s.seat;
  game.mode = 'ready';
  game.events = [];
  game.eventChoices = [];
  game.promotionChoices = [];
  game.routeChoices = [];
  game.routeVotes = [];
  game.upgradeChoices = [];
  game.waitingForAlly = false;
  resetCombatInput();
  view.shake = 0;
  view.hitPause = 0;
  if (lobbyPhaseKey !== key) {
    lobbyPhaseKey = key;
    document.body.classList.add('menu');
    $('#overlay').classList.remove('hidden');
    hub.show('multiplayer');
    hub.busy(true);
    $('#queueState').hidden = true;
    $('#menu').textContent = 'LEAVE MATCH';
    network.actions = [];
  }
  $('#sessionPanel').hidden = false;
  const scores = s.scores || [0, 0],
    ready = s.ready || [false, false],
    rematch = s.rematch || [false, false];
  $('#sessionPlayers').textContent = s.names
    .map(
      (name, i) =>
        name + (i === s.seat ? ' (you)' : '') + ' · ' + (ready[i] ? 'READY' : 'NOT READY'),
    )
    .join('  /  ');
  $('#seriesScore').textContent =
    s.mode === 'versus'
      ? s.names[0] +
        ' ' +
        scores[0] +
        ' — ' +
        scores[1] +
        ' ' +
        s.names[1] +
        ' · ' +
        (s.bestOf === 3 ? 'FIRST TO 2' : 'SINGLE DUEL')
      : 'CO-OP EXPEDITION';
  const terminal = s.status === 'ended',
    counting = s.phase === 'countdown',
    roundEnd = s.phase === 'roundEnd';
  $('#readyMatch').hidden = terminal;
  $('#readyMatch').disabled = counting || ready[s.seat] || s.peerConnected === false;
  $('#readyMatch').textContent = ready[s.seat]
    ? 'YOU ARE READY'
    : roundEnd
      ? 'READY FOR NEXT ROUND'
      : 'READY';
  $('#rematchMatch').hidden = !terminal;
  $('#rematchMatch').disabled =
    rematch[s.seat] || s.peerConnected === false || s.departed?.some(Boolean);
  $('#rematchMatch').textContent = rematch[s.seat] ? 'REMATCH REQUESTED' : 'REQUEST REMATCH';
  $('#sessionStatus').textContent = counting
    ? 'STARTING IN ' + Math.max(1, Math.ceil(s.countdownUntil - s.clock))
    : terminal
      ? 'MATCH COMPLETE'
      : roundEnd
        ? 'ROUND COMPLETE'
        : 'BOTH PLAYERS MUST READY UP';
  $('#sessionDetail').textContent =
    s.peerConnected === false || s.departed?.some(Boolean)
      ? 'Your partner has left or disconnected. Leave this room to find another match.'
      : terminal
        ? rematch[1 - s.seat]
          ? 'Your partner wants a rematch. Accept to play together again.'
          : 'Both players must request a rematch to stay together.'
        : counting
          ? 'Get ready. Combat begins after the countdown.'
          : roundEnd
            ? 'Ready up together for the next round. Draws award no points.'
            : 'Choose Ready when you are prepared. Combat and the timer wait for both players.';
  if (s.mode === 'coop')
    $('#sessionDetail').textContent += ' Difficulty: ' + difficultyById(s.difficulty).name + '.';
  $('#matchResult').hidden = !(terminal || roundEnd);
  if (!terminal && !roundEnd) checkmateEffect(false);
  if (terminal || roundEnd) {
    const result = matchResult({ ...s, winner: roundEnd ? s.roundWinner : s.winner });
    $('#matchResultLabel').textContent = roundEnd
      ? 'ROUND ' + s.round + ' COMPLETE'
      : s.mode === 'versus'
        ? 'SERIES COMPLETE'
        : 'EXPEDITION COMPLETE';
    const lost = result.outcome === 'defeat' || (s.mode === 'coop' && s.winner === null);
    checkmateEffect(lost, !lost && result.outcome === 'victory');
    $('#matchResultTitle').textContent = lost ? 'CHECKMATE' : result.title;
    if (selectedMode === 'coop') {
      lastChronicle = showChronicle(
        {
          ...game,
          ...s.players[s.seat],
          souls: s.players[s.seat].souls ?? s.souls,
          journal: s.players[s.seat].journal,
          time: s.time,
        },
        lost ? 'Checkmate' : 'Victory',
      );
      $('#chronicleFeedback').textContent = '';
    }
    showDeathRecap(lost ? s.players?.[s.seat]?.deathRecap : null, true);
    $('#matchWinner').textContent = result.winner;
    $('#matchResult').dataset.outcome = result.outcome;
    $('#matchStats').hidden = s.mode !== 'versus';
    if (s.mode === 'versus')
      $('#matchStats').innerHTML = [
        ['YOUR ROUND WINS', scores[s.seat] || 0],
        ['RIVAL ROUND WINS', scores[1 - s.seat] || 0],
        [
          'ROUND TIME',
          Math.floor((s.time || 0) / 60) + 'm ' + Math.floor((s.time || 0) % 60) + 's',
        ],
        ['VITALITY LEFT', Math.ceil(s.players?.[s.seat]?.hp || 0) + ' / 100'],
      ]
        .map(
          ([label, value]) =>
            `<div class="resultMetric"><b>${value}</b><span>${label}</span></div>`,
        )
        .join('');
    $('#matchResultDetail').textContent = roundEnd
      ? 'Score: ' + scores.join(' — ') + '. Ready up for the next round.'
      : s.reason === 'disconnect'
        ? 'Match ended by forfeit. Rewards and progress saved.'
        : 'Final score: ' + scores.join(' — ') + '. Rewards and progress saved.';
    const rewardKey = network.room + ':' + (s.series || 1);
    if (terminal && !awardedSeries.has(rewardKey)) {
      awardedSeries.add(rewardKey);
      if (s.winner === 'team' || s.winner === s.seat)
        progress.add(s.mode === 'coop' ? 'coopWins' : 'versusWins');
    }
  }
}

function acceptState(s, events) {
  if (s.status === 'waiting') {
    hub.queue(s);
    return;
  }
  if (s.status === 'cancelled' || s.status === 'disconnected') {
    returnToLobby('The connection closed. You can queue again.');
    return;
  }
  if (!s.players) return;
  if (s.status === 'ended' || (s.phase && s.phase !== 'combat')) {
    showSessionLobby(s, events);
    return;
  }
  const roundKey = [network.room, s.series || 1, s.round || 1].join(':');
  const first = !online || game.mode !== 'playing' || activeRoundKey !== roundKey;
  activeRoundKey = roundKey;
  lobbyPhaseKey = null;
  $('#sessionPanel').hidden = true;
  online = true;
  onlineState = s;
  selectedMode = s.mode;
  network.seat = s.seat;
  const me = s.players[s.seat],
    peer = s.players[1 - s.seat];
  game.networked = true;
  game.training = null;
  game.reconnecting = !!s.reconnecting;
  game.difficulty = s.difficulty || 'standard';
  game.hazards = s.hazards || [];
  game.objective = s.objective || null;
  game.arenaObjective = s.arenaObjective || null;
  game.arenaShift = s.arenaShift || null;
  game.secretPortal = s.secretPortal || null;
  game.pings = s.pings || [];
  game.localSeat = s.seat;
  if (lastTheme !== s.realm) {
    visuals.applyTheme(CHAPTERS[s.realm || 0]);
    lastTheme = s.realm;
  }
  if (first) {
    remoteMotion.reset();
    localActions.reset();
  }
  remoteMotion.push(s, network.lastReceive);
  game.player = reconcileAvatar(game.player, me, first);
  localActions.confirm(events, s.seat, me);
  game.peer = { ...peer, id: 'peer', isAvatar: true };
  game.enemies = selectedMode === 'versus' ? [game.peer] : s.enemies;
  game.projectiles = s.projectiles;
  game.time = s.time;
  game.wave = s.wave;
  game.hp = me.hp;
  game.stamina = me.stamina;
  game.flasks = me.flasks;
  game.combo = me.combo;
  game.weapon = me.weapon;
  game.chessClass = me.chessClass || 'pawn';
  game.abilityReadyAt = me.abilityReadyAt || 0;
  game.bossRelic = me.bossRelic || 'none';
  game.curse = me.curse || 'none';
  game.coopRole = me.coopRole || 'balanced';
  game.bossRush = null;
  game.endless = null;
  game.routeChoices = s.routeChoices || [];
  game.routeVotes = s.routeVotes || [];
  game.routeSeat = s.seat;
  game.upgradePicks = me.upgradePicks || 1;
  game.route = me.route || null;
  game.journal = me.journal || game.journal || [];
  game.personalSouls = me.souls ?? s.souls;
  game.rivalMemory = me.rivalMemory;
  game.eventChoices = me.eventChoices || [];
  game.promotionChoices = me.promotionChoices || [];
  game.promotionResolved = !!me.promotionResolved;
  game.upgrades = me.upgrades || {};
  game.upgradeChoices = me.upgradeChoices || [];
  game.waitingForAlly = !me.choosing && s.players.some((p) => p.choosing);
  game.souls = s.souls;
  if (first) {
    checkmateEffect(false);
    game.mode = 'playing';
    game.lock = null;
    view.shake = 0;
    view.hitPause = 0;
    keys.clear();
    view.yaw = s.seat ? Math.PI : 0;
    view.zoom = 10;
    visuals.applyTheme(CHAPTERS[s.realm || 0]);
    document.body.classList.remove('menu');
    $('#overlay').classList.add('hidden');
    hub.busy(false);
    $('#menu').textContent = 'LEAVE MATCH';
    focusArena();
    announce(
      selectedMode === 'coop'
        ? 'CO-OP · ' + difficultyById(s.difficulty).name.toUpperCase()
        : 'VERSUS DUEL',
      'Two souls. One board.',
    );
  }
  visuals.syncActors();
  visuals.applySkin(SKINS.find((x) => x.id === s.skins[s.seat]) || SKINS[0]);
  visuals.applySkin(SKINS.find((x) => x.id === s.skins[1 - s.seat]) || SKINS[0], 'peer');
  game.events = events
    .filter((e) => e.type !== 'matchEnd' && e.type !== 'end')
    .map((e) => ({
      ...e,
      id:
        e.id === 'player'
          ? e.seat === s.seat
            ? 'player'
            : 'peer'
          : e.id === 'p' + s.seat
            ? 'player'
            : e.id === 'p' + (1 - s.seat)
              ? 'peer'
              : e.id,
      remote:
        ![
          'bossDefeated',
          'objectiveReward',
          'arenaObjectiveReward',
          'arenaObjectiveComplete',
        ].includes(e.type) &&
        e.seat !== null &&
        e.seat !== s.seat,
      title: e.type === 'wave' ? game.enemies.find((x) => x.boss)?.name || titles[s.wave] : e.title,
      x: e.x ?? peer.x,
      z: e.z ?? peer.z,
    }));
  processEvents();
}

function tickOnline(stamp, dt, input) {
  network.tick(
    stamp,
    game.mode === 'playing' && !game.reconnecting && !network.failures ? input : {},
  );
  if (online && onlineState && game.mode === 'playing') {
    game.time += dt;
    const remote = remoteMotion.sample(stamp);
    game.remoteTime = remote.time;
    const pose = (entity, id = entity.id) => ({ ...entity, ...(remote.poses.get(id) || {}) });
    const peer = onlineState.players[1 - network.seat];
    game.peer = { ...pose(peer, 'seat:' + (1 - network.seat)), id: 'peer', isAvatar: true };
    game.enemies =
      selectedMode === 'versus' ? [game.peer] : (onlineState.enemies || []).map((e) => pose(e));
    game.projectiles = (onlineState.projectiles || []).map((p) => pose(p, 'shot:' + p.id));
    interpolateAvatar(
      game.player,
      onlineState.players[network.seat],
      dt,
      input,
      (stamp - network.lastReceive) / 1000,
    );
  }
}

async function syncProfile() {
  if (!progress.netDirty || network.busy) return;
  try {
    const remote = await network.profile(progress.data);
    progress.merge(remote);
    progress.netDirty = false;
    $('#syncStatus').textContent = 'Progress saved on this device and synced to your account.';
  } catch {
    $('#syncStatus').textContent =
      'Progress saved on this device. Account sync will retry when connected.';
  }
}
let upgradeKey = '';

function updateUpgradePanel() {
  const events = game.eventChoices || [];
  const eventing = events.length > 0;
  const promotions = game.promotionChoices || [];
  const promoting = promotions.length > 0;
  const routes = game.routeChoices || [];
  const routing = routes.length > 0;
  const choices = game.upgradeChoices || [];
  const visible =
    (online || ['upgrade', 'route', 'promotion', 'event'].includes(game.mode)) &&
    (eventing || promoting || routing || choices.length > 0 || game.waitingForAlly);
  $('#upgradePanel').hidden = !visible;
  if (!visible) {
    if (upgradeKey && combatActive()) focusArena();
    upgradeKey = '';
    return;
  }
  resetCombatInput();
  const key =
    (eventing
      ? 'event:' + events.join(',') + ':' + (online ? game.personalSouls : game.souls)
      : promoting
        ? 'promotion:' + promotions.join(',')
        : routing
          ? 'route:' + routes.join(',') + ':' + (game.routeVotes || []).join(',')
          : choices.join(',') + ':' + game.upgradePicks) +
    ':' +
    !!game.waitingForAlly;
  $('#upgradeTitle').textContent = eventing
    ? game.wave === 1
      ? 'A bargain in chains.'
      : game.wave === 2
        ? 'A knight asks for one last duel.'
        : 'The wandering forge.'
    : promoting
      ? 'The pawn earns its crown.'
      : routing
        ? 'Choose your next passage.'
        : 'Forge your next move.';
  $('#upgradeCards').classList.toggle('promotionChoices', promoting);
  $('#upgradeCards').classList.toggle('eventChoices', eventing);
  $('#runBuild').textContent =
    'YOUR BLESSINGS · ' +
    (Object.entries(game.upgrades || {})
      .map(([id, n]) => (UPGRADES.find((u) => u.id === id)?.name || id) + ' ' + n)
      .join(' · ') || 'None yet');
  if (routing)
    $('#runBuild').textContent = online
      ? 'REWARDS APPLY TO EACH PLAYER'
      : 'YOUR ROUTE · YOUR RISK · YOUR REWARD';
  if (promoting) $('#runBuild').textContent = 'ONE PROMOTION PER RUN · THE NEW ABILITY IS READY';
  if (eventing)
    $('#runBuild').textContent = 'YOUR SOULS · ' + (online ? game.personalSouls : game.souls);
  if (key === upgradeKey) return;
  upgradeKey = key;
  if (eventing) {
    const wallet = online ? game.personalSouls : game.souls;
    const context = { ...game, souls: wallet };
    $('#upgradeNote').textContent =
      'Choose an encounter event, or continue without spending. Combat is paused.';
    $('#runBuild').textContent = 'YOUR SOULS · ' + wallet;
    $('#upgradeCards').innerHTML = events
      .map((id) => {
        const e = eventInfo(id, game),
          allowed = eventCanChoose(context, id);
        return `<button data-event="${id}" ${allowed ? '' : 'disabled'}><small>${e.cost ? e.cost + ' SOULS' : 'NO COST'}</small><b>${e.name}</b><span>${e.text}</span><small>${allowed ? 'CHOOSE →' : id === 'temper' && (game.upgrades.force || 0) >= 3 ? 'ALREADY AT MAXIMUM RANK' : 'NOT ENOUGH SOULS'}</small></button>`;
      })
      .join('');
    document.querySelectorAll('[data-event]').forEach(
      (b) =>
        (b.onclick = () => {
          if (online) {
            network.action('event:' + b.dataset.event);
            b.disabled = true;
          } else game.chooseEvent(b.dataset.event);
        }),
    );
    document.querySelector('[data-event]:not(:disabled)')?.focus();
    return;
  }
  if (promoting) {
    $('#upgradeNote').textContent =
      'Two encounters survived. Choose your new piece and ability. Your weapon and blessings stay equipped.';
    $('#runBuild').textContent = 'ONE PROMOTION PER RUN · THE NEW ABILITY IS READY';
    $('#upgradeCards').innerHTML = promotions
      .map((id) => {
        const p = PIECES.find((p) => p.id === id);
        return `<button data-promote="${id}"><small>${id === 'pawn' ? 'KEEP YOUR CURRENT PIECE' : 'PAWN PROMOTION'}</small><b>${p.symbol} ${p.name}</b><span>${p.ability}</span><span>${p.text}</span><small>${id === 'pawn' ? 'HOLD YOUR RANK' : 'BECOME THE ' + p.name.toUpperCase()} →</small></button>`;
      })
      .join('');
    document.querySelectorAll('[data-promote]').forEach(
      (b) =>
        (b.onclick = () => {
          if (online) {
            network.action('promote:' + b.dataset.promote);
            b.disabled = true;
          } else game.choosePromotion(b.dataset.promote);
        }),
    );
    document.querySelector('[data-promote]')?.focus();
    return;
  }
  if (routing) {
    const vote = game.routeVotes?.[game.routeSeat ?? 0];
    const other = game.routeVotes?.[1 - (game.routeSeat ?? 0)];
    $('#upgradeNote').textContent = online
      ? 'Both players must choose the same passage. You can change your vote.' +
        (other
          ? ' Ally chose: ' + ROUTES.find((r) => r.id === other)?.name + '.'
          : ' Waiting for your ally’s vote.')
      : 'One choice shapes the next encounter. Combat is paused.';
    $('#runBuild').textContent = online
      ? 'REWARDS APPLY TO EACH PLAYER'
      : 'YOUR ROUTE · YOUR RISK · YOUR REWARD';
    $('#upgradeCards').innerHTML = routes
      .map((id) => {
        const r = ROUTES.find((r) => r.id === id);
        const champion =
          id === 'champion' ? CHAMPIONS[game.enemies.find((e) => CHAMPIONS[e.type])?.type] : null;
        const description = champion ? champion.name + ': ' + champion.hint : r.text;
        return `<button data-route="${id}" aria-pressed="${vote === id}"><small>${r.risk}</small><b>${r.name}</b><span>${description}</span><span class="routeReward">${r.reward}</span><small>${vote === id ? 'YOUR VOTE · SELECTED' : online ? 'VOTE FOR THIS PASSAGE →' : 'TAKE THIS PASSAGE →'}</small></button>`;
      })
      .join('');
    document.querySelectorAll('[data-route]').forEach(
      (b) =>
        (b.onclick = () => {
          if (online) network.action('route:' + b.dataset.route);
          else game.chooseRoute(b.dataset.route);
        }),
    );
    document.querySelector('[data-route]')?.focus();
    return;
  }
  $('#upgradeNote').textContent = game.waitingForAlly
    ? 'Choice confirmed. Waiting for your ally…'
    : game.upgradePicks > 1
      ? 'Champion reward: choose two blessings, one at a time.'
      : 'Choose one blessing. It lasts for this run.';
  $('#upgradeCards').innerHTML = choices
    .map((id) => {
      const u = UPGRADES.find((u) => u.id === id);
      return `<button data-upgrade="${id}"><small>RUN BLESSING · RANK ${(game.upgrades[id] || 0) + 1}</small><b>${u.name}</b><span>${u.text}</span><small>CHOOSE BLESSING →</small></button>`;
    })
    .join('');
  document.querySelectorAll('[data-upgrade]').forEach(
    (b) =>
      (b.onclick = () => {
        if (online) {
          network.action('upgrade:' + b.dataset.upgrade);
          b.disabled = true;
        } else game.chooseUpgrade(b.dataset.upgrade);
      }),
  );
  document.querySelector('[data-upgrade]')?.focus();
}

function updateConnectionHUD(stamp) {
  const age = Math.max(0, stamp - network.lastReceive);
  const reconnecting = onlineState?.reconnecting && !!network.room;
  $('#reconnectNotice').hidden = !reconnecting;
  $('#reconnectNotice').textContent = reconnecting
    ? 'CO-OP PAUSED · Waiting for ' +
      (onlineState.reconnectSeat === network.seat ? 'your connection' : 'your ally') +
      ' · ' +
      Math.ceil((onlineState.reconnectRemainingMs || 0) / 1000) +
      's to rejoin'
    : '';
  const text = !network.room
    ? ''
    : network.failures || age > 2500
      ? 'RECONNECTING · RETRY ' + network.failures
      : network.ping === null
        ? 'CONNECTING…'
        : Math.round(network.ping) + (network.streaming ? ' ms · LIVE LAN' : ' ms · CONNECTED');
  $('#networkHud').hidden = !network.room;
  $('#networkQuality').textContent = text;
  $('#lobbyConnection').textContent = text;
  $('#duelScore').textContent =
    onlineState?.mode === 'versus' && network.room
      ? 'ROUND ' + (onlineState.round || 1) + ' · ' + (onlineState.scores || [0, 0]).join(' — ')
      : '';
}

function frame(stamp) {
  const frameMs = stamp - lastStamp;
  let dt = Math.min(0.04, frameMs / 1000 || 0.016);
  lastStamp = stamp;
  const tuned = performanceTuner.sample(frameMs, {
    active: document.body.classList.contains('menu') && !document.hidden,
    coarse: window.matchMedia?.('(pointer:coarse)').matches || innerWidth < 700,
    width: innerWidth,
  });
  if (tuned) {
    $('#setting-quality').value = tuned.quality;
    customSelects?.sync();
  }
  view.renderTime = stamp / 1000;
  padState = gamepad.sample(readGamepads(), stamp, !combatActive());
  $('#controllerStatus').textContent = padState.connected
    ? 'CONTROLLER CONNECTED · ' + padState.name
    : 'Connect a standard gamepad. Keyboard and mouse remain available.';
  if (padState.pause) togglePause();
  if (combatActive()) {
    view.yaw -= (padState.look?.x || 0) * dt * 2 * preferences.data.sensitivity;
    view.pitch = clamp(
      view.pitch + (padState.look?.y || 0) * dt * 3 * preferences.data.sensitivity,
      3,
      12,
    );
    for (const kind of padState.actions) if (kind !== 'sprint') action(kind);
  } else {
    const menuHandled = navigateGamepad(document, window, padState, customSelects);
    if (padState.cancel && !menuHandled) navigateBack();
  }
  let m = movement(),
    input = {
      x: m.x,
      z: m.z,
      block: keys.has('k') || guardTouch || padState.guard,
      sprint: keys.has('Shift') || padState.sprint,
      revive: keys.has('r') || padState.revive,
    };
  if (network.room) tickOnline(stamp, dt, input);
  else if (!online) game.update(view.hitPause > 0 ? dt * 0.12 : dt, input);
  processEvents();
  if (game.endless?.pendingMilestone && combatActive()) {
    announce('ENDLESS MILESTONE', game.endless.pendingMilestone + ' encounters conquered');
    game.endless.pendingMilestone = 0;
  }
  if (online || preferences.data.reducedEffects) {
    view.shake = 0;
    view.hitPause = 0;
  }
  game.presentationPlayer =
    online && game.mode === 'playing'
      ? localActions.sample(game.player, stamp, input, game.time)
      : null;
  discoverEnemies(progress, game);
  visuals.updateVisuals(dt);
  view.hitPause = Math.max(0, (view.hitPause || 0) - dt);
  updateHUD();
  $('#arenaNotice').hidden = true;
  updateCombatGuidance();
  const tutorial = game.training?.tutorial;
  $('#tutorialPanel').hidden = !tutorial || game.mode !== 'playing';
  document.body.classList.toggle('tutorial', !!tutorial);
  if (tutorial) {
    const step = TUTORIAL_STEPS[tutorial.step];
    $('#tutorialTitle').textContent = tutorial.complete ? 'You are ready.' : step.title;
    $('#tutorialCount').textContent = tutorial.complete
      ? 'TRAINING COMPLETE'
      : 'LESSON ' + (tutorial.step + 1) + ' / ' + TUTORIAL_STEPS.length;
    $('#tutorialText').textContent = tutorial.complete
      ? 'You have landed a real parry and learned the essentials. Enter a campaign or return to Training.'
      : step.text;
    const tokens =
      {
        move: ['w', 'a', 's', 'd'],
        attack: ['j'],
        heavy: ['h'],
        dodge: [' '],
        block: ['k'],
        parry: ['k'],
        ability: ['q'],
        stamina: [],
      }[step?.id] || [];
    $('#tutorialKeys').textContent =
      tokens.map((k) => keyLabel(preferences.data.bindings[k])).join(' · ') +
      (tutorial.complete ? '' : step?.id === 'parry' ? ' · TAP AT IMPACT' : '');
    if (!tutorial.complete && view.mobileControlsActive)
      $('#tutorialKeys').textContent = {
        move: 'MOVE STICK',
        attack: 'ATTACK',
        heavy: 'HEAVY',
        dodge: 'DODGE',
        block: 'HOLD GUARD',
        parry: 'RELEASE, THEN TAP GUARD AT IMPACT',
        ability: 'Q · PIECE ABILITY',
        stamina: 'RELEASE GUARD',
      }[step.id];
    else if (!tutorial.complete && padState.connected)
      $('#tutorialKeys').textContent = {
        move: 'LEFT STICK',
        attack: 'RB',
        heavy: 'RT',
        dodge: 'B',
        block: 'HOLD LB',
        parry: 'RELEASE, THEN TAP LB AT IMPACT',
        ability: 'Y',
        stamina: 'RELEASE LB',
      }[step.id];
    if (step?.id === 'ability' && game.abilityReadyAt > game.time)
      $('#tutorialKeys').textContent +=
        ' · Ready in ' + Math.ceil(game.abilityReadyAt - game.time) + 's';
    $('#tutorialFill').style.width =
      (tutorial.complete ? 100 : (100 * tutorial.step) / TUTORIAL_STEPS.length) + '%';
    $('#finishTutorial').hidden = !tutorial.complete;
  }
  if (document.body.classList.contains('menu')) {
    $('#rejoinCoop').hidden = !network.recovery() || !!network.room;
    $('#startTutorial').hidden = preferences.data.tutorialCompleted || game.mode === 'paused';
    $('#qualityMode').value = preferences.data.qualityMode;
    $('#performanceNotice').textContent =
      preferences.data.qualityMode === 'manual'
        ? 'Manual graphics preset.'
        : preferences.data.performanceCalibrated
          ? 'Automatic preset: ' +
            preferences.data.quality.toUpperCase() +
            ' · measured on this device.'
          : 'Measuring performance while the menu is open…';
    $('#endlessRecords').innerHTML = endlessRecords
      .rows()
      .map(
        (r) =>
          `<span>${r.id.charAt(0).toUpperCase() + r.id.slice(1)} <b>${r.cleared || '—'}</b></span>`,
      )
      .join('');
    $('#endlessLegacy').textContent = endlessRecords.legacy
      ? 'Earlier overall record: ' + endlessRecords.legacy + ' (difficulty not recorded).'
      : '';
    $('#continueRun').hidden = !runs.available || game.mode === 'paused' || !!network.room;
    const c = checkpoints.get(chapter);
    $('#resumeCheckpoint').disabled = !c || !!network.room;
    $('#resumeCheckpoint').hidden = !c || runs.available || game.mode === 'paused';
    if (game.mode === 'ready') {
      $('#start').textContent = runs.available ? 'CONTINUE RUN' : c ? 'CONTINUE CAMPAIGN' : 'PLAY';
    }
    $('#playSummary').textContent = game.mode === 'paused'
      ? 'Your run is paused. Pick up where you left off.'
      : game.mode === 'ready' && runs.available
        ? 'Your saved run is ready. Continue where you left off.'
        : game.mode === 'ready' && c
          ? 'Continue encounter ' + (c.wave + 1) + ' · ' + CHAPTERS[c.chapter].name
          : CHAPTERS[chapter].name + ' · ' + ($('#soloDifficulty').value || 'standard').replace(/^./, (c) => c.toUpperCase());
    $('#checkpointNotice').textContent = c
      ? 'Saved encounter ' + (c.wave + 1) + ' / 5 · ' + CHAPTERS[c.chapter].name
      : 'A checkpoint saves when an encounter begins. Full-run mode restarts from encounter one.';
    customSelects?.sync();
  }
  updateAmbience();
  combatAudio.stamina(game, stamp);
  mobileControls?.update({
    coop: online && selectedMode === 'coop',
    ritual:
      game.mode === 'playing' &&
      ((game.arenaObjective?.kind === 'ritual' && !game.arenaObjective.complete) ||
        (game.secretPortal && !game.secretPortal.used)),
  });
  view.mobileControlsActive = !!mobileControls?.active;
  updateConnectionHUD(stamp);
  updateUpgradePanel();
  updateNavigation();
  visuals.render();
  if (awardUntil && stamp > awardUntil) {
    $('#awardToast').hidden = true;
    awardUntil = 0;
  }
  if (!awardUntil && awards.length) {
    const a = awards.shift();
    $('#awardName').textContent = a.name;
    $('#awardReward').textContent = 'Reward unlocked · ' + a.reward;
    $('#awardToast').hidden = false;
    awardUntil = stamp + 4500;
    audioFx('heal');
  }
  if (stamp > syncAt && progress.netDirty) {
    syncAt = stamp + 30000;
    syncProfile();
  }
  requestAnimationFrame(frame);
}

try {
  visuals = createVisuals(THREE, game, view, $);
  bind();
  hub = createHub(progress, {
    beforeShow: () => {
      mobileControls?.cancel();
      customSelects?.close();
      settingsUI?.cancel();
    },
    shown: () => {
      updateNavigation();
    },
    navigate: () => {
      resetCombatInput();
      if (!online && game.mode === 'playing') pause();
    },
    chapter: selectChapter,
    skin: () => visuals.applySkin(SKINS.find((s) => s.id === progress.data.skin)),
    match: beginMatch,
    cancel: () => network.leave(),
  });
  customSelects?.sync();
  network.onState = acceptState;
  network.onError = (e) => {
    $('#networkNotice').textContent = e;
    if (online) resetCombatInput();
  };
  progress.onAward = (a) => awards.push(a);
  visuals.applySkin(SKINS.find((s) => s.id === progress.data.skin) || SKINS[0]);
  document.body.classList.add('menu');
  $('#start').disabled = false;
  $('#start').textContent = 'PLAY';
  requestAnimationFrame(frame);
} catch (e) {
  console.error(e);
  $('#error').hidden = false;
  $('#errorText').textContent = 'The 3D arena could not start: ' + e.message;
}
