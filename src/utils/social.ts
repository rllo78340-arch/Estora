import type {
  MessageRecord,
  MessageThreadSummary,
  PropertyFilters,
  PropertyListing,
} from '../types/estora.ts';

export function isSafeMessageImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (!trimmed.startsWith('/uploads/')) return false;
  if (trimmed.includes('..') || trimmed.includes('<') || trimmed.includes('>')) return false;
  return /\.(png|jpe?g|webp|gif)$/i.test(trimmed);
}

export function validateMessagePayload(input: {
  subject?: string;
  body?: string;
  imageUrl?: string;
}): { valid: boolean; error?: string; cleanSubject: string; cleanBody: string; cleanImageUrl: string } {
  const cleanSubject = typeof input.subject === 'string' ? input.subject.trim().slice(0, 140) : '';
  const cleanBody = typeof input.body === 'string' ? input.body.trim().slice(0, 4000) : '';
  const cleanImageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  if (cleanImageUrl && !isSafeMessageImageUrl(cleanImageUrl)) {
    return {
      valid: false,
      error: 'Разрешены только проверенные изображения, загруженные на платформу ESTORA.',
      cleanSubject,
      cleanBody,
      cleanImageUrl: '',
    };
  }

  if (!cleanBody && !cleanImageUrl) {
    return {
      valid: false,
      error: 'Введите текст сообщения или прикрепите фотографию.',
      cleanSubject,
      cleanBody,
      cleanImageUrl,
    };
  }

  return {
    valid: true,
    cleanSubject: cleanSubject || 'Сообщение по недвижимости',
    cleanBody: cleanBody || (cleanImageUrl ? 'Фотография' : ''),
    cleanImageUrl,
  };
}

export function validateReviewPayload(input: {
  sellerId: number;
  authorId: number;
  rating: number;
  comment: string;
}): { valid: boolean; error?: string; rating: number; comment: string } {
  const rating = Math.round(Number(input.rating));
  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';

  if (!Number.isInteger(input.sellerId) || input.sellerId <= 0) {
    return { valid: false, error: 'Не указан продавец.', rating: 5, comment };
  }
  if (input.sellerId === input.authorId) {
    return { valid: false, error: 'Нельзя оставить отзыв самому себе.', rating: 5, comment };
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { valid: false, error: 'Выберите оценку от 1 до 5 звёзд.', rating: 5, comment };
  }
  if (comment.length < 5 || comment.length > 1500) {
    return {
      valid: false,
      error: 'Текст отзыва должен содержать от 5 до 1500 символов.',
      rating,
      comment,
    };
  }

  return { valid: true, rating, comment };
}

export function computeAverageSellerRatingTenths(ratings: number[]): number {
  const clean = ratings.filter((r) => Number.isFinite(r) && r >= 1 && r <= 5);
  if (clean.length === 0) return 49;
  const avg = clean.reduce((sum, val) => sum + val, 0) / clean.length;
  return Math.max(10, Math.min(50, Math.round(avg * 10)));
}

export function buildThreadKey(otherUserId: number, propertyId: number | null): string {
  return `${otherUserId}:${propertyId ?? 0}`;
}

export function groupMessagesIntoThreads(
  items: MessageRecord[],
  currentUserId: number
): MessageThreadSummary[] {
  const map = new Map<string, MessageThreadSummary>();

  for (const msg of items) {
    const isOutgoing = msg.senderId === currentUserId;
    const otherUserId = isOutgoing ? msg.recipientId : msg.senderId;
    const otherUserName = isOutgoing
      ? msg.recipientName || `Пользователь #${otherUserId}`
      : msg.senderName || `Пользователь #${otherUserId}`;
    const propertyId = msg.propertyId ?? null;
    const threadKey = buildThreadKey(otherUserId, propertyId);

    const existing = map.get(threadKey);
    const isUnreadIncoming = !isOutgoing && !msg.isRead;
    const msgTime = new Date(msg.createdAt).getTime();

    if (!existing) {
      map.set(threadKey, {
        threadKey,
        otherUserId,
        otherUserName,
        propertyId,
        propertyTitle: msg.propertyTitle ?? null,
        subject: msg.subject,
        lastMessage: msg,
        unreadCount: isUnreadIncoming ? 1 : 0,
        totalCount: 1,
      });
    } else {
      existing.totalCount += 1;
      if (isUnreadIncoming) existing.unreadCount += 1;
      const existingTime = new Date(existing.lastMessage.createdAt).getTime();
      if (msgTime > existingTime) {
        existing.lastMessage = msg;
        if (msg.propertyTitle && !existing.propertyTitle) {
          existing.propertyTitle = msg.propertyTitle;
        }
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
  );
}

export function parseSavedFiltersJson(raw: string): PropertyFilters {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PropertyFilters;
  } catch {
    return {};
  }
}

export function matchesSavedFilter(
  property: Pick<
    PropertyListing,
    | 'status'
    | 'country'
    | 'dealType'
    | 'propertyType'
    | 'city'
    | 'district'
    | 'priceUsd'
    | 'areaSqm'
    | 'bedrooms'
    | 'has3dTour'
    | 'renovation'
    | 'furnished'
    | 'parking'
    | 'title'
    | 'description'
  >,
  filters: PropertyFilters
): boolean {
  if (property.status !== 'active') return false;
  if (property.country && property.country !== 'Uzbekistan') return false;

  if (filters.dealType && filters.dealType !== 'all' && property.dealType !== filters.dealType) {
    return false;
  }
  if (
    filters.propertyType &&
    filters.propertyType !== 'all' &&
    property.propertyType !== filters.propertyType
  ) {
    return false;
  }
  if (filters.city && filters.city !== 'all' && property.city !== filters.city) {
    return false;
  }
  if (filters.district && filters.district.trim()) {
    const needle = filters.district.trim().toLowerCase();
    if (!property.district.toLowerCase().includes(needle)) return false;
  }
  if (filters.rooms && filters.rooms !== 'all') {
    if (filters.rooms === '5+') {
      if (property.bedrooms < 5) return false;
    } else {
      const targetRooms = Number(filters.rooms);
      if (!Number.isNaN(targetRooms) && property.bedrooms !== targetRooms) return false;
    }
  }
  if (filters.minPrice && !Number.isNaN(Number(filters.minPrice))) {
    if (property.priceUsd < Number(filters.minPrice)) return false;
  }
  if (filters.maxPrice && !Number.isNaN(Number(filters.maxPrice))) {
    if (property.priceUsd > Number(filters.maxPrice)) return false;
  }
  if (filters.minArea && !Number.isNaN(Number(filters.minArea))) {
    if (property.areaSqm < Number(filters.minArea)) return false;
  }
  if (filters.maxArea && !Number.isNaN(Number(filters.maxArea))) {
    if (property.areaSqm > Number(filters.maxArea)) return false;
  }
  if (filters.has3dTour && !property.has3dTour) {
    return false;
  }
  if (filters.renovation && filters.renovation !== 'all' && property.renovation !== filters.renovation) {
    return false;
  }
  if (filters.furnished === 'true' && !property.furnished) return false;
  if (filters.furnished === 'false' && property.furnished) return false;
  if (filters.parking === 'true' && !property.parking) return false;
  if (filters.parking === 'false' && property.parking) return false;

  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().toLowerCase();
    const haystack = `${property.title} ${property.city} ${property.district} ${property.description}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }

  return true;
}

export function summarizeSellerPortfolioStats(
  items: Array<{ status: string; viewsCount?: number | null; favoritesCount?: number | null }>
) {
  let totalViews = 0;
  let totalFavorites = 0;
  let activeCount = 0;
  let pendingCount = 0;
  let draftCount = 0;
  let archivedCount = 0;

  for (const item of items) {
    totalViews += Number(item.viewsCount ?? 0);
    totalFavorites += Number(item.favoritesCount ?? 0);
    if (item.status === 'active') activeCount += 1;
    else if (item.status === 'pending') pendingCount += 1;
    else if (item.status === 'draft') draftCount += 1;
    else if (item.status === 'archived') archivedCount += 1;
  }

  return {
    totalListings: items.length,
    totalViews,
    totalFavorites,
    activeCount,
    pendingCount,
    draftCount,
    archivedCount,
  };
}
