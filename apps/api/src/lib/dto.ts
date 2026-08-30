import type { User } from "@prisma/client";
import type { MeDTO, PublicUserDTO } from "@dailyloop/shared";

export function toPublicUserDTO(user: User): PublicUserDTO {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toMeDTO(user: User): MeDTO {
  return {
    ...toPublicUserDTO(user),
    email: user.email,
    role: user.role,
    timezone: user.timezone,
  };
}
