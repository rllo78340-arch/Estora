import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  messages,
  paymentTransactions,
  properties,
  propertyReports,
  users,
} from './schema.ts';
import { listProperties } from './properties.ts';
import { listFlaggedReviewsForAdmin } from './social.ts';

const DEFAULT_CATEGORIES: ReadonlyArray<{
  slug: string;
  sortOrder: number;
  baseListingFeeUsd: number;
}> = [
  { slug: 'apartment', sortOrder: 1, baseListingFeeUsd: 0 },
  { slug: 'house', sortOrder: 2, baseListingFeeUsd: 0 },
  { slug: 'villa', sortOrder: 3, baseListingFeeUsd: 15 },
  { slug: 'penthouse', sortOrder: 4, baseListingFeeUsd: 20 },
  { slug: 'new_build', sortOrder: 5, baseListingFeeUsd: 10 },
  { slug: 'commercial', sortOrder: 6, baseListingFeeUsd: 15 },
  { slug: 'office', sortOrder: 7, baseListingFeeUsd: 10 },
  { slug: 'shop', sortOrder: 8, baseListingFeeUsd: 10 },
  { slug: 'land', sortOrder: 9, baseListingFeeUsd: 5 },
];

export async function ensureDefaultCategories() {
  await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        slug: c.slug,
        isActive: true,
        sortOrder: c.sortOrder,
        baseListingFeeUsd: c.baseListingFeeUsd,
      }))
    )
    .onConflictDoNothing({ target: categories.slug });
}

export async function listCategories(includeInactive = false) {
  await ensureDefaultCategories();
  const rows = await db
    .select()
    .from(categories)
    .where(includeInactive ? undefined : eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  return rows;
}

export async function updateAdminCategory(
  categoryId: number,
  updates: { isActive?: boolean; sortOrder?: number; baseListingFeeUsd?: number }
) {
  const rows = await db
    .update(categories)
    .set({
      ...(typeof updates.isActive === 'boolean' ? { isActive: updates.isActive } : {}),
      ...(typeof updates.sortOrder === 'number' ? { sortOrder: updates.sortOrder } : {}),
      ...(typeof updates.baseListingFeeUsd === 'number'
        ? { baseListingFeeUsd: Math.max(0, Math.round(updates.baseListingFeeUsd)) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId))
    .returning();
  return rows[0] ?? null;
}

export async function createPropertyReportRecord(input: {
  propertyId: number;
  reporterId: number;
  reason: string;
  details: string;
}) {
  const propRows = await db
    .select({ id: properties.id, title: properties.title })
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!propRows[0]) return { status: 'not_found' as const };

  await db
    .insert(propertyReports)
    .values({
      propertyId: input.propertyId,
      reporterId: input.reporterId,
      reason: input.reason || 'other',
      details: input.details.trim().slice(0, 600),
      status: 'pending',
    })
    .onConflictDoUpdate({
      target: [propertyReports.propertyId, propertyReports.reporterId],
      set: {
        reason: input.reason || 'other',
        details: input.details.trim().slice(0, 600),
        status: 'pending',
      },
    });

  return { status: 'ok' as const };
}

export async function moderatePropertyReportRecord(
  reportId: number,
  updates: { status: 'resolved' | 'dismissed'; adminNote?: string; archiveProperty?: boolean }
) {
  const rows = await db
    .update(propertyReports)
    .set({
      status: updates.status,
      ...(typeof updates.adminNote === 'string' ? { adminNote: updates.adminNote.trim() } : {}),
    })
    .where(eq(propertyReports.id, reportId))
    .returning();

  const report = rows[0];
  if (!report) return null;

  if (updates.archiveProperty && updates.status === 'resolved') {
    await db
      .update(properties)
      .set({
        status: 'archived',
        isVerified: false,
        moderationStatus: 'rejected',
        rejectionReason: updates.adminNote?.trim() || 'Снято с публикации по жалобе пользователей.',
        updatedAt: new Date(),
      })
      .where(eq(properties.id, report.propertyId));
  }

  return report;
}

export async function moderateAdminPropertyRecord(input: {
  propertyId: number;
  action: 'approve' | 'reject' | 'archive' | 'pending' | 'toggle_featured';
  isFeatured?: boolean;
  rejectionReason?: string;
}) {
  const existingRows = await db
    .select()
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return null;

  const nextSet: Partial<typeof properties.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.action === 'approve') {
    nextSet.status = 'active';
    nextSet.isVerified = true;
    nextSet.moderationStatus = 'approved';
    nextSet.rejectionReason = '';
  } else if (input.action === 'reject') {
    nextSet.status = 'rejected';
    nextSet.isVerified = false;
    nextSet.moderationStatus = 'rejected';
    nextSet.rejectionReason =
      input.rejectionReason?.trim() || 'Объявление не прошло проверку модератора ESTORA.';
  } else if (input.action === 'archive') {
    nextSet.status = 'archived';
    nextSet.isVerified = false;
  } else if (input.action === 'pending') {
    nextSet.status = 'pending';
    nextSet.isVerified = false;
    nextSet.moderationStatus = 'pending';
  }

  if (typeof input.isFeatured === 'boolean') {
    nextSet.isFeatured = input.isFeatured;
  }

  const updated = await db
    .update(properties)
    .set(nextSet)
    .where(eq(properties.id, input.propertyId))
    .returning();

  return updated[0] ?? null;
}

export async function updateAdminUserRecord(input: {
  targetUserId: number;
  actorUserId: number;
  isBlocked?: boolean;
  blockedReason?: string;
  role?: 'buyer' | 'agent' | 'admin';
}) {
  if (input.targetUserId === input.actorUserId) {
    if (input.isBlocked === true || (input.role && input.role !== 'admin')) {
      return { status: 'self_restricted' as const };
    }
  }

  const rows = await db
    .update(users)
    .set({
      ...(typeof input.isBlocked === 'boolean'
        ? {
            isBlocked: input.isBlocked,
            blockedReason: input.isBlocked
              ? (input.blockedReason || 'Нарушение правил платформы ESTORA.').trim()
              : '',
            blockedAt: input.isBlocked ? new Date() : null,
          }
        : {}),
      ...(input.role ? { role: input.role } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.targetUserId))
    .returning();

  if (!rows[0]) return { status: 'not_found' as const };
  return { status: 'ok' as const, user: rows[0] };
}

export async function getAdminDashboardOverview() {
  await ensureDefaultCategories();

  const [
    propCounts,
    pendingModerationCounts,
    verifiedCounts,
    userCounts,
    blockedUserCounts,
    msgCounts,
    pendingReportCounts,
    paidRevenueRows,
    allPropertiesRes,
    userRows,
    propCountByUser,
    propertyReportRows,
    flaggedReviews,
    categoryRows,
    recentPaymentRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(properties),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.status, 'pending')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(and(eq(properties.status, 'active'), eq(properties.isVerified, true))),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBlocked, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(messages),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(propertyReports)
      .where(eq(propertyReports.status, 'pending')),
    db
      .select({
        totalUzs: sql<number>`coalesce(sum(${paymentTransactions.amountUzs}), 0)::bigint`,
        totalUsd: sql<number>`coalesce(sum(${paymentTransactions.amountUsd}), 0)::int`,
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'paid')),
    listProperties({ includeAllStatuses: true, pageSize: 120 }),
    db.select().from(users).orderBy(desc(users.createdAt)).limit(100),
    db
      .select({
        ownerId: properties.ownerId,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .groupBy(properties.ownerId),
    db
      .select({
        id: propertyReports.id,
        propertyId: propertyReports.propertyId,
        propertyTitle: properties.title,
        propertyCity: properties.city,
        reporterId: propertyReports.reporterId,
        reason: propertyReports.reason,
        details: propertyReports.details,
        status: propertyReports.status,
        adminNote: propertyReports.adminNote,
        createdAt: propertyReports.createdAt,
      })
      .from(propertyReports)
      .leftJoin(properties, eq(propertyReports.propertyId, properties.id))
      .orderBy(desc(propertyReports.createdAt))
      .limit(100),
    listFlaggedReviewsForAdmin(),
    listCategories(true),
    db
      .select({
        id: paymentTransactions.id,
        orderCode: paymentTransactions.orderCode,
        userId: paymentTransactions.userId,
        propertyId: paymentTransactions.propertyId,
        propertyTitle: properties.title,
        serviceType: paymentTransactions.serviceType,
        provider: paymentTransactions.provider,
        amountUzs: paymentTransactions.amountUzs,
        amountUsd: paymentTransactions.amountUsd,
        status: paymentTransactions.status,
        externalTransactionId: paymentTransactions.externalTransactionId,
        maskedCardSummary: paymentTransactions.maskedCardSummary,
        paidAt: paymentTransactions.paidAt,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .leftJoin(properties, eq(paymentTransactions.propertyId, properties.id))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(50),
  ]);

  const userNameIds = Array.from(
    new Set([
      ...propertyReportRows.map((r) => r.reporterId),
      ...recentPaymentRows.map((p) => p.userId),
    ])
  ).filter((id) => Number.isInteger(id) && id > 0);

  const nameMap: Record<number, string> = {};
  if (userNameIds.length > 0) {
    const nameRows = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(inArray(users.id, userNameIds));
    for (const row of nameRows) {
      nameMap[row.id] = row.fullName;
    }
  }

  const listingCountMap: Record<number, number> = {};
  for (const item of propCountByUser) {
    listingCountMap[item.ownerId] = item.count;
  }

  return {
    totalProperties: propCounts[0]?.count ?? 0,
    pendingModerationCount: pendingModerationCounts[0]?.count ?? 0,
    verifiedPropertiesCount: verifiedCounts[0]?.count ?? 0,
    totalUsers: userCounts[0]?.count ?? 0,
    blockedUsersCount: blockedUserCounts[0]?.count ?? 0,
    totalMessages: msgCounts[0]?.count ?? 0,
    pendingReportsCount: pendingReportCounts[0]?.count ?? 0,
    totalPaidRevenueUzs: Number(paidRevenueRows[0]?.totalUzs ?? 0),
    totalPaidRevenueUsd: Number(paidRevenueRows[0]?.totalUsd ?? 0),
    properties: allPropertiesRes.properties,
    users: userRows.map((u) => ({
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      sellerRatingTenths: u.sellerRatingTenths,
      preferredCity: u.preferredCity,
      preferredCurrency: u.preferredCurrency,
      notificationsEnabled: u.notificationsEnabled,
      isBlocked: u.isBlocked,
      blockedReason: u.blockedReason,
      blockedAt: u.blockedAt ? u.blockedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      listingsCount: listingCountMap[u.id] ?? 0,
    })),
    propertyReports: propertyReportRows.map((r) => ({
      ...r,
      reporterName: nameMap[r.reporterId] || 'Пользователь',
      createdAt: r.createdAt.toISOString(),
    })),
    flaggedReviews,
    categories: categoryRows,
    recentPayments: recentPaymentRows.map((p) => ({
      ...p,
      userName: nameMap[p.userId] || 'Пользователь',
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
