import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconChevronLeft, IconChevronRight, IconInfoCircle, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { GenealogyRecentPage, GenealogySearchResult, GenealogyStep } from "./types";

const RECENT_PAGE_SIZE = 20;

const LABEL_SUFFIX = "__label";

/** Todos los datos capturados en un paso, incluido el identificador de la propia unidad -- aqui no hay una clave que omitir, cualquier campo puede ser el dato relevante. */
function summarizeStepData(capturedData: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of Object.keys(capturedData)) {
    if (key.endsWith(LABEL_SUFFIX)) continue;
    const value = capturedData[key + LABEL_SUFFIX] ?? capturedData[key];
    if (value === null || value === undefined || value === "") continue;
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.join(" · ");
}

function StepsTable({ steps }: { steps: GenealogyStep[] }) {
  const { t, i18n } = useTranslation("dashboard");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("genealogy.station")}</TableHead>
          <TableHead>{t("genealogy.date")}</TableHead>
          <TableHead>{t("genealogy.data")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {steps.map((s) => (
          <TableRow key={s.recordId}>
            <TableCell className="whitespace-nowrap font-medium">{s.stationName}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {new Date(s.createdAt).toLocaleString(i18n.language)}
            </TableCell>
            <TableCell className="text-muted-foreground">{summarizeStepData(s.capturedData)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Ultimos registros de trazabilidad de toda la app, para explorar sin
 * conocer ya un codigo -- ver conversacion 2026-08-02. Cada fila con
 * identificador es clicable: busca ese codigo (mismo flujo que teclearlo a
 * mano). Paginado en el servidor (RECENT_PAGE_SIZE por pagina) en vez de
 * cargar todo de golpe -- una fabrica en marcha meses/años puede acumular
 * muchos registros, y "ver todos" se consigue pasando pagina, no de un tiron.
 */
function RecentSection({
  recent,
  loading,
  onPageChange,
  onPick,
}: {
  recent: GenealogyRecentPage | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onPick: (code: string) => void;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const totalPages = recent ? Math.max(1, Math.ceil(recent.totalItems / recent.size)) : 1;
  const page = recent?.page ?? 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("genealogy.recent.title")}</h2>
          {recent && <p className="text-xs text-muted-foreground">{t("genealogy.recent.total", { count: recent.totalItems })}</p>}
        </div>
        {!recent || loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : recent.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("genealogy.recent.empty")}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("genealogy.date")}</TableHead>
                  <TableHead>{t("genealogy.station")}</TableHead>
                  <TableHead>{t("genealogy.recent.identifier")}</TableHead>
                  <TableHead>{t("genealogy.data")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.items.map((s) => (
                  <TableRow
                    key={s.recordId}
                    className={s.identifierValue ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={() => s.identifierValue && onPick(s.identifierValue)}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString(i18n.language)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{s.stationName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.identifierValue ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{summarizeStepData(s.capturedData)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("genealogy.recent.page", { page: page + 1, totalPages })}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-7" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>
                  <IconChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={page + 1 >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                >
                  <IconChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResultSection({ titleKey, emptyKey, steps }: { titleKey: string; emptyKey: string; steps: GenealogyStep[] }) {
  const { t } = useTranslation("dashboard");
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 text-sm font-semibold">{t(titleKey)}</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
        ) : (
          <StepsTable steps={steps} />
        )}
      </CardContent>
    </Card>
  );
}

export function GenealogyPage() {
  const { t } = useTranslation("dashboard");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GenealogySearchResult | null>(null);
  const [recent, setRecent] = React.useState<GenealogyRecentPage | null>(null);
  const [recentLoading, setRecentLoading] = React.useState(false);

  const loadRecent = React.useCallback(async (page: number) => {
    setRecentLoading(true);
    try {
      const { data } = await apiClient.get<GenealogyRecentPage>("/api/genealogy/recent", { params: { page, size: RECENT_PAGE_SIZE } });
      setRecent(data);
    } catch {
      setRecent(null);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRecent(0);
  }, [loadRecent]);

  async function search(searchCode?: string) {
    const trimmed = (searchCode ?? code).trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.get<GenealogySearchResult>("/api/genealogy/search", { params: { code: trimmed } });
      setResult(data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("genealogy.error"));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function pickRecent(value: string) {
    setCode(value);
    void search(value);
  }

  function clearSearch() {
    setCode("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("genealogy.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("genealogy.subtitle")}</p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0" />
        <p>{t("genealogy.infoHint")}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-72">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("genealogy.searchPlaceholder")}
            value={code}
            disabled={busy}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
        </div>
        <Button size="sm" onClick={() => void search()} disabled={busy || !code.trim()}>
          {t("genealogy.search")}
        </Button>
        {result && (
          <Button size="sm" variant="ghost" onClick={clearSearch}>
            {t("genealogy.recent.back")}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result ? (
        <div className="space-y-4">
          <ResultSection titleKey="genealogy.asUnit.title" emptyKey="genealogy.asUnit.empty" steps={result.asUnit} />
          <ResultSection titleKey="genealogy.asMaterial.title" emptyKey="genealogy.asMaterial.empty" steps={result.asMaterial} />
        </div>
      ) : (
        <RecentSection recent={recent} loading={recentLoading} onPageChange={(p) => void loadRecent(p)} onPick={pickRecent} />
      )}
    </div>
  );
}
