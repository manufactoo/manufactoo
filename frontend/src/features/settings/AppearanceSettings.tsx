import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCENT_COLORS, useTheme, type AccentColor, type ThemeMode } from "@/components/layout/theme-provider";
import { setAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/i18n";
import { useAuthStore } from "@/features/auth/auth-store";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { t, i18n } = useTranslation("dashboard");
  const { theme, accentColor, setTheme, setAccentColor } = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  async function handleLanguageChange(code: SupportedLanguageCode) {
    setAppLanguage(code);
    if (user) {
      updateUser({ language: code });
      await apiClient.put("/api/users/me/preferences", { language: code, theme, accentColor });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.appearance.title")}</CardTitle>
      </CardHeader>
      <CardContent className="max-w-sm space-y-6">
        <div className="space-y-2">
          <Label>{t("common:language.label")}</Label>
          <Select value={i18n.language} onValueChange={(v) => handleLanguageChange(v as SupportedLanguageCode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("common:theme.light")} / {t("common:theme.dark")}</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("common:theme.light")}</SelectItem>
              <SelectItem value="dark">{t("common:theme.dark")}</SelectItem>
              <SelectItem value="system">{t("common:theme.system")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("common:theme.accentColor")}</Label>
          <div className="flex gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAccentColor(color as AccentColor)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2",
                  color !== "default" && `theme-${color}`,
                  accentColor === color ? "border-foreground" : "border-transparent",
                )}
              >
                <span className="block size-5 rounded-full bg-primary" />
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
