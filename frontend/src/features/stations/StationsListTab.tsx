import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/api-client";
import type { DataSourceOption, Station } from "./types";

function widgetCount(station: Station): number {
  return station.screens.reduce((sum, screen) => sum + screen.widgets.length, 0);
}

export function StationsListTab() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const [stations, setStations] = React.useState<Station[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Station | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [odooWorkcenterId, setOdooWorkcenterId] = React.useState<string>("none");
  const [workcenters, setWorkcenters] = React.useState<DataSourceOption[]>([]);
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
    // Work Center de Odoo al que se puede asociar una estacion (opcional) --
    // ver conversacion 2026-08-04 sobre integracion de Work Center/Operacion/
    // Workorder. Si Odoo no esta configurado/instalado, se deja vacio: el
    // select simplemente no ofrece ninguno, no bloquea crear la estacion.
    apiClient
      .get<DataSourceOption[]>("/api/stations/data-source-options", { params: { type: "ODOO_WORKCENTERS" } })
      .then(({ data }) => setWorkcenters(data))
      .catch(() => setWorkcenters([]));
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setEnabled(true);
    setOdooWorkcenterId("none");
    setDialogOpen(true);
  }

  /**
   * Atajo "Crear desde Work Center" (ver conversacion 2026-08-04): abre el
   * MISMO dialogo de creacion, pero con el Work Center y el nombre ya
   * prerellenados (el nombre se puede editar antes de guardar). No asume
   * ninguna cardinalidad -- si la fabrica tiene varias estaciones fisicas
   * en el mismo Work Center (una linea, un equipo de personas...), el
   * usuario simplemente lo elige varias veces y ajusta el nombre cada vez
   * (p. ej. "Amasado 1", "Amasado 2").
   */
  function openCreateFromWorkcenter(wc: DataSourceOption) {
    setEditing(null);
    setName(wc.label);
    setDescription("");
    setEnabled(true);
    setOdooWorkcenterId(wc.value);
    setDialogOpen(true);
  }

  function openEdit(station: Station) {
    setEditing(station);
    setName(station.name);
    setDescription(station.description);
    setEnabled(station.enabled);
    setOdooWorkcenterId(station.odooWorkcenterId ? String(station.odooWorkcenterId) : "none");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const workcenter = odooWorkcenterId !== "none" ? workcenters.find((w) => w.value === odooWorkcenterId) : null;
      const odooWorkcenterName = workcenter?.label ?? null;
      const workcenterIdNum = workcenter ? Number(workcenter.value) : null;
      if (editing) {
        // Preserve the existing layout: resend its screens unchanged.
        await apiClient.put(`/api/stations/${editing.id}`, {
          name,
          description,
          enabled,
          odooWorkcenterId: workcenterIdNum,
          odooWorkcenterName,
          screens: editing.screens,
        });
      } else {
        // Una estacion nueva necesita al menos un widget finalizador para
        // poder guardarse (ver StationService.validate) -- se arranca con un
        // boton "Finalizar" ya listo para eso, en vez de una pantalla vacia
        // que el backend rechazaria de inmediato. El diseñador puede
        // borrarlo/reconfigurarlo libremente en el Builder.
        //
        // Si la estacion ya tiene Work Center (venga del atajo "Crear desde
        // Work Center" o elegido a mano en este mismo dialogo), se añade
        // TAMBIEN una tabla ya conectada a su cola de trabajo -- la casilla
        // de filtro es automatica (ver conversacion 2026-08-04), asi que no
        // hace falta tocar nada mas para que funcione. Sin esto, el atajo
        // de Work Center solo ahorraba escribir el nombre; con esto, el
        // usuario VE el mecanismo funcionando nada mas entrar al Builder,
        // en vez de tener que descubrir por su cuenta que existe.
        const widgets = workcenterIdNum
          ? [
              {
                widgetType: "TABLE",
                label: "table_1",
                bindingKey: "table_1",
                required: false,
                sourceDeviceId: null,
                sourceEventId: null,
                config: { selectionMode: "SINGLE" },
                dataSource: { type: "ODOO_WORKORDERS" },
                layout: { x: 0, y: 0, w: 12, h: 4 },
                orderIndex: 0,
              },
              // Vinculado a la tabla de arriba: Start/Pausar/Bloquear/Finalizar
              // sobre el work order seleccionado, escribiendo de verdad en Odoo
              // (ver conversacion 2026-08-05) -- antes solo se añadia la tabla
              // de solo lectura, y el operario tenia que descubrir por su
              // cuenta que existia el widget que de verdad hace algo.
              {
                widgetType: "WORKORDER_ACTIONS",
                label: "workorderActions",
                bindingKey: null,
                required: false,
                sourceDeviceId: null,
                sourceEventId: null,
                config: { boundTo: "table_1" },
                dataSource: {},
                layout: { x: 0, y: 4.5, w: 6, h: 5 },
                orderIndex: 1,
              },
              {
                widgetType: "BUTTON",
                label: "button",
                bindingKey: null,
                required: false,
                sourceDeviceId: null,
                sourceEventId: null,
                config: { text: t("stations.runtime.defaultFinishText"), action: "SUBMIT" },
                dataSource: {},
                layout: { x: 0, y: 10, w: 3, h: 1.5 },
                orderIndex: 2,
              },
            ]
          : [
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
            ];
        const { data } = await apiClient.post<Station>("/api/stations", {
          name,
          description,
          enabled,
          odooWorkcenterId: workcenterIdNum,
          odooWorkcenterName,
          screens: [
            {
              title: t("stations.builder.screenN", { n: 1 }),
              orderIndex: 0,
              widgets,
            },
          ],
        });
        if (workcenterIdNum) {
          // Directo al Builder (no a la lista) para que vea de inmediato lo
          // que se le ha preparado -- el aviso tutorial lo pinta el propio
          // Builder al detectar ?tip=workorders.
          setDialogOpen(false);
          navigate(`/dashboard/stations/${data.id}/builder?tip=workorders`);
          return;
        }
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
        {stations !== null && (
          <div className="flex items-center gap-2">
            {workcenters.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">{t("stations.createFromWorkcenter")}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {workcenters.map((wc) => (
                    <DropdownMenuItem key={wc.value} onClick={() => openCreateFromWorkcenter(wc)}>
                      {wc.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={openCreate}>{t("stations.add")}</Button>
          </div>
        )}
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
                      <TableCell className="max-w-xs truncate text-muted-foreground" title={station.description || undefined}>
                        {station.description || t("stations.widgetCount", { count: widgetCount(station) })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={station.enabled ? "success" : "outline"}>
                          {station.enabled ? t("stations.enabled") : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 whitespace-normal text-right">
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
            <div className="space-y-2">
              <Label htmlFor="station-workcenter">{t("stations.odooWorkcenter")}</Label>
              <Select value={odooWorkcenterId} onValueChange={setOdooWorkcenterId}>
                <SelectTrigger id="station-workcenter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("stations.odooWorkcenterNone")}</SelectItem>
                  {workcenters.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("stations.odooWorkcenterHint")}</p>
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
