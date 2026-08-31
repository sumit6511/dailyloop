export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  /** A Material Symbols icon name (rendered via the frontend's `<Icon>` component). */
  icon: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    key: "STREAK_3",
    name: "3 Day Streak",
    description: "Complete a daily game 3 days in a row.",
    icon: "local_fire_department",
  },
  { key: "STREAK_7", name: "7 Day Streak", description: "Complete a daily game 7 days in a row.", icon: "whatshot" },
  {
    key: "STREAK_30",
    name: "30 Day Streak",
    description: "Complete a daily game 30 days in a row.",
    icon: "military_tech",
  },
  { key: "FIRST_WIN", name: "First Win", description: "Win a daily game for the first time.", icon: "emoji_events" },
  {
    key: "PUZZLE_MASTER",
    name: "Puzzle Master",
    description: "Complete 50 daily games.",
    icon: "workspace_premium",
  },
  {
    key: "PERFECT_DAY",
    name: "Perfect Day",
    description: "Complete every game available in a single day.",
    icon: "verified",
  },
  { key: "SPEED_DEMON", name: "Speed Demon", description: "Complete a game in under 15 seconds.", icon: "bolt" },
];
