import { create } from "zustand";
import { apiClient } from "@/lib/api-client";

export interface WizardExternalOdoo {
  host: string;
  port: number;
  database: string;
  username: string;
  apiKeyOrPassword: string;
}

export interface WizardAdmin {
  fullName: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface OdooTestResult {
  success: boolean;
  odooVersion: string | null;
  errorMessage: string | null;
}

export interface WizardState {
  currentStep: number;
  hydrated: boolean;

  language: string;
  external: WizardExternalOdoo;
  odooTestResult: OdooTestResult | null;
  companyName: string;
  companySector: string;
  admin: WizardAdmin;

  goTo: (step: number) => void;
  next: () => void;
  back: () => void;
  patch: (partial: Partial<WizardState>) => void;
  patchExternal: (partial: Partial<WizardExternalOdoo>) => void;
  patchAdmin: (partial: Partial<WizardAdmin>) => void;
  setOdooTestResult: (result: OdooTestResult | null) => void;

  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

const DEFAULT_EXTERNAL: WizardExternalOdoo = { host: "", port: 8069, database: "", username: "", apiKeyOrPassword: "" };
const DEFAULT_ADMIN: WizardAdmin = { fullName: "", email: "", password: "", passwordConfirm: "" };

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  hydrated: false,

  language: "es",
  external: DEFAULT_EXTERNAL,
  odooTestResult: null,
  companyName: "",
  companySector: "",
  admin: DEFAULT_ADMIN,

  goTo: (step) => set({ currentStep: step }),
  next: () => set((s) => ({ currentStep: Math.min(5, s.currentStep + 1) })),
  back: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) })),
  patch: (partial) => set(partial),
  patchExternal: (partial) => set((s) => ({ external: { ...s.external, ...partial } })),
  patchAdmin: (partial) => set((s) => ({ admin: { ...s.admin, ...partial } })),
  setOdooTestResult: (result) => set({ odooTestResult: result }),

  hydrate: async () => {
    try {
      const { data } = await apiClient.get("/api/wizard/state");
      const payload = data.payload ?? {};
      set({
        currentStep: data.currentStep ?? 1,
        language: payload.language ?? get().language,
        external: { ...DEFAULT_EXTERNAL, ...(payload.external ?? {}) },
        companyName: payload.companyName ?? "",
        companySector: payload.companySector ?? "",
        admin: { ...DEFAULT_ADMIN, fullName: payload.adminFullName ?? "", email: payload.adminEmail ?? "" },
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  /**
   * Persiste el progreso parcial. Nunca envia contrasenas ni API keys: el
   * backend las descartaria igualmente, pero se evita mandarlas por red sin
   * necesidad. Si el usuario cierra el navegador, al volver debera
   * retipear esos campos sensibles (paso 2 y 4).
   *
   * Nunca lanza: un fallo de red al guardar el progreso no debe bloquear
   * la navegacion local entre pasos (solo se pierde la posibilidad de
   * reanudar exactamente ahi si tambien se cierra el navegador).
   */
  persist: async () => {
    const s = get();
    try {
      await apiClient.post("/api/wizard/state", {
        currentStep: s.currentStep,
        payload: {
          language: s.language,
          external: { host: s.external.host, port: s.external.port, database: s.external.database, username: s.external.username },
          companyName: s.companyName,
          companySector: s.companySector,
          adminFullName: s.admin.fullName,
          adminEmail: s.admin.email,
        },
      });
    } catch {
      // Se ignora: ver comentario arriba.
    }
  },
}));
