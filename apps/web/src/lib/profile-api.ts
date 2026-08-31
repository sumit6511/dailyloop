import { useMutation } from "@tanstack/react-query";
import type { MeDTO, UpdateProfileInput, ChangePasswordInput } from "@dailyloop/shared";
import { api } from "./api-client";

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (data: UpdateProfileInput) => api.patch<MeDTO>("/users/me", data),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) => api.patch<{ ok: boolean }>("/users/me/password", data),
  });
}
