// Picks today's cards (docs/01 §4): due reviews first, up to about a third of the target, then new
// words in curriculum order, then more due reviews if new words run out. Never the same word twice.
import type { DailyTarget, LevelWords, MediaAsset, SessionCard, Word, WordProgress } from '../content/types';

export const REVIEW_CAP: Record<DailyTarget, number> = { 10: 3, 15: 5, 20: 7 };

/**
 * All content is still an unreviewed draft, so drafts are allowed for now and every screen says so.
 * Turn this off once reviewed cards exist: docs/01 §7 keeps drafts out of public study.
 */
export const INCLUDE_DRAFTS = true;

export function selectDailyCards({ target, content, progress, now, includeDrafts = INCLUDE_DRAFTS }: {
  target: DailyTarget;
  content: LevelWords;
  progress: WordProgress[];
  now: Date;
  includeDrafts?: boolean;
}): SessionCard[] {
  const words = new Map(content.words.map(w => [w.id, w]));
  const media = new Map(content.media.map(m => [m.id, m]));
  const eligible = content.prompts
    .filter(p => (includeDrafts || p.status === 'reviewed') && words.has(p.wordId) && (!p.imageAssetId || media.has(p.imageAssetId)))
    .sort((a, b) => words.get(a.wordId)!.curriculumOrder - words.get(b.wordId)!.curriculumOrder || a.id.localeCompare(b.id));
  const byId = new Map(eligible.map(p => [p.id, p]));
  const seen = new Map(progress.map(p => [p.promptId, p]));

  const due = progress
    .filter(p => byId.has(p.promptId) && Date.parse(p.dueAt) <= now.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || b.incorrectCount - a.incorrectCount || a.promptId.localeCompare(b.promptId))
    .map(p => byId.get(p.promptId)!);
  const fresh = eligible.filter(p => !seen.has(p.id));

  const picked: { promptId: string; kind: SessionCard['kind'] }[] = [];
  const usedWords = new Set<string>();
  const take = (prompts: typeof eligible, kind: SessionCard['kind'], limit: number) => {
    for (const p of prompts) {
      if (picked.length >= limit) return;
      if (usedWords.has(p.wordId)) continue;
      usedWords.add(p.wordId);
      picked.push({ promptId: p.id, kind });
    }
  };
  take(due, 'review', Math.min(REVIEW_CAP[target], target));
  take(fresh, 'new', target);
  take(due, 'review', target);

  return picked.map(({ promptId, kind }) => {
    const prompt = byId.get(promptId)!;
    const mediaSnapshots: MediaAsset[] = prompt.imageAssetId ? [media.get(prompt.imageAssetId)!] : [];
    if (prompt.audioAssetId && media.has(prompt.audioAssetId)) mediaSnapshots.push(media.get(prompt.audioAssetId)!);
    return { promptSnapshot: prompt, wordSnapshot: words.get(prompt.wordId)!, mediaSnapshots, kind, mode: 'picture', state: 'question' };
  });
}

/** A study card for one word: its first prompt, with its picture if it has one. Used for practice. */
export function cardForWord(content: LevelWords, wordId: string): SessionCard | undefined {
  const word = content.words.find(w => w.id === wordId);
  const prompt = content.prompts.find(p => p.wordId === wordId);
  if (!word || !prompt) return undefined;
  const image = prompt.imageAssetId ? content.media.find(m => m.id === prompt.imageAssetId) : undefined;
  if (prompt.imageAssetId && !image) return undefined;
  return { promptSnapshot: prompt, wordSnapshot: word, mediaSnapshots: image ? [image] : [], kind: 'review', mode: 'picture', state: 'question' };
}

/**
 * Up to `count` Korean meanings for listening mode: the card's own and others from the same level,
 * shuffled. Meanings identical to the answer are skipped so two options can never both be right.
 */
export function buildChoices(card: SessionCard, pool: Word[], count = 4, random = Math.random): { wordId: string; label: string }[] {
  const label = (w: Word, senseId?: string) => (w.senses.find(s => s.id === senseId) ?? w.senses[0]).korean.join(', ');
  const answer = { wordId: card.wordSnapshot.id, label: label(card.wordSnapshot, card.promptSnapshot.senseId) };
  const others = pool
    .filter(w => w.id !== answer.wordId)
    .map(w => ({ wordId: w.id, label: label(w) }))
    .filter((c, i, all) => c.label !== answer.label && all.findIndex(x => x.label === c.label) === i);
  const shuffle = <T,>(items: T[]) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  return shuffle([answer, ...shuffle(others).slice(0, count - 1)]);
}
