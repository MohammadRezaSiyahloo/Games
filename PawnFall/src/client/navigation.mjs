// One back action for pointer, keyboard, controller and browser navigation.
export function backDestination(s) {
  if (s.dropdown) return 'dropdown';
  if (s.binding) return 'binding';
  if (s.guide) return 'guide';
  if (s.bestiary) return 'bestiary';
  if (s.disclosure) return 'disclosure';
  if (s.connected) return 'leave';
  if (s.intermission) return 'pause';
  if (s.menu && s.tab !== 'campaign') return 'campaign';
  if (s.paused) return 'resume';
  if (s.result) return 'home';
  if (s.playing) return 'pause';
  return null;
}

export function bindNavigation(view, doc, { state, back }) {
  const keydown = (e) => {
    if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.code === 'Escape' || e.key === 'Escape') && !e.repeat) {
      if (back()) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if (e.key !== 'Tab') return;
    const s = state();
    const root = s.guide
      ? doc.querySelector('#guide')
      : s.intermission
        ? doc.querySelector('#upgradePanel')
        : null;
    if (!root) return;
    const items = [
      ...root.querySelectorAll(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]',
      ),
    ].filter((el) => !el.hidden && el.getClientRects().length);
    if (!items.length) return;
    const first = items[0],
      last = items.at(-1),
      active = doc.activeElement;
    if (
      !items.includes(active) ||
      (!e.shiftKey && active === last) ||
      (e.shiftKey && active === first)
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  };
  view.addEventListener('keydown', keydown);
  const history = view.history;
  // A single same-document guard turns phone/browser Back into the same UI action.
  // Once already home, Back continues to the preceding document normally.
  const popstate = (e) => {
    if (e.state?.pawnfallNav !== 'base') return;
    if (back()) history.pushState({ ...history.state, pawnfallNav: 'guard' }, '');
    else history.back();
  };
  if (history?.pushState && history?.replaceState) {
    try {
      if (history.state?.pawnfallNav !== 'guard') {
        history.replaceState({ ...history.state, pawnfallNav: 'base' }, '');
        history.pushState({ ...history.state, pawnfallNav: 'guard' }, '');
      }
      view.addEventListener('popstate', popstate);
    } catch {
      /* Navigation still works when browser history is restricted. */
    }
  }
  return { keydown, popstate };
}
