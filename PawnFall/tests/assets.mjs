import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAssets } from '../scripts/validate-assets.mjs';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
validateAssets(html, css);
assert.throws(
  () => validateAssets(html, html),
  /contains HTML/,
  'the reported regression is rejected',
);
assert.throws(() => validateAssets(html, css + '}'), /Unbalanced/);
assert.throws(() => validateAssets(html, css + '/* unfinished'), /Unterminated/);
assert.throws(
  () => validateAssets(html, css.replaceAll('#overlay', '#missing-overlay')),
  /Missing/,
);
assert(/#overlay\s*\{[^}]*z-index\s*:\s*[1-9]/.test(css), 'menu has a layer above the scene');
assert(/#viewport[^}]*position\s*:\s*absolute/.test(css), 'canvas leaves document flow');
assert(
  /html,\s*body\s*\{[^}]*margin\s*:\s*0[^}]*overflow\s*:\s*hidden/.test(css),
  'page has no default margin or overflow',
);
console.log(
  'PASS: HTML/CSS asset contract, rejected HTML-in-CSS regression, balanced syntax, menu stacking and viewport layout.',
);
// Check the actual menu palette against its dark panel background.

function luminance(hex) {
  const values = hex
    .slice(1)
    .match(/../g)
    .slice(0, 3)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
const menuColor = css.match(
  /\.hubPanel\s+p,\s*\.hub\s+\.intro\s+p,\s*\.subtle[^{}]*\{\s*color:\s*(#[0-9a-f]{6})/i,
)?.[1];
assert(menuColor, 'menu text palette exists');
const contrast = (luminance(menuColor) + 0.05) / (luminance('#101825') + 0.05);
assert(contrast >= 7, 'supporting menu copy has strong contrast on the lightest panel color');
console.log('PASS: menu text contrast ' + contrast.toFixed(1) + ':1.');
