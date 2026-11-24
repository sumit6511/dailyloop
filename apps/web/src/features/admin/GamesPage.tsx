import { useAdminGames, useUpdateAdminGame } from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { GameIcon } from "../../components/GameIcon";
import { DifficultyMeter } from "../../components/DifficultyMeter";
import { SectionHeader } from "../../components/SectionHeader";

export function GamesPage() {
  const { data: games, isLoading } = useAdminGames();
  const updateGame = useUpdateAdminGame();

  if (isLoading || !games) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-accent-400" />
      </div>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="Games"
        icon="sports_esports"
        description="A disabled game disappears from everyone's lineup from the next page load."
      />
      <ul className="flex flex-col">
        {games.map((game) => (
          <li
            key={game.id}
            className="flex items-center justify-between gap-4 border-t border-white/[0.05] py-3 first:border-t-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <GameIcon slug={game.slug} size="sm" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{game.name}</div>
                <div className="flex items-center gap-3 font-mono text-xs text-white/40">
                  /{game.slug}
                  <DifficultyMeter difficulty={game.difficulty} />
                </div>
              </div>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2.5 text-sm font-medium text-white/65">
              {game.isEnabled ? "Enabled" : "Disabled"}
              <input
                type="checkbox"
                checked={game.isEnabled}
                onChange={(e) =>
                  updateGame.mutate({ id: game.id, data: { isEnabled: e.target.checked } })
                }
                className="relative h-6 w-11 cursor-pointer appearance-none rounded-full border border-white/[0.1] bg-white/[0.08] outline-none transition-colors checked:border-accent-400/50 checked:bg-accent-500/70 focus-visible:ring-2 focus-visible:ring-accent-400/60 before:absolute before:left-0.5 before:top-0.5 before:h-[18px] before:w-[18px] before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5"
              />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
