import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/use-auth";
import { useTodayLineup } from "../../lib/games-api";
import { api } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { StreakBadge } from "../../components/StreakBadge";
import { Icon } from "../../components/Icon";
import { GameCard } from "./GameCard";
import { LeaderboardCard } from "./LeaderboardCard";

function GameCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton shape="block" className="h-11 w-11 rounded-xl" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-full" />
        </div>
      </div>
      <Skeleton className="w-16" />
      <Skeleton shape="block" className="mt-auto h-9 w-full" />
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
  if (completedCount < availableCount) return `${completedCount} of ${availableCount} done — keep going!`;
  return "All of today's puzzles are done. Nice work!";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: games, isLoading } = useTodayLineup();
  const { data: streak } = useQuery({
    queryKey: ["me", "streak"],
    queryFn: () => api.get<StreakDTO>("/me/streak"),
  });

  const completedCount = games?.filter((g) => g.status === "completed").length ?? 0;
  const availableCount = games?.filter((g) => g.available).length ?? 0;
  const todayScore = games?.reduce((sum, g) => sum + (g.score ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="glass-strong relative overflow-hidden px-6 py-10 text-white sm:px-10">
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
            {getGreeting()}, {user?.displayName} <Icon name="waving_hand" className="text-3xl text-amber-300" filled />
          </h1>
          <p className="mt-2 max-w-md text-white/70">
            {isLoading || !games ? "Today's puzzles are waiting." : getHeroSubtitle(completedCount, availableCount)}
          </p>
          <div className="mt-6 flex flex-wrap items-start gap-6">
            <StreakBadge currentStreak={streak?.currentStreak ?? 0} lastCompletedDate={streak?.lastCompletedDate ?? null} />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-lg font-bold text-white">
                <Icon name="star" className="text-lg text-yellow-300" filled /> {todayScore}
              </span>
              <span className="text-sm text-white/70">points today</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {isLoading || !games ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              {availableCount > 0 ? (
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-white/60">
                      {completedCount} / {availableCount} Games Completed
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width] duration-700 ease-out"
                      style={{ width: `${(completedCount / availableCount) * 100}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {games.map((game, i) => (
                  <div key={game.slug} className="animate-pop-in" style={{ animationDelay: `${i * 60}ms` }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <LeaderboardCard />
        </div>
      </div>
    </div>
  );
}
