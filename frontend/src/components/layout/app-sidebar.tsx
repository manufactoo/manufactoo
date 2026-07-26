import * as React from "react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar";
import { coreNavGroups, appNavGroups } from "./data/nav-data";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { AppTitle } from "./app-title";
import { useAppsStore } from "@/features/apps/apps-store";

export function AppSidebar() {
  const apps = useAppsStore((s) => s.apps);
  const loaded = useAppsStore((s) => s.loaded);
  const fetchApps = useAppsStore((s) => s.fetch);

  React.useEffect(() => {
    if (!loaded) {
      void fetchApps();
    }
  }, [loaded, fetchApps]);

  const installedAppGroups = apps
    .filter((app) => app.installed)
    .map((app) => appNavGroups[app.key])
    .filter((group): group is NonNullable<typeof group> => Boolean(group));

  const groups = [...coreNavGroups, ...installedAppGroups];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <NavGroup key={group.titleKey} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
