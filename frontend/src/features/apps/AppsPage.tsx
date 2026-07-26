import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppsStore } from "./apps-store";

export function AppsPage() {
  const { t } = useTranslation("dashboard");
  const apps = useAppsStore((s) => s.apps);
  const loaded = useAppsStore((s) => s.loaded);
  const fetchApps = useAppsStore((s) => s.fetch);
  const install = useAppsStore((s) => s.install);
  const uninstall = useAppsStore((s) => s.uninstall);

  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  function nameFor(key: string) {
    const app = apps.find((a) => a.key === key);
    return app ? t(app.nameKey) : key;
  }

  async function handleInstall(key: string) {
    setBusyKey(key);
    setError(null);
    try {
      await install(key);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("apps.error"));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUninstall(key: string) {
    setBusyKey(key);
    setError(null);
    try {
      await uninstall(key);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("apps.error"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("apps.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("apps.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loaded ? (
        <p className="text-sm text-muted-foreground">{t("masterData.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card key={app.key}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{t(app.nameKey)}</CardTitle>
                  <Badge variant={app.installed ? "success" : "outline"}>
                    {app.installed ? t("apps.installed") : t("apps.notInstalled")}
                  </Badge>
                </div>
                <CardDescription>{t(app.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t("apps.version")}: {app.version}
                </p>
                {app.missingDependencies.length > 0 && (
                  <p className="text-destructive">
                    {t("apps.missingDependencies", {
                      apps: app.missingDependencies.map(nameFor).join(", "),
                    })}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                {app.installed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyKey === app.key}
                    onClick={() => handleUninstall(app.key)}
                  >
                    {t("apps.uninstall")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyKey === app.key || app.missingDependencies.length > 0}
                    onClick={() => handleInstall(app.key)}
                  >
                    {t("apps.install")}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
