import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useAchievementCatalog, useUserAchievements } from "../../lib/achievements-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { RelationshipButton } from "./RelationshipButton";
import type { Relationship } from "./relationship";

interface ProfileDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  stats: {
    currentStreak: number;
    longestStreak: number;
    totalPoints: number;
    gamesPlayed: number;
    gamesWon: number;
  };
  relationship: Relationship | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["users", username],
    queryFn: () => api.get<ProfileDTO>(`/users/${username}`),
    enabled: !!username,
  });
  const { data: catalog } = useAchievementCatalog();
  const { data: unlocked } = useUserAchievements(username);
  const unlockedKeys = new Set((unlocked ?? []).map((a) => a.key));

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <Card intensity="strong" className="text-center">
        <div className="mx-auto mb-3">
          <Avatar name={profile.displayName} size="lg" className="mx-auto" />
        </div>
        <h1 className="font-display text-xl font-bold text-white">{profile.displayName}</h1>
        <p className="text-sm text-white/50">@{profile.username}</p>
        {profile.bio ? <p className="mt-2 text-sm text-white/70">{profile.bio}</p> : null}
        {profile.stats.currentStreak > 0 ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-flame-400/30 bg-flame-400/10 px-3 py-1 text-sm font-semibold text-flame-400">
            <span aria-hidden="true">🔥</span> {profile.stats.currentStreak} day streak
          </div>
        ) : null}
        {profile.relationship === "self" ? (
          <div className="mt-4 flex justify-center">
            <Link to="/settings">
              <Button variant="secondary" size="sm">
                Edit Profile
              </Button>
            </Link>
          </div>
        ) : profile.relationship ? (
          <div className="mt-4 flex justify-center">
            <RelationshipButton
              username={profile.username}
              userId={profile.id}
              relationship={profile.relationship}
              displayName={profile.displayName}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-bold text-white">Stats</h2>
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-3">
          <Stat label="Current Streak" value={String(profile.stats.currentStreak)} />
          <Stat label="Longest Streak" value={String(profile.stats.longestStreak)} />
          <Stat label="Total Points" value={String(profile.stats.totalPoints)} />
          <Stat label="Games Played" value={String(profile.stats.gamesPlayed)} />
          <Stat label="Games Won" value={String(profile.stats.gamesWon)} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg font-bold text-white">Achievements</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {(catalog ?? []).map((achievement) => {
            const isUnlocked = unlockedKeys.has(achievement.key);
            return (
              <div
                key={achievement.key}
                title={`${achievement.name} — ${achievement.description}`}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-shadow ${
                  isUnlocked
                    ? "border-flame-400/30 bg-flame-400/10 shadow-[0_0_20px_rgba(255,122,26,0.15)]"
                    : "border-white/[0.08] bg-white/[0.03] opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {achievement.icon}
                </span>
                <span className="text-[11px] font-semibold leading-tight text-white/85">{achievement.name}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
