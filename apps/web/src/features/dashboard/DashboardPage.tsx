import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../lib/use-auth";
import { useTodayLineup } from "../../lib/games-api";
import { api } from "../../lib/api-client";
import { Spinner } from "../../components/Spinner";
import { StreakBadge } from "../../components/StreakBadge";
import { Icon } from "../../components/Icon";
import { GameCard } from "./GameCard";
import { LeaderboardCard } from "./LeaderboardCard";

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
          <p className="mt-2 max-w-md text-white/70">Today's puzzles are waiting.</p>
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
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8 text-brand-400" />
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
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${(completedCount / availableCount) * 100}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {games.map((game) => (
                  <GameCard key={game.slug} game={game} />
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
