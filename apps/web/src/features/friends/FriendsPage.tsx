import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { RelationshipButton } from "../profile/RelationshipButton";
import { useToast } from "../../lib/toast-context";
import { ApiClientError } from "../../lib/api-client";
import {
  useFriends,
  useFriendRequests,
  useUserSearch,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useCancelFriendRequest,
  useRemoveFriend,
} from "../../lib/friends-api";

export function FriendsPage() {
  const [query, setQuery] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; displayName: string } | null>(null);
  const { data: searchResults, isLoading: searching } = useUserSearch(query);
  const { data: friends, isLoading: loadingFriends } = useFriends();
  const { data: requests } = useFriendRequests();
  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();
  const { showToast } = useToast();

  const onError = (err: unknown) => showToast(err instanceof ApiClientError ? err.message : "Something went wrong", "error");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-white">Friends</h1>

      <Card>
        <TextField
          label="Find friends"
          placeholder="Search by username or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim().length >= 2 ? (
          <div className="mt-4 flex flex-col gap-2">
            {searching ? (
              <Spinner className="mx-auto h-5 w-5 text-brand-400" />
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2">
                  <Link to={`/u/${user.username}`} className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={user.displayName} size="sm" />
                    <span className="truncate text-sm font-medium text-white/85 hover:text-white">
                      {user.displayName} <span className="text-white/40">@{user.username}</span>
                    </span>
                  </Link>
                  <RelationshipButton
                    username={user.username}
                    userId={user.id}
                    relationship={user.relationship}
                    displayName={user.displayName}
                  />
                </div>
              ))
            ) : (
              <p className="text-center text-sm text-white/50">No users found.</p>
            )}
          </div>
        ) : null}
      </Card>

      {requests && (requests.incoming.length > 0 || requests.outgoing.length > 0) ? (
        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-white">Requests</h2>
          {requests.incoming.length > 0 ? (
            <div className="mb-4 flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Incoming</p>
              {requests.incoming.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2">
                  <Link to={`/u/${r.user.username}`} className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={r.user.displayName} size="sm" />
                    <span className="truncate text-sm font-medium text-white/85 hover:text-white">{r.user.displayName}</span>
                  </Link>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      isLoading={acceptRequest.isPending}
                      onClick={() =>
                        acceptRequest.mutate(r.id, {
                          onSuccess: () => showToast(`You're now friends with ${r.user.displayName}`, "success"),
                          onError,
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => rejectRequest.mutate(r.id, { onError })}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {requests.outgoing.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Sent</p>
              {requests.outgoing.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2">
                  <Link to={`/u/${r.user.username}`} className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={r.user.displayName} size="sm" />
                    <span className="truncate text-sm font-medium text-white/85 hover:text-white">{r.user.displayName}</span>
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => cancelRequest.mutate(r.id, { onError })}>
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-display text-lg font-bold text-white">Your Friends</h2>
        {loadingFriends ? (
          <Spinner className="mx-auto h-5 w-5 text-brand-400" />
        ) : friends && friends.length > 0 ? (
          <div className="flex flex-col gap-2">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] px-3 py-2">
                <Link to={`/u/${friend.username}`} className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={friend.displayName} size="sm" />
                  <span className="truncate text-sm font-medium text-white/85 hover:text-white">
                    {friend.displayName} <span className="text-white/40">@{friend.username}</span>
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPendingRemoval({ id: friend.id, displayName: friend.displayName })}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="🧑‍🤝‍🧑" title="No friends yet" description="Search above to find people you know." />
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingRemoval}
        title={`Remove ${pendingRemoval?.displayName ?? ""}?`}
        body="They'll no longer see your scores on the friends leaderboard, and you won't see theirs."
        confirmLabel="Remove"
        danger
        isLoading={removeFriend.isPending}
        onConfirm={() => {
          if (!pendingRemoval) return;
          removeFriend.mutate(pendingRemoval.id, {
            onSuccess: () => {
              showToast(`Removed ${pendingRemoval.displayName}`, "info");
              setPendingRemoval(null);
            },
            onError,
          });
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
