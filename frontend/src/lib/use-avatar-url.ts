import { useAuthenticatedImage } from "@/lib/use-authenticated-image";

/** Descarga la foto de perfil autenticada (JWT en header) y expone una object URL. */
export function useAvatarUrl(hasAvatar: boolean, avatarUpdatedAt: number | null) {
  return useAuthenticatedImage("/api/users/me/avatar", hasAvatar, avatarUpdatedAt);
}
