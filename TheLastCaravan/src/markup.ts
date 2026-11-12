import { resources } from './content.ts';
import type { Supplies } from './content.ts';
import { icon } from './icons.ts';
import { digits, t } from './locale.ts';

export const esc = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const disabled = (value: boolean) => (value ? ' disabled' : '');
export const signed = (n: number) => (n > 0 ? '+' + digits(n) : '−' + digits(Math.abs(n)));
export const changes = (cost: Partial<Supplies> = {}) =>
  resources
    .flatMap((key) => {
      const n = cost[key];
      return n
        ? [
            `<span class="${n > 0 ? 'gain' : 'loss'}">${icon(key, 15)} <bdi dir="ltr">${signed(n)}</bdi> ${t(key)}</span>`,
          ]
        : [];
    })
    .join('');
export const button = (name: string, act: string, extra = '', cls = 'secondary') =>
  `<button class="${cls}" data-act="${act}" ${extra}>${name}</button>`;
export const actionRow = (
  label: string,
  summary: string,
  act: string,
  id: string,
  blocked: boolean,
) =>
  `<button class="choice" data-act="${act}" data-id="${id}" ${disabled(blocked)}><span><strong>${label}</strong><small>${summary}</small></span>${icon('chevron', 18)}</button>`;
