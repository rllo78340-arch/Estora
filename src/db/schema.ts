import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default('ESTORA Member'),
  role: text('role').notNull().default('buyer'),
  phone: text('phone').notNull().default(''),
  sellerRatingTenths: integer('seller_rating_tenths').notNull().default(49), // 49 => 4.9
  preferredCity: text('preferred_city').notNull().default('Ташкент'),
  preferredCurrency: text('preferred_currency').notNull().default('USD'),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  isBlocked: boolean('is_blocked').notNull().default(false),
  blockedReason: text('blocked_reason').notNull().default(''),
  blockedAt: timestamp('blocked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  baseListingFeeUsd: integer('base_listing_fee_usd').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  country: text('country').notNull().default('Uzbekistan'),
  dealType: text('deal_type').notNull(), // 'sale' | 'rent'
  propertyType: text('property_type').notNull(), // 9 Uzbekistan categories
  city: text('city').notNull(),
  district: text('district').notNull(),
  address: text('address').notNull(),
  latitude: doublePrecision('latitude').notNull().default(41.3111),
  longitude: doublePrecision('longitude').notNull().default(69.2797),
  priceUsd: integer('price_usd').notNull(),
  priceCurrency: text('price_currency').notNull().default('USD'), // 'USD' | 'UZS'
  originalPrice: integer('original_price').notNull().default(0),
  monthlyRentUsd: integer('monthly_rent_usd').notNull().default(0),
  areaSqm: integer('area_sqm').notNull(),
  bedrooms: integer('bedrooms').notNull().default(2),
  bathrooms: integer('bathrooms').notNull().default(1),
  floor: integer('floor').notNull().default(1),
  totalFloors: integer('total_floors').notNull().default(1),
  renovation: text('renovation').notNull().default('designer'), // 'designer' | 'euro' | 'cosmetic' | 'shell'
  furnished: boolean('furnished').notNull().default(false),
  heating: text('heating').notNull().default('individual'), // 'central' | 'individual' | 'underfloor' | 'none'
  airConditioning: boolean('air_conditioning').notNull().default(true),
  parking: boolean('parking').notNull().default(false),
  balcony: boolean('balcony').notNull().default(true),
  has3dTour: boolean('has_3d_tour').notNull().default(false),
  tour3dLabel: text('tour_3d_label').notNull().default(''),
  model3dUrl: text('model_3d_url').notNull().default(''),
  panoramaUrl: text('panorama_url').notNull().default(''),
  virtualTourUrl: text('virtual_tour_url').notNull().default(''),
  status: text('status').notNull().default('pending'), // 'draft' | 'pending' | 'active' | 'rejected' | 'archived'
  isVerified: boolean('is_verified').notNull().default(false),
  moderationStatus: text('moderation_status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'flagged'
  moderationNotes: text('moderation_notes').notNull().default('[]'),
  moderationScore: integer('moderation_score').notNull().default(100),
  rejectionReason: text('rejection_reason').notNull().default(''),
  isFeatured: boolean('is_featured').notNull().default(false),
  featuredUntil: timestamp('featured_until'),
  viewsCount: integer('views_count').notNull().default(0),
  imageUrl: text('image_url').notNull(),
  galleryImages: text('gallery_images').notNull().default('[]'),
  description: text('description').notNull(),
  amenities: text('amenities').notNull().default('[]'),
  contactName: text('contact_name').notNull().default(''),
  contactPhone: text('contact_phone').notNull().default(''),
  contactMethod: text('contact_method').notNull().default('phone'), // 'phone' | 'telegram' | 'whatsapp' | 'messages'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  kind: text('kind').notNull(), // 'photo' | 'model3d' | 'panorama'
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tour3dTours = pgTable('tour_3d_tours', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id')
    .references(() => properties.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  contentType: text('content_type').notNull().default('none'), // 'model_3d' | 'panorama_360' | 'virtual_tour' | 'none'
  filePath: text('file_path').notNull().default(''),
  processingStatus: text('processing_status').notNull().default('ready'), // 'uploading' | 'processing' | 'ready' | 'failed'
  autoRotate: boolean('auto_rotate').notNull().default(false),
  defaultFov: integer('default_fov').notNull().default(75),
  exposure: doublePrecision('exposure').notNull().default(1.05),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tour3dRooms = pgTable('tour_3d_rooms', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id')
    .references(() => properties.id, { onDelete: 'cascade' })
    .notNull(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  roomKey: text('room_key').notNull(),
  roomName: text('room_name').notNull(),
  roomOrder: integer('room_order').notNull().default(0),
  filePath: text('file_path').notNull(),
  contentType: text('content_type').notNull().default('panorama_360'),
  processingStatus: text('processing_status').notNull().default('ready'),
  initialYaw: doublePrecision('initial_yaw').notNull().default(0),
  initialPitch: doublePrecision('initial_pitch').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tour3dHotspots = pgTable('tour_3d_hotspots', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id')
    .references(() => properties.id, { onDelete: 'cascade' })
    .notNull(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fromRoomKey: text('from_room_key').notNull(),
  targetRoomKey: text('target_room_key').notNull(),
  label: text('label').notNull(),
  yaw: doublePrecision('yaw').notNull().default(0),
  pitch: doublePrecision('pitch').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: integer('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('favorites_user_property_idx').on(table.userId, table.propertyId)]
);

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
  senderId: integer('sender_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  recipientId: integer('recipient_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  imageUrl: text('image_url').notNull().default(''),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedFilters = pgTable('saved_filters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  filtersJson: text('filters_json').notNull().default('{}'),
  notifyOnMatch: boolean('notify_on_match').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  queryText: text('query_text').notNull().default(''),
  filtersJson: text('filters_json').notNull().default('{}'),
  resultsCount: integer('results_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const viewHistory = pgTable(
  'view_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    propertyId: integer('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('view_history_user_property_idx').on(table.userId, table.propertyId)]
);

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  sellerReply: text('seller_reply').notNull().default(''),
  sellerRepliedAt: timestamp('seller_replied_at'),
  reportsCount: integer('reports_count').notNull().default(0),
  status: text('status').notNull().default('visible'), // 'visible' | 'flagged' | 'hidden'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const reviewReports = pgTable(
  'review_reports',
  {
    id: serial('id').primaryKey(),
    reviewId: integer('review_id')
      .references(() => reviews.id, { onDelete: 'cascade' })
      .notNull(),
    reporterId: integer('reporter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reason: text('reason').notNull(),
    details: text('details').notNull().default(''),
    status: text('status').notNull().default('pending'), // 'pending' | 'reviewed' | 'dismissed'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('review_reports_review_reporter_idx').on(table.reviewId, table.reporterId)]
);

export const propertyReports = pgTable(
  'property_reports',
  {
    id: serial('id').primaryKey(),
    propertyId: integer('property_id')
      .references(() => properties.id, { onDelete: 'cascade' })
      .notNull(),
    reporterId: integer('reporter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reason: text('reason').notNull(), // 'fake_location' | 'wrong_price' | 'scam' | 'duplicate' | 'sold' | 'other'
    details: text('details').notNull().default(''),
    status: text('status').notNull().default('pending'), // 'pending' | 'resolved' | 'dismissed'
    adminNote: text('admin_note').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('property_reports_prop_reporter_idx').on(table.propertyId, table.reporterId)]
);

export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  orderCode: text('order_code').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  propertyId: integer('property_id').references(() => properties.id, { onDelete: 'set null' }),
  serviceType: text('service_type').notNull(), // 'featured_7d' | 'featured_30d' | 'priority_verification' | 'tour_3d_pro'
  provider: text('provider').notNull(), // 'payme' | 'click' | 'uzcard_humo'
  amountUzs: integer('amount_uzs').notNull(),
  amountUsd: integer('amount_usd').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'awaiting_confirmation' | 'paid' | 'failed' | 'cancelled'
  externalTransactionId: text('external_transaction_id').notNull().default(''),
  maskedCardSummary: text('masked_card_summary').notNull().default(''),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userDesigns = pgTable('user_designs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  propertyId: integer('property_id')
    .references(() => properties.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('Мой дизайн интерьера'),
  designJson: text('design_json').notNull().default('{}'),
  thumbnailUrl: text('thumbnail_url').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // 'new_message' | 'listing_reply' | 'status_changed' | 'new_match' | 'review_reply'
  title: text('title').notNull(),
  body: text('body').notNull(),
  linkPath: text('link_path').notNull().default('/'),
  relatedPropertyId: integer('related_property_id'),
  relatedEntityId: integer('related_entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userDesignsRelations = relations(userDesigns, ({ one }) => ({
  user: one(users, {
    fields: [userDesigns.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [userDesigns.propertyId],
    references: [properties.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
  mediaAssets: many(mediaAssets),
  tour3dTours: many(tour3dTours),
  tour3dRooms: many(tour3dRooms),
  tour3dHotspots: many(tour3dHotspots),
  favorites: many(favorites),
  sentMessages: many(messages, { relationName: 'sender' }),
  receivedMessages: many(messages, { relationName: 'recipient' }),
  savedFilters: many(savedFilters),
  searchHistory: many(searchHistory),
  viewHistory: many(viewHistory),
  reviewsReceived: many(reviews, { relationName: 'sellerReviews' }),
  reviewsAuthored: many(reviews, { relationName: 'authorReviews' }),
  propertyReports: many(propertyReports),
  paymentTransactions: many(paymentTransactions),
  notifications: many(notifications),
  userDesigns: many(userDesigns),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
  }),
  tour3d: one(tour3dTours, {
    fields: [properties.id],
    references: [tour3dTours.propertyId],
  }),
  tourRooms: many(tour3dRooms),
  tourHotspots: many(tour3dHotspots),
  favorites: many(favorites),
  messages: many(messages),
  viewHistory: many(viewHistory),
  reviews: many(reviews),
  reports: many(propertyReports),
  paymentTransactions: many(paymentTransactions),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [favorites.propertyId],
    references: [properties.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  property: one(properties, {
    fields: [messages.propertyId],
    references: [properties.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  recipient: one(users, {
    fields: [messages.recipientId],
    references: [users.id],
    relationName: 'recipient',
  }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  seller: one(users, {
    fields: [reviews.sellerId],
    references: [users.id],
    relationName: 'sellerReviews',
  }),
  author: one(users, {
    fields: [reviews.authorId],
    references: [users.id],
    relationName: 'authorReviews',
  }),
  property: one(properties, {
    fields: [reviews.propertyId],
    references: [properties.id],
  }),
  reports: many(reviewReports),
}));

export const propertyReportsRelations = relations(propertyReports, ({ one }) => ({
  property: one(properties, {
    fields: [propertyReports.propertyId],
    references: [properties.id],
  }),
  reporter: one(users, {
    fields: [propertyReports.reporterId],
    references: [users.id],
  }),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  user: one(users, {
    fields: [paymentTransactions.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [paymentTransactions.propertyId],
    references: [properties.id],
  }),
}));
