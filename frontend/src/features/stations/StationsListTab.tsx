import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api-client";
import type { Station } from "./types";

function widgetCount(station: Station): number {
  return station.screens.reduce((sum, screen) => sum + screen.widgets.length, 0);
}

export function StationsListTab() {
  const { t } = useTranslation("dashboard");
  const [stations, setStations] = React.useState<Station[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Station | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    setError(null);
    apiClient
      .get<Station[]>("/api/stations")
      .then(({ data }) => setStations(data))
      .catch((err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(message ?? t("stations.notInstalled"));
        setStations(null);
      });
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setEnabled(true);
    setDialogOpen(true);
  }

  function openEdit(station: Station) {
    setEditing(station);
    setName(station.name);
    setDescription(station.description);
    setEnabled(station.enabled);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        // Preserve the existing layout: resend its screens unchanged.
        await apiClient.put(`/api/stations/${editing.id}`, {
          name,
          description,
          enabled,
          screens: editing.screens,
        });
      } else {
        // Una estacion nueva necesita al menos un widget finalizador para
        // poder guardarse (ver StationService.validate) -- se arranca con un
        // boton "Finalizar" ya listo para eso, en vez de una pantalla vacia
        // que el backend rechazaria de inmediato. El diseñador puede
        // borrarlo/reconfigurarlo libremente en el Builder.
        await apiClient.post("/api/stations", {
          name,
          description,
          enabled,
          screens: [
            {
              title: t("stations.builder.screenN", { n: 1 }),
              orderIndex: 0,
              widgets: [
                {
                  widgetType: "BUTTON",
                  label: "button",
                  bindingKey: null,
                  required: false,
                  sourceDeviceId: null,
                  sourceEventId: null,
                  config: { text: t("stations.runtime.defaultFinishText"), action: "SUBMIT" },
                  dataSource: {},
                  layout: { x: 0, y: 0, w: 3, h: 1.5 },
                  orderIndex: 0,
                },
              ],
            },
          ],
        });
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(station: Station) {
    if (!window.confirm(t("stations.confirmDelete"))) return;
    await apiClient.delete(`/api/stations/${station.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("stations.subtitle")}</p>
        {stations !== null && <Button onClick={openCreate}>{t("stations.add")}</Button>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {stations !== null && (
        <Card>
          <CardContent className="pt-6">
            {stations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("stations.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stations.name")}</TableHead>
                    <TableHead>{t("stations.description")}</TableHead>
                    <TableHead>{t("stations.enabled")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations.map((station) => (
                    <TableRow key={station.id}>
                      <TableCell className="font-medium">{station.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {station.description || t("stations.widgetCount", { count: widgetCount(station) })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={station.enabled ? "success" : "outline"}>
                          {station.enabled ? t("stations.enabled") : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button asChild variant="default" size="sm">
                          <Link to={`/dashboard/stations/${station.id}/builder`}>{t("stations.openBuilder")}</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/dashboard/stations/${station.id}/run`}>{t("stations.openRuntime")}</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/dashboard/stations/${station.id}/records`}>{t("stations.records.link")}</Link>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/dashboard/stations/${station.id}/materials`}>{t("stations.materials.link")}</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(station)}>
                          {t("common:actions.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(station)}>
                          {t("stations.delete")}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("stations.edit") : t("stations.add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="station-name">{t("stations.name")}</Label>
              <Input id="station-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="station-description">{t("stations.description")}</Label>
              <Textarea
                id="station-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="station-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
              <Label htmlFor="station-enabled">{t("stations.enabled")}</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || !name}>
                {t("stations.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
