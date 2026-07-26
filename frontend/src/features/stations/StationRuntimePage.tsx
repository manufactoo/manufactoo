import * as React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { IconArrowLeft, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { Device } from "@/features/devices/types";
import type { MqttEvent } from "@/features/events/types";
import { gridContainerStyle } from "./gridGeometry";
import { WidgetView } from "./WidgetView";
import { type DataSourceOption, type Screen, type Station, type Widget } from "./types";

export function StationRuntimePage() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [station, setStation] = React.useState<Station | null>(null);
  const [current, setCurrent] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [optionsByType, setOptionsByType] = React.useState<Record<string, DataSourceOption[]>>({});
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [events, setEvents] = React.useState<MqttEvent[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const screens: Screen[] = station?.screens ?? [];
  const screen: Screen | undefined = screens[current];

  React.useEffect(() => {
    apiClient.get<Station>(`/api/stations/${id}`).then(({ data }) => setStation(data));
    apiClient.get<Device[]>("/api/devices").then(({ data }) => setDevices(data)).catch(() => setDevices([]));
    apiClient.get<MqttEvent[]>("/api/events").then(({ data }) => setEvents(data)).catch(() => setEvents([]));
  }, [id]);

  // Carga las opciones de todos los desplegables Odoo de toda la secuencia.
  React.useEffect(() => {
    const odooTypes = new Set<string>();
    for (const s of screens) {
      for (const w of s.widgets) {
        const type = w.dataSource?.type;
        if (w.widgetType === "DROPDOWN" && type && type !== "STATIC_LIST") odooTypes.add(type);
      }
    }
    odooTypes.forEach((type) => {
      if (optionsByType[type]) return;
      apiClient
        .get<DataSourceOption[]>("/api/stations/data-source-options", { params: { type } })
        .then(({ data }) => setOptionsByType((prev) => ({ ...prev, [type]: data })))
        .catch(() => setOptionsByType((prev) => ({ ...prev, [type]: [] })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

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

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/api/stations/${id}/records`, { values });
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
    else if (action === "SUBMIT") void submit();
  }

  if (!station) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }

  const isLast = current >= screens.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/stations")}>
            <IconArrowLeft className="mr-1 size-4" />
            {t("stations.runtime.back")}
          </Button>
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
                  className="no-scrollbar"
                  style={{
                    gridColumn: `${widget.layout.x + 1} / span ${widget.layout.w}`,
                    gridRow: `${widget.layout.y + 1} / span ${widget.layout.h}`,
                    height: "100%",
                    padding: 1,
                    overflowX: "visible",
                    overflowY: "auto",
                  }}
                >
                  <WidgetView
                    widget={widget}
                    value={widget.bindingKey ? values[widget.bindingKey] : undefined}
                    options={widget.dataSource?.type ? optionsByType[widget.dataSource.type] : undefined}
                    deviceName={deviceName(widget.sourceDeviceId)}
                    eventName={eventName(widget.sourceEventId)}
                    onChange={(v) => widget.bindingKey && setValue(widget.bindingKey, v)}
                    onButton={() => handleButton(widget)}
                    onResolvedOption={cacheResolvedOption}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navegacion de la secuencia */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
          <IconChevronLeft className="mr-1 size-4" />
          {t("stations.runtime.prev")}
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={submitting}>
            {t("stations.runtime.submit")}
          </Button>
        ) : (
          <Button onClick={() => goTo(current + 1)}>
            {t("stations.runtime.next")}
            <IconChevronRight className="ml-1 size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
