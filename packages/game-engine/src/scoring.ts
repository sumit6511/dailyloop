import { SCORE } from "@dailyloop/shared";
import type { ScoreBreakdown } from "./types.js";

export function clampScore(value: number): number {
  return Math.max(0, Math.min(SCORE.PER_GAME_MAX, Math.round(value)));
}

export function buildScoreBreakdown(parts: {
  base: number;
  speedBonus?: number;
  accuracyBonus?: number;
  mistakePenalty?: number;
}): ScoreBreakdown {
  const speedBonus = parts.speedBonus ?? 0;
  const accuracyBonus = parts.accuracyBonus ?? 0;
  const mistakePenalty = parts.mistakePenalty ?? 0;
  const total = clampScore(parts.base + speedBonus + accuracyBonus - mistakePenalty);
  return { base: parts.base, speedBonus, accuracyBonus, mistakePenalty, total };
}

/** Linear falloff from `maxBonus` at/before `bestMs` down to 0 at/after `worstMs`. */
export function speedBonus(durationMs: number, bestMs: number, worstMs: number, maxBonus: number): number {
  if (durationMs <= bestMs) return maxBonus;
  if (durationMs >= worstMs) return 0;
  const fraction = 1 - (durationMs - bestMs) / (worstMs - bestMs);
  return Math.round(fraction * maxBonus);
}
