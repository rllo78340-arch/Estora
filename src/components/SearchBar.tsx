import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { PropertyFilters } from '../types/estora';
import { UZBEKISTAN_CITIES } from '../utils/formatters';

interface SearchBarProps {
  initialFilters?: PropertyFilters;
  onSearch: (filters: PropertyFilters) => void;
  submitLabel?: string;
}

export function SearchBar({ initialFilters = {}, onSearch, submitLabel }: SearchBarProps) {
  const { t, localizeCity } = useI18n();
  const [dealType, setDealType] = useState(initialFilters.dealType ?? 'all');
  const [city, setCity] = useState(initialFilters.city ?? 'all');
  const [propertyType, setPropertyType] = useState(initialFilters.propertyType ?? 'all');
  const [q, setQ] = useState(initialFilters.q ?? '');

  useEffect(() => {
    setDealType(initialFilters.dealType ?? 'all');
    setCity(initialFilters.city ?? 'all');
    setPropertyType(initialFilters.propertyType ?? 'all');
    setQ(initialFilters.q ?? '');
  }, [initialFilters.city, initialFilters.dealType, initialFilters.propertyType, initialFilters.q]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch({
      ...initialFilters,
      dealType,
      city,
      propertyType,
      q,
      page: 1,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t.search.formAria}
      className="rounded-[20px] border border-[#E5E4E0] bg-white p-4 shadow-sm transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-2">
          <label
            htmlFor="search-deal-type"
            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
          >
            {t.search.section}
          </label>
          <select
            id="search-deal-type"
            value={dealType}
            onChange={(e) => setDealType(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            <option value="all">{t.search.allSections}</option>
            <option value="sale">{t.common.dealTypes.sale}</option>
            <option value="rent">{t.common.dealTypes.rent}</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="search-city"
            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
          >
            {t.search.city}
          </label>
          <select
            id="search-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            <option value="all">{t.search.allCities}</option>
            {UZBEKISTAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {localizeCity(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="search-property-type"
            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
          >
            {t.search.category}
          </label>
          <select
            id="search-property-type"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            <option value="all">{t.search.allCategories}</option>
            {Object.entries(t.common.propertyTypes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="search-query"
            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
          >
            {t.search.textSearch}
          </label>
          <input
            id="search-query"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search.textPlaceholder}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] placeholder:text-[#737373] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5] dark:placeholder:text-[#A0A0A0]"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#143A30] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#0F2C24] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143A30]"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{submitLabel || t.search.submit}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
