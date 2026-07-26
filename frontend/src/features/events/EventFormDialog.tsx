import * as React from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { EVENT_DIRECTIONS, type MqttEvent } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MqttEvent | null;
  onSaved: () => void;
}

export function EventFormDialog({ open, onOpenChange, event, onSaved }: Props) {
  const { t } = useTranslation("dashboard");

  const [name, setName] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [direction, setDirection] = React.useState<string>("SUBSCRIBE");
  const [enabled, setEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (event) {
      setName(event.name);
      setTopic(event.topic);
      setDirection(event.direction);
      setEnabled(event.enabled);
    } else {
      setName("");
      setTopic("");
      setDirection("SUBSCRIBE");
      setEnabled(true);
    }
  }, [open, event]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { name, topic, direction, enabled };
      if (event) {
        await apiClient.put(`/api/events/${event.id}`, payload);
      } else {
        await apiClient.post("/api/events", payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("apps.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? t("events.edit") : t("events.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-name">{t("events.name")}</Label>
            <Input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="event-topic">{t("events.topic")}</Label>
            <Input
              id="event-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="planta/linea1/estacion2"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("events.direction")}</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`events.directions.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`events.directionHints.${direction}`)}</p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="event-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            <Label htmlFor="event-enabled">{t("devices.enabled")}</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {t("devices.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
