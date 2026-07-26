import { create } from "zustand";
import { apiClient } from "@/lib/api-client";

export interface AppInfo {
  key: string;
  nameKey: string;
  descriptionKey: string;
  version: string;
  installed: boolean;
  installedAt: string | null;
  dependsOn: string[];
  missingDependencies: string[];
}

interface AppsState {
  apps: AppInfo[];
  loaded: boolean;
  fetch: () => Promise<void>;
  install: (key: string) => Promise<void>;
  uninstall: (key: string) => Promise<void>;
  isInstalled: (key: string) => boolean;
}

export const useAppsStore = create<AppsState>((set, get) => ({
  apps: [],
  loaded: false,
  fetch: async () => {
    const { data } = await apiClient.get<AppInfo[]>("/api/apps");
    set({ apps: data, loaded: true });
  },
  install: async (key) => {
    const { data } = await apiClient.post<AppInfo>(`/api/apps/${key}/install`);
    set((state) => ({ apps: state.apps.map((a) => (a.key === key ? data : a)) }));
  },
  uninstall: async (key) => {
    const { data } = await apiClient.post<AppInfo>(`/api/apps/${key}/uninstall`);
    set((state) => ({ apps: state.apps.map((a) => (a.key === key ? data : a)) }));
  },
  isInstalled: (key) => get().apps.find((a) => a.key === key)?.installed ?? false,
}));
