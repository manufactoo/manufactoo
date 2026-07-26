import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { EventFormDialog } from "./EventFormDialog";
import type { MqttEvent } from "./types";

export function EventsTab() {
  const { t } = useTranslation("dashboard");
  const [events, setEvents] = React.useState<MqttEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<MqttEvent | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    apiClient
      .get<MqttEvent[]>("/api/events")
      .then(({ data }) => setEvents(data))
      .catch((err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(message ?? t("apps.error"));
        setEvents(null);
      });
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingEvent(null);
    setDialogOpen(true);
  }

  function openEdit(event: MqttEvent) {
    setEditingEvent(event);
    setDialogOpen(true);
  }

  async function handleDelete(event: MqttEvent) {
    if (!window.confirm(t("events.confirmDelete"))) return;
    await apiClient.delete(`/api/events/${event.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("events.subtitle")}</p>
        {events !== null && <Button onClick={openCreate}>{t("events.add")}</Button>}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {events !== null && (
        <Card>
          <CardContent className="pt-6">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("events.empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("events.name")}</TableHead>
                    <TableHead>{t("events.topic")}</TableHead>
                    <TableHead>{t("events.direction")}</TableHead>
                    <TableHead>{t("devices.enabled")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.name}</TableCell>
                      <TableCell className="font-mono text-xs">{event.topic}</TableCell>
                      <TableCell>{t(`events.directions.${event.direction}`)}</TableCell>
                      <TableCell>
                        <Badge variant={event.enabled ? "success" : "outline"}>
                          {event.enabled ? t("devices.enabled") : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(event)}>
                          {t("common:actions.edit")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(event)}>
                          {t("devices.delete")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <EventFormDialog open={dialogOpen} onOpenChange={setDialogOpen} event={editingEvent} onSaved={load} />
    </div>
  );
}
