import { defaultTranslations, TranslationKeys, TranslationParams } from "./schema";

class I18nManager {
  private currentLocale: string = "en";
  private translations: Record<string, string> = defaultTranslations;

  async loadLocale(locale: string): Promise<void> {
    if (locale === "en") {
      this.translations = defaultTranslations;
      this.currentLocale = "en";
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