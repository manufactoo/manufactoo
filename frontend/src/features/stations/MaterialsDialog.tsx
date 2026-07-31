import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MaterialLoad } from "./types";

/** Mensaje real del backend si viene en la respuesta (ver StationRuntimePage.submit, mismo patron); si no, un mensaje generico de respaldo. */
function errorMessage(err: unknown, fallback: string): string {
  const backendMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return backendMessage ?? fallback;
}

export interface MaterialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lotes/series activos ahora mismo en la estacion. */
  loads: MaterialLoad[];
  /** Posiciones fisicas definidas por el diseñador para esta estacion (Station.positions) -- nunca texto libre. */
  positions: string[];
  onLoad: (code: string, position?: string) => Promise<void>;
  onUnload: (loadId: number) => Promise<void>;
}

/**
 * Punto unico para cargar/quitar los lotes/series activos de una estacion,
 * abierto desde un widget BUTTON con accion "MATERIALS" (opcional). Los
 * lotes son un dato de la ESTACION, no de ningun widget ni "ranura" con
 * nombre elegido por nadie -- añadir uno solo pide el codigo a escanear
 * (siempre se valida contra series/lotes de Odoo, y el nombre sale del
 * producto asociado); pueden coexistir varios lotes del mismo producto (ver
 * conversacion 2026-07-30, tercera vuelta). La posicion es opcional y sale de
 * una lista fija (Station.positions, definida por el diseñador en el
 * Builder) -- si se elige una que ya tenia algo cargado, lo sustituye (ver
 * conversacion 2026-07-31).
 */
export function MaterialsDialog({ open, onOpenChange, loads, positions, onLoad, onUnload }: MaterialsDialogProps) {
  const { t, i18n } = useTranslation("dashboard");
  const [code, setCode] = React.useState("");
  const [position, setPosition] = React.useState("NONE");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<number | null>(null);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLoad(trimmed, position === "NONE" ? undefined : position);
      setCode("");
    } catch (err) {
      setError(errorMessage(err, t("stations.runtime.invalidMaterialCode", { code: trimmed })));
    } finally {
      setBusy(false);
    }
  }

  async function remove(loadId: number) {
    setRemoving(loadId);
    try {
      await onUnload(loadId);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("stations.runtime.materialsTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {loads.length === 0 && <p className="text-sm text-muted-foreground">{t("stations.runtime.materialsEmpty")}</p>}
          {loads.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {l.name}
                  {l.position && (
                    <span className="ml-1.5 rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {l.position}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.label} · {t("stations.runtime.loadedAt", { date: new Date(l.loadedAt).toLocaleString(i18n.language) })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-xs text-destructive"
                onClick={() => void remove(l.id)}
                disabled={removing === l.id}
              >
                {t("stations.runtime.unload")}
              </Button>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t pt-3">
          {positions.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">{t("stations.widget.materialPosition")}</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-8 text-sm">
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
          <div className="flex items-center gap-1.5">
            <Input
              className="h-8 text-sm"
              placeholder={t("stations.runtime.scanPlaceholder")}
              value={code}
              disabled={busy}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <Button size="sm" className="h-8" onClick={() => void submit()} disabled={busy || !code.trim()}>
              {t("stations.runtime.addMaterial")}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
