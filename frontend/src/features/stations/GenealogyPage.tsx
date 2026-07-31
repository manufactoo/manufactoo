import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconInfoCircle, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { GenealogySearchResult, GenealogyStep } from "./types";

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

  async function search() {
    const trimmed = code.trim();
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-4">
          <ResultSection titleKey="genealogy.asUnit.title" emptyKey="genealogy.asUnit.empty" steps={result.asUnit} />
          <ResultSection titleKey="genealogy.asMaterial.title" emptyKey="genealogy.asMaterial.empty" steps={result.asMaterial} />
        </div>
      )}
    </div>
  );
}
