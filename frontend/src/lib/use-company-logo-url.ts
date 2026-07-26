import { useAuthenticatedImage } from "@/lib/use-authenticated-image";

/** Descarga el logo de la empresa (autenticado) y expone una object URL. */
export function useCompanyLogoUrl(hasLogo: boolean, logoUpdatedAt: number | null) {
  return useAuthenticatedImage("/api/settings/company/logo", hasLogo, logoUpdatedAt);
}
