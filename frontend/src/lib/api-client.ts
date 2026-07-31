import axios from "axios";
import { useAuthStore } from "@/features/auth/auth-store";
import i18n from "@/i18n";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  // Idioma de los mensajes de error del backend (ver com.manufactoo.common.Messages).
  config.headers["Accept-Language"] = i18n.language;
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Dentro del Manufactoo Player no hay ningun usuario logueado (sin JWT): el
  // runtime de la estacion se autentica con el token de dispositivo del Player.
  // Si por lo que sea AMBOS existieran (p. ej. probando en un navegador normal
  // con window.manufactoo simulado), el JWT de usuario tiene prioridad.
  const playerToken = window.manufactoo?.playerToken;
  if (!token && playerToken) {
    config.headers["X-Player-Token"] = playerToken;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
