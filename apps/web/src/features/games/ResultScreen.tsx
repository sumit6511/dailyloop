import { useId, type ReactNode } from "react";
import { SCORE } from "@dailyloop/shared";
import { useNavigate } from "react-router-dom";
import { Stat } from "../../components/Stat";
import { Button } from "../../components/Button";
import { achievementIcon, useAchievementCatalog } from "../../lib/achievements-api";
import { ShareButton } from "./ShareButton";
import { NextPuzzleCountdown } from "../../components/NextPuzzleCountdown";
import { Icon } from "../../components/Icon";

interface ResultStat {
  label: string;
  value: string;
}

interface ResultScreenProps {
  gameName: string;
  won: boolean;
  score: number;
  stats: ResultStat[];
  /** Achievement keys unlocked by *this* completion — shown once, not persisted. */
  newAchievementKeys?: string[];
  children?: ReactNode;
}

export function ResultScreen({
  gameName,
  won,
  score,
  stats,
  newAchievementKeys,
  children,
}: ResultScreenProps) {
  const navigate = useNavigate();
  const { data: catalog } = useAchievementCatalog();
  const newAchievements = (catalog ?? []).filter((a) => newAchievementKeys?.includes(a.key));

  return (
    <section className="glass-strong animate-pop-in relative overflow-hidden px-5 py-8 text-center sm:px-8">
      <div
        className={`pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl ${
          won ? "bg-emerald-500/25" : "bg-brand-500/25"
        }`}
        aria-hidden="true"
      />
      <div className="relative flex flex-col items-center">
        <p className="eyebrow text-accent-300">{gameName} · today&rsquo;s puzzle done</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
          {won ? "Nice work!" : "So close!"}
        </h2>

        <ScoreRing score={score} won={won} />

        {stats.length > 0 ? (
          <div
            className="surface-inset mt-6 grid w-full max-w-sm gap-4 px-4 py-3.5"
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((stat) => (
              <Stat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                className="items-center"
              />
            ))}
          </div>
        ) : null}

        {newAchievements.length > 0 ? (
          <div className="mt-6 flex w-full max-w-sm flex-col gap-2">
            {newAchievements.map((achievement) => (
              <div
                key={achievement.key}
                className="animate-pop-in flex items-center gap-3 rounded-xl border border-flame-400/30 bg-gradient-to-r from-flame-400/15 to-flame-400/[0.03] px-4 py-3 text-left shadow-[0_0_24px_-8px_rgb(255_122_26/0.5)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-flame-400/15">
                  <Icon
                    name={achievementIcon(achievement.icon)}
                    className="text-2xl text-flame-400"
                    filled
                  />
                </span>
                <div>
                  <div className="eyebrow text-flame-400">Achievement unlocked!</div>
                  <div className="text-sm font-semibold text-white/90">{achievement.name}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className="mt-6 w-full">{children}</div> : null}

        <NextPuzzleCountdown className="surface-inset mt-6 h-9 px-3" />

        <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
          <ShareButton />
          <Button variant="secondary" onClick={() => navigate("/")}>
            <Icon name="home" className="text-lg" /> Back to today
          </Button>
        </div>
      </div>
    </section>
  );
}

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The score as a gauge out of the per-game maximum. */
function ScoreRing({ score, won }: { score: number; won: boolean }) {
  const fraction = Math.max(0, Math.min(1, score / SCORE.PER_GAME_MAX));
  const gradientId = useId();
  return (
    <div className="relative mt-6 h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={won ? "#34d399" : "#9b7bff"} />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-white/[0.08]"
        />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
          style={{ filter: "drop-shadow(0 0 6px rgb(34 211 238 / 0.45))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tabular font-mono text-4xl font-semibold leading-none text-white"
          aria-hidden="true"
        >
          {score}
        </span>
        <span className="eyebrow mt-1.5 text-fg-subtle" aria-hidden="true">
          / {SCORE.PER_GAME_MAX} pts
        </span>
        <span className="sr-only">
          Score: {score} out of {SCORE.PER_GAME_MAX}
        </span>
      </div>
    </div>
  );
}
