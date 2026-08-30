import { Link } from "react-router-dom";
import type { TodayGameEntryDTO } from "@dailyloop/shared";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";

const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

export function GameCard({ game }: { game: TodayGameEntryDTO }) {
  const isCompleted = game.status === "completed";
  const isInProgress = game.status === "in_progress";

  return (
    <Card
      className={`flex flex-col gap-3 transition-all duration-200 ${
        game.available ? "hover:-translate-y-0.5 hover:border-white/[0.22] hover:shadow-2xl" : "opacity-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {game.icon}
        </span>
        <div>
          <h3 className="font-display font-bold text-white">{game.name}</h3>
          <p className="text-xs text-white/50">{game.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{DIFFICULTY_LABEL[game.difficulty] ?? game.difficulty}</Badge>
        {isCompleted ? (
          <Badge tone="success">
            <span aria-hidden="true">✅</span> Completed
          </Badge>
        ) : isInProgress ? (
          <Badge tone="warning">
            <span aria-hidden="true">▶</span> In progress
          </Badge>
        ) : null}
      </div>

      {isCompleted && game.score !== null ? (
        <p className="text-sm font-semibold text-white/80">Score: {game.score}</p>
      ) : null}

      <div className="mt-auto pt-1">
        {!game.available ? (
          <Button variant="secondary" size="sm" disabled className="w-full">
            Not available today
          </Button>
        ) : (
          <Link to={`/play/${game.slug}`}>
            <Button variant={isCompleted ? "secondary" : "primary"} size="sm" className="w-full">
              {isCompleted ? "View result" : isInProgress ? "Continue" : "Play"}
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
