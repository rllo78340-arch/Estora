import type {
  AiAgentResponse,
  AiChatMessage,
  AiComparisonMetrics,
  AiLanguage,
  AiPersonalizationSettings,
  AiRecommendationItem,
  PropertyFilters,
  PropertyListing,
} from '../types/estora.ts';
import { buildPropertyQueryString } from './formatters.ts';
import { UZBEKISTAN_CITIES } from './uzbekistan.ts';

export const AI_STORAGE_KEYS = {
  settings: 'estora_ai_settings_v1',
  messages: 'estora_ai_messages_v1',
  compareIds: 'estora_ai_compare_ids_v1',
} as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const ALLOWED_DEAL_TYPES = new Set(['sale', 'rent']);
const ALLOWED_PROPERTY_TYPES = new Set([
  'apartment',
  'house',
  'villa',
  'penthouse',
  'new_build',
  'commercial',
  'office',
  'shop',
  'land',
]);
const ALLOWED_ROOMS = new Set(['1', '2', '3', '4', '5+']);
const ALLOWED_RENOVATIONS = new Set(['designer', 'euro', 'cosmetic', 'shell']);
const ALLOWED_SORTS = new Set(['newest', 'price_asc', 'price_desc', 'popular']);
const ALLOWED_LANGUAGES = new Set<AiLanguage>([
  'en',
  'zh',
  'hi',
  'es',
  'ar',
  'fr',
  'pt',
  'bn',
  'ru',
  'uz',
]);

const CITY_ALIASES: Record<string, string> = {
  tashkent: 'Ташкент',
  toshkent: 'Ташкент',
  ташкент: 'Ташкент',
  samarkand: 'Самарканд',
  samarqand: 'Самарканд',
  самарканд: 'Самарканд',
  bukhara: 'Бухара',
  buxoro: 'Бухара',
  бухара: 'Бухара',
  andijan: 'Андижан',
  andijon: 'Андижан',
  андижан: 'Андижан',
  fergana: 'Фергана',
  "farg'ona": 'Фергана',
  fargona: 'Фергана',
  фергана: 'Фергана',
  namangan: 'Наманган',
  наманган: 'Наманган',
  nukus: 'Нукус',
  нукус: 'Нукус',
  karshi: 'Карши',
  qarshi: 'Карши',
  карши: 'Карши',
  termez: 'Термез',
  termiz: 'Термез',
  термез: 'Термез',
  navoi: 'Навои',
  navoiy: 'Навои',
  навои: 'Навои',
  urgench: 'Ургенч',
  urganch: 'Ургенч',
  ургенч: 'Ургенч',
  jizzakh: 'Джизак',
  jizzax: 'Джизак',
  джизак: 'Джизак',
  khiva: 'Хива',
  xiva: 'Хива',
  хива: 'Хива',
  kokand: 'Коканд',
  "qo'qon": 'Коканд',
  qoqon: 'Коканд',
  коканд: 'Коканд',
  gulistan: 'Гулистан',
  guliston: 'Гулистан',
  гулистан: 'Гулистан',
  chirchik: 'Чирчик',
  chirchiq: 'Чирчик',
  чирчик: 'Чирчик',
  almalyk: 'Алмалык',
  olmaliq: 'Алмалык',
  алмалык: 'Алмалык',
  angren: 'Ангрен',
  ангрен: 'Ангрен',
};

export function normalizeUzbekistanCity(raw?: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;

  const exact = (UZBEKISTAN_CITIES as readonly string[]).find(
    (c) => c.toLowerCase() === trimmed.toLowerCase()
  );
  if (exact) return exact;

  return CITY_ALIASES[trimmed.toLowerCase()];
}

function toPositiveNumberString(val: unknown): string | undefined {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return String(Math.round(val));
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.]/g, '');
    const num = Number(cleaned);
    if (cleaned.length > 0 && Number.isFinite(num) && num > 0) {
      return String(Math.round(num));
    }
  }
  return undefined;
}

export function sanitizeAiFilters(raw: Record<string, unknown> | null | undefined): PropertyFilters {
  if (!raw || typeof raw !== 'object') return {};

  const out: PropertyFilters = {};

  if (typeof raw.dealType === 'string' && ALLOWED_DEAL_TYPES.has(raw.dealType.trim().toLowerCase())) {
    out.dealType = raw.dealType.trim().toLowerCase();
  }

  if (
    typeof raw.propertyType === 'string' &&
    ALLOWED_PROPERTY_TYPES.has(raw.propertyType.trim().toLowerCase())
  ) {
    out.propertyType = raw.propertyType.trim().toLowerCase();
  }

  const normalizedCity = normalizeUzbekistanCity(raw.city);
  if (normalizedCity) {
    out.city = normalizedCity;
  }

  if (typeof raw.district === 'string' && raw.district.trim().length > 0 && raw.district.trim().length <= 60) {
    out.district = raw.district.trim();
  }

  if (raw.rooms !== undefined && raw.rooms !== null) {
    const roomsStr = typeof raw.rooms === 'number' ? (raw.rooms >= 5 ? '5+' : String(raw.rooms)) : String(raw.rooms).trim();
    if (ALLOWED_ROOMS.has(roomsStr)) {
      out.rooms = roomsStr;
    }
  }

  const minPrice = toPositiveNumberString(raw.minPrice);
  const maxPrice = toPositiveNumberString(raw.maxPrice);
  if (minPrice) out.minPrice = minPrice;
  if (maxPrice) out.maxPrice = maxPrice;

  const minArea = toPositiveNumberString(raw.minArea);
  const maxArea = toPositiveNumberString(raw.maxArea);
  if (minArea) out.minArea = minArea;
  if (maxArea) out.maxArea = maxArea;

  if (
    typeof raw.renovation === 'string' &&
    ALLOWED_RENOVATIONS.has(raw.renovation.trim().toLowerCase())
  ) {
    out.renovation = raw.renovation.trim().toLowerCase();
  }

  if (raw.furnished === true || raw.furnished === 'true') {
    out.furnished = 'true';
  } else if (raw.furnished === false || raw.furnished === 'false') {
    out.furnished = 'false';
  }

  if (raw.parking === true || raw.parking === 'true') {
    out.parking = 'true';
  } else if (raw.parking === false || raw.parking === 'false') {
    out.parking = 'false';
  }

  if (raw.has3dTour === true || raw.has3dTour === 'true') {
    out.has3dTour = true;
  }

  if (typeof raw.q === 'string' && raw.q.trim().length > 0) {
    out.q = raw.q.trim().slice(0, 80);
  }

  if (typeof raw.sort === 'string' && ALLOWED_SORTS.has(raw.sort.trim())) {
    out.sort = raw.sort.trim();
  }

  return out;
}

export function hasActiveAiFilters(filters: PropertyFilters | undefined): boolean {
  if (!filters) return false;
  return Boolean(
    filters.dealType ||
      filters.propertyType ||
      filters.city ||
      filters.district ||
      filters.rooms ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.minArea ||
      filters.maxArea ||
      filters.renovation ||
      filters.furnished ||
      filters.parking ||
      filters.has3dTour ||
      filters.q ||
      (filters.sort && filters.sort !== 'newest')
  );
}

export function buildCatalogLinkFromFilters(filters: PropertyFilters | undefined): string {
  if (!filters || !hasActiveAiFilters(filters)) return '/catalog';
  const qs = buildPropertyQueryString(filters);
  return `/catalog${qs}`;
}

export function sanitizePersonalizationContext(
  raw: Partial<AiPersonalizationSettings> | Record<string, unknown> | null | undefined
): AiPersonalizationSettings {
  const language: AiLanguage =
    typeof raw?.language === 'string' && ALLOWED_LANGUAGES.has(raw.language as AiLanguage)
      ? (raw.language as AiLanguage)
      : 'ru';

  const enabled = Boolean(raw?.enabled);
  if (!enabled) {
    return {
      enabled: false,
      language,
      preferredCity: '',
      budgetUsd: undefined,
      preferredPropertyType: '',
      preferredRooms: '',
      recentSearches: [],
      favoritePropertyIds: [],
    };
  }

  const preferredCity = normalizeUzbekistanCity(raw?.preferredCity) ?? '';
  const budgetNum =
    typeof raw?.budgetUsd === 'number' && Number.isFinite(raw.budgetUsd) && raw.budgetUsd > 0
      ? Math.round(raw.budgetUsd)
      : undefined;

  const preferredPropertyType =
    typeof raw?.preferredPropertyType === 'string' &&
    ALLOWED_PROPERTY_TYPES.has(raw.preferredPropertyType)
      ? raw.preferredPropertyType
      : '';

  const preferredRooms =
    typeof raw?.preferredRooms === 'string' && ALLOWED_ROOMS.has(raw.preferredRooms)
      ? raw.preferredRooms
      : '';

  const recentSearches = Array.isArray(raw?.recentSearches)
    ? raw.recentSearches
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 120))
        .slice(0, 8)
    : [];

  const favoritePropertyIds = Array.isArray(raw?.favoritePropertyIds)
    ? Array.from(
        new Set(
          raw.favoritePropertyIds
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        )
      ).slice(0, 20)
    : [];

  return {
    enabled: true,
    language,
    preferredCity,
    budgetUsd: budgetNum,
    preferredPropertyType,
    preferredRooms,
    recentSearches,
    favoritePropertyIds,
  };
}

export function hydrateGroundedRecommendations(
  rawRecommendations: Array<{ propertyId: unknown; reason?: unknown }>,
  realPropertiesMap: Map<number, PropertyListing>
): AiRecommendationItem[] {
  const seen = new Set<number>();
  const hydrated: AiRecommendationItem[] = [];

  for (const item of rawRecommendations) {
    const id = Number(item?.propertyId);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    const realProp = realPropertiesMap.get(id);
    if (!realProp) continue;

    seen.add(id);
    const reason =
      typeof item.reason === 'string' && item.reason.trim().length > 0
        ? item.reason.trim().slice(0, 260)
        : `${realProp.city}, ${realProp.district} · ${realProp.areaSqm} м²`;

    hydrated.push({
      propertyId: realProp.id,
      reason,
      property: realProp,
    });
  }

  return hydrated;
}

export function buildComparisonMetrics(listings: PropertyListing[]): AiComparisonMetrics | null {
  if (!Array.isArray(listings) || listings.length < 2) return null;

  let cheapestId = listings[0].id;
  let largestId = listings[0].id;
  let bestValueId = listings[0].id;
  let minPrice = listings[0].priceUsd;
  let maxArea = listings[0].areaSqm;
  let minPricePerSqm = listings[0].areaSqm > 0 ? listings[0].priceUsd / listings[0].areaSqm : Infinity;

  const pricePerSqmById: Record<number, number> = {};
  const has3dIds: number[] = [];

  for (const item of listings) {
    const pps = item.areaSqm > 0 ? Math.round(item.priceUsd / item.areaSqm) : item.priceUsd;
    pricePerSqmById[item.id] = pps;

    if (item.priceUsd < minPrice) {
      minPrice = item.priceUsd;
      cheapestId = item.id;
    }
    if (item.areaSqm > maxArea) {
      maxArea = item.areaSqm;
      largestId = item.id;
    }
    if (pps < minPricePerSqm) {
      minPricePerSqm = pps;
      bestValueId = item.id;
    }
    if (item.has3dTour) {
      has3dIds.push(item.id);
    }
  }

  return {
    cheapestId,
    largestId,
    bestValueId,
    pricePerSqmById,
    has3dIds,
  };
}

export function getDefaultAiSettings(): AiPersonalizationSettings {
  return {
    enabled: true,
    language: 'ru',
    preferredCity: '',
    budgetUsd: undefined,
    preferredPropertyType: '',
    preferredRooms: '',
    recentSearches: [],
    favoritePropertyIds: [],
  };
}

function getBrowserStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadAiSettings(storage?: StorageLike): AiPersonalizationSettings {
  const store = getBrowserStorage(storage);
  if (!store) return getDefaultAiSettings();
  try {
    const raw = store.getItem(AI_STORAGE_KEYS.settings);
    if (!raw) return getDefaultAiSettings();
    const parsed = JSON.parse(raw) as Partial<AiPersonalizationSettings>;
    // Always preserve enabled=false if stored explicitly, otherwise sanitize
    const sanitized = sanitizePersonalizationContext(parsed);
    return {
      ...sanitized,
      language:
        typeof parsed.language === 'string' && ALLOWED_LANGUAGES.has(parsed.language as AiLanguage)
          ? (parsed.language as AiLanguage)
          : 'ru',
    };
  } catch {
    return getDefaultAiSettings();
  }
}

export function saveAiSettings(
  settings: AiPersonalizationSettings,
  storage?: StorageLike
): AiPersonalizationSettings {
  const clean = sanitizePersonalizationContext(settings);
  const store = getBrowserStorage(storage);
  if (store) {
    try {
      store.setItem(AI_STORAGE_KEYS.settings, JSON.stringify(clean));
    } catch {
      // Ignore quota errors
    }
  }
  return clean;
}

export function loadAiMessages(storage?: StorageLike): AiChatMessage[] {
  const store = getBrowserStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(AI_STORAGE_KEYS.messages);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

export function saveAiMessages(messages: AiChatMessage[], storage?: StorageLike): void {
  const store = getBrowserStorage(storage);
  if (!store) return;
  try {
    store.setItem(AI_STORAGE_KEYS.messages, JSON.stringify(messages.slice(-30)));
  } catch {
    // Ignore quota errors
  }
}

export function loadCompareIds(storage?: StorageLike): number[] {
  const store = getBrowserStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(AI_STORAGE_KEYS.compareIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0))
    ).slice(0, 4);
  } catch {
    return [];
  }
}

export function saveCompareIds(ids: number[], storage?: StorageLike): number[] {
  const clean = Array.from(
    new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))
  ).slice(0, 4);
  const store = getBrowserStorage(storage);
  if (store) {
    try {
      store.setItem(AI_STORAGE_KEYS.compareIds, JSON.stringify(clean));
    } catch {
      // Ignore quota errors
    }
  }
  return clean;
}

export function recordSearchQueryToStorage(query: string, storage?: StorageLike): AiPersonalizationSettings {
  const current = loadAiSettings(storage);
  const trimmed = query.trim().slice(0, 120);
  if (!current.enabled || !trimmed) {
    return current;
  }
  const deduped = [
    trimmed,
    ...current.recentSearches.filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, 8);
  return saveAiSettings({ ...current, recentSearches: deduped }, storage);
}

export function clearAiHistoryAndMemory(storage?: StorageLike): AiPersonalizationSettings {
  const current = loadAiSettings(storage);
  const store = getBrowserStorage(storage);
  if (store) {
    store.removeItem(AI_STORAGE_KEYS.messages);
    store.removeItem(AI_STORAGE_KEYS.compareIds);
  }
  return saveAiSettings(
    {
      ...current,
      recentSearches: [],
    },
    storage
  );
}

export function summarizeAssistantTurnForHistory(resp: AiAgentResponse): string {
  const recIds = resp.recommendations.map((r) => `#${r.propertyId}`).join(', ');
  return recIds ? `${resp.reply}\n[Показанные ID: ${recIds}]` : resp.reply;
}
