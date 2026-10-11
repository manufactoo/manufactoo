import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

/** Una orden de fabricacion abierta con su completitud, tal como la devuelve GET /api/dashboard/open-orders (ver OpenManufacturingOrderDto). */
interface OpenOrder {
  id: number;
  name: string;
  productName: string;
  productQty: number;
  qtyProducing: number;
  completionPercent: number;
  state: string;
}

const POLL_MS = 30000;
const TICKS = [0, 25, 50, 75, 100];
const LABEL_WIDTH = 132; // px, columna de nombre/producto
const VALUE_WIDTH = 40; // px, columna de "%"

const STATE_VARIANT: Record<string, "default" | "outline" | "secondary"> = {
  confirmed: "outline",
  progress: "default",
  to_close: "secondary",
};

/**
 * Grafico de completitud de las ordenes de fabricacion ABIERTAS (ni
 * borrador, ni terminadas, ni canceladas -- ver conversacion 2026-08-07):
 * UN SOLO grafico de barras horizontal con eje compartido 0-100%, no una
 * pila de mini barras de progreso independientes -- las lineas de rejilla
 * (25/50/75%) atraviesan TODAS las filas a la vez, para que se lean como
 * una unica comparativa, no como N widgets sueltos (ver conversacion
 * 2026-08-07, "algo que englobe todas"). % = qty_producing / product_qty,
 * el mismo progreso en vivo que ya escribe OdooProductionService.recordUnit
 * al pasar unidades por una estacion (no espera a que la orden se cierre).
 * Ordenado de menor a mayor completitud: lo que menos avanzado esta arriba,
 * mas util para saber que necesita atencion primero.
 */
export function OpenOrdersChart() {
  const { t, i18n } = useTranslation("dashboard");
  const [orders, setOrders] = React.useState<OpenOrder[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const load = React.useCallback(() => {
    apiClient
      .get<OpenOrder[]>("/api/dashboard/open-orders")
      .then(({ data }) => {
        setOrders(data);
        setError(null);
      })
      .catch((err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(message ?? t("openOrders.error"));
      });
  }, [t]);

  React.useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const percentFormat = React.useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }),
    [i18n.language],
  );

  const sorted = React.useMemo(
    () => (orders ? [...orders].sort((a, b) => a.completionPercent - b.completionPercent) : []),
    [orders],
  );

  const avgCompletion = sorted.length > 0
    ? sorted.reduce((sum, o) => sum + o.completionPercent, 0) / sorted.length
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t("openOrders.title")}</CardTitle>
          <CardDescription>{t("openOrders.subtitle")}</CardDescription>
        </div>
        {sorted.length > 0 && (
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums leading-none">{sorted.length}</div>
              <div className="text-[10px] text-muted-foreground">{t("openOrders.count")}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums leading-none">
                {percentFormat.format(avgCompletion)}%
              </div>
              <div className="text-[10px] text-muted-foreground">{t("openOrders.average")}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="ml-1 self-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {showTable ? t("openOrders.viewChart") : t("openOrders.viewTable")}
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && orders === null && <p className="text-sm text-muted-foreground">{t("masterData.loading")}</p>}
        {!error && sorted.length === 0 && orders !== null && (
          <p className="text-sm text-muted-foreground">{t("openOrders.empty")}</p>
        )}

        {!error && sorted.length > 0 && !showTable && (
          <div>
            {/* Eje: marcas 0/25/50/75/100%, compartido por todas las filas de abajo */}
            <div className="flex text-[10px] text-muted-foreground">
              <div style={{ width: LABEL_WIDTH }} />
              <div className="relative h-4 flex-1">
                {TICKS.map((tick) => (
                  <span
                    key={tick}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${tick}%` }}
                  >
                    {tick}%
                  </span>
                ))}
              </div>
              <div style={{ width: VALUE_WIDTH }} />
            </div>

            <div className="relative">
              {/* Lineas de rejilla: UNA sola capa que atraviesa todas las filas -- esto es lo
                  que hace que se lea como un unico grafico comparativo, no N barras sueltas. */}
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{ left: LABEL_WIDTH, right: VALUE_WIDTH }}
              >
                {TICKS.map((tick) => (
                  <div
                    key={tick}
                    className="absolute inset-y-0 w-px bg-border"
                    style={{ left: `${tick}%` }}
                  />
                ))}
              </div>

              <div className="space-y-0.5">
                {sorted.map((o) => {
                  const pct = Math.min(100, o.completionPercent);
                  return (
                    <div
                      key={o.id}
                      tabIndex={0}
                      className="group relative flex items-center gap-2 rounded py-1 outline-none focus-visible:bg-muted/60 hover:bg-muted/60"
                    >
                      <div style={{ width: LABEL_WIDTH }} className="min-w-0 pr-2">
                        <div className="truncate text-xs font-medium">{o.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{o.productName}</div>
                      </div>
                      <div className="relative h-4 flex-1">
                        <div
                          className="absolute inset-y-1 left-0 rounded-full bg-[#2a78d6] transition-[width] dark:bg-[#3987e5]"
                          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <div
                        style={{ width: VALUE_WIDTH }}
                        className="shrink-0 text-right text-xs tabular-nums text-muted-foreground"
                      >
                        {percentFormat.format(pct)}%
                      </div>

                      {/* Tooltip: aparece con hover o foco (teclado), nunca es la unica forma de ver el dato -- ya esta el % al lado y la vista de tabla. */}
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
                      >
                        <div className="font-medium">{o.name}</div>
                        <div className="text-muted-foreground">{o.productName}</div>
                        <div className="mt-0.5">
                          <span className="font-semibold tabular-nums">{percentFormat.format(o.qtyProducing)}</span>
                          <span className="text-muted-foreground"> / {percentFormat.format(o.productQty)}</span>
                          <span className="text-muted-foreground"> · {t(`openOrders.state.${o.state}`, o.state)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!error && sorted.length > 0 && showTable && (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">{t("openOrders.table.order")}</th>
                <th className="py-1 pr-2 font-normal">{t("openOrders.table.product")}</th>
                <th className="py-1 pr-2 font-normal">{t("openOrders.table.state")}</th>
                <th className="py-1 pr-2 text-right font-normal">{t("openOrders.table.quantity")}</th>
                <th className="py-1 text-right font-normal">{t("openOrders.table.completion")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{o.name}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{o.productName}</td>
                  <td className="py-1.5 pr-2">
                    <Badge variant={STATE_VARIANT[o.state] ?? "outline"}>
                      {t(`openOrders.state.${o.state}`, o.state)}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                    {percentFormat.format(o.qtyProducing)}/{percentFormat.format(o.productQty)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">
                    {percentFormat.format(o.completionPercent)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
