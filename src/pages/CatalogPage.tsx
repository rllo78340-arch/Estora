import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { PropertyCard } from '../components/PropertyCard';
import { SearchBar } from '../components/SearchBar';
import { Tour3DViewer } from '../components/Tour3DViewer';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type {
  PaginatedPropertiesResponse,
  PropertyFilters,
  PropertyListing,
} from '../types/estora';
import { recordSearchQueryToStorage } from '../utils/aiAgent';
import { buildPropertyQueryString } from '../utils/formatters';
import { parseGalleryImages } from '../utils/listingWizard';
import { hasReal3dContent } from '../utils/tour3d';

interface CatalogPageProps {
  mode: 'catalog' | 'sale' | 'rent' | '3d';
  querySearch: string;
  onSelectProperty: (property: PropertyListing) => void;
}

const PAGE_SIZE = 6;

function buildInitialFilters(mode: CatalogPageProps['mode'], querySearch: string): PropertyFilters {
  const params = new URLSearchParams(querySearch);
  return {
    dealType: mode === 'sale' ? 'sale' : mode === 'rent' ? 'rent' : params.get('dealType') || 'all',
    propertyType: params.get('propertyType') || 'all',
    city: params.get('city') || 'all',
    district: params.get('district') || '',
    rooms: params.get('rooms') || 'all',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    minArea: params.get('minArea') || '',
    maxArea: params.get('maxArea') || '',
    minFloor: params.get('minFloor') || '',
    maxFloor: params.get('maxFloor') || '',
    renovation: params.get('renovation') || 'all',
    furnished: params.get('furnished') || 'all',
    parking: params.get('parking') || 'all',
    has3dTour: mode === '3d' || params.get('has3dTour') === 'true',
    publishedWithin: params.get('publishedWithin') || 'all',
    q: params.get('q') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    pageSize: PAGE_SIZE,
  };
}

export function CatalogPage({ mode, querySearch, onSelectProperty }: CatalogPageProps) {
  const { idToken, signInWithGoogle } = useAuth();
  const { t, localizeCity } = useI18n();
  const [filters, setFilters] = useState<PropertyFilters>(() =>
    buildInitialFilters(mode, querySearch)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [notifyOnMatch, setNotifyOnMatch] = useState(true);
  const [savingFilter, setSavingFilter] = useState(false);
  const [saveFilterMsg, setSaveFilterMsg] = useState<string | null>(null);
  const [saveFilterErr, setSaveFilterErr] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyListing[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);
  const [selected3dId, setSelected3dId] = useState<number | null>(null);
  const pendingSearchLogRef = useRef<{ queryText: string; filters: PropertyFilters } | null>(null);

  useEffect(() => {
    setFilters(buildInitialFilters(mode, querySearch));
  }, [mode, querySearch]);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildPropertyQueryString({ ...filters, pageSize: PAGE_SIZE });
        const res = await apiFetch<PaginatedPropertiesResponse>(`/api/properties${qs}`);
        if (!active) return;
        setProperties(res.properties);
        setTotal(res.total);
        setTotalPages(res.totalPages);

        if (pendingSearchLogRef.current && idToken) {
          const snapshot = pendingSearchLogRef.current;
          pendingSearchLogRef.current = null;
          void apiFetch('/api/search-history', {
            method: 'POST',
            token: idToken,
            body: JSON.stringify({
              queryText: snapshot.queryText,
              filters: snapshot.filters,
              resultsCount: res.total,
            }),
          }).catch(() => {});
        } else {
          pendingSearchLogRef.current = null;
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : t.common.loadingError);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, [filters, retryCounter, t.common.loadingError, idToken]);

  const updateFilter = (patch: Partial<PropertyFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
      page: patch.page ?? 1,
    }));
  };

  const openSaveFilterPanel = () => {
    setSaveFilterErr(null);
    setSaveFilterMsg(null);
    const cityPart = filters.city && filters.city !== 'all' ? localizeCity(filters.city) : t.common.uzbekistan;
    const roomsPart = filters.rooms && filters.rooms !== 'all' ? ` · ${filters.rooms}` : '';
    const maxPricePart = filters.maxPrice ? ` · $${filters.maxPrice}` : '';
    if (!filterName.trim()) {
      setFilterName(`${cityPart}${roomsPart}${maxPricePart}`);
    }
    setShowSaveFilter((prev) => !prev);
  };

  const handleSaveFilter = async (e: FormEvent) => {
    e.preventDefault();
    setSaveFilterErr(null);
    setSaveFilterMsg(null);
    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    if (!filterName.trim()) {
      setSaveFilterErr(t.cabinet.filterNamePlaceholder);
      return;
    }
    setSavingFilter(true);
    try {
      await apiFetch('/api/saved-filters', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          name: filterName.trim(),
          filters,
          notifyOnMatch,
        }),
      });
      setSaveFilterMsg(t.cabinet.filterSavedNotice);
      setShowSaveFilter(false);
    } catch (err: unknown) {
      setSaveFilterErr(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSavingFilter(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      dealType: mode === 'sale' ? 'sale' : mode === 'rent' ? 'rent' : 'all',
      propertyType: 'all',
      city: 'all',
      district: '',
      rooms: 'all',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: '',
      minFloor: '',
      maxFloor: '',
      renovation: 'all',
      furnished: 'all',
      parking: 'all',
      has3dTour: mode === '3d',
      publishedWithin: 'all',
      q: '',
      sort: 'newest',
      page: 1,
      pageSize: PAGE_SIZE,
    });
  };

  const modeMeta = {
    catalog: {
      title: t.catalog.modes.catalogTitle,
      subtitle: t.catalog.modes.catalogSubtitle,
    },
    sale: {
      title: t.catalog.modes.saleTitle,
      subtitle: t.catalog.modes.saleSubtitle,
    },
    rent: {
      title: t.catalog.modes.rentTitle,
      subtitle: t.catalog.modes.rentSubtitle,
    },
    '3d': {
      title: t.catalog.modes.tours3dTitle,
      subtitle: t.catalog.modes.tours3dSubtitle,
    },
  }[mode];

  const real3dItems = properties.filter((p) => hasReal3dContent(p));
  const featured3d =
    mode === '3d'
      ? real3dItems.find((p) => p.id === selected3dId) ?? real3dItems[0] ?? null
      : null;
  const currentPage = filters.page ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#8C6D46] dark:text-[#D4B483]">
            {t.common.uzbekistanOnlyBadge}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
            {modeMeta.title}
          </h1>
          <p className="mt-2 text-base text-[#525252] dark:text-[#A0A0A0]">{modeMeta.subtitle}</p>
        </div>

        {mode === 'catalog' && (
          <div
            role="group"
            aria-label={t.search.section}
            className="inline-flex items-center gap-1 rounded-[14px] border border-[#E5E4E0] bg-white p-1 shrink-0 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
          >
            {[
              { id: 'all', label: t.common.all },
              { id: 'sale', label: t.common.dealTypes.sale },
              { id: 'rent', label: t.common.dealTypes.rent },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateFilter({ dealType: tab.id })}
                className={`min-h-[38px] rounded-[10px] px-4 text-xs font-medium transition-colors ${
                  (filters.dealType ?? 'all') === tab.id
                    ? 'bg-[#143A30] text-white'
                    : 'text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {featured3d && (
        <div className="mt-8 space-y-3">
          {real3dItems.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.catalog.choose3dTour}
              </span>
              {real3dItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected3dId(item.id)}
                  className={`min-h-[36px] rounded-[12px] border px-3 text-xs font-medium transition-colors ${
                    item.id === featured3d.id
                      ? 'border-[#143A30] bg-[#143A30] text-white'
                      : 'border-[#E5E4E0] bg-white text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
          <Tour3DViewer
            title={featured3d.title}
            label={featured3d.tour3dLabel}
            propertyId={featured3d.id}
            propertyType={featured3d.propertyType}
            totalFloors={featured3d.totalFloors}
            description={featured3d.description}
            amenities={featured3d.amenities}
            galleryImages={parseGalleryImages(featured3d.galleryImages, featured3d.imageUrl)}
            imageUrl={featured3d.imageUrl}
            model3dUrl={featured3d.model3dUrl}
            panoramaUrl={featured3d.panoramaUrl}
            virtualTourUrl={featured3d.virtualTourUrl}
            tourConfig={featured3d.tourConfig}
            tourRooms={featured3d.tourRooms}
            tourHotspots={featured3d.tourHotspots}
          />
        </div>
      )}

      {/* Quick category chips */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updateFilter({ propertyType: 'all' })}
          className={`min-h-[38px] rounded-[14px] border px-3.5 text-xs font-medium transition-colors ${
            (filters.propertyType ?? 'all') === 'all'
              ? 'border-[#143A30] bg-[#143A30] text-white'
              : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] hover:text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
          }`}
        >
          {t.search.allCategories}
        </button>
        {Object.entries(t.common.propertyTypes).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => updateFilter({ propertyType: key })}
            className={`min-h-[38px] rounded-[14px] border px-3.5 text-xs font-medium transition-colors ${
              filters.propertyType === key
                ? 'border-[#143A30] bg-[#143A30] text-white'
                : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] hover:text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <SearchBar
          initialFilters={filters}
          onSearch={(next) => {
            if (next.q && next.q.trim()) {
              recordSearchQueryToStorage(next.q.trim());
            }
            const nextFilters: PropertyFilters = {
              ...filters,
              ...next,
              dealType: mode === 'sale' ? 'sale' : mode === 'rent' ? 'rent' : next.dealType,
              has3dTour: mode === '3d' ? true : filters.has3dTour,
              page: 1,
            };
            pendingSearchLogRef.current = {
              queryText: next.q?.trim() || (next.city && next.city !== 'all' ? next.city : ''),
              filters: nextFilters,
            };
            updateFilter(nextFilters);
          }}
          submitLabel={t.search.apply}
        />
      </div>

      {/* Advanced Filters & Save Filter */}
      <div className="mt-4 rounded-[20px] border border-[#E5E4E0] bg-white p-5 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="inline-flex items-start gap-2 text-start text-sm font-medium text-[#171717] sm:items-center dark:text-[#F5F5F5]"
          >
            <SlidersHorizontal
              className="mt-0.5 h-4 w-4 shrink-0 text-[#143A30] sm:mt-0 dark:text-[#D4B483]"
              aria-hidden="true"
            />
            <span>{showAdvanced ? t.catalog.hideAdvanced : t.catalog.showAdvanced}</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="save-filter-toggle"
              onClick={openSaveFilterPanel}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-xs font-medium text-[#143A30] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#D4B483]"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.cabinet.saveFilterBtn}</span>
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.catalog.resetFilters}</span>
            </button>
          </div>
        </div>

        {saveFilterMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-[#143A30]/30 bg-[#F3F7F5] px-3.5 py-2 text-xs font-medium text-[#143A30] dark:border-[#D4B483]/40 dark:bg-[#1E2B26] dark:text-[#D4B483]">
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{saveFilterMsg}</span>
          </div>
        )}

        {showSaveFilter && (
          <form
            onSubmit={(e) => void handleSaveFilter(e)}
            className="mt-4 space-y-3 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 dark:border-[#343434] dark:bg-[#141414]"
          >
            <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
              {t.cabinet.saveFilterTitle}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <label htmlFor="save-filter-name" className="sr-only">
                  {t.cabinet.filterNameLabel}
                </label>
                <input
                  id="save-filter-name"
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder={t.cabinet.filterNamePlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
                <input
                  type="checkbox"
                  checked={notifyOnMatch}
                  onChange={(e) => setNotifyOnMatch(e.target.checked)}
                  className="h-4 w-4 accent-[#143A30]"
                />
                <span>{t.cabinet.notifyMatchesLabel}</span>
              </label>
              <button
                type="submit"
                disabled={savingFilter}
                className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#143A30] px-4 text-xs font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
              >
                {idToken ? t.common.save : t.nav.signInGoogle}
              </button>
            </div>
            {saveFilterErr && (
              <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5]">{saveFilterErr}</p>
            )}
          </form>
        )}

        {showAdvanced && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#E5E4E0] pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-[#2C2C2C]">
            <div>
              <label
                htmlFor="filter-district"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.district}
              </label>
              <input
                id="filter-district"
                type="text"
                value={filters.district || ''}
                onChange={(e) => updateFilter({ district: e.target.value })}
                placeholder={t.catalog.districtPlaceholder}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label
                htmlFor="filter-rooms"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.roomsCount}
              </label>
              <select
                id="filter-rooms"
                value={filters.rooms || 'all'}
                onChange={(e) => updateFilter({ rooms: e.target.value })}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                <option value="all">{t.catalog.anyValue}</option>
                <option value="1">{t.catalog.room1}</option>
                <option value="2">{t.catalog.room2}</option>
                <option value="3">{t.catalog.room3}</option>
                <option value="4">{t.catalog.room4}</option>
                <option value="5+">{t.catalog.room5Plus}</option>
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.catalog.priceUsd}
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  aria-label={`${t.catalog.priceUsd} (${t.catalog.fromPlaceholder})`}
                  type="number"
                  min={0}
                  value={filters.minPrice || ''}
                  onChange={(e) => updateFilter({ minPrice: e.target.value })}
                  placeholder={t.catalog.fromPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
                <input
                  aria-label={`${t.catalog.priceUsd} (${t.catalog.toPlaceholder})`}
                  type="number"
                  min={0}
                  value={filters.maxPrice || ''}
                  onChange={(e) => updateFilter({ maxPrice: e.target.value })}
                  placeholder={t.catalog.toPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.catalog.areaSqm}
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  aria-label={`${t.catalog.areaSqm} (${t.catalog.fromPlaceholder})`}
                  type="number"
                  min={0}
                  value={filters.minArea || ''}
                  onChange={(e) => updateFilter({ minArea: e.target.value })}
                  placeholder={t.catalog.fromPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
                <input
                  aria-label={`${t.catalog.areaSqm} (${t.catalog.toPlaceholder})`}
                  type="number"
                  min={0}
                  value={filters.maxArea || ''}
                  onChange={(e) => updateFilter({ maxArea: e.target.value })}
                  placeholder={t.catalog.toPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.catalog.floorLabel}
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  aria-label={`${t.catalog.floorLabel} (${t.catalog.fromPlaceholder})`}
                  type="number"
                  min={1}
                  value={filters.minFloor || ''}
                  onChange={(e) => updateFilter({ minFloor: e.target.value })}
                  placeholder={t.catalog.fromPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
                <input
                  aria-label={`${t.catalog.floorLabel} (${t.catalog.toPlaceholder})`}
                  type="number"
                  min={1}
                  value={filters.maxFloor || ''}
                  onChange={(e) => updateFilter({ maxFloor: e.target.value })}
                  placeholder={t.catalog.toPlaceholder}
                  className="min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm tabular-nums text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="filter-renovation"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.renovationLabel}
              </label>
              <select
                id="filter-renovation"
                value={filters.renovation || 'all'}
                onChange={(e) => updateFilter({ renovation: e.target.value })}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                <option value="all">{t.catalog.anyValue}</option>
                {Object.entries(t.common.renovations).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-furnished"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.furnitureLabel}
              </label>
              <select
                id="filter-furnished"
                value={filters.furnished || 'all'}
                onChange={(e) => updateFilter({ furnished: e.target.value })}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                <option value="all">{t.catalog.noPreference}</option>
                <option value="true">{t.common.furnishedYes}</option>
                <option value="false">{t.common.furnishedNo}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-parking"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.parkingLabel}
              </label>
              <select
                id="filter-parking"
                value={filters.parking || 'all'}
                onChange={(e) => updateFilter({ parking: e.target.value })}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                <option value="all">{t.catalog.noPreference}</option>
                <option value="true">{t.common.parkingYes}</option>
                <option value="false">{t.common.parkingNo}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-published"
                className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
              >
                {t.catalog.publishedDate}
              </label>
              <select
                id="filter-published"
                value={filters.publishedWithin || 'all'}
                onChange={(e) => updateFilter({ publishedWithin: e.target.value })}
                className="mt-1.5 min-h-[40px] w-full rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                <option value="all">{t.catalog.periodAll}</option>
                <option value="24h">{t.catalog.period24h}</option>
                <option value="7d">{t.catalog.period7d}</option>
                <option value="30d">{t.catalog.period30d}</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex min-h-[40px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]">
                <input
                  type="checkbox"
                  disabled={mode === '3d'}
                  checked={Boolean(filters.has3dTour)}
                  onChange={(e) => updateFilter({ has3dTour: e.target.checked })}
                  className="h-4 w-4 accent-[#143A30]"
                />
                <span>{t.catalog.only3dTour}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Results Header & Sorting */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E4E0] pb-5 dark:border-[#2C2C2C]">
        <p className="text-sm font-medium tabular-nums text-[#525252] dark:text-[#A0A0A0]">
          {t.catalog.foundObjects}{' '}
          <span className="font-mono text-[#171717] dark:text-[#F5F5F5]">{total}</span>
        </p>

        <div className="flex items-center gap-3">
          <label
            htmlFor="catalog-sort"
            className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
          >
            {t.catalog.sortLabel}
          </label>
          <select
            id="catalog-sort"
            value={filters.sort || 'newest'}
            onChange={(e) => updateFilter({ sort: e.target.value })}
            className="min-h-[40px] rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-sm text-[#171717] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
          >
            <option value="newest">{t.catalog.sortNewest}</option>
            <option value="price_asc">{t.catalog.sortPriceAsc}</option>
            <option value="price_desc">{t.catalog.sortPriceDesc}</option>
            <option value="popular">{t.catalog.sortPopular}</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="rounded-[10px] bg-white px-3 py-1.5 text-xs font-medium text-[#991B1B]"
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-96 animate-pulse rounded-[18px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
            />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="mt-10 rounded-[20px] border border-[#E5E4E0] bg-white p-10 text-center dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <p className="text-base font-medium text-[#171717] dark:text-[#F5F5F5]">
            {t.catalog.emptyTitle}
          </p>
          <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.catalog.emptySubtitle}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-[14px] bg-[#143A30] px-5 text-sm font-medium text-white hover:bg-[#0F2C24]"
          >
            {t.catalog.resetFilters}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((item) => (
              <PropertyCard key={item.id} property={item} onSelect={onSelectProperty} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label={t.catalog.paginationAria}
              className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E4E0] pt-6 dark:border-[#2C2C2C]"
            >
              <p className="text-xs text-[#525252] tabular-nums dark:text-[#A0A0A0]">
                {t.catalog.pageLabel}{' '}
                <span className="font-mono text-[#171717] dark:text-[#F5F5F5]">{currentPage}</span>{' '}
                {t.catalog.ofLabel}{' '}
                <span className="font-mono text-[#171717] dark:text-[#F5F5F5]">{totalPages}</span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => updateFilter({ page: currentPage - 1 })}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-xs font-medium text-[#171717] disabled:opacity-40 dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  <span>{t.common.back}</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    aria-current={pageNum === currentPage ? 'page' : undefined}
                    onClick={() => updateFilter({ page: pageNum })}
                    className={`min-h-[40px] min-w-[40px] rounded-[12px] border px-3 font-mono text-xs font-medium transition-colors ${
                      pageNum === currentPage
                        ? 'border-[#143A30] bg-[#143A30] text-white'
                        : 'border-[#E5E4E0] bg-white text-[#171717] hover:bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateFilter({ page: currentPage + 1 })}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-xs font-medium text-[#171717] disabled:opacity-40 dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                >
                  <span>{t.common.next}</span>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
