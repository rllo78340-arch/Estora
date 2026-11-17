import { validateUzbekistanCoordinates } from './listingWizard.ts';
import { validateUzbekistanLocation } from './uzbekistan.ts';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type ModerationFlagCode =
  | 'non_uzbekistan_location'
  | 'invalid_coordinates'
  | 'short_title'
  | 'short_description'
  | 'invalid_price'
  | 'invalid_area'
  | 'suspicious_external_link'
  | 'scam_prepayment_pattern'
  | 'uppercase_spam'
  | 'repeated_chars_spam'
  | 'unrealistic_price_per_sqm'
  | 'missing_contact_phone';

export interface ModerationNoteItem {
  code: ModerationFlagCode;
  severity: 'critical' | 'warning';
  message: string;
}

export interface ModerationEvaluationInput {
  country?: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  dealType: string;
  propertyType: string;
  priceUsd: number;
  areaSqm: number;
  contactPhone?: string;
}

export interface ModerationEvaluationResult {
  passedAutoChecks: boolean;
  score: number; // 0..100
  recommendedModerationStatus: 'pending' | 'flagged';
  isVerified: false; // Automated checks NEVER auto-verify unreviewed submissions
  flags: ModerationNoteItem[];
}

const SUSPICIOUS_LINK_RE =
  /(https?:\/\/|t\.me\/|telegram\.me\/|bit\.ly\/|tinyurl\.com\/|wa\.me\/|clck\.ru\/)/i;

const SCAM_KEYWORDS = [
  'предоплата на карту',
  'перевод до просмотра',
  'задаток на киви',
  'casino',
  'казино',
  'крипто',
  'crypto',
  'whatsapp only urgent',
  'срочно скиньте предоплату',
];

const REPEATED_CHARS_RE = /(.)\1{5,}|!{4,}|\?{4,}/;

export function moderateListingSubmission(
  input: ModerationEvaluationInput
): ModerationEvaluationResult {
  const flags: ModerationNoteItem[] = [];
  let score = 100;

  const locationCheck = validateUzbekistanLocation({
    country: input.country,
    city: input.city,
    district: input.district,
    address: input.address,
  });

  if (!locationCheck.valid) {
    flags.push({
      code: 'non_uzbekistan_location',
      severity: 'critical',
      message: locationCheck.error || 'Адрес вне пределов Узбекистана.',
    });
    score -= 60;
  }

  if (!validateUzbekistanCoordinates(input.latitude, input.longitude)) {
    flags.push({
      code: 'invalid_coordinates',
      severity: 'critical',
      message: 'Координаты на карте выходят за пределы границ Республики Узбекистан.',
    });
    score -= 40;
  }

  const title = (input.title || '').trim();
  const description = (input.description || '').trim();

  if (title.length < 8) {
    flags.push({
      code: 'short_title',
      severity: 'warning',
      message: 'Слишком короткий заголовок объявления (менее 8 символов).',
    });
    score -= 15;
  }

  if (description.length < 25) {
    flags.push({
      code: 'short_description',
      severity: 'warning',
      message: 'Описание слишком короткое (рекомендуется от 25 символов).',
    });
    score -= 15;
  }

  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0) {
    flags.push({
      code: 'invalid_price',
      severity: 'critical',
      message: 'Указана некорректная стоимость объекта.',
    });
    score -= 40;
  }

  if (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0) {
    flags.push({
      code: 'invalid_area',
      severity: 'critical',
      message: 'Указана некорректная площадь объекта.',
    });
    score -= 40;
  }

  const combinedText = `${title} ${description}`;
  if (SUSPICIOUS_LINK_RE.test(combinedText)) {
    flags.push({
      code: 'suspicious_external_link',
      severity: 'critical',
      message: 'Обнаружены внешние ссылки или редиректы в тексте объявления.',
    });
    score -= 35;
  }

  const lowerCombined = combinedText.toLowerCase();
  if (SCAM_KEYWORDS.some((kw) => lowerCombined.includes(kw))) {
    flags.push({
      code: 'scam_prepayment_pattern',
      severity: 'critical',
      message: 'Обнаружены признаки подозрительных финансовых требований / спама.',
    });
    score -= 45;
  }

  const lettersOnly = title.replace(/[^a-zа-яё]/gi, '');
  if (lettersOnly.length >= 6) {
    const upperCount = lettersOnly.replace(/[^A-ZА-ЯЁ]/g, '').length;
    if (upperCount / lettersOnly.length > 0.7) {
      flags.push({
        code: 'uppercase_spam',
        severity: 'warning',
        message: 'Заголовок набран преимущественно заглавными буквами (CAPS).',
      });
      score -= 15;
    }
  }

  if (REPEATED_CHARS_RE.test(combinedText)) {
    flags.push({
      code: 'repeated_chars_spam',
      severity: 'warning',
      message: 'Обнаружены повторяющиеся символы или спам-форматирование.',
    });
    score -= 15;
  }

  if (
    input.dealType === 'sale' &&
    input.propertyType !== 'land' &&
    input.priceUsd > 0 &&
    input.areaSqm > 0
  ) {
    const pricePerSqm = input.priceUsd / input.areaSqm;
    if (pricePerSqm < 120 || pricePerSqm > 25000) {
      flags.push({
        code: 'unrealistic_price_per_sqm',
        severity: 'warning',
        message: `Аномальная цена за м² ($${Math.round(pricePerSqm)}/м²) для рынка Узбекистана.`,
      });
      score -= 20;
    }
  }

  if (!input.contactPhone || input.contactPhone.trim().length < 7) {
    flags.push({
      code: 'missing_contact_phone',
      severity: 'warning',
      message: 'Не указан контактный телефон продавца.',
    });
    score -= 10;
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  const hasCritical = flags.some((f) => f.severity === 'critical');

  return {
    passedAutoChecks: !hasCritical && clampedScore >= 60,
    score: clampedScore,
    recommendedModerationStatus: hasCritical || clampedScore < 60 ? 'flagged' : 'pending',
    isVerified: false,
    flags,
  };
}

export function isListingVerifiedPublicly(prop: {
  status?: string | null;
  isVerified?: boolean | null;
  moderationStatus?: string | null;
}): boolean {
  return (
    prop.status === 'active' &&
    prop.isVerified === true &&
    (prop.moderationStatus === 'approved' || !prop.moderationStatus)
  );
}

export function parseModerationNotes(raw?: string | null): ModerationNoteItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is ModerationNoteItem =>
          Boolean(item) && typeof item.message === 'string' && typeof item.code === 'string'
      );
    }
    return [];
  } catch {
    return [];
  }
}
