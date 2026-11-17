import { useEffect, useState, type FormEvent } from 'react';
import { Check, Laptop, Moon, Sun } from 'lucide-react';
import { AuthGateNotice } from '../components/AuthGateNotice';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useTheme, type EstoraThemeMode } from '../context/ThemeContext';
import { LANGUAGE_LIST } from '../i18n';
import { apiFetch } from '../lib/api';
import { UZBEKISTAN_CITIES } from '../utils/formatters';

export function SettingsPage() {
  const { idToken, dbUser, currency, setCurrency, refreshUser } = useAuth();
  const { themeMode, setThemeMode } = useTheme();
  const { language, setLanguage, t, localizeCity } = useI18n();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredCity, setPreferredCity] = useState('Ташкент');
  const [preferredCurrency, setPreferredCurrency] = useState<'USD' | 'UZS'>(currency);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dbUser) {
      setFullName(dbUser.fullName);
      setPhone(dbUser.phone || '');
      setPreferredCity(dbUser.preferredCity || 'Ташкент');
      setPreferredCurrency(dbUser.preferredCurrency === 'UZS' ? 'UZS' : 'USD');
      setNotificationsEnabled(dbUser.notificationsEnabled);
    }
  }, [dbUser]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    setSaving(true);
    setSavedNotice(false);
    setError(null);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        token: idToken,
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          preferredCity,
          preferredCurrency,
          notificationsEnabled,
        }),
      });
      setCurrency(preferredCurrency);
      await refreshUser();
      setSavedNotice(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSaving(false);
    }
  };

  const themeOptions: Array<{ mode: EstoraThemeMode; label: string; icon: typeof Sun }> = [
    { mode: 'light', label: t.nav.themeLight, icon: Sun },
    { mode: 'dark', label: t.nav.themeDark, icon: Moon },
    { mode: 'system', label: t.nav.themeSystem, icon: Laptop },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
        {t.settings.title}
      </h1>
      <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">{t.settings.subtitle}</p>

      <div className="mt-8 space-y-6">
        {/* Appearance & 3-Mode Theme */}
        <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.settings.appearanceTitle}
          </h2>
          <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
            {t.settings.appearanceDesc}
          </p>
          <div className="mt-4 inline-flex flex-wrap gap-1 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-1 dark:border-[#2C2C2C] dark:bg-[#141414]">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = themeMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  data-testid={`settings-theme-${opt.mode}`}
                  onClick={() => setThemeMode(opt.mode)}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[10px] px-4 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#143A30] text-white'
                      : 'text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 10 Interface Languages */}
        <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.settings.languageTitle}
          </h2>
          <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
            {t.settings.languageDesc}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {LANGUAGE_LIST.map((item) => {
              const active = language === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  data-testid={`settings-lang-${item.code}`}
                  onClick={() => setLanguage(item.code)}
                  className={`flex min-h-[42px] items-center justify-between gap-1.5 rounded-[12px] border px-3 text-start text-xs font-medium transition-colors ${
                    active
                      ? 'border-[#143A30] bg-[#143A30] text-white'
                      : 'border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]'
                  }`}
                >
                  <span className="truncate">{item.nativeName}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Currency */}
        <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.settings.currencyTitle}
          </h2>
          <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
            {t.settings.currencyDesc}
          </p>
          <div className="mt-4 inline-flex gap-1 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-1 dark:border-[#2C2C2C] dark:bg-[#141414]">
            {(['USD', 'UZS'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => {
                  setCurrency(curr);
                  setPreferredCurrency(curr);
                }}
                className={`min-h-[38px] rounded-[10px] px-4 text-xs font-medium transition-colors ${
                  currency === curr
                    ? 'bg-[#143A30] text-white'
                    : 'text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {curr === 'USD' ? 'USD ($)' : `UZS (${t.common.uzsCurrencySuffix})`}
              </button>
            ))}
          </div>
        </div>

        {!idToken ? (
          <AuthGateNotice title={t.settings.authTitle} description={t.settings.authDesc} />
        ) : (
          <form
            onSubmit={(e) => void handleSave(e)}
            className="space-y-5 rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
          >
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.settings.fullName}
              </label>
              <input
                id="settings-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-phone"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.settings.phone}
              </label>
              <input
                id="settings-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm font-mono dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-city"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.settings.primaryCity}
              </label>
              <select
                id="settings-city"
                value={preferredCity}
                onChange={(e) => setPreferredCity(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                {UZBEKISTAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {localizeCity(c)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-3 text-sm text-[#171717] dark:text-[#F5F5F5]">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#143A30]"
              />
              <span>{t.settings.notificationsLabel}</span>
            </label>

            {error && <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>}
            {savedNotice && (
              <p className="text-xs font-medium text-[#143A30] dark:text-[#D4B483]">
                {t.settings.savedNotice}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#143A30] px-6 text-sm font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
            >
              {saving ? t.common.saving : t.settings.saveSettings}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
