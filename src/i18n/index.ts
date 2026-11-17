import type { CurrencyCode } from '../types/estora';
import { LANGUAGE_LIST, type LanguageMeta, type TranslationBundle, type UiLanguage } from './types';
import { ar } from './locales/ar';
import { bn } from './locales/bn';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { uz } from './locales/uz';
import { zh } from './locales/zh';

export { LANGUAGE_LIST };
export type { LanguageMeta, TranslationBundle, UiLanguage };

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'ru';
export const I18N_STORAGE_KEY = 'estora_lang_v1';

const USD_TO_UZS_RATE = 12800;

export const TRANSLATIONS: Record<UiLanguage, TranslationBundle> = {
  en,
  zh,
  hi,
  es,
  ar,
  fr,
  pt,
  bn,
  ru,
  uz,
};

const VALID_LANGUAGES = new Set<UiLanguage>(LANGUAGE_LIST.map((item) => item.code));

export function isValidUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && VALID_LANGUAGES.has(value as UiLanguage);
}

export function normalizeUiLanguage(raw: unknown, fallback: UiLanguage = DEFAULT_UI_LANGUAGE): UiLanguage {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (isValidUiLanguage(normalized)) {
    return normalized;
  }
  return fallback;
}

export function getLanguageMeta(lang: UiLanguage): LanguageMeta {
  return LANGUAGE_LIST.find((item) => item.code === lang) ?? LANGUAGE_LIST[8]; // 'ru' fallback
}

export function getDirectionForLanguage(lang: UiLanguage): 'ltr' | 'rtl' {
  return getLanguageMeta(lang).dir;
}

export function getTranslations(lang: UiLanguage): TranslationBundle {
  return TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_UI_LANGUAGE];
}

export function getLocalizedCity(cityKey: string, lang: UiLanguage): string {
  const bundle = getTranslations(lang);
  return bundle.cities[cityKey] ?? cityKey;
}

export function formatPriceLocalized(
  priceUsd: number,
  currency: CurrencyCode | string = 'USD',
  dealType: string = 'sale',
  lang: UiLanguage = DEFAULT_UI_LANGUAGE
): string {
  const bundle = getTranslations(lang);
  const meta = getLanguageMeta(lang);
  const suffix = dealType === 'rent' ? ` ${bundle.common.perMonth}` : '';

  if (currency === 'UZS') {
    const uzs = Math.round(priceUsd * USD_TO_UZS_RATE);
    const formatted = uzs.toLocaleString(meta.intlLocale);
    return `${formatted} ${bundle.common.uzsCurrencySuffix}${suffix}`;
  }

  const usdFormatted = priceUsd.toLocaleString('en-US').replace(/,/g, ' ');
  return `$${usdFormatted}${suffix}`;
}

export function formatDateLocalized(
  dateInput: string | number | Date,
  lang: UiLanguage = DEFAULT_UI_LANGUAGE,
  withTime: boolean = false
): string {
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return typeof dateInput === 'string' ? dateInput : '';
  }

  const meta = getLanguageMeta(lang);
  try {
    return new Intl.DateTimeFormat(meta.intlLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(parsed);
  } catch {
    return parsed.toLocaleDateString();
  }
}
