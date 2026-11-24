import type { YesterdayGameDTO } from "@dailyloop/shared";
import { useYesterdayAnswers } from "../../lib/games-api";
import { Card } from "../../components/Card";
import { GameIcon } from "../../components/GameIcon";
import { Icon } from "../../components/Icon";
import { AnswerReveal } from "./AnswerReveal";

function ResultBadge({ result }: { result: YesterdayGameDTO["result"] }) {
  if (!result) return <span className="text-xs text-white/45">Not played</span>;
  if (!result.completed) return <span className="text-xs text-amber-300">Unfinished</span>;
  return (
    <span className={`text-xs font-semibold ${result.won ? "text-emerald-300" : "text-rose-300"}`}>
      {result.won ? "Solved" : "Missed"} · {result.score ?? 0} pts
    </span>
  );
}

/** Yesterday's answers, one collapsed row per game — nothing is shown until it's opened. */
export function YesterdayCard() {
  const { data } = useYesterdayAnswers();
  if (!data || data.games.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg font-bold text-white">
        <Icon name="history" className="text-xl text-brand-300" /> Yesterday&rsquo;s answers
      </h2>
      <ul className="flex flex-col gap-2">
        {data.games.map((game) => (
          <li key={game.slug}>
            <details className="group rounded-xl bg-white/[0.04] open:bg-white/[0.06]">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 [&::-webkit-details-marker]:hidden">
                <GameIcon slug={game.slug} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-white">
                    {game.name}{" "}
                    <span className="font-normal text-white/45">#{game.puzzleNumber}</span>
                  </span>
                  <ResultBadge result={game.result} />
                </span>
                <Icon
                  name="expand_more"
                  className="text-xl text-white/50 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="px-3 pb-3 pt-1">
                <AnswerReveal answer={game.answer} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}
