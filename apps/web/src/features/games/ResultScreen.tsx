import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { useAchievementCatalog } from "../../lib/achievements-api";
import { ShareButton } from "./ShareButton";
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

export function ResultScreen({ gameName, won, score, stats, newAchievementKeys, children }: ResultScreenProps) {
  const navigate = useNavigate();
  const { data: catalog } = useAchievementCatalog();
  const newAchievements = (catalog ?? []).filter((a) => newAchievementKeys?.includes(a.key));

  return (
    <Card intensity="strong" className="animate-pop-in text-center">
      <div className="relative mb-2 inline-flex">
        {won ? (
          <div className="animate-glow-pulse absolute inset-0 -z-10 rounded-full bg-brand-500/40 blur-xl" aria-hidden="true" />
        ) : null}
        <Icon
          name={won ? "celebration" : "sentiment_dissatisfied"}
          className={`text-5xl ${won ? "text-amber-300" : "text-white/60"}`}
          filled
        />
      </div>
      <h2 className="font-display text-xl font-bold text-white">{won ? "Nice work!" : "So close!"}</h2>
      <p className="mt-1 text-sm text-white/50">{gameName} — today's puzzle is done</p>

      {stats.length > 0 ? (
        <div className="my-6 flex items-center justify-center gap-8">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/15 px-4 py-2 text-sm font-semibold text-brand-200">
        <Icon name="star" className="text-base text-yellow-300" filled /> Score: {score}
      </div>

      {newAchievements.length > 0 ? (
        <div className="mb-6 flex flex-col gap-2">
          {newAchievements.map((achievement) => (
            <div
              key={achievement.key}
              className="flex items-center gap-3 rounded-xl border border-flame-400/30 bg-flame-400/10 px-4 py-2.5 text-left"
            >
              <Icon name={achievement.icon} className="text-2xl text-flame-400" filled />
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-flame-400">Achievement unlocked!</div>
                <div className="text-sm font-semibold text-white/90">{achievement.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {children}

      <div className="mt-2 flex flex-col justify-center gap-2 sm:flex-row">
        <ShareButton />
        <Button variant="secondary" onClick={() => navigate("/")}>
          <Icon name="home" className="text-lg" /> Back to Daily Games
        </Button>
      </div>
    </Card>
  );
}
