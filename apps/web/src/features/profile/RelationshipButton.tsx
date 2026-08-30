import { Button } from "../../components/Button";
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
}

export function RelationshipButton({ username, userId, relationship }: RelationshipButtonProps) {
  const sendRequest = useSendFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();
  const acceptRequest = useAcceptFriendRequest();
  const { data: requests } = useFriendRequests();

  if (relationship === "self") return null;

  if (relationship === "friends") {
    return (
      <Button
        variant="secondary"
        size="sm"
        isLoading={removeFriend.isPending}
        onClick={() => removeFriend.mutate(userId)}
      >
        ✓ Friends
      </Button>
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
        onClick={() => outgoingRequest && cancelRequest.mutate(outgoingRequest.id)}
      >
        Request sent
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
        onClick={() => incomingRequest && acceptRequest.mutate(incomingRequest.id)}
      >
        Accept request
      </Button>
    );
  }

  return (
    <Button size="sm" isLoading={sendRequest.isPending} onClick={() => sendRequest.mutate(username)}>
      Add friend
    </Button>
  );
}
