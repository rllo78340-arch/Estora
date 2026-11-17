import test from 'node:test';
import assert from 'node:assert/strict';
import type { PropertyListing } from '../types/estora.ts';
import {
  AI_STORAGE_KEYS,
  buildCatalogLinkFromFilters,
  buildComparisonMetrics,
  clearAiHistoryAndMemory,
  hydrateGroundedRecommendations,
  loadAiMessages,
  loadAiSettings,
  normalizeUzbekistanCity,
  recordSearchQueryToStorage,
  sanitizeAiFilters,
  sanitizePersonalizationContext,
  saveAiMessages,
  saveAiSettings,
  saveCompareIds,
  type StorageLike,
} from './aiAgent.ts';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, val) => map.set(key, val),
    removeItem: (key) => map.delete(key),
  };
}

function makeListing(id: number, overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id,
    ownerId: 1,
    title: `Объект #${id}`,
    slug: `obj-${id}`,
    dealType: 'sale',
    propertyType: 'apartment',
    city: 'Ташкент',
    district: 'Мирабадский',
    address: 'ул. Нукус 12',
    priceUsd: 200000,
    areaSqm: 100,
    bedrooms: 2,
    bathrooms: 1,
    floor: 4,
    totalFloors: 9,
    has3dTour: false,
    tour3dLabel: '',
    status: 'active',
    isFeatured: false,
    imageUrl: '/img/1.jpg',
    description: 'Светлая квартира',
    amenities: '[]',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('normalizeUzbekistanCity accepts aliases and rejects foreign cities', () => {
  assert.equal(normalizeUzbekistanCity('Tashkent'), 'Ташкент');
  assert.equal(normalizeUzbekistanCity('samarqand'), 'Самарканд');
  assert.equal(normalizeUzbekistanCity('Бухара'), 'Бухара');
  assert.equal(normalizeUzbekistanCity('Dubai'), undefined);
  assert.equal(normalizeUzbekistanCity('Moscow'), undefined);
});

test('sanitizeAiFilters cleans NL filter fields and builds catalog query URL', () => {
  const filters = sanitizeAiFilters({
    dealType: 'RENT',
    city: 'Tashkent',
    propertyType: 'apartment',
    rooms: 2,
    maxPrice: '5000 USD',
    renovation: 'euro',
    has3dTour: true,
    q: 'рядом с центром',
    sort: 'price_asc',
    invalidField: 'drop-me',
  });

  assert.deepEqual(filters, {
    dealType: 'rent',
    city: 'Ташкент',
    propertyType: 'apartment',
    rooms: '2',
    maxPrice: '5000',
    renovation: 'euro',
    has3dTour: true,
    q: 'рядом с центром',
    sort: 'price_asc',
  });

  const url = buildCatalogLinkFromFilters(filters);
  assert.ok(url.startsWith('/catalog?'));
  assert.ok(url.includes('dealType=rent'));
  assert.ok(url.includes('rooms=2'));
  assert.ok(url.includes('has3dTour=true'));
});

test('hydrateGroundedRecommendations drops hallucinated IDs and deduplicates real ones', () => {
  const prop1 = makeListing(1, { title: 'Резиденция Мирабад' });
  const prop2 = makeListing(2, { title: 'Вилла Самарканд', city: 'Самарканд', has3dTour: true });
  const map = new Map<number, PropertyListing>([
    [1, prop1],
    [2, prop2],
  ]);

  const grounded = hydrateGroundedRecommendations(
    [
      { propertyId: 999, reason: 'Выдуманный объект' },
      { propertyId: 2, reason: 'Есть бассейн и 3D-тур' },
      { propertyId: 2, reason: 'Дубль' },
      { propertyId: 1, reason: '' },
    ],
    map
  );

  assert.equal(grounded.length, 2);
  assert.equal(grounded[0].propertyId, 2);
  assert.equal(grounded[0].property.title, 'Вилла Самарканд');
  assert.equal(grounded[1].propertyId, 1);
  assert.ok(grounded[1].reason.includes('Ташкент'));
});

test('sanitizePersonalizationContext removes PII and respects enabled=false', () => {
  const disabled = sanitizePersonalizationContext({
    enabled: false,
    language: 'uz',
    preferredCity: 'Ташкент',
    budgetUsd: 300000,
    recentSearches: ['квартира в ташкенте'],
    favoritePropertyIds: [1, 2],
    email: 'secret@example.com',
    phone: '+998901234567',
  } as Record<string, unknown>);

  assert.equal(disabled.enabled, false);
  assert.equal(disabled.language, 'uz');
  assert.equal(disabled.preferredCity, '');
  assert.equal(disabled.budgetUsd, undefined);
  assert.deepEqual(disabled.recentSearches, []);
  assert.deepEqual(disabled.favoritePropertyIds, []);
  assert.equal('email' in disabled, false);
  assert.equal('phone' in disabled, false);
});

test('buildComparisonMetrics computes price per sqm, cheapest, largest, and bestValue', () => {
  const a = makeListing(10, { priceUsd: 240000, areaSqm: 120, has3dTour: true }); // $2000/m2
  const b = makeListing(11, { priceUsd: 180000, areaSqm: 80, has3dTour: false }); // $2250/m2
  const c = makeListing(12, { priceUsd: 260000, areaSqm: 150, has3dTour: true }); // $1733/m2

  const metrics = buildComparisonMetrics([a, b, c]);
  assert.ok(metrics);
  assert.equal(metrics.cheapestId, 11);
  assert.equal(metrics.largestId, 12);
  assert.equal(metrics.bestValueId, 12);
  assert.equal(metrics.pricePerSqmById[10], 2000);
  assert.deepEqual(metrics.has3dIds, [10, 12]);
});

test('storage helpers record search only when personalization is enabled and clear history completely', () => {
  const store = createMemoryStorage();
  saveAiSettings(
    {
      enabled: true,
      language: 'ru',
      preferredCity: 'Ташкент',
      recentSearches: [],
      favoritePropertyIds: [],
    },
    store
  );

  recordSearchQueryToStorage('квартира 2 комнаты', store);
  assert.deepEqual(loadAiSettings(store).recentSearches, ['квартира 2 комнаты']);

  saveAiMessages(
    [{ id: 'm1', role: 'user', text: 'Привет', createdAt: '2026-01-01T00:00:00.000Z' }],
    store
  );
  saveCompareIds([1, 2], store);
  assert.equal(loadAiMessages(store).length, 1);

  const afterClear = clearAiHistoryAndMemory(store);
  assert.deepEqual(afterClear.recentSearches, []);
  assert.equal(loadAiMessages(store).length, 0);
  assert.equal(store.getItem(AI_STORAGE_KEYS.compareIds), null);

  // Disabled personalization must NOT record search history
  saveAiSettings({ ...afterClear, enabled: false }, store);
  recordSearchQueryToStorage('вилла самарканд', store);
  assert.deepEqual(loadAiSettings(store).recentSearches, []);
});
