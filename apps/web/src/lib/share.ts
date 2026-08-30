export interface ShareGameEntry {
  slug: string;
  icon: string;
  name: string;
  score: number | null;
}

export interface ShareData {
  date: string;
  games: ShareGameEntry[];
  totalScore: number;
  currentStreak: number;
}

/** Spoiler-free — only names, icons, and scores. Never puzzle content or answers. */
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
    ...data.games.map((g) => `${g.icon} ${g.name.padEnd(longestName)}  ${g.score ?? 0}`),
    "",
    `⭐ Total: ${data.totalScore}`,
    `🔥 ${data.currentStreak} Day Streak`,
  ];
  return lines.join("\n");
}
