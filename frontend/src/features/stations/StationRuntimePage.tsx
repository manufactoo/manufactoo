import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { Device } from "@/features/devices/types";
import type { MqttEvent } from "@/features/events/types";
import { gridContainerStyle, PART_GAP, toFineRows } from "./gridGeometry";
import { getBridge } from "./manufactoo-bridge";
import { BOUND_FIELD_VALUE, BridgeWatcher, cellText, WidgetView } from "./WidgetView";
import { MaterialsDialog } from "./MaterialsDialog";
import { fetchDataSourceTable, findRowById } from "./dataSourceTableCache";
import { useStationsCatalogStore } from "./stations-catalog-store";
import { type DataSourceOption, type DataSourceTable, type MaterialLoad, type Screen, type Station, type Widget } from "./types";

/**
 * Por defecto, un DROPDOWN muestra display_name/name (resuelto por el
 * backend en optionsByType). Si el diseñador ha elegido "Mostrar como"
 * (config.labelColumns), se recompone la etiqueta de cada opcion con esas
 * columnas en vez del nombre -- usando tableByType, que ya trae la fila
 * completa de cada origen Odoo (se pide igualmente para que las Etiquetas
 * vinculadas puedan leer cualquier columna, ver el efecto de tableByType mas
 * abajo), asi que esto no añade ninguna peticion nueva.
 */
function composeDropdownOptions(
  base: DataSourceOption[] | undefined,
  table: DataSourceTable | undefined,
  labelColumns: string[] | undefined,
): DataSourceOption[] | undefined {
  if (!base || !table || !labelColumns || labelColumns.length === 0) return base;
  const rowById = new Map(table.rows.map((row) => [String(row.id), row]));
  return base.map((opt) => {
    const row = rowById.get(opt.value);
    if (!row) return opt;
    const composed = labelColumns.map((c) => cellText(row[c])).filter((s) => s !== "").join(" — ");
    return composed ? { ...opt, label: composed } : opt;
  });
}

/** Clave de cache en optionsByType para un DROPDOWN: el tipo solo, salvo cuando pide el filtro por rutas de la estacion (config.filterByStationRoute), que depende de la estacion y no se puede compartir con un widget del mismo tipo que no lo pida. */
function optionsKeyFor(widget: Widget): string {
  const type = widget.dataSource?.type ?? "";
  const filtered = type === "ODOO_MANUFACTURING_ORDERS" && widget.config.filterByStationRoute === true;
  return filtered ? `${type}:route` : type;
}

export function StationRuntimePage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const catalog = useStationsCatalogStore((s) => s.catalog);
  const fetchCatalog = useStationsCatalogStore((s) => s.fetch);

  const [station, setStation] = React.useState<Station | null>(null);
  const [current, setCurrent] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [optionsByType, setOptionsByType] = React.useState<Record<string, DataSourceOption[]>>({});
  // Filas completas (todas las columnas, no solo {value,label}) por tipo de
  // origen: hace falta para que una Etiqueta vinculada a un DROPDOWN o a una
  // TABLE pueda leer cualquier columna del registro seleccionado, no solo su
  // etiqueta ya resuelta.
  const [tableByType, setTableByType] = React.useState<Record<string, DataSourceTable>>({});
  // Fila resuelta (todas las columnas) de cada TEXT_INPUT validado, indexada
  // por su bindingKey: la reporta el propio widget al validar el codigo
  // tecleado (ver onResolvedRow), para que una Etiqueta vinculada a el pueda
  // leer cualquiera de sus columnas sin volver a pedirlas.
  const [lookupRowsByBindingKey, setLookupRowsByBindingKey] = React.useState<Record<string, Record<string, unknown> | null>>({});
  // Errores de validacion activos (codigo invalido/no encontrado) por
  // bindingKey, reportados por cada widget via onError en vez de pintarlos
  // ellos mismos -- el widget se queda tal y como se diseño, y aqui se juntan
  // en una zona fija comun (ver conversacion 2026-07-29).
  const [widgetErrors, setWidgetErrors] = React.useState<Record<string, string | null>>({});
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [events, setEvents] = React.useState<MqttEvent[]>([]);
  // Lotes/series activos ahora mismo en la ESTACION (no en ningun widget) --
  // a diferencia de "values", no se limpia al enviar (persiste entre
  // unidades, ver WidgetView.StationMaterialsWidget).
  const [materialLoads, setMaterialLoads] = React.useState<MaterialLoad[]>([]);
  const [materialsDialogOpen, setMaterialsDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Se incrementa tras cada envio con exito -- unico consumidor: STATION_HISTORY
  // (ver WidgetView.tsx), para que refresque y el operario vea su propio envio
  // al instante sin recargar la pantalla.
  const [historyVersion, setHistoryVersion] = React.useState(0);

  const screens: Screen[] = station?.screens ?? [];
  const screen: Screen | undefined = screens[current];
  const bridge = getBridge();

  React.useEffect(() => {
    void fetchCatalog();
    apiClient.get<Station>(`/api/stations/${id}`).then(({ data }) => setStation(data));
    apiClient.get<Device[]>("/api/devices").then(({ data }) => setDevices(data)).catch(() => setDevices([]));
    apiClient.get<MqttEvent[]>("/api/events").then(({ data }) => setEvents(data)).catch(() => setEvents([]));
    refreshMaterialLoads();
  }, [id, fetchCatalog]);

  /** Lotes/series activos ahora mismo en la estacion. */
  function refreshMaterialLoads() {
    apiClient
      .get<MaterialLoad[]>(`/api/stations/${id}/material-loads`)
      .then(({ data }) => setMaterialLoads(data))
      .catch(() => setMaterialLoads([]));
  }

  /**
   * Carga un lote nuevo en la estacion: el backend valida el codigo contra
   * series/lotes de Odoo y lo añade a los activos (si ese mismo lote ya
   * estaba activo, no lo duplica) -- se propaga a TODAS las unidades
   * siguientes automaticamente, sin pasar por "values". Si se indica
   * posicion y ya habia algo cargado ahi, el backend lo cierra -- por eso
   * aqui tambien se quita del estado local cualquier otra carga con esa
   * misma posicion, no solo se añade la nueva.
   */
  async function handleLoadMaterial(code: string, position?: string) {
    const { data } = await apiClient.post<MaterialLoad>(`/api/stations/${id}/material-loads`, { code, position });
    setMaterialLoads((prev) => [data, ...prev.filter((l) => l.id !== data.id && !(data.position && l.position === data.position))]);
  }

  /** Descarga un lote concreto (ya no esta disponible en la estacion). */
  async function handleUnloadMaterial(loadId: number) {
    await apiClient.delete(`/api/stations/${id}/material-loads/${loadId}`);
    setMaterialLoads((prev) => prev.filter((l) => l.id !== loadId));
  }

  // Carga las opciones de todos los desplegables Odoo de toda la secuencia.
  // Cacheadas por tipo, salvo "filterByStationRoute" (solo tiene sentido
  // en ordenes de fabricacion): esa variante depende de la estacion, asi
  // que se guarda bajo una clave distinta para no compartir cache con un
  // desplegable del mismo tipo que NO quiera el filtro (ver optionsKeyFor).
  React.useEffect(() => {
    const keys = new Set<string>();
    for (const s of screens) {
      for (const w of s.widgets) {
        const type = w.dataSource?.type;
        if (w.widgetType === "DROPDOWN" && type && type !== "STATIC_LIST") keys.add(optionsKeyFor(w));
      }
    }
    keys.forEach((key) => {
      if (optionsByType[key]) return;
      const filtered = key.endsWith(":route");
      const type = filtered ? key.slice(0, -":route".length) : key;
      apiClient
        .get<DataSourceOption[]>("/api/stations/data-source-options", { params: filtered ? { type, stationId: id } : { type } })
        .then(({ data }) => setOptionsByType((prev) => ({ ...prev, [key]: data })))
        .catch(() => setOptionsByType((prev) => ({ ...prev, [key]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

  // Filas completas de todo DROPDOWN/TABLE de la secuencia: WidgetTable ya
  // pide lo mismo para pintarse (misma cache compartida, ver
  // dataSourceTableCache), asi que esto no anade peticiones nuevas para las
  // TABLE -- solo para los DROPDOWN, que antes solo traian {value,label}.
  React.useEffect(() => {
    const types = new Set<string>();
    for (const s of screens) {
      for (const w of s.widgets) {
        const type = w.dataSource?.type;
        if ((w.widgetType === "DROPDOWN" || w.widgetType === "TABLE") && type && type !== "STATIC_LIST") types.add(type);
      }
    }
    types.forEach((type) => {
      fetchDataSourceTable(type)
        .then((table) => setTableByType((prev) => ({ ...prev, [type]: table })))
        .catch(() => {
          /* si falla, las Etiquetas vinculadas a este tipo simplemente no muestran nada */
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

  function handleResolvedRow(bindingKey: string, row: Record<string, unknown> | null) {
    setLookupRowsByBindingKey((prev) => ({ ...prev, [bindingKey]: row }));
  }

  function handleWidgetError(bindingKey: string, message: string | null) {
    setWidgetErrors((prev) => (prev[bindingKey] === message ? prev : { ...prev, [bindingKey]: message }));
  }

  const activeWidgetErrors = Object.values(widgetErrors).filter((m): m is string => Boolean(m));

  /**
   * Dato de cada widget que captura datos, indexado por su bindingKey, listo
   * para que cualquier Etiqueta vinculada lo lea: BOUND_FIELD_VALUE es
   * siempre el valor crudo capturado; el resto son columnas Odoo resueltas
   * cuando el widget origen tiene un dato maestro detras (seleccion de
   * DROPDOWN/TABLE, o el registro validado de un TEXT_INPUT).
   */
  const resolvedRows = React.useMemo(() => {
    const result: Record<string, Record<string, unknown>> = {};
    for (const s of screens) {
      for (const w of s.widgets) {
        if (!w.bindingKey) continue;
        const raw = values[w.bindingKey];
        const row: Record<string, unknown> = {
          [BOUND_FIELD_VALUE]: Array.isArray(raw) ? raw.join(", ") : (raw ?? ""),
        };
        const dsType = w.dataSource?.type;
        if (w.widgetType === "DROPDOWN" && dsType && dsType !== "STATIC_LIST") {
          const found = findRowById(tableByType[dsType] ?? null, raw);
          if (found) Object.assign(row, found);
        } else if (w.widgetType === "TEXT_INPUT") {
          const found = lookupRowsByBindingKey[w.bindingKey];
          if (found) Object.assign(row, found);
        } else if (w.widgetType === "TABLE" && (w.config.selectionMode as string) === "SINGLE" && dsType && dsType !== "STATIC_LIST") {
          const valueColumn = (w.config.valueColumn as string) || "id";
          const table = tableByType[dsType];
          const found = table?.rows.find((r) => String(r[valueColumn] ?? r.id) === String(raw));
          if (found) Object.assign(row, found);
        }
        result[w.bindingKey] = row;
      }
    }
    return result;
  }, [screens, values, tableByType, lookupRowsByBindingKey]);

  /** Widgets STATION_MATERIALS de TODA la estacion (no solo la pantalla actual) que tengan un origen automatico configurado -- ver el bloque de BridgeWatcher en el render. */
  const materialSourceWidgets = React.useMemo(
    () => screens.flatMap((s) => s.widgets).filter((w) => w.widgetType === "STATION_MATERIALS" && (w.sourceDeviceId || w.sourceEventId)),
    [screens],
  );

  const deviceName = React.useCallback(
    (deviceId: number | null) => devices.find((d) => d.id === deviceId)?.name ?? null,
    [devices],
  );
  const eventName = React.useCallback(
    (eventId: number | null) => {
      const e = events.find((ev) => ev.id === eventId);
      return e ? `${e.name} · ${e.topic}` : null;
    },
    [events],
  );

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Cachea un registro resuelto por escaneo (codigo->registro) para que el desplegable muestre su nombre. */
  function cacheResolvedOption(type: string, option: DataSourceOption) {
    setOptionsByType((prev) => {
      const list = prev[type] ?? [];
      if (list.some((o) => o.value === option.value)) return prev;
      return { ...prev, [type]: [...list, option] };
    });
  }

  function goTo(index: number) {
    setCurrent(Math.max(0, Math.min(screens.length - 1, index)));
  }

  /**
   * overrideValues: para el finalizador por campo (handleConfirm) -- el valor
   * recien confirmado puede no estar todavia reflejado en `values` (setValue
   * es asincrono), asi que se manda explicito en vez de leerlo del estado.
   * Guarda contra envios duplicados (Enter repetido, doble clic) -- antes lo
   * evitaba `disabled` en el unico boton Finalizar; ahora que puede haber
   * varios widgets finalizadores a la vez, la guarda vive aqui.
   */
  async function submit(result?: string, overrideValues?: Record<string, unknown>) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = overrideValues ?? values;
      await apiClient.post(`/api/stations/${id}/records`, { values: payload, result: result ?? null });
      // Los widgets con config.sticky mantienen su valor para la siguiente
      // unidad (p. ej. el operario de turno: se elige una vez, no en cada
      // unidad) -- el resto se limpia como siempre. Se parte de `payload`
      // (lo que de verdad se acaba de enviar), no del estado `values`
      // (podria diferir si vino de handleConfirm con overrideValues).
      const stickyKeys = screens
        .flatMap((s) => s.widgets)
        .filter((w) => w.config.sticky === true && w.bindingKey)
        .map((w) => w.bindingKey as string);
      setValues(
        stickyKeys.length === 0
          ? {}
          : Object.fromEntries(stickyKeys.filter((k) => payload[k] !== undefined).map((k) => [k, payload[k]])),
      );
      setCurrent(0);
      setHistoryVersion((v) => v + 1);
      setFlash(t("stations.runtime.submitted"));
      window.setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("stations.runtime.submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleButton(widget: Widget) {
    const action = (widget.config.action as string) ?? "NEXT";
    if (action === "NEXT") goTo(current + 1);
    else if (action === "PREV") goTo(current - 1);
    else if (action === "GOTO") goTo(Number(widget.config.targetScreen ?? 1) - 1);
    else if (action === "SUBMIT") {
      const result = widget.config.result as string | undefined;
      void submit(result && result !== "NONE" ? result : undefined);
    } else if (action === "MATERIALS") setMaterialsDialogOpen(true);
  }

  /** TEXT_INPUT/DROPDOWN con config.finalizesFlow: confirmar su valor (Enter, seleccion, escaneo) finaliza el flujo y registra directamente como OK, sin necesitar un BUTTON aparte. */
  function handleConfirm(widget: Widget, value: unknown) {
    if (widget.config.finalizesFlow !== true || !widget.bindingKey) return;
    const merged = { ...values, [widget.bindingKey]: value };
    setValues(merged);
    void submit("OK", merged);
  }

  if (!station) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  const isLast = current >= screens.length - 1;

  return (
    <div className="space-y-4 p-4">
      {/* Sin nombre de estacion/titulo de pantalla fijos aqui: ahora son
          contenido "vivo" de un LABEL mas (config.showStationName/
          showScreenTitle, ver WidgetView.tsx) que el diseñador coloca donde
          quiera -- solo el boton Volver se queda fijo, es navegacion, no
          contenido (ver conversacion 2026-08-03). */}
      {!bridge && (
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
          <IconArrowLeft className="mr-1 size-4" />
          {t("stations.runtime.back")}
        </Button>
      )}

      <Card>
        <CardContent className="p-4">
          {!screen || screen.widgets.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("stations.runtime.emptyScreen")}</p>
          ) : (
            <div style={gridContainerStyle()}>
              {screen.widgets.map((widget, i) => (
                <div
                  key={widget.id ?? i}
                  className="no-scrollbar flex flex-col justify-center"
                  style={{
                    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
                    gridRow: `${toFineRows(widget.layout.y) + 1} / span ${toFineRows(widget.layout.h)}`,
                    // PANEL es puramente decorativo: se queda siempre detras
                    // del resto para no tapar ni robar el clic a los widgets
                    // colocados encima (ver conversacion 2026-08-01).
                    zIndex: widget.widgetType === "PANEL" ? 0 : 1,
                    height: "100%",
                    // PANEL sin relleno horizontal para que su borde llegue
                    // justo al limite de su celda. Los demas widgets llevan 4px
                    // de aire a cada lado, asi que no tocan el borde de un
                    // PANEL colocado detras.
                    paddingLeft: widget.widgetType === "PANEL" ? 0 : 4,
                    paddingRight: widget.widgetType === "PANEL" ? 0 : 4,
                    paddingTop: PART_GAP,
                    paddingBottom: PART_GAP,
                    overflowX: "visible",
                    overflowY: "auto",
                  }}
                >
                  <WidgetView
                    widget={widget}
                    stationId={id}
                    historyVersion={historyVersion}
                    stationName={station.name}
                    screenTitle={screen?.title}
                    value={widget.bindingKey ? values[widget.bindingKey] : undefined}
                    options={
                      widget.dataSource?.type
                        ? composeDropdownOptions(
                            optionsByType[optionsKeyFor(widget)],
                            tableByType[widget.dataSource.type],
                            widget.config.labelColumns as string[] | undefined,
                          )
                        : undefined
                    }
                    deviceName={deviceName(widget.sourceDeviceId)}
                    eventName={eventName(widget.sourceEventId)}
                    onChange={(v) => widget.bindingKey && setValue(widget.bindingKey, v)}
                    onButton={() => handleButton(widget)}
                    onConfirm={handleConfirm}
                    onResolvedOption={cacheResolvedOption}
                    displayColumns={catalog?.displayColumns}
                    resolvedRows={resolvedRows}
                    onResolvedRow={handleResolvedRow}
                    onError={handleWidgetError}
                    materialLoads={materialLoads}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Origen automatico de materiales: lo decide el diseñador en un widget
          STATION_MATERIALS (sourceDeviceId/sourceEventId, igual que
          cualquier otro widget con origen). Se escucha aqui, a nivel de toda
          la estacion, para que funcione independientemente de si ese widget
          esta visible en la pantalla actual o si el popup de Materiales esta
          abierto. Si el widget tiene una posicion asignada (config.position),
          cada codigo leido sustituye lo que hubiera ahi; si no, se AÑADE sin
          mas (ver conversacion 2026-07-31). */}
      {bridge &&
        materialSourceWidgets.map(
          (widget) =>
            (widget.sourceDeviceId || widget.sourceEventId) && (
              <BridgeWatcher
                key={widget.id}
                bridge={bridge}
                sourceDeviceId={widget.sourceDeviceId}
                sourceEventId={widget.sourceEventId}
                onRaw={(raw) => {
                  handleLoadMaterial(raw, widget.config.position as string | undefined).catch((err) => {
                    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                    handleWidgetError("materials", message ?? t("stations.runtime.invalidMaterialCode", { code: raw }));
                  });
                }}
              />
            ),
        )}

      {/* Navegacion de la secuencia + zona fija comun de mensajes, unificada
          en una sola fila de 3 columnas (Atras | mensajes | Siguiente) --
          antes habia DOS zonas de mensajes separadas (flash/error arriba a
          la derecha, errores de validacion por widget encima de esta fila),
          ahora es una sola, siempre en el mismo sitio (ver conversacion
          2026-08-03). grid (no flex justify-between) para que la columna
          central quede centrada de verdad incluso cuando falta el boton
          Siguiente (ultima pantalla). Prioridad si hay varios mensajes a la
          vez: error de envio > errores de campo activos > aviso de exito >
          estado neutro (para que la fila nunca se quede vacia/rara).
          Finalizar ya no es un boton por defecto -- lo decide el diseñador
          colocando su propio widget finalizador (BUTTON action=SUBMIT, o un
          TEXT_INPUT/DROPDOWN con "finaliza el flujo" marcado), validado al
          guardar la estacion (ver StationService.validate). */}
      <div className="grid grid-cols-3 items-center gap-3">
        <div>
          <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
            <IconChevronLeft className="mr-1 size-4" />
            {t("stations.runtime.prev")}
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          {error ? (
            <p className="flex items-center gap-1.5 text-base font-medium text-destructive">
              <IconAlertTriangle className="size-4 shrink-0" />
              {error}
            </p>
          ) : activeWidgetErrors.length > 0 ? (
            activeWidgetErrors.map((message, i) => (
              <p key={i} className="flex items-center gap-1.5 text-base font-medium text-destructive">
                <IconAlertTriangle className="size-4 shrink-0" />
                {message}
              </p>
            ))
          ) : flash ? (
            <p className="flex items-center gap-1.5 text-base font-medium text-emerald-600">
              <IconCircleCheck className="size-4 shrink-0" />
              {flash}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <IconInfoCircle className="size-4 shrink-0" />
              {t("stations.runtime.statusIdle")}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          {!isLast && (
            <Button onClick={() => goTo(current + 1)}>
              {t("stations.runtime.next")}
              <IconChevronRight className="ml-1 size-4" />
            </Button>
          )}
        </div>
      </div>

      <MaterialsDialog
        open={materialsDialogOpen}
        onOpenChange={setMaterialsDialogOpen}
        loads={materialLoads}
        positions={station.positions}
        onLoad={handleLoadMaterial}
        onUnload={handleUnloadMaterial}
      />
    </div>
  );
}
