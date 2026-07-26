import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { Station, TraceRecord } from "./types";

export function StationRecordsPage() {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [station, setStation] = React.useState<Station | null>(null);
  const [records, setRecords] = React.useState<TraceRecord[] | null>(null);

  React.useEffect(() => {
    apiClient.get<Station>(`/api/stations/${id}`).then(({ data }) => setStation(data)).catch(() => setStation(null));
    apiClient.get<TraceRecord[]>(`/api/stations/${id}/records`).then(({ data }) => setRecords(data)).catch(() => setRecords([]));
  }, [id]);

  // Columnas = union de todas las claves capturadas en los registros.
  const keys = React.useMemo(() => {
    const set = new Set<string>();
    (records ?? []).forEach((r) => Object.keys(r.capturedData).forEach((k) => set.add(k)));
    return [...set];
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
          <IconArrowLeft className="mr-1 size-4" />
          {t("stations.records.back")}
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{t("stations.records.title")}</h1>
          {station && <p className="text-xs text-muted-foreground">{station.name}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {records === null ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stations.records.empty")}</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stations.records.date")}</TableHead>
                    {keys.map((k) => (
                      <TableHead key={k}>{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString(i18n.language)}
                      </TableCell>
                      {keys.map((k) => (
                        <TableCell key={k}>{String(r.capturedData[k] ?? "")}</TableCell>
                      ))}
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
