import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isListingVerifiedPublicly,
  moderateListingSubmission,
  parseModerationNotes,
} from './moderation';

test('moderateListingSubmission passes clean Uzbekistan listing and never auto-verifies it', () => {
  const res = moderateListingSubmission({
    country: 'Uzbekistan',
    city: 'Ташкент',
    district: 'Мирзо-Улугбекский',
    address: 'ул. Буюк Ипак Йули, 42',
    latitude: 41.328,
    longitude: 69.335,
    title: 'Светлая 3-комнатная квартира в ЖК премиум-класса',
    description:
      'Просторная резиденция с дизайнерским ремонтом, панорамными окнами и подземным паркингом в Ташкенте.',
    dealType: 'sale',
    propertyType: 'apartment',
    priceUsd: 185000,
    areaSqm: 110,
    contactPhone: '+998 90 123 45 67',
  });

  assert.equal(res.passedAutoChecks, true);
  assert.equal(res.recommendedModerationStatus, 'pending');
  assert.equal(res.isVerified, false);
  assert.equal(res.score, 100);
  assert.equal(res.flags.length, 0);
});

test('moderateListingSubmission flags foreign addresses, scam links, and price anomalies', () => {
  const res = moderateListingSubmission({
    country: 'UAE',
    city: 'Dubai',
    district: 'Marina',
    address: 'Marina Walk 10',
    latitude: 25.08,
    longitude: 55.14,
    title: 'URGENT SALE!!!!!!!',
    description: 'Срочно предоплата на карту до просмотра, пишите t.me/scamlink',
    dealType: 'sale',
    propertyType: 'apartment',
    priceUsd: 500,
    areaSqm: 120,
    contactPhone: '',
  });

  assert.equal(res.passedAutoChecks, false);
  assert.equal(res.recommendedModerationStatus, 'flagged');
  assert.equal(res.isVerified, false);
  assert.ok(res.score < 50);
  const codes = res.flags.map((f) => f.code);
  assert.ok(codes.includes('non_uzbekistan_location'));
  assert.ok(codes.includes('invalid_coordinates'));
  assert.ok(codes.includes('suspicious_external_link'));
  assert.ok(codes.includes('scam_prepayment_pattern'));
  assert.ok(codes.includes('unrealistic_price_per_sqm'));
});

test('isListingVerifiedPublicly strictly requires active status, approved moderation, and isVerified === true', () => {
  assert.equal(
    isListingVerifiedPublicly({ status: 'active', isVerified: true, moderationStatus: 'approved' }),
    true
  );
  assert.equal(
    isListingVerifiedPublicly({ status: 'pending', isVerified: true, moderationStatus: 'approved' }),
    false
  );
  assert.equal(
    isListingVerifiedPublicly({ status: 'active', isVerified: false, moderationStatus: 'pending' }),
    false
  );
  assert.equal(
    isListingVerifiedPublicly({ status: 'rejected', isVerified: false, moderationStatus: 'rejected' }),
    false
  );
});

test('parseModerationNotes safely parses JSON arrays and ignores malformed values', () => {
  const parsed = parseModerationNotes(
    JSON.stringify([{ code: 'short_title', severity: 'warning', message: 'Короткий заголовок' }])
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].code, 'short_title');
  assert.deepEqual(parseModerationNotes('not-json'), []);
});
