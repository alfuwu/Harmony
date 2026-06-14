import { useEffect, useState } from "react";
import { defaultTranslations, TranslationKeys, TranslationParams } from "./Schema";

type LocaleListener = () => void;

class I18nManager {
  private currentLocale: string = "en";
  private translations: Record<string, string> = defaultTranslations;
  private listeners = new Set<LocaleListener>();

  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners)
      listener();
  }

  async loadLocale(locale: string): Promise<void> {
    if (locale === "en") {
      this.translations = defaultTranslations;
      this.currentLocale = "en";
      this.notify();
      return;
    }

    try {
      const module = await import(`./locales/${locale}.ts`);
      this.translations = module.default;
      this.currentLocale = locale;
    } catch (error) {
      console.error(`Failed to load locale: ${locale}, falling back to English.`, error);
      this.translations = defaultTranslations;
      this.currentLocale = "en";
    }
    this.notify();
  }

  getCurrentLocale(): string {
    return this.currentLocale;
  }

  t(key: TranslationKeys, params?: TranslationParams): string {
    const template = this.translations[key] || defaultTranslations[key] || key;

    if (!params)
      return template;

    return Object.entries(params).reduce((str, [paramKey, value]) => {
      return str.replace(`{${paramKey}}`, String(value));
    }, template);
  }
}

export const i18n = new I18nManager();
export const t = (key: TranslationKeys, params?: TranslationParams) => i18n.t(key, params);

export function useLocale(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => i18n.subscribe(() => setTick(n => n + 1)), []);
  return tick;
}