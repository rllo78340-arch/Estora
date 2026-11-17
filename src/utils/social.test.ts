import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildThreadKey,
  computeAverageSellerRatingTenths,
  groupMessagesIntoThreads,
  isSafeMessageImageUrl,
  matchesSavedFilter,
  summarizeSellerPortfolioStats,
  validateMessagePayload,
  validateReviewPayload,
} from './social';
import type { MessageRecord } from '../types/estora';

test('validateMessagePayload accepts text or safe ESTORA upload image and rejects unsafe URLs', () => {
  const okText = validateMessagePayload({
    subject: 'Вопрос по квартире',
    body: 'Когда можно посмотреть объект?',
  });
  assert.equal(okText.valid, true);

  const okImageOnly = validateMessagePayload({
    subject: 'План этажа',
    body: '',
    imageUrl: '/uploads/17300000-plan.webp',
  });
  assert.equal(okImageOnly.valid, true);
  assert.equal(okImageOnly.cleanBody, 'Фотография');

  const unsafeImg = validateMessagePayload({
    subject: 'Test',
    body: 'Hello',
    imageUrl: 'https://evil.example.com/payload.svg',
  });
  assert.equal(unsafeImg.valid, false);
  assert.equal(isSafeMessageImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeMessageImageUrl('/uploads/../secret.png'), false);
});

test('validateReviewPayload and computeAverageSellerRatingTenths enforce rating rules', () => {
  assert.equal(
    validateReviewPayload({ sellerId: 10, authorId: 10, rating: 5, comment: 'Great seller!' }).valid,
    false
  );
  assert.equal(
    validateReviewPayload({ sellerId: 10, authorId: 11, rating: 6, comment: 'Great seller!' }).valid,
    false
  );
  assert.equal(
    validateReviewPayload({ sellerId: 10, authorId: 11, rating: 5, comment: 'Ok' }).valid,
    false
  );
  assert.equal(
    validateReviewPayload({
      sellerId: 10,
      authorId: 11,
      rating: 5,
      comment: 'Очень пунктуальный продавец, документы готовы.',
    }).valid,
    true
  );

  assert.equal(computeAverageSellerRatingTenths([5, 4, 5]), 47);
  assert.equal(computeAverageSellerRatingTenths([]), 49);
});

test('groupMessagesIntoThreads groups by participant and property and counts unread incoming', () => {
  const msgs: MessageRecord[] = [
    {
      id: 1,
      propertyId: 42,
      propertyTitle: 'Penthouse Tashkent City',
      senderId: 2,
      recipientId: 1,
      senderName: 'Азиз',
      recipientName: 'Мадина',
      subject: 'Вопрос',
      body: 'Актуально ли предложение?',
      imageUrl: '',
      isRead: false,
      readAt: null,
      createdAt: '2026-11-16T10:00:00.000Z',
    },
    {
      id: 2,
      propertyId: 42,
      propertyTitle: 'Penthouse Tashkent City',
      senderId: 1,
      recipientId: 2,
      senderName: 'Мадина',
      recipientName: 'Азиз',
      subject: 'Вопрос',
      body: 'Да, приглашаем на просмотр.',
      imageUrl: '',
      isRead: true,
      readAt: '2026-11-16T10:05:00.000Z',
      createdAt: '2026-11-16T10:04:00.000Z',
    },
    {
      id: 3,
      propertyId: null,
      propertyTitle: null,
      senderId: 3,
      recipientId: 1,
      senderName: 'Сардор',
      recipientName: 'Мадина',
      subject: 'Подбор',
      body: 'Добрый день',
      imageUrl: '/uploads/photo.jpg',
      isRead: false,
      readAt: null,
      createdAt: '2026-11-16T11:00:00.000Z',
    },
  ];

  const threads = groupMessagesIntoThreads(msgs, 1);
  assert.equal(threads.length, 2);
  assert.equal(threads[0].threadKey, buildThreadKey(3, null));
  assert.equal(threads[0].unreadCount, 1);
  assert.equal(threads[1].threadKey, buildThreadKey(2, 42));
  assert.equal(threads[1].unreadCount, 1);
  assert.equal(threads[1].lastMessage.id, 2);
});

test('matchesSavedFilter accurately evaluates Uzbekistan property criteria for notifications', () => {
  const sampleProp = {
    status: 'active',
    country: 'Uzbekistan',
    dealType: 'sale',
    propertyType: 'apartment',
    city: 'Ташкент',
    district: 'Мирабадский',
    priceUsd: 145000,
    areaSqm: 98,
    bedrooms: 3,
    has3dTour: true,
    renovation: 'designer',
    furnished: true,
    parking: true,
    title: 'Светлая резиденция у парка',
    description: 'Панорамные окна и охраняемый двор',
  };

  assert.equal(
    matchesSavedFilter(sampleProp, {
      city: 'Ташкент',
      dealType: 'sale',
      rooms: '3',
      maxPrice: '160000',
      has3dTour: true,
    }),
    true
  );

  assert.equal(
    matchesSavedFilter(sampleProp, {
      city: 'Самарканд',
    }),
    false
  );

  assert.equal(
    matchesSavedFilter(sampleProp, {
      maxPrice: '120000',
    }),
    false
  );
});

test('summarizeSellerPortfolioStats totals views, favorites, and publication statuses', () => {
  const summary = summarizeSellerPortfolioStats([
    { status: 'active', viewsCount: 120, favoritesCount: 8 },
    { status: 'pending', viewsCount: 5, favoritesCount: 1 },
    { status: 'archived', viewsCount: 40, favoritesCount: 3 },
  ]);

  assert.deepEqual(summary, {
    totalListings: 3,
    totalViews: 165,
    totalFavorites: 12,
    activeCount: 1,
    pendingCount: 1,
    draftCount: 0,
    archivedCount: 1,
  });
});
