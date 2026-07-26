import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconDeviceDesktop } from "@tabler/icons-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import type { Player, Station } from "./types";

export function PlayersTab() {
  const { t, i18n } = useTranslation("dashboard");
  const [players, setPlayers] = React.useState<Player[] | null>(null);
  const [stations, setStations] = React.useState<Station[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Player | null>(null);
  const [name, setName] = React.useState("");
  const [stationId, setStationId] = React.useState<string>("none");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    apiClient.get<Player[]>("/api/players").then(({ data }) => setPlayers(data));
    apiClient.get<Station[]>("/api/stations").then(({ data }) => setStations(data)).catch(() => setStations([]));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function openAssign(player: Player) {
    setEditing(player);
    setName(player.name);
    setStationId(player.stationId ? String(player.stationId) : "none");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiClient.put(`/api/players/${editing.id}`, {
        stationId: stationId === "none" ? null : Number(stationId),
        name,
      });
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpair(player: Player) {
    if (!window.confirm(t("stations.players.confirmUnpair"))) return;
    await apiClient.delete(`/api/players/${player.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("stations.players.subtitle")}</p>

      <Card>
        <CardContent className="pt-6">
          {players === null ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("stations.players.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stations.players.name")}</TableHead>
                  <TableHead>{t("stations.players.station")}</TableHead>
                  <TableHead>{t("stations.players.status")}</TableHead>
                  <TableHead>{t("stations.players.version")}</TableHead>
                  <TableHead>{t("stations.players.lastSeen")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <IconDeviceDesktop className="size-4 text-muted-foreground" />
                        {player.name}
                      </div>
                      {player.hostname && <div className="text-xs text-muted-foreground">{player.hostname}</div>}
                    </TableCell>
                    <TableCell>{player.stationName ?? <span className="text-muted-foreground">{t("stations.players.noStation")}</span>}</TableCell>
                    <TableCell>
                      {player.pendingPairing ? (
                        <Badge variant="outline" className="gap-1">
                          {t("stations.players.pendingCode")} <span className="font-mono font-semibold">{player.pairingCode}</span>
                        </Badge>
                      ) : player.paired ? (
                        <Badge variant="success">{t("stations.players.paired")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("stations.players.expired")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{player.playerVersion ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.lastSeenAt ? new Date(player.lastSeenAt).toLocaleString(i18n.language) : "—"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => openAssign(player)}>
                        {t("stations.players.assign")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleUnpair(player)}>
                        {t("stations.players.unpair")}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("stations.players.assignTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">{t("stations.players.name")}</Label>
              <Input id="player-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("stations.players.station")}</Label>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("stations.players.noStation")}</SelectItem>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
