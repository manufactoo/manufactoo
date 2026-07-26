import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconMoon, IconSun, IconWorld } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ACCENT_COLORS, useTheme, type AccentColor, type ThemeMode } from "@/components/layout/theme-provider";
import { setAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/i18n";
import { useAuthStore } from "@/features/auth/auth-store";
import { apiClient } from "@/lib/api-client";

type HeaderProps = React.HTMLAttributes<HTMLElement> & { fixed?: boolean };

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const onScroll = () => setOffset(document.body.scrollTop || document.documentElement.scrollTop);
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "z-50 h-14",
        fixed && "header-fixed peer/header sticky top-0 w-[inherit]",
        offset > 10 && fixed ? "shadow" : "shadow-none",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "relative flex h-full items-center justify-between gap-3 px-4",
          offset > 10 && fixed && "after:absolute after:inset-0 after:-z-10 after:bg-background/20 after:backdrop-blur-lg",
        )}
      >
        <div className="flex items-center gap-3">
          <SidebarTrigger variant="outline" className="max-md:scale-125" />
          <Separator orientation="vertical" className="h-6" />
        </div>
        <div className="flex items-center gap-1">{children}</div>
      </div>
    </header>
  );
}

export function HeaderControls() {
  const { t, i18n } = useTranslation("common");
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("language.label")}>
            <IconWorld className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={i18n.language} onValueChange={(v) => handleLanguageChange(v as SupportedLanguageCode)}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <DropdownMenuRadioItem key={lang.code} value={lang.code}>
                {lang.nativeName}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="theme">
            {theme === "dark" ? <IconMoon className="size-4" /> : <IconSun className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {t("theme.light")} / {t("theme.dark")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeMode)}>
            <DropdownMenuRadioItem value="light">{t("theme.light")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">{t("theme.dark")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">{t("theme.system")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("theme.accentColor")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={accentColor} onValueChange={(v) => setAccentColor(v as AccentColor)}>
            {ACCENT_COLORS.map((color) => (
              <DropdownMenuRadioItem key={color} value={color} className="capitalize">
                <span className={`mr-2 inline-block size-3 rounded-full border ${color !== "default" ? `theme-${color}` : ""}`}>
                  <span className="block size-full rounded-full bg-primary" />
                </span>
                {color}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
