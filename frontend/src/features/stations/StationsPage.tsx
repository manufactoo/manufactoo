import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StationsListTab } from "./StationsListTab";
import { PlayersTab } from "./PlayersTab";
import { RoutesTab } from "./RoutesTab";

export function StationsPage() {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("stations.pageTitle")}</h1>

      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations">{t("stations.tabs.stations")}</TabsTrigger>
          <TabsTrigger value="routes">{t("stations.tabs.routes")}</TabsTrigger>
          <TabsTrigger value="players">{t("stations.tabs.players")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stations">
          <StationsListTab />
        </TabsContent>
        <TabsContent value="routes">
          <RoutesTab />
        </TabsContent>
        <TabsContent value="players">
          <PlayersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
