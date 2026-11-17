import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { paymentTransactions, properties } from './schema.ts';
import {
  getPaidServiceDefinition,
  type PaidServiceType,
  type PaymentProvider,
} from '../utils/payments.ts';
import { createAndEmitNotification } from './social.ts';

export async function createPaymentOrderRecord(input: {
  userId: number;
  propertyId?: number | null;
  serviceType: PaidServiceType;
  provider: PaymentProvider;
}) {
  const service = getPaidServiceDefinition(input.serviceType);
  if (!service) {
    throw new Error('Неизвестная платная услуга ESTORA.');
  }

  const orderCode = `EST-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  const rows = await db
    .insert(paymentTransactions)
    .values({
      orderCode,
      userId: input.userId,
      propertyId: input.propertyId ?? null,
      serviceType: service.id,
      provider: input.provider,
      amountUzs: service.priceUzs,
      amountUsd: service.priceUsd,
      status: 'awaiting_confirmation',
      externalTransactionId: '',
      maskedCardSummary: '',
    })
    .returning();

  return rows[0];
}

export async function getPaymentOrderByCode(orderCode: string) {
  const rows = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderCode, orderCode))
    .limit(1);
  return rows[0] ?? null;
}

export async function listUserPaymentHistory(userId: number) {
  const rows = await db
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
    .where(eq(paymentTransactions.userId, userId))
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(40);

  return rows.map((r) => ({
    ...r,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function applyPaidOrderBenefits(input: {
  orderCode: string;
  externalTransactionId?: string;
  maskedCardSummary?: string;
}) {
  const existing = await getPaymentOrderByCode(input.orderCode);
  if (!existing) return null;
  if (existing.status === 'paid') {
    return existing;
  }

  const paidAt = new Date();
  const safeMaskedSummary =
    typeof input.maskedCardSummary === 'string' && /^•{4}\s?\d{4}$/.test(input.maskedCardSummary.trim())
      ? input.maskedCardSummary.trim()
      : '';

  const updatedOrder = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(paymentTransactions)
      .set({
        status: 'paid',
        externalTransactionId:
          input.externalTransactionId?.trim() ||
          `GW-${existing.provider.toUpperCase()}-${existing.id}-${Date.now().toString().slice(-6)}`,
        maskedCardSummary: safeMaskedSummary,
        paidAt,
        updatedAt: paidAt,
      })
      .where(eq(paymentTransactions.id, existing.id))
      .returning();

    const order = updatedRows[0];
    if (!order) return null;

    if (order.propertyId) {
      const svc = getPaidServiceDefinition(order.serviceType);
      if (order.serviceType === 'featured_7d' || order.serviceType === 'featured_30d') {
        const durationDays = svc?.durationDays || 7;
        const featuredUntil = new Date(Date.now() + durationDays * 24 * 3600 * 1000);
        await tx
          .update(properties)
          .set({
            isFeatured: true,
            featuredUntil,
            updatedAt: new Date(),
          })
          .where(eq(properties.id, order.propertyId));
      } else if (order.serviceType === 'priority_verification') {
        await tx
          .update(properties)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(properties.id, order.propertyId));
      }
    }

    return order;
  });

  if (updatedOrder) {
    await createAndEmitNotification({
      userId: updatedOrder.userId,
      type: 'status_changed',
      title: `Оплата подтверждена: ${updatedOrder.orderCode}`,
      body: `Услуга «${updatedOrder.serviceType}» через ${updatedOrder.provider.toUpperCase()} успешно активирована.`,
      linkPath: '/profile?tab=seller',
      relatedPropertyId: updatedOrder.propertyId,
      relatedEntityId: updatedOrder.id,
    });
  }

  return updatedOrder;
}
