import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { MaterialLoad, Station } from "./types";

/** Lotes/series activos ahora mismo en UNA estacion -- entrada por fila desde el listado de estaciones, junto a Editar/Eliminar/Diseñar (ver conversacion 2026-07-31). */
export function StationMaterialsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [station, setStation] = React.useState<Station | null>(null);
  const [loads, setLoads] = React.useState<MaterialLoad[] | null>(null);

  React.useEffect(() => {
    apiClient.get<Station>(`/api/stations/${id}`).then(({ data }) => setStation(data)).catch(() => setStation(null));
    apiClient.get<MaterialLoad[]>(`/api/stations/${id}/material-loads`).then(({ data }) => setLoads(data)).catch(() => setLoads([]));
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
          <IconArrowLeft className="mr-1 size-4" />
          {t("stations.materials.back")}
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{t("stations.materials.title")}</h1>
          {station && <p className="text-xs text-muted-foreground">{station.name}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loads === null ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : loads.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stations.materials.empty")}</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stations.materials.product")}</TableHead>
                    <TableHead>{t("stations.widget.materialPosition")}</TableHead>
                    <TableHead>{t("stations.materials.lot")}</TableHead>
                    <TableHead>{t("stations.materials.since")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell className="text-muted-foreground">{l.position ?? "—"}</TableCell>
                      <TableCell>{l.label}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(l.loadedAt).toLocaleString(i18n.language)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
