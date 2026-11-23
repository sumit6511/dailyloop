/**
 * Spoiler-free result patterns for the share card: colours and counts only, never letters,
 * words, numbers or answers. Each builder reads a game's *completed* sanitized content (what the
 * player can already see) and returns undefined when there's nothing to draw.
 */

const WORD_GUESS_EMOJI: Record<string, string> = { correct: "🟩", present: "🟨", absent: "⬜" };
const CONNECTIONS_EMOJI: Record<number, string> = { 1: "🟨", 2: "🟩", 3: "🟦", 4: "🟪" };

/** Wordle-style grid: one row per guess. */
function wordGuessPattern(content: unknown): string | undefined {
  const view = content as { guesses?: { feedback: { status: string }[] }[] } | null;
  if (!view?.guesses?.length) return undefined;
  return view.guesses.map((g) => g.feedback.map((f) => WORD_GUESS_EMOJI[f.status] ?? "⬜").join("")).join("\n");
}

/** One row per counted guess, each square coloured by that word's real category. */
function connectionsPattern(content: unknown): string | undefined {
  const view = content as {
    guesses?: { words: string[] }[];
    categories?: { difficulty: number; words: string[] }[];
  } | null;
  if (!view?.guesses?.length || !view.categories) return undefined;
  const difficultyOf = new Map<string, number>();
  for (const category of view.categories) {
    for (const word of category.words) difficultyOf.set(word.toUpperCase(), category.difficulty);
  }
  return view.guesses
    .map((guess) => guess.words.map((w) => CONNECTIONS_EMOJI[difficultyOf.get(w.toUpperCase()) ?? 0] ?? "⬜").join(""))
    .join("\n");
}

/** One square per clue: red for a wrong guess, green for the right one, white for unused clues. */
function guessItPattern(content: unknown): string | undefined {
  const view = content as { guesses?: { correct: boolean }[] } | null;
  if (!view?.guesses?.length) return undefined;
  const used = view.guesses.map((g) => (g.correct ? "🟩" : "🟥"));
  return [...used, ...Array<string>(Math.max(0, 4 - used.length)).fill("⬜")].join("");
}

const BUILDERS: Record<string, (content: unknown) => string | undefined> = {
  "word-guess": wordGuessPattern,
  connections: connectionsPattern,
  "guess-it": guessItPattern,
};

export function sharePattern(slug: string, content: unknown): string | undefined {
  return BUILDERS[slug]?.(content);
}
