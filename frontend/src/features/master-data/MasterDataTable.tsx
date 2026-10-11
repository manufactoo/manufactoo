import * as React from "react";
import { useTranslation } from "react-i18next";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { formatOdooValue } from "./odoo-value";

type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

export function MasterDataTable({
  endpoint,
  columns,
  labelOverrides,
  cellRenderers,
  filterableColumns,
}: {
  endpoint: string;
  columns: string[];
  /** Traduccion distinta para una columna concreta (p. ej. "barcode" es el
   * codigo de operario en Odoo, no un codigo de barras de producto). */
  labelOverrides?: Record<string, string>;
  /** Renderizado propio para una columna concreta (p. ej. un Badge de color
   * en vez del texto crudo de formatOdooValue) -- recibe la fila completa
   * porque algunas columnas calculadas (lot_role) no vienen de un campo
   * simple de Odoo. */
  cellRenderers?: Record<string, (row: Row) => React.ReactNode>;
  /** Desplegable de filtro rapido sobre una columna, aplicado en cliente
   * SOLO a la pagina ya cargada (no vuelve a pedir al backend) -- pensado
   * para columnas de pocos valores discretos, como lot_role. */
  filterableColumns?: { column: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const { t } = useTranslation("dashboard");
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string>>({});

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

  const visibleRows = rows.filter((row) =>
    (filterableColumns ?? []).every((f) => {
      const active = activeFilters[f.column];
      return !active || active === "ALL" || String(row[f.column]) === active;
    }),
  );

  return (
    <div className="space-y-3">
      {filterableColumns && filterableColumns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {filterableColumns.map((f) => (
            <div key={f.column} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{f.label}</span>
              <Select
                value={activeFilters[f.column] ?? "ALL"}
                onValueChange={(v) => setActiveFilters((prev) => ({ ...prev, [f.column]: v }))}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("masterData.filterAll")}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{t(labelOverrides?.[col] ?? `masterData.columns.${col}`, { defaultValue: col })}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={String(row.id)}>
              {columns.map((col) => (
                <TableCell key={col}>{cellRenderers?.[col] ? cellRenderers[col](row) : formatOdooValue(row[col])}</TableCell>
              ))}
            </TableRow>
          ))}
          {visibleRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                {t("masterData.filterEmpty")}
              </TableCell>
            </TableRow>
          )}
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
