import { useState, type FormEvent } from 'react';
import { ArrowRight, MessageSquareText, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type { AiAgentResponse, PropertyListing } from '../types/estora';
import { loadAiSettings, recordSearchQueryToStorage } from '../utils/aiAgent';

interface CompactAiButtonProps {
  onNavigate: (path: string) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

export function CompactAiButton({ onNavigate, onSelectProperty }: CompactAiButtonProps) {
  const { idToken, currency, favoriteIds } = useAuth();
  const { language, t, formatPrice } = useI18n();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAgentResponse | null>(null);

  const runQuickQuery = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    const settings = recordSearchQueryToStorage(clean);
    try {
      const res = await apiFetch<AiAgentResponse>('/api/ai/recommend', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          prompt: clean,
          personalization: {
            ...settings,
            language,
            favoritePropertyIds: Array.from(favoriteIds),
          },
        }),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runQuickQuery(prompt);
  };

  const openFullWorkspace = () => {
    loadAiSettings();
    const qParam = prompt.trim() ? `?q=${encodeURIComponent(prompt.trim())}` : '';
    setOpen(false);
    onNavigate(`/ai${qParam}`);
  };

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="ESTORA AI"
          className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-[20px] border border-[#E5E4E0] bg-white shadow-2xl transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
        >
          <div className="flex items-center justify-between border-b border-[#E5E4E0] bg-[#143A30] px-4 py-3 text-white dark:border-[#2C2C2C]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4B483]" aria-hidden="true" />
              <span className="text-sm font-semibold">ESTORA AI</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.ai.compactAriaClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
            {!result && !error && (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {t.ai.compactIntro}
                </p>
                <div className="flex flex-col gap-1.5">
                  {t.ai.compactChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setPrompt(chip);
                        void runQuickQuery(chip);
                      }}
                      className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 py-2 text-start text-xs text-[#171717] transition-colors hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-[#171717] dark:text-[#F5F5F5]">
                  {result.reply}
                </p>

                {result.recommendations.length > 0 && (
                  <div className="space-y-2">
                    {result.recommendations.slice(0, 2).map((item) => (
                      <button
                        key={item.propertyId}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onSelectProperty(item.property);
                        }}
                        className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-2.5 text-start transition-colors hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414]"
                      >
                        <img
                          src={item.property.imageUrl}
                          alt={item.property.title}
                          className="h-12 w-14 shrink-0 rounded-[10px] object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                            {item.property.title}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-[#143A30] tabular-nums dark:text-[#D4B483]">
                            {formatPrice(item.property.priceUsd, currency, item.property.dealType)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {result.catalogUrl && result.catalogUrl !== '/catalog' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onNavigate(result.catalogUrl);
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#143A30] px-3 py-2 text-xs font-medium text-[#143A30] hover:bg-[#143A30] hover:text-white dark:border-[#D4B483] dark:text-[#D4B483]"
                  >
                    <span>{t.ai.compactOpenFilters}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-[#E5E4E0] bg-[#F8F8F7] p-3 dark:border-[#2C2C2C] dark:bg-[#141414]"
          >
            <div className="flex items-center gap-2">
              <label htmlFor="compact-ai-input" className="sr-only">
                {t.ai.promptLabel}
              </label>
              <input
                id="compact-ai-input"
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.ai.compactPlaceholder}
                className="min-h-[40px] flex-1 rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-xs text-[#171717] placeholder:text-[#737373] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5] dark:placeholder:text-[#A0A0A0]"
              />
              <button
                type="submit"
                disabled={loading}
                aria-label={t.ai.compactSendAria}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#143A30] text-white transition-colors hover:bg-[#0F2C24] disabled:opacity-60"
              >
                <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={openFullWorkspace}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-[#143A30] hover:underline underline-offset-4 dark:text-[#D4B483]"
            >
              <span>{t.ai.compactOpenFull}</span>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={t.ai.compactAriaOpen}
        className="inline-flex min-h-[46px] items-center gap-2 rounded-[16px] border border-[#143A30]/20 bg-[#143A30] px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#0F2C24] focus-visible:outline-2 focus-visible:outline-[#143A30]"
      >
        <MessageSquareText className="h-4 w-4 text-[#D4B483]" aria-hidden="true" />
        <span>ESTORA AI</span>
      </button>
    </div>
  );
}
