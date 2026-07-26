import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconGripVertical, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { Device } from "@/features/devices/types";
import type { MqttEvent } from "@/features/events/types";
import { useStationsCatalogStore } from "./stations-catalog-store";
import { useStationAssetUrl } from "./useStationAssetUrl";
import { WidgetView } from "./WidgetView";
import { clamp, columnStep, gridContainerStyle, nextFreeRow, rowStep } from "./gridGeometry";

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
} from "./types";

type EditableWidget = Widget & { _uid: string };
type EditableScreen = { _uid: string; id?: number; title: string; orderIndex: number; widgets: EditableWidget[] };

let uidSeq = 0;
function uid(): string {
  uidSeq += 1;
  return `w${Date.now()}_${uidSeq}`;
}

function screenFrom(s: Screen): EditableScreen {
  return { _uid: uid(), id: s.id, title: s.title, orderIndex: s.orderIndex, widgets: s.widgets.map((w) => ({ ...w, _uid: uid() })) };
}

function defaultSize(type: string): { w: number; h: number } {
  switch (type) {
    case "TABLE":
      return { w: 12, h: 4 };
    case "IMAGE":
      return { w: 6, h: 4 };
    case "LABEL":
      return { w: 12, h: 1 };
    case "BUTTON":
      return { w: 3, h: 1 };
    default:
      return { w: 6, h: 1 };
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

  const descriptorFor = React.useCallback(
    (type: string): WidgetDescriptor | undefined => catalog?.widgets.find((w) => w.type === type),
    [catalog],
  );

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
    const newWidget: EditableWidget = {
      _uid: uid(),
      widgetType: descriptor.type,
      label: t(`stations.types.${descriptor.type}`, { defaultValue: descriptor.type }),
      bindingKey: descriptor.requiresBinding ? `dato_${widgets.length + 1}` : null,
      required: false,
      sourceDeviceId: null,
      sourceEventId: null,
      config: descriptor.type === "BUTTON" ? { action: "NEXT" } : {},
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

      <div className="grid flex-1 grid-cols-[180px_1fr_300px] gap-4 overflow-hidden">
        {/* Paleta de widgets */}
        <Card className="overflow-y-auto">
          <CardContent className="space-y-2 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t("stations.builder.palette")}</p>
            <p className="text-[11px] text-muted-foreground">{t("stations.builder.paletteHint")}</p>
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
                        gridRow: `${dragState.cell.y + 1} / span ${size.h}`,
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
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              {t("stations.builder.properties")}
            </p>
            {selected ? (
              <PropertiesPanel
                key={selected._uid}
                widget={selected}
                descriptor={descriptorFor(selected.widgetType)}
                dataSources={catalog?.dataSources ?? []}
                lookupColumns={catalog?.lookupColumns ?? {}}
                devices={inputDevices}
                events={events.filter((e) => e.direction === "SUBSCRIBE")}
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
}: {
  widget: EditableWidget;
  selected: boolean;
  gridRef: React.RefObject<HTMLDivElement | null>;
  deviceName: string | null;
  eventName: string | null;
  onSelect: (uid: string) => void;
  onLayoutChange: (uid: string, layout: WidgetLayout) => void;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<
    | null
    | { mode: "move" | "resize"; startX: number; startY: number; start: WidgetLayout; stepX: number }
  >(null);

  function begin(mode: "move" | "resize", e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(widget._uid);
    const width = gridRef.current?.getBoundingClientRect().width ?? 0;
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...widget.layout }, stepX: columnStep(width) };
    try {
      boxRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // continua sin captura (ver mismo ajuste en startPaletteDrag)
    }
  }

  function onMove(e: React.PointerEvent) {
    const s = drag.current;
    if (!s) return;
    const dCol = Math.round((e.clientX - s.startX) / s.stepX);
    const dRow = Math.round((e.clientY - s.startY) / rowStep);
    if (s.mode === "move") {
      onLayoutChange(widget._uid, {
        x: clamp(s.start.x + dCol, 0, GRID_COLUMNS - s.start.w),
        y: Math.max(0, s.start.y + dRow),
        w: s.start.w,
        h: s.start.h,
      });
    } else {
      onLayoutChange(widget._uid, {
        x: s.start.x,
        y: s.start.y,
        w: clamp(s.start.w + dCol, 1, GRID_COLUMNS - s.start.x),
        h: Math.max(1, s.start.h + dRow),
      });
    }
  }

  function end(e: React.PointerEvent) {
    if (drag.current) {
      drag.current = null;
      try {
        boxRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    }
  }

  const { x, y, w, h } = widget.layout;

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerDown={(e) => {
        // Toda la caja arrastra (mueve), salvo la esquina de redimensionar (que
        // gestiona su propio begin("resize", ...) y para la propagacion). Antes
        // solo el icono de 16x16 arriba-izquierda iniciaba el movimiento: al
        // desplazar el widget, ese icono cambiaba de sitio y era facil "perderlo"
        // al intentar volver a arrastrar, dando una sensacion de arrastre errático.
        if ((e.target as HTMLElement).closest("[data-resize]")) return;
        begin("move", e);
      }}
      // Marco de seleccion con outline (NO afecta al layout, a diferencia de un
      // border). El contenido ocupa exactamente la celda, igual que en el runtime.
      className={`group relative cursor-move rounded-sm ${selected ? "outline outline-2 outline-primary" : "outline-dashed outline-1 outline-border"}`}
      style={{ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}`, overflowX: "visible", overflowY: "hidden" }}
    >
      {/* Contenido identico al operador (pointer-events-none: el clic selecciona el widget, no interactua).
          padding:1 + overflow-y-solo evita que el borde izq/der del input/select se recorte por el
          redondeo de subpixel del grid (el mismo ajuste se aplica en el runtime). */}
      <div className="no-scrollbar pointer-events-none absolute inset-0 overflow-x-visible overflow-y-auto p-px">
        <WidgetView widget={widget} interactive={false} deviceName={deviceName} eventName={eventName} />
      </div>

      {/* Indicador visual de que se puede arrastrar (ya no es el unico punto de
          agarre: toda la caja lo es). pointer-events-none para no interferir. */}
      <div
        className={`pointer-events-none absolute left-0 top-0 flex size-4 items-center justify-center rounded-br bg-primary/70 text-primary-foreground ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <IconGripVertical className="size-3" />
      </div>
      <div
        data-resize
        onPointerDown={(e) => begin("resize", e)}
        className={`absolute bottom-0 right-0 size-3 cursor-se-resize rounded-tl bg-primary/70 ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />
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

type SourceKind = "NONE" | "DEVICE" | "EVENT";

function PropertiesPanel({
  widget,
  descriptor,
  dataSources,
  lookupColumns,
  devices,
  events,
  onChange,
  onDelete,
}: {
  widget: EditableWidget;
  descriptor: WidgetDescriptor | undefined;
  dataSources: string[];
  lookupColumns: Record<string, string[]>;
  devices: Device[];
  events: MqttEvent[];
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
  const showLookup =
    widget.widgetType === "DROPDOWN" && dsType && dsType !== "STATIC_LIST" && sourceKind !== "NONE" && lookupOptions.length > 0;

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
      <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium">
        {t(`stations.types.${widget.widgetType}`, { defaultValue: widget.widgetType })}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("stations.widget.label")}</Label>
        <Input value={widget.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>

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
          <Label className="text-xs">{t("stations.widget.bindingKey")}</Label>
          <Input value={widget.bindingKey ?? ""} onChange={(e) => onChange({ bindingKey: e.target.value })} />
          <p className="text-[11px] text-muted-foreground">{t("stations.widget.bindingKeyHint")}</p>
        </div>
      )}

      {descriptor?.category === "DATA" && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox id="widget-required" checked={widget.required} onCheckedChange={(v) => onChange({ required: v === true })} />
            <Label htmlFor="widget-required" className="text-xs">
              {t("stations.widget.required")}
            </Label>
          </div>

          {/* Origen del dato: manual, o alimentado por un dispositivo (p. ej. escaner)
              o un evento MQTT (topic de suscripcion). Agrupado en un unico control:
              primero se elige el tipo, luego (si aplica) el dispositivo/evento concreto. */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("stations.widget.source")}</Label>
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

            {sourceKind !== "NONE" && (
              <p className="text-[11px] text-muted-foreground">
                {sourceKind === "DEVICE" ? t("stations.widget.sourceDeviceHint") : t("stations.widget.sourceEventHint")}
              </p>
            )}
          </div>

          {/* Columna de coincidencia: el dato en bruto leido (p. ej. el codigo de
              barras de la credencial) se busca en esta columna del origen Odoo;
              se guarda el registro encontrado (id) y se muestra su nombre. */}
          {showLookup && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("stations.widget.lookupColumn")}</Label>
              <Select
                value={(widget.config.lookupColumn as string) ?? ""}
                onValueChange={(v) => onChange({ config: { ...widget.config, lookupColumn: v } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("stations.widget.chooseLookupColumn")} />
                </SelectTrigger>
                <SelectContent>
                  {lookupOptions.map((col) => (
                    <SelectItem key={col} value={col}>
                      {t(`stations.lookupColumns.${col}`, { defaultValue: col })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t("stations.widget.lookupColumnHint")}</p>
            </div>
          )}
        </>
      )}

      {descriptor?.supportsDataSource && (
        <div className="space-y-1.5">
          <Label className="text-xs">{t("stations.widget.dataSource")}</Label>
          <Select
            value={dsType}
            onValueChange={(value) =>
              onChange({
                dataSource:
                  value === "STATIC_LIST"
                    ? { type: value, staticOptions: widget.dataSource.staticOptions ?? [] }
                    : { type: value },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("stations.widget.chooseDataSource")} />
            </SelectTrigger>
            <SelectContent>
              {dataSources
                .filter((ds) => widget.widgetType !== "TABLE" || ds !== "STATIC_LIST")
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

      {descriptor?.configFields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs">
            {t(field.labelKey, { defaultValue: field.key })}
            {field.required && " *"}
          </Label>
          {field.type === "SELECT" ? (
            <Select value={(widget.config[field.key] as string) ?? ""} onValueChange={(v) => setConfig(field.key, v)}>
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
      ))}

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs">{t("stations.widget.position")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <PositionInput label={t("stations.widget.x")} value={widget.layout.x} onChange={(v) => setLayout("x", v)} />
          <PositionInput label={t("stations.widget.y")} value={widget.layout.y} onChange={(v) => setLayout("y", v)} />
          <PositionInput label={t("stations.widget.w")} value={widget.layout.w} min={1} onChange={(v) => setLayout("w", v)} />
          <PositionInput label={t("stations.widget.h")} value={widget.layout.h} min={1} onChange={(v) => setLayout("h", v)} />
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
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input type="number" min={min} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} />
    </div>
  );
}
