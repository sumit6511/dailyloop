import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PublicUserDTO } from "@dailyloop/shared";
import { api } from "./api-client";
import type { Relationship } from "../features/profile/relationship";

export interface SearchResultDTO extends PublicUserDTO {
  relationship: Relationship;
}

export function useFriends() {
  return useQuery({ queryKey: ["friends"], queryFn: () => api.get<PublicUserDTO[]>("/friends") });
}

export interface FriendRequestEntry {
  id: string;
  createdAt: string;
  user: PublicUserDTO;
}

export interface FriendRequestsResponse {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ["friends", "requests"],
    queryFn: () => api.get<FriendRequestsResponse>("/friends/requests"),
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["users", "search", query],
    queryFn: () => api.get<SearchResultDTO[]>(`/users/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });
}

function useInvalidateFriends() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
  };
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (username: string) => api.post("/friends/requests", { username }),
    onSuccess: invalidate,
  });
}

export function useAcceptFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => api.post(`/friends/requests/${id}/accept`),
    onSuccess: invalidate,
  });
}

export function useRejectFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => api.post(`/friends/requests/${id}/reject`),
    onSuccess: invalidate,
  });
}

export function useCancelFriendRequest() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/friends/requests/${id}`),
    onSuccess: invalidate,
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidateFriends();
  return useMutation({
    mutationFn: (friendId: string) => api.delete(`/friends/${friendId}`),
    onSuccess: invalidate,
  });
}
