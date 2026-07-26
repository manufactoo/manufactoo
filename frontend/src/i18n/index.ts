import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import esCommon from "./locales/es/common.json";
import esWizard from "./locales/es/wizard.json";
import esDashboard from "./locales/es/dashboard.json";
import enCommon from "./locales/en/common.json";
import enWizard from "./locales/en/wizard.json";
import enDashboard from "./locales/en/dashboard.json";

export const SUPPORTED_LANGUAGES = [
  { code: "es", nativeName: "Espanol", flag: "ES" },
  { code: "en", nativeName: "English", flag: "GB" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n.use(initReactI18next).init({
  resources: {
    es: { common: esCommon, wizard: esWizard, dashboard: esDashboard },
    en: { common: enCommon, wizard: enWizard, dashboard: enDashboard },
  },
  lng: localStorage.getItem("manufactoo-language") ?? "es",
  fallbackLng: "es",
  ns: ["common", "wizard", "dashboard"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

/**
 * Cambia el idioma de toda la app. Se persiste en localStorage para el primer
 * render antes de login, y ademas el llamador debe persistirlo en backend
 * (PUT /api/users/me/preferences) para que sobreviva a un nuevo login desde
 * otro dispositivo.
 */
export function setAppLanguage(code: SupportedLanguageCode) {
  localStorage.setItem("manufactoo-language", code);
  void i18n.changeLanguage(code);
}

export default i18n;
