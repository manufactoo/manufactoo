import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { useCompanyLogoUrl } from "@/lib/use-company-logo-url";
import { useCompanyStore, type CompanyInfo } from "@/features/company/company-store";
import { UpdateCheckCard } from "@/features/settings/UpdateCheckCard";
import { SECTORS } from "@/lib/sectors";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

function LogoEditor() {
  const { t } = useTranslation("dashboard");
  const company = useCompanyStore((s) => s.company);
  const setCompany = useCompanyStore((s) => s.setCompany);
  const logoUrl = useCompanyLogoUrl(company?.hasLogo ?? false, company?.logoUpdatedAt ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError(t("settings.general.logo.errorType"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(t("settings.general.logo.errorSize"));
      return;
    }

    setBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<CompanyInfo>("/api/settings/company/logo", formData, {
        headers: { "Content-Type": undefined },
      });
      setCompany(data);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? t("settings.general.logo.errorType"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("remove");
    try {
      const { data } = await apiClient.delete<CompanyInfo>("/api/settings/company/logo");
      setCompany(data);
    } catch {
      setError(t("settings.general.logo.errorType"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Label>{t("settings.general.logo.title")}</Label>
      <div className="flex items-center gap-4">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {logoUrl ? (
            <img src={logoUrl} alt={company?.name} className="size-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">{t("settings.general.logo.none")}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInputRef.current?.click()}>
              {busy === "upload" ? t("settings.general.logo.uploading") : t("settings.general.logo.upload")}
            </Button>
            {company?.hasLogo && (
              <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={handleRemove}>
                {busy === "remove" ? t("settings.general.logo.removing") : t("settings.general.logo.remove")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.general.logo.hint")}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function GeneralSettings() {
  const { t } = useTranslation("dashboard");
  const company = useCompanyStore((s) => s.company);
  const loaded = useCompanyStore((s) => s.loaded);
  const fetchCompany = useCompanyStore((s) => s.fetch);
  const setCompany = useCompanyStore((s) => s.setCompany);

  const [name, setName] = React.useState("");
  const [sector, setSector] = React.useState<string | null>("");
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!loaded) void fetchCompany();
  }, [loaded, fetchCompany]);

  React.useEffect(() => {
    if (company) {
      setName(company.name);
      setSector(company.sector ?? "");
    }
  }, [company]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const { data } = await apiClient.put<CompanyInfo>("/api/settings/company", { name, sector: sector || null });
      setCompany(data);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general.title")}</CardTitle>
        </CardHeader>
        <CardContent className="max-w-md space-y-6">
          <LogoEditor />

          <div className="space-y-2">
            <Label htmlFor="company-name">{t("settings.general.companyName")}</Label>
            <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.general.sector")}</Label>
            <Select value={sector ?? ""} onValueChange={(v) => setSector(v)}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {SECTORS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`common:sectors.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {t("common:actions.save")}
            </Button>
            {saved && <span className="text-sm text-emerald-600">{t("settings.general.saved")}</span>}
          </div>
        </CardContent>
      </Card>

      <UpdateCheckCard />
    </div>
  );
}
