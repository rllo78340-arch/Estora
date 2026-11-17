export const UZBEKISTAN_CITIES = [
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
  'Коканд',
  'Хива',
  'Маргилан',
  'Чирчик',
  'Алмалык',
  'Ангрен',
  'Гулистан',
] as const;

const ALLOWED_COUNTRIES = new Set([
  'uzbekistan',
  'узбекистан',
  'республика узбекистан',
  'republic of uzbekistan',
  'uz',
  "o'zbekiston",
  'oʻzbekiston',
]);

const FOREIGN_LOCATION_BLOCKLIST = [
  'dubai',
  'дубай',
  'оаэ',
  'uae',
  'abu dhabi',
  'istanbul',
  'стамбул',
  'турция',
  'turkey',
  'antalya',
  'moscow',
  'москва',
  'россия',
  'russia',
  'saint petersburg',
  'санкт-петербург',
  'almaty',
  'алматы',
  'astana',
  'астана',
  'kazakhstan',
  'казахстан',
  'bishkek',
  'бишкек',
  'dushanbe',
  'душанбе',
  'london',
  'лондон',
  'new york',
  'paris',
  'париж',
  'berlin',
  'georgia',
  'tbilisi',
  'baku',
];

export interface LocationValidationInput {
  country?: string;
  city: string;
  district: string;
  address: string;
}

export interface LocationValidationResult {
  valid: boolean;
  normalizedCountry: 'Uzbekistan';
  normalizedCity: string;
  error?: string;
}

export function validateUzbekistanLocation(
  input: LocationValidationInput
): LocationValidationResult {
  const rawCountry = (input.country ?? 'Uzbekistan').trim();
  const normalizedCountryKey = rawCountry.toLowerCase();

  if (!ALLOWED_COUNTRIES.has(normalizedCountryKey)) {
    return {
      valid: false,
      normalizedCountry: 'Uzbekistan',
      normalizedCity: '',
      error:
        'На платформе ESTORA разрешены исключительно объекты, физически расположенные в Республике Узбекистан.',
    };
  }

  const city = input.city.trim();
  const district = input.district.trim();
  const address = input.address.trim();

  if (!city || !district || !address) {
    return {
      valid: false,
      normalizedCountry: 'Uzbekistan',
      normalizedCity: city,
      error: 'Укажите населённый пункт Узбекистана, район и точный адрес объекта.',
    };
  }

  const combinedLower = `${city} ${district} ${address}`.toLowerCase();
  const matchedForeign = FOREIGN_LOCATION_BLOCKLIST.find((token) =>
    combinedLower.includes(token)
  );
  if (matchedForeign) {
    return {
      valid: false,
      normalizedCountry: 'Uzbekistan',
      normalizedCity: city,
      error:
        'Объект не может быть опубликован: адрес указывает на расположение за пределами Узбекистана.',
    };
  }

  return {
    valid: true,
    normalizedCountry: 'Uzbekistan',
    normalizedCity: city,
  };
}
