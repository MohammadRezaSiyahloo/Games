import type { Game } from './game.ts';
import { bondLevel } from './frontier.ts';

export const letterStages = ['absent', 'started', 'choice', 'sealed', 'draft'] as const;
export type LetterStage = (typeof letterStages)[number];
export type LetterDecision = 'finish' | 'keep';
export const letterTitle = 'A Letter for Lina';
export const letterIntro =
  'While the others load the wagon, Tomas tucks a half-written letter inside his coat. “My daughter Lina is in the Last City,” he says. “I keep trying to tell her why it took me so long.”';
export const tomasIndex = (g: Game) => g.crew.findIndex((member) => member.id === 'tomas');
export const tomasLives = (g: Game) => Boolean(g.crew[tomasIndex(g)]?.health);
export const letterPending = (g: Game) =>
  g.status === 'travel' && !g.pending && g.letter === 'choice';
export const letterNarrative = (g: Game) =>
  tomasLives(g)
    ? 'Tomas sets the letter on an overturned crate. He has crossed out the first line so often the paper is starting to tear. “If we have a little food to share,” he says, “would you sit with me while I finish it?”'
    : 'You find Lina’s letter folded inside Tomas’s coat. It stops halfway through a sentence. You could spend a ration sitting together and add a note about him, or carry his own words as he left them.';
export function letterChoices(g: Game) {
  const alive = tomasLives(g);
  return {
    finish: {
      label: alive ? 'Share a ration and help him finish' : 'Share a ration and write Lina a note',
      text: alive
        ? 'Over a shared ration, Tomas finally writes what he wanted to say. He asks you to make sure Lina gets the letter if he cannot deliver it himself.'
        : 'Over a shared ration, each traveler tells one thing they remember about Tomas. You write those memories on the back and fold the letter along his old creases.',
      food: 1,
      morale: alive ? 8 : 3,
      scope: alive ? 'Tomas' : 'each',
    },
    keep: {
      label: 'Carry the unfinished letter',
      text: alive
        ? 'You tell Tomas the letter can travel as it is. He folds the unfinished page and asks you to see that it reaches Lina.'
        : 'You leave the unfinished sentence as Tomas wrote it. The crew wraps the letter in dry cloth and promises to carry it to Lina.',
      food: 0,
      morale: 0,
      scope: 'each',
    },
  };
}
const roadBeats = [
  'At the next halt, Tomas pats his coat to check for Lina’s letter. He asks how far it is to the gate, though you told him that morning.',
  'When the wagon stops, someone checks that Lina’s letter is still dry. It is the first thing you pack again before moving on.',
];
export function letterRoadBeat(g: Game) {
  if (g.letter !== 'sealed' && g.letter !== 'draft') return '';
  if (g.chronicle.some((page) => page.changes.some((change) => roadBeats.includes(change.reason))))
    return '';
  return roadBeats[tomasLives(g) ? 0 : 1];
}
export const letterBearer = (g: Game) =>
  g.crew.reduce((best, member, i) => {
    if (!member.health) return best;
    return best < 0 || bondLevel(g, member.id, 'tomas') > bondLevel(g, g.crew[best].id, 'tomas')
      ? i
      : best;
  }, -1);
export const custodySuffix = 'takes Lina’s letter from Tomas’s coat and puts it somewhere dry.';
type Ending = { text: string; bearer?: number };
export function letterEnding(g: Game): Ending | null {
  if (g.letter === 'absent' || g.status === 'travel') return null;
  if (g.status === 'lost') {
    return {
      text: 'Lina’s letter never reaches the Last City. Its creases hold the shape of the journey it almost made.',
    };
  }
  if (tomasLives(g))
    return {
      text:
        g.letter === 'sealed'
          ? 'At the gate, Tomas spots Lina in the bread line. She reads the letter slowly, then asks him to tell her the part he could not fit on the page.'
          : 'At the gate, Tomas finds Lina and gives her the unfinished letter. She takes his hand and asks him to finish the sentence aloud.',
    };
  const survivor = letterBearer(g);
  if (survivor < 0) return null;
  return {
    bearer: survivor,
    text:
      g.letter === 'sealed'
        ? '{0} finds Lina at the gate and gives her Tomas’s letter. She asks {0} to stay while she reads it.'
        : '{0} hands Lina the unfinished letter. She recognizes the handwriting before she reads a word, then asks what the road was like with her father.',
  };
}
export const withBearer = (ending: Ending, name: (i: number) => string) =>
  ending.bearer === undefined ? ending.text : ending.text.replaceAll('{0}', name(ending.bearer));
