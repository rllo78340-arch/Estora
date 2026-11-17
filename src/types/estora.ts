export type DealType = 'sale' | 'rent';
export type PropertyType =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'penthouse'
  | 'new_build'
  | 'commercial'
  | 'office'
  | 'shop'
  | 'land';

export type RenovationType = 'designer' | 'euro' | 'cosmetic' | 'shell';
export type HeatingType = 'central' | 'individual' | 'underfloor' | 'none';
export type ContactMethod = 'phone' | 'telegram' | 'whatsapp' | 'messages';
export type CurrencyCode = 'USD' | 'UZS';
export type PropertyStatus = 'draft' | 'pending' | 'active' | 'rejected' | 'archived';
export type ModerationStatusType = 'pending' | 'approved' | 'rejected' | 'flagged';
export type PropertyReportReason =
  | 'fake_location'
  | 'wrong_price'
  | 'scam'
  | 'duplicate'
  | 'sold'
  | 'other';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  phone: string;
  sellerRatingTenths?: number;
  preferredCity: string;
  preferredCurrency: CurrencyCode | string;
  notificationsEnabled: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface CategoryRecord {
  id: number;
  slug: PropertyType | string;
  isActive: boolean;
  sortOrder: number;
  baseListingFeeUsd: number;
}

export interface PropertyReportRecord {
  id: number;
  propertyId: number;
  propertyTitle?: string | null;
  propertyCity?: string | null;
  reporterId: number;
  reporterName?: string | null;
  reason: PropertyReportReason | string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed' | string;
  adminNote: string;
  createdAt: string;
}

export interface PaymentTransactionRecord {
  id: number;
  orderCode: string;
  userId: number;
  userName?: string | null;
  propertyId: number | null;
  propertyTitle?: string | null;
  serviceType: 'featured_7d' | 'featured_30d' | 'priority_verification' | 'tour_3d_pro' | string;
  provider: 'payme' | 'click' | 'uzcard_humo' | string;
  amountUzs: number;
  amountUsd: number;
  status: 'pending' | 'awaiting_confirmation' | 'paid' | 'failed' | 'cancelled' | string;
  externalTransactionId: string;
  maskedCardSummary: string;
  paidAt: string | null;
  createdAt: string;
}

export interface PaidServiceOption {
  id: 'featured_7d' | 'featured_30d' | 'priority_verification' | 'tour_3d_pro';
  priceUsd: number;
  priceUzs: number;
  durationDays: number;
}

export interface AdminUserRecord extends UserProfile {
  isBlocked: boolean;
  blockedReason: string;
  blockedAt: string | null;
  createdAt: string;
  listingsCount: number;
}

export type Tour3DContentType = 'none' | 'model_3d' | 'panorama_360' | 'virtual_tour';

export interface Tour3DConfig {
  contentType: Tour3DContentType;
  filePath?: string;
  processingStatus?: 'uploading' | 'processing' | 'ready' | 'failed' | string;
  autoRotate?: boolean;
  defaultFov?: number;
  exposure?: number;
}

export interface TourRoom {
  id?: number;
  roomKey: string;
  roomName: string;
  roomOrder: number;
  filePath: string;
  contentType?: string;
  processingStatus?: string;
  initialYaw?: number;
  initialPitch?: number;
}

export interface TourHotspot {
  id?: number;
  fromRoomKey: string;
  targetRoomKey: string;
  label: string;
  yaw: number;
  pitch: number;
}

export interface PropertyListing {
  id: number;
  ownerId: number;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  sellerRatingTenths?: number | null;
  title: string;
  slug: string;
  country?: string;
  dealType: DealType | string;
  propertyType: PropertyType | string;
  city: string;
  district: string;
  address: string;
  latitude?: number;
  longitude?: number;
  priceUsd: number;
  priceCurrency?: CurrencyCode | string;
  originalPrice?: number;
  monthlyRentUsd?: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  totalFloors: number;
  renovation?: RenovationType | string;
  furnished?: boolean;
  heating?: HeatingType | string;
  airConditioning?: boolean;
  parking?: boolean;
  balcony?: boolean;
  has3dTour: boolean;
  tour3dLabel: string;
  model3dUrl?: string;
  panoramaUrl?: string;
  virtualTourUrl?: string;
  tourConfig?: Tour3DConfig | null;
  tourRooms?: TourRoom[];
  tourHotspots?: TourHotspot[];
  status: PropertyStatus | string;
  isVerified?: boolean;
  moderationStatus?: ModerationStatusType | string;
  moderationNotes?: string;
  moderationScore?: number;
  rejectionReason?: string;
  isFeatured: boolean;
  featuredUntil?: string | null;
  viewsCount?: number;
  imageUrl: string;
  galleryImages?: string;
  description: string;
  amenities: string;
  contactName?: string;
  contactPhone?: string;
  contactMethod?: ContactMethod | string;
  createdAt: string;
}

export interface PaginatedPropertiesResponse {
  properties: PropertyListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CityStat {
  city: string;
  count: number;
  minPriceUsd: number;
}

export interface FavoriteRecord {
  favoriteId: number;
  propertyId: number;
  title: string;
  dealType: string;
  propertyType: string;
  city: string;
  district: string;
  address: string;
  priceUsd: number;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  floor?: number;
  totalFloors?: number;
  renovation?: string;
  furnished?: boolean;
  parking?: boolean;
  has3dTour: boolean;
  imageUrl: string;
  description: string;
  contactName?: string;
  contactPhone?: string;
  contactMethod?: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  createdAt: string;
}

export interface MessageRecord {
  id: number;
  propertyId: number | null;
  propertyTitle?: string | null;
  senderId: number;
  recipientId: number;
  senderName?: string | null;
  recipientName?: string | null;
  subject: string;
  body: string;
  imageUrl?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface MessageThreadSummary {
  threadKey: string;
  otherUserId: number;
  otherUserName: string;
  propertyId: number | null;
  propertyTitle?: string | null;
  subject: string;
  lastMessage: MessageRecord;
  unreadCount: number;
  totalCount: number;
}

export interface SavedFilterRecord {
  id: number;
  userId: number;
  name: string;
  filtersJson: string;
  notifyOnMatch: boolean;
  createdAt: string;
}

export interface SearchHistoryRecord {
  id: number;
  userId: number;
  queryText: string;
  filtersJson: string;
  resultsCount: number;
  createdAt: string;
}

export interface ViewHistoryRecord {
  id: number;
  propertyId: number;
  viewedAt: string;
  property: PropertyListing;
}

export type ReviewStatus = 'visible' | 'flagged' | 'hidden';
export type ReviewReportReason = 'spam' | 'inaccurate' | 'offensive' | 'fraud' | 'other';

export interface SellerReviewRecord {
  id: number;
  sellerId: number;
  sellerName?: string | null;
  authorId: number;
  authorName: string;
  propertyId: number | null;
  propertyTitle?: string | null;
  rating: number;
  comment: string;
  sellerReply: string;
  sellerRepliedAt: string | null;
  reportsCount: number;
  status: ReviewStatus | string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType =
  | 'new_message'
  | 'listing_reply'
  | 'status_changed'
  | 'new_match'
  | 'review_reply';

export interface NotificationRecord {
  id: number;
  userId: number;
  type: NotificationType | string;
  title: string;
  body: string;
  linkPath: string;
  relatedPropertyId: number | null;
  relatedEntityId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface SellerPropertyStatsItem extends PropertyListing {
  favoritesCount: number;
  incomingMessagesCount: number;
}

export interface CabinetOverviewResponse {
  favorites: FavoriteRecord[];
  searchHistory: SearchHistoryRecord[];
  savedFilters: SavedFilterRecord[];
  viewHistory: ViewHistoryRecord[];
  reviewsAuthored: SellerReviewRecord[];
  reviewsReceived: SellerReviewRecord[];
  sellerAverageRatingTenths: number;
  myProperties: SellerPropertyStatsItem[];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
}

export interface PropertyFilters {
  dealType?: string;
  propertyType?: string;
  city?: string;
  district?: string;
  rooms?: string;
  minPrice?: string;
  maxPrice?: string;
  minArea?: string;
  maxArea?: string;
  minFloor?: string;
  maxFloor?: string;
  renovation?: string;
  furnished?: string; // 'all' | 'true' | 'false'
  parking?: string; // 'all' | 'true' | 'false'
  has3dTour?: boolean;
  publishedWithin?: string; // 'all' | '24h' | '7d' | '30d'
  q?: string;
  sort?: string; // 'newest' | 'price_asc' | 'price_desc' | 'popular'
  page?: number;
  pageSize?: number;
}

import type { UiLanguage } from '../i18n/types.ts';

export type AiLanguage = UiLanguage;
export type AiIntent = 'search' | 'compare' | 'advisory' | 'clarify';

export interface AiPersonalizationSettings {
  enabled: boolean;
  language: AiLanguage;
  preferredCity?: string;
  budgetUsd?: number;
  preferredPropertyType?: string;
  preferredRooms?: string;
  recentSearches: string[];
  favoritePropertyIds: number[];
}

export interface AiRecommendationItem {
  propertyId: number;
  reason: string;
  property: PropertyListing;
}

export interface AiComparisonMetrics {
  cheapestId: number;
  largestId: number;
  bestValueId: number;
  pricePerSqmById: Record<number, number>;
  has3dIds: number[];
}

export interface AiPreferenceSuggestion {
  preferredCity?: string;
  budgetUsd?: number;
  preferredPropertyType?: string;
  preferredRooms?: string;
  summary: string;
}

export interface AiAgentResponse {
  reply: string;
  configured: boolean;
  intent: AiIntent;
  language: AiLanguage;
  appliedFilters: PropertyFilters;
  catalogUrl: string;
  totalCatalogMatches: number;
  recommendations: AiRecommendationItem[];
  comparedProperties: PropertyListing[];
  comparisonSummary: string | null;
  comparisonMetrics: AiComparisonMetrics | null;
  clarifyingQuestions: string[];
  preferenceSuggestion: AiPreferenceSuggestion | null;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  response?: AiAgentResponse;
}

