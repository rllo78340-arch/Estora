import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Columns3,
  Eye,
  Languages,
  Phone,
  Send,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { LANGUAGE_LIST } from '../i18n';
import { apiFetch } from '../lib/api';
import type {
  AiAgentResponse,
  AiChatMessage,
  AiPersonalizationSettings,
  AiPreferenceSuggestion,
  DealType,
  PropertyFilters,
  PropertyListing,
  PropertyType,
  RenovationType,
} from '../types/estora';
import {
  buildComparisonMetrics,
  clearAiHistoryAndMemory,
  hasActiveAiFilters,
  loadAiMessages,
  loadAiSettings,
  loadCompareIds,
  recordSearchQueryToStorage,
  saveAiMessages,
  saveAiSettings,
  saveCompareIds,
  summarizeAssistantTurnForHistory,
} from '../utils/aiAgent';
import { UZBEKISTAN_CITIES } from '../utils/formatters';
import { hasReal3dContent } from '../utils/tour3d';

interface EstoraAiPageProps {
  querySearch: string;
  onNavigate: (path: string) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

export function EstoraAiPage({
  querySearch,
  onNavigate,
  onSelectProperty,
}: EstoraAiPageProps) {
  const { idToken, currency, favoriteIds } = useAuth();
  const { language: uiLanguage, t, formatPrice, localizeCity } = useI18n();
  const initialQ = new URLSearchParams(querySearch).get('q') || '';

  const [prompt, setPrompt] = useState(initialQ);
  const [messages, setMessages] = useState<AiChatMessage[]>(() => loadAiMessages());
  const [settings, setSettings] = useState<AiPersonalizationSettings>(() => ({
    ...loadAiSettings(),
    language: uiLanguage,
  }));
  const [compareIds, setCompareIds] = useState<number[]>(() => loadCompareIds());
  const [compareListings, setCompareListings] = useState<PropertyListing[]>([]);
  const [latestComparisonSummary, setLatestComparisonSummary] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmittedRef = useRef<string>('');

  // Keep AI response language synced when user changes site language in header
  useEffect(() => {
    setSettings((prev) => saveAiSettings({ ...prev, language: uiLanguage }));
  }, [uiLanguage]);

  useEffect(() => {
    let active = true;
    if (compareIds.length === 0) {
      setCompareListings([]);
      return;
    }
    const loadCompared = async () => {
      try {
        const res = await apiFetch<{ properties: PropertyListing[] }>(
          `/api/properties/batch?ids=${compareIds.join(',')}`
        );
        if (!active) return;
        const byId = new Map(res.properties.map((p) => [p.id, p]));
        setCompareListings(
          compareIds.map((id) => byId.get(id)).filter((p): p is PropertyListing => Boolean(p))
        );
      } catch {
        // Keep current state if transient network error
      }
    };
    void loadCompared();
    return () => {
      active = false;
    };
  }, [compareIds]);

  const recentRecommendedIds = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const recs = messages[i]?.response?.recommendations;
      if (recs && recs.length > 0) {
        return recs.map((r) => r.propertyId).slice(0, 4);
      }
    }
    return [];
  }, [messages]);

  const formatAppliedFilterTokens = (filters: PropertyFilters): string[] => {
    const tokens: string[] = [];
    if (filters.dealType) {
      tokens.push(t.common.dealTypes[filters.dealType as DealType] ?? filters.dealType);
    }
    if (filters.city) tokens.push(localizeCity(filters.city));
    if (filters.district) tokens.push(filters.district);
    if (filters.propertyType) {
      tokens.push(
        t.common.propertyTypes[filters.propertyType as PropertyType] ?? filters.propertyType
      );
    }
    if (filters.rooms) tokens.push(`${filters.rooms} ${t.common.roomsShort}`);
    if (filters.maxPrice) tokens.push(`<= $${Number(filters.maxPrice).toLocaleString('en-US')}`);
    if (filters.minPrice) tokens.push(`>= $${Number(filters.minPrice).toLocaleString('en-US')}`);
    if (filters.renovation) {
      tokens.push(
        t.common.renovations[filters.renovation as RenovationType] ?? filters.renovation
      );
    }
    if (filters.has3dTour) tokens.push(t.ai.tour3dYes);
    if (filters.q) tokens.push(`«${filters.q}»`);
    return tokens;
  };

  const askAi = async (question: string, overrideCompareIds?: number[]) => {
    const clean = question.trim();
    if (!clean) {
      setError(t.ai.emptyPromptError);
      return;
    }

    setError(null);
    setLoading(true);

    const updatedSettings = recordSearchQueryToStorage(clean);
    setSettings({ ...updatedSettings, language: settings.language });

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: clean,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    saveAiMessages(nextHistory);
    setPrompt('');

    const apiHistory = messages.slice(-6).map((m) => ({
      role: m.role,
      text:
        m.role === 'assistant' && m.response
          ? summarizeAssistantTurnForHistory(m.response)
          : m.text,
    }));

    try {
      const res = await apiFetch<AiAgentResponse>('/api/ai/recommend', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          prompt: clean,
          history: apiHistory,
          personalization: {
            ...updatedSettings,
            language: settings.language,
            favoritePropertyIds: updatedSettings.enabled ? Array.from(favoriteIds) : [],
          },
          selectedCompareIds: overrideCompareIds ?? compareIds,
          recentRecommendedIds,
        }),
      });

      const assistantMsg: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        createdAt: new Date().toISOString(),
        response: res,
      };

      const completedMessages = [...nextHistory, assistantMsg];
      setMessages(completedMessages);
      saveAiMessages(completedMessages);

      if (res.comparedProperties.length >= 2) {
        const nextCompare = saveCompareIds(res.comparedProperties.map((p) => p.id));
        setCompareIds(nextCompare);
        setCompareListings(res.comparedProperties);
        setLatestComparisonSummary(res.comparisonSummary);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(querySearch).get('q')?.trim() || '';
    if (q && autoSubmittedRef.current !== q) {
      autoSubmittedRef.current = q;
      setPrompt(q);
      void askAi(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [querySearch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void askAi(prompt);
  };

  const updateSettings = (patch: Partial<AiPersonalizationSettings>) => {
    const next = saveAiSettings({
      ...settings,
      ...patch,
    });
    setSettings(next);
  };

  const toggleCompareProperty = (property: PropertyListing) => {
    setCompareIds((prev) => {
      const exists = prev.includes(property.id);
      const next = exists ? prev.filter((id) => id !== property.id) : [...prev, property.id].slice(-4);
      return saveCompareIds(next);
    });
  };

  const applyPreferenceSuggestion = (msgId: string, suggestion: AiPreferenceSuggestion) => {
    updateSettings({
      enabled: true,
      ...(suggestion.preferredCity ? { preferredCity: suggestion.preferredCity } : {}),
      ...(suggestion.budgetUsd ? { budgetUsd: suggestion.budgetUsd } : {}),
      ...(suggestion.preferredPropertyType
        ? { preferredPropertyType: suggestion.preferredPropertyType }
        : {}),
      ...(suggestion.preferredRooms ? { preferredRooms: suggestion.preferredRooms } : {}),
    });
    setDismissedSuggestions((prev) => new Set(prev).add(msgId));
  };

  const handleClearHistory = () => {
    const resetSettings = clearAiHistoryAndMemory();
    setSettings(resetSettings);
    setMessages([]);
    setCompareIds([]);
    setCompareListings([]);
    setLatestComparisonSummary(null);
    setError(null);
  };

  const comparisonMetrics = useMemo(() => buildComparisonMetrics(compareListings), [compareListings]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5E4E0] pb-6 md:flex-row md:items-end dark:border-[#2C2C2C]">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#8C6D46] dark:text-[#D4B483]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{t.ai.eyebrow}</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
            {t.ai.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
            {t.ai.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={handleClearHistory}
          className="inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-[14px] border border-[#E5E4E0] bg-white px-4 text-xs font-medium text-[#525252] transition-colors hover:border-[#991B1B] hover:text-[#991B1B] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0] dark:hover:text-[#FCA5A5]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t.ai.clearHistory}</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-5 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
            <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.ai.sampleHeader}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.ai.samples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={loading}
                  onClick={() => void askAi(sample)}
                  className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 py-2 text-start text-xs text-[#171717] transition-colors hover:border-[#143A30] hover:bg-white disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:hover:border-[#D4B483] dark:hover:bg-[#262626]"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          {messages.length > 0 && (
            <div className="space-y-5" aria-live="polite">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-xl rounded-[18px] bg-[#143A30] px-5 py-3.5 text-sm leading-relaxed text-white">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const resp = msg.response;
                const filterTokens = resp ? formatAppliedFilterTokens(resp.appliedFilters) : [];
                const showSuggestion =
                  Boolean(resp?.preferenceSuggestion) && !dismissedSuggestions.has(msg.id);

                return (
                  <article
                    key={msg.id}
                    className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-xs font-medium text-[#143A30] dark:text-[#D4B483]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>ESTORA AI</span>
                      </div>

                      {resp && hasActiveAiFilters(resp.appliedFilters) && (
                        <button
                          type="button"
                          onClick={() => onNavigate(resp.catalogUrl)}
                          className="inline-flex items-center gap-1.5 rounded-[12px] border border-[#143A30] px-3 py-1.5 text-xs font-medium text-[#143A30] transition-colors hover:bg-[#143A30] hover:text-white dark:border-[#D4B483] dark:text-[#D4B483] dark:hover:bg-[#D4B483] dark:hover:text-[#141414]"
                        >
                          <span>{t.ai.openInCatalog}</span>
                          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#171717] dark:text-[#F5F5F5]">
                      {msg.text}
                    </div>

                    {filterTokens.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E4E0] pt-3 text-xs text-[#525252] dark:border-[#2C2C2C] dark:text-[#A0A0A0]">
                        <span className="font-medium">{t.ai.recognizedParams}</span>
                        <span>{filterTokens.join(' · ')}</span>
                        {resp && (
                          <span className="font-mono tabular-nums text-[#143A30] dark:text-[#D4B483]">
                            ({resp.totalCatalogMatches} {t.ai.inCatalogCount})
                          </span>
                        )}
                      </div>
                    )}

                    {showSuggestion && resp?.preferenceSuggestion && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 dark:border-[#2C2C2C] dark:bg-[#141414]">
                        <p className="text-xs text-[#171717] dark:text-[#F5F5F5]">
                          <span className="font-semibold">{t.ai.savePreferencePrefix}</span>{' '}
                          {resp.preferenceSuggestion.summary}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              applyPreferenceSuggestion(msg.id, resp.preferenceSuggestion!)
                            }
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-[10px] bg-[#143A30] px-3 text-xs font-medium text-white hover:bg-[#0F2C24]"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{t.ai.saveBtn}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDismissedSuggestions((prev) => new Set(prev).add(msg.id))
                            }
                            className="inline-flex min-h-[34px] items-center rounded-[10px] border border-[#E5E4E0] bg-white px-3 text-xs text-[#525252] hover:text-[#171717] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]"
                          >
                            {t.ai.skipBtn}
                          </button>
                        </div>
                      </div>
                    )}

                    {resp && resp.recommendations.length > 0 && (
                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {resp.recommendations.map((rec) => {
                          const prop = rec.property;
                          const inCompare = compareIds.includes(prop.id);
                          const has3d = prop.has3dTour && hasReal3dContent(prop);
                          return (
                            <div
                              key={prop.id}
                              className="flex flex-col justify-between overflow-hidden rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#141414]"
                            >
                              <div>
                                <div className="relative aspect-[4/3] w-full bg-[#ECEBE8] dark:bg-[#242424]">
                                  {prop.imageUrl ? (
                                    <img
                                      src={prop.imageUrl}
                                      alt={`${prop.title} — ${localizeCity(prop.city)}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <Building2 className="h-7 w-7 text-[#143A30]" />
                                    </div>
                                  )}
                                </div>

                                <div className="p-4">
                                  <div className="flex items-center justify-between gap-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
                                    <span>
                                      {t.common.dealTypes[prop.dealType as DealType] ?? prop.dealType}{' '}
                                      ·{' '}
                                      {t.common.propertyTypes[prop.propertyType as PropertyType] ??
                                        prop.propertyType}
                                    </span>
                                    {has3d && (
                                      <span className="font-medium text-[#8C6D46] dark:text-[#D4B483]">
                                        3D / 360°
                                      </span>
                                    )}
                                  </div>

                                  <h3 className="mt-1.5 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                    {prop.title}
                                  </h3>
                                  <p className="mt-0.5 text-xs text-[#525252] dark:text-[#A0A0A0]">
                                    {localizeCity(prop.city)}, {prop.district}
                                  </p>

                                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                                    <span className="font-mono text-base font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                                      {formatPrice(prop.priceUsd, currency, prop.dealType)}
                                    </span>
                                    <span className="text-xs text-[#525252] tabular-nums dark:text-[#A0A0A0]">
                                      {prop.areaSqm} {t.common.sqm} · {prop.bedrooms}{' '}
                                      {t.common.roomsShort}
                                    </span>
                                  </div>

                                  {(prop.contactPhone || prop.ownerPhone) && (
                                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[10px] border border-[#E5E4E0] bg-white px-2.5 py-1.5 text-xs dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                                      <span className="truncate text-[#525252] dark:text-[#A0A0A0]">
                                        {prop.dealType === 'rent' ? t.card.landlordRole : t.card.sellerRole}
                                      </span>
                                      <a
                                        href={`tel:${(prop.contactPhone || prop.ownerPhone || '').replace(/[^+\d]/g, '')}`}
                                        className="inline-flex shrink-0 items-center gap-1 font-mono font-semibold text-[#143A30] hover:underline dark:text-[#D4B483]"
                                      >
                                        <Phone className="h-3 w-3" aria-hidden="true" />
                                        <span>{prop.contactPhone || prop.ownerPhone}</span>
                                      </a>
                                    </div>
                                  )}

                                  <div className="mt-3 rounded-[12px] border border-[#E5E4E0] bg-white p-3 text-xs leading-relaxed text-[#525252] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]">
                                    <span className="font-semibold text-[#143A30] dark:text-[#D4B483]">
                                      {t.ai.whyMatches}{' '}
                                    </span>
                                    {rec.reason}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 border-t border-[#E5E4E0] p-3 dark:border-[#2C2C2C]">
                                <button
                                  type="button"
                                  onClick={() => onSelectProperty(prop)}
                                  className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] bg-[#143A30] px-2.5 text-xs font-medium text-white hover:bg-[#0F2C24]"
                                >
                                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{t.ai.detailsBtn}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleCompareProperty(prop)}
                                  className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] border px-2.5 text-xs font-medium transition-colors ${
                                    inCompare
                                      ? 'border-[#8C6D46] bg-[#8C6D46] text-white'
                                      : 'border-[#E5E4E0] bg-white text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]'
                                  }`}
                                >
                                  <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{inCompare ? t.ai.compareAdded : t.ai.compareAdd}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {resp && resp.clarifyingQuestions.length > 0 && (
                      <div className="mt-5 border-t border-[#E5E4E0] pt-4 dark:border-[#2C2C2C]">
                        <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                          {t.ai.clarifyHint}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {resp.clarifyingQuestions.map((cq) => (
                            <button
                              key={cq}
                              type="button"
                              disabled={loading}
                              onClick={() => void askAi(cq)}
                              className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 py-1.5 text-start text-xs font-medium text-[#143A30] transition-colors hover:border-[#143A30] hover:bg-white disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#D4B483] dark:hover:border-[#D4B483] dark:hover:bg-[#262626]"
                            >
                              {cq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {compareListings.length > 0 && (
            <section
              aria-label={t.ai.compareTitle}
              className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Columns3 className="h-5 w-5 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                  <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    {t.ai.compareTitle} ({compareListings.length}/4)
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {compareListings.length >= 2 && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void askAi(t.ai.samples[4], compareIds)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] bg-[#143A30] px-3.5 text-xs font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.ai.compareWithAi}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      saveCompareIds([]);
                      setCompareIds([]);
                      setCompareListings([]);
                      setLatestComparisonSummary(null);
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-[12px] border border-[#E5E4E0] px-3 text-xs text-[#525252] hover:text-[#171717] dark:border-[#343434] dark:text-[#A0A0A0]"
                  >
                    {t.ai.resetCompare}
                  </button>
                </div>
              </div>

              {compareListings.length === 1 && (
                <p className="mt-3 text-xs text-[#525252] dark:text-[#A0A0A0]">
                  {t.ai.compareNeedMore}
                </p>
              )}

              {compareListings.length >= 2 && comparisonMetrics && (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[540px] border-collapse text-start text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E4E0] dark:border-[#2C2C2C]">
                          <th className="py-3 pe-4 font-medium text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colParam}
                          </th>
                          {compareListings.map((p) => (
                            <th
                              key={p.id}
                              className="py-3 px-3 font-semibold text-[#171717] dark:text-[#F5F5F5]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => onSelectProperty(p)}
                                  className="text-start hover:underline"
                                >
                                  {p.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleCompareProperty(p)}
                                  aria-label={`${t.common.delete}: ${p.title}`}
                                  className="text-[#737373] hover:text-[#991B1B]"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E4E0] dark:divide-[#2C2C2C]">
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colPrice}
                          </td>
                          {compareListings.map((p) => (
                            <td
                              key={p.id}
                              className="py-2.5 px-3 font-mono tabular-nums text-[#171717] dark:text-[#F5F5F5]"
                            >
                              {formatPrice(p.priceUsd, currency, p.dealType)}
                              {comparisonMetrics.cheapestId === p.id && (
                                <span className="ms-1.5 text-[11px] font-sans font-medium text-[#143A30] dark:text-[#D4B483]">
                                  · {t.ai.tagMinPrice}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colPriceSqm}
                          </td>
                          {compareListings.map((p) => (
                            <td
                              key={p.id}
                              className="py-2.5 px-3 font-mono tabular-nums text-[#171717] dark:text-[#F5F5F5]"
                            >
                              ${(comparisonMetrics.pricePerSqmById[p.id] ?? 0).toLocaleString('en-US')}/
                              {t.common.sqm}
                              {comparisonMetrics.bestValueId === p.id && (
                                <span className="ms-1.5 text-[11px] font-sans font-medium text-[#143A30] dark:text-[#D4B483]">
                                  · {t.ai.tagBestSqm}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colLocation}
                          </td>
                          {compareListings.map((p) => (
                            <td key={p.id} className="py-2.5 px-3 text-[#171717] dark:text-[#F5F5F5]">
                              {localizeCity(p.city)}, {p.district}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colAreaRooms}
                          </td>
                          {compareListings.map((p) => (
                            <td
                              key={p.id}
                              className="py-2.5 px-3 tabular-nums text-[#171717] dark:text-[#F5F5F5]"
                            >
                              {p.areaSqm} {t.common.sqm} · {p.bedrooms} {t.common.roomsShort}
                              {comparisonMetrics.largestId === p.id && (
                                <span className="ms-1.5 font-medium text-[#8C6D46] dark:text-[#D4B483]">
                                  · {t.ai.tagMaxSqm}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colFloorRenovation}
                          </td>
                          {compareListings.map((p) => (
                            <td key={p.id} className="py-2.5 px-3 text-[#171717] dark:text-[#F5F5F5]">
                              {p.floor}/{p.totalFloors} {t.common.floorShort} ·{' '}
                              {t.common.renovations[(p.renovation as RenovationType) || 'designer'] ??
                                t.common.renovations.designer}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 pe-4 text-[#525252] dark:text-[#A0A0A0]">
                            {t.ai.colAmenities3d}
                          </td>
                          {compareListings.map((p) => (
                            <td key={p.id} className="py-2.5 px-3 text-[#171717] dark:text-[#F5F5F5]">
                              {p.furnished ? t.ai.withFurniture : t.ai.withoutFurniture} ·{' '}
                              {p.parking ? t.ai.withParking : t.ai.withoutParking} ·{' '}
                              {p.has3dTour ? t.ai.tour3dYes : t.ai.tour3dPhotoOnly}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {latestComparisonSummary && (
                    <div className="mt-4 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 text-xs leading-relaxed text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]">
                      <p className="font-semibold text-[#143A30] dark:text-[#D4B483]">
                        {t.ai.aiVerdictTitle}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{latestComparisonSummary}</p>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
          >
            <label
              htmlFor="estora-ai-prompt"
              className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
            >
              {t.ai.promptLabel}
            </label>
            <textarea
              id="estora-ai-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.ai.promptPlaceholder}
              className="mt-2 w-full rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 text-sm text-[#171717] placeholder:text-[#737373] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:placeholder:text-[#A0A0A0]"
            />

            {error && (
              <div className="mt-4 rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B]">
                {error}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#525252] dark:text-[#A0A0A0]">
                {settings.enabled ? t.ai.personalizationActiveHint : t.ai.personalizationOffHint}
              </span>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-[#143A30] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0F2C24] disabled:opacity-60"
              >
                <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                <span>{loading ? t.ai.analyzing : t.ai.submit}</span>
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]"
                  aria-hidden="true"
                />
                <h2 className="font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.ai.personalizationTitle}
                </h2>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                aria-label={t.ai.personalizationTitle}
                onClick={() => updateSettings({ enabled: !settings.enabled })}
                className={`inline-flex min-h-[34px] items-center rounded-[12px] px-3 text-xs font-semibold transition-colors ${
                  settings.enabled
                    ? 'bg-[#143A30] text-white'
                    : 'border border-[#E5E4E0] bg-[#F8F8F7] text-[#525252] dark:border-[#343434] dark:bg-[#141414] dark:text-[#A0A0A0]'
                }`}
              >
                {settings.enabled ? t.ai.onLabel : t.ai.offLabel}
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
              {t.ai.personalizationDesc}
            </p>

            {/* AI Response Language (10 Languages) */}
            <div className="mt-5">
              <label
                htmlFor="ai-response-lang"
                className="flex items-center gap-1.5 text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.ai.responseLang}</span>
              </label>
              <select
                id="ai-response-lang"
                value={settings.language}
                onChange={(e) =>
                  updateSettings({ language: e.target.value as AiPersonalizationSettings['language'] })
                }
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                {LANGUAGE_LIST.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.nativeName} ({opt.shortCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 space-y-3.5">
              <div>
                <label
                  htmlFor="ai-pref-city"
                  className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                >
                  {t.ai.prefCity}
                </label>
                <select
                  id="ai-pref-city"
                  disabled={!settings.enabled}
                  value={settings.preferredCity || ''}
                  onChange={(e) => updateSettings({ preferredCity: e.target.value })}
                  className="mt-1 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-xs text-[#171717] disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                >
                  <option value="">{t.ai.notSet}</option>
                  {UZBEKISTAN_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {localizeCity(city)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ai-pref-budget"
                  className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                >
                  {t.ai.prefBudget}
                </label>
                <input
                  id="ai-pref-budget"
                  type="number"
                  min={0}
                  disabled={!settings.enabled}
                  value={settings.budgetUsd ?? ''}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    updateSettings({
                      budgetUsd: Number.isFinite(num) && num > 0 ? Math.round(num) : undefined,
                    });
                  }}
                  placeholder="250000"
                  className="mt-1 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 font-mono text-xs tabular-nums text-[#171717] disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="ai-pref-type"
                    className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                  >
                    {t.ai.prefType}
                  </label>
                  <select
                    id="ai-pref-type"
                    disabled={!settings.enabled}
                    value={settings.preferredPropertyType || ''}
                    onChange={(e) => updateSettings({ preferredPropertyType: e.target.value })}
                    className="mt-1 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-2.5 text-xs text-[#171717] disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                  >
                    <option value="">{t.ai.anyType}</option>
                    {Object.entries(t.common.propertyTypes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-pref-rooms"
                    className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                  >
                    {t.ai.prefRooms}
                  </label>
                  <select
                    id="ai-pref-rooms"
                    disabled={!settings.enabled}
                    value={settings.preferredRooms || ''}
                    onChange={(e) => updateSettings({ preferredRooms: e.target.value })}
                    className="mt-1 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-2.5 text-xs text-[#171717] disabled:opacity-50 dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                  >
                    <option value="">{t.ai.anyRooms}</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5+">5+</option>
                  </select>
                </div>
              </div>
            </div>

            {settings.enabled && (
              <div className="mt-5 border-t border-[#E5E4E0] pt-4 text-xs dark:border-[#2C2C2C]">
                <p className="font-medium text-[#525252] dark:text-[#A0A0A0]">
                  {t.ai.contextHeader}
                </p>
                <p className="mt-1 text-[#171717] dark:text-[#F5F5F5]">
                  {t.ai.favoritesCountLabel} <span className="font-mono">{favoriteIds.size}</span>
                </p>
                {settings.recentSearches.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[#525252] dark:text-[#A0A0A0]">
                      {t.ai.recentSearchesLabel}
                    </span>
                    <ul className="mt-1 space-y-1 text-[#171717] dark:text-[#A0A0A0]">
                      {settings.recentSearches.slice(0, 4).map((q) => (
                        <li key={q} className="truncate">
                          · {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex items-start gap-2 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-[11px] leading-relaxed text-[#525252] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#A0A0A0]">
              <Shield
                className="mt-0.5 h-4 w-4 shrink-0 text-[#143A30] dark:text-[#D4B483]"
                aria-hidden="true"
              />
              <span>{t.ai.privacyNotice}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
