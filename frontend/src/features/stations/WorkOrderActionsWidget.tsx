import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconScan } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { DataSourceOption, Widget, WorkOrderSession } from "./types";

/** Mensaje real del backend si viene en la respuesta (ver MaterialsDialog, mismo patron). */
function errorMessage(err: unknown, fallback: string): string {
  const backendMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return backendMessage ?? fallback;
}

/**
 * Tiempo transcurrido desde que empezo la sesion (startedAt nunca cambia
 * entre pausas/reanudaciones, ver WorkOrderSessionService) -- es una
 * aproximacion sencilla de "tiempo desde el inicio", no resta los huecos
 * pausados/bloqueados. El tiempo real y exacto por tramos vive en Odoo
 * (mrp.workcenter.productivity.duration), consultable en Manufacturing >
 * Work Orders si hace falta precision.
 */
function formatElapsed(startedAt: string): string {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export interface WorkOrderActionsWidgetProps {
  widget: Widget;
  stationId?: string | number;
  odooWorkcenterId?: number | null;
  resolvedRows?: Record<string, Record<string, unknown>>;
  interactive: boolean;
}

/**
 * Start/Pausar/Bloquear/Finalizar + cantidad sobre el work order actualmente
 * seleccionado en la TABLE(ODOO_WORKORDERS) vinculada (config.boundTo) --
 * escribe de verdad en Odoo (ver OdooShopFloorService) ademas de llevar su
 * propia sesion local. Ver conversacion 2026-08-05.
 * <p>
 * El operario se identifica escaneando/tecleando su codigo en un campo propio
 * del widget (no hay un dispositivo/evento configurable como en
 * STATION_MATERIALS, de momento -- simplificacion consciente de esta primera
 * version: un lector de codigo de barras normal (USB-HID) escribe igualmente
 * en cualquier input con foco, asi que sigue funcionando en la practica).
 */
export function WorkOrderActionsWidget({ widget, stationId, odooWorkcenterId, resolvedRows, interactive }: WorkOrderActionsWidgetProps) {
  const { t } = useTranslation("dashboard");
  const boundTo = widget.config.boundTo as string | undefined;
  const boundRow = boundTo ? resolvedRows?.[boundTo] : undefined;
  const odooWorkorderId = boundRow?.id != null ? Number(boundRow.id) : null;

  const [session, setSession] = React.useState<WorkOrderSession | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [operatorCode, setOperatorCode] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [reasons, setReasons] = React.useState<DataSourceOption[]>([]);
  const [reasonId, setReasonId] = React.useState("");
  const [showBlockPicker, setShowBlockPicker] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [, forceTick] = React.useState(0);

  // Sesion activa de la estacion al montar (p. ej. si se recarga la pagina con una sesion ya en marcha).
  React.useEffect(() => {
    if (!interactive || !stationId) return;
    apiClient
      .get<WorkOrderSession | null>(`/api/stations/${stationId}/work-order-sessions/active`)
      .then(({ data }) => setSession(data || null))
      .catch(() => setSession(null))
      .finally(() => setLoaded(true));
  }, [interactive, stationId]);

  // Motivos de bloqueo manuales (ODOO_LOSS_REASONS) -- se piden una vez, se usan solo si se abre el selector de bloqueo.
  React.useEffect(() => {
    if (!interactive) return;
    apiClient
      .get<DataSourceOption[]>("/api/stations/data-source-options", { params: { type: "ODOO_LOSS_REASONS", limit: 50 } })
      .then(({ data }) => setReasons(data))
      .catch(() => setReasons([]));
  }, [interactive]);

  // Cronometro: refresca cada segundo mientras la sesion esta en marcha.
  React.useEffect(() => {
    if (!interactive || session?.state !== "RUNNING") return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [interactive, session?.state]);

  React.useEffect(() => {
    setQty(session ? String(session.qtyProducing) : "");
  }, [session?.id, session?.qtyProducing]);

  async function run(action: () => Promise<{ data: WorkOrderSession }>) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await action();
      setSession(data);
      setShowBlockPicker(false);
    } catch (err) {
      setError(errorMessage(err, t("stations.runtime.workorderActionError")));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!odooWorkorderId || busy) return;
    void run(() =>
      apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/start`, {
        odooWorkorderId,
        odooWorkcenterId: odooWorkcenterId ?? null,
        operatorCode: operatorCode.trim() || undefined,
      }),
    );
  }

  function pause() {
    if (!session || busy) return;
    void run(() => apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/${session.id}/pause`));
  }

  function resume() {
    if (!session || busy) return;
    void run(() =>
      apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/${session.id}/resume`, null, {
        params: operatorCode.trim() ? { operatorCode: operatorCode.trim() } : undefined,
      }),
    );
  }

  function saveQty() {
    if (!session) return;
    const value = Number(qty);
    if (Number.isNaN(value) || value === session.qtyProducing) return;
    void run(() => apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/${session.id}/qty`, { qty: value }));
  }

  function block() {
    if (!session || !reasonId || busy) return;
    const reason = reasons.find((r) => r.value === reasonId);
    void run(() =>
      apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/${session.id}/block`, {
        reasonId: Number(reasonId),
        reasonName: reason?.label,
      }),
    );
  }

  async function finish() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post<WorkOrderSession>(`/api/stations/${stationId}/work-order-sessions/${session.id}/finish`);
      setSession(null);
    } catch (err) {
      setError(errorMessage(err, t("stations.runtime.workorderActionError")));
    } finally {
      setBusy(false);
    }
  }

  // En el Builder (interactive=false) nunca se dispara ninguna llamada real -- solo una vista de ejemplo.
  if (!interactive) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 rounded border border-dashed p-2 text-center text-xs text-muted-foreground">
        <p>{t("stations.widget.workorderActionsPreview")}</p>
      </div>
    );
  }

  if (!boundTo) {
    return <p className="text-xs text-destructive">{t("stations.widget.workorderActionsNeedsBoundTo")}</p>;
  }

  if (!loaded) {
    return <p className="text-xs text-muted-foreground">{t("masterData.loading")}</p>;
  }

  const showOperatorInput = !session || session.state !== "RUNNING";

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto rounded border p-2">
      {/* Ancla el widget conceptualmente al work order, NO a la unidad fisica
          que se esta registrando -- para que no se confunda con el boton
          normal de "Finalizar y registrar" de la estacion (ver conversacion
          2026-08-05: dos "Finalizar" en la misma pantalla sin ninguna
          distincion visual era la friccion mas confusa que se detecto). */}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("stations.widget.workorderActionsHeader")}
      </p>

      {!session && !odooWorkorderId && (
        <p className="text-xs text-muted-foreground">{t("stations.runtime.workorderNoSelection")}</p>
      )}

      {session && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{t(`stations.runtime.workorderState.${session.state}`)}</span>
          {session.state === "RUNNING" && <span className="font-mono text-xs">{formatElapsed(session.startedAt)}</span>}
        </div>
      )}

      {session?.operatorName && <p className="text-[11px] text-muted-foreground">{session.operatorName}</p>}

      {session?.state === "BLOCKED" && session.blockReasonName && (
        <p className="text-xs text-destructive">{session.blockReasonName}</p>
      )}

      {showOperatorInput && (
        // Mismo icono/patron que cualquier otro campo escaneable de la app
        // (ver WidgetView.tsx): sin el, nada indicaba visualmente que aqui
        // se puede escanear un codigo, no solo teclearlo.
        <div className="flex items-center gap-1.5">
          <IconScan className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            className="h-8 text-sm"
            placeholder={t("stations.runtime.operatorCodePlaceholder")}
            value={operatorCode}
            onChange={(e) => setOperatorCode(e.target.value)}
          />
        </div>
      )}

      {!session && (
        <Button size="sm" disabled={!odooWorkorderId || busy} onClick={start}>
          {t("stations.runtime.workorderStart")}
        </Button>
      )}

      {session && session.state !== "BLOCKED" && (
        <div className="flex items-center gap-1.5">
          <Input type="number" className="h-8 text-sm" value={qty} onChange={(e) => setQty(e.target.value)} onBlur={saveQty} />
          <Label className="text-xs text-muted-foreground">{t("stations.runtime.workorderQty")}</Label>
        </div>
      )}

      {session && (
        <div className="flex flex-wrap gap-1.5">
          {session.state === "RUNNING" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={pause}>
              {t("stations.runtime.workorderPause")}
            </Button>
          )}
          {(session.state === "PAUSED" || session.state === "BLOCKED") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={resume}>
              {t("stations.runtime.workorderResume")}
            </Button>
          )}
          {session.state !== "BLOCKED" && !showBlockPicker && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowBlockPicker(true)}>
              {t("stations.runtime.workorderBlock")}
            </Button>
          )}
          {session.state !== "BLOCKED" && (
            <Button size="sm" disabled={busy} onClick={() => void finish()}>
              {t("stations.runtime.workorderFinish")}
            </Button>
          )}
        </div>
      )}

      {showBlockPicker && (
        <div className="flex items-center gap-1.5">
          <Select value={reasonId} onValueChange={setReasonId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t("stations.runtime.workorderBlockReasonPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!reasonId || busy} onClick={block}>
            {t("stations.runtime.workorderConfirmBlock")}
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
