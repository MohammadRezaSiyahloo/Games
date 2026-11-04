// Build-time guard for the HTML/CSS contract. CPU scene tests cannot detect missing layout.
export function validateAssets(html, css) {
  if (!/^\s*<!doctype\s+html/i.test(html)) throw Error('index.html is not an HTML document.');
  if (/<\s*(?:!doctype|html|head|body|script|link)\b/i.test(css))
    throw Error('style.css contains HTML. Restore the stylesheet before building.');
  if (!/href=["'](?:\.\/)?style\.css(?:\?[^"']*)?["']/.test(html))
    throw Error('index.html must load style.css.');
  for (const selector of [
    '#viewport',
    '#overlay',
    '.hub',
    '.equipment',
    '[hidden]',
    '#touch',
    '#sessionPanel',
    '#abilityHud',
    '#deathFX',
  ])
    if (!css.includes(selector)) throw Error('Missing required interface styles: ' + selector);
  let depth = 0,
    quote = '',
    comment = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i],
      next = css[i + 1];
    if (comment) {
      if (c === '*' && next === '/') {
        comment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '*') {
      comment = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}' && --depth < 0) throw Error('Unbalanced stylesheet braces.');
  }
  if (depth !== 0 || quote || comment)
    throw Error('Unterminated stylesheet block, string or comment.');
}
