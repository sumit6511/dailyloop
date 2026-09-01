import { useAdminUsers } from "../../lib/admin-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";

export function UsersPage() {
  const { data: users, isLoading } = useAdminUsers();

  if (isLoading || !users) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  return (
    <Card intensity="subtle">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.1] text-left text-xs font-semibold uppercase tracking-wide text-white/50">
              <th className="pb-2">User</th>
              <th className="pb-2">Email</th>
              <th className="pb-2 text-center">Role</th>
              <th className="pb-2 text-center">Streak</th>
              <th className="pb-2 text-center">Games</th>
              <th className="pb-2 text-center">Points</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white/[0.06]">
                <td className="py-2">
                  <div className="font-medium text-white/85">{user.displayName}</div>
                  <div className="text-xs text-white/40">@{user.username}</div>
                </td>
                <td className="py-2 text-white/60">{user.email}</td>
                <td className="py-2 text-center">
                  <Badge tone={user.role === "ADMIN" ? "brand" : "neutral"}>{user.role}</Badge>
                </td>
                <td className="py-2 text-center text-white/60">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="local_fire_department" className="text-sm text-flame-400" filled /> {user.currentStreak}
                  </span>
                </td>
                <td className="py-2 text-center text-white/60">{user.gamesPlayed}</td>
                <td className="py-2 text-center text-white/60">{user.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
