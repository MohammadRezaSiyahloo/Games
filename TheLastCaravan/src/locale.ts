import { faContent } from './fa-content.ts';
import { faUI } from './fa-ui.ts';
import { faChronicle } from './fa-chronicle.ts';
import { faScenes } from './fa-scenes.ts';
import { faHardships } from './fa-hardships.ts';
import { faLetter } from './fa-letter.ts';
import { offers, resources } from './content.ts';
import { roles, upgrades } from './expansion.ts';

export type Language = 'en' | 'fa';
let language: Language = 'en';
const fa: Record<string, string> = Object.assign(
  Object.create(null),
  faContent,
  faUI,
  faChronicle,
  faLetter,
  faHardships,
  faScenes,
);
export const isPersian = () => language === 'fa';
export function useLanguage(next: Language) {
  language = next;
}
export function digits(value: string | number) {
  const text = String(value);
  return isPersian() ? text.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : text;
}
export function t(text: string, ...args: (string | number)[]) {
  const template = isPersian() ? (fa[text] ?? text) : text;
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)];
    return typeof value === 'number' ? digits(value) : (value ?? match);
  });
}
export const percent = (value: number) => digits(value) + (isPersian() ? '٪' : '%');
export const arrow = () => (isPersian() ? '←' : '→');

const journalPatterns: [RegExp, string, (...args: string[]) => string[]][] = [
  [/^(.+) recovered from their injury\.$/, '{0} recovered from their injury.', (name) => [t(name)]],
  [
    /^(.+) suffered an injury: (.+)\.$/,
    '{0} suffered an injury: {1}.',
    (name, injury) => [t(name), t(injury)],
  ],
  [
    /^(.+) takes Lina’s letter from Tomas’s coat and puts it somewhere dry\.$/,
    '{0} takes Lina’s letter from Tomas’s coat and puts it somewhere dry.',
    (name) => [t(name)],
  ],
  [
    /^(.+) finds Lina at the gate and gives her Tomas’s letter\. She asks .+ to stay while she reads it\.$/,
    '{0} finds Lina at the gate and gives her Tomas’s letter. She asks {0} to stay while she reads it.',
    (name) => [t(name)],
  ],
  [
    /^(.+) hands Lina the unfinished letter\. She recognizes the handwriting before she reads a word, then asks what the road was like with her father\.$/,
    '{0} hands Lina the unfinished letter. She recognizes the handwriting before she reads a word, then asks what the road was like with her father.',
    (name) => [t(name)],
  ],

  [
    /^(.+) lost (\d+) morale in grief\.$/,
    '{0} lost {1} morale in grief.',
    (name, qty) => [t(name), digits(qty)],
  ],
  [
    /^(.+) and (.+) shared a watch\. Their bond is now (\d+)\.$/,
    '{0} and {1} shared a watch. Their bond is now {2}.',
    (a, b, qty) => [t(a), t(b), digits(qty)],
  ],
  [
    /^(.+) cost the crew up to (\d+) morale\.$/,
    '{0} cost the crew up to {1} morale.',
    (name, qty) => [t(name), digits(qty)],
  ],

  [
    /^Cargo was full\. Left (\d+) (\w+) behind\.$/,
    'Cargo was full. Left {0} {1} behind.',
    (qty, resource) => [digits(qty), t(resource)],
  ],
  [/^(.+) died on the journey\.$/, '{0} died on the journey.', (name) => [t(name)]],
  [
    /^Reached (.+)\. Used (\d+) food and (\d+) water\. Wagon wear (\d+)\.$/,
    'Reached {0}. Used {1} food and {2} water. Wagon wear {3}.',
    (name, ...nums) => [t(name), ...nums.map(digits)],
  ],
  [
    /^Short by (\d+) food and (\d+) water\. The crew lost (\d+) health each\.$/,
    'Short by {0} food and {1} water. The crew lost {2} health each.',
    (...nums) => nums.map(digits),
  ],
  [
    /^Lean rations cost each traveler (\d+) health and (\d+) morale\.$/,
    'Lean rations cost each traveler {0} health and {1} morale.',
    (...nums) => nums.map(digits),
  ],
  [
    /^Found (.+) on arrival\.$/,
    'Found {0} on arrival.',
    (items) => [
      items
        .split(' and ')
        .map((item) => {
          const [count, resource] = item.split(' ');
          return resources.some((key) => key === resource)
            ? digits(count) + ' ' + t(resource)
            : item;
        })
        .join(' و '),
    ],
  ],
  [
    /^Spent 2 materials to restore (\d+) wagon condition\.$/,
    'Spent 2 materials to restore {0} wagon condition.',
    (qty) => [digits(qty)],
  ],
  [
    /^(.+) received medicine and recovered (\d+) health\.$/,
    '{0} received medicine and recovered {1} health.',
    (name, qty) => [t(name), digits(qty)],
  ],
  [
    /^Rested for a day\. Used (\d+) food and (\d+) water\.$/,
    'Rested for a day. Used {0} food and {1} water.',
    (...nums) => nums.map(digits),
  ],
  [
    /^(.+) now serves as (.+)\.$/,
    '{0} now serves as {1}.',
    (name, role) => [t(name), t(roles.find((r) => r.toLowerCase() === role) ?? role)],
  ],
  [
    /^(.+) joined the caravan as (.+)\.$/,
    '{0} joined the caravan as {1}.',
    (name, role) => [t(name), t(roles.find((r) => r.toLowerCase() === role) ?? role)],
  ],
  [
    /^Installed (.+)\.$/,
    'Installed {0}.',
    (item) => [t(upgrades.find((u) => u.name.toLowerCase() === item)?.name ?? item)],
  ],
  [
    /^Spent a day foraging and 2 water\. Brought back (\d+) food\.$/,
    'Spent a day foraging and 2 water. Brought back {0} food.',
    (qty) => [digits(qty)],
  ],
  [
    /^Spent a day foraging and 2 water\. Brought back (\d+) food and 2 materials\.$/,
    'Spent a day foraging and 2 water. Brought back {0} food and 2 materials.',
    (qty) => [digits(qty)],
  ],
  [
    /^(.+) takes the fallen traveler’s place\.$/,
    '{0} takes the fallen traveler’s place.',
    (name) => [t(name)],
  ],
];
export function journalText(text: string) {
  if (!isPersian()) return text;
  if (fa[text]) return fa[text];
  const offer = offers.find((o) => text.startsWith(o.label + ' at '));
  if (offer) return t('{0} at {1}.', t(offer.label), t(text.slice(offer.label.length + 4, -1)));
  for (const [pattern, template, translate] of journalPatterns) {
    const match = text.match(pattern);
    if (match) return t(template, ...translate(...match.slice(1)));
  }
  return text;
}
