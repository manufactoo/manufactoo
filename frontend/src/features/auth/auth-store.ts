import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAppLanguage, SUPPORTED_LANGUAGES, type SupportedLanguageCode } from "@/i18n";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  language: string;
  theme: string;
  accentColor: string;
  hasAvatar: boolean;
  avatarUpdatedAt: number | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  logout: () => void;
}

// El idioma de la interfaz (i18next + localStorage, ver frontend/src/i18n/index.ts)
// no se enteraba solo de que este usuario tenia otro idioma guardado en su
// perfil: si entrabas desde un navegador/dispositivo nuevo, veias el idioma
// por defecto hasta cambiarlo a mano otra vez, y el backend (Accept-Language,
// ver api-client.ts) tampoco respondia en el idioma real del usuario. Se
// sincroniza aqui, en los DOS sitios donde el usuario "aparece": al iniciar
// sesion (setSession) y al restaurar una sesion ya guardada al recargar la
// pagina (onRehydrateStorage, que no pasa por ninguna accion del store).
function syncLanguage(user: AuthUser | null) {
  if (user && SUPPORTED_LANGUAGES.some((l) => l.code === user.language)) {
    setAppLanguage(user.language as SupportedLanguageCode);
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => {
        syncLanguage(user);
        set({ token, user });
      },
      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "manufactoo-auth",
      onRehydrateStorage: () => (state) => syncLanguage(state?.user ?? null),
    },
  ),
);
