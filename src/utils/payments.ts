import crypto from 'node:crypto';
import { USD_TO_UZS_RATE } from './listingWizard.ts';

export type PaidServiceType =
  | 'featured_7d'
  | 'featured_30d'
  | 'priority_verification'
  | 'tour_3d_pro';

export type PaymentProvider = 'payme' | 'click' | 'uzcard_humo';

export type PaymentOrderStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'failed'
  | 'cancelled';

export interface PaidServiceDefinition {
  id: PaidServiceType;
  priceUsd: number;
  priceUzs: number;
  durationDays: number;
}

export const ESTORA_PAID_SERVICES: readonly PaidServiceDefinition[] = [
  {
    id: 'featured_7d',
    priceUsd: 15,
    priceUzs: 15 * USD_TO_UZS_RATE,
    durationDays: 7,
  },
  {
    id: 'featured_30d',
    priceUsd: 45,
    priceUzs: 45 * USD_TO_UZS_RATE,
    durationDays: 30,
  },
  {
    id: 'priority_verification',
    priceUsd: 10,
    priceUzs: 10 * USD_TO_UZS_RATE,
    durationDays: 0,
  },
  {
    id: 'tour_3d_pro',
    priceUsd: 25,
    priceUzs: 25 * USD_TO_UZS_RATE,
    durationDays: 30,
  },
] as const;

export const ALLOWED_PAYMENT_PROVIDERS = new Set<PaymentProvider>([
  'payme',
  'click',
  'uzcard_humo',
]);

export function getPaidServiceDefinition(serviceType: string): PaidServiceDefinition | null {
  return ESTORA_PAID_SERVICES.find((s) => s.id === serviceType) ?? null;
}

const FORBIDDEN_CARD_KEYS = new Set([
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvc',
  'cvv2',
  'cvc2',
  'pin',
  'cardpin',
  'cardexpiry',
  'expiry',
  'exp_month',
  'exp_year',
  'securitycode',
]);

const RAW_PAN_DIGIT_RUN_RE = /\b(?:\d[ -]?){13,19}\b/;

/**
 * Hard security guard: ESTORA must NEVER accept, process, or persist raw
 * bank card numbers (PAN), CVV/CVC codes, or expiry credentials on its servers.
 */
export function validateNoSensitiveCardData(payload: unknown): {
  safe: boolean;
  reason?: string;
} {
  const visit = (node: unknown, depth: number): string | null => {
    if (depth > 8 || node === null || node === undefined) return null;
    if (typeof node === 'string') {
      const stripped = node.replace(/[\s-]/g, '');
      if (/^\d{13,19}$/.test(stripped) && RAW_PAN_DIGIT_RUN_RE.test(node)) {
        return 'Запрещена передача полного номера банковской карты на сервер ESTORA. Используйте защищённый шлюз Payme, Click или токенизированную страницу банка.';
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item, depth + 1);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof node === 'object') {
      for (const [rawKey, value] of Object.entries(node as Record<string, unknown>)) {
        const key = rawKey.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (FORBIDDEN_CARD_KEYS.has(key)) {
          return `Поле «${rawKey}» запрещено: ESTORA не хранит и не обрабатывает номера карт, сроки действия и CVV.`;
        }
        const hit = visit(value, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };

  const reason = visit(payload, 0);
  return reason ? { safe: false, reason } : { safe: true };
}

export function buildPaymeCheckoutUrl(params: {
  merchantId: string;
  orderCode: string;
  amountUzs: number;
  returnUrl: string;
  lang?: string;
}): string {
  const amountTiyin = Math.max(100, Math.round(params.amountUzs * 100));
  const segments = [
    `m=${params.merchantId}`,
    `ac.order_id=${params.orderCode}`,
    `a=${amountTiyin}`,
    `l=${params.lang === 'uz' ? 'uz' : params.lang === 'en' ? 'en' : 'ru'}`,
    `c=${params.returnUrl}`,
  ];
  const encoded = Buffer.from(segments.join(';'), 'utf8').toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

export function buildClickCheckoutUrl(params: {
  merchantId: string;
  serviceId: string;
  orderCode: string;
  amountUzs: number;
  returnUrl: string;
}): string {
  const url = new URL('https://my.click.uz/services/pay');
  url.searchParams.set('service_id', params.serviceId);
  url.searchParams.set('merchant_id', params.merchantId);
  url.searchParams.set('amount', String(Math.round(params.amountUzs)));
  url.searchParams.set('transaction_param', params.orderCode);
  url.searchParams.set('return_url', params.returnUrl);
  return url.toString();
}

export function computeClickSignString(input: {
  clickTransId: string | number;
  serviceId: string | number;
  secretKey: string;
  merchantTransId: string;
  merchantPrepareId?: string | number;
  amount: string | number;
  action: string | number;
  signTime: string;
}): string {
  const preparePart =
    Number(input.action) === 1 && input.merchantPrepareId !== undefined
      ? String(input.merchantPrepareId)
      : '';
  const raw =
    `${input.clickTransId}${input.serviceId}${input.secretKey}` +
    `${input.merchantTransId}${preparePart}${input.amount}${input.action}${input.signTime}`;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

export function verifyPaymeBasicAuth(
  authHeader: string | undefined,
  secretKey: string
): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ') || !secretKey) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) return false;
    const login = decoded.slice(0, colonIdx);
    const password = decoded.slice(colonIdx + 1);
    return login === 'Paycom' && password === secretKey;
  } catch {
    return false;
  }
}

export function buildCheckoutGatewayResponse(input: {
  orderCode: string;
  provider: PaymentProvider;
  amountUzs: number;
  appUrl: string;
  lang?: string;
  paymeMerchantId?: string;
  clickMerchantId?: string;
  clickServiceId?: string;
}): {
  checkoutUrl: string;
  gatewayMode: 'live_merchant' | 'sandbox_gateway';
  providerLabel: string;
} {
  const returnUrl = `${input.appUrl.replace(/\/$/, '')}/profile?tab=seller&payment=${encodeURIComponent(input.orderCode)}`;

  if (input.provider === 'payme') {
    const merchantId = input.paymeMerchantId?.trim();
    const isLive = Boolean(merchantId);
    const checkoutUrl = buildPaymeCheckoutUrl({
      merchantId: merchantId || 'ESTORA_PAYME_SANDBOX',
      orderCode: input.orderCode,
      amountUzs: input.amountUzs,
      returnUrl,
      lang: input.lang,
    });
    return {
      checkoutUrl,
      gatewayMode: isLive ? 'live_merchant' : 'sandbox_gateway',
      providerLabel: 'Payme',
    };
  }

  if (input.provider === 'click') {
    const merchantId = input.clickMerchantId?.trim();
    const serviceId = input.clickServiceId?.trim();
    const isLive = Boolean(merchantId && serviceId);
    const checkoutUrl = buildClickCheckoutUrl({
      merchantId: merchantId || 'ESTORA_CLICK_SANDBOX',
      serviceId: serviceId || 'ESTORA_SERVICE',
      orderCode: input.orderCode,
      amountUzs: input.amountUzs,
      returnUrl,
    });
    return {
      checkoutUrl,
      gatewayMode: isLive ? 'live_merchant' : 'sandbox_gateway',
      providerLabel: 'Click',
    };
  }

  return {
    checkoutUrl: returnUrl,
    gatewayMode: 'sandbox_gateway',
    providerLabel: 'Uzcard / Humo (Hosted Token Gateway)',
  };
}
