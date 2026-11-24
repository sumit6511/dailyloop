import { useAdminUsers } from "../../lib/admin-api";
import { Avatar } from "../../components/Avatar";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { SectionHeader } from "../../components/SectionHeader";
import { TABLE, TD, TD_NUM, TH, TR } from "../../components/table-styles";

export function UsersPage() {
  const { data: users, isLoading } = useAdminUsers();

  if (isLoading || !users) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-accent-400" />
      </div>
    );
  }

  return (
    <Card>
      <SectionHeader
        title="Players"
        icon="group"
        action={<span className="eyebrow text-white/40">{users.length} total</span>}
      />
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className={`${TABLE} min-w-[640px]`}>
          <thead>
            <tr className="text-left">
              <th className={TH}>Player</th>
              <th className={TH}>Email</th>
              <th className={`${TH} text-center`}>Role</th>
              <th className={`${TH} text-right`}>Streak</th>
              <th className={`${TH} text-right`}>Games</th>
              <th className={`${TH} text-right`}>Points</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={TR}>
                <td className={TD}>
                  <span className="flex items-center gap-3">
                    <Avatar name={user.displayName} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white/90">
                        {user.displayName}
                      </span>
                      <span className="block font-mono text-xs text-white/40">
                        @{user.username}
                      </span>
                    </span>
                  </span>
                </td>
                <td className={`${TD} text-white/55`}>{user.email}</td>
                <td className={`${TD} text-center`}>
                  <Badge tone={user.role === "ADMIN" ? "brand" : "neutral"}>
                    {user.role.toLowerCase()}
                  </Badge>
                </td>
                <td className={`${TD_NUM} text-right`}>
                  <span className="inline-flex items-center gap-1">
                    <Icon
                      name="local_fire_department"
                      className={`text-sm ${user.currentStreak > 0 ? "text-flame-400" : "text-white/25"}`}
                      filled
                    />
                    {user.currentStreak}
                  </span>
                </td>
                <td className={`${TD_NUM} text-right`}>{user.gamesPlayed}</td>
                <td className={`${TD_NUM} text-right`}>{user.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
