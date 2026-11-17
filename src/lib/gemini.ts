import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiAgentResponse,
  AiIntent,
  AiLanguage,
  AiPersonalizationSettings,
  AiPreferenceSuggestion,
  PropertyFilters,
  PropertyListing,
} from '../types/estora.ts';
import {
  buildCatalogLinkFromFilters,
  buildComparisonMetrics,
  hydrateGroundedRecommendations,
  normalizeUzbekistanCity,
  sanitizeAiFilters,
  sanitizePersonalizationContext,
} from '../utils/aiAgent.ts';
import type { BuildingArchetype, PoolPlacement, SkyMood, VisionArchOverride } from '../utils/propertyReconstruction.ts';

export interface AiTurnHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface RunEstoraAiAgentInput {
  prompt: string;
  history?: AiTurnHistoryItem[];
  personalization?: Partial<AiPersonalizationSettings> | null;
  selectedCompareIds?: number[];
  recentRecommendedIds?: number[];
  queryCatalog: (filters: PropertyFilters & { pageSize?: number }) => Promise<{
    properties: PropertyListing[];
    total: number;
  }>;
  getPropertiesByIds: (ids: number[]) => Promise<PropertyListing[]>;
}

const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY не настроен в секретах сервера. Подключите ключ в настройках Secrets для активации ESTORA AI.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return new Error(
      'Сервер ESTORA AI (Gemini) сейчас испытывает высокую нагрузку (503). Пожалуйста, повторите запрос через несколько секунд.'
    );
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return new Error(
      'Превышен временный лимит запросов к Gemini API (429). Пожалуйста, повторите запрос чуть позже.'
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

async function callGeminiWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  const modelsToTry = [params.model, params.model, 'gemini-3.1-flash-lite'];
  let lastError: unknown;
  for (let attempt = 0; attempt < modelsToTry.length; attempt += 1) {
    try {
      return await ai.models.generateContent({
        ...params,
        model: modelsToTry[attempt],
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (attempt < modelsToTry.length - 1 && isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      throw formatGeminiError(err);
    }
  }
  throw formatGeminiError(lastError);
}

function serializePropertyForAi(p: PropertyListing): string {
  // Strictly exclude owner PII (email, phone, fullName, contactPhone)
  let amenitiesList = '';
  try {
    const parsed = JSON.parse(p.amenities || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      amenitiesList = parsed.slice(0, 8).join(', ');
    }
  } catch {
    amenitiesList = '';
  }

  const parts = [
    `ID #${p.id}`,
    `Название: ${p.title}`,
    `Сделка: ${p.dealType === 'rent' ? 'Аренда (в месяц)' : 'Продажа'}`,
    `Тип: ${p.propertyType}`,
    `Локация: ${p.city}, ${p.district} (${p.address})`,
    `Цена: $${p.priceUsd.toLocaleString('en-US')}`,
    `Площадь: ${p.areaSqm} м²`,
    `Комнат: ${p.bedrooms}`,
    `Этаж: ${p.floor}/${p.totalFloors}`,
    `Ремонт: ${p.renovation || 'не указан'}`,
    `Мебель: ${p.furnished ? 'Да' : 'Нет'}`,
    `Парковка: ${p.parking ? 'Да' : 'Нет'}`,
    `3D-тур: ${p.has3dTour ? 'Да' : 'Нет'}`,
  ];
  if (amenitiesList) parts.push(`Удобства: ${amenitiesList}`);
  if (p.description) parts.push(`Описание: ${p.description.slice(0, 160)}`);
  return parts.join(' | ');
}

function formatAnonymousPersonalizationBlock(
  settings: AiPersonalizationSettings,
  favoriteListings: PropertyListing[]
): string {
  if (!settings.enabled) {
    return 'Персонализация ОТКЛЮЧЕНА пользователем. Опирайся только на текущий запрос и историю диалога.';
  }

  const lines: string[] = ['Персонализация ВКЛЮЧЕНА (без персональных данных):'];
  if (settings.preferredCity) lines.push(`- Предпочитаемый город: ${settings.preferredCity}`);
  if (settings.budgetUsd) lines.push(`- Ориентир бюджета: $${settings.budgetUsd.toLocaleString('en-US')}`);
  if (settings.preferredPropertyType) {
    lines.push(`- Предпочитаемый тип: ${settings.preferredPropertyType}`);
  }
  if (settings.preferredRooms) lines.push(`- Комнатность: ${settings.preferredRooms}`);
  if (settings.recentSearches.length > 0) {
    lines.push(`- Недавние поисковые запросы: ${settings.recentSearches.slice(0, 5).join('; ')}`);
  }
  if (favoriteListings.length > 0) {
    lines.push(
      `- Избранные объекты пользователя:\n${favoriteListings
        .slice(0, 5)
        .map((f) => `  * ${serializePropertyForAi(f)}`)
        .join('\n')}`
    );
  }
  return lines.join('\n');
}

interface Stage1Output {
  intent?: string;
  language?: string;
  filters?: Record<string, unknown>;
  compareRequested?: boolean;
  useRecentRecommendedForCompare?: boolean;
  preferenceSuggestion?: {
    preferredCity?: string;
    budgetUsd?: number;
    preferredPropertyType?: string;
    preferredRooms?: string;
    summary?: string;
  } | null;
}

interface Stage2Output {
  reply?: string;
  recommendedListings?: Array<{ propertyId?: number; reason?: string }>;
  comparisonSummary?: string;
  clarifyingQuestions?: string[];
}

export async function runEstoraAiAgent(
  input: RunEstoraAiAgentInput
): Promise<AiAgentResponse> {
  const ai = getGeminiClient();
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error('Введите ваш запрос для ESTORA AI.');
  }

  const cleanPersonalization = sanitizePersonalizationContext(input.personalization);
  const targetLanguage: AiLanguage = cleanPersonalization.language || 'ru';
  const cleanHistory = (input.history ?? [])
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string')
    .slice(-6)
    .map((h) => ({ role: h.role, text: h.text.slice(0, 600) }));

  const selectedCompareIds = Array.from(
    new Set((input.selectedCompareIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))
  ).slice(0, 4);

  const recentRecommendedIds = Array.from(
    new Set(
      (input.recentRecommendedIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
    )
  ).slice(0, 4);

  const favoriteIds = cleanPersonalization.enabled ? cleanPersonalization.favoritePropertyIds : [];
  const [favoriteListings, pinnedCompareListings, recentRecListings] = await Promise.all([
    favoriteIds.length > 0 ? input.getPropertiesByIds(favoriteIds) : Promise.resolve([]),
    selectedCompareIds.length > 0 ? input.getPropertiesByIds(selectedCompareIds) : Promise.resolve([]),
    recentRecommendedIds.length > 0
      ? input.getPropertiesByIds(recentRecommendedIds)
      : Promise.resolve([]),
  ]);

  const historyBlock =
    cleanHistory.length > 0
      ? cleanHistory
          .map((h) => `${h.role === 'user' ? 'Пользователь' : 'ESTORA AI'}: ${h.text}`)
          .join('\n')
      : 'Нет предыдущих сообщений.';

  const personalizationBlock = formatAnonymousPersonalizationBlock(
    cleanPersonalization,
    favoriteListings
  );

  // STAGE 1: Parse intent & structured Uzbekistan catalog filters
  const stage1Prompt = `Проанализируй запрос пользователя маркетплейса недвижимости ESTORA (только Узбекистан).

История диалога:
${historyBlock}

${personalizationBlock}
Выбранные ID для сравнения: ${selectedCompareIds.length > 0 ? selectedCompareIds.join(', ') : 'нет'}
Недавно показанные ID объектов: ${recentRecommendedIds.length > 0 ? recentRecommendedIds.join(', ') : 'нет'}

Текущий запрос пользователя: "${prompt}"

Правила разбора:
1. intent:
   - "compare" если пользователь просит сравнить объекты ("сравни", "какой лучше", "compare", "taqqosla")
   - "search" если ищет/просит подобрать объекты (даже без указания города — тогда city пустой)
   - "advisory" если спрашивает общие вопросы про рынок/районы/доходность Узбекистана
   - "clarify" если запрос совсем неясен без уточнения
2. filters:
   - dealType: "sale" | "rent" | ""
   - propertyType: "apartment" | "house" | "villa" | "penthouse" | "new_build" | "commercial" | "office" | "shop" | "land" | ""
   - city: только города Узбекистана на русском (Ташкент, Самарканд, Бухара, Фергана, Наманган, Андижан, Нукус, Карши, Термез, Навои, Ургенч, Джизак, Хива, Коканд, ...) или ""
   - district: строка района (например "Мирабадский", "Центр") или ""
   - rooms: "1" | "2" | "3" | "4" | "5+" | "" (если "с двумя комнатами" -> "2")
   - minPrice, maxPrice: числа в USD (для недорогих квартир без суммы используй sort="price_asc")
   - renovation: "designer" | "euro" | "cosmetic" | "shell" | "" (если "хороший ремонт" или "современная" -> не ставь жесткий фильтр если может сузить до 0, или поставь q/euro по смыслу)
   - has3dTour: boolean
   - q: ключевое слово для текстового поиска (например "бассейн" для "дома с бассейном", "центр" для "рядом с центром")
   - sort: "newest" | "price_asc" | "price_desc" | "popular"
3. Если пользователь упоминает желаемый город/бюджет/тип на будущее, заполни preferenceSuggestion с кратким summary, чтобы мы могли ПРЕДЛОЖИТЬ (не автоматически!) сохранить предпочтение. Иначе null.`;

  const stage1Response = await callGeminiWithRetry(ai, {
    model: MODEL_NAME,
    contents: stage1Prompt,
    config: {
      systemInstruction:
        'Ты — парсер поисковых намерений ESTORA (рынок недвижимости Узбекистана). Возвращай строго валидный JSON по схеме.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          language: { type: Type.STRING },
          compareRequested: { type: Type.BOOLEAN },
          useRecentRecommendedForCompare: { type: Type.BOOLEAN },
          filters: {
            type: Type.OBJECT,
            properties: {
              dealType: { type: Type.STRING },
              propertyType: { type: Type.STRING },
              city: { type: Type.STRING },
              district: { type: Type.STRING },
              rooms: { type: Type.STRING },
              minPrice: { type: Type.NUMBER },
              maxPrice: { type: Type.NUMBER },
              renovation: { type: Type.STRING },
              has3dTour: { type: Type.BOOLEAN },
              q: { type: Type.STRING },
              sort: { type: Type.STRING },
            },
          },
          preferenceSuggestion: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              preferredCity: { type: Type.STRING },
              budgetUsd: { type: Type.NUMBER },
              preferredPropertyType: { type: Type.STRING },
              preferredRooms: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
          },
        },
        required: ['intent', 'language', 'filters', 'compareRequested'],
      },
    },
  });

  let stage1: Stage1Output = {};
  try {
    stage1 = JSON.parse(stage1Response.text || '{}') as Stage1Output;
  } catch {
    stage1 = { intent: 'search', filters: {} };
  }

  const intent: AiIntent =
    stage1.intent === 'compare' ||
    stage1.intent === 'advisory' ||
    stage1.intent === 'clarify' ||
    stage1.intent === 'search'
      ? stage1.intent
      : 'search';

  const appliedFilters = sanitizeAiFilters(stage1.filters);

  // Respect user's explicitly chosen UI language; otherwise fall back to detected language
  const allowedLangSet = new Set<AiLanguage>(['en', 'zh', 'hi', 'es', 'ar', 'fr', 'pt', 'bn', 'ru', 'uz']);
  const detectedLang =
    typeof stage1.language === 'string' && allowedLangSet.has(stage1.language as AiLanguage)
      ? (stage1.language as AiLanguage)
      : undefined;
  const effectiveLang: AiLanguage = allowedLangSet.has(cleanPersonalization.language)
    ? cleanPersonalization.language
    : detectedLang || targetLanguage;

  // Query PostgreSQL strictly with sanitized filters
  const exactResult = await input.queryCatalog({ ...appliedFilters, pageSize: 12 });

  // Broader fallback search + full active pool (so AI sees actual catalog & near matches)
  const [broadCityResult, fullCatalogPool] = await Promise.all([
    exactResult.properties.length === 0 && (appliedFilters.city || appliedFilters.dealType)
      ? input.queryCatalog({
          city: appliedFilters.city,
          dealType: appliedFilters.dealType,
          sort: appliedFilters.sort,
          pageSize: 12,
        })
      : Promise.resolve({ properties: [], total: 0 }),
    input.queryCatalog({ pageSize: 30, sort: appliedFilters.sort || 'popular' }),
  ]);

  // Build authoritative DB map so zero unverified IDs can ever pass
  const realMap = new Map<number, PropertyListing>();
  for (const list of [
    exactResult.properties,
    broadCityResult.properties,
    fullCatalogPool.properties,
    pinnedCompareListings,
    recentRecListings,
    favoriteListings,
  ]) {
    for (const item of list) {
      if (!realMap.has(item.id)) {
        realMap.set(item.id, item);
      }
    }
  }

  // Resolve real comparison set
  let comparedProperties: PropertyListing[] = [];
  if (pinnedCompareListings.length >= 2) {
    comparedProperties = pinnedCompareListings.slice(0, 4);
  } else if (stage1.compareRequested || intent === 'compare') {
    if (pinnedCompareListings.length > 0) {
      const extras = fullCatalogPool.properties.filter(
        (p) => !pinnedCompareListings.some((c) => c.id === p.id)
      );
      comparedProperties = [...pinnedCompareListings, ...extras].slice(0, 3);
    } else if (recentRecListings.length >= 2) {
      comparedProperties = recentRecListings.slice(0, 4);
    } else if (exactResult.properties.length >= 2) {
      comparedProperties = exactResult.properties.slice(0, 3);
    } else {
      comparedProperties = fullCatalogPool.properties.slice(0, 3);
    }
  }

  const candidatePool =
    exactResult.properties.length > 0
      ? exactResult.properties
      : broadCityResult.properties.length > 0
        ? broadCityResult.properties
        : fullCatalogPool.properties.slice(0, 15);

  const exactLines =
    exactResult.properties.length > 0
      ? exactResult.properties.map(serializePropertyForAi).join('\n')
      : 'Точных совпадений по строгим фильтрам: 0.';

  const poolLines = candidatePool.map(serializePropertyForAi).join('\n');
  const compareLines =
    comparedProperties.length >= 2
      ? comparedProperties.map(serializePropertyForAi).join('\n')
      : 'Сравнение не выбрано.';

  const LANG_DIRECTIVES: Record<AiLanguage, string> = {
    en: 'Reply strictly in clear, refined English.',
    zh: '请严格使用流畅、专业的简体中文回答。',
    hi: 'कृपया स्पष्ट और स्वाभाविक हिंदी (देवनागरी) में उत्तर दें।',
    es: 'Responde estrictamente en español claro y profesional.',
    ar: 'أجب حصراً باللغة العربية الفصحى الواضحة والأنيقة.',
    fr: 'Réponds strictement en français clair, précis et élégant.',
    pt: 'Responda estritamente em português claro e elegante.',
    bn: 'দয়া করে স্পষ্ট এবং প্রাঞ্জল বাংলায় উত্তর দিন।',
    ru: 'Отвечай на грамотном, лаконичном русском языке.',
    uz: "O'zbek tilida (lotin yozuvida) ravon va aniq javob ber.",
  };

  const langDirective = LANG_DIRECTIVES[effectiveLang] || LANG_DIRECTIVES.ru;

  // STAGE 2: Grounded response synthesis
  const stage2Prompt = `${langDirective}

Запрос пользователя: "${prompt}"
Распознанное намерение: ${intent}
Применённые фильтры каталога: ${JSON.stringify(appliedFilters)}

История диалога:
${historyBlock}

${personalizationBlock}

Точные совпадения из PostgreSQL ESTORA (${exactResult.total}):
${exactLines}

Доступные реальные объекты из каталога ESTORA (только эти ID разрешены!):
${poolLines}

Объекты для сравнения (${comparedProperties.length}):
${compareLines}

Строгие инструкции:
1. НИКОГДА не выдумывай ID объектов, цены, районы или характеристики, которых нет в списке выше.
2. В recommendedListings выбери 1–4 наиболее подходящих реальных ID из списка выше (если вопрос чисто теоретический и объекты не нужны — верни пустой массив []). Для каждого объекта напиши 1–2 конкретных предложения "reason" — почему именно этот объект подходит под запрос или предпочтения пользователя.
3. Если точных совпадений 0, честно сообщи об этом пользователю, предложи ближайшие реальные варианты из доступного каталога (если уместно) и добавь 2–3 уточняющих вопроса в clarifyingQuestions.
4. Если запрос недоопределён (не указан город, бюджет или покупка/аренда), добавь 2–3 коротких уточняющих вопроса в clarifyingQuestions (каждый до 60 символов, чтобы пользователь мог нажать как быстрый ответ).
5. Если объектов для сравнения >= 2, напиши развёрнутый сравнительный вывод в comparisonSummary (стоимость, м², цена за м², локация, ремонт, наличие 3D-тура, кому что выгоднее).`;

  const stage2Response = await callGeminiWithRetry(ai, {
    model: MODEL_NAME,
    contents: stage2Prompt,
    config: {
      systemInstruction:
        'Ты — ESTORA AI, элитный интеллектуальный агент по недвижимости Узбекистана. Опирайся исключительно на реальные записи базы данных ESTORA.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          recommendedListings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                propertyId: { type: Type.INTEGER },
                reason: { type: Type.STRING },
              },
              required: ['propertyId', 'reason'],
            },
          },
          comparisonSummary: { type: Type.STRING },
          clarifyingQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['reply', 'recommendedListings', 'clarifyingQuestions'],
      },
    },
  });

  const stage2Text = (stage2Response.text ?? '').trim();
  if (!stage2Text) {
    throw new Error('ESTORA AI вернул пустой ответ. Попробуйте переформулировать запрос.');
  }

  let stage2: Stage2Output;
  try {
    stage2 = JSON.parse(stage2Text) as Stage2Output;
  } catch {
    throw new Error('ESTORA AI вернул некорректный формат ответа. Повторите запрос.');
  }

  const reply = typeof stage2.reply === 'string' && stage2.reply.trim() ? stage2.reply.trim() : '';
  if (!reply) {
    throw new Error('ESTORA AI не смог сформировать ответ. Попробуйте уточнить запрос.');
  }

  const recommendations = hydrateGroundedRecommendations(
    Array.isArray(stage2.recommendedListings)
      ? stage2.recommendedListings.map((r) => ({ propertyId: r?.propertyId, reason: r?.reason }))
      : [],
    realMap
  );

  // If user asked to compare and comparison wasn't set by pinned IDs yet, sync with recommended if >=2
  if ((stage1.compareRequested || intent === 'compare') && comparedProperties.length < 2) {
    if (recommendations.length >= 2) {
      comparedProperties = recommendations.slice(0, 4).map((r) => r.property);
    }
  }

  const comparisonMetrics = buildComparisonMetrics(comparedProperties);
  const comparisonSummary =
    comparedProperties.length >= 2 &&
    typeof stage2.comparisonSummary === 'string' &&
    stage2.comparisonSummary.trim().length > 0
      ? stage2.comparisonSummary.trim()
      : null;

  const clarifyingQuestions = Array.isArray(stage2.clarifyingQuestions)
    ? stage2.clarifyingQuestions
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
        .map((q) => q.trim().slice(0, 90))
        .slice(0, 3)
    : [];

  let preferenceSuggestion: AiPreferenceSuggestion | null = null;
  if (
    stage1.preferenceSuggestion &&
    typeof stage1.preferenceSuggestion.summary === 'string' &&
    stage1.preferenceSuggestion.summary.trim().length > 0
  ) {
    const city = normalizeUzbekistanCity(stage1.preferenceSuggestion.preferredCity);
    const budget =
      typeof stage1.preferenceSuggestion.budgetUsd === 'number' &&
      stage1.preferenceSuggestion.budgetUsd > 0
        ? Math.round(stage1.preferenceSuggestion.budgetUsd)
        : undefined;
    if (city || budget || stage1.preferenceSuggestion.preferredPropertyType) {
      preferenceSuggestion = {
        ...(city ? { preferredCity: city } : {}),
        ...(budget ? { budgetUsd: budget } : {}),
        ...(stage1.preferenceSuggestion.preferredPropertyType
          ? { preferredPropertyType: stage1.preferenceSuggestion.preferredPropertyType }
          : {}),
        ...(stage1.preferenceSuggestion.preferredRooms
          ? { preferredRooms: stage1.preferenceSuggestion.preferredRooms }
          : {}),
        summary: stage1.preferenceSuggestion.summary.trim().slice(0, 140),
      };
    }
  }

  return {
    reply,
    configured: true,
    intent,
    language: effectiveLang,
    appliedFilters,
    catalogUrl: buildCatalogLinkFromFilters(appliedFilters),
    totalCatalogMatches: exactResult.total,
    recommendations,
    comparedProperties,
    comparisonSummary,
    comparisonMetrics,
    clarifyingQuestions,
    preferenceSuggestion,
  };
}

const VALID_ARCHETYPES = new Set<BuildingArchetype>([
  'boulevard_cantilever_villa',
  'samarkand_courtyard_villa',
  'tashkent_residences_complex',
  'bukhara_heritage_courtyard',
  'modern_pergola_villa',
  'commercial_glass_tower',
  'penthouse_skyline_tower',
  'classic_estate',
]);

const VALID_ROOF_TYPES = new Set(['flat', 'sloped', 'mansard']);
const VALID_FACADE_STYLES = new Set(['travertine', 'brick', 'modern_white', 'classic', 'minimalist']);
const VALID_POOL_PLACEMENTS = new Set<PoolPlacement>(['front_center', 'courtyard_stepping', 'side', 'none']);
const VALID_SKY_MOODS = new Set<SkyMood>(['sunset', 'daylight', 'dusk']);

const VALID_FLOOR_FINISHES = new Set(['parquet', 'walnut', 'marble', 'tile', 'concrete']);

export async function analyzeBuildingImageWithGemini(input: {
  imageBase64: string;
  mimeType: string;
  title?: string;
  propertyType?: string;
  description?: string;
}): Promise<VisionArchOverride | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Проанализируй фотографию недвижимости ("${input.title || ''}", тип: ${input.propertyType || ''}).
Подбери наиболее точный 3D-архетип, параметры экстерьера И видимого/предполагаемого интерьера, чтобы 3D-модель максимально соответствовала фотографии снаружи и внутри:
- boulevard_cantilever_villa: широкая 2-этажная современная вилла из травертина с консольной плоской крышей, деревянной перголой на балконе и длинным бассейном перед фасадом.
- samarkand_courtyard_villa: светлая вилла из самаркандского известняка с Г/П-образным двором, стеклянной гостиной-пристройкой, резными ставнями и бассейном со ступенями-камнями.
- tashkent_residences_complex: многоэтажный современный ЖК из травертина и тёмного металла с выступающими деревянными балконами и зелёным двором-парком.
- bukhara_heritage_courtyard: кирпичное/историческое здание со стрельчатыми арками, деревянным айваном, фонтаном во дворе и стеклянным павильоном.
- modern_pergola_villa: современная вилла с угловым панорамным остеклением, деревянной перголой с тканевым навесом во дворе и бассейном.
- commercial_glass_tower: деловой/коммерческий центр с травертиновыми пилонами и центральным стеклянным атриумом.
- penthouse_skyline_tower: высотная жилая башня / пентхаус с панорамным остеклением и скай-террасой.
- classic_estate: классический коттедж со скатной черепичной крышей и гаражом.

Определи также интерьерные параметры (interiorWallColor hex, interiorFloorFinish: parquet|walnut|marble|tile|concrete, interiorFloorColor hex, sofaColor hex, kitchenColor hex, rugColor hex).
Верни строго валидный JSON с цветами стен (wallColor hex), акцента дерева/металла (accentColor hex), количеством этажей, типом крыши, наличием бассейна, перголы, балконов, параметрами интерьера и кратким описанием стиля (styleLabel на русском, до 70 символов).`;

    const response = await callGeminiWithRetry(ai, {
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: input.imageBase64, mimeType: input.mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            archetype: { type: Type.STRING },
            floors: { type: Type.INTEGER },
            roofType: { type: Type.STRING },
            facadeStyle: { type: Type.STRING },
            wallColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            hasPool: { type: Type.BOOLEAN },
            poolPlacement: { type: Type.STRING },
            hasPergola: { type: Type.BOOLEAN },
            hasWoodBalconies: { type: Type.BOOLEAN },
            hasGlassSunroom: { type: Type.BOOLEAN },
            hasCourtyardArches: { type: Type.BOOLEAN },
            hasGarage: { type: Type.BOOLEAN },
            skyMood: { type: Type.STRING },
            styleLabel: { type: Type.STRING },
            interiorWallColor: { type: Type.STRING },
            interiorFloorFinish: { type: Type.STRING },
            interiorFloorColor: { type: Type.STRING },
            sofaColor: { type: Type.STRING },
            kitchenColor: { type: Type.STRING },
            rugColor: { type: Type.STRING },
          },
          required: ['archetype', 'floors', 'roofType', 'facadeStyle', 'wallColor', 'hasPool'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
    const arch = String(parsed.archetype || '');
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    return {
      archetype: VALID_ARCHETYPES.has(arch as BuildingArchetype)
        ? (arch as BuildingArchetype)
        : undefined,
      floors:
        typeof parsed.floors === 'number' && parsed.floors >= 1 && parsed.floors <= 12
          ? Math.round(parsed.floors)
          : undefined,
      roofType: VALID_ROOF_TYPES.has(String(parsed.roofType))
        ? (parsed.roofType as 'flat' | 'sloped' | 'mansard')
        : undefined,
      facadeStyle: VALID_FACADE_STYLES.has(String(parsed.facadeStyle))
        ? (parsed.facadeStyle as 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist')
        : undefined,
      wallColor:
        typeof parsed.wallColor === 'string' && hexRegex.test(parsed.wallColor)
          ? parsed.wallColor
          : undefined,
      accentColor:
        typeof parsed.accentColor === 'string' && hexRegex.test(parsed.accentColor)
          ? parsed.accentColor
          : undefined,
      hasPool: typeof parsed.hasPool === 'boolean' ? parsed.hasPool : undefined,
      poolPlacement: VALID_POOL_PLACEMENTS.has(String(parsed.poolPlacement) as PoolPlacement)
        ? (parsed.poolPlacement as PoolPlacement)
        : undefined,
      hasPergola: typeof parsed.hasPergola === 'boolean' ? parsed.hasPergola : undefined,
      hasWoodBalconies:
        typeof parsed.hasWoodBalconies === 'boolean' ? parsed.hasWoodBalconies : undefined,
      hasGlassSunroom:
        typeof parsed.hasGlassSunroom === 'boolean' ? parsed.hasGlassSunroom : undefined,
      hasCourtyardArches:
        typeof parsed.hasCourtyardArches === 'boolean' ? parsed.hasCourtyardArches : undefined,
      hasGarage: typeof parsed.hasGarage === 'boolean' ? parsed.hasGarage : undefined,
      skyMood: VALID_SKY_MOODS.has(String(parsed.skyMood) as SkyMood)
        ? (parsed.skyMood as SkyMood)
        : undefined,
      styleLabel:
        typeof parsed.styleLabel === 'string' && parsed.styleLabel.trim()
          ? parsed.styleLabel.trim().slice(0, 80)
          : undefined,
      interiorWallColor:
        typeof parsed.interiorWallColor === 'string' && hexRegex.test(parsed.interiorWallColor)
          ? parsed.interiorWallColor
          : undefined,
      interiorFloorFinish: VALID_FLOOR_FINISHES.has(String(parsed.interiorFloorFinish))
        ? (parsed.interiorFloorFinish as 'parquet' | 'walnut' | 'marble' | 'tile' | 'concrete')
        : undefined,
      interiorFloorColor:
        typeof parsed.interiorFloorColor === 'string' && hexRegex.test(parsed.interiorFloorColor)
          ? parsed.interiorFloorColor
          : undefined,
      sofaColor:
        typeof parsed.sofaColor === 'string' && hexRegex.test(parsed.sofaColor)
          ? parsed.sofaColor
          : undefined,
      kitchenColor:
        typeof parsed.kitchenColor === 'string' && hexRegex.test(parsed.kitchenColor)
          ? parsed.kitchenColor
          : undefined,
      rugColor:
        typeof parsed.rugColor === 'string' && hexRegex.test(parsed.rugColor)
          ? parsed.rugColor
          : undefined,
    };
  } catch {
    return null;
  }
}

