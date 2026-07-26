import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/features/settings/GeneralSettings";
import { OdooConnectionSettings } from "@/features/settings/OdooConnectionSettings";
import { AppearanceSettings } from "@/features/settings/AppearanceSettings";

export function SettingsPage() {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("settings.title")}</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t("common:settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="odoo">{t("common:settings.tabs.odoo")}</TabsTrigger>
          <TabsTrigger value="appearance">{t("common:settings.tabs.appearance")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="odoo">
          <OdooConnectionSettings />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
