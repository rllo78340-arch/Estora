import { useEffect, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, Globe, Laptop, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import { useTheme, type EstoraThemeMode } from '../context/ThemeContext';
import { LANGUAGE_LIST } from '../i18n';
import type { NotificationType } from '../types/estora';
import { ALL_NAV_ITEMS, PRIMARY_NAV_ITEMS, WORKSPACE_NAV_ITEMS } from '../utils/routes';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { dbUser, firebaseUser, signInWithGoogle, logout } = useAuth();
  const { language, setLanguage, meta, t, formatDate } = useI18n();
  const {
    notifications,
    unreadNotificationsCount,
    unreadMessagesCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useRealtime();
  const { themeMode, setThemeMode } = useTheme();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setWorkspaceOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateAndClose = (path: string) => {
    setWorkspaceOpen(false);
    setLangOpen(false);
    setNotifOpen(false);
    setMobileOpen(false);
    onNavigate(path);
  };

  const themeOptions: Array<{ mode: EstoraThemeMode; label: string; icon: typeof Sun }> = [
    { mode: 'light', label: t.nav.themeLight, icon: Sun },
    { mode: 'dark', label: t.nav.themeDark, icon: Moon },
    { mode: 'system', label: t.nav.themeSystem, icon: Laptop },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E4E0] bg-white/95 backdrop-blur-sm transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5 lg:gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigateAndClose('/');
          }}
          className="font-display text-2xl font-semibold tracking-tight text-[#171717] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#143A30] dark:text-[#F5F5F5]"
        >
          ESTORA
        </a>

        <nav aria-label={t.nav.primaryNavAria} className="hidden lg:flex items-center gap-7">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigateAndClose(item.path);
                }}
                className={`text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#143A30] ${
                  isActive
                    ? 'text-[#143A30] underline dark:text-[#D4B483]'
                    : 'text-[#525252] hover:text-[#171717] hover:underline dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {t.nav[item.key]}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* Header Notification Bell (Authenticated Users) */}
          {firebaseUser && (
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                data-testid="notifications-bell-trigger"
                aria-expanded={notifOpen}
                aria-haspopup="menu"
                aria-label={t.notifications.bellAria}
                onClick={() => {
                  setWorkspaceOpen(false);
                  setLangOpen(false);
                  setNotifOpen((prev) => !prev);
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#E5E4E0] bg-white text-[#171717] transition-colors duration-150 hover:bg-[#F8F8F7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:hover:bg-[#262626]"
              >
                <Bell className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -end-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-[8px] bg-[#143A30] px-1 font-mono text-[10px] font-semibold text-white dark:bg-[#D4B483] dark:text-[#111111]">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="menu"
                  aria-label={t.notifications.title}
                  className="absolute end-0 z-50 mt-2 w-80 sm:w-96 rounded-[18px] border border-[#E5E4E0] bg-white p-3 shadow-xl dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#E5E4E0] pb-2.5 dark:border-[#2C2C2C]">
                    <span className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {t.notifications.title}
                    </span>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsRead()}
                        className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                      >
                        {t.notifications.markAllRead}
                      </button>
                    )}
                  </div>

                  <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-[#737373] dark:text-[#A0A0A0]">
                        {t.notifications.empty}
                      </p>
                    ) : (
                      notifications.slice(0, 12).map((notif) => {
                        const typeLabel =
                          t.notifications.types[notif.type as NotificationType] ?? notif.type;
                        return (
                          <button
                            key={notif.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              void markNotificationRead(notif.id);
                              navigateAndClose(notif.linkPath || '/profile?tab=notifications');
                            }}
                            className={`block w-full rounded-[12px] border p-2.5 text-start transition-colors ${
                              notif.isRead
                                ? 'border-transparent bg-transparent hover:bg-[#F8F8F7] dark:hover:bg-[#242424]'
                                : 'border-[#D4B483]/50 bg-[#FAF8F4] hover:bg-[#F3EFE6] dark:border-[#6A573B] dark:bg-[#221F19]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-semibold text-[#8C6D46] dark:text-[#D4B483]">
                                {typeLabel}
                              </span>
                              <span className="font-mono text-[#737373] tabular-nums dark:text-[#A0A0A0]">
                                {formatDate(notif.createdAt, true)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
                                {notif.body}
                              </p>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-2.5 border-t border-[#E5E4E0] pt-2 dark:border-[#2C2C2C]">
                    <button
                      type="button"
                      onClick={() => navigateAndClose('/profile?tab=notifications')}
                      className="flex min-h-[36px] w-full items-center justify-center rounded-[12px] bg-[#F8F8F7] text-xs font-medium text-[#143A30] hover:bg-[#ECEBE8] dark:bg-[#141414] dark:text-[#D4B483] dark:hover:bg-[#242424]"
                    >
                      {t.notifications.openAll}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Header Language Switcher (All 10 Languages) */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              data-testid="language-switcher-trigger"
              aria-expanded={langOpen}
              aria-haspopup="listbox"
              aria-label={`${t.nav.languageLabel}: ${meta.nativeName}`}
              onClick={() => {
                setWorkspaceOpen(false);
                setNotifOpen(false);
                setLangOpen((prev) => !prev);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[14px] border border-[#E5E4E0] bg-white px-3 text-xs font-semibold text-[#171717] transition-colors duration-150 hover:bg-[#F8F8F7] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:hover:bg-[#262626]"
            >
              <Globe className="h-3.5 w-3.5 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
              <span>{meta.shortCode}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
            </button>

            {langOpen && (
              <div
                role="listbox"
                aria-label={t.nav.languageLabel}
                className="absolute end-0 z-50 mt-2 w-56 rounded-[18px] border border-[#E5E4E0] bg-white p-1.5 shadow-lg dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
              >
                <div className="max-h-80 overflow-y-auto space-y-0.5">
                  {LANGUAGE_LIST.map((item) => {
                    const selected = item.code === language;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-testid={`lang-option-${item.code}`}
                        onClick={() => {
                          setLanguage(item.code);
                          setLangOpen(false);
                        }}
                        className={`flex min-h-[38px] w-full items-center justify-between gap-2 rounded-[12px] px-3 text-start text-xs font-medium transition-colors duration-150 ${
                          selected
                            ? 'bg-[#F3F3F1] text-[#143A30] dark:bg-[#262626] dark:text-[#D4B483]'
                            : 'text-[#171717] hover:bg-[#F8F8F7] dark:text-[#F5F5F5] dark:hover:bg-[#242424]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] text-[#737373] dark:text-[#A0A0A0]">
                            {item.shortCode}
                          </span>
                          <span className="truncate">{item.nativeName}</span>
                        </span>
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative hidden lg:block" ref={dropdownRef}>
            <button
              type="button"
              data-testid="workspace-menu-trigger"
              aria-expanded={workspaceOpen}
              aria-haspopup="menu"
              onClick={() => {
                setLangOpen(false);
                setNotifOpen(false);
                setWorkspaceOpen((prev) => !prev);
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[14px] bg-[#143A30] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#0F2C24] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143A30]"
            >
              <span className="max-w-[140px] truncate">
                {firebaseUser
                  ? dbUser?.fullName || firebaseUser.displayName || t.nav.cabinet
                  : t.nav.cabinet}
              </span>
              {firebaseUser && unreadMessagesCount > 0 && (
                <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-[7px] bg-[#D4B483] px-1 font-mono text-[10px] font-semibold text-[#111111]">
                  {unreadMessagesCount}
                </span>
              )}
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>

            {workspaceOpen && (
              <div
                role="menu"
                aria-label={t.nav.workspaceMenuAria}
                className="absolute end-0 z-50 mt-2 w-64 rounded-[18px] border border-[#E5E4E0] bg-white p-2 shadow-lg dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
              >
                {WORKSPACE_NAV_ITEMS.map((item) => {
                  const isActive = currentPath === item.path;
                  const showMsgBadge = item.path === '/messages' && unreadMessagesCount > 0;
                  const showNotifBadge = item.path === '/profile' && unreadNotificationsCount > 0;
                  return (
                    <a
                      key={item.path}
                      role="menuitem"
                      href={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateAndClose(item.path);
                      }}
                      className={`flex min-h-[40px] items-center justify-between gap-2 rounded-[12px] px-3 text-sm transition-colors duration-150 ${
                        isActive
                          ? 'bg-[#F3F3F1] font-medium text-[#143A30] dark:bg-[#262626] dark:text-[#D4B483]'
                          : 'text-[#171717] hover:bg-[#F8F8F7] dark:text-[#F5F5F5] dark:hover:bg-[#242424]'
                      }`}
                    >
                      <span>{t.nav[item.key]}</span>
                      {(showMsgBadge || showNotifBadge) && (
                        <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-[8px] bg-[#143A30] px-1.5 font-mono text-[11px] font-medium text-white dark:bg-[#D4B483] dark:text-[#111111]">
                          {showMsgBadge ? unreadMessagesCount : unreadNotificationsCount}
                        </span>
                      )}
                    </a>
                  );
                })}

                <div className="my-1.5 border-t border-[#E5E4E0] dark:border-[#2C2C2C]" />

                <div className="px-2 py-1">
                  <p className="mb-1.5 px-1 text-[11px] font-medium text-[#737373] dark:text-[#A0A0A0]">
                    {t.nav.themeLabel}
                  </p>
                  <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[#F8F8F7] p-1 dark:bg-[#141414]">
                    {themeOptions.map((opt) => {
                      const Icon = opt.icon;
                      const active = themeMode === opt.mode;
                      return (
                        <button
                          key={opt.mode}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          data-testid={`theme-option-${opt.mode}`}
                          title={opt.label}
                          onClick={() => setThemeMode(opt.mode)}
                          className={`flex min-h-[34px] flex-col items-center justify-center rounded-[10px] px-1.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
                            active
                              ? 'bg-white text-[#143A30] shadow-xs dark:bg-[#262626] dark:text-[#D4B483]'
                              : 'text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="my-1.5 border-t border-[#E5E4E0] dark:border-[#2C2C2C]" />
                {firebaseUser ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceOpen(false);
                      void logout();
                    }}
                    className="flex min-h-[40px] w-full items-center rounded-[12px] px-3 text-start text-sm font-medium text-[#7F1D1D] hover:bg-[#FEF2F2] dark:text-[#FCA5A5] dark:hover:bg-[#2B1B1B]"
                  >
                    {t.nav.signOut}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setWorkspaceOpen(false);
                      void signInWithGoogle();
                    }}
                    className="flex min-h-[40px] w-full items-center rounded-[12px] px-3 text-start text-sm font-medium text-[#143A30] hover:bg-[#F3F7F5] dark:text-[#D4B483] dark:hover:bg-[#242424]"
                  >
                    {t.nav.signInGoogle}
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={mobileOpen ? t.nav.menuClose : t.nav.menuOpen}
            aria-expanded={mobileOpen}
            aria-controls="estora-mobile-nav"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#E5E4E0] bg-white text-[#171717] hover:bg-[#F8F8F7] lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:hover:bg-[#262626]"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="estora-mobile-nav"
          aria-label={t.nav.mobileNavAria}
          className="max-h-[75vh] overflow-y-auto border-t border-[#E5E4E0] bg-white px-6 py-4 lg:hidden dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
        >
          <div className="grid grid-cols-1 gap-1">
            {ALL_NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.path;
              const showMsgBadge = item.path === '/messages' && unreadMessagesCount > 0;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateAndClose(item.path);
                  }}
                  className={`flex min-h-[44px] items-center justify-between rounded-[12px] px-3 text-sm font-medium ${
                    isActive
                      ? 'bg-[#F3F3F1] text-[#143A30] dark:bg-[#262626] dark:text-[#D4B483]'
                      : 'text-[#171717] hover:bg-[#F8F8F7] dark:text-[#F5F5F5] dark:hover:bg-[#242424]'
                  }`}
                >
                  <span>{t.nav[item.key]}</span>
                  {showMsgBadge && (
                    <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-[8px] bg-[#143A30] px-1.5 font-mono text-[11px] font-medium text-white dark:bg-[#D4B483] dark:text-[#111111]">
                      {unreadMessagesCount}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
          <div className="mt-3 space-y-2 border-t border-[#E5E4E0] pt-3 dark:border-[#2C2C2C]">
            <div className="grid grid-cols-3 gap-1.5 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-1 dark:border-[#343434] dark:bg-[#141414]">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = themeMode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setThemeMode(opt.mode)}
                    className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] px-2 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-white text-[#143A30] shadow-xs dark:bg-[#262626] dark:text-[#D4B483]'
                        : 'text-[#525252] dark:text-[#A0A0A0]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {firebaseUser ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#E5E4E0] text-sm font-medium text-[#7F1D1D] dark:border-[#343434] dark:text-[#FCA5A5]"
              >
                {t.nav.signOut} ({dbUser?.email || firebaseUser.email})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void signInWithGoogle();
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#143A30] text-sm font-medium text-white"
              >
                {t.nav.signInGoogle}
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
