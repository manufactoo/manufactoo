import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { WidgetCatalog } from "./types";

interface StationsCatalogState {
  catalog: WidgetCatalog | null;
  loaded: boolean;
  fetch: () => Promise<void>;
}

export const useStationsCatalogStore = create<StationsCatalogState>((set, get) => ({
  catalog: null,
  loaded: false,
  fetch: async () => {
    if (get().loaded) return;
    const { data } = await apiClient.get<WidgetCatalog>("/api/stations/widget-catalog");
    set({ catalog: data, loaded: true });
  },
}));
