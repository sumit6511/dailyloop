import { useState } from "react";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { useToast } from "../../lib/toast-context";
import { ApiClientError } from "../../lib/api-client";
import type { Relationship } from "./relationship";
import {
  useSendFriendRequest,
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useRemoveFriend,
  useFriendRequests,
} from "../../lib/friends-api";

interface RelationshipButtonProps {
  username: string;
  userId: string;
  relationship: Relationship;
  displayName?: string;
}

export function RelationshipButton({ username, userId, relationship, displayName }: RelationshipButtonProps) {
  const sendRequest = useSendFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();
  const acceptRequest = useAcceptFriendRequest();
  const { data: requests } = useFriendRequests();
  const { showToast } = useToast();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const onError = (err: unknown) => showToast(err instanceof ApiClientError ? err.message : "Something went wrong", "error");

  if (relationship === "self") return null;

  if (relationship === "friends") {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setConfirmingRemove(true)}>
          <Icon name="check" className="text-base" /> Friends
        </Button>
        <ConfirmDialog
          open={confirmingRemove}
          title={`Remove ${displayName ?? username}?`}
          body="They'll no longer see your scores on the friends leaderboard, and you won't see theirs."
          confirmLabel="Remove"
          danger
          isLoading={removeFriend.isPending}
          onConfirm={() =>
            removeFriend.mutate(userId, {
              onSuccess: () => {
                showToast(`Removed ${displayName ?? username}`, "info");
                setConfirmingRemove(false);
              },
              onError,
            })
          }
          onCancel={() => setConfirmingRemove(false)}
        />
      </>
    );
  }

  if (relationship === "request_sent") {
    const outgoingRequest = requests?.outgoing.find((r) => r.user.username === username);
    return (
      <Button
        variant="secondary"
        size="sm"
        isLoading={cancelRequest.isPending}
        disabled={!outgoingRequest}
        onClick={() => outgoingRequest && cancelRequest.mutate(outgoingRequest.id, { onError })}
      >
        <Icon name="schedule_send" className="text-base" /> Request sent
      </Button>
    );
  }

  if (relationship === "request_received") {
    const incomingRequest = requests?.incoming.find((r) => r.user.username === username);
    return (
      <Button
        size="sm"
        isLoading={acceptRequest.isPending}
        disabled={!incomingRequest}
        onClick={() =>
          incomingRequest &&
          acceptRequest.mutate(incomingRequest.id, {
            onSuccess: () => showToast(`You're now friends with ${displayName ?? username}`, "success"),
            onError,
          })
        }
      >
        <Icon name="how_to_reg" className="text-base" /> Accept request
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      isLoading={sendRequest.isPending}
      onClick={() =>
        sendRequest.mutate(username, {
          onSuccess: () => showToast("Friend request sent", "success"),
          onError,
        })
      }
    >
      <Icon name="person_add" className="text-base" /> Add friend
    </Button>
  );
}
