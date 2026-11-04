// A styled dropdown backed by the existing select, so saving and matchmaking share one value.
export function createCustomSelects(doc = document) {
  const view = doc.defaultView || window,
    controls = [];
  let opened = null,
    search = '',
    searchedAt = 0;
  const names = {
    bestiaryFilter: 'Bestiary category',
    touchMode: 'Touch controls',
    mobilePreviewOrientation: 'Mobile layout orientation',
    soloDifficulty: 'Combat difficulty',
    runModifier: 'Solo run modifier',
    checkpointMode: 'Retry rule',
    relicSelect: 'Boss relic',
    coopDifficulty: 'Co-op difficulty',
    versusFormat: 'Versus format',
    pieceSelect: 'Chess piece',
    weaponSelect: 'Weapon',
    titleSelect: 'Your title',
    trainingEnemy: 'Training opponent',
    trainingBehavior: 'Training exercise',
    'setting-quality': 'Graphics quality',
  };
  const close = () => {
    if (!opened) return;
    opened.list.hidden = true;
    opened.trigger.setAttribute('aria-expanded', 'false');
    opened.trigger.removeAttribute('aria-activedescendant');
    opened.wrap.classList.remove('is-open');
    opened = null;
    search = '';
  };
  const position = (c) => {
    const rect = c.trigger.getBoundingClientRect(),
      vw = view.innerWidth,
      vh = view.innerHeight;
    const width = Math.min(vw - 24, Math.max(rect.width, 260));
    const below = vh - rect.bottom - 16,
      above = rect.top - 16,
      upward = below < 200 && above > below;
    c.list.style.width = width + 'px';
    c.list.style.left = Math.max(12, Math.min(rect.left, vw - width - 12)) + 'px';
    c.list.style.maxHeight = Math.max(72, Math.min(320, upward ? above : below)) + 'px';
    c.list.style.top = upward ? 'auto' : rect.bottom + 8 + 'px';
    c.list.style.bottom = upward ? vh - rect.top + 8 + 'px' : 'auto';
  };
  const highlight = (c, index) => {
    c.active = index;
    c.buttons.forEach((b, i) => b.classList.toggle('is-highlighted', i === index));
    const b = c.buttons[index];
    if (b) {
      c.trigger.setAttribute('aria-activedescendant', b.id);
      b.scrollIntoView?.({ block: 'nearest' });
    }
  };
  const open = (c) => {
    if (c.select.disabled || !c.buttons.length) return;
    close();
    opened = c;
    c.list.hidden = false;
    c.trigger.setAttribute('aria-expanded', 'true');
    c.wrap.classList.add('is-open');
    position(c);
    highlight(
      c,
      Math.max(
        0,
        c.buttons.findIndex((b) => b.dataset.value === c.select.value && !b.disabled),
      ),
    );
  };
  const choose = (c, index) => {
    const b = c.buttons[index];
    if (!b || b.disabled || c.select.disabled) return;
    const changed = c.select.value !== b.dataset.value;
    c.select.value = b.dataset.value;
    close();
    c.trigger.focus();
    if (changed) {
      c.select.dispatchEvent(new view.Event('input', { bubbles: true }));
      c.select.dispatchEvent(new view.Event('change', { bubbles: true }));
    }
    syncControl(c);
  };

  function syncControl(c) {
    const options = [...c.select.options];
    const signature = JSON.stringify(options.map((o) => [o.value, o.textContent, o.disabled]));
    if (signature !== c.signature) {
      c.signature = signature;
      c.list.replaceChildren();
      c.buttons = options.map((option, i) => {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'selectOption';
        b.id = c.select.id + '-option-' + i;
        b.setAttribute('role', 'option');
        b.tabIndex = -1;
        b.dataset.value = option.value;
        b.disabled = option.disabled;
        const [title, ...detail] = option.textContent.split('·');
        const text = doc.createElement('span');
        text.className = 'selectOptionText';
        const strong = doc.createElement('span');
        strong.className = 'selectOptionTitle';
        strong.textContent = title.trim();
        text.append(strong);
        if (detail.length) {
          const small = doc.createElement('small');
          small.textContent = detail.join('·').trim();
          text.append(small);
        }
        const check = doc.createElement('span');
        check.className = 'selectOptionCheck';
        check.textContent = '✓';
        check.setAttribute('aria-hidden', 'true');
        b.append(text, check);
        b.addEventListener('click', (e) => {
          e.preventDefault();
          choose(c, i);
        });
        b.addEventListener('pointermove', () => {
          if (!b.disabled) highlight(c, i);
        });
        c.list.append(b);
        return b;
      });
      if (opened === c)
        highlight(
          c,
          Math.max(
            0,
            options.findIndex((o) => o.value === c.select.value),
          ),
        );
    }
    c.wrap.hidden = !options.length;
    c.trigger.disabled = c.select.disabled;
    const selected = options.find((o) => o.value === c.select.value);
    c.value.textContent = selected?.textContent.split('·')[0].trim() || 'Choose an option';
    c.trigger.setAttribute(
      'aria-label',
      (names[c.select.id] || 'Choose') + ': ' + (selected?.textContent || c.value.textContent),
    );
    c.buttons.forEach((b) => {
      const selected = b.dataset.value === c.select.value;
      b.setAttribute('aria-selected', String(selected));
      b.classList.toggle('is-selected', selected);
    });
    if (opened === c && (c.select.disabled || !options.length)) close();
  }
  for (const select of doc.querySelectorAll('select')) {
    const wrap = doc.createElement('span');
    wrap.className = 'customSelect';
    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'selectTrigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', select.id + '-options');
    const value = doc.createElement('span');
    value.className = 'selectValue';
    const arrow = doc.createElement('span');
    arrow.className = 'selectArrow';
    arrow.textContent = '⌄';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.append(value, arrow);
    wrap.append(trigger);
    const list = doc.createElement('div');
    list.className = 'selectMenu';
    list.id = select.id + '-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', names[select.id] || 'Options');
    list.hidden = true;
    select.insertAdjacentElement('afterend', wrap);
    doc.body.append(list);
    select.hidden = true;
    select.tabIndex = -1;
    const c = { select, wrap, trigger, value, list, buttons: [], active: 0 };
    controls.push(c);
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (opened === c) close();
      else open(c);
    });
    select.addEventListener('change', () => syncControl(c));
    syncControl(c);
  }
  view.addEventListener(
    'keydown',
    (e) => {
      const c = opened || controls.find((c) => c.trigger === doc.activeElement);
      if (!c || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const key = e.key;
      if (key === 'Tab') {
        close();
        return;
      }
      if (
        !['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(key) &&
        !(opened && key?.length === 1)
      )
        return;
      if (!opened && ['Enter', ' '].includes(key)) return; // native button activation opens once
      if (!opened && key === 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (key === 'Escape') {
        close();
        c.trigger.focus();
        return;
      }
      if (!opened) open(c);
      if (['Enter', ' '].includes(key)) {
        choose(c, c.active);
        return;
      }
      const enabled = c.buttons.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
      if (!enabled.length) return;
      let i = enabled.indexOf(c.active);
      if (key === 'ArrowDown') i = (i + 1) % enabled.length;
      else if (key === 'ArrowUp') i = (i - 1 + enabled.length) % enabled.length;
      else if (key === 'Home') i = 0;
      else if (key === 'End') i = enabled.length - 1;
      else {
        const now = Date.now();
        search = now - searchedAt < 700 ? search + key.toLowerCase() : key.toLowerCase();
        searchedAt = now;
        const match = enabled.find((n) =>
          c.buttons[n].textContent
            .replace(/^[^a-z0-9]+/i, '')
            .toLowerCase()
            .startsWith(search),
        );
        if (match !== undefined) highlight(c, match);
        return;
      }
      highlight(c, enabled[i]);
    },
    true,
  );
  doc.addEventListener(
    'pointerdown',
    (e) => {
      if (opened && !opened.wrap.contains(e.target) && !opened.list.contains(e.target)) close();
    },
    true,
  );
  doc.addEventListener(
    'scroll',
    (e) => {
      if (opened && !opened.list.contains(e.target)) close();
    },
    true,
  );
  view.addEventListener('resize', close);
  return {
    sync() {
      for (const c of controls) syncControl(c);
    },
    close,
    get opened() {
      return !!opened;
    },
    dismiss() {
      const trigger = opened?.trigger;
      if (!trigger) return false;
      close();
      trigger.focus();
      return true;
    },
    controls,
  };
}
