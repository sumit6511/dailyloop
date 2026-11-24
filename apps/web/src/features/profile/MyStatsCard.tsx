import { useQuery } from "@tanstack/react-query";
import type { MyStatsDTO } from "@dailyloop/shared";
import { api } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { SectionHeader } from "../../components/SectionHeader";
import { GameIcon } from "../../components/GameIcon";
import { Skeleton } from "../../components/Skeleton";

/** Your per-game record and Word Guess guess distribution (only shown on your own profile). */
export function MyStatsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => api.get<MyStatsDTO>("/me/stats"),
  });

  const maxBar = Math.max(1, ...(data?.wordGuessDistribution ?? []));
  const anyWordGuessWins = (data?.wordGuessDistribution ?? []).some((n) => n > 0);

  return (
    <Card>
      <SectionHeader title="Your games" icon="sports_esports" />
      {isLoading || !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-white/40">
                <th className="pb-2 font-medium">Game</th>
                <th className="pb-2 text-right font-medium">Played</th>
                <th className="pb-2 text-right font-medium">Win %</th>
                <th className="pb-2 text-right font-medium">Avg</th>
                <th className="pb-2 text-right font-medium">Best</th>
              </tr>
            </thead>
            <tbody>
              {data.games.map((game) => (
                <tr key={game.slug} className="border-t border-white/[0.06] text-white/80">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <GameIcon slug={game.slug} size="sm" />
                      <span className="truncate">{game.name}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{game.played}</td>
                  <td className="py-2 text-right tabular-nums">
                    {game.played ? `${game.winRate}%` : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {game.played ? game.averageScore : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {game.played ? game.bestScore : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {anyWordGuessWins ? (
            <div className="mt-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                Word Guess — guesses to win
              </h3>
              <ol className="flex flex-col gap-1.5" aria-label="Word Guess guess distribution">
                {data.wordGuessDistribution.map((count, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right text-white/50">{i + 1}</span>
                    <span
                      className="flex h-5 min-w-6 items-center justify-end rounded bg-brand-500/60 px-1.5 font-semibold text-on-accent"
                      style={{ width: `${(count / maxBar) * 100}%` }}
                    >
                      {count}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
