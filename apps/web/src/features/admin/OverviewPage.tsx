import { useAdminStatsOverview, useAdminActivity } from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { GameIcon } from "../../components/GameIcon";
import { SectionHeader } from "../../components/SectionHeader";
import { Stat } from "../../components/Stat";
import { TABLE, TD, TD_NUM, TH, TR } from "../../components/table-styles";

export function OverviewPage() {
  const { data: stats, isLoading: loadingStats } = useAdminStatsOverview();
  const { data: activity, isLoading: loadingActivity } = useAdminActivity();

  if (loadingStats || loadingActivity || !stats || !activity) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-accent-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat variant="tile" label="Players" icon="group" value={stats.totalUsers} />
        <Stat variant="tile" label="Attempts" icon="sports_esports" value={stats.totalAttempts} />
        <Stat
          variant="tile"
          label="Completed"
          icon="check_circle"
          iconClassName="text-emerald-300"
          value={stats.completedAttempts}
        />
        <Stat
          variant="tile"
          label="Perfect today"
          icon="workspace_premium"
          iconClassName="text-yellow-300"
          value={activity.perfectDays}
        />
      </div>

      <Card>
        <SectionHeader title="Games" icon="extension" />
        <div className="overflow-x-auto">
          <table className={`${TABLE} min-w-[500px]`}>
            <thead>
              <tr className="text-left">
                <th className={TH}>Game</th>
                <th className={`${TH} text-center`}>Status</th>
                <th className={`${TH} text-right`}>Puzzles</th>
                <th className={`${TH} text-right`}>Completed</th>
                <th className={`${TH} text-right`}>Avg score</th>
              </tr>
            </thead>
            <tbody>
              {stats.games.map((game) => (
                <tr key={game.slug} className={TR}>
                  <td className={`${TD} font-medium text-white/85`}>
                    <span className="flex items-center gap-2.5">
                      <GameIcon slug={game.slug} size="sm" />
                      {game.name}
                    </span>
                  </td>
                  <td className={`${TD} text-center`}>
                    <Badge tone={game.isEnabled ? "success" : "neutral"}>
                      {game.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </td>
                  <td className={`${TD_NUM} text-right`}>{game.puzzleCount}</td>
                  <td className={`${TD_NUM} text-right`}>{game.completedCount}</td>
                  <td className={`${TD_NUM} text-right`}>{game.averageScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Today's activity"
          icon="bolt"
          action={<span className="eyebrow text-white/40">{activity.date}</span>}
        />
        <div className="surface-inset mb-5 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Active players" value={activity.activeUsers} />
          <Stat label="Attempts" value={activity.totalAttempts} />
          <Stat label="Completed" value={activity.completedAttempts} />
          <Stat label="Perfect days" value={activity.perfectDays} />
        </div>
        <h3 className="eyebrow mb-2 text-white/40">Top scores</h3>
        {activity.topScores.length > 0 ? (
          <ol className="flex flex-col">
            {activity.topScores.map((s, i) => (
              <li
                key={s.username}
                className="flex h-10 items-center justify-between rounded-lg px-2 text-sm hover:bg-white/[0.025]"
              >
                <span className="inline-flex items-center gap-3 text-white/80">
                  <span className="tabular w-5 text-right font-mono text-xs text-white/40">
                    {i + 1}
                  </span>
                  {s.username}
                  {s.isPerfectDay ? (
                    <Icon name="emoji_events" className="text-sm text-yellow-400" filled />
                  ) : null}
                </span>
                <span className="tabular font-mono font-semibold text-accent-200">{s.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-white/50">No activity yet today.</p>
        )}
      </Card>
    </div>
  );
}
