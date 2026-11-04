import { weaponById, UPGRADES } from '../shared/arsenal.mjs';
import { pieceById } from '../shared/piece-abilities.mjs';
import { chronicleData, chronicleText } from '../shared/run-chronicle.mjs';
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const pretty = (value) =>
  String(value)
    .replace('forge:', 'Forged ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
const duration = (seconds) =>
  Math.floor(seconds / 60) + 'm ' + String(seconds % 60).padStart(2, '0') + 's';

export function showChronicle(game, result, doc = document) {
  const data = chronicleData(game, result);
  doc.querySelector('#runOutcome').hidden =
    !!doc.querySelector('#panel-campaign')?.hidden &&
    !!doc.querySelector('#panel-multiplayer')?.hidden;
  doc.querySelector('#runChronicle').hidden = false;
  doc.querySelector('#chronicleResult').textContent = result;
  doc.querySelector('#chronicleText').textContent = chronicleText(data);
  const metrics = [
    ['SOULS CLAIMED', data.souls.toLocaleString()],
    ['TIME SURVIVED', duration(data.seconds)],
    ['ENCOUNTERS CLEARED', data.encounters],
    game.endless
      ? ['PERSONAL BEST', game.endless.best ?? game.endless.cleared]
      : game.bossRush?.finished
        ? ['RUSH SCORE', game.bossRush.score.toLocaleString()]
        : ['BOSSES DEFEATED', data.bosses.length],
  ];
  doc.querySelector('#chronicleStats').innerHTML = metrics
    .map(
      ([label, value]) =>
        `<div class="resultMetric"><b>${escape(value)}</b><span>${label}</span></div>`,
    )
    .join('');
  const blessings = data.blessings.map((row) => {
    const [id, rank] = row.split(' ');
    return (UPGRADES.find((u) => u.id === id)?.name || pretty(id)) + ' ×' + rank;
  });
  doc.querySelector('#chronicleBuild').innerHTML =
    `<small>YOUR FINAL BUILD</small><p>${escape(pieceById(data.piece).name)}<span> / </span>${escape(weaponById(data.weapon).name)}</p>` +
    (blessings.length
      ? `<div class="blessingTags">${blessings.map((x) => `<span>${escape(x)}</span>`).join('')}</div>`
      : '');
  const rows = [
    ['Promotion', data.promotion],
    ['Passages', data.routes.join(' · ')],
    ['Camp choices', data.events.map(pretty).join(' · ')],
    ['Champions', data.champions.join(' · ')],
    ['Bosses', data.bosses.map(pretty).join(' · ')],
    ['Rival', data.rival],
    ['Team combinations', data.combos || ''],
  ].filter(([, value]) => value && value !== 'None' && value !== 'Not encountered');
  doc.querySelector('#chronicleDetails').innerHTML = rows.length
    ? `<dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(pretty(value))}</dd></div>`).join('')}</dl>`
    : '<p>No milestones recorded this run.</p>';
  return data;
}

export async function saveChronicleCard(data, doc = document, nav = navigator) {
  if (!data) return;
  const canvas = doc.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10121a';
  ctx.fillRect(0, 0, 1200, 1000);
  ctx.strokeStyle = '#be9b58';
  ctx.lineWidth = 3;
  ctx.strokeRect(35, 35, 1130, 930);
  ctx.fillStyle = '#c6a568';
  ctx.font = '20px sans-serif';
  ctx.fillText('PAWNFALL / RUN CHRONICLE', 75, 90);
  ctx.fillStyle = '#f3d596';
  ctx.font = 'bold 64px Georgia';
  ctx.fillText(data.result.toUpperCase().slice(0, 28), 75, 180);
  ctx.fillStyle = '#f0e6d5';
  ctx.font = '28px Georgia';
  ctx.fillText(`${data.piece.toUpperCase()} · ${data.weapon.toUpperCase()}`, 75, 245);
  const metrics = [
    ['SOULS CLAIMED', data.souls.toLocaleString()],
    ['TIME SURVIVED', duration(data.seconds)],
    ['ENCOUNTERS CLEARED', String(data.encounters)],
    ['BOSSES DEFEATED', String(data.bosses.length)],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 75 + (i % 2) * 535,
      y = 300 + Math.floor(i / 2) * 170;
    ctx.fillStyle = '#1b202a';
    ctx.fillRect(x, y, 515, 145);
    ctx.fillStyle = '#f1d59d';
    ctx.font = 'bold 48px Georgia';
    ctx.fillText(value, x + 24, y + 65);
    ctx.fillStyle = '#c7c0b3';
    ctx.font = '18px sans-serif';
    ctx.fillText(label, x + 24, y + 112);
  });
  ctx.fillStyle = '#c6a568';
  ctx.font = '18px sans-serif';
  ctx.fillText('YOUR FINAL BUILD', 75, 690);
  ctx.fillStyle = '#ece1ce';
  ctx.font = '24px Georgia';
  ctx.fillText(
    (pieceById(data.piece).name + ' / ' + weaponById(data.weapon).name).slice(0, 65),
    75,
    735,
  );
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#cfc6b7';
  const highlights = [
    data.blessings.map(pretty).join(' · ') || 'No blessings equipped',
    data.bosses.length
      ? 'Bosses: ' + data.bosses.map(pretty).join(' · ')
      : data.champions.length
        ? 'Champions: ' + data.champions.join(' · ')
        : 'Every attempt sharpens the next.',
  ];
  highlights.forEach((line, i) =>
    ctx.fillText(line.length > 82 ? line.slice(0, 79) + '…' : line, 75, 790 + i * 42),
  );
  ctx.fillStyle = '#a48d68';
  ctx.font = '16px sans-serif';
  ctx.fillText('PAWNFALL · THE FALLEN COURT', 75, 925);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('Could not create the victory card.');
  const file = new File([blob], 'pawnfall-run-chronicle.png', { type: 'image/png' });
  if (nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: 'Pawnfall run chronicle' });
    return;
  }
  const url = URL.createObjectURL(blob),
    link = doc.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
