/**
 * i18next configuration for the SADO mobile app.
 *
 * The active language is detected from `expo-localization` on first
 * launch and persisted in AsyncStorage so user choice survives
 * restarts. We avoid `Intl` polyfills on Android by configuring i18next
 * with `compatibilityJSON: 'v4'`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import ru from "@/i18n/ru.json";
import uz from "@/i18n/uz.json";

export const SUPPORTED_LANGUAGES = ["uz", "ru"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "sado.mobile.language";

const resources: Resource = {
  uz: { translation: uz },
  ru: { translation: ru },
};

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

async function detectLanguage(): Promise<SupportedLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // Ignore storage errors and fall back to device locale.
  }
  const locales = Localization.getLocales();
  const first = locales[0]?.languageCode ?? null;
  if (isSupported(first)) return first;
  return "uz";
}

let initialized = false;

export async function initI18n(): Promise<void> {
  if (initialized) return;
  const language = await detectLanguage();
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "uz",
    compatibilityJSON: "v4",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialized = true;
}

export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Best-effort; the change still applies for the current session.
  }
  await i18n.changeLanguage(lang);
}

export function getCurrentLanguage(): SupportedLanguage {
  const current = i18n.language;
  return isSupported(current) ? current : "uz";
}

export default i18n;
