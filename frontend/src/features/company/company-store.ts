import { create } from "zustand";
import { apiClient } from "@/lib/api-client";

export interface CompanyInfo {
  id: number;
  name: string;
  sector: string | null;
  hasLogo: boolean;
  logoUpdatedAt: number | null;
}

interface CompanyState {
  company: CompanyInfo | null;
  loaded: boolean;
  fetch: () => Promise<void>;
  setCompany: (company: CompanyInfo) => void;
}

export const useCompanyStore = create<CompanyState>((set) => ({
  company: null,
  loaded: false,
  fetch: async () => {
    try {
      const { data } = await apiClient.get<CompanyInfo>("/api/settings/company");
      set({ company: data, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setCompany: (company) => set({ company, loaded: true }),
}));
