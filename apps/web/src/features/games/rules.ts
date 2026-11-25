import { MAX_MISTAKES, SCORE } from "@dailyloop/shared";

export interface GameRules {
  /** One sentence: what solving looks like. */
  goal: string;
  steps: string[];
  scoring: string;
}

/**
 * "How to play" for each game. Kept in words rather than exact numbers where the engine's tuning
 * might change (speed-bonus windows, per-mistake penalties); the limits players see on screen
 * (mistakes, tries, clues, the hint cost) come from the shared constants.
 */
export const GAME_RULES: Record<string, GameRules> = {
  connections: {
    goal: "Sort the 16 words into four groups of four that share something in common.",
    steps: [
      "Pick four words you think belong together, then press Submit.",
      `A right group locks in. A wrong one costs one of your ${MAX_MISTAKES.connections} mistakes, and if you were one word off, you'll be told.`,
      "Groups run from easiest to hardest. Watch for words that seem to fit more than one.",
      "Shuffle rearranges the grid when you're stuck.",
    ],
    scoring:
      "Fewer mistakes and a faster solve score more, with a bonus for no mistakes at all. Run out of mistakes and you still score for each group you found.",
  },
  "word-guess": {
    goal: "Find the hidden five-letter word in six tries.",
    steps: [
      "Type any real five-letter word and press Enter.",
      "Green means the right letter in the right spot, amber means it's in the word but elsewhere, and grey means it isn't in the word.",
      "Letters you've ruled out are dimmed on the keyboard.",
    ],
    scoring: "The fewer guesses you need, the more you score; a quick solve adds a little more.",
  },
  "number-puzzle": {
    goal: "Combine the numbers with + − × ÷ to make the target.",
    steps: [
      "Tap a number, an operator, then a second number. The two are replaced by the result.",
      "Each number can be used once, and you don't have to use them all.",
      "Results must be positive whole numbers. A subtraction that goes to zero or below, or a division that doesn't come out even, counts as a mistake.",
      "Undo or reset as often as you like, then Submit answer once the target is on the board.",
    ],
    scoring:
      "Mistakes cost points; a quick solve with no mistakes earns bonuses. Submitting without the target ends the day's puzzle.",
  },
  "logic-puzzle": {
    goal: "Fill the 6×6 grid so every row, column and 2×3 box holds the numbers 1 to 6 once each.",
    steps: [
      "Select a cell, then a number. Printed numbers can't be changed.",
      "A number that clashes with its row, column or box is rejected and counts as a mistake.",
      "Notes mode pencils in candidates; the settings (cog) can highlight related cells and count what's left of each number.",
      `Stuck? A hint shows a cell you can fill (or one that's wrong), for ${SCORE.HINT_PENALTY} points.`,
    ],
    scoring:
      "Mistakes and hints cost points; no mistakes and no hints earns a bonus. The clock only runs while you're on the page.",
  },
  "guess-it": {
    goal: "Name the mystery answer from up to four clues.",
    steps: [
      "Start with one clue and type your guess.",
      "Each wrong guess reveals the next clue, up to four.",
      "Common alternative names are accepted, and so is a small typo in a longer answer.",
    ],
    scoring: "The fewer clues you need, the more you score; a quick solve adds a little more.",
  },
  pathway: {
    goal: "Draw one line that passes through every cell, visiting the numbers in order.",
    steps: [
      "Start on 1 and drag (or use the arrow keys) from cell to neighbouring cell.",
      "You can't cross a wall, revisit a cell or reach a number out of order; trying counts as a mistake.",
      "Tap a cell on your line to cut it back to there; Backspace steps back one cell.",
      `Stuck? A hint shows the next cell, or where to back up to, for ${SCORE.HINT_PENALTY} points.`,
    ],
    scoring:
      "Mistakes and hints cost points; a quick solve with no mistakes and no hints earns a bonus.",
  },
};
