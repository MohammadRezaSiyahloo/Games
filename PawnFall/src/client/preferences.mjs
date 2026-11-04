import { cleanTouchLayouts } from './mobile-controls.mjs';
export const LEGACY_BINDINGS = {
  w: 'KeyW',
  a: 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  j: 'KeyJ',
  h: 'KeyH',
  k: 'KeyK',
  ' ': 'Space',
  q: 'KeyQ',
  e: 'KeyE',
  f: 'KeyF',
  Shift: 'ShiftLeft',
  r: 'KeyR',
  g: 'KeyG',
};
export const DEFAULT_BINDINGS = {
  w: 'KeyW',
  a: 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  j: 'Mouse0',
  h: 'KeyE',
  k: 'Mouse2',
  ' ': 'Space',
  q: 'KeyQ',
  e: 'Mouse1',
  f: 'KeyR',
  Shift: 'ShiftLeft',
  r: 'KeyF',
  g: 'Mouse3',
};
export const isBindingCode = (code) =>
  typeof code === 'string' &&
  /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|Mouse[0-4])$/.test(code) &&
  code !== 'KeyP';
export const BINDING_LABELS = {
  w: 'Forward',
  a: 'Left',
  s: 'Back',
  d: 'Right',
  j: 'Attack',
  h: 'Heavy attack',
  k: 'Guard',
  ' ': 'Roll',
  q: 'Piece ability',
  e: 'Lock on',
  f: 'Heal',
  Shift: 'Sprint',
  r: 'Revive (hold)',
  g: 'Team ping',
};

export class Preferences {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.data = {
      difficulty: 'standard',
      master: 0.8,
      sfx: 0.8,
      ambience: 0.35,
      audioEnabled: false,
      quality: 'medium',
      qualityMode: 'auto',
      performanceCalibrated: false,
      tutorialCompleted: false,
      combatCues: true,
      directionalAudio: true,
      touchMode: 'auto',
      touchScale: 1,
      touchOpacity: 0.85,
      touchLeftHanded: false,
      touchLockAssist: true,
      mobilePerformance: true,
      touchLayouts: {},
      reducedEffects: false,
      sensitivity: 1,
      bindings: { ...DEFAULT_BINDINGS },
      bindingVersion: 2,
    };
    try {
      const saved = JSON.parse(storage.getItem('pawnfall-settings-v1') || '{}');
      if (
        saved?.bindings &&
        saved.bindingVersion !== 2 &&
        Object.entries(saved.bindings).every(([k, v]) => LEGACY_BINDINGS[k] === v)
      )
        saved.bindings = { ...DEFAULT_BINDINGS };
      if (saved.quality && !saved.qualityMode) saved.qualityMode = 'manual';
      this.set(saved, false);
    } catch {}
  }

  set(values, save = true) {
    for (const key of ['master', 'sfx', 'ambience', 'sensitivity'])
      if (Number.isFinite(Number(values[key])))
        this.data[key] = Math.max(
          key === 'sensitivity' ? 0.4 : 0,
          Math.min(key === 'sensitivity' ? 2 : 1, Number(values[key])),
        );
    if (['pilgrim', 'standard', 'veteran', 'nightmare'].includes(values.difficulty))
      this.data.difficulty = values.difficulty;
    if (['low', 'medium', 'high'].includes(values.quality)) this.data.quality = values.quality;
    if (['auto', 'manual'].includes(values.qualityMode)) this.data.qualityMode = values.qualityMode;
    for (const key of ['performanceCalibrated', 'tutorialCompleted'])
      if (typeof values[key] === 'boolean') this.data[key] = values[key];
    for (const key of ['reducedEffects', 'audioEnabled'])
      if (typeof values[key] === 'boolean') this.data[key] = values[key];
    if (values.bindings && typeof values.bindings === 'object') {
      const b = { ...DEFAULT_BINDINGS, ...values.bindings };
      if (
        !Object.hasOwn(values.bindings, 'h') &&
        Object.entries(b).some(([k, v]) => k !== 'h' && v === b.h)
      )
        b.h =
          ['KeyU', 'KeyV', 'KeyZ', 'Digit1'].find((code) => !Object.values(b).includes(code)) ||
          'Digit2';
      if (
        Object.keys(b).length === Object.keys(DEFAULT_BINDINGS).length &&
        Object.values(b).every((c) => isBindingCode(c)) &&
        new Set(Object.values(b)).size === Object.values(b).length
      )
        this.data.bindings = b;
    }
    if (['auto', 'on', 'off'].includes(values.touchMode)) this.data.touchMode = values.touchMode;
    for (const key of [
      'touchLeftHanded',
      'touchLockAssist',
      'mobilePerformance',
      'combatCues',
      'directionalAudio',
    ])
      if (typeof values[key] === 'boolean') this.data[key] = values[key];
    for (const [key, a, b] of [
      ['touchScale', 0.85, 1.35],
      ['touchOpacity', 0.35, 1],
    ])
      if (Number.isFinite(values[key])) this.data[key] = Math.max(a, Math.min(b, values[key]));
    if (values.touchLayouts) this.data.touchLayouts = cleanTouchLayouts(values.touchLayouts);
    if (save)
      try {
        this.storage.setItem('pawnfall-settings-v1', JSON.stringify(this.data));
      } catch {}
  }

  rebind(token, code) {
    if (!(token in DEFAULT_BINDINGS) || !isBindingCode(code))
      return 'Use a mouse button, letter, number, Space or Shift. P and Escape stay reserved for pause.';
    const existing = Object.entries(this.data.bindings).find(([k, v]) => k !== token && v === code);
    if (existing)
      return 'Already assigned to ' + BINDING_LABELS[existing[0]] + '. Choose another key first.';
    this.set({ bindings: { ...this.data.bindings, [token]: code } });
    return '';
  }
}
export const keyLabel = (code) =>
  code?.startsWith('Mouse')
    ? { Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB', Mouse3: 'M4', Mouse4: 'M5' }[code]
    : code === 'Space'
      ? 'SPACE'
      : code?.startsWith('Shift')
        ? 'SHIFT'
        : code?.replace(/^Key|^Digit/, '') || '';
