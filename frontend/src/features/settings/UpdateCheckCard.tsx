import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

interface UpdateCheckResult {
  enabled: boolean;
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export function UpdateCheckCard() {
  const { t } = useTranslation("dashboard");
  const [result, setResult] = React.useState<UpdateCheckResult | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleCheck() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<UpdateCheckResult>("/api/settings/update-check");
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.updateCheck.title")}</CardTitle>
        <CardDescription>{t("settings.updateCheck.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="secondary" onClick={handleCheck} disabled={loading}>
          {loading ? "..." : t("settings.updateCheck.checkNow")}
        </Button>

        {result && !result.enabled && (
          <p className="text-sm text-muted-foreground">
            Deshabilitado (MANUFACTOO_UPDATE_CHECK_ENABLED=false en el servidor).
          </p>
        )}

        {result?.enabled && result.updateAvailable && (
          <p className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{t("settings.updateCheck.updateAvailable", { version: result.latestVersion })}</Badge>
            {result.releaseUrl && (
              <a href={result.releaseUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                Ver release
              </a>
            )}
          </p>
        )}

        {result?.enabled && !result.updateAvailable && result.latestVersion && (
          <p className="text-sm text-emerald-600">{t("settings.updateCheck.upToDate", { version: result.currentVersion })}</p>
        )}
      </CardContent>
    </Card>
  );
}
