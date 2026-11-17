import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LANGUAGE_LIST,
  TRANSLATIONS,
  formatDateLocalized,
  formatPriceLocalized,
  getDirectionForLanguage,
  getLocalizedCity,
  normalizeUiLanguage,
} from './index';
import { normalizeThemeMode, resolveThemeMode } from '../context/ThemeContext';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) {
    return [`${prefix}[${obj.length}]`];
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([key, val]) => collectKeys(val, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

test('all 10 required languages are registered with unique codes and matching schemas', () => {
  const expectedCodes = ['en', 'zh', 'hi', 'es', 'ar', 'fr', 'pt', 'bn', 'ru', 'uz'];
  assert.equal(LANGUAGE_LIST.length, 10);
  assert.deepEqual(
    LANGUAGE_LIST.map((item) => item.code),
    expectedCodes
  );

  const baselineKeys = collectKeys(TRANSLATIONS.ru);
  for (const code of expectedCodes) {
    const bundle = TRANSLATIONS[code as keyof typeof TRANSLATIONS];
    assert.ok(bundle, `Missing translation bundle for ${code}`);
    const keys = collectKeys(bundle);
    assert.deepEqual(keys, baselineKeys, `Key mismatch detected in ${code} translation bundle`);
  }
});

test('Arabic uses RTL layout direction while all other 9 languages use LTR', () => {
  assert.equal(getDirectionForLanguage('ar'), 'rtl');
  for (const lang of ['en', 'zh', 'hi', 'es', 'fr', 'pt', 'bn', 'ru', 'uz'] as const) {
    assert.equal(getDirectionForLanguage(lang), 'ltr');
  }
});

test('normalizeUiLanguage handles BCP-47 tags and falls back safely', () => {
  assert.equal(normalizeUiLanguage('ar-SA'), 'ar');
  assert.equal(normalizeUiLanguage('zh-CN'), 'zh');
  assert.equal(normalizeUiLanguage('PT-BR'), 'pt');
  assert.equal(normalizeUiLanguage('uz-Latn-UZ'), 'uz');
  assert.equal(normalizeUiLanguage('xx-unknown', 'en'), 'en');
  assert.equal(normalizeUiLanguage(null), 'ru');
});

test('formatPriceLocalized formats USD and UZS currencies with localized suffixes across languages', () => {
  const enRent = formatPriceLocalized(2500, 'USD', 'rent', 'en');
  assert.match(enRent, /\$2 500 \/ mo/);

  const arUzs = formatPriceLocalized(100, 'UZS', 'rent', 'ar');
  assert.match(arUzs, /سوم/);
  assert.match(arUzs, /شهرياً/);

  const uzSale = formatPriceLocalized(100, 'UZS', 'sale', 'uz');
  assert.match(uzSale, /so‘m/);
});

test('formatDateLocalized formats dates across scripts and handles invalid dates gracefully', () => {
  const sampleDate = '2026-06-15T12:00:00.000Z';
  for (const item of LANGUAGE_LIST) {
    const formatted = formatDateLocalized(sampleDate, item.code);
    assert.ok(formatted.length >= 4, `Date format empty for ${item.code}`);
  }
  assert.equal(formatDateLocalized('not-a-date', 'en'), 'not-a-date');
});

test('getLocalizedCity translates canonical Uzbekistan city keys accurately', () => {
  assert.equal(getLocalizedCity('Ташкент', 'en'), 'Tashkent');
  assert.equal(getLocalizedCity('Ташкент', 'uz'), 'Toshkent');
  assert.equal(getLocalizedCity('Ташкент', 'ar'), 'طشقند');
  assert.equal(getLocalizedCity('Ташкент', 'zh'), '塔什干');
  assert.equal(getLocalizedCity('Самарканд', 'hi'), 'समरकंद');
  assert.equal(getLocalizedCity('Бухара', 'bn'), 'বুখারা');
});

test('resolveThemeMode supports light, dark, and dynamic system theme switching', () => {
  assert.equal(normalizeThemeMode('system'), 'system');
  assert.equal(normalizeThemeMode('invalid'), 'light');
  assert.equal(resolveThemeMode('light', true), 'light');
  assert.equal(resolveThemeMode('dark', false), 'dark');
  assert.equal(resolveThemeMode('system', true), 'dark');
  assert.equal(resolveThemeMode('system', false), 'light');
});
