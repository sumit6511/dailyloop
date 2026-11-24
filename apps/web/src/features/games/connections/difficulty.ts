// Shared by the game page and the dashboard's "Yesterday's answers".

export const DIFFICULTY_STYLES: Record<number, string> = {
  1: "border border-yellow-400/30 bg-yellow-500/20 text-yellow-200",
  2: "border border-green-400/30 bg-green-500/20 text-green-200",
  3: "border border-blue-400/30 bg-blue-500/20 text-blue-200",
  4: "border border-purple-400/30 bg-purple-500/20 text-purple-200",
};

// Color alone shouldn't be the only way to tell difficulty tiers apart — a text label carries
// the same information for colorblind players (the category title/words are always shown too,
// so this is purely about the difficulty *tier*, not identifying the category itself).
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easiest",
  2: "Easy",
  3: "Tricky",
  4: "Hardest",
};
