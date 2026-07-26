import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { useDevicesCatalogStore } from "./devices-catalog-store";
import { DEVICE_DIRECTIONS, type Device, type DeviceFieldDef } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: Device | null;
  onSaved: () => void;
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: DeviceFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("dashboard");
  const label = t(field.labelKey, { defaultValue: field.key }) + (field.required ? " *" : "");

  if (field.type === "SELECT") {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {t(`devices.fieldOptions.${field.key}.${opt}`, { defaultValue: opt })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.key}`}>{label}</Label>
      <Input
        id={`field-${field.key}`}
        type={field.type === "NUMBER" ? "number" : "text"}
        placeholder={field.placeholder ?? undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function DeviceFormDialog({ open, onOpenChange, device, onSaved }: Props) {
  const { t } = useTranslation("dashboard");
  const catalog = useDevicesCatalogStore((s) => s.catalog);
  const fetchCatalog = useDevicesCatalogStore((s) => s.fetch);

  const [name, setName] = React.useState("");
  const [direction, setDirection] = React.useState<string>("");
  const [category, setCategory] = React.useState<string>("");
  const [transport, setTransport] = React.useState<string>("");
  const [enabled, setEnabled] = React.useState(true);
  const [connection, setConnection] = React.useState<Record<string, string>>({});
  const [settings, setSettings] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (device) {
      setName(device.name);
      setDirection(device.direction);
      setCategory(device.category);
      setTransport(device.transport);
      setEnabled(device.enabled);
      setConnection(Object.fromEntries(Object.entries(device.connection).map(([k, v]) => [k, String(v ?? "")])));
      setSettings(Object.fromEntries(Object.entries(device.settings).map(([k, v]) => [k, String(v ?? "")])));
    } else {
      setName("");
      setDirection("");
      setCategory("");
      setTransport("");
      setEnabled(true);
      setConnection({});
      setSettings({});
    }
  }, [open, device]);

  const categoriesForDirection = React.useMemo(
    () => catalog?.categories.filter((c) => c.directions.includes(direction)) ?? [],
    [catalog, direction],
  );
  const selectedCategory = catalog?.categories.find((c) => c.category === category) ?? null;
  const transportsForCategory = selectedCategory?.transports ?? [];
  const selectedTransport = transportsForCategory.find((t2) => t2.transport === transport) ?? null;

  function handleDirectionChange(value: string) {
    setDirection(value);
    setCategory("");
    setTransport("");
    setConnection({});
    setSettings({});
  }

  function handleCategoryChange(value: string) {
    setCategory(value);
    setTransport("");
    setConnection({});
    setSettings({});
  }

  function handleTransportChange(value: string) {
    setTransport(value);
    setConnection({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { name, category, direction, transport, enabled, connection, settings };
      if (device) {
        await apiClient.put(`/api/devices/${device.id}`, payload);
      } else {
        await apiClient.post("/api/devices", payload);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{device ? t("devices.edit") : t("devices.add")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device-name">{t("devices.name")}</Label>
            <Input id="device-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {/* Paso 1: direccion, siempre primero */}
          <div className="space-y-2">
            <Label>{t("devices.direction")}</Label>
            <Select value={direction} onValueChange={handleDirectionChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("devices.chooseDirection")} />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_DIRECTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {t(`devices.directions.${d}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paso 2: categoria, filtrada por la direccion elegida */}
          {direction && (
            <div className="space-y-2">
              <Label>{t("devices.category")}</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("devices.chooseCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesForDirection.map((c) => (
                    <SelectItem key={c.category} value={c.category}>
                      {t(`devices.categories.${c.category}`, { defaultValue: c.category })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Paso 3: transporte, filtrado por la categoria elegida */}
          {category && (
            <div className="space-y-2">
              <Label>{t("devices.transport")}</Label>
              <Select value={transport} onValueChange={handleTransportChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("devices.chooseTransport")} />
                </SelectTrigger>
                <SelectContent>
                  {transportsForCategory.map((tr) => (
                    <SelectItem key={tr.transport} value={tr.transport}>
                      {t(`devices.transports.${tr.transport}`, { defaultValue: tr.transport })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Paso 4: campos de conexion segun el transporte */}
          {selectedTransport && selectedTransport.connectionFields.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">{t("devices.connectionSection")}</p>
              {selectedTransport.connectionFields.map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={connection[field.key] ?? ""}
                  onChange={(v) => setConnection((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}
            </>
          )}

          {/* Paso 5: configuracion propia de la categoria, si tiene */}
          {selectedCategory && selectedCategory.settingsFields.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">{t("devices.settingsSection")}</p>
              {selectedCategory.settingsFields.map((field) => (
                <DynamicField
                  key={field.key}
                  field={field}
                  value={settings[field.key] ?? ""}
                  onChange={(v) => setSettings((prev) => ({ ...prev, [field.key]: v }))}
                />
              ))}
            </>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="device-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            <Label htmlFor="device-enabled">{t("devices.enabled")}</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving || !transport}>
              {t("devices.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
