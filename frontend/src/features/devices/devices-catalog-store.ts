import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { DeviceCatalog } from "./types";

interface DevicesCatalogState {
  catalog: DeviceCatalog | null;
  loaded: boolean;
  fetch: () => Promise<void>;
}

export const useDevicesCatalogStore = create<DevicesCatalogState>((set, get) => ({
  catalog: null,
  loaded: false,
  fetch: async () => {
    if (get().loaded) return;
    const { data } = await apiClient.get<DeviceCatalog>("/api/devices/catalog");
    set({ catalog: data, loaded: true });
  },
}));
