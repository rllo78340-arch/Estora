import { useEffect, useState } from 'react';
import { ArrowRight, Compass, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import { CompactAiButton } from '../components/CompactAiButton';
import { PropertyCard } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type { CityStat, PropertyFilters, PropertyListing } from '../types/estora';
import { recordSearchQueryToStorage } from '../utils/aiAgent';
import { buildPropertyQueryString } from '../utils/formatters';

const HERO_IMAGE = '/src/assets/images/hero_tashkent_residence_1794853627912.jpg';

interface HomePageProps {
  onNavigate: (path: string) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

const CITY_SHOWCASE_ORDER = ['Ташкент', 'Самарканд', 'Бухара', 'Фергана'] as const;

export function HomePage({ onNavigate, onSelectProperty }: HomePageProps) {
  const { currency } = useAuth();
  const { t, formatPrice, localizeCity } = useI18n();
  const [featured, setFeatured] = useState<PropertyListing[]>([]);
  const [latest, setLatest] = useState<PropertyListing[]>([]);
  const [tours3d, setTours3d] = useState<PropertyListing[]>([]);
  const [cityStats, setCityStats] = useState<CityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiQuickPrompt, setAiQuickPrompt] = useState('');

  const citySubtitles: Record<string, string> = {
    Ташкент: t.home.citySubtitles.tashkent,
    Самарканд: t.home.citySubtitles.samarkand,
    Бухара: t.home.citySubtitles.bukhara,
    Фергана: t.home.citySubtitles.fergana,
  };

  useEffect(() => {
    let active = true;
    const loadHomeData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [featRes, latestRes, tourRes, citiesRes] = await Promise.all([
          apiFetch<{ properties: PropertyListing[] }>('/api/properties?featured=true&limit=3'),
          apiFetch<{ properties: PropertyListing[] }>('/api/properties?limit=3'),
          apiFetch<{ properties: PropertyListing[] }>('/api/properties?has3dTour=true&limit=3'),
          apiFetch<{ cities: CityStat[] }>('/api/cities'),
        ]);
        if (!active) return;
        setFeatured(featRes.properties);
        setLatest(latestRes.properties);
        setTours3d(tourRes.properties);
        setCityStats(citiesRes.cities);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t.common.loadingError);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadHomeData();
    return () => {
      active = false;
    };
  }, [t.common.loadingError]);

  const handleSearch = (filters: PropertyFilters) => {
    if (filters.q) {
      recordSearchQueryToStorage(filters.q);
    } else if (filters.city && filters.city !== 'all') {
      recordSearchQueryToStorage(`${filters.city} ${filters.propertyType || ''}`.trim());
    }
    const qs = buildPropertyQueryString(filters);
    onNavigate(`/catalog${qs}`);
  };

  return (
    <div>
      {/* 1. Hero + Search */}
      <section className="border-b border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-between lg:col-span-6">
              <div>
                <p className="text-sm font-medium text-[#8C6D46] dark:text-[#D4B483]">
                  {t.home.eyebrow}
                </p>
                <h1
                  className="mt-4 font-display font-semibold tracking-tight text-[#171717] [text-wrap:balance] dark:text-[#F5F5F5]"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', lineHeight: 1.1 }}
                >
                  {t.home.heroTitle}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {t.home.heroSubtitle}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/catalog')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] bg-[#143A30] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#0F2C24]"
                >
                  <span>{t.home.openCatalog}</span>
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/3d')}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-5 py-3 text-sm font-medium text-[#171717] transition-colors hover:bg-[#ECEBE8] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:hover:bg-[#262626]"
                >
                  <Compass className="h-4 w-4 text-[#8C6D46] dark:text-[#D4B483]" aria-hidden="true" />
                  <span>{t.home.tours3dCta}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[20px] border border-[#E5E4E0] bg-[#ECEBE8] lg:h-full lg:min-h-[380px] dark:border-[#2C2C2C] dark:bg-[#242424]">
                <img
                  src={HERO_IMAGE}
                  alt={t.home.heroImgAlt}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-10">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-6 pt-8">
          <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            {error}
          </div>
        </div>
      )}

      {/* 2. Featured Listings */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]">
              {t.home.featuredTitle}
            </h2>
            <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
              {t.home.featuredSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/catalog')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#143A30] hover:underline underline-offset-4 shrink-0 dark:text-[#D4B483]"
          >
            <span>{t.home.viewAllCatalog}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-96 animate-pulse rounded-[18px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((item) => (
              <PropertyCard key={item.id} property={item} onSelect={onSelectProperty} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Latest Listings */}
      <section className="border-t border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]">
                {t.home.latestTitle}
              </h2>
              <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
                {t.home.latestSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/sale')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#143A30] hover:underline underline-offset-4 shrink-0 dark:text-[#D4B483]"
            >
              <span>{t.home.goToSale}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {latest.map((item) => (
              <PropertyCard key={`new-${item.id}`} property={item} onSelect={onSelectProperty} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. 3D Tours Showcase */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]">
              {t.home.toursTitle}
            </h2>
            <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
              {t.home.toursSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/3d')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#143A30] hover:underline underline-offset-4 shrink-0 dark:text-[#D4B483]"
          >
            <span>{t.home.all3dObjects}</span>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tours3d.map((item) => (
            <PropertyCard key={`3d-${item.id}`} property={item} onSelect={onSelectProperty} />
          ))}
        </div>
      </section>

      {/* 5. Top Uzbekistan Cities */}
      <section className="border-t border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]">
              {t.home.citiesTitle}
            </h2>
            <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
              {t.home.citiesSubtitle}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CITY_SHOWCASE_ORDER.map((cityName) => {
              const stat = cityStats.find((c) => c.city === cityName);
              return (
                <button
                  key={cityName}
                  type="button"
                  onClick={() => onNavigate(`/catalog?city=${encodeURIComponent(cityName)}`)}
                  className="flex flex-col justify-between rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-6 text-start transition-all duration-150 hover:-translate-y-0.5 hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414] dark:hover:border-[#D4B483]"
                >
                  <div>
                    <p className="font-mono text-xs text-[#8C6D46] tabular-nums dark:text-[#D4B483]">
                      {stat ? `${stat.count} ${t.common.objectsCountShort}` : t.common.updating}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {localizeCity(cityName)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                      {citySubtitles[cityName]}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-[#E5E4E0] pt-4 text-xs text-[#143A30] dark:border-[#2C2C2C] dark:text-[#D4B483]">
                    <span>
                      {stat
                        ? `${t.common.fromPrice} ${formatPrice(stat.minPriceUsd, currency, 'sale')}`
                        : t.home.openCityCatalog}
                    </span>
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Why ESTORA + 7. ESTORA AI Concierge */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-8 lg:col-span-7 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#171717] dark:text-[#F5F5F5]">
              {t.home.whyTitle}
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <ShieldCheck className="h-6 w-6 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.home.pillars.verifiedTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {t.home.pillars.verifiedDesc}
                </p>
              </div>
              <div>
                <Compass className="h-6 w-6 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.home.pillars.tourTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {t.home.pillars.tourDesc}
                </p>
              </div>
              <div>
                <Building2 className="h-6 w-6 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.home.pillars.focusTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {t.home.pillars.focusDesc}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[20px] bg-[#143A30] p-8 text-white lg:col-span-5">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#D4B483]">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>{t.home.aiCardEyebrow}</span>
              </div>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                {t.home.aiCardTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                {t.home.aiCardDesc}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const qParam = aiQuickPrompt.trim()
                  ? `?q=${encodeURIComponent(aiQuickPrompt.trim())}`
                  : '';
                onNavigate(`/ai${qParam}`);
              }}
              className="mt-6 space-y-3"
            >
              <label htmlFor="home-ai-input" className="sr-only">
                {t.home.aiInputLabel}
              </label>
              <input
                id="home-ai-input"
                type="text"
                value={aiQuickPrompt}
                onChange={(e) => setAiQuickPrompt(e.target.value)}
                placeholder={t.home.aiInputPlaceholder}
                className="min-h-[44px] w-full rounded-[14px] border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-white"
              />
              <button
                type="submit"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-white px-5 py-2.5 text-sm font-medium text-[#143A30] transition-colors hover:bg-[#F3F3F1]"
              >
                <span>{t.home.aiAskButton}</span>
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <CompactAiButton onNavigate={onNavigate} onSelectProperty={onSelectProperty} />
    </div>
  );
}
