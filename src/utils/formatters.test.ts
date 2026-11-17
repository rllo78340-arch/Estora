import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPropertyQueryString,
  formatPrice,
  formatSellerRating,
  getDealTypeLabel,
  getPropertyTypeLabel,
  getRenovationLabel,
  isUzbekistanCity,
  parseAmenities,
  PROPERTY_TYPE_LABELS,
  UZBEKISTAN_CITIES,
} from './formatters';

test('formatPrice formats USD and UZS for sale and rent accurately', () => {
  assert.equal(formatPrice(1450000, 'USD', 'sale'), '$1 450 000');
  assert.equal(formatPrice(3800, 'USD', 'rent'), '$3 800 / мес');
  assert.ok(formatPrice(1000, 'UZS', 'sale').includes('сум'));
  assert.ok(formatPrice(1000, 'UZS', 'rent').endsWith('/ мес'));
});

test('formatSellerRating formats tenths into X.Y display rating', () => {
  assert.equal(formatSellerRating(49), '4.9');
  assert.equal(formatSellerRating(50), '5.0');
  assert.equal(formatSellerRating(null), '4.9');
});

test('parseAmenities safely parses valid JSON arrays and falls back on malformed strings', () => {
  assert.deepEqual(parseAmenities('["Бассейн","Умный дом"]'), ['Бассейн', 'Умный дом']);
  assert.deepEqual(parseAmenities('not-json'), []);
  assert.deepEqual(parseAmenities('{}'), []);
});

test('buildPropertyQueryString encodes all marketplace filters and pagination cleanly', () => {
  const qs = buildPropertyQueryString({
    dealType: 'sale',
    propertyType: 'new_build',
    city: 'Ташкент',
    district: 'Мирабадский',
    rooms: '3',
    minArea: '80',
    maxFloor: '15',
    renovation: 'designer',
    furnished: 'true',
    parking: 'true',
    has3dTour: true,
    publishedWithin: '7d',
    q: 'Tashkent City',
    sort: 'popular',
    page: 2,
    pageSize: 6,
  });
  const params = new URLSearchParams(qs);
  assert.equal(params.get('dealType'), 'sale');
  assert.equal(params.get('propertyType'), 'new_build');
  assert.equal(params.get('city'), 'Ташкент');
  assert.equal(params.get('district'), 'Мирабадский');
  assert.equal(params.get('rooms'), '3');
  assert.equal(params.get('minArea'), '80');
  assert.equal(params.get('maxFloor'), '15');
  assert.equal(params.get('renovation'), 'designer');
  assert.equal(params.get('furnished'), 'true');
  assert.equal(params.get('parking'), 'true');
  assert.equal(params.get('has3dTour'), 'true');
  assert.equal(params.get('publishedWithin'), '7d');
  assert.equal(params.get('sort'), 'popular');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('pageSize'), '6');
});

test('All 9 marketplace categories and Uzbekistan cities are properly mapped', () => {
  assert.equal(Object.keys(PROPERTY_TYPE_LABELS).length, 9);
  assert.ok(UZBEKISTAN_CITIES.includes('Нукус'));
  assert.ok(UZBEKISTAN_CITIES.includes('Ургенч'));
  assert.equal(isUzbekistanCity('Карши'), true);
  assert.equal(getDealTypeLabel('sale'), 'Купить');
  assert.equal(getDealTypeLabel('rent'), 'Арендовать');
  assert.equal(getPropertyTypeLabel('land'), 'Земельные участки');
  assert.equal(getRenovationLabel('euro'), 'Евроремонт');
});
