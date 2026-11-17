import test from 'node:test';
import assert from 'node:assert/strict';
import { UZBEKISTAN_CITIES, validateUzbekistanLocation } from './uzbekistan';

test('validateUzbekistanLocation accepts valid Uzbekistan cities and districts', () => {
  const res1 = validateUzbekistanLocation({
    country: 'Uzbekistan',
    city: 'Ташкент',
    district: 'Мирабадский район',
    address: 'ул. Нукус, 15',
  });
  assert.equal(res1.valid, true);
  assert.equal(res1.normalizedCountry, 'Uzbekistan');

  const res2 = validateUzbekistanLocation({
    country: 'Узбекистан',
    city: 'Нукус',
    district: 'Центральный',
    address: 'пр. Дослык, 44',
  });
  assert.equal(res2.valid, true);
});

test('validateUzbekistanLocation rejects non-Uzbekistan countries', () => {
  const res = validateUzbekistanLocation({
    country: 'UAE',
    city: 'Ташкент',
    district: 'Юнусабадский',
    address: 'ул. Амира Темура, 1',
  });
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('Узбекистан'));
});

test('validateUzbekistanLocation rejects foreign cities even if country claims Uzbekistan', () => {
  const res = validateUzbekistanLocation({
    country: 'Uzbekistan',
    city: 'Dubai',
    district: 'Marina',
    address: 'Tower 1',
  });
  assert.equal(res.valid, false);
  assert.ok(res.error?.includes('за пределами Узбекистана'));
});

test('UZBEKISTAN_CITIES includes all 12+ required regional hubs', () => {
  const required = [
    'Ташкент',
    'Самарканд',
    'Бухара',
    'Андижан',
    'Фергана',
    'Наманган',
    'Нукус',
    'Карши',
    'Термез',
    'Навои',
    'Ургенч',
    'Джизак',
  ];
  for (const city of required) {
    assert.ok((UZBEKISTAN_CITIES as readonly string[]).includes(city), `Missing city ${city}`);
  }
});
