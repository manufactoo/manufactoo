import * as React from "react";
import { apiClient } from "@/lib/api-client";

/** Descarga una imagen protegida por JWT (header Authorization) y expone una object URL. */
export function useAuthenticatedImage(url: string, enabled: boolean, cacheKey: number | null) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let created: string | null = null;

    apiClient
      .get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        created = URL.createObjectURL(res.data as Blob);
        setObjectUrl(created);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, cacheKey]);

  return objectUrl;
}
