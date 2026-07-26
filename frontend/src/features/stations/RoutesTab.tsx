import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconArrowDown, IconArrowUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { Station } from "./types";

interface RouteStep {
  id?: number;
  stationId: number;
  stationName?: string;
  orderIndex: number;
  name: string;
}

interface Route {
  id: number;
  name: string;
  description: string;
  productId: number | null;
  productName: string | null;
  identifierBindingKey: string;
  enabled: boolean;
  steps: RouteStep[];
}

interface Product {
  id: number;
  display_name: string;
}

let stepUidSeq = 0;
function stepUid() {
  stepUidSeq += 1;
  return stepUidSeq;
}

export function RoutesTab() {
  const { t } = useTranslation("dashboard");
  const [routes, setRoutes] = React.useState<Route[] | null>(null);
  const [stations, setStations] = React.useState<Station[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Route | null>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [productId, setProductId] = React.useState<string>("none");
  const [identifierBindingKey, setIdentifierBindingKey] = React.useState("serial");
  const [enabled, setEnabled] = React.useState(true);
  const [steps, setSteps] = React.useState<(RouteStep & { _uid: number })[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiClient.get<Route[]>("/api/routes").then(({ data }) => setRoutes(data)).catch(() => setRoutes([]));
    apiClient.get<Station[]>("/api/stations").then(({ data }) => setStations(data)).catch(() => setStations([]));
    apiClient
      .get<Product[]>("/api/master-data/products", { params: { limit: 200 } })
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setProductId("none");
    setIdentifierBindingKey("serial");
    setEnabled(true);
    setSteps([]);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(route: Route) {
    setEditing(route);
    setName(route.name);
    setDescription(route.description);
    setProductId(route.productId ? String(route.productId) : "none");
    setIdentifierBindingKey(route.identifierBindingKey);
    setEnabled(route.enabled);
    setSteps(route.steps.map((s) => ({ ...s, _uid: stepUid() })));
    setError(null);
    setDialogOpen(true);
  }

  function addStep() {
    if (stations.length === 0) return;
    setSteps((prev) => [
      ...prev,
      { _uid: stepUid(), stationId: stations[0].id, orderIndex: prev.length, name: stations[0].name },
    ]);
  }

  function updateStep(uid: number, patch: Partial<RouteStep>) {
    setSteps((prev) => prev.map((s) => (s._uid === uid ? { ...s, ...patch } : s)));
  }

  function removeStep(uid: number) {
    setSteps((prev) => prev.filter((s) => s._uid !== uid));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (steps.length === 0) {
      setError(t("stations.routes.needAtLeastOneStep"));
      return;
    }
    setSaving(true);
    try {
      const product = productId !== "none" ? products.find((p) => String(p.id) === productId) : null;
      const payload = {
        name,
        description,
        productId: product?.id ?? null,
        productName: product?.display_name ?? null,
        identifierBindingKey,
        enabled,
        steps: steps.map((s, i) => ({ id: s.id ?? null, stationId: s.stationId, orderIndex: i, name: s.name })),
      };
      if (editing) {
        await apiClient.put(`/api/routes/${editing.id}`, payload);
      } else {
        await apiClient.post("/api/routes", payload);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("stations.routes.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(route: Route) {
    if (!window.confirm(t("stations.routes.confirmDelete"))) return;
    await apiClient.delete(`/api/routes/${route.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("stations.routes.subtitle")}</p>
        <Button onClick={openCreate}>{t("stations.routes.add")}</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {routes === null ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stations.routes.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stations.routes.name")}</TableHead>
                  <TableHead>{t("stations.routes.product")}</TableHead>
                  <TableHead>{t("stations.routes.identifierKey")}</TableHead>
                  <TableHead>{t("stations.routes.steps")}</TableHead>
                  <TableHead>{t("stations.enabled")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium">{route.name}</TableCell>
                    <TableCell className="text-muted-foreground">{route.productName ?? "—"}</TableCell>
                    <TableCell>
                      <code className="text-xs">{route.identifierBindingKey}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {route.steps.map((s) => s.stationName ?? s.stationId).join(" → ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={route.enabled ? "success" : "outline"}>
                        {route.enabled ? t("stations.enabled") : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEdit(route)}>
                        {t("common:actions.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(route)}>
                        {t("stations.delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("stations.routes.editTitle") : t("stations.routes.addTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="route-name">{t("stations.routes.name")}</Label>
                <Input id="route-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("stations.routes.product")}</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("stations.routes.anyProduct")}</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-description">{t("stations.description")}</Label>
              <Textarea id="route-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="route-identifier">{t("stations.routes.identifierKey")}</Label>
              <Input
                id="route-identifier"
                value={identifierBindingKey}
                onChange={(e) => setIdentifierBindingKey(e.target.value)}
                placeholder="serial"
                required
              />
              <p className="text-[11px] text-muted-foreground">{t("stations.routes.identifierKeyHint")}</p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="route-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
              <Label htmlFor="route-enabled">{t("stations.enabled")}</Label>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label>{t("stations.routes.steps")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <IconPlus className="mr-1 size-4" />
                  {t("stations.routes.addStep")}
                </Button>
              </div>
              {steps.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("stations.routes.noSteps")}</p>
              )}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={step._uid} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                    <Select
                      value={String(step.stationId)}
                      onValueChange={(v) => updateStep(step._uid, { stationId: Number(v) })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stations.map((st) => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            {st.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-40"
                      value={step.name}
                      onChange={(e) => updateStep(step._uid, { name: e.target.value })}
                      placeholder={t("stations.routes.stepLabel")}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveStep(i, -1)} disabled={i === 0}>
                      <IconArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveStep(i, 1)}
                      disabled={i === steps.length - 1}
                    >
                      <IconArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeStep(step._uid)}>
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {t("stations.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
