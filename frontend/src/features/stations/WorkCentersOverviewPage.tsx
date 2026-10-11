import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { IconRefresh } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { DataSourceOption } from "./types";

/** Sesion activa de una estacion, tal como la devuelve GET /api/work-order-sessions (ver WorkCenterSessionDto en el backend). */
interface WorkCenterSession {
  id: number;
  stationId: number;
  stationName: string;
  odooWorkorderId: number;
  odooWorkcenterId: number | null;
  state: string;
  operatorEmployeeId: number | null;
  operatorName: string | null;
  qtyProducing: number;
  qtyProduced: number;
  blockReasonOdooId: number | null;
  blockReasonName: string | null;
  startedAt: string;
  finishedAt: string | null;
}

const POLL_MS = 15000;

const STATE_VARIANT: Record<string, "success" | "outline" | "destructive"> = {
  RUNNING: "success",
  PAUSED: "outline",
  BLOCKED: "destructive",
};

function relativeTime(iso: string, locale: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  if (minutes < 60) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-minutes, "minute");
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.round(minutes / 60), "hour");
}

/**
 * Vista cruzada de toda la instalacion: que Work Center tiene una sesion
 * (Start/Pausar/Bloquear/Finalizar, ver WorkOrderSessionService) activa
 * ahora mismo, en que estacion, con quien y con que cantidad -- ver
 * conversacion 2026-08-05. Se refresca sola cada POLL_MS: es un panel de
 * "que esta pasando ahora", no una pantalla que se quede mirando fija
 * requiere que el dato envejezca.
 */
export function WorkCentersOverviewPage() {
  const { t, i18n } = useTranslation("dashboard");
  const [sessions, setSessions] = React.useState<WorkCenterSession[] | null>(null);
  const [workorderNames, setWorkorderNames] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<WorkCenterSession[]>("/api/work-order-sessions");
      setSessions(data);
      if (data.length > 0) {
        const { data: options } = await apiClient.get<DataSourceOption[]>("/api/stations/data-source-options", {
          params: { type: "ODOO_WORKORDERS", limit: 500 },
        });
        setWorkorderNames(Object.fromEntries(options.map((o) => [o.value, o.label])));
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("workCenters.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("workCenters.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          <IconRefresh className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} />
          {t("workCenters.refresh")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {sessions === null ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("workCenters.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("workCenters.station")}</TableHead>
                  <TableHead>{t("workCenters.workorder")}</TableHead>
                  <TableHead>{t("workCenters.state")}</TableHead>
                  <TableHead>{t("workCenters.operator")}</TableHead>
                  <TableHead>{t("workCenters.qty")}</TableHead>
                  <TableHead>{t("workCenters.started")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link to={`/dashboard/stations/${s.stationId}/run`} className="hover:underline">
                        {s.stationName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {workorderNames[String(s.odooWorkorderId)] ?? `#${s.odooWorkorderId}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={STATE_VARIANT[s.state] ?? "outline"} className="w-fit">
                          {t(`stations.runtime.workorderState.${s.state}`, { defaultValue: s.state })}
                        </Badge>
                        {s.state === "BLOCKED" && s.blockReasonName && (
                          <span className="text-xs text-destructive">{s.blockReasonName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.operatorName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.qtyProducing}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {relativeTime(s.startedAt, i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
