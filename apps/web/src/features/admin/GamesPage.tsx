import { useAdminGames, useUpdateAdminGame } from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { GameIcon } from "../../components/GameIcon";

export function GamesPage() {
  const { data: games, isLoading } = useAdminGames();
  const updateGame = useUpdateAdminGame();

  if (isLoading || !games) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map((game) => (
        <Card key={game.id} intensity="subtle" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GameIcon slug={game.slug} size="sm" />
            <div>
              <div className="font-semibold text-white">{game.name}</div>
              <div className="text-xs text-white/50">
                /{game.slug} · {game.difficulty}
              </div>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-white/70">
            {game.isEnabled ? "Enabled" : "Disabled"}
            <input
              type="checkbox"
              checked={game.isEnabled}
              onChange={(e) => updateGame.mutate({ id: game.id, data: { isEnabled: e.target.checked } })}
              className="relative h-5 w-9 cursor-pointer appearance-none rounded-full bg-white/[0.14] transition-colors checked:bg-brand-600 before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
            />
          </label>
        </Card>
      ))}
    </div>
  );
}
