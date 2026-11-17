import type {
  ContactMethod,
  CurrencyCode,
  DealType,
  HeatingType,
  PropertyListing,
  PropertyStatus,
  PropertyType,
  RenovationType,
  TourHotspot,
  TourRoom,
} from '../types/estora.ts';
import { validateUzbekistanLocation } from './uzbekistan.ts';

export const USD_TO_UZS_RATE = 12800;

export const UZBEKISTAN_BOUNDS = {
  minLat: 37.1,
  maxLat: 45.6,
  minLng: 55.9,
  maxLng: 73.2,
} as const;

export const UZBEKISTAN_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Ташкент: { lat: 41.3111, lng: 69.2797 },
  Самарканд: { lat: 39.6542, lng: 66.9597 },
  Бухара: { lat: 39.7681, lng: 64.4556 },
  Андижан: { lat: 40.7821, lng: 72.3442 },
  Фергана: { lat: 40.3842, lng: 71.7843 },
  Наманган: { lat: 41.0011, lng: 71.6726 },
  Нукус: { lat: 42.4531, lng: 59.6103 },
  Карши: { lat: 38.8606, lng: 65.7891 },
  Термез: { lat: 37.2242, lng: 67.2783 },
  Навои: { lat: 40.0844, lng: 65.3792 },
  Ургенч: { lat: 41.5504, lng: 60.6333 },
  Джизак: { lat: 40.1158, lng: 67.8422 },
  Коканд: { lat: 40.5286, lng: 70.9425 },
  Хива: { lat: 41.3783, lng: 60.3639 },
  Маргилан: { lat: 40.4711, lng: 71.7247 },
  Чирчик: { lat: 41.4689, lng: 69.5822 },
  Алмалык: { lat: 40.8447, lng: 69.5983 },
  Ангрен: { lat: 41.0167, lng: 70.1436 },
  Гулистан: { lat: 40.4915, lng: 68.7811 },
};

export const HEATING_LABELS: Record<HeatingType, string> = {
  central: 'Центральное отопление',
  individual: 'Индивидуальное (газ / котёл)',
  underfloor: 'Тёплый пол',
  none: 'Без отопления',
};

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: 'Звонок по телефону',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  messages: 'Чат ESTORA',
};

export const LISTING_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Черновик',
  pending: 'На модерации',
  active: 'Опубликовано',
  rejected: 'Отклонено',
  archived: 'В архиве',
};

export const EXTRA_AMENITY_OPTIONS = [
  'Лифт',
  'Охрана 24/7',
  'Видеонаблюдение',
  'Терраса',
  'Бассейн',
  'Сауна / Хаммам',
  'Закрытый двор',
  'Панорамные окна',
  'Гардеробная',
  'Зарядка для электромобилей',
] as const;

export const WIZARD_STEPS = [
  { id: 1, title: 'Основное' },
  { id: 2, title: 'Адрес и карта' },
  { id: 3, title: 'Цена' },
  { id: 4, title: 'Характеристики' },
  { id: 5, title: 'Фотографии' },
  { id: 6, title: '3D и туры' },
  { id: 7, title: 'Контакты' },
  { id: 8, title: 'Публикация' },
] as const;

export interface GalleryPhotoItem {
  id: string;
  url: string;
  name: string;
  sizeBytes?: number;
}

export interface ListingWizardDraft {
  editingId?: number | null;
  status?: PropertyStatus;
  // Step 1
  dealType: DealType;
  propertyType: PropertyType;
  title: string;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  floor: string;
  totalFloors: string;
  description: string;
  // Step 2
  country: string;
  city: string;
  customCity: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  // Step 3
  priceCurrency: CurrencyCode;
  priceAmount: string;
  monthlyRentAmount: string;
  // Step 4
  renovation: RenovationType;
  furnished: boolean;
  heating: HeatingType;
  airConditioning: boolean;
  parking: boolean;
  balcony: boolean;
  amenities: string[];
  // Step 5
  photos: GalleryPhotoItem[];
  primaryPhotoId: string;
  // Step 6
  has3dTour: boolean;
  tourMode: 'none' | 'model_3d' | 'panorama_360';
  tour3dLabel: string;
  model3dUrl: string;
  model3dName: string;
  model3dSizeBytes?: number;
  panoramaUrl: string;
  panoramaName: string;
  virtualTourUrl: string;
  tourRooms: TourRoom[];
  tourHotspots: TourHotspot[];
  tourAutoRotate: boolean;
  tourDefaultFov: number;
  tourExposure: number;
  // Step 7
  contactName: string;
  contactPhone: string;
  contactMethod: ContactMethod;
}

export const DEFAULT_WIZARD_DRAFT: ListingWizardDraft = {
  editingId: null,
  status: 'draft',
  dealType: 'sale',
  propertyType: 'apartment',
  title: '',
  bedrooms: '3',
  bathrooms: '2',
  areaSqm: '',
  floor: '4',
  totalFloors: '12',
  description: '',
  country: 'Uzbekistan',
  city: 'Ташкент',
  customCity: '',
  district: '',
  address: '',
  latitude: UZBEKISTAN_CITY_COORDS['Ташкент'].lat,
  longitude: UZBEKISTAN_CITY_COORDS['Ташкент'].lng,
  priceCurrency: 'USD',
  priceAmount: '',
  monthlyRentAmount: '',
  renovation: 'designer',
  furnished: true,
  heating: 'individual',
  airConditioning: true,
  parking: true,
  balcony: true,
  amenities: ['Охрана 24/7', 'Панорамные окна'],
  photos: [
    {
      id: 'preset-1',
      url: '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg',
      name: 'Гостиная и панорамные окна',
    },
  ],
  primaryPhotoId: 'preset-1',
  has3dTour: false,
  tourMode: 'none',
  tour3dLabel: '',
  model3dUrl: '',
  model3dName: '',
  model3dSizeBytes: undefined,
  panoramaUrl: '',
  panoramaName: '',
  virtualTourUrl: '',
  tourRooms: [],
  tourHotspots: [],
  tourAutoRotate: false,
  tourDefaultFov: 75,
  tourExposure: 1.05,
  contactName: '',
  contactPhone: '',
  contactMethod: 'phone',
};

export function convertToUsd(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'UZS') {
    return Math.max(1, Math.round(amount / USD_TO_UZS_RATE));
  }
  return Math.round(amount);
}

export function convertFromUsd(usdAmount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 0;
  if (currency === 'UZS') {
    return Math.round(usdAmount * USD_TO_UZS_RATE);
  }
  return Math.round(usdAmount);
}

export function validateUzbekistanCoordinates(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= UZBEKISTAN_BOUNDS.minLat &&
    lat <= UZBEKISTAN_BOUNDS.maxLat &&
    lng >= UZBEKISTAN_BOUNDS.minLng &&
    lng <= UZBEKISTAN_BOUNDS.maxLng
  );
}

export const UPLOAD_RULES = {
  photo: {
    maxBytes: 10 * 1024 * 1024,
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPG, PNG или WEBP до 10 МБ',
  },
  model3d: {
    maxBytes: 25 * 1024 * 1024,
    extensions: ['.glb', '.gltf'],
    mimeTypes: ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'application/json', ''],
    label: 'GLB или GLTF до 25 МБ',
  },
  panorama: {
    maxBytes: 15 * 1024 * 1024,
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: '360° JPG, PNG или WEBP до 15 МБ',
  },
} as const;

export function validateUploadFile(
  file: { name: string; type?: string; size: number },
  kind: 'photo' | 'model3d' | 'panorama'
): { valid: boolean; error?: string } {
  const rule = UPLOAD_RULES[kind];
  const lowerName = file.name.toLowerCase();
  const extMatch = rule.extensions.some((ext) => lowerName.endsWith(ext));
  const mime = (file.type ?? '').toLowerCase();
  const mimeMatch = !mime || (rule.mimeTypes as readonly string[]).includes(mime);

  if (!extMatch || !mimeMatch) {
    return {
      valid: false,
      error: `Неподдерживаемый формат файла "${file.name}". Допустимо: ${rule.label}.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: `Файл "${file.name}" пуст.`,
    };
  }
  if (file.size > rule.maxBytes) {
    const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Файл "${file.name}" превышает лимит ${maxMb} МБ.`,
    };
  }
  return { valid: true };
}

export function setPrimaryPhoto(
  photos: GalleryPhotoItem[],
  photoId: string
): { photos: GalleryPhotoItem[]; primaryPhotoId: string } {
  if (!photos.some((p) => p.id === photoId)) {
    return { photos, primaryPhotoId: photos[0]?.id ?? '' };
  }
  return { photos, primaryPhotoId: photoId };
}

export function movePhoto(
  photos: GalleryPhotoItem[],
  index: number,
  direction: -1 | 1
): GalleryPhotoItem[] {
  const target = index + direction;
  if (index < 0 || index >= photos.length || target < 0 || target >= photos.length) {
    return photos;
  }
  const next = [...photos];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

export function removePhoto(
  photos: GalleryPhotoItem[],
  currentPrimaryId: string,
  photoId: string
): { photos: GalleryPhotoItem[]; primaryPhotoId: string } {
  const next = photos.filter((p) => p.id !== photoId);
  const nextPrimary =
    currentPrimaryId === photoId || !next.some((p) => p.id === currentPrimaryId)
      ? next[0]?.id ?? ''
      : currentPrimaryId;
  return { photos: next, primaryPhotoId: nextPrimary };
}

export function parseGalleryImages(raw: string | undefined, fallbackImageUrl: string): string[] {
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const urls = parsed
          .map((item) => (typeof item === 'string' ? item : item?.url))
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
        if (urls.length > 0) return urls;
      }
    }
  } catch {
    // ignore malformed json
  }
  return fallbackImageUrl ? [fallbackImageUrl] : [];
}

export function validateWizardStep(step: number, draft: ListingWizardDraft): string | null {
  switch (step) {
    case 1: {
      if (draft.title.trim().length < 3) {
        return 'Укажите название объекта (минимум 3 символа).';
      }
      const area = Number(draft.areaSqm);
      if (!Number.isFinite(area) || area < 10) {
        return 'Укажите корректную площадь объекта (от 10 м²).';
      }
      const floor = Number(draft.floor) || 1;
      const totalFloors = Number(draft.totalFloors) || 1;
      if (floor < 1 || totalFloors < floor) {
        return 'Этаж не может превышать этажность здания.';
      }
      if (draft.description.trim().length < 15) {
        return 'Добавьте описание объекта (минимум 15 символов).';
      }
      if (draft.contactName.trim().length < 2) {
        return draft.dealType === 'rent'
          ? 'Укажите имя арендодателя.'
          : 'Укажите имя продавца или агента.';
      }
      const digits = draft.contactPhone.replace(/\D/g, '');
      if (digits.length < 9) {
        return draft.dealType === 'rent'
          ? 'Укажите номер телефона арендодателя (например, +998 90 123 45 67).'
          : 'Укажите номер телефона продавца (например, +998 90 123 45 67).';
      }
      return null;
    }
    case 2: {
      const effectiveCity = draft.city === '__other__' ? draft.customCity : draft.city;
      const loc = validateUzbekistanLocation({
        country: draft.country,
        city: effectiveCity,
        district: draft.district,
        address: draft.address,
      });
      if (!loc.valid) {
        return loc.error ?? 'Проверьте адрес объекта в Узбекистане.';
      }
      if (!validateUzbekistanCoordinates(draft.latitude, draft.longitude)) {
        return 'Координаты на карте должны находиться в пределах Республики Узбекистан.';
      }
      return null;
    }
    case 3: {
      const amount = Number(draft.priceAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return 'Укажите корректную стоимость объекта.';
      }
      if (draft.dealType === 'rent') {
        const rentVal = Number(draft.monthlyRentAmount || draft.priceAmount);
        if (!Number.isFinite(rentVal) || rentVal <= 0) {
          return 'Укажите стоимость аренды за месяц.';
        }
      }
      return null;
    }
    case 4:
      return null;
    case 5: {
      if (draft.photos.length === 0) {
        return 'Добавьте хотя бы одну фотографию объекта.';
      }
      return null;
    }
    case 6: {
      const url = draft.virtualTourUrl.trim();
      if (url && !/^https?:\/\//i.test(url) && !url.startsWith('/')) {
        return 'Ссылка на виртуальный тур должна начинаться с https:// или /.';
      }
      return null;
    }
    case 7: {
      if (draft.contactName.trim().length < 2) {
        return 'Укажите контактное имя продавца или агента.';
      }
      const digits = draft.contactPhone.replace(/\D/g, '');
      if (digits.length < 9) {
        return 'Укажите корректный номер телефона (например, +998 90 123 45 67).';
      }
      return null;
    }
    case 8: {
      for (let s = 1; s <= 7; s++) {
        const err = validateWizardStep(s, draft);
        if (err) return `Шаг ${s}: ${err}`;
      }
      return null;
    }
    default:
      return null;
  }
}

export function propertyToWizardDraft(property: PropertyListing): ListingWizardDraft {
  const galleryUrls = parseGalleryImages(property.galleryImages, property.imageUrl);
  const photos: GalleryPhotoItem[] = galleryUrls.map((url, idx) => ({
    id: `existing-${idx}-${property.id}`,
    url,
    name: idx === 0 ? 'Главное фото' : `Фото ${idx + 1}`,
  }));
  const primaryPhoto =
    photos.find((p) => p.url === property.imageUrl)?.id ?? photos[0]?.id ?? '';

  let amenities: string[] = [];
  try {
    const parsed = JSON.parse(property.amenities || '[]');
    if (Array.isArray(parsed)) amenities = parsed.filter((a) => typeof a === 'string');
  } catch {
    amenities = [];
  }

  const currency: CurrencyCode = property.priceCurrency === 'UZS' ? 'UZS' : 'USD';
  const displayPrice =
    property.originalPrice && property.originalPrice > 0
      ? property.originalPrice
      : convertFromUsd(property.priceUsd, currency);
  const monthlyUsd =
    property.monthlyRentUsd && property.monthlyRentUsd > 0
      ? property.monthlyRentUsd
      : property.dealType === 'rent'
        ? property.priceUsd
        : 0;

  return {
    editingId: property.id,
    status: (property.status as PropertyStatus) || 'active',
    dealType: property.dealType === 'rent' ? 'rent' : 'sale',
    propertyType: (property.propertyType as PropertyType) || 'apartment',
    title: property.title,
    bedrooms: String(property.bedrooms ?? 2),
    bathrooms: String(property.bathrooms ?? 1),
    areaSqm: String(property.areaSqm ?? 100),
    floor: String(property.floor ?? 1),
    totalFloors: String(property.totalFloors ?? 1),
    description: property.description,
    country: 'Uzbekistan',
    city: UZBEKISTAN_CITY_COORDS[property.city] ? property.city : '__other__',
    customCity: UZBEKISTAN_CITY_COORDS[property.city] ? '' : property.city,
    district: property.district,
    address: property.address,
    latitude: property.latitude ?? UZBEKISTAN_CITY_COORDS[property.city]?.lat ?? 41.3111,
    longitude: property.longitude ?? UZBEKISTAN_CITY_COORDS[property.city]?.lng ?? 69.2797,
    priceCurrency: currency,
    priceAmount: String(displayPrice),
    monthlyRentAmount: monthlyUsd > 0 ? String(convertFromUsd(monthlyUsd, currency)) : '',
    renovation: (property.renovation as RenovationType) || 'designer',
    furnished: Boolean(property.furnished),
    heating: (property.heating as HeatingType) || 'individual',
    airConditioning: property.airConditioning ?? true,
    parking: Boolean(property.parking),
    balcony: property.balcony ?? true,
    amenities,
    photos,
    primaryPhotoId: primaryPhoto,
    has3dTour: Boolean(property.has3dTour),
    tourMode:
      property.tourRooms && property.tourRooms.length > 0
        ? 'panorama_360'
        : property.model3dUrl
          ? 'model_3d'
          : 'none',
    tour3dLabel: property.tour3dLabel || '',
    model3dUrl: property.model3dUrl || '',
    model3dName: property.model3dUrl ? property.model3dUrl.split('/').pop() || 'model.glb' : '',
    model3dSizeBytes: undefined,
    panoramaUrl: property.panoramaUrl || '',
    panoramaName: property.panoramaUrl ? property.panoramaUrl.split('/').pop() || 'panorama.jpg' : '',
    virtualTourUrl: property.virtualTourUrl || '',
    tourRooms: Array.isArray(property.tourRooms) ? property.tourRooms : [],
    tourHotspots: Array.isArray(property.tourHotspots) ? property.tourHotspots : [],
    tourAutoRotate: Boolean(property.tourConfig?.autoRotate),
    tourDefaultFov: property.tourConfig?.defaultFov ?? 75,
    tourExposure: property.tourConfig?.exposure ?? 1.05,
    contactName: property.contactName || property.ownerName || '',
    contactPhone: property.contactPhone || property.ownerPhone || '',
    contactMethod: (property.contactMethod as ContactMethod) || 'phone',
  };
}
