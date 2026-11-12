import { sceneFor } from './comic-scenes.ts';
import { isPersian, t } from './locale.ts';
import { esc } from './markup.ts';

export function comicView(id: string, narrative: string, region: number, showSpeech = true) {
  const scene = sceneFor(id);
  const fallback = region === 1 ? 'mountains' : region === 2 ? 'ash' : 'forest';
  const frames = scene?.art ?? [fallback, 'watch', fallback];
  const sentences = narrative
    .match(/[^.!?؟]+[.!?؟]+[”»]?|[^.!?؟]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [narrative];
  const speech = scene && showSpeech ? (isPersian() ? scene.fa : scene.en) : '';
  const captions = [sentences[0], sentences.slice(1).join(' '), ''];
  return `<div class="event-comic" aria-label="${t('Illustrated encounter')}">
    ${frames
      .map(
        (art, index) => `<figure class="comic-panel">
      <div class="comic-art" data-art="${art}" aria-hidden="true"></div>
      ${index === 2 && speech ? `<blockquote class="comic-speech">${esc(speech)}</blockquote>` : ''}
      ${captions[index] ? `<figcaption>${esc(captions[index])}</figcaption>` : ''}
    </figure>`,
      )
      .join('')}
  </div>`;
}
