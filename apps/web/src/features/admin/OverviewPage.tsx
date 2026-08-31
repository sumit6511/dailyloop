import { useAdminStatsOverview, useAdminActivity } from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card intensity="subtle" className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</div>
    </Card>
  );
}

export function OverviewPage() {
  const { data: stats, isLoading: loadingStats } = useAdminStatsOverview();
  const { data: activity, isLoading: loadingActivity } = useAdminActivity();

  if (loadingStats || loadingActivity || !stats || !activity) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total Users" value={stats.totalUsers} />
        <StatTile label="Total Attempts" value={stats.totalAttempts} />
        <StatTile label="Completed" value={stats.completedAttempts} />
        <StatTile label="Perfect Days Today" value={activity.perfectDays} />
      </div>

      <Card intensity="subtle">
        <h2 className="mb-4 font-display text-lg font-bold text-white">Games</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.1] text-left text-xs font-semibold uppercase tracking-wide text-white/50">
                <th className="pb-2">Game</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Puzzles</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {stats.games.map((game) => (
                <tr key={game.slug} className="border-b border-white/[0.06]">
                  <td className="py-2 font-medium text-white/85">{game.name}</td>
                  <td className="py-2">
                    <Badge tone={game.isEnabled ? "success" : "neutral"}>{game.isEnabled ? "Enabled" : "Disabled"}</Badge>
                  </td>
                  <td className="py-2 text-white/60">{game.puzzleCount}</td>
                  <td className="py-2 text-white/60">{game.completedCount}</td>
                  <td className="py-2 text-white/60">{game.averageScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card intensity="subtle">
        <h2 className="mb-4 font-display text-lg font-bold text-white">Today's Activity ({activity.date})</h2>
        <div className="mb-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div>
            <div className="text-lg font-bold text-white">{activity.activeUsers}</div>
            <div className="text-xs text-white/50">Active users</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{activity.totalAttempts}</div>
            <div className="text-xs text-white/50">Attempts</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{activity.completedAttempts}</div>
            <div className="text-xs text-white/50">Completed</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{activity.perfectDays}</div>
            <div className="text-xs text-white/50">Perfect days</div>
          </div>
        </div>
        {activity.topScores.length > 0 ? (
          <div className="flex flex-col gap-1">
            {activity.topScores.map((s, i) => (
              <div key={s.username} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <span className="inline-flex items-center gap-1 text-white/80">
                  {i + 1}. {s.username}
                  {s.isPerfectDay ? <Icon name="emoji_events" className="text-sm text-yellow-400" filled /> : null}
                </span>
                <span className="font-semibold text-brand-300">{s.score}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/50">No activity yet today.</p>
        )}
      </Card>
    </div>
  );
}
