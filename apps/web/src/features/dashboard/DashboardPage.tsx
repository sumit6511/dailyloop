import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SCORE } from "@dailyloop/shared";
import { useAuth } from "../../lib/use-auth";
import { useTodayLineup, useSchedule } from "../../lib/games-api";
import { NextPuzzleCountdown } from "../../components/NextPuzzleCountdown";
import { api } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { StreakBadge } from "../../components/StreakBadge";
import { SectionHeader } from "../../components/SectionHeader";
import { Icon } from "../../components/Icon";
import { GameCard } from "./GameCard";
import { LeaderboardCard } from "./LeaderboardCard";
import { YesterdayCard } from "./YesterdayCard";
import { useDocumentTitle } from "../../lib/use-document-title";

function GameCardSkeleton() {
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton shape="block" className="h-11 w-11 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="w-1/2" />
          <Skeleton className="w-full" />
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
        <Skeleton className="w-20" />
        <Skeleton shape="block" className="h-8 w-24 rounded-lg" />
      </div>
    </Card>
  );
}

interface StreakDTO {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getHeroSubtitle(completedCount: number, availableCount: number): string {
  if (availableCount === 0) return "No puzzles available today. Check back soon!";
  if (completedCount === 0) return "Today's puzzles are waiting.";
  if (completedCount < availableCount)
    return `${completedCount} of ${availableCount} done — keep going!`;
  return "All of today's puzzles are done. Nice work!";
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function HeroTile({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={`surface-inset flex flex-col gap-3 px-4 py-4 ${className}`}>
      <span className="eyebrow text-fg-subtle">{label}</span>
      {children}
    </div>
  );
}

export function DashboardPage() {
  useDocumentTitle("Today");
  const { user } = useAuth();
  const { data: games, isLoading } = useTodayLineup();
  const { data: schedule } = useSchedule();
  const { data: streak } = useQuery({
    queryKey: ["me", "streak"],
    queryFn: () => api.get<StreakDTO>("/me/streak"),
  });

  const completedCount = games?.filter((g) => g.status === "completed").length ?? 0;
  const availableCount = games?.filter((g) => g.available).length ?? 0;
  const todayScore = games?.reduce((sum, g) => sum + (g.score ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <section className="glass-strong relative overflow-hidden p-5 sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-accent-300">
                {schedule ? DAY_LABEL.format(new Date(`${schedule.today}T12:00:00Z`)) : "Today"}
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
                {getGreeting()}, <span className="text-gradient">{user?.displayName}</span>
              </h1>
              <p className="mt-2 text-fg-muted">
                {isLoading || !games
                  ? "Today's puzzles are waiting."
                  : getHeroSubtitle(completedCount, availableCount)}
              </p>
            </div>
            <NextPuzzleCountdown className="surface-inset h-9 self-start px-3 lg:self-auto" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <HeroTile label="Today's progress" className="col-span-2 sm:col-span-1">
              <div className="flex items-baseline gap-1.5">
                <span className="tabular font-mono text-3xl font-semibold leading-none text-white">
                  {completedCount}
                </span>
                <span className="font-mono text-base text-fg-subtle">
                  / {availableCount || "–"}
                </span>
                <span className="ml-1 text-sm text-fg-muted">done</span>
              </div>
              <div
                className="flex gap-1"
                role="progressbar"
                aria-label="Puzzles done today"
                aria-valuemin={0}
                aria-valuemax={availableCount}
                aria-valuenow={completedCount}
              >
                {Array.from({ length: Math.max(availableCount, 1) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                      i < completedCount
                        ? "bg-gradient-to-r from-brand-400 to-accent-400 shadow-[0_0_8px_rgb(34_211_238/0.5)]"
                        : "bg-white/[0.1]"
                    }`}
                  />
                ))}
              </div>
            </HeroTile>
            <HeroTile label="Streak">
              <StreakBadge
                currentStreak={streak?.currentStreak ?? 0}
                lastCompletedDate={streak?.lastCompletedDate ?? null}
                todayKey={schedule?.today}
              />
            </HeroTile>
            <HeroTile label="Points today">
              <div className="flex items-baseline gap-2">
                <Icon
                  name="star"
                  className="self-center text-2xl text-yellow-300 drop-shadow-[0_0_10px_rgb(253_224_71/0.5)]"
                  filled
                />
                <span className="tabular font-mono text-3xl font-semibold leading-none text-white">
                  {todayScore}
                </span>
                <span className="text-sm text-fg-muted">points</span>
              </div>
              <p className="hidden text-xs text-fg-subtle sm:block">
                Up to {SCORE.PER_GAME_MAX} a puzzle, +{SCORE.PERFECT_DAY_BONUS} for a perfect day.
              </p>
            </HeroTile>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="flex flex-col lg:col-span-2" aria-labelledby="todays-puzzles">
          <SectionHeader
            title={<span id="todays-puzzles">Today&rsquo;s puzzles</span>}
            icon="sports_esports"
            action={
              games ? (
                <span className="eyebrow text-fg-subtle">
                  {completedCount}/{availableCount} done
                </span>
              ) : null
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isLoading || !games
              ? Array.from({ length: 6 }, (_, i) => <GameCardSkeleton key={i} />)
              : games.map((game, i) => (
                  <div
                    key={game.slug}
                    className="animate-pop-in h-full"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <GameCard game={game} />
                  </div>
                ))}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <LeaderboardCard />
          <YesterdayCard />
        </aside>
      </div>
    </div>
  );
}
