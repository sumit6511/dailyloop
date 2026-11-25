import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import {
  achievementIcon,
  useAchievementCatalog,
  useUserAchievements,
} from "../../lib/achievements-api";
import { Card } from "../../components/Card";
import { Spinner } from "../../components/Spinner";
import { Avatar } from "../../components/Avatar";
import { buttonClasses } from "../../components/button-styles";
import { Page } from "../../components/Page";
import { SectionHeader } from "../../components/SectionHeader";
import { Stat } from "../../components/Stat";
import { Icon } from "../../components/Icon";
import { RelationshipButton } from "./RelationshipButton";
import { MyStatsCard } from "./MyStatsCard";
import { useDocumentTitle } from "../../lib/use-document-title";
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

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["users", username],
    queryFn: () => api.get<ProfileDTO>(`/users/${username}`),
    enabled: !!username,
  });
  const { data: catalog } = useAchievementCatalog();
  useDocumentTitle(profile?.displayName ?? username);
  const { data: unlocked } = useUserAchievements(username);
  const unlockedKeys = new Set((unlocked ?? []).map((a) => a.key));

  if (isLoading || !profile) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-8 w-8 text-accent-400" />
      </div>
    );
  }

  const joined = new Date(profile.createdAt).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const unlockedCount = (catalog ?? []).filter((a) => unlockedKeys.has(a.key)).length;

  return (
    <Page width="narrow">
      <section className="glass-strong relative overflow-hidden p-5 sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
          <Avatar
            name={profile.displayName}
            size="lg"
            className="h-20 w-20 text-2xl ring-4 ring-white/[0.04]"
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-accent-300">Player profile</p>
            <h1 className="mt-1.5 truncate font-display text-2xl font-bold text-white sm:text-3xl">
              {profile.displayName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-fg-subtle sm:justify-start">
              <span className="font-mono text-fg-muted">@{profile.username}</span>
              <span aria-hidden="true">·</span>
              <span>Joined {joined}</span>
              {profile.stats.currentStreak > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-flame-400">
                  <Icon name="local_fire_department" className="text-base" filled />
                  {profile.stats.currentStreak} day streak
                </span>
              ) : null}
            </p>
            {profile.bio ? <p className="mt-3 text-sm text-white/70">{profile.bio}</p> : null}
          </div>
          {profile.relationship === "self" ? (
            <Link to="/settings" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <Icon name="edit" className="text-base" /> Edit profile
            </Link>
          ) : profile.relationship ? (
            <RelationshipButton
              username={profile.username}
              userId={profile.id}
              relationship={profile.relationship}
              displayName={profile.displayName}
            />
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <Stat
          variant="tile"
          label="Streak"
          icon="local_fire_department"
          iconClassName="text-flame-400"
          value={profile.stats.currentStreak}
        />
        <Stat
          variant="tile"
          label="Best"
          icon="whatshot"
          iconClassName="text-flame-400"
          value={profile.stats.longestStreak}
        />
        <Stat
          variant="tile"
          label="Points"
          icon="star"
          iconClassName="text-yellow-300"
          value={profile.stats.totalPoints}
        />
        <Stat
          variant="tile"
          label="Played"
          icon="sports_esports"
          value={profile.stats.gamesPlayed}
        />
        <Stat
          variant="tile"
          label="Won"
          icon="emoji_events"
          iconClassName="text-emerald-300"
          value={profile.stats.gamesWon}
        />
      </div>

      {profile.relationship === "self" ? <MyStatsCard /> : null}

      <Card>
        <SectionHeader
          title="Achievements"
          icon="military_tech"
          iconClassName="text-flame-400"
          action={
            catalog ? (
              <span className="eyebrow text-fg-subtle">
                {unlockedCount}/{catalog.length} unlocked
              </span>
            ) : null
          }
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(catalog ?? []).map((achievement) => {
            const isUnlocked = unlockedKeys.has(achievement.key);
            return (
              <div
                key={achievement.key}
                title={`${achievement.name} — ${achievement.description}`}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-shadow ${
                  isUnlocked
                    ? "border-flame-400/30 bg-gradient-to-b from-flame-400/15 to-flame-400/[0.03] shadow-[0_0_24px_-6px_rgb(255_122_26/0.35)]"
                    : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isUnlocked ? "bg-flame-400/15" : "bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    name={achievementIcon(achievement.icon)}
                    className={`text-2xl ${isUnlocked ? "text-flame-400" : "text-white/25"}`}
                    filled={isUnlocked}
                  />
                </span>
                <span
                  className={`text-xs font-semibold leading-tight ${isUnlocked ? "text-white" : "text-fg-subtle"}`}
                >
                  {achievement.name}
                </span>
                <span className="text-[11px] leading-snug text-fg-subtle">
                  {achievement.description}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}
