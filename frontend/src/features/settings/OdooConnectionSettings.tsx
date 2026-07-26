import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface OdooConnectionDto {
  host: string;
  port: number;
  database: string;
  username: string;
  odooVersion: string | null;
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastTestError: string | null;
}

export function OdooConnectionSettings() {
  const { t } = useTranslation("dashboard");
  const [connection, setConnection] = React.useState<OdooConnectionDto | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; errorMessage: string | null; odooVersion: string | null } | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    apiClient.get<OdooConnectionDto>("/api/settings/odoo-connection").then(({ data }) => setConnection(data));
  }, []);

  React.useEffect(() => load(), [load]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await apiClient.post("/api/settings/odoo-connection/test");
      setTestResult(data);
      load();
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!connection) return;
    setSaving(true);
    try {
      await apiClient.put("/api/settings/odoo-connection", {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        apiKeyOrPassword: apiKey || undefined,
      });
      setApiKey("");
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!connection) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("settings.odoo.title")}</CardTitle>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("settings.odoo.version")}</p>
            <p className="font-medium">{connection.odooVersion ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("settings.odoo.lastTest")}</p>
            <p className="font-medium">
              {connection.lastTestAt ? new Date(connection.lastTestAt).toLocaleString() : t("common:status.neverTested")}
            </p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Host</Label>
                <Input value={connection.host} onChange={(e) => setConnection({ ...connection, host: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t("settings.odoo.hostHint")}</p>
              </div>
              <div className="space-y-1">
                <Label>Puerto</Label>
                <Input
                  type="number"
                  value={connection.port}
                  onChange={(e) => setConnection({ ...connection, port: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Base de datos</Label>
                <Input value={connection.database} onChange={(e) => setConnection({ ...connection, database: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Usuario</Label>
                <Input value={connection.username} onChange={(e) => setConnection({ ...connection, username: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>API key / contrasena (dejar en blanco para no cambiar)</Label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {t("common:actions.save")}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                {t("common:actions.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleTest} disabled={testing}>
              {testing ? t("common:actions.testing") : t("settings.odoo.testButton")}
            </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            {t("settings.odoo.editCredentials")}
          </Button>
          </div>
        )}

        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md p-3 text-sm",
              testResult.success
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
            )}
          >
            {testResult.success ? <IconCircleCheck className="size-4 shrink-0" /> : <IconCircleX className="size-4 shrink-0" />}
            <span>{testResult.success ? t("common:status.success") : testResult.errorMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
