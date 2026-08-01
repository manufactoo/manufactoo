import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import type { Device } from "@/features/devices/types";
import type { MqttEvent } from "@/features/events/types";
import { useStationsCatalogStore } from "./stations-catalog-store";
import { useStationAssetUrl } from "./useStationAssetUrl";
import { BOUND_FIELD_VALUE, CONTROL_HEIGHT_PX, OPTIONAL_STYLE_PARTS, TEXT_LINE_HEIGHT_PX, WIDGET_STYLE_PARTS, WidgetView } from "./WidgetView";
import { clamp, columnStep, GRID_GAP, gridContainerStyle, nextFreeRow, PART_GAP, ROW_HEIGHT, rowStep, toFineRows } from "./gridGeometry";

function eventLabel(events: MqttEvent[], eventId: number | null): string | null {
  const e = events.find((ev) => ev.id === eventId);
  return e ? `${e.name} · ${e.topic}` : null;
}
import {
  GRID_COLUMNS,
  type Screen,
  type Station,
  type StaticOption,
  type Widget,
  type WidgetDescriptor,
  type WidgetLayout,
  type WidgetStyle,
} from "./types";

type EditableWidget = Widget & { _uid: string };
type EditableScreen = { _uid: string; id?: number; title: string; orderIndex: number; widgets: EditableWidget[] };

/** Widget de CUALQUIER pantalla de la estacion al que una Etiqueta se puede vincular para enseñar uno de sus datos. */
interface BindableWidget {
  bindingKey: string;
  label: string;
  widgetType: string;
  dataSourceType?: string;
  selectionMode?: string;
}

let uidSeq = 0;
function uid(): string {
  uidSeq += 1;
  return `w${Date.now()}_${uidSeq}`;
}

function screenFrom(s: Screen): EditableScreen {
  return { _uid: uid(), id: s.id, title: s.title, orderIndex: s.orderIndex, widgets: s.widgets.map((w) => ({ ...w, _uid: uid() })) };
}

/**
 * "Clave de datos" (bindingKey) hace ahora doble trabajo: sigue siendo la
 * clave con la que se guarda el valor en trazabilidad, y ADEMAS es el
 * identificador que aparece en los mensajes de error del backend y en la
 * lista "Vincular a" de una Etiqueta -- ya no hace falta un campo "Etiqueta"
 * aparte para eso (ver conversacion 2026-07-28). Los nombres de tipo son
 * fijos en ingles (no el nombre traducido del tipo) para que la clave sea
 * estable aunque el usuario cambie el idioma de la interfaz.
 */
const BINDING_KEY_SLUGS: Record<string, string> = {
  DROPDOWN: "dropdown",
  TEXT_INPUT: "text",
  NUMBER_INPUT: "number",
  TABLE: "table",
};

/**
 * Siguiente numero libre para ese tipo, mirando TODAS las pantallas de la
 * estacion (no solo la actual -- antes el contador se reiniciaba por
 * pantalla y podia repetir clave entre pantallas distintas, pisando un valor
 * con otro al guardar).
 */
function nextBindingKey(screens: EditableScreen[], widgetType: string): string {
  const slug = BINDING_KEY_SLUGS[widgetType] ?? widgetType.toLowerCase();
  const pattern = new RegExp(`^${slug}_(\\d+)$`);
  let max = 0;
  for (const s of screens) {
    for (const w of s.widgets) {
      const m = w.bindingKey?.match(pattern);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${slug}_${max + 1}`;
}

// Alto aproximado (px) del aviso de codigo no valido (TEXT_INPUT validado):
// siempre el mismo texto pequeño fijo, no tiene su propio tamano de fuente
// configurable.
const INVALID_CODE_LINE_PX = 20;

/**
 * Alto EXACTO (unidad logica, puede salir decimal) que necesita una parte con
 * texto propio para el tamano de fuente elegido -- a peticion del usuario
 * ("no es mejor que el tamaño sea pixel a pixel? nunca queda perfecto"), ya no
 * se redondea al multiplo de 32 mas cercano hacia arriba: PART_GAP (el hueco
 * visual que cada widget reserva arriba+abajo, ver gridGeometry.ts) se suma
 * al pixelaje que pide el contenido y el resultado se convierte directamente
 * a unidades logicas, sin perder ni sobrar nada -- el grid, con filas finas
 * de FINE_PX, puede expresar ese decimal exacto. Agranda con tamanos grandes
 * y ENCOGE con tamanos pequenos (el usuario puede volver a agrandarlo a mano
 * despues si quiere mas aire; este calculo solo se dispara al cambiar el
 * tamano de fuente, no en cada render). `null` para partes sin texto propio
 * (TABLE cabecera/celdas, IMAGE), que no se tocan.
 */
function heightForFontSize(widgetType: string, part: string, fontSize: string, hasLookup: boolean): number | null {
  const size = (fontSize as keyof typeof CONTROL_HEIGHT_PX) || "MD";
  let neededPx: number;
  if (widgetType === "LABEL" && part === "text") {
    neededPx = TEXT_LINE_HEIGHT_PX[size] ?? TEXT_LINE_HEIGHT_PX.MD;
  } else if (
    ((widgetType === "DROPDOWN" || widgetType === "TEXT_INPUT" || widgetType === "NUMBER_INPUT") && part === "value") ||
    (widgetType === "BUTTON" && part === "text")
  ) {
    neededPx = CONTROL_HEIGHT_PX[size] ?? CONTROL_HEIGHT_PX.MD;
    if (widgetType === "TEXT_INPUT" && hasLookup) neededPx += INVALID_CODE_LINE_PX;
  } else {
    return null;
  }
  return (neededPx + GRID_GAP) / ROW_HEIGHT;
}

/** Tamano de partida al soltar un widget nuevo desde la paleta: el que le pediria heightForFontSize a tamano de fuente "Normal", o un equivalente fijo para TABLE/IMAGE (sin texto propio que medir). */
function defaultSize(type: string): { w: number; h: number } {
  switch (type) {
    case "TABLE":
      return { w: 12, h: 10 };
    case "IMAGE":
      return { w: 6, h: 10 };
    case "LABEL":
      return { w: 12, h: heightForFontSize("LABEL", "text", "MD", false) ?? 1 };
    case "BUTTON":
      return { w: 3, h: heightForFontSize("BUTTON", "text", "MD", false) ?? 1.5 };
    case "STATION_MATERIALS":
      // Sin formula de heightForFontSize (no tiene tamano de fuente propio,
      // ver WIDGET_STYLE_PARTS): pinta una lista de lotes activos, necesita
      // mas sitio que un control de una sola linea.
      return { w: 6, h: 4 };
    case "PANEL":
      // Area de partida generosa: se coloca primero y se agranda/mueve a
      // mano hasta cubrir los widgets que va a agrupar visualmente.
      return { w: 6, h: 8 };
    default:
      return { w: 6, h: heightForFontSize("DROPDOWN", "value", "MD", false) ?? 1.5 };
  }
}

interface DragState {
  type: string;
  clientX: number;
  clientY: number;
  cell: { x: number; y: number } | null;
}

export function StationBuilderPage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const catalog = useStationsCatalogStore((s) => s.catalog);
  const fetchCatalog = useStationsCatalogStore((s) => s.fetch);

  const [station, setStation] = React.useState<Station | null>(null);
  const [screens, setScreens] = React.useState<EditableScreen[]>([]);
  const [current, setCurrent] = React.useState(0);
  const [selectedUid, setSelectedUid] = React.useState<string | null>(null);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [events, setEvents] = React.useState<MqttEvent[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragState, setDragState] = React.useState<DragState | null>(null);

  const gridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    void fetchCatalog();
    apiClient.get<Device[]>("/api/devices").then(({ data }) => setDevices(data)).catch(() => setDevices([]));
    apiClient.get<MqttEvent[]>("/api/events").then(({ data }) => setEvents(data)).catch(() => setEvents([]));
  }, [fetchCatalog]);

  React.useEffect(() => {
    apiClient.get<Station>(`/api/stations/${id}`).then(({ data }) => {
      setStation(data);
      const list = data.screens.length > 0 ? data.screens.map(screenFrom) : [{ _uid: uid(), title: "", orderIndex: 0, widgets: [] }];
      setScreens(list);
      setCurrent(0);
    });
  }, [id]);

  const screen = screens[current];
  const widgets = screen?.widgets ?? [];
  const selected = widgets.find((w) => w._uid === selectedUid) ?? null;
  const inputDevices = devices.filter((d) => d.direction === "INPUT" || d.direction === "BIDIRECTIONAL");

  // Delete/Backspace borra el widget seleccionado, salvo que el foco este en
  // un campo de texto (Properties, titulo de pantalla...) -- si no, borrar un
  // caracter mientras se edita el "Texto" de una Etiqueta borraria el widget
  // entero por accidente.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedUid) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      e.preventDefault();
      removeWidget(selectedUid);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedUid]);

  const descriptorFor = React.useCallback(
    (type: string): WidgetDescriptor | undefined => catalog?.widgets.find((w) => w.type === type),
    [catalog],
  );

  // Widgets de TODA la estacion (no solo la pantalla actual, una Etiqueta
  // puede vincularse a un widget de otra pantalla) que capturan un dato: el
  // mismo criterio que "needsBinding" en PropertiesPanel, aqui aplicado a
  // cada widget de cada pantalla para ofrecerlos como posible origen.
  const bindableWidgets = React.useMemo<BindableWidget[]>(() => {
    const result: BindableWidget[] = [];
    for (const s of screens) {
      for (const w of s.widgets) {
        if (!w.bindingKey) continue;
        const d = descriptorFor(w.widgetType);
        const selectable = w.widgetType === "TABLE" && ((w.config.selectionMode as string) ?? "NONE") !== "NONE";
        if (!d?.requiresBinding && !selectable) continue;
        result.push({
          bindingKey: w.bindingKey,
          label: w.label,
          widgetType: w.widgetType,
          dataSourceType: w.dataSource?.type,
          selectionMode: w.config.selectionMode as string | undefined,
        });
      }
    }
    return result;
  }, [screens, descriptorFor]);

  function patchScreen(index: number, patch: Partial<EditableScreen>) {
    setScreens((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function setWidgets(updater: (prev: EditableWidget[]) => EditableWidget[]) {
    setScreens((prev) => prev.map((s, i) => (i === current ? { ...s, widgets: updater(s.widgets) } : s)));
  }

  function addScreen() {
    setScreens((prev) => [...prev, { _uid: uid(), title: "", orderIndex: prev.length, widgets: [] }]);
    setCurrent(screens.length);
    setSelectedUid(null);
  }

  function deleteScreen(index: number) {
    if (screens.length <= 1) return;
    setScreens((prev) => prev.filter((_, i) => i !== index));
    setCurrent((c) => Math.max(0, c >= index ? c - 1 : c));
    setSelectedUid(null);
  }

  function moveScreen(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= screens.length) return;
    setScreens((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setCurrent(target);
  }

  function addWidget(descriptor: WidgetDescriptor, at?: { x: number; y: number }) {
    const size = defaultSize(descriptor.type);
    const pos = at ?? { x: 0, y: nextFreeRow(widgets.map((w) => w.layout)) };
    // "Etiqueta" ya no es un campo aparte: para widgets de datos, la propia
    // clave de datos (bindingKey) hace de identificador (ver nextBindingKey);
    // para el resto (Etiqueta de texto, Boton, Imagen, Tabla sin seleccion)
    // no hace falta ninguno -- no aparecen en ningun mensaje de error ni en
    // "Vincular a".
    const bindingKey = descriptor.requiresBinding ? nextBindingKey(screens, descriptor.type) : null;
    let config: Record<string, unknown> = {};
    if (descriptor.type === "BUTTON") config = { action: "NEXT", text: t("stations.types.BUTTON") };
    else if (descriptor.type === "LABEL") config = { text: t("stations.types.LABEL") };
    else if (descriptor.type === "TEXT_INPUT") config = { placeholder: t("stations.types.TEXT_INPUT") };
    const newWidget: EditableWidget = {
      _uid: uid(),
      widgetType: descriptor.type,
      label: bindingKey ?? "",
      bindingKey,
      required: false,
      sourceDeviceId: null,
      sourceEventId: null,
      config,
      dataSource: descriptor.supportsDataSource ? { type: "" } : {},
      layout: { x: pos.x, y: pos.y, w: size.w, h: size.h },
      orderIndex: widgets.length,
    };
    setWidgets((prev) => [...prev, newWidget]);
    setSelectedUid(newWidget._uid);
  }

  /** Celda de grid bajo el puntero (o null si esta fuera del canvas), snapeada a la rejilla. */
  function cellUnderPointer(clientX: number, clientY: number, type: string): { x: number; y: number } | null {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }
    const size = defaultSize(type);
    const stepX = columnStep(rect.width);
    const col = Math.round((clientX - rect.left) / stepX - size.w / 2);
    const row = Math.round((clientY - rect.top) / rowStep - size.h / 2);
    return { x: clamp(col, 0, GRID_COLUMNS - size.w), y: Math.max(0, row) };
  }

  /**
   * Arrastre desde la paleta con Pointer Events (mismo enfoque que mover/redimensionar
   * un widget ya colocado, sin depender de HTML5 Drag and Drop ni de dnd-kit). Un
   * simple clic (sin apenas movimiento) sigue anadiendo el widget en la siguiente
   * fila libre; superar el umbral de arrastre activa el fantasma y coloca el widget
   * exactamente donde se suelte dentro del canvas.
   */
  function startPaletteDrag(descriptor: WidgetDescriptor, e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function onMove(ev: PointerEvent) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) {
        dragging = true;
      }
      if (dragging) {
        setDragState({ type: descriptor.type, clientX: ev.clientX, clientY: ev.clientY, cell: cellUnderPointer(ev.clientX, ev.clientY, descriptor.type) });
      }
    }

    function onUp(ev: PointerEvent) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // no-op: nunca se llego a capturar (ver comentario en el catch de abajo)
      }
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      if (dragging) {
        const cell = cellUnderPointer(ev.clientX, ev.clientY, descriptor.type);
        if (cell) addWidget(descriptor, cell);
        setDragState(null);
      } else {
        addWidget(descriptor);
      }
    }

    try {
      // La captura permite seguir recibiendo pointermove/up aunque el cursor salga
      // del boton (p. ej. al arrastrar sobre el canvas). Si el navegador la
      // rechaza (id de puntero no reconocido), degradamos con gracia: seguimos
      // enganchando los listeners igualmente en vez de abortar el arrastre entero.
      target.setPointerCapture(e.pointerId);
    } catch {
      // continua sin captura
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  function updateWidget(uidKey: string, patch: Partial<EditableWidget>) {
    setWidgets((prev) => prev.map((w) => (w._uid === uidKey ? { ...w, ...patch } : w)));
  }

  function updateLayout(uidKey: string, layout: WidgetLayout) {
    setWidgets((prev) => prev.map((w) => (w._uid === uidKey ? { ...w, layout } : w)));
  }

  function removeWidget(uidKey: string) {
    setWidgets((prev) => prev.filter((w) => w._uid !== uidKey));
    if (selectedUid === uidKey) setSelectedUid(null);
  }

  async function save() {
    if (!station) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: station.name,
        description: station.description,
        enabled: station.enabled,
        positions: station.positions,
        screens: screens.map((s, si) => ({
          id: s.id ?? null,
          title: s.title,
          orderIndex: si,
          widgets: s.widgets.map((w, wi) => ({
            id: w.id ?? null,
            widgetType: w.widgetType,
            label: w.label,
            bindingKey: w.bindingKey,
            required: w.required,
            sourceDeviceId: w.sourceDeviceId,
            sourceEventId: w.sourceEventId,
            config: w.config,
            dataSource: w.dataSource,
            layout: w.layout,
            orderIndex: wi,
          })),
        })),
      };
      const { data } = await apiClient.put<Station>(`/api/stations/${id}`, payload);
      setStation(data);
      setScreens(data.screens.map(screenFrom));
      setCurrent((c) => Math.min(c, Math.max(0, data.screens.length - 1)));
      setSelectedUid(null);
      setFlash(t("stations.builder.saved"));
      window.setTimeout(() => setFlash(null), 2500);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("stations.builder.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!station || !screen) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
            <IconArrowLeft className="mr-1 size-4" />
            {t("stations.builder.back")}
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{station.name}</h1>
            <p className="text-xs text-muted-foreground">{t("stations.builder.title")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {flash && <span className="text-sm text-emerald-600">{flash}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/stations/${id}/run`)}>
            {t("stations.builder.preview")}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {t("stations.builder.save")}
          </Button>
        </div>
      </div>

      {/* Barra de pantallas (secuencia) */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {screens.map((s, i) => (
          <button
            key={s._uid}
            onClick={() => {
              setCurrent(i);
              setSelectedUid(null);
            }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm ${
              i === current ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground"
            }`}
          >
            <span>{s.title || t("stations.builder.screenN", { n: i + 1 })}</span>
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={addScreen}>
          <IconPlus className="mr-1 size-4" />
          {t("stations.builder.addScreen")}
        </Button>
        {screens.length > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => moveScreen(current, -1)} disabled={current === 0}>
              <IconChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => moveScreen(current, 1)} disabled={current === screens.length - 1}>
              <IconChevronRight className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteScreen(current)}>
              <IconX className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Posiciones fisicas de la estacion (p. ej. "R1", "Feeder-A"): un dato
          de la estacion entera, independiente de las pantallas/widgets --
          cargar un material en una posicion ya ocupada sustituye lo anterior
          (ver MaterialsDialog y el origen automatico de STATION_MATERIALS mas
          abajo). Ver conversacion 2026-07-31. */}
      <PositionsEditor positions={station.positions} onChange={(positions) => setStation({ ...station, positions })} />

      <div className="grid flex-1 grid-cols-[180px_1fr_300px] gap-4 overflow-hidden">
        {/* Paleta de widgets */}
        <Card className="overflow-y-auto">
          <CardContent className="space-y-2 p-3">
            <div className="flex items-center gap-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{t("stations.builder.palette")}</p>
              <InfoTooltip text={t("stations.builder.paletteHint")} />
            </div>
            {catalog?.widgets.map((descriptor) => (
              <Button
                key={descriptor.type}
                variant="outline"
                className="w-full cursor-grab justify-start touch-none active:cursor-grabbing"
                size="sm"
                onPointerDown={(e) => startPaletteDrag(descriptor, e)}
              >
                + {t(`stations.types.${descriptor.type}`, { defaultValue: descriptor.type })}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="overflow-auto">
          <CardContent className="p-4">
            <div className="mb-3">
              <Input
                value={screen.title}
                placeholder={t("stations.builder.screenTitle")}
                onChange={(e) => patchScreen(current, { title: e.target.value })}
                className="max-w-sm"
              />
            </div>
            {widgets.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("stations.builder.emptyCanvas")}</p>
            )}
            <div
              ref={gridRef}
              className="relative rounded-md border border-dashed bg-muted/20"
              style={{ ...gridContainerStyle(), minHeight: 320 }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelectedUid(null);
              }}
            >
              {widgets.map((widget) => (
                <WidgetBox
                  key={widget._uid}
                  widget={widget}
                  selected={widget._uid === selectedUid}
                  gridRef={gridRef}
                  deviceName={devices.find((d) => d.id === widget.sourceDeviceId)?.name ?? null}
                  eventName={eventLabel(events, widget.sourceEventId)}
                  onSelect={setSelectedUid}
                  onLayoutChange={updateLayout}
                  stationId={id}
                />
              ))}
              {dragState?.cell &&
                (() => {
                  const size = defaultSize(dragState.type);
                  return (
                    <div
                      className="pointer-events-none rounded-md border-2 border-dashed border-primary bg-primary/10"
                      style={{
                        gridColumn: `${dragState.cell.x + 1} / span ${size.w}`,
                        gridRow: `${toFineRows(dragState.cell.y) + 1} / span ${toFineRows(size.h)}`,
                      }}
                    />
                  );
                })()}
            </div>
          </CardContent>
        </Card>

        {/* Chip flotante que sigue al puntero mientras se arrastra un widget desde la paleta */}
        {dragState && (
          <div
            className="pointer-events-none fixed z-50 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow-lg"
            style={{ left: dragState.clientX + 12, top: dragState.clientY + 12 }}
          >
            + {t(`stations.types.${dragState.type}`, { defaultValue: dragState.type })}
          </div>
        )}

        {/* Panel de propiedades */}
        <Card className="overflow-y-auto">
          <CardContent className="p-3">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("stations.builder.properties")}
              </p>
              {selected && (
                <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
                  {t(`stations.types.${selected.widgetType}`, { defaultValue: selected.widgetType })}
                </span>
              )}
            </div>
            {selected ? (
              <PropertiesPanel
                key={selected._uid}
                widget={selected}
                descriptor={descriptorFor(selected.widgetType)}
                dataSources={catalog?.dataSources ?? []}
                lookupColumns={catalog?.lookupColumns ?? {}}
                displayColumns={catalog?.displayColumns ?? {}}
                devices={inputDevices}
                events={events.filter((e) => e.direction === "SUBSCRIBE")}
                positions={station.positions}
                bindableWidgets={bindableWidgets.filter((b) => b.bindingKey !== selected.bindingKey)}
                suggestBindingKey={() => nextBindingKey(screens, selected.widgetType)}
                onChange={(patch) => updateWidget(selected._uid, patch)}
                onDelete={() => removeWidget(selected._uid)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("stations.builder.noSelection")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WidgetBox({
  widget,
  selected,
  gridRef,
  deviceName,
  eventName,
  onSelect,
  onLayoutChange,
  stationId,
}: {
  widget: EditableWidget;
  selected: boolean;
  gridRef: React.RefObject<HTMLDivElement | null>;
  deviceName: string | null;
  eventName: string | null;
  onSelect: (uid: string) => void;
  onLayoutChange: (uid: string, layout: WidgetLayout) => void;
  /** Filtro por rutas de ordenes de fabricacion en la previsualizacion del builder (undefined en estacion nueva sin guardar). */
  stationId?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<
    | null
    | { mode: "move" | "resize"; startX: number; startY: number; start: WidgetLayout; stepX: number }
  >(null);
  // Version siempre al dia de widget/onLayoutChange para que onMove/onUp
  // (estables, ver mas abajo) lean el dato mas reciente sin tener que
  // recrearse -- y por tanto sin tener que volver a engancharse -- en cada
  // render (el layout cambia EN CADA pointermove mientras se arrastra).
  const widgetRef = React.useRef(widget);
  widgetRef.current = widget;
  const onLayoutChangeRef = React.useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  // Escuchar en `document` (no solo en la propia caja/handle) para que el
  // arrastre no se rompa si el cursor se sale del elemento durante el gesto:
  // con el handle de redimensionar (solo 12x12px) es facil superarlo mientras
  // se mueve el raton deprisa. setPointerCapture por si solo no basta -- si el
  // navegador la deniega, o el cursor sale del elemento antes de que surta
  // efecto, pointerup deja de llegar a la caja y el arrastre se queda
  // "atascado" (el siguiente intento de redimensionar ya no funciona, porque
  // el anterior nunca llego a soltarse). onMove/onUp son estables (useCallback
  // sin dependencias, leen todo por refs) para poder anadirlos/quitarlos con
  // la MISMA referencia siempre, sin depender de que ningun render coincida.
  const onMove = React.useCallback((e: PointerEvent) => {
    const s = drag.current;
    if (!s) return;
    // Columna: sigue en pasos enteros (son "carriles" de una rejilla de 12,
    // no una coordenada libre -- ancho de cada uno depende del contenedor).
    const dCol = Math.round((e.clientX - s.startX) / s.stepX);
    // Fila: nada de saltos de unidad logica entera (32px), pero tampoco cada
    // pixel de raton tal cual -- eso deja numeros feos como "2.71875". El
    // RESULTADO final (no el delta -- si se redondeara solo el delta, un
    // punto de partida ya no-redondo seguiria dando decimales largos) se
    // redondea a 0.1 (3.2px): mucho mas fino que antes y se ve limpio en
    // "Alto"/"Fila Y". El ajuste automatico por tamano de fuente
    // (heightForFontSize) no pasa por aqui y se queda exacto, sin redondear.
    const dRow = (e.clientY - s.startY) / rowStep;
    const round1 = (n: number) => Math.round(n * 10) / 10;
    if (s.mode === "move") {
      onLayoutChangeRef.current(widgetRef.current._uid, {
        x: clamp(s.start.x + dCol, 0, GRID_COLUMNS - s.start.w),
        y: Math.max(0, round1(s.start.y + dRow)),
        w: s.start.w,
        h: s.start.h,
      });
    } else {
      onLayoutChangeRef.current(widgetRef.current._uid, {
        x: s.start.x,
        y: s.start.y,
        w: clamp(s.start.w + dCol, 1, GRID_COLUMNS - s.start.x),
        h: Math.max(0.25, round1(s.start.h + dRow)),
      });
    }
  }, []);

  const onUp = React.useCallback(() => {
    drag.current = null;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [onMove]);

  // Por si el widget se borra (o el componente se desmonta por cualquier
  // motivo) a mitad de un arrastre: sin esto, los listeners de document
  // quedarian enganchados para siempre.
  React.useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [onMove, onUp]);

  function begin(mode: "move" | "resize", e: React.PointerEvent) {
    if (e.button !== 0) return;
    // Sin esto, en cuanto el cursor sale del elemento durante el gesto (facil
    // con el handle de 12x12px) el navegador interpreta el arrastre como una
    // seleccion de texto / arrastre nativo de contenido, y enseña el icono de
    // "prohibido" porque nada declara ser una zona valida donde soltarlo.
    e.preventDefault();
    e.stopPropagation();
    onSelect(widget._uid);
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...widget.layout }, stepX: columnStep(width) };
    try {
      boxRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // no-op: el arrastre sigue funcionando igual via los listeners de document
    }
    // Fuerza el cursor correcto en TODA la pagina mientras dura el arrastre:
    // una vez el cursor sale del propio widget, sin esto se veria el cursor
    // que le toque al elemento que haya debajo (texto, botones...), no el de
    // mover/redimensionar.
    document.body.style.cursor = mode === "move" ? "move" : "nwse-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  const { x, y, w, h } = widget.layout;

  return (
    <div
      className="relative"
      style={{
        gridColumn: `${x + 1} / span ${w}`,
        gridRow: `${toFineRows(y) + 1} / span ${toFineRows(h)}`,
        // PANEL es puramente decorativo: se queda siempre detras del resto,
        // se haya añadido antes o despues, para no tapar ni robar el clic a
        // los widgets colocados encima (ver conversacion 2026-08-01).
        zIndex: widget.widgetType === "PANEL" ? 0 : 1,
      }}
    >
      <div
        ref={boxRef}
        onPointerDown={(e) => {
          // Toda la caja arrastra (mueve), salvo el handle de redimensionar
          // (data-resize/data-no-drag).
          if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
          begin("move", e);
        }}
        // Marco de seleccion con outline (NO afecta al layout, a diferencia de un
        // border). El contenido ocupa exactamente la celda, igual que en el runtime.
        className={`group absolute inset-0 cursor-move rounded-sm ${selected ? "outline outline-2 outline-primary" : "outline-dashed outline-1 outline-border"}`}
        style={{ overflowX: "visible", overflowY: "hidden" }}
      >
        {/* Contenido identico al operador (pointer-events-none: el clic
            selecciona el widget, nunca interactua con el control). flex+justify-
            center: si varios widgets de distinto tipo comparten fila, su texto
            queda a la misma altura visual en vez de pegado cada uno al borde
            superior de su propia celda. Relleno vertical PART_GAP (arriba y
            abajo): es el hueco visual entre widgets (ver gridGeometry.ts --
            el grid en si ya no tiene gap vertical, cada widget lo reserva por
            su cuenta para que el ajuste de alto por tamano de fuente pueda ser
            exacto). Relleno horizontal de 4px para los widgets reales: deja
            aire entre su borde y el borde de un PANEL colocado detras, de modo
            que los widgets "dentro" del panel no lo toquen. PANEL conserva 0px
            para que su borde llegue justo al limite de su celda.
            El 1px original evitaba que el borde izq/der del input/select se
            recortara por el redondeo de subpixel del grid (mismo ajuste en runtime). */}
        <div
          className="no-scrollbar pointer-events-none absolute inset-0 flex flex-col justify-center overflow-x-visible overflow-y-auto"
          style={{
            // PANEL sin relleno horizontal para que su borde quede en el limite de su celda.
            paddingLeft: widget.widgetType === "PANEL" ? 0 : 4,
            paddingRight: widget.widgetType === "PANEL" ? 0 : 4,
            paddingTop: PART_GAP,
            paddingBottom: PART_GAP,
          }}
        >
          <WidgetView widget={widget} interactive={false} deviceName={deviceName} eventName={eventName} stationId={stationId} />
        </div>

        <div
          data-resize
          data-no-drag
          onPointerDown={(e) => begin("resize", e)}
          className={`absolute bottom-0 right-0 size-3 cursor-se-resize rounded-tl bg-primary/70 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>
    </div>
  );
}

const FONT_SIZE_STEPS: NonNullable<WidgetStyle["fontSize"]>[] = ["SM", "MD", "LG", "XL", "XXL"];
const ALIGN_STEPS: NonNullable<WidgetStyle["align"]>[] = ["LEFT", "CENTER", "RIGHT"];

/**
 * Estilo (tamano, negrita, alineacion, colores) de una "parte" de un widget,
 * como un campo mas del panel de Propiedades -- ya no hace falta una barra
 * flotante de edicion aparte: desde que cada widget se redujo a su expresion
 * minima, casi todos tienen una unica parte (excepto TABLE, con cabecera y
 * celdas), asi que un formulario normal es mas simple y no interfiere con
 * arrastrar/redimensionar el widget en el lienzo.
 */
function StyleFields({
  widget,
  part,
  label,
  onChange,
}: {
  widget: EditableWidget;
  part: string;
  label?: string;
  onChange: (patch: Partial<EditableWidget>) => void;
}) {
  const { t } = useTranslation("dashboard");
  const allStyles = (widget.config.styles as Record<string, WidgetStyle> | undefined) ?? {};
  const style: WidgetStyle = allStyles[part] ?? {};
  // Solo lo accesorio (p. ej. la cabecera de una tabla) se puede ocultar del
  // todo; el contenido principal del widget es siempre obligatorio.
  const isOptional = (OPTIONAL_STYLE_PARTS[widget.widgetType] ?? []).includes(part);
  // Una imagen o un panel decorativo no tienen texto que estilizar
  // (tamano/negrita/alineacion no aplican), solo un color de fondo.
  const isImagePart = part === "image" || part === "panel";
  const hasLookup = widget.dataSource.type !== "" && widget.dataSource.type !== "STATIC_LIST" && Boolean(widget.config.lookupColumn);

  function setStyle(patch: Partial<WidgetStyle>) {
    // Al cambiar el tamano de fuente, el alto SIGUE al tamano (crece o
    // encoge) en vez de ser solo un minimo que nunca baja -- si luego quieres
    // mas aire, se vuelve a agrandar a mano en "Alto". No aplica a partes sin
    // texto propio (cabecera/celdas de TABLE, imagen), esas mantienen el alto
    // que ya tuvieran.
    const targetH = patch.fontSize !== undefined ? heightForFontSize(widget.widgetType, part, patch.fontSize, hasLookup) : null;
    onChange({
      config: { ...widget.config, styles: { ...allStyles, [part]: { ...style, ...patch } } },
      layout: targetH !== null ? { ...widget.layout, h: targetH } : widget.layout,
    });
  }

  const fieldId = `${widget._uid}-${part}`;

  return (
    <div className="space-y-2 rounded-md border p-2">
      {label && <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>}
      {isOptional && (
        <div className="flex items-center gap-2">
          <Checkbox id={`show-${fieldId}`} checked={!style.hidden} onCheckedChange={(v) => setStyle({ hidden: v !== true })} />
          <Label htmlFor={`show-${fieldId}`} className="text-xs font-normal">
            {t("stations.style.show")}
          </Label>
        </div>
      )}
      {!isImagePart && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("stations.style.fontSize")}</Label>
              <Select value={style.fontSize ?? "MD"} onValueChange={(v) => setStyle({ fontSize: v as WidgetStyle["fontSize"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_STEPS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`stations.style.sizes.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("stations.style.align")}</Label>
              <Select value={style.align ?? "LEFT"} onValueChange={(v) => setStyle({ align: v as WidgetStyle["align"] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALIGN_STEPS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`stations.style.aligns.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`bold-${fieldId}`} checked={style.bold ?? false} onCheckedChange={(v) => setStyle({ bold: v === true })} />
            <Label htmlFor={`bold-${fieldId}`} className="text-xs font-normal">
              {t("stations.style.bold")}
            </Label>
          </div>
        </>
      )}
      <div className={isImagePart ? "" : "grid grid-cols-2 gap-2"}>
        {!isImagePart && (
          <ColorField label={t("stations.style.textColor")} value={style.textColor} onChange={(v) => setStyle({ textColor: v })} />
        )}
        <ColorField label={t("stations.style.backgroundColor")} value={style.backgroundColor} onChange={(v) => setStyle({ backgroundColor: v })} />
      </div>
    </div>
  );
}

/** Campo de color para un formulario normal: cuadro nativo + boton para quitarlo (volver al color por defecto). */
function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string | undefined) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border border-input"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onChange(undefined)}>
            <IconX className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function parseStaticOptions(text: string): StaticOption[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split("|");
      return label !== undefined ? { value: value.trim(), label: label.trim() } : { value: value.trim(), label: value.trim() };
    })
    .filter((o) => o.value);
}

function stringifyStaticOptions(options: StaticOption[] = []): string {
  return options.map((o) => (o.value === o.label ? o.label : `${o.value}|${o.label}`)).join("\n");
}

/**
 * Misma columna tecnica, distinto significado segun el origen: "barcode" en
 * Operarios (Odoo) es el Badge ID de fichaje (codigo de empleado), no un
 * codigo de barras de producto. stations.lookupColumns.* da una traduccion
 * generica por columna; aqui se afina para los casos donde esa traduccion
 * generica no describe bien el dato en ese origen concreto.
 */
export function lookupColumnLabel(dsType: string, col: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (dsType === "ODOO_OPERATORS" && col === "barcode") {
    return t("masterData.columns.employeeCode");
  }
  return t(`stations.lookupColumns.${col}`, { defaultValue: col });
}

/**
 * Lista de posiciones fisicas de la estacion (p. ej. "R1", "Feeder-A"):
 * chips con boton de quitar + campo para añadir una nueva. Un dato de la
 * estacion entera, no de ninguna pantalla/widget concreto -- por eso vive
 * fuera del grid de 3 columnas, junto a la barra de pantallas.
 */
function PositionsEditor({ positions, onChange }: { positions: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation("dashboard");
  const [draft, setDraft] = React.useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || positions.includes(trimmed)) return;
    onChange([...positions, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
      <div className="flex items-center gap-1">
        <Label className="text-xs font-medium">{t("stations.builder.positions")}</Label>
        <InfoTooltip text={t("stations.builder.positionsHint")} />
      </div>
      {positions.map((p) => (
        <span key={p} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
          {p}
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(positions.filter((x) => x !== p))}
            aria-label={t("stations.builder.removePosition", { name: p })}
          >
            <IconX className="size-3" />
          </button>
        </span>
      ))}
      <div className="flex items-center gap-1">
        <Input
          className="h-7 w-32 text-xs"
          value={draft}
          placeholder={t("stations.builder.positionPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="size-7" onClick={add}>
          <IconPlus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Icono "i" con una explicacion en un tooltip, en vez de un parrafo de texto
 * siempre visible (el panel se llenaba de descripciones largas incluso cuando
 * el diseñador ya sabia lo que hacia cada campo).
 */
function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={text}>
          <IconInfoCircle className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Etiqueta de un campo del panel de propiedades + InfoTooltip opcional. */
function FieldLabel({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs">{text}</Label>
      {hint && <InfoTooltip text={hint} />}
    </div>
  );
}

type SourceKind = "NONE" | "DEVICE" | "EVENT";

function PropertiesPanel({
  widget,
  descriptor,
  dataSources,
  lookupColumns,
  displayColumns,
  devices,
  events,
  positions,
  bindableWidgets,
  suggestBindingKey,
  onChange,
  onDelete,
}: {
  widget: EditableWidget;
  descriptor: WidgetDescriptor | undefined;
  dataSources: string[];
  lookupColumns: Record<string, string[]>;
  displayColumns: Record<string, string[]>;
  devices: Device[];
  events: MqttEvent[];
  positions: string[];
  bindableWidgets: BindableWidget[];
  suggestBindingKey: () => string;
  onChange: (patch: Partial<EditableWidget>) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const dsType = widget.dataSource.type ?? "";
  const assetUrl = useStationAssetUrl(widget.config.assetId as number | undefined);
  const [uploading, setUploading] = React.useState(false);
  const selectionMode = (widget.config.selectionMode as string) ?? "NONE";
  const selectableTable = widget.widgetType === "TABLE" && selectionMode !== "NONE";
  const needsBinding = Boolean(descriptor?.requiresBinding) || selectableTable;

  // sourceKindOverride permite mostrar el sub-selector (dispositivo/evento) en
  // cuanto se elige el tipo de origen, aunque todavia no se haya escogido un
  // dispositivo/evento concreto (sourceDeviceId/sourceEventId siguen a null).
  // Se resetea solo al cambiar de widget (la key={widget._uid} del padre
  // remonta este componente), asi que no hace falta sincronizarlo a mano.
  const [sourceKindOverride, setSourceKindOverride] = React.useState<SourceKind | null>(null);
  const derivedSourceKind: SourceKind = widget.sourceDeviceId ? "DEVICE" : widget.sourceEventId ? "EVENT" : "NONE";
  const sourceKind = sourceKindOverride ?? derivedSourceKind;

  function setSourceKind(kind: SourceKind) {
    setSourceKindOverride(kind === "NONE" ? null : kind);
    onChange({ sourceDeviceId: null, sourceEventId: null });
  }

  const lookupOptions = dsType ? lookupColumns[dsType] ?? [] : [];
  // DROPDOWN solo ofrece "columna de coincidencia" si viene de un dispositivo/
  // evento (el escaneo resuelve el codigo en bruto). TEXT_INPUT es al reves:
  // el codigo SIEMPRE se teclea a mano (el origen dispositivo/evento es un
  // extra opcional), asi que no depende de sourceKind.
  const showLookup =
    dsType !== "" && dsType !== "STATIC_LIST" && lookupOptions.length > 0 &&
    (widget.widgetType === "DROPDOWN" ? sourceKind !== "NONE" : widget.widgetType === "TEXT_INPUT");

  // Una Etiqueta puede vincularse a cualquier otro widget que capture datos de
  // la estacion (el mismo criterio que "needsBinding" mas abajo, calculado
  // para TODOS los widgets de la estacion en StationBuilderPage): el codigo
  // tecleado en un TEXT_INPUT validado, la seleccion de un DROPDOWN, la fila
  // marcada de una TABLE... En cuanto se elige el widget origen, se elige que
  // dato suyo enseñar -- el valor crudo, o (si el origen tiene datos de Odoo)
  // una de sus columnas.
  const boundTo = widget.config.boundTo as string | undefined;
  const boundTarget = boundTo ? bindableWidgets.find((b) => b.bindingKey === boundTo) : undefined;
  const boundTargetIsMulti = boundTarget?.widgetType === "TABLE" && boundTarget.selectionMode === "MULTI";
  const boundFieldOptions =
    boundTarget?.dataSourceType && boundTarget.dataSourceType !== "STATIC_LIST" && !boundTargetIsMulti
      ? displayColumns[boundTarget.dataSourceType] ?? []
      : [];

  function setConfig(key: string, value: unknown) {
    onChange({ config: { ...widget.config, [key]: value } });
  }

  function setLayout(key: keyof WidgetLayout, value: number) {
    onChange({ layout: { ...widget.layout, [key]: value } });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<{ id: number }>("/api/stations/assets", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setConfig("assetId", data.id);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Imagen: subir fichero */}
      {widget.widgetType === "IMAGE" && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("stations.widget.image")}</Label>
          {assetUrl && <img src={assetUrl} alt="" className="max-h-28 rounded border object-contain" />}
          <Input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadImage(f);
            }}
          />
        </div>
      )}

      {needsBinding && (
        <div className="space-y-1.5">
          <FieldLabel text={t("stations.widget.bindingKey")} hint={t("stations.widget.bindingKeyHint")} />
          <Input
            value={widget.bindingKey ?? ""}
            onChange={(e) => onChange({ bindingKey: e.target.value, label: e.target.value })}
          />
        </div>
      )}

      {/* Origen de datos primero: de que dato maestro de Odoo viene el valor.
          Va antes que "Origen del valor"/"Columna de coincidencia" porque
          ambos dependen de este (que columnas se pueden elegir, que datos hay
          para mostrar de detalle). TABLE tambien lo usa (category DISPLAY,
          por eso es un bloque independiente, no anidado en el de abajo). */}
      {descriptor?.supportsDataSource && (
        <div className="space-y-1.5">
          <FieldLabel
            text={t("stations.widget.dataSource")}
            hint={widget.widgetType === "TEXT_INPUT" ? t("stations.widget.textInputDataSourceHint") : undefined}
          />
          {/* En TEXT_INPUT el origen es opcional (validacion de un codigo
              tecleado a mano, p. ej. operario): se ofrece un valor explicito
              para "ninguno" y volver a texto libre sin validar. */}
          <Select
            value={widget.widgetType === "TEXT_INPUT" && dsType === "" ? "NONE" : dsType}
            onValueChange={(value) =>
              onChange({
                dataSource:
                  value === "NONE"
                    ? {}
                    : value === "STATIC_LIST"
                      ? { type: value, staticOptions: widget.dataSource.staticOptions ?? [] }
                      : { type: value },
                // La columna de coincidencia y los datos de detalle son
                // especificos del origen anterior (p. ej. "display_name"
                // existe en productos pero no en operarios): si el origen
                // cambia, ya no son validos, asi que se limpian con el.
                config: { ...widget.config, lookupColumn: undefined, detailColumns: undefined },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("stations.widget.chooseDataSource")} />
            </SelectTrigger>
            <SelectContent>
              {widget.widgetType === "TEXT_INPUT" && (
                <SelectItem value="NONE">{t("stations.widget.noDataSource")}</SelectItem>
              )}
              {dataSources
                .filter((ds) => ds !== "STATIC_LIST" || (widget.widgetType !== "TABLE" && widget.widgetType !== "TEXT_INPUT"))
                .map((ds) => (
                  <SelectItem key={ds} value={ds}>
                    {t(`stations.dataSources.${ds}`, { defaultValue: ds })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {dsType === "STATIC_LIST" && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">{t("stations.widget.staticOptions")}</Label>
              <Textarea
                rows={4}
                value={stringifyStaticOptions(widget.dataSource.staticOptions)}
                onChange={(e) => onChange({ dataSource: { type: "STATIC_LIST", staticOptions: parseStaticOptions(e.target.value) } })}
              />
            </div>
          )}
        </div>
      )}

      {/* Que columna(s) de Odoo se ven en cada opcion del desplegable -- por
          defecto se usa display_name/name (resuelto en el backend), pero en
          algunos origenes interesa otro dato (p. ej. el puesto de un
          operario) o varios a la vez (nombre + puesto). El orden de los
          checkboxes es siempre el del catalogo, no el orden de clic, para
          que el resultado sea predecible. */}
      {widget.widgetType === "DROPDOWN" && dsType !== "" && dsType !== "STATIC_LIST" && (
        <div className="space-y-1.5">
          <FieldLabel text={t("stations.widget.labelColumns")} hint={t("stations.widget.labelColumnsHint")} />
          <div className="space-y-1">
            {(displayColumns[dsType] ?? []).map((col) => {
              const current = (widget.config.labelColumns as string[] | undefined) ?? [];
              const checked = current.includes(col);
              return (
                <div key={col} className="flex items-center gap-2">
                  <Checkbox
                    id={`labelcol-${col}`}
                    checked={checked}
                    onCheckedChange={(v) => {
                      const cols = displayColumns[dsType] ?? [];
                      const next = v === true ? cols.filter((c) => c === col || current.includes(c)) : current.filter((c) => c !== col);
                      setConfig("labelColumns", next.length > 0 ? next : undefined);
                    }}
                  />
                  <Label htmlFor={`labelcol-${col}`} className="text-xs font-normal">
                    {t(`masterData.columns.${col}`, { defaultValue: col })}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Solo tiene sentido para ordenes de fabricacion: limita la lista (o,
          en TEXT_INPUT, la validez de un codigo tecleado/escaneado) a ordenes
          cuyo producto tenga una ruta HABILITADA que incluya esta estacion
          (calculado en vivo, no un producto fijo grabado aqui). Disponible en
          los tres tipos que pueden elegir ODOO_MANUFACTURING_ORDERS como
          origen (DROPDOWN/TABLE/TEXT_INPUT -- NUMBER_INPUT no admite origen de
          datos en absoluto). Si ninguna ruta cubre la estacion, o alguna la
          cubre sin fijar producto, no filtra nada -- apagado por defecto, no
          cambia el comportamiento de estaciones existentes (ver conversacion
          2026-08-01). */}
      {(widget.widgetType === "DROPDOWN" || widget.widgetType === "TABLE" || widget.widgetType === "TEXT_INPUT") &&
        dsType === "ODOO_MANUFACTURING_ORDERS" && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="widget-filter-by-route"
            checked={widget.config.filterByStationRoute === true}
            onCheckedChange={(v) => setConfig("filterByStationRoute", v === true ? true : undefined)}
          />
          <Label htmlFor="widget-filter-by-route" className="text-xs">
            {t("stations.widget.filterByStationRoute")}
          </Label>
          <InfoTooltip text={t("stations.widget.filterByStationRouteHint")} />
        </div>
      )}

      {descriptor?.category === "DATA" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="widget-required" checked={widget.required} onCheckedChange={(v) => onChange({ required: v === true })} />
            <Label htmlFor="widget-required" className="text-xs">
              {t("stations.widget.required")}
            </Label>
          </div>
          {/* Solo TEXT_INPUT/DROPDOWN la tienen en el catalogo (ver WidgetCatalog) -- se pinta aqui, junto a "Obligatorio", en vez de en el bucle generico de configFields mas abajo, para que las dos casillas mas comunes vayan juntas. */}
          {descriptor?.configFields.some((f) => f.key === "finalizesFlow") ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="widget-finalizes-flow"
                checked={widget.config.finalizesFlow === true}
                onCheckedChange={(v) => setConfig("finalizesFlow", v === true ? true : undefined)}
              />
              <Label htmlFor="widget-finalizes-flow" className="text-xs">
                {t("stations.fields.finalizesFlow")}
              </Label>
              <InfoTooltip text={t("stations.fields.finalizesFlowHint")} />
            </div>
          ) : null}
          {/* Igual criterio que "Finaliza flujo" justo arriba: se pinta aqui, junto a "Obligatorio", en vez de en el bucle generico. */}
          {descriptor?.configFields.some((f) => f.key === "sticky") ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="widget-sticky"
                checked={widget.config.sticky === true}
                onCheckedChange={(v) => setConfig("sticky", v === true ? true : undefined)}
              />
              <Label htmlFor="widget-sticky" className="text-xs">
                {t("stations.fields.sticky")}
              </Label>
              <InfoTooltip text={t("stations.fields.stickyHint")} />
            </div>
          ) : null}
        </div>
      )}

      {/* Origen del dato: manual, o alimentado por un dispositivo (p. ej. escaner)
          o un evento MQTT (topic de suscripcion). Agrupado en un unico control:
          primero se elige el tipo, luego (si aplica) el dispositivo/evento concreto.
          Tambien aplica a STATION_MATERIALS: el origen automatico SIEMPRE lo decide
          el diseñador aqui, nunca el operario desde el popup de Materiales en
          produccion -- si se configura, cualquier codigo que lea ese dispositivo/
          evento se AÑADE a los lotes activos de la estacion (ver conversacion
          2026-07-30, tercera vuelta). */}
      {(descriptor?.category === "DATA" || widget.widgetType === "STATION_MATERIALS") && (
          <div className="space-y-1.5">
            <FieldLabel
              text={t("stations.widget.source")}
              hint={
                sourceKind === "DEVICE"
                  ? t("stations.widget.sourceDeviceHint")
                  : sourceKind === "EVENT"
                    ? t("stations.widget.sourceEventHint")
                    : undefined
              }
            />
            <Select value={sourceKind} onValueChange={(v) => setSourceKind(v as SourceKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t("stations.widget.sourceKind.NONE")}</SelectItem>
                <SelectItem value="DEVICE">{t("stations.widget.sourceKind.DEVICE")}</SelectItem>
                <SelectItem value="EVENT">{t("stations.widget.sourceKind.EVENT")}</SelectItem>
              </SelectContent>
            </Select>

            {sourceKind === "DEVICE" && (
              <Select
                value={widget.sourceDeviceId ? String(widget.sourceDeviceId) : ""}
                onValueChange={(v) => onChange({ sourceDeviceId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("stations.widget.chooseDevice")} />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sourceKind === "EVENT" && (
              <Select
                value={widget.sourceEventId ? String(widget.sourceEventId) : ""}
                onValueChange={(v) => onChange({ sourceEventId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("stations.widget.chooseEvent")} />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name} · {e.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Solo STATION_MATERIALS: si este lector/evento alimenta una
                posicion fisica concreta (p. ej. "R1"), cada codigo que lea
                sustituye lo que hubiera antes en esa posicion, en vez de
                simplemente añadirse (ver MaterialLoadService.load). Opcional
                -- sin posicion, cada escaneo se añade sin sustituir nada. */}
            {widget.widgetType === "STATION_MATERIALS" && sourceKind !== "NONE" && (
              <div className="space-y-1.5 pt-1">
                <FieldLabel text={t("stations.widget.materialPosition")} hint={t("stations.widget.materialPositionHint")} />
                <Select
                  value={(widget.config.position as string) ?? "NONE"}
                  onValueChange={(v) => setConfig("position", v === "NONE" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("stations.widget.noPosition")}</SelectItem>
                    {positions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
      )}

          {/* Columna de coincidencia: el dato en bruto leido (p. ej. el codigo de
              barras de la credencial) se busca en esta columna del origen Odoo;
              se guarda el registro encontrado (id) y se muestra su nombre. */}
          {showLookup && (
            <div className="space-y-1.5">
              <FieldLabel
                text={t("stations.widget.lookupColumn")}
                hint={t(widget.widgetType === "TEXT_INPUT" ? "stations.widget.lookupColumnHintManual" : "stations.widget.lookupColumnHint")}
              />
              <Select
                value={(widget.config.lookupColumn as string) ?? ""}
                onValueChange={(v) => {
                  const currentFontSize = ((widget.config.styles as Record<string, WidgetStyle> | undefined)?.value?.fontSize as string) ?? "MD";
                  onChange({
                    config: { ...widget.config, lookupColumn: v },
                    // El aviso de codigo no valido anade una linea bajo el
                    // control, que a un tamano de fuente pequeño ya calibrado
                    // sin sitio para ella se recortaba sin que se notara por
                    // que. Solo agranda aqui (elegir la columna es un cambio
                    // de comportamiento, no de tamano de letra): si luego el
                    // usuario encoge la fuente a mano, ahi si que encoge con ella.
                    layout: { ...widget.layout, h: Math.max(widget.layout.h, heightForFontSize("TEXT_INPUT", "value", currentFontSize, true) ?? widget.layout.h) },
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("stations.widget.chooseLookupColumn")} />
                </SelectTrigger>
                <SelectContent>
                  {lookupOptions.map((col) => (
                    <SelectItem key={col} value={col}>
                      {lookupColumnLabel(dsType, col, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

      {/* Una Etiqueta es texto fijo (se teclea directamente encima del propio
          widget en el canvas, ver InlineTextEdit en WidgetView), esta
          vinculada a otro widget de la estacion, o muestra la fecha/hora
          actual en vivo. */}
      {widget.widgetType === "LABEL" && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="widget-show-datetime"
              checked={widget.config.showDateTime === true}
              onCheckedChange={(v) =>
                onChange({
                  config: {
                    ...widget.config,
                    showDateTime: v === true ? true : undefined,
                    // La fecha/hora anula el resto de modos de texto.
                    text: v === true ? undefined : widget.config.text,
                    boundTo: v === true ? undefined : widget.config.boundTo,
                    boundField: v === true ? undefined : widget.config.boundField,
                  },
                })
              }
            />
            <Label htmlFor="widget-show-datetime" className="text-xs">
              {t("stations.widget.showDateTime")}
            </Label>
          </div>
          {widget.config.showDateTime === true && (
            <div className="space-y-1.5">
              <FieldLabel text={t("stations.widget.dateTimeFormat")} hint={t("stations.widget.dateTimeFormatHint")} />
              <Input
                value={(widget.config.dateTimeFormat as string) ?? ""}
                placeholder="dd/MM/yyyy HH:mm:ss"
                onChange={(e) => setConfig("dateTimeFormat", e.target.value)}
              />
            </div>
          )}
          {widget.config.showDateTime !== true && (
            <>
              <div className="space-y-1.5">
                <FieldLabel text={t("stations.widget.boundTo")} hint={t("stations.widget.boundToHint")} />
                <Select
                  value={boundTo ?? "NONE"}
                  onValueChange={(v) =>
                    onChange({
                      config: {
                        ...widget.config,
                        boundTo: v === "NONE" ? undefined : v,
                        // El campo elegido pertenece al origen anterior; si el
                        // origen cambia, se vuelve a elegir (mismo criterio que
                        // el origen de datos de un DROPDOWN/TEXT_INPUT).
                        boundField: undefined,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("stations.widget.boundToNone")}</SelectItem>
                    {bindableWidgets.map((b) => (
                      <SelectItem key={b.bindingKey} value={b.bindingKey}>
                        {b.label || b.bindingKey}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {boundTarget && (
            <div className="space-y-1.5">
              <FieldLabel text={t("stations.widget.boundField")} hint={t("stations.widget.boundFieldHint")} />
              <Select
                value={(widget.config.boundField as string) || BOUND_FIELD_VALUE}
                onValueChange={(v) => setConfig("boundField", v === BOUND_FIELD_VALUE ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BOUND_FIELD_VALUE}>{t("stations.widget.boundFieldValue")}</SelectItem>
                  {boundFieldOptions.map((col) => (
                    <SelectItem key={col} value={col}>
                      {t(`masterData.columns.${col}`, { defaultValue: col })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
            </>
          )}
        </>
      )}

      {/* "text" de LABEL se oculta solo si esta vinculada a otro widget (ver
          "Vincular a" mas arriba): en ese caso el texto se calcula, no se
          teclea, asi que el campo no tendria efecto. "result" de BUTTON solo
          tiene efecto con action=SUBMIT (ver WidgetCatalog): dos BUTTON con
          action=SUBMIT, uno result=OK y otro result=NG, sustituyen al unico
          "Finalizar" de siempre cuando la estacion necesita marcar el paso. */}
      {descriptor?.configFields
        .filter((field) => !(widget.widgetType === "LABEL" && field.key === "text" && Boolean(boundTo)))
        .filter((field) => !(widget.widgetType === "BUTTON" && field.key === "result" && widget.config.action !== "SUBMIT"))
        .filter((field) => field.key !== "finalizesFlow" && field.key !== "sticky") // ya pintadas junto a "Obligatorio", ver arriba
        .map((field) =>
        field.type === "CHECKBOX" ? (
        /* Casilla transversal (mismo aspecto que "Obligatorio"): se guarda
            como true o se quita de config, nunca false -- igual que
            filterByStationRoute, para que el JSON solo diga algo cuando el
            comportamiento especial esta activo. */
        <div key={field.key} className="flex items-center gap-2">
          <Checkbox
            id={`widget-field-${field.key}`}
            checked={widget.config[field.key] === true}
            onCheckedChange={(v) => setConfig(field.key, v === true ? true : undefined)}
          />
          <Label htmlFor={`widget-field-${field.key}`} className="text-xs">
            {t(field.labelKey, { defaultValue: field.key })}
          </Label>
          {/* Hint opcional: solo se pinta si existe la clave "<field>Hint" (p. ej. stickyHint, finalizesFlowHint). */}
          {(() => {
            const hint = t(`${field.labelKey}Hint`, { defaultValue: "" });
            return hint ? <InfoTooltip text={hint} /> : null;
          })()}
        </div>
        ) : (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs">
            {t(field.labelKey, { defaultValue: field.key })}
            {field.required && " *"}
          </Label>
          {field.type === "SELECT" ? (
            <Select
              value={(widget.config[field.key] as string) ?? ""}
              onValueChange={(v) => {
                // Una TABLE se vuelve "bindable" en cuanto se le da un modo de
                // seleccion (SINGLE/MULTI): si todavia no tiene clave de datos
                // (widget recien creado, o TABLE que era solo de lectura), se
                // le sugiere una para que aparezca de inmediato en "Vincular
                // a" sin que el usuario tenga que escribirla a mano.
                if (widget.widgetType === "TABLE" && field.key === "selectionMode" && v !== "NONE" && !widget.bindingKey) {
                  const key = suggestBindingKey();
                  onChange({ config: { ...widget.config, [field.key]: v }, bindingKey: key, label: key });
                } else {
                  setConfig(field.key, v);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`stations.fieldOptions.${field.key}.${opt}`, { defaultValue: opt })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={field.type === "NUMBER" ? "number" : "text"}
              value={(widget.config[field.key] as string) ?? ""}
              placeholder={field.placeholder ?? undefined}
              onChange={(e) => setConfig(field.key, e.target.value)}
            />
          )}
        </div>
        )
      )}

      {/* Estilo (tamano, negrita, alineacion, colores): un campo mas del
          panel, no una barra de edicion aparte -- ver StyleFields. La mayoria
          de widgets tiene una unica parte; TABLE tiene cabecera y celdas por
          separado. */}
      {(WIDGET_STYLE_PARTS[widget.widgetType] ?? []).length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stations.style.title")}</Label>
            {(() => {
              const parts = WIDGET_STYLE_PARTS[widget.widgetType] ?? [];
              return parts.map((p) => (
                <StyleFields
                  key={p}
                  widget={widget}
                  part={p}
                  label={parts.length > 1 ? t(`stations.style.parts.${p}`, { defaultValue: p }) : undefined}
                  onChange={onChange}
                />
              ));
            })()}
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs">{t("stations.widget.position")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <PositionInput label={t("stations.widget.x")} value={widget.layout.x} onChange={(v) => setLayout("x", v)} />
          <PositionInput label={t("stations.widget.y")} value={widget.layout.y} onChange={(v) => setLayout("y", v)} />
          <PositionInput label={t("stations.widget.w")} value={widget.layout.w} min={1} onChange={(v) => setLayout("w", v)} />
          <PositionInput label={t("stations.widget.h")} value={widget.layout.h} min={0.25} step={0.25} onChange={(v) => setLayout("h", v)} />
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={onDelete}>
        <IconTrash className="mr-1 size-4" />
        {t("stations.widget.delete")}
      </Button>
    </div>
  );
}

function PositionInput({
  label,
  value,
  min = 0,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
    </div>
  );
}
