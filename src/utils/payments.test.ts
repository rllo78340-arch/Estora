import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCheckoutGatewayResponse,
  buildClickCheckoutUrl,
  buildPaymeCheckoutUrl,
  computeClickSignString,
  getPaidServiceDefinition,
  validateNoSensitiveCardData,
  verifyPaymeBasicAuth,
} from './payments';

test('validateNoSensitiveCardData rejects raw PAN numbers, CVV, and expiry fields', () => {
  assert.equal(validateNoSensitiveCardData({ serviceType: 'featured_7d', provider: 'payme' }).safe, true);

  const withCardKey = validateNoSensitiveCardData({
    serviceType: 'featured_7d',
    provider: 'uzcard_humo',
    cardNumber: '8600 1234 5678 9012',
  });
  assert.equal(withCardKey.safe, false);

  const withCvvKey = validateNoSensitiveCardData({
    provider: 'click',
    cvv: '123',
  });
  assert.equal(withCvvKey.safe, false);

  const withEmbeddedPan = validateNoSensitiveCardData({
    provider: 'uzcard_humo',
    note: '8600123456789012',
  });
  assert.equal(withEmbeddedPan.safe, false);
});

test('buildPaymeCheckoutUrl encodes tiyin amount and order_id in Base64 payload', () => {
  const url = buildPaymeCheckoutUrl({
    merchantId: 'TEST_MERCHANT',
    orderCode: 'EST-2026-001',
    amountUzs: 192000,
    returnUrl: 'https://estora.uz/profile',
    lang: 'ru',
  });
  assert.ok(url.startsWith('https://checkout.paycom.uz/'));
  const token = url.replace('https://checkout.paycom.uz/', '');
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  assert.match(decoded, /m=TEST_MERCHANT/);
  assert.match(decoded, /ac\.order_id=EST-2026-001/);
  assert.match(decoded, /a=19200000/);
});

test('buildClickCheckoutUrl and computeClickSignString match Click protocol rules', () => {
  const url = buildClickCheckoutUrl({
    merchantId: '1001',
    serviceId: '2002',
    orderCode: 'EST-CLK-1',
    amountUzs: 576000,
    returnUrl: 'https://estora.uz/profile',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://my.click.uz');
  assert.equal(parsed.searchParams.get('merchant_id'), '1001');
  assert.equal(parsed.searchParams.get('service_id'), '2002');
  assert.equal(parsed.searchParams.get('transaction_param'), 'EST-CLK-1');

  const sign = computeClickSignString({
    clickTransId: 999,
    serviceId: 2002,
    secretKey: 'secret',
    merchantTransId: 'EST-CLK-1',
    amount: 576000,
    action: 0,
    signTime: '2026-11-16 12:00:00',
  });
  assert.equal(sign.length, 32);
});

test('verifyPaymeBasicAuth verifies Paycom Basic authorization header safely', () => {
  const header = `Basic ${Buffer.from('Paycom:my_secret_key').toString('base64')}`;
  assert.equal(verifyPaymeBasicAuth(header, 'my_secret_key'), true);
  assert.equal(verifyPaymeBasicAuth(header, 'wrong_key'), false);
  assert.equal(verifyPaymeBasicAuth(undefined, 'my_secret_key'), false);
});

test('getPaidServiceDefinition & buildCheckoutGatewayResponse resolve ESTORA services accurately', () => {
  const svc = getPaidServiceDefinition('featured_30d');
  assert.ok(svc);
  assert.equal(svc.priceUsd, 45);
  assert.equal(svc.durationDays, 30);

  const checkout = buildCheckoutGatewayResponse({
    orderCode: 'EST-99',
    provider: 'uzcard_humo',
    amountUzs: svc.priceUzs,
    appUrl: 'http://localhost:3000',
  });
  assert.equal(checkout.gatewayMode, 'sandbox_gateway');
  assert.match(checkout.checkoutUrl, /payment=EST-99/);
});
