import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  favorites,
  messages,
  notifications,
  properties,
  reviewReports,
  reviews,
  savedFilters,
  searchHistory,
  users,
  viewHistory,
} from './schema.ts';
import { listProperties, listUserFavorites } from './properties.ts';
import { realtimeHub } from '../realtime/wsHub.ts';
import {
  computeAverageSellerRatingTenths,
  matchesSavedFilter,
  parseSavedFiltersJson,
} from '../utils/social.ts';
import type { NotificationType, ReviewStatus } from '../types/estora.ts';

async function getUserNamesMap(userIds: number[]): Promise<Map<number, string>> {
  const cleanIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (cleanIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(inArray(users.id, cleanIds));
  const map = new Map<number, string>();
  for (const r of rows) {
    map.set(r.id, r.fullName);
  }
  return map;
}

export async function createAndEmitNotification(input: {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  linkPath?: string;
  relatedPropertyId?: number | null;
  relatedEntityId?: number | null;
}) {
  try {
    const userRows = await db
      .select({ notificationsEnabled: users.notificationsEnabled })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);
    if (userRows[0] && userRows[0].notificationsEnabled === false) {
      return null;
    }

    const inserted = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkPath: input.linkPath || '/',
        relatedPropertyId: input.relatedPropertyId ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      })
      .returning();

    const record = inserted[0];
    if (record) {
      realtimeHub.emitToUser(input.userId, {
        type: 'notification:created',
        payload: {
          ...record,
          createdAt: record.createdAt.toISOString(),
        },
      });
    }
    return record;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
}

export async function recordPropertyView(propertyId: number, userId?: number | null) {
  await db
    .update(properties)
    .set({ viewsCount: sql`${properties.viewsCount} + 1` })
    .where(eq(properties.id, propertyId));

  if (userId) {
    await db
      .insert(viewHistory)
      .values({ userId, propertyId, viewedAt: new Date() })
      .onConflictDoUpdate({
        target: [viewHistory.userId, viewHistory.propertyId],
        set: { viewedAt: new Date() },
      });
  }
}

export async function listUserViewHistory(userId: number) {
  const rows = await db
    .select({
      id: viewHistory.id,
      propertyId: viewHistory.propertyId,
      viewedAt: viewHistory.viewedAt,
      property: properties,
      ownerName: users.fullName,
      sellerRatingTenths: users.sellerRatingTenths,
    })
    .from(viewHistory)
    .innerJoin(properties, eq(viewHistory.propertyId, properties.id))
    .leftJoin(users, eq(properties.ownerId, users.id))
    .where(eq(viewHistory.userId, userId))
    .orderBy(desc(viewHistory.viewedAt))
    .limit(30);

  return rows.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    viewedAt: row.viewedAt.toISOString(),
    property: {
      ...row.property,
      ownerName: row.ownerName,
      sellerRatingTenths: row.sellerRatingTenths,
      createdAt: row.property.createdAt.toISOString(),
    },
  }));
}

export async function clearUserViewHistory(userId: number) {
  await db.delete(viewHistory).where(eq(viewHistory.userId, userId));
}

export async function listUserSearchHistory(userId: number) {
  const rows = await db
    .select()
    .from(searchHistory)
    .where(eq(searchHistory.userId, userId))
    .orderBy(desc(searchHistory.createdAt))
    .limit(25);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function recordUserSearchHistory(input: {
  userId: number;
  queryText: string;
  filtersJson: string;
  resultsCount: number;
}) {
  const rows = await db
    .insert(searchHistory)
    .values({
      userId: input.userId,
      queryText: input.queryText.trim().slice(0, 200),
      filtersJson: input.filtersJson || '{}',
      resultsCount: Math.max(0, Number(input.resultsCount) || 0),
    })
    .returning();
  const row = rows[0];
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function deleteUserSearchHistoryItem(userId: number, id: number) {
  await db
    .delete(searchHistory)
    .where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));
}

export async function clearUserSearchHistory(userId: number) {
  await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
}

export async function listUserSavedFilters(userId: number) {
  const rows = await db
    .select()
    .from(savedFilters)
    .where(eq(savedFilters.userId, userId))
    .orderBy(desc(savedFilters.createdAt))
    .limit(30);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createUserSavedFilter(input: {
  userId: number;
  name: string;
  filtersJson: string;
  notifyOnMatch: boolean;
}) {
  const rows = await db
    .insert(savedFilters)
    .values({
      userId: input.userId,
      name: input.name.trim().slice(0, 120),
      filtersJson: input.filtersJson || '{}',
      notifyOnMatch: Boolean(input.notifyOnMatch),
    })
    .returning();
  const row = rows[0];
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function toggleSavedFilterNotify(
  userId: number,
  id: number,
  notifyOnMatch: boolean
) {
  const rows = await db
    .update(savedFilters)
    .set({ notifyOnMatch })
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId)))
    .returning();
  const row = rows[0];
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function deleteUserSavedFilter(userId: number, id: number) {
  await db
    .delete(savedFilters)
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId)));
}

export async function dispatchSavedFilterMatchNotifications(property: {
  id: number;
  ownerId: number;
  status: string;
  country?: string | null;
  dealType: string;
  propertyType: string;
  city: string;
  district: string;
  priceUsd: number;
  areaSqm: number;
  bedrooms: number;
  has3dTour: boolean;
  renovation?: string | null;
  furnished?: boolean | null;
  parking?: boolean | null;
  title: string;
  description: string;
}) {
  if (property.status !== 'active') return 0;

  const allWatchers = await db
    .select()
    .from(savedFilters)
    .where(eq(savedFilters.notifyOnMatch, true));

  const notifiedUsers = new Set<number>();
  for (const watcher of allWatchers) {
    if (watcher.userId === property.ownerId) continue;
    if (notifiedUsers.has(watcher.userId)) continue;

    const parsed = parseSavedFiltersJson(watcher.filtersJson);
    const matches = matchesSavedFilter(
      {
        status: property.status,
        country: property.country ?? 'Uzbekistan',
        dealType: property.dealType,
        propertyType: property.propertyType,
        city: property.city,
        district: property.district,
        priceUsd: property.priceUsd,
        areaSqm: property.areaSqm,
        bedrooms: property.bedrooms,
        has3dTour: property.has3dTour,
        renovation: property.renovation ?? undefined,
        furnished: Boolean(property.furnished),
        parking: Boolean(property.parking),
        title: property.title,
        description: property.description,
      },
      parsed
    );

    if (matches) {
      notifiedUsers.add(watcher.userId);
      await createAndEmitNotification({
        userId: watcher.userId,
        type: 'new_match',
        title: `Новое подходящее объявление: ${property.title}`,
        body: `Совпадение по сохранённому фильтру «${watcher.name}» (${property.city}, $${property.priceUsd.toLocaleString('en-US')}).`,
        linkPath: `/catalog?city=${encodeURIComponent(property.city)}`,
        relatedPropertyId: property.id,
        relatedEntityId: watcher.id,
      });
    }
  }

  return notifiedUsers.size;
}

export async function listUserMessagesEnriched(userId: number) {
  const rows = await db
    .select({
      id: messages.id,
      propertyId: messages.propertyId,
      propertyTitle: properties.title,
      senderId: messages.senderId,
      recipientId: messages.recipientId,
      subject: messages.subject,
      body: messages.body,
      imageUrl: messages.imageUrl,
      isRead: messages.isRead,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(properties, eq(messages.propertyId, properties.id))
    .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
    .orderBy(desc(messages.createdAt));

  const userIds = rows.flatMap((r) => [r.senderId, r.recipientId]);
  const namesMap = await getUserNamesMap(userIds);

  return rows.map((r) => ({
    ...r,
    senderName: namesMap.get(r.senderId) || 'ESTORA Member',
    recipientName: namesMap.get(r.recipientId) || 'ESTORA Member',
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createMessageEnriched(input: {
  senderId: number;
  recipientId: number;
  propertyId?: number | null;
  subject: string;
  body: string;
  imageUrl?: string;
}) {
  const inserted = await db
    .insert(messages)
    .values({
      senderId: input.senderId,
      recipientId: input.recipientId,
      propertyId: input.propertyId ?? null,
      subject: input.subject,
      body: input.body,
      imageUrl: input.imageUrl ?? '',
    })
    .returning();

  const created = inserted[0];
  if (!created) return null;

  const [namesMap, propRows] = await Promise.all([
    getUserNamesMap([created.senderId, created.recipientId]),
    created.propertyId
      ? db
          .select({ title: properties.title, ownerId: properties.ownerId })
          .from(properties)
          .where(eq(properties.id, created.propertyId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const senderName = namesMap.get(created.senderId) || 'ESTORA Member';
  const recipientName = namesMap.get(created.recipientId) || 'ESTORA Member';
  const propertyTitle = propRows[0]?.title ?? null;

  const serialized = {
    ...created,
    propertyTitle,
    senderName,
    recipientName,
    readAt: created.readAt ? created.readAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
  };

  realtimeHub.emitToUsers([created.recipientId, created.senderId], {
    type: 'message:created',
    payload: serialized,
  });

  if (created.recipientId !== created.senderId) {
    const isListingReply = Boolean(created.propertyId);
    const notifType: NotificationType = isListingReply ? 'listing_reply' : 'new_message';
    await createAndEmitNotification({
      userId: created.recipientId,
      type: notifType,
      title: isListingReply
        ? `Ответ по объявлению от ${senderName}`
        : `Новое сообщение от ${senderName}`,
      body: propertyTitle
        ? `${propertyTitle}: ${created.body.slice(0, 120)}`
        : created.body.slice(0, 140),
      linkPath: `/messages?with=${created.senderId}${created.propertyId ? `&propertyId=${created.propertyId}` : ''}`,
      relatedPropertyId: created.propertyId ?? null,
      relatedEntityId: created.id,
    });
  }

  return serialized;
}

export async function markMessagesThreadAsRead(input: {
  readerId: number;
  otherUserId: number;
  propertyId?: number | null;
}) {
  const conditions = [
    eq(messages.recipientId, input.readerId),
    eq(messages.senderId, input.otherUserId),
    eq(messages.isRead, false),
  ];

  if (typeof input.propertyId === 'number' && input.propertyId > 0) {
    conditions.push(eq(messages.propertyId, input.propertyId));
  } else if (input.propertyId === null) {
    conditions.push(sql`${messages.propertyId} IS NULL`);
  }

  const readAt = new Date();
  const updated = await db
    .update(messages)
    .set({ isRead: true, readAt })
    .where(and(...conditions))
    .returning({ id: messages.id, senderId: messages.senderId, propertyId: messages.propertyId });

  if (updated.length > 0) {
    realtimeHub.emitToUsers([input.otherUserId, input.readerId], {
      type: 'message:read',
      payload: {
        readerId: input.readerId,
        senderId: input.otherUserId,
        propertyId: input.propertyId ?? null,
        messageIds: updated.map((u) => u.id),
        readAt: readAt.toISOString(),
      },
    });
  }

  return {
    updatedIds: updated.map((u) => u.id),
    readAt: readAt.toISOString(),
  };
}

export async function seedInitialReviewsIfEmpty() {
  try {
    const existing = await db.select({ id: reviews.id }).from(reviews).limit(1);
    if (existing.length > 0) return;

    const sampleProps = await db
      .select({ id: properties.id, ownerId: properties.ownerId, title: properties.title })
      .from(properties)
      .limit(3);
    const curatorUsers = await db.select({ id: users.id }).from(users).limit(3);
    if (sampleProps.length === 0 || curatorUsers.length === 0) return;

    const ownerId = sampleProps[0].ownerId;
    // Create a reviewer account if only one user exists so seeded review isn't self-review
    let reviewerId = curatorUsers.find((u) => u.id !== ownerId)?.id;
    if (!reviewerId) {
      const insertedUser = await db
        .insert(users)
        .values({
          uid: 'estora-verified-buyer-uz',
          email: 'buyer.tashkent@estora.uz',
          fullName: 'Дилноза Каримова',
          role: 'buyer',
          preferredCity: 'Ташкент',
        })
        .onConflictDoNothing({ target: users.uid })
        .returning({ id: users.id });
      reviewerId = insertedUser[0]?.id;
    }

    if (!reviewerId || reviewerId === ownerId) return;

    await db.insert(reviews).values([
      {
        sellerId: ownerId,
        authorId: reviewerId,
        propertyId: sampleProps[0].id,
        rating: 5,
        comment:
          'Провели показ точно по времени, предоставили полный пакет кадастровых документов и помогли организовать онлайн 3D-осмотр.',
        sellerReply: 'Благодарим за отзыв! Всегда рады помочь с подбором резиденции в Узбекистане.',
        sellerRepliedAt: new Date(Date.now() - 86400 * 1000 * 2),
        status: 'visible',
      },
    ]);
  } catch (err) {
    console.error('Seed initial reviews skipped:', err);
  }
}

async function recalculateSellerRating(sellerId: number) {
  const rows = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.sellerId, sellerId), ne(reviews.status, 'hidden')));

  const tenths = computeAverageSellerRatingTenths(rows.map((r) => r.rating));
  await db
    .update(users)
    .set({ sellerRatingTenths: tenths, updatedAt: new Date() })
    .where(eq(users.id, sellerId));
  return tenths;
}

export async function listSellerReviews(sellerId: number) {
  const rows = await db
    .select({
      id: reviews.id,
      sellerId: reviews.sellerId,
      authorId: reviews.authorId,
      propertyId: reviews.propertyId,
      propertyTitle: properties.title,
      rating: reviews.rating,
      comment: reviews.comment,
      sellerReply: reviews.sellerReply,
      sellerRepliedAt: reviews.sellerRepliedAt,
      reportsCount: reviews.reportsCount,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .leftJoin(properties, eq(reviews.propertyId, properties.id))
    .where(and(eq(reviews.sellerId, sellerId), ne(reviews.status, 'hidden')))
    .orderBy(desc(reviews.createdAt));

  const names = await getUserNamesMap(rows.flatMap((r) => [r.sellerId, r.authorId]));
  const items = rows.map((r) => ({
    ...r,
    sellerName: names.get(r.sellerId) || 'ESTORA Seller',
    authorName: names.get(r.authorId) || 'Покупатель ESTORA',
    sellerRepliedAt: r.sellerRepliedAt ? r.sellerRepliedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const averageRatingTenths = computeAverageSellerRatingTenths(items.map((i) => i.rating));
  return {
    reviews: items,
    averageRatingTenths,
    totalCount: items.length,
  };
}

export async function createSellerReview(input: {
  sellerId: number;
  authorId: number;
  propertyId?: number | null;
  rating: number;
  comment: string;
}) {
  const existing = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.sellerId, input.sellerId), eq(reviews.authorId, input.authorId)))
    .limit(1);

  let saved;
  if (existing[0]) {
    const updated = await db
      .update(reviews)
      .set({
        rating: input.rating,
        comment: input.comment,
        propertyId: input.propertyId ?? existing[0].propertyId,
        status: 'visible',
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, existing[0].id))
      .returning();
    saved = updated[0];
  } else {
    const inserted = await db
      .insert(reviews)
      .values({
        sellerId: input.sellerId,
        authorId: input.authorId,
        propertyId: input.propertyId ?? null,
        rating: input.rating,
        comment: input.comment,
      })
      .returning();
    saved = inserted[0];
  }

  const averageRatingTenths = await recalculateSellerRating(input.sellerId);
  const names = await getUserNamesMap([input.sellerId, input.authorId]);
  const authorName = names.get(input.authorId) || 'Покупатель ESTORA';

  const result = {
    ...saved,
    sellerName: names.get(input.sellerId) || 'ESTORA Seller',
    authorName,
    sellerRepliedAt: saved.sellerRepliedAt ? saved.sellerRepliedAt.toISOString() : null,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };

  realtimeHub.emitToUsers([input.sellerId, input.authorId], {
    type: 'review:updated',
    payload: { sellerId: input.sellerId, averageRatingTenths, review: result },
  });

  return { review: result, averageRatingTenths };
}

export async function replyToSellerReview(input: {
  reviewId: number;
  sellerId: number;
  replyText: string;
}) {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  const existing = rows[0];
  if (!existing) return { status: 'not_found' as const };
  if (existing.sellerId !== input.sellerId) return { status: 'forbidden' as const };

  const repliedAt = new Date();
  const updated = await db
    .update(reviews)
    .set({
      sellerReply: input.replyText.trim(),
      sellerRepliedAt: repliedAt,
      updatedAt: repliedAt,
    })
    .where(eq(reviews.id, input.reviewId))
    .returning();

  const names = await getUserNamesMap([existing.sellerId, existing.authorId]);
  const sellerName = names.get(existing.sellerId) || 'Продавец';

  await createAndEmitNotification({
    userId: existing.authorId,
    type: 'review_reply',
    title: `${sellerName} ответил(а) на ваш отзыв`,
    body: input.replyText.trim().slice(0, 140),
    linkPath: '/profile',
    relatedPropertyId: existing.propertyId ?? null,
    relatedEntityId: existing.id,
  });

  const payload = {
    ...updated[0],
    sellerName,
    authorName: names.get(existing.authorId) || 'Покупатель',
    sellerRepliedAt: repliedAt.toISOString(),
    createdAt: updated[0].createdAt.toISOString(),
    updatedAt: updated[0].updatedAt.toISOString(),
  };

  realtimeHub.emitToUsers([existing.sellerId, existing.authorId], {
    type: 'review:updated',
    payload: { sellerId: existing.sellerId, review: payload },
  });

  return { status: 'ok' as const, review: payload };
}

export async function reportSellerReview(input: {
  reviewId: number;
  reporterId: number;
  reason: string;
  details?: string;
}) {
  const existingReview = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId))
    .limit(1);
  if (!existingReview[0]) return { status: 'not_found' as const };

  await db
    .insert(reviewReports)
    .values({
      reviewId: input.reviewId,
      reporterId: input.reporterId,
      reason: input.reason,
      details: (input.details ?? '').trim().slice(0, 500),
    })
    .onConflictDoUpdate({
      target: [reviewReports.reviewId, reviewReports.reporterId],
      set: {
        reason: input.reason,
        details: (input.details ?? '').trim().slice(0, 500),
      },
    });

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewReports)
    .where(eq(reviewReports.reviewId, input.reviewId));
  const reportsCount = countRows[0]?.count ?? 1;

  await db
    .update(reviews)
    .set({
      reportsCount,
      status: reportsCount >= 1 && existingReview[0].status === 'visible' ? 'flagged' : existingReview[0].status,
      updatedAt: new Date(),
    })
    .where(eq(reviews.id, input.reviewId));

  return { status: 'ok' as const, reportsCount };
}

export async function listFlaggedReviewsForAdmin() {
  const rows = await db
    .select({
      id: reviews.id,
      sellerId: reviews.sellerId,
      authorId: reviews.authorId,
      propertyId: reviews.propertyId,
      rating: reviews.rating,
      comment: reviews.comment,
      sellerReply: reviews.sellerReply,
      reportsCount: reviews.reportsCount,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(or(eq(reviews.status, 'flagged'), eq(reviews.status, 'hidden')))
    .orderBy(desc(reviews.reportsCount), desc(reviews.createdAt));

  const names = await getUserNamesMap(rows.flatMap((r) => [r.sellerId, r.authorId]));
  return rows.map((r) => ({
    ...r,
    sellerName: names.get(r.sellerId) || 'Продавец',
    authorName: names.get(r.authorId) || 'Покупатель',
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function moderateReviewStatus(reviewId: number, status: ReviewStatus) {
  const updated = await db
    .update(reviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning();
  if (!updated[0]) return null;
  await recalculateSellerRating(updated[0].sellerId);
  return updated[0];
}

export async function listUserNotifications(userId: number) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsAsRead(userId: number) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function getUserCabinetOverview(userId: number) {
  const [
    userFavs,
    searches,
    filters,
    views,
    sellerPropsRes,
    reviewsReceivedRes,
    reviewsAuthoredRows,
    unreadMsgRows,
    unreadNotifRows,
  ] = await Promise.all([
    listUserFavorites(userId),
    listUserSearchHistory(userId),
    listUserSavedFilters(userId),
    listUserViewHistory(userId),
    listProperties({ ownerId: userId, includeAllStatuses: true, pageSize: 50 }),
    listSellerReviews(userId),
    db
      .select({
        id: reviews.id,
        sellerId: reviews.sellerId,
        authorId: reviews.authorId,
        propertyId: reviews.propertyId,
        propertyTitle: properties.title,
        rating: reviews.rating,
        comment: reviews.comment,
        sellerReply: reviews.sellerReply,
        sellerRepliedAt: reviews.sellerRepliedAt,
        reportsCount: reviews.reportsCount,
        status: reviews.status,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .leftJoin(properties, eq(reviews.propertyId, properties.id))
      .where(eq(reviews.authorId, userId))
      .orderBy(desc(reviews.createdAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.recipientId, userId), eq(messages.isRead, false))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
  ]);

  const myPropIds = sellerPropsRes.properties.map((p) => p.id);
  const favCountByProp = new Map<number, number>();
  const msgCountByProp = new Map<number, number>();

  if (myPropIds.length > 0) {
    const [favAgg, msgAgg] = await Promise.all([
      db
        .select({
          propertyId: favorites.propertyId,
          count: sql<number>`count(*)::int`,
        })
        .from(favorites)
        .where(inArray(favorites.propertyId, myPropIds))
        .groupBy(favorites.propertyId),
      db
        .select({
          propertyId: messages.propertyId,
          count: sql<number>`count(*)::int`,
        })
        .from(messages)
        .where(and(eq(messages.recipientId, userId), inArray(messages.propertyId, myPropIds)))
        .groupBy(messages.propertyId),
    ]);

    for (const row of favAgg) {
      favCountByProp.set(row.propertyId, row.count);
    }
    for (const row of msgAgg) {
      if (row.propertyId) msgCountByProp.set(row.propertyId, row.count);
    }
  }

  const authorNames = await getUserNamesMap(
    reviewsAuthoredRows.flatMap((r) => [r.sellerId, r.authorId])
  );

  return {
    favorites: userFavs.map((f) => ({
      ...f,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    })),
    searchHistory: searches,
    savedFilters: filters,
    viewHistory: views,
    reviewsAuthored: reviewsAuthoredRows.map((r) => ({
      ...r,
      sellerName: authorNames.get(r.sellerId) || 'Продавец ESTORA',
      authorName: authorNames.get(r.authorId) || 'Вы',
      sellerRepliedAt: r.sellerRepliedAt ? r.sellerRepliedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    reviewsReceived: reviewsReceivedRes.reviews,
    sellerAverageRatingTenths: reviewsReceivedRes.averageRatingTenths,
    myProperties: sellerPropsRes.properties.map((p) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      favoritesCount: favCountByProp.get(p.id) ?? 0,
      incomingMessagesCount: msgCountByProp.get(p.id) ?? 0,
    })),
    unreadMessagesCount: unreadMsgRows[0]?.count ?? 0,
    unreadNotificationsCount: unreadNotifRows[0]?.count ?? 0,
  };
}
