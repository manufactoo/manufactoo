import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { DeviceFormDialog } from "./DeviceFormDialog";
import type { Device } from "./types";

export function DevicesTab() {
  const { t } = useTranslation("dashboard");
  const [devices, setDevices] = React.useState<Device[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingDevice, setEditingDevice] = React.useState<Device | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    apiClient
      .get<Device[]>("/api/devices")
      .then(({ data }) => setDevices(data))
      .catch((err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(message ?? t("apps.error"));
        setDevices(null);
      });
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingDevice(null);
    setDialogOpen(true);
  }

  function openEdit(device: Device) {
    setEditingDevice(device);
    setDialogOpen(true);
  }

  async function handleDelete(device: Device) {
    if (!window.confirm(t("devices.confirmDelete"))) return;
    await apiClient.delete(`/api/devices/${device.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("devices.subtitle")}</p>
        {devices !== null && <Button onClick={openCreate}>{t("devices.add")}</Button>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {devices !== null && (
        <Card>
          <CardContent className="pt-6">
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("devices.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("devices.name")}</TableHead>
                    <TableHead>{t("devices.direction")}</TableHead>
                    <TableHead>{t("devices.category")}</TableHead>
                    <TableHead>{t("devices.transport")}</TableHead>
                    <TableHead>{t("devices.enabled")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>{device.name}</TableCell>
                      <TableCell>{t(`devices.directions.${device.direction}`)}</TableCell>
                      <TableCell>{t(`devices.categories.${device.category}`, { defaultValue: device.category })}</TableCell>
                      <TableCell>{t(`devices.transports.${device.transport}`, { defaultValue: device.transport })}</TableCell>
                      <TableCell>
                        <Badge variant={device.enabled ? "success" : "outline"}>
                          {device.enabled ? t("devices.enabled") : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(device)}>
                          {t("common:actions.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(device)}>
                          {t("devices.delete")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <DeviceFormDialog open={dialogOpen} onOpenChange={setDialogOpen} device={editingDevice} onSaved={load} />
    </div>
  );
}
