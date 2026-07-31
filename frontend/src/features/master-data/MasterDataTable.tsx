import * as React from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { formatOdooValue } from "./odoo-value";

type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

export function MasterDataTable({
  endpoint,
  columns,
  labelOverrides,
}: {
  endpoint: string;
  columns: string[];
  /** Traduccion distinta para una columna concreta (p. ej. "barcode" es el
   * codigo de operario en Odoo, no un codigo de barras de producto). */
  labelOverrides?: Record<string, string>;
}) {
  const { t } = useTranslation("dashboard");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    (nextOffset: number) => {
      setLoading(true);
      setError(null);
      apiClient
        .get<Row[]>(endpoint, { params: { limit: PAGE_SIZE, offset: nextOffset } })
        .then(({ data }) => {
          setRows(data);
          setOffset(nextOffset);
        })
        .catch((err) => {
          const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setError(message ?? t("masterData.error"));
          setRows(null);
        })
        .finally(() => setLoading(false));
    },
    [endpoint, t],
  );

  React.useEffect(() => {
    load(0);
  }, [load]);

  if (loading && rows === null) {
    return <p className="text-sm text-muted-foreground">{t("masterData.loading")}</p>;
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => load(0)}>
          {t("common:actions.retry")}
        </Button>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("masterData.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{t(labelOverrides?.[col] ?? `masterData.columns.${col}`, { defaultValue: col })}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              {columns.map((col) => (
                <TableCell key={col}>{formatOdooValue(row[col])}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => load(Math.max(0, offset - PAGE_SIZE))}>
          {t("masterData.previous")}
        </Button>
        <Button variant="outline" size="sm" disabled={rows.length < PAGE_SIZE || loading} onClick={() => load(offset + PAGE_SIZE)}>
          {t("masterData.next")}
        </Button>
      </div>
    </div>
  );
}
