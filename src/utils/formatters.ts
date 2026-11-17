import type { CurrencyCode, PropertyFilters } from '../types/estora.ts';
import { UZBEKISTAN_CITIES } from './uzbekistan.ts';

export { UZBEKISTAN_CITIES };

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Квартиры',
  house: 'Дома',
  villa: 'Виллы',
  penthouse: 'Пентхаусы',
  new_build: 'Новостройки',
  commercial: 'Коммерческая недвижимость',
  office: 'Офисы',
  shop: 'Магазины',
  land: 'Земельные участки',
};

export const DEAL_TYPE_LABELS: Record<string, string> = {
  sale: 'Купить',
  rent: 'Арендовать',
};

export const RENOVATION_LABELS: Record<string, string> = {
  designer: 'Дизайнерский ремонт',
  euro: 'Евроремонт',
  cosmetic: 'Косметический ремонт',
  shell: 'Без ремонта / Черновая',
};

const USD_TO_UZS_RATE = 12800;

export function formatPrice(
  priceUsd: number,
  currency: CurrencyCode | string = 'USD',
  dealType: string = 'sale'
): string {
  const suffix = dealType === 'rent' ? ' / мес' : '';
  if (currency === 'UZS') {
    const uzs = Math.round(priceUsd * USD_TO_UZS_RATE);
    return `${uzs.toLocaleString('ru-RU')} сум${suffix}`;
  }
  return `$${priceUsd.toLocaleString('en-US').replace(/,/g, ' ')}${suffix}`;
}

export function formatSellerRating(ratingTenths?: number | null): string {
  const safe = typeof ratingTenths === 'number' && ratingTenths > 0 ? ratingTenths : 49;
  return (safe / 10).toFixed(1);
}

export function getDealTypeLabel(dealType: string): string {
  return DEAL_TYPE_LABELS[dealType] ?? dealType;
}

export function getPropertyTypeLabel(propertyType: string): string {
  return PROPERTY_TYPE_LABELS[propertyType] ?? propertyType;
}

export function getRenovationLabel(renovation?: string): string {
  if (!renovation) return RENOVATION_LABELS.designer;
  return RENOVATION_LABELS[renovation] ?? renovation;
}

export function parseAmenities(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

export function buildPropertyQueryString(filters: PropertyFilters): string {
  const params = new URLSearchParams();
  if (filters.dealType && filters.dealType !== 'all') params.set('dealType', filters.dealType);
  if (filters.propertyType && filters.propertyType !== 'all') params.set('propertyType', filters.propertyType);
  if (filters.city && filters.city !== 'all') params.set('city', filters.city);
  if (filters.district && filters.district.trim()) params.set('district', filters.district.trim());
  if (filters.rooms && filters.rooms !== 'all') params.set('rooms', filters.rooms);
  if (filters.minPrice && filters.minPrice.trim()) params.set('minPrice', filters.minPrice.trim());
  if (filters.maxPrice && filters.maxPrice.trim()) params.set('maxPrice', filters.maxPrice.trim());
  if (filters.minArea && filters.minArea.trim()) params.set('minArea', filters.minArea.trim());
  if (filters.maxArea && filters.maxArea.trim()) params.set('maxArea', filters.maxArea.trim());
  if (filters.minFloor && filters.minFloor.trim()) params.set('minFloor', filters.minFloor.trim());
  if (filters.maxFloor && filters.maxFloor.trim()) params.set('maxFloor', filters.maxFloor.trim());
  if (filters.renovation && filters.renovation !== 'all') params.set('renovation', filters.renovation);
  if (filters.furnished && filters.furnished !== 'all') params.set('furnished', filters.furnished);
  if (filters.parking && filters.parking !== 'all') params.set('parking', filters.parking);
  if (filters.has3dTour) params.set('has3dTour', 'true');
  if (filters.publishedWithin && filters.publishedWithin !== 'all') {
    params.set('publishedWithin', filters.publishedWithin);
  }
  if (filters.q && filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function isUzbekistanCity(city: string): boolean {
  return (UZBEKISTAN_CITIES as readonly string[]).includes(city);
}
