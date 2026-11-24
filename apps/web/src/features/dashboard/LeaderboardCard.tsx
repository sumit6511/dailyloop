import { useState } from "react";
import {
  useLeaderboard,
  useFriendsLeaderboard,
  useMyRank,
  type LeaderboardRange,
} from "../../lib/leaderboard-api";
import { useAuth } from "../../lib/use-auth";
import { Card } from "../../components/Card";
import { Avatar } from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { SectionHeader } from "../../components/SectionHeader";
import { SegmentedControl } from "../../components/SegmentedControl";

const SCOPE_TABS = [
  { value: "friends", label: "Friends" },
  { value: "global", label: "Global" },
] as const;

const RANGE_TABS: { value: LeaderboardRange; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This week" },
  { value: "all-time", label: "All time" },
];

const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-orange-400"];
const VISIBLE_ROWS = 10;

export function LeaderboardCard() {
  const [scope, setScope] = useState<"friends" | "global">("friends");
  const [range, setRange] = useState<LeaderboardRange>("daily");
  const friendsQuery = useFriendsLeaderboard(range);
  const globalQuery = useLeaderboard(range);
  const { data: entries, isLoading } = scope === "friends" ? friendsQuery : globalQuery;
  const { user } = useAuth();
  const myGlobalRank = useMyRank(range);

  // When you're not among the visible rows, show your own position underneath. Friends lists
  // already contain you (if you've scored), so it's just further down; globally it comes from
  // /leaderboard/me, which ranks you against everyone, not just the top of the list.
  const visible = entries?.slice(0, VISIBLE_ROWS) ?? [];
  const isMe = (username: string) => username === user?.username;
  const myRow = (() => {
    if (!user || visible.some((e) => isMe(e.username))) return null;
    if (scope === "friends") {
      const mine = entries?.find((e) => isMe(e.username));
      return mine ? { rank: mine.rank, score: mine.score } : null;
    }
    return myGlobalRank.data
      ? { rank: myGlobalRank.data.rank, score: myGlobalRank.data.score }
      : null;
  })();

  return (
    <Card>
      <SectionHeader title="Leaderboard" icon="emoji_events" iconClassName="text-yellow-300" />

      <div className="mb-4 flex flex-col gap-2">
        <SegmentedControl
          aria-label="Whose scores"
          options={SCOPE_TABS}
          value={scope}
          onChange={setScope}
        />
        <SegmentedControl
          aria-label="Time range"
          size="sm"
          options={RANGE_TABS}
          value={range}
          onChange={setRange}
        />
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
          {visible.map((entry) => (
            <li
              key={entry.userId}
              className={`flex h-11 items-center gap-3 rounded-xl px-2.5 ${
                entry.username === user?.username
                  ? "bg-brand-500/[0.14] ring-1 ring-inset ring-brand-400/30"
                  : "hover:bg-white/[0.03]"
              }`}
            >
              <span className="tabular flex w-6 shrink-0 items-center justify-center font-mono text-xs font-semibold text-white/45">
                {entry.rank <= 3 ? (
                  <Icon
                    name="emoji_events"
                    className={`text-lg ${RANK_COLORS[entry.rank - 1]}`}
                    filled
                  />
                ) : (
                  entry.rank
                )}
              </span>
              <Avatar name={entry.displayName} size="sm" />
              <span className="flex-1 truncate text-sm font-medium text-white/85">
                {entry.displayName}
              </span>
              <span className="tabular font-mono text-sm font-semibold text-accent-200">
                {entry.score}
              </span>
            </li>
          ))}
          {myRow && user ? (
            <>
              <li aria-hidden="true" className="px-2 text-center text-xs leading-3 text-white/30">
                ⋯
              </li>
              <li className="flex h-11 items-center gap-3 rounded-xl bg-brand-500/[0.14] px-2.5 ring-1 ring-inset ring-brand-400/30">
                <span className="tabular flex min-w-6 shrink-0 items-center justify-center font-mono text-xs font-semibold text-white/60">
                  {myRow.rank}
                </span>
                <Avatar name={user.displayName} size="sm" />
                <span className="flex-1 truncate text-sm font-medium text-white/85">
                  {user.displayName} (you)
                </span>
                <span className="tabular font-mono text-sm font-semibold text-accent-200">
                  {myRow.score}
                </span>
              </li>
            </>
          ) : null}
        </ol>
      )}
    </Card>
  );
}
