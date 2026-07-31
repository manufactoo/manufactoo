import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { IconAlertTriangle, IconArrowLeft, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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
      await apiClient.post(`/api/stations/${id}/records`, { values: overrideValues ?? values, result: result ?? null });
      setValues({});
      setCurrent(0);
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

  /** TEXT_INPUT/DROPDOWN con config.result != NONE: confirmar su valor (Enter, seleccion, escaneo) finaliza y registra directamente, sin BUTTON. */
  function handleConfirm(widget: Widget, value: unknown) {
    const result = widget.config.result as string | undefined;
    if (!result || result === "NONE" || !widget.bindingKey) return;
    const merged = { ...values, [widget.bindingKey]: value };
    setValues(merged);
    void submit(result, merged);
  }

  if (!station) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  const isLast = current >= screens.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* En modo kiosko (dentro del Player) no hay a donde "volver": el
              operario no tiene acceso al listado de estaciones ni al resto
              del panel de administracion. */}
          {!bridge && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
              <IconArrowLeft className="mr-1 size-4" />
              {t("stations.runtime.back")}
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">{station.name}</h1>
            <p className="text-xs text-muted-foreground">
              {screen?.title || t("stations.builder.screenN", { n: current + 1 })}
              {screens.length > 1 && ` · ${current + 1}/${screens.length}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {flash && <span className="text-sm text-emerald-600">{flash}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>

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
                    height: "100%",
                    paddingLeft: 1,
                    paddingRight: 1,
                    paddingTop: PART_GAP,
                    paddingBottom: PART_GAP,
                    overflowX: "visible",
                    overflowY: "auto",
                  }}
                >
                  <WidgetView
                    widget={widget}
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

      {/* Zona fija comun para los errores de validacion activos (codigo
          invalido/no encontrado): cada widget reporta el suyo via onError en
          vez de pintarlo el mismo, asi que el widget se queda exactamente
          como se diseño en el layout, por pequeño que sea. */}
      {activeWidgetErrors.length > 0 && (
        <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          {activeWidgetErrors.map((message, i) => (
            <p key={i} className="flex items-center gap-1.5 text-sm text-destructive">
              <IconAlertTriangle className="size-3.5 shrink-0" />
              {message}
            </p>
          ))}
        </div>
      )}

      {/* Navegacion de la secuencia: Atras/Siguiente siguen siendo por
          defecto, pero Finalizar ya no lo es -- lo decide el diseñador
          colocando su propio widget finalizador (BUTTON action=SUBMIT, o un
          TEXT_INPUT/DROPDOWN con resultado != NONE), validado al guardar la
          estacion (ver StationService.validate). Sin fallback aqui: si no
          hay ninguno, la estacion no se puede ni guardar. */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
          <IconChevronLeft className="mr-1 size-4" />
          {t("stations.runtime.prev")}
        </Button>
        {!isLast && (
          <Button onClick={() => goTo(current + 1)}>
            {t("stations.runtime.next")}
            <IconChevronRight className="ml-1 size-4" />
          </Button>
        )}
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
