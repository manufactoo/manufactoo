import { useAuthenticatedImage } from "@/lib/use-authenticated-image";

/** Descarga una imagen de estacion (autenticada por JWT) y expone una object URL. */
export function useStationAssetUrl(assetId: number | null | undefined): string | null {
  return useAuthenticatedImage(
    assetId ? `/api/stations/assets/${assetId}` : "",
    Boolean(assetId),
    assetId ?? null,
  );
}
