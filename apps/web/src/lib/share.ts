export interface ShareGameEntry {
  slug: string;
  icon: string;
  name: string;
  score: number | null;
  /** Word Guess only — a Wordle-style emoji grid (colors only, never letters). */
  pattern?: string;
}

export interface ShareData {
  date: string;
  games: ShareGameEntry[];
  totalScore: number;
  currentStreak: number;
}

/** Spoiler-free — only names, icons, scores, and color-only patterns. Never puzzle content or answers. */
export function formatShareText(data: ShareData): string {
  const dateLabel = new Date(`${data.date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const longestName = Math.max(...data.games.map((g) => g.name.length), 0);
  const lines = [
    "DailyLoop",
    dateLabel,
    "",
    ...data.games.flatMap((g) => [
      `${g.icon} ${g.name.padEnd(longestName)}  ${g.score ?? 0}`,
      ...(g.pattern ? [g.pattern] : []),
    ]),
    "",
    `⭐ Total: ${data.totalScore}`,
    `🔥 ${data.currentStreak} Day Streak`,
  ];
  return lines.join("\n");
}
