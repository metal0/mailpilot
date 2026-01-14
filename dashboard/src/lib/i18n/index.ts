import { writable, derived, get } from "svelte/store";
import en from "./translations/en";

export type TranslationKey = keyof typeof en;
export type Translations = Record<string, string>;

const translations: Record<string, Translations> = {
  en,
};

export const locale = writable<string>("en");
export const locales = Object.keys(translations);

function getNestedValue(obj: Translations, path: string): string | undefined {
  // First try direct key lookup (flat keys like "settings.sections.global")
  if (path in obj) {
    return obj[path];
  }
  // Fall back to nested traversal for backwards compatibility
  return path.split(".").reduce((acc: Translations | string | undefined, part) => {
    if (acc && typeof acc === "object") {
      return acc[part];
    }
    return undefined;
  }, obj) as string | undefined;
}

export const t = derived(locale, ($locale) => {
  return (key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(translations[$locale] || translations.en, key);

    if (!translation) {
      console.warn(`Missing translation: ${key}`);
      return key;
    }

    if (!params) {
      return translation;
    }

    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
      translation
    );
  };
});

export function setLocale(newLocale: string): void {
  if (translations[newLocale]) {
    locale.set(newLocale);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mailpilot-locale", newLocale);
    }
  }
}

export function initLocale(): void {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("mailpilot-locale");
    if (saved && translations[saved]) {
      locale.set(saved);
    }
  }
}

export function translate(key: string, params?: Record<string, string | number>): string {
  const $t = get(t);
  return $t(key, params);
}
