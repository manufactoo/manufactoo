import { IconApps, IconBuildingFactory2, IconCpu, IconDatabase, IconLayoutDashboard, IconSettings, IconUserCircle } from "@tabler/icons-react";
import { type NavGroup } from "../types";

/** Nucleo del menu: siempre visible, no depende de ninguna app instalada. */
export const coreNavGroups: NavGroup[] = [
  {
    titleKey: "nav.groupGeneral",
    items: [
      { titleKey: "nav.dashboard", url: "/dashboard", icon: IconLayoutDashboard },
      { titleKey: "nav.masterData", url: "/dashboard/master-data", icon: IconDatabase },
      { titleKey: "nav.apps", url: "/dashboard/apps", icon: IconApps },
      { titleKey: "nav.settings", url: "/dashboard/settings", icon: IconSettings },
      { titleKey: "nav.profile", url: "/dashboard/profile", icon: IconUserCircle },
    ],
  },
];

/**
 * Grupos de menu aportados por cada app, solo visibles si esta instalada.
 * Cuando una app crece (ej. Estaciones y Rutas sobre traceability_genealogy),
 * se añaden items aqui, no se crea una app nueva.
 */
export const appNavGroups: Record<string, NavGroup> = {
  traceability_genealogy: {
    titleKey: "nav.groupTraceability",
    items: [
      { titleKey: "nav.devices", url: "/dashboard/devices", icon: IconCpu },
      { titleKey: "nav.stations", url: "/dashboard/stations", icon: IconBuildingFactory2 },
    ],
  },
};
