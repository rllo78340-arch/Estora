import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type EstoraThemeMode = 'light' | 'dark' | 'system';
export type ResolvedEstoraTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'estora_theme_v1';

export function normalizeThemeMode(raw: unknown): EstoraThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'system') {
    return raw;
  }
  return 'light';
}

export function resolveThemeMode(mode: EstoraThemeMode, systemPrefersDark: boolean): ResolvedEstoraTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return mode;
}

interface ThemeContextValue {
  /** Resolved effective theme ('light' | 'dark') */
  theme: ResolvedEstoraTheme;
  /** Selected theme preference ('light' | 'dark' | 'system') */
  themeMode: EstoraThemeMode;
  setThemeMode: (next: EstoraThemeMode) => void;
  /** Alias preserved for legacy callers */
  setTheme: (next: EstoraThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  themeMode: 'light',
  setThemeMode: () => {},
  setTheme: () => {},
  toggleTheme: () => {},
});

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<EstoraThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return normalizeThemeMode(stored);
    } catch {
      return 'light';
    }
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => readSystemPrefersDark());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    setSystemPrefersDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = resolveThemeMode(themeMode, systemPrefersDark);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.dataset.themeMode = themeMode;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore storage errors
    }
  }, [resolvedTheme, themeMode]);

  const setThemeMode = (next: EstoraThemeMode) => setThemeModeState(normalizeThemeMode(next));
  const toggleTheme = () =>
    setThemeModeState((prev) => {
      const current = resolveThemeMode(prev, systemPrefersDark);
      return current === 'dark' ? 'light' : 'dark';
    });

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        setThemeMode,
        setTheme: setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
