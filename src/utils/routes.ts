import type { TranslationBundle } from '../i18n/types';

export type NavTranslationKey = keyof Pick<
  TranslationBundle['nav'],
  | 'home'
  | 'catalog'
  | 'sale'
  | 'rent'
  | 'tours3d'
  | 'ai'
  | 'favorites'
  | 'addProperty'
  | 'messages'
  | 'profile'
  | 'settings'
  | 'admin'
>;

export interface NavItem {
  key: NavTranslationKey;
  label: string;
  path: string;
}

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = [
  { key: 'catalog', label: 'Каталог', path: '/catalog' },
  { key: 'sale', label: 'Продажа', path: '/sale' },
  { key: 'rent', label: 'Аренда', path: '/rent' },
  { key: 'tours3d', label: '3D-туры', path: '/3d' },
  { key: 'ai', label: 'ESTORA AI', path: '/ai' },
] as const;

export const WORKSPACE_NAV_ITEMS: readonly NavItem[] = [
  { key: 'favorites', label: 'Избранное', path: '/favorites' },
  { key: 'addProperty', label: 'Добавить объявление', path: '/add' },
  { key: 'messages', label: 'Сообщения', path: '/messages' },
  { key: 'profile', label: 'Личный кабинет', path: '/profile' },
  { key: 'settings', label: 'Настройки', path: '/settings' },
  { key: 'admin', label: 'Админ-панель', path: '/admin' },
] as const;

export const ALL_NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', label: 'Главная', path: '/' },
  ...PRIMARY_NAV_ITEMS,
  ...WORKSPACE_NAV_ITEMS,
] as const;
