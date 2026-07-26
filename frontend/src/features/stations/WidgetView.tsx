import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconAlertTriangle, IconBolt, IconDeviceDesktop, IconPlugConnected, IconScan } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { useStationAssetUrl } from "./useStationAssetUrl";
import { getBridge } from "./manufactoo-bridge";
import type { DataSourceOption, DataSourceTable, Widget } from "./types";

/** Resuelve un codigo en bruto contra Odoo, compartido por el escaneo manual y el automatico via Player. */
async function resolveDataSourceOption(dataSourceType: string, lookupColumn: string, code: string): Promise<DataSourceOption> {
  const { data } = await apiClient.get<DataSourceOption>("/api/stations/data-source-lookup", {
    params: { type: dataSourceType, column: lookupColumn, code },
  });
  return data;
}

/**
 * Render UNICO de un widget, usado tanto por el editor (modo diseno,
 * interactive=false) como por el runtime del operario (interactive=true). Al ser
 * el mismo componente y el mismo marcado, "lo que se disena es lo que se ve":
 * mismas alturas de control, mismo espaciado, mismo overflow. En el editor, el
 * contenedor padre desactiva los eventos de puntero (pointer-events-none) para
 * que el clic seleccione el widget en vez de interactuar con el control.
 */
export interface WidgetViewProps {
  widget: Widget;
  value?: unknown;
  options?: DataSourceOption[];
  deviceName?: string | null;
  eventName?: string | null;
  onChange?: (value: unknown) => void;
  onButton?: () => void;
  /** Cuando un escaneo resuelve un codigo a un registro, para que el runtime lo pueda cachear (mostrar su nombre). */
  onResolvedOption?: (dataSourceType: string, option: DataSourceOption) => void;
  interactive?: boolean;
}

export function WidgetView({
  widget,
  value,
  options,
  deviceName,
  eventName,
  onChange,
  onButton,
  onResolvedOption,
  interactive = true,
}: WidgetViewProps) {
  const { t } = useTranslation("dashboard");
  const placeholder = (widget.config.placeholder as string) ?? "";
  const change = onChange ?? (() => {});

  if (widget.widgetType === "LABEL") {
    return <div className="text-sm font-medium">{(widget.config.text as string) || widget.label}</div>;
  }
  if (widget.widgetType === "IMAGE") {
    return <WidgetImage widget={widget} />;
  }
  if (widget.widgetType === "TABLE") {
    return <WidgetTable widget={widget} value={value} onChange={change} interactive={interactive} />;
  }
  if (widget.widgetType === "BUTTON") {
    return (
      <Button className="w-full" onClick={interactive ? onButton : undefined}>
        {widget.label}
      </Button>
    );
  }

  const hasSource = Boolean(widget.sourceDeviceId || widget.sourceEventId);
  const bridge = interactive ? getBridge() : undefined;

  const label = (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="text-xs">
        {widget.label}
        {widget.required && <span className="text-destructive"> *</span>}
      </Label>
      {deviceName && (
        <Badge variant="outline" className="gap-1 text-[10px]">
          <IconDeviceDesktop className="size-3" />
          {deviceName}
        </Badge>
      )}
      {eventName && (
        <Badge variant="outline" className="gap-1 text-[10px]">
          <IconBolt className="size-3" />
          {eventName}
        </Badge>
      )}
      {/* Solo tiene sentido en el runtime real (interactive): si la pantalla se
          abrio dentro del Manufactoo Player, el dato llega solo automaticamente;
          si se abrio en un navegador normal, el operario lo introduce a mano. */}
      {hasSource && (bridge ? (
        <Badge variant="success" className="gap-1 text-[10px]">
          <IconPlugConnected className="size-3" />
          {t("stations.runtime.viaPlayer")}
        </Badge>
      ) : interactive ? (
        <span className="text-[10px] text-muted-foreground">{t("stations.runtime.browserOnly")}</span>
      ) : null)}
    </div>
  );

  if (widget.widgetType === "DROPDOWN") {
    const resolved: DataSourceOption[] =
      widget.dataSource?.type === "STATIC_LIST" ? widget.dataSource.staticOptions ?? [] : options ?? [];
    const lookupColumn = widget.config.lookupColumn as string | undefined;
    const dsType = widget.dataSource?.type;
    return (
      <div className="space-y-1.5">
        {label}
        <Select value={(value as string) ?? ""} onValueChange={change}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder || t("stations.runtime.selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {resolved.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* El dato en bruto leido por el dispositivo/evento (p. ej. el codigo de
            barras de la credencial) se resuelve aqui al registro real: se guarda
            su id (arriba, via el mismo onChange que la seleccion manual) y se
            muestra su nombre resuelto en el desplegable. Si hay Player conectado,
            ademas se resuelve SOLO (BridgeWatcher); el campo manual sigue siendo
            el respaldo si el dispositivo falla o no hay Player. */}
        {hasSource && lookupColumn && dsType && (
          <>
            {bridge && (
              <BridgeWatcher
                bridge={bridge}
                sourceDeviceId={widget.sourceDeviceId}
                sourceEventId={widget.sourceEventId}
                onRaw={(raw) => {
                  resolveDataSourceOption(dsType, lookupColumn, raw)
                    .then((opt) => {
                      onResolvedOption?.(dsType, opt);
                      change(opt.value);
                    })
                    .catch(() => {
                      /* codigo no reconocido: se ignora, el campo manual sigue disponible */
                    });
                }}
              />
            )}
            <ScanResolver
              dataSourceType={dsType}
              lookupColumn={lookupColumn}
              disabled={!interactive}
              onResolved={(opt) => {
                onResolvedOption?.(dsType, opt);
                change(opt.value);
              }}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label}
      <Input
        type={widget.widgetType === "NUMBER_INPUT" ? "number" : "text"}
        placeholder={placeholder}
        value={(value as string) ?? ""}
        onChange={(e) => change(e.target.value)}
      />
      {/* Sin origen Odoo que resolver (o TEXT/NUMBER simples): el Player rellena
          el campo directamente con el dato en bruto que reciba. */}
      {hasSource && bridge && (
        <BridgeWatcher
          bridge={bridge}
          sourceDeviceId={widget.sourceDeviceId}
          sourceEventId={widget.sourceEventId}
          onRaw={change}
        />
      )}
    </div>
  );
}

/**
 * Se suscribe (mientras el componente vive) al dato en bruto que el Player
 * entrega para el dispositivo o evento de este widget. No renderiza nada: solo
 * reenvia cada valor recibido a `onRaw`. Vive como componente propio (no un
 * useEffect suelto en WidgetView) para poder darle de baja la suscripcion
 * limpiamente cuando cambia el widget seleccionado o se desmonta la pantalla.
 */
function BridgeWatcher({
  bridge,
  sourceDeviceId,
  sourceEventId,
  onRaw,
}: {
  bridge: NonNullable<ReturnType<typeof getBridge>>;
  sourceDeviceId: number | null;
  sourceEventId: number | null;
  onRaw: (raw: string) => void;
}) {
  React.useEffect(() => {
    if (sourceDeviceId) {
      return bridge.onDeviceData(sourceDeviceId, onRaw);
    }
    if (sourceEventId) {
      return bridge.onEventData(sourceEventId, onRaw);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, sourceDeviceId, sourceEventId]);
  return null;
}

/**
 * Campo de escaneo: acepta el codigo en bruto (tecleado por un lector wedge
 * USB-HID, pegado, o escrito a mano como respaldo) y lo resuelve contra Odoo
 * al pulsar Enter. Es deliberadamente un simple <input> de texto -- cualquier
 * lector en emulacion de teclado ya escribe en el campo que tenga el foco, sin
 * necesitar ninguna integracion especial.
 */
function ScanResolver({
  dataSourceType,
  lookupColumn,
  disabled,
  onResolved,
}: {
  dataSourceType: string;
  lookupColumn: string;
  disabled: boolean;
  onResolved: (option: DataSourceOption) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [code, setCode] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  async function resolve() {
    const trimmed = code.trim();
    if (!trimmed || disabled) return;
    setStatus("loading");
    try {
      const data = await resolveDataSourceOption(dataSourceType, lookupColumn, trimmed);
      onResolved(data);
      setCode("");
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <IconScan className="size-3.5 shrink-0 text-muted-foreground" />
        <Input
          className="h-7 text-xs"
          placeholder={t("stations.runtime.scanPlaceholder")}
          value={code}
          disabled={disabled}
          onChange={(e) => {
            setCode(e.target.value);
            setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolve();
            }
          }}
        />
      </div>
      {status === "error" && (
        <p className="flex items-center gap-1 text-[11px] text-destructive">
          <IconAlertTriangle className="size-3" />
          {t("stations.runtime.scanNotFound", { code: code.trim() })}
        </p>
      )}
    </div>
  );
}

function WidgetImage({ widget }: { widget: Widget }) {
  const url = useStationAssetUrl(widget.config.assetId as number | undefined);
  const { t } = useTranslation("dashboard");
  if (!url) {
    return (
      <div className="flex size-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
        {t("stations.types.IMAGE")}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={widget.label}
      className="size-full rounded"
      style={{ objectFit: (widget.config.fit as string) === "COVER" ? "cover" : "contain" }}
    />
  );
}

function cellText(value: unknown): string {
  // Odoo many2one llega como [id, "etiqueta"]; mostramos la etiqueta.
  if (Array.isArray(value)) return String(value[1] ?? value[0] ?? "");
  if (value === null || value === undefined || value === false) return "";
  return String(value);
}

function WidgetTable({
  widget,
  value,
  onChange,
  interactive,
}: {
  widget: Widget;
  value: unknown;
  onChange: (value: unknown) => void;
  interactive: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const [table, setTable] = React.useState<DataSourceTable | null>(null);
  const [error, setError] = React.useState(false);
  const type = widget.dataSource?.type;
  const selectionMode = (widget.config.selectionMode as string) ?? "NONE";
  const valueColumn = (widget.config.valueColumn as string) || "id";
  const selectable = selectionMode === "SINGLE" || selectionMode === "MULTI";

  React.useEffect(() => {
    if (!type || type === "STATIC_LIST") return;
    const maxRows = Number(widget.config.maxRows) || 50;
    apiClient
      .get<DataSourceTable>("/api/stations/data-source-table", { params: { type, limit: maxRows } })
      .then(({ data }) => setTable(data))
      .catch(() => setError(true));
  }, [type, widget.config.maxRows]);

  if (error) return <p className="text-xs text-destructive">{t("stations.runtime.loadOptionsError")}</p>;
  if (!table) return <p className="text-xs text-muted-foreground">{t("masterData.loading")}</p>;

  const selectedSet = new Set(
    selectionMode === "MULTI" ? ((value as string[]) ?? []) : value != null ? [String(value)] : [],
  );

  function toggleRow(rowVal: string) {
    if (selectionMode === "SINGLE") {
      onChange(String(value) === rowVal ? "" : rowVal);
    } else {
      const next = new Set((value as string[]) ?? []);
      if (next.has(rowVal)) next.delete(rowVal);
      else next.add(rowVal);
      onChange([...next]);
    }
  }

  return (
    <div className="no-scrollbar h-full overflow-auto rounded border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && <TableHead className="w-8" />}
            {table.columns.map((c) => (
              <TableHead key={c.key}>{t(c.labelKey, { defaultValue: c.key })}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, i) => {
            const rowVal = String(row[valueColumn] ?? row.id ?? i);
            const checked = selectedSet.has(rowVal);
            return (
              <TableRow
                key={rowVal}
                data-state={checked ? "selected" : undefined}
                className={selectable ? "cursor-pointer" : undefined}
                onClick={selectable && interactive ? () => toggleRow(rowVal) : undefined}
              >
                {selectable && (
                  <TableCell className="w-8">
                    <Checkbox checked={checked} aria-label="select" />
                  </TableCell>
                )}
                {table.columns.map((c) => (
                  <TableCell key={c.key}>{cellText(row[c.key])}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
