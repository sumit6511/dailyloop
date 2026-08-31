import { useState } from "react";
import { useLeaderboard, useFriendsLeaderboard, type LeaderboardRange } from "../../lib/leaderboard-api";
import { useAuth } from "../../lib/use-auth";
import { Card } from "../../components/Card";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";

const RANGE_TABS: { key: LeaderboardRange; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "all-time", label: "All Time" },
];

const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-orange-400"];

export function LeaderboardCard() {
  const [scope, setScope] = useState<"friends" | "global">("friends");
  const [range, setRange] = useState<LeaderboardRange>("daily");
  const friendsQuery = useFriendsLeaderboard(range);
  const globalQuery = useLeaderboard(range);
  const { data: entries, isLoading } = scope === "friends" ? friendsQuery : globalQuery;
  const { user } = useAuth();

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg font-bold text-white">
        <Icon name="emoji_events" className="text-xl text-yellow-400" filled /> Leaderboard
      </h2>

      <div className="mb-3 flex gap-1 rounded-lg bg-white/[0.06] p-1">
        {(["friends", "global"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`flex-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              scope === s ? "bg-white/[0.14] text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {s === "friends" ? "Friends" : "Global"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-white/[0.06] p-1">
        {RANGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setRange(tab.key)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              range === tab.key ? "bg-white/[0.14] text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <Skeleton shape="circle" className="h-8 w-8 shrink-0" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          icon={<Icon name="emoji_events" />}
          title="No scores yet"
          description={
            scope === "friends"
              ? "Add friends and play today's games to see them here."
              : "Be the first to play today!"
          }
        />
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.slice(0, 10).map((entry) => (
            <li
              key={entry.userId}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                entry.username === user?.username ? "bg-brand-500/15 ring-1 ring-brand-400/30" : ""
              }`}
            >
              <span className="flex w-6 shrink-0 items-center justify-center text-sm font-semibold text-white/50">
                {entry.rank <= 3 ? (
                  <Icon name="emoji_events" className={`text-lg ${RANK_COLORS[entry.rank - 1]}`} filled />
                ) : (
                  entry.rank
                )}
              </span>
              <Avatar name={entry.displayName} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-white/85">{entry.displayName}</span>
              <span className="text-sm font-bold text-brand-300">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
