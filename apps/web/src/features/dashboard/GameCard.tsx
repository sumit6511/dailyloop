import { Link } from "react-router-dom";
import type { TodayGameEntryDTO } from "@dailyloop/shared";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { buttonClasses } from "../../components/button-styles";
import { DifficultyMeter } from "../../components/DifficultyMeter";
import { Icon } from "../../components/Icon";
import { GameIcon } from "../../components/GameIcon";

function StatusLine({ game }: { game: TodayGameEntryDTO }) {
  if (!game.available) {
    return <span className="text-xs text-fg-subtle">Not available today</span>;
  }
  if (game.status === "completed") {
    return (
      <span
        className={`flex items-center gap-1.5 text-xs font-medium ${game.won ? "text-emerald-300" : "text-rose-300"}`}
      >
        <Icon name={game.won ? "check_circle" : "cancel"} className="text-base" filled />
        {game.won ? "Solved" : "Missed"}
        <span className="tabular font-mono text-white/80">{game.score ?? 0} pts</span>
      </span>
    );
  }
  if (game.status === "in_progress") {
    return (
      <span className="flex items-center gap-2 text-xs font-medium text-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgb(252_211_77/0.9)]" />
        In progress
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs text-fg-subtle">
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      Not started
    </span>
  );
}

export function GameCard({ game }: { game: TodayGameEntryDTO }) {
  const isCompleted = game.status === "completed";
  const isInProgress = game.status === "in_progress";

  return (
    <Card
      className={`group relative flex h-full flex-col gap-4 overflow-hidden transition-[border-color,transform,box-shadow] duration-200 ${
        game.available
          ? "hover:-translate-y-0.5 hover:border-accent-400/30 hover:shadow-[0_24px_48px_-24px_var(--shadow-deep),0_0_0_1px_rgb(34_211_238/0.08)]"
          : "opacity-55"
      }`}
    >
      {isCompleted && game.won ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
        />
      ) : null}
      <div className="flex items-start gap-3">
        <GameIcon slug={game.slug} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-base font-bold text-white">{game.name}</h3>
            <DifficultyMeter difficulty={game.difficulty} />
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg-subtle">
            {game.description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <StatusLine game={game} />
        {!game.available ? (
          <Button variant="secondary" size="sm" disabled>
            <Icon name="block" className="text-base" /> Unavailable
          </Button>
        ) : (
          <Link
            to={`/play/${game.slug}`}
            className={buttonClasses({
              variant: isCompleted ? "secondary" : "primary",
              size: "sm",
              className: "min-w-[6.5rem]",
            })}
          >
            <Icon
              name={isCompleted ? "visibility" : isInProgress ? "play_arrow" : "sports_esports"}
              className="text-base"
              filled={!isCompleted}
            />
            {isCompleted ? "Result" : isInProgress ? "Continue" : "Play"}
          </Link>
        )}
      </div>
    </Card>
  );
}
