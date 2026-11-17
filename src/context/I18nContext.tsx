import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_UI_LANGUAGE,
  I18N_STORAGE_KEY,
  formatDateLocalized,
  formatPriceLocalized,
  getDirectionForLanguage,
  getLanguageMeta,
  getLocalizedCity,
  getTranslations,
  normalizeUiLanguage,
  type LanguageMeta,
  type TranslationBundle,
  type UiLanguage,
} from '../i18n';
import type { CurrencyCode } from '../types/estora';

interface I18nContextValue {
  language: UiLanguage;
  setLanguage: (next: UiLanguage) => void;
  meta: LanguageMeta;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  t: TranslationBundle;
  formatPrice: (priceUsd: number, currency?: CurrencyCode | string, dealType?: string) => string;
  formatDate: (dateInput: string | number | Date, withTime?: boolean) => string;
  localizeCity: (cityKey: string) => string;
}

const defaultBundle = getTranslations(DEFAULT_UI_LANGUAGE);

const I18nContext = createContext<I18nContextValue>({
  language: DEFAULT_UI_LANGUAGE,
  setLanguage: () => {},
  meta: getLanguageMeta(DEFAULT_UI_LANGUAGE),
  dir: 'ltr',
  isRtl: false,
  t: defaultBundle,
  formatPrice: (priceUsd, currency, dealType) =>
    formatPriceLocalized(priceUsd, currency, dealType, DEFAULT_UI_LANGUAGE),
  formatDate: (dateInput, withTime) =>
    formatDateLocalized(dateInput, DEFAULT_UI_LANGUAGE, withTime),
  localizeCity: (cityKey) => getLocalizedCity(cityKey, DEFAULT_UI_LANGUAGE),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(() => {
    if (typeof window === 'undefined') return DEFAULT_UI_LANGUAGE;
    try {
      const stored = window.localStorage.getItem(I18N_STORAGE_KEY);
      if (stored) {
        return normalizeUiLanguage(stored, DEFAULT_UI_LANGUAGE);
      }
      if (window.navigator?.language) {
        return normalizeUiLanguage(window.navigator.language, DEFAULT_UI_LANGUAGE);
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_UI_LANGUAGE;
  });

  const meta = getLanguageMeta(language);
  const dir = getDirectionForLanguage(language);
  const t = getTranslations(language);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
    document.title = t.meta.pageTitle;

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', t.meta.pageDescription);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', t.meta.pageTitle);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', t.meta.pageDescription);

    try {
      window.localStorage.setItem(I18N_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  }, [language, dir, t.meta.pageTitle, t.meta.pageDescription]);

  const setLanguage = (next: UiLanguage) => {
    setLanguageState(normalizeUiLanguage(next, DEFAULT_UI_LANGUAGE));
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        meta,
        dir,
        isRtl: dir === 'rtl',
        t,
        formatPrice: (priceUsd, currency, dealType) =>
          formatPriceLocalized(priceUsd, currency, dealType, language),
        formatDate: (dateInput, withTime) => formatDateLocalized(dateInput, language, withTime),
        localizeCity: (cityKey) => getLocalizedCity(cityKey, language),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
