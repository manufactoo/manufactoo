import * as React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { IconBolt, IconDeviceDesktop, IconPlugConnected, IconScan } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { useStationAssetUrl } from "./useStationAssetUrl";
import { getBridge } from "./manufactoo-bridge";
import { fetchDataSourceTable } from "./dataSourceTableCache";
import type { DataSourceOption, DataSourceTable, MaterialLoad, Widget, WidgetStyle } from "./types";

/** Resuelve un codigo en bruto contra Odoo, compartido por el escaneo manual y el automatico via Player. */
async function resolveDataSourceOption(dataSourceType: string, lookupColumn: string, code: string): Promise<DataSourceOption> {
  const { data } = await apiClient.get<DataSourceOption>("/api/stations/data-source-lookup", {
    params: { type: dataSourceType, column: lookupColumn, code },
  });
  return data;
}

/**
 * Cada widget puede tener mas de un "contenido" independiente que se pueda
 * seleccionar y estilizar por separado (tamano, negrita, alineacion,
 * colores). Desde que cada widget se reduce a su expresion minima (la
 * etiqueta encima de un campo o el detalle de una validacion ya no viven
 * DENTRO del widget: son sus propios widgets LABEL, ver mas abajo) casi todos
 * tienen un unico contenido -- solo TABLE conserva dos (cabecera/celdas),
 * porque son estructurales, no una descripcion que tenga sentido componer
 * aparte. Se guarda en config.styles = { [parte]: WidgetStyle }. Mismo
 * componente en diseno y runtime, asi que aplicar las clases aqui basta para
 * WYSIWYG (ver StationBuilderPage para la barra de estilo flotante).
 */
export const WIDGET_STYLE_PARTS: Record<string, string[]> = {
  LABEL: ["text"],
  BUTTON: ["text"],
  DROPDOWN: ["value"],
  TEXT_INPUT: ["value"],
  NUMBER_INPUT: ["value"],
  TABLE: ["header", "cell"],
  IMAGE: ["image"],
  PANEL: ["panel"],
};

/**
 * Partes que se pueden ocultar del todo. Solo le queda sentido a la cabecera
 * de TABLE (estructural, no un widget aparte); todo lo demas que antes era
 * "opcional" (etiqueta de campo, detalle de validacion) ahora simplemente no
 * se anade como widget si no se quiere ver -- no hace falta un interruptor de
 * mostrar/ocultar para eso.
 */
export const OPTIONAL_STYLE_PARTS: Record<string, string[]> = {
  TABLE: ["header"],
};

function partStyle(widget: Widget, part: string): WidgetStyle {
  const styles = (widget.config.styles as Record<string, WidgetStyle> | undefined) ?? {};
  return styles[part] ?? {};
}

const FONT_SIZE_CLASSES: Record<string, string> = {
  SM: "text-xs",
  MD: "text-sm",
  LG: "text-lg",
  XL: "text-2xl",
  XXL: "text-4xl",
};

const ALIGN_CLASSES: Record<string, string> = {
  LEFT: "text-left",
  CENTER: "text-center",
  RIGHT: "text-right",
};

/** Clases de texto (tamano+negrita+alineacion), compartidas por cualquier texto del widget: etiqueta, valor, celdas de tabla... */
function textClasses(style: WidgetStyle): string {
  return [
    FONT_SIZE_CLASSES[style.fontSize ?? "MD"] ?? FONT_SIZE_CLASSES.MD,
    style.bold ? "font-bold" : "font-normal",
    ALIGN_CLASSES[style.align ?? "LEFT"] ?? ALIGN_CLASSES.LEFT,
  ].join(" ");
}

/** Alto del control (Input/SelectTrigger/Boton) a juego con el tamano de texto, para que LG/XL/XXL no se apreten en la altura fija por defecto (h-9). */
const CONTROL_HEIGHT_CLASSES: Record<string, string> = {
  SM: "h-8",
  MD: "h-9",
  LG: "h-11",
  XL: "h-14",
  XXL: "h-20",
};

/** Mismo alto que CONTROL_HEIGHT_CLASSES pero en px -- para que StationBuilderPage pueda calcular cuantas filas de grid necesita cada tamano sin duplicar estos numeros. */
export const CONTROL_HEIGHT_PX: Record<NonNullable<WidgetStyle["fontSize"]>, number> = {
  SM: 32,
  MD: 36,
  LG: 44,
  XL: 56,
  XXL: 80,
};

/** Alto natural del texto (line-height de cada FONT_SIZE_CLASSES) para partes sin control propio, como el texto de una Etiqueta. */
export const TEXT_LINE_HEIGHT_PX: Record<NonNullable<WidgetStyle["fontSize"]>, number> = {
  SM: 16,
  MD: 20,
  LG: 28,
  XL: 32,
  XXL: 40,
};

function controlSizeClass(style: WidgetStyle): string {
  return `${textClasses(style)} ${CONTROL_HEIGHT_CLASSES[style.fontSize ?? "MD"] ?? CONTROL_HEIGHT_CLASSES.MD}`;
}

/** Fecha/hora actual con formato, actualizada cada segundo cuando esta habilitada. */
function useLiveDateTime(dateTimeFormat: string, enabled: boolean): string {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);
  return enabled ? format(now, dateTimeFormat) : "";
}

function textColorStyle(style: WidgetStyle): React.CSSProperties {
  return style.textColor ? { color: style.textColor } : {};
}

function backgroundStyle(style: WidgetStyle): React.CSSProperties {
  return style.backgroundColor ? { backgroundColor: style.backgroundColor } : {};
}

/** Igual que resolveDataSourceOption pero trae varios campos de la fila (detalle configurable de un TEXT_INPUT validado). */
async function resolveDataSourceRow(
  dataSourceType: string,
  lookupColumn: string,
  code: string,
  columns: string[],
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>("/api/stations/data-source-lookup-row", {
    params: { type: dataSourceType, column: lookupColumn, code, columns: columns.join(",") },
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
/** Clave que representa "el valor crudo del widget" al vincular una Etiqueta, en vez de una columna resuelta de Odoo. */
export const BOUND_FIELD_VALUE = "_value";

export interface WidgetViewProps {
  widget: Widget;
  value?: unknown;
  options?: DataSourceOption[];
  deviceName?: string | null;
  eventName?: string | null;
  onChange?: (value: unknown) => void;
  onButton?: () => void;
  /**
   * Un TEXT_INPUT o DROPDOWN con config.finalizesFlow finaliza el flujo de la
   * estacion y registra la unidad como OK en cuanto se confirma su valor --
   * Enter en TEXT_INPUT (p. ej. tras escanear un numero de serie), o cualquier
   * forma de fijar el valor en DROPDOWN (seleccion manual, escaneo, Player).
   * No decide nada aqui: solo reporta "este widget confirmo este valor",
   * StationRuntimePage es quien mira config.finalizesFlow y decide si eso
   * finaliza (ver conversacion 2026-07-31).
   */
  onConfirm?: (widget: Widget, value: unknown) => void;
  /** Cuando un escaneo resuelve un codigo a un registro, para que el runtime lo pueda cachear (mostrar su nombre). */
  onResolvedOption?: (dataSourceType: string, option: DataSourceOption) => void;
  /**
   * Columnas Odoo disponibles por origen de datos (mismo catalogo que usa
   * Propiedades para "Columna de coincidencia"): un TEXT_INPUT validado las
   * necesita para resolver TODAS las columnas del registro encontrado, no
   * solo una -- asi cualquier Etiqueta vinculada a el puede pedir la que
   * quiera sin que el propio campo tenga que saber de antemano cual.
   */
  displayColumns?: Record<string, string[]>;
  /**
   * Datos ya resueltos de otros widgets de la estacion, indexados por su
   * bindingKey: BOUND_FIELD_VALUE es el valor crudo capturado, el resto son
   * columnas Odoo resueltas (TEXT_INPUT validado, seleccion de DROPDOWN/TABLE).
   * Lo calcula el runtime (ver StationRuntimePage); una Etiqueta vinculada
   * simplemente lee de aqui, no resuelve nada por su cuenta.
   */
  resolvedRows?: Record<string, Record<string, unknown>>;
  /** Un TEXT_INPUT validado reporta aqui la fila que acaba de resolver (o null si el codigo ya no es valido), para que StationRuntimePage la guarde y las Etiquetas vinculadas a el se actualicen. */
  onResolvedRow?: (bindingKey: string, row: Record<string, unknown> | null) => void;
  /**
   * Un TEXT_INPUT o DROPDOWN que valida codigos contra Odoo reporta aqui su
   * error activo (o null cuando se resuelve/se vacia el campo) en vez de
   * pintarlo el mismo -- el widget se queda exactamente como se diseño, sin
   * crecer ni añadir texto propio; StationRuntimePage junta los errores de
   * todos los widgets en una zona fija comun (ver conversacion 2026-07-29).
   */
  onError?: (bindingKey: string, message: string | null) => void;
  /**
   * Lotes/series activos ahora mismo en la ESTACION (no en ningun widget ni
   * "ranura") -- a diferencia del resto de "value", no vive en el formulario
   * del envio: lo carga StationRuntimePage aparte (GET
   * /api/stations/{id}/material-loads) porque persiste entre unidades (ver
   * conversacion 2026-07-30, tercera vuelta). El widget STATION_MATERIALS
   * solo lo LEE (es puramente informativo) -- cargarlo, a mano o por
   * dispositivo/evento, vive en StationRuntimePage/MaterialsDialog.
   */
  materialLoads?: MaterialLoad[];
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
  onConfirm,
  onResolvedOption,
  displayColumns,
  resolvedRows,
  onResolvedRow,
  onError,
  materialLoads,
  interactive = true,
}: WidgetViewProps) {
  const { t } = useTranslation("dashboard");
  const placeholder = (widget.config.placeholder as string) ?? "";
  const change = onChange ?? (() => {});

  if (widget.widgetType === "LABEL") {
    const style = partStyle(widget, "text");
    const boundTo = widget.config.boundTo as string | undefined;
    const showDateTime = widget.config.showDateTime === true;
    const dateTimeFormat = (widget.config.dateTimeFormat as string) || "dd/MM/yyyy HH:mm:ss";

    const liveDateTime = useLiveDateTime(dateTimeFormat, showDateTime && interactive);
    let text: string;
    if (showDateTime) {
      text = interactive ? liveDateTime : format(new Date(), dateTimeFormat);
    } else if (boundTo) {
      // Vinculada a otro widget: el texto ya no se teclea, se calcula. En
      // diseno no hay ningun dato real todavia (nadie ha tecleado/seleccionado
      // nada), asi que se enseña un valor de ejemplo -- mismo sitio, mismo
      // tamano, para que el diseñador vea donde y como de grande saldra.
      text = interactive ? cellText(resolvedRows?.[boundTo]?.[(widget.config.boundField as string) || BOUND_FIELD_VALUE]) : t("stations.widget.detailPreviewValue");
    } else {
      text = (widget.config.text as string) ?? "";
    }
    return (
      <div className={`rounded px-1 ${textClasses(style)}`} style={{ ...textColorStyle(style), ...backgroundStyle(style) }}>
        {text}
      </div>
    );
  }
  if (widget.widgetType === "IMAGE") {
    return <WidgetImage widget={widget} />;
  }
  if (widget.widgetType === "PANEL") {
    // Puramente decorativo: agrupa visualmente otros widgets colocados
    // encima (sin relacion real de datos -- ver conversacion 2026-08-01).
    // pointer-events-none para que nunca robe un clic destinado a un widget
    // que se solape con el; StationBuilderPage/StationRuntimePage ademas lo
    // pintan siempre por detras (zIndex mas bajo) independientemente del
    // orden en que se haya añadido.
    // Puramente decorativo, sin margen extra: el espacio entre el borde del
    // panel y los widgets "dentro" se consigue con el padding horizontal de
    // los contenedores de los demas widgets (ver StationBuilderPage y
    // StationRuntimePage). El contenedor padre tiene overflow-x visible.
    const style = partStyle(widget, "panel");
    return <div className="pointer-events-none h-full rounded-md border border-border" style={backgroundStyle(style)} />;
  }
  if (widget.widgetType === "TABLE") {
    return <WidgetTable widget={widget} value={value} onChange={change} interactive={interactive} />;
  }
  if (widget.widgetType === "BUTTON") {
    const style = partStyle(widget, "text");
    return (
      <Button
        className={`w-full ${controlSizeClass(style)}`}
        style={{ ...textColorStyle(style), ...backgroundStyle(style) }}
        onClick={interactive ? onButton : undefined}
      >
        {(widget.config.text as string) ?? ""}
      </Button>
    );
  }

  const hasSource = Boolean(widget.sourceDeviceId || widget.sourceEventId);
  const bridge = interactive ? getBridge() : undefined;
  const valueStyle = partStyle(widget, "value");
  // Fondo de la parte "value": sin color de fondo no se anade ni padding ni
  // esquinas redondeadas, para no mover un pixel el layout ya diseñado cuando
  // nadie ha tocado el estilo.
  const valueBgClass = valueStyle.backgroundColor ? "rounded p-1" : "";

  // El control es lo unico obligatorio del widget (DROPDOWN/TEXT_INPUT/
  // NUMBER_INPUT ya no llevan una etiqueta ni un detalle incrustados -- eso
  // es cosa de widgets LABEL sueltos, vinculados o no, para poder componer el
  // layout libremente). Lo unico que sigue viviendo pegado al control es si
  // esta alimentado por un dispositivo/evento. Fila compacta, solo aparece si
  // hay algo que enseñar.
  const showStatusRow = hasSource;
  const statusRow = showStatusRow && (
    <div className="flex flex-wrap items-center gap-1.5">
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

  if (widget.widgetType === "STATION_MATERIALS") {
    return <StationMaterialsWidget loads={materialLoads ?? []} interactive={interactive} />;
  }

  if (widget.widgetType === "DROPDOWN") {
    const resolved: DataSourceOption[] =
      widget.dataSource?.type === "STATIC_LIST" ? widget.dataSource.staticOptions ?? [] : options ?? [];
    const lookupColumn = widget.config.lookupColumn as string | undefined;
    const dsType = widget.dataSource?.type;
    // Cualquier forma de fijar el valor cuenta como "confirmarlo" -- seleccion
    // manual, escaneo (ScanResolver) o Player (BridgeWatcher) -- asi que las
    // tres pasan por aqui en vez de llamar a `change` directamente.
    const confirmChange = (v: unknown) => {
      change(v);
      onConfirm?.(widget, v);
    };
    return (
      <div className="space-y-1.5">
        <div className={valueBgClass}>
          <Select value={(value as string) ?? ""} onValueChange={confirmChange}>
            <SelectTrigger className={controlSizeClass(valueStyle)} style={{ ...textColorStyle(valueStyle), ...backgroundStyle(valueStyle) }}>
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
        </div>
        {statusRow}
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
                      confirmChange(opt.value);
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
              fieldName={widget.bindingKey ?? widget.widgetType}
              onError={(msg) => widget.bindingKey && onError?.(widget.bindingKey, msg)}
              onResolved={(opt) => {
                onResolvedOption?.(dsType, opt);
                confirmChange(opt.value);
              }}
            />
          </>
        )}
      </div>
    );
  }

  // TEXT_INPUT con origen de datos: el operario teclea un codigo (p. ej. el
  // codigo de operario) que se valida en vivo contra Odoo. El valor guardado
  // sigue siendo el codigo tecleado (no un id resuelto), y el backend lo
  // revalida al enviar el registro (ver StationService.validateDataSourceLookups).
  // El dato resuelto (p. ej. el nombre) ya no se enseña aqui: se reporta hacia
  // arriba (onResolvedRow) para que cualquier Etiqueta vinculada a este widget
  // lo enseñe donde el diseñador la haya puesto.
  const dsType = widget.dataSource?.type;
  const lookupColumn = widget.config.lookupColumn as string | undefined;
  if (widget.widgetType === "TEXT_INPUT" && dsType && dsType !== "STATIC_LIST" && lookupColumn) {
    return (
      <div className="space-y-1.5">
        <div className={valueBgClass}>
          <Input
            className={controlSizeClass(valueStyle)}
            style={{ ...textColorStyle(valueStyle), ...backgroundStyle(valueStyle) }}
            placeholder={placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => change(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm?.(widget, e.currentTarget.value);
              }
            }}
          />
        </div>
        <ValidationIndicator
          dataSourceType={dsType}
          lookupColumn={lookupColumn}
          columns={displayColumns?.[dsType] ?? []}
          code={(value as string) ?? ""}
          interactive={interactive}
          fieldName={widget.bindingKey ?? widget.widgetType}
          onResolvedRow={(row) => widget.bindingKey && onResolvedRow?.(widget.bindingKey, row)}
          onError={(msg) => widget.bindingKey && onError?.(widget.bindingKey, msg)}
        />
        {statusRow}
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

  return (
    <div className="space-y-1.5">
      <div className={valueBgClass}>
        <Input
          type={widget.widgetType === "NUMBER_INPUT" ? "number" : "text"}
          className={controlSizeClass(valueStyle)}
          style={{ ...textColorStyle(valueStyle), ...backgroundStyle(valueStyle) }}
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && widget.widgetType === "TEXT_INPUT") {
              e.preventDefault();
              onConfirm?.(widget, e.currentTarget.value);
            }
          }}
        />
      </div>
      {statusRow}
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
 * Lista de lotes/series activos ahora mismo en la ESTACION (p. ej. los
 * carretes cargados en una maquina de pick and place): puramente
 * informativo, no se rellena por unidad. Cargar/descargar un lote (a mano o
 * automaticamente por dispositivo/evento) vive fuera de este widget, en el
 * popup de Materiales (boton con accion MATERIALS) -- este solo lo pinta
 * (ver conversacion 2026-07-30, tercera vuelta).
 */
function StationMaterialsWidget({ loads, interactive }: { loads: MaterialLoad[]; interactive: boolean }) {
  const { t, i18n } = useTranslation("dashboard");

  if (!interactive) {
    return (
      <div className="flex size-full flex-col justify-center gap-1 rounded border border-dashed p-2 text-xs text-muted-foreground">
        <span className="font-medium">{t("stations.types.STATION_MATERIALS")}</span>
        <span>{t("stations.widget.stationMaterialsPreview")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded border px-2 py-1.5">
      {loads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("stations.runtime.materialsEmpty")}</p>
      ) : (
        loads.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">
              {l.position && (
                <span className="mr-1 rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  {l.position}
                </span>
              )}
              {l.name} <span className="text-muted-foreground">· {l.label}</span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {new Date(l.loadedAt).toLocaleString(i18n.language)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Valida en vivo (debounce) un codigo tecleado a mano contra un origen Odoo.
 * Es puramente informativo en el cliente -- el backend revalida siempre al
 * enviar el registro (ver StationService.validateDataSourceLookups), asi que
 * esto no sustituye esa comprobacion, solo da feedback inmediato al operario.
 * No enseña nada ella misma (ni el dato resuelto ni el aviso de codigo
 * invalido): el dato resuelto es cosa de cualquier Etiqueta vinculada a este
 * widget (onResolvedRow), y el aviso de codigo invalido se reporta hacia
 * arriba (onError) para que StationRuntimePage lo junte con el resto de
 * errores activos en una zona fija comun -- el widget no crece ni cambia de
 * aspecto por validar mal (ver conversacion 2026-07-29).
 */
function ValidationIndicator({
  dataSourceType,
  lookupColumn,
  columns,
  code,
  interactive,
  fieldName,
  onResolvedRow,
  onError,
}: {
  dataSourceType: string;
  lookupColumn: string;
  /** Todas las columnas disponibles de este origen (no una eleccion del diseñador): se resuelven todas para que cualquier Etiqueta vinculada pueda pedir la que quiera. */
  columns: string[];
  code: string;
  interactive: boolean;
  /** Identificador del widget (bindingKey) para nombrar el error en la zona fija comun. */
  fieldName: string;
  onResolvedRow: (row: Record<string, unknown> | null) => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useTranslation("dashboard");
  const onResolvedRowRef = React.useRef(onResolvedRow);
  onResolvedRowRef.current = onResolvedRow;
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  React.useEffect(() => {
    if (!interactive) return; // en diseno no hay ningun codigo real tecleado, ver LABEL para su vista previa
    const trimmed = code.trim();
    if (!trimmed) {
      onResolvedRowRef.current(null);
      onErrorRef.current(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const resolve = columns.length > 0
        ? resolveDataSourceRow(dataSourceType, lookupColumn, trimmed, columns)
        : resolveDataSourceOption(dataSourceType, lookupColumn, trimmed).then(() => ({}));
      resolve
        .then((row) => {
          onResolvedRowRef.current(row);
          onErrorRef.current(null);
        })
        .catch(() => {
          onResolvedRowRef.current(null);
          onErrorRef.current(t("stations.runtime.invalidCode", { field: fieldName, code: trimmed }));
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [interactive, dataSourceType, lookupColumn, columns.join(","), code, fieldName, t]);

  // Al desmontar (widget borrado o pantalla cambiada), limpia su error activo si tenia uno.
  React.useEffect(() => () => onErrorRef.current(null), []);

  return null;
}

/**
 * Se suscribe (mientras el componente vive) al dato en bruto que el Player
 * entrega para un dispositivo o evento. No renderiza nada: solo reenvia cada
 * valor recibido a `onRaw`. Vive como componente propio (no un useEffect
 * suelto) para poder darle de baja la suscripcion limpiamente cuando cambia
 * el origen o se desmonta quien lo usa. Exportado: StationRuntimePage lo
 * reutiliza para el origen automatico de las ranuras de material, que vive
 * en la ranura (no en un widget) -- ver conversacion 2026-07-30.
 */
export function BridgeWatcher({
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
  fieldName,
  onResolved,
  onError,
}: {
  dataSourceType: string;
  lookupColumn: string;
  disabled: boolean;
  /** Identificador del widget (bindingKey) para nombrar el error en la zona fija comun. */
  fieldName: string;
  onResolved: (option: DataSourceOption) => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [code, setCode] = React.useState("");
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Al desmontar (widget borrado o pantalla cambiada), limpia su error activo si tenia uno.
  React.useEffect(() => () => onErrorRef.current(null), []);

  async function resolve() {
    const trimmed = code.trim();
    if (!trimmed || disabled) return;
    try {
      const data = await resolveDataSourceOption(dataSourceType, lookupColumn, trimmed);
      onResolved(data);
      setCode("");
      onError(null);
    } catch {
      onError(t("stations.runtime.scanNotFound", { field: fieldName, code: trimmed }));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <IconScan className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        className="h-7 text-xs"
        placeholder={t("stations.runtime.scanPlaceholder")}
        value={code}
        disabled={disabled}
        onChange={(e) => {
          setCode(e.target.value);
          onError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void resolve();
          }
        }}
      />
    </div>
  );
}

function WidgetImage({ widget }: { widget: Widget }) {
  const url = useStationAssetUrl(widget.config.assetId as number | undefined);
  const { t } = useTranslation("dashboard");
  const style = partStyle(widget, "image");
  if (!url) {
    return (
      <div className="flex size-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
        {t("stations.types.IMAGE")}
      </div>
    );
  }
  return (
    // Fondo aplicado al contenedor, no a la imagen: se ve como "letterboxing"
    // cuando el ajuste es CONTAIN y la imagen no llena la caja entera.
    <div className="size-full rounded" style={backgroundStyle(style)}>
      <img
        src={url}
        alt={widget.label}
        className="size-full"
        style={{ objectFit: (widget.config.fit as string) === "COVER" ? "cover" : "contain" }}
      />
    </div>
  );
}

/** Odoo many2one llega como [id, "etiqueta"]; mostramos la etiqueta. Exportado para que StationRuntimePage pueda componer el mismo texto al construir las opciones de un DROPDOWN con "Mostrar como". */
export function cellText(value: unknown): string {
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
  const headerStyle = partStyle(widget, "header");
  const cellStyle = partStyle(widget, "cell");

  React.useEffect(() => {
    if (!type || type === "STATIC_LIST") return;
    const maxRows = Number(widget.config.maxRows) || 50;
    setError(false);
    fetchDataSourceTable(type, maxRows)
      .then(setTable)
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
      {/* La cabecera es opcional (a diferencia de las filas de datos, siempre
          obligatorias): oculta no se renderiza nada, ni en el diseño. */}
      {!headerStyle.hidden && (
        <TableHeader>
          <TableRow>
            {selectable && <TableHead className="w-8" />}
            {table.columns.map((c) => (
              <TableHead key={c.key} className={textClasses(headerStyle)} style={{ ...textColorStyle(headerStyle), ...backgroundStyle(headerStyle) }}>
                {t(c.labelKey, { defaultValue: c.key })}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
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
                  <TableCell key={c.key} className={textClasses(cellStyle)} style={{ ...textColorStyle(cellStyle), ...backgroundStyle(cellStyle) }}>
                    {cellText(row[c.key])}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
