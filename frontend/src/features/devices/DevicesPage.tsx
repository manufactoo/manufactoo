import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevicesTab } from "./DevicesTab";
import { EventsTab } from "@/features/events/EventsTab";

export function DevicesPage() {
  const { t } = useTranslation("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("devices.pageTitle")}</h1>

      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">{t("devices.title")}</TabsTrigger>
          <TabsTrigger value="events">{t("events.title")}</TabsTrigger>
        </TabsList>
        <TabsContent value="devices">
          <DevicesTab />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
