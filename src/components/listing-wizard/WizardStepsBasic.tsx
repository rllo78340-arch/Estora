import { useState } from 'react';
import { Phone, Plus } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type {
  ContactMethod,
  CurrencyCode,
  HeatingType,
  PropertyType,
  RenovationType,
} from '../../types/estora';
import {
  PROPERTY_TYPE_LABELS,
  RENOVATION_LABELS,
  UZBEKISTAN_CITIES,
} from '../../utils/formatters';
import {
  CONTACT_METHOD_LABELS,
  convertFromUsd,
  convertToUsd,
  EXTRA_AMENITY_OPTIONS,
  HEATING_LABELS,
  type ListingWizardDraft,
  UZBEKISTAN_CITY_COORDS,
} from '../../utils/listingWizard';
import { UzbekistanMapPicker } from './UzbekistanMapPicker';

interface WizardStepsBasicProps {
  step: number;
  draft: ListingWizardDraft;
  updateDraft: (patch: Partial<ListingWizardDraft>) => void;
}

export function WizardStepsBasic({ step, draft, updateDraft }: WizardStepsBasicProps) {
  const [customAmenity, setCustomAmenity] = useState('');
  const { t, localizeCity, language } = useI18n();

  const propertyTypeKeys = Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[];
  const renovationKeys = Object.keys(RENOVATION_LABELS) as RenovationType[];
  const heatingKeys = Object.keys(HEATING_LABELS) as HeatingType[];
  const contactKeys = Object.keys(CONTACT_METHOD_LABELS) as ContactMethod[];

  if (step === 1) {
    const isRent = draft.dealType === 'rent';
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 1 — {t.wizard.steps[0]}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step1Hint}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.dealTypeLabel} *
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(['sale', 'rent'] as const).map((dealKey) => (
                <button
                  key={dealKey}
                  type="button"
                  onClick={() => updateDraft({ dealType: dealKey })}
                  className={`min-h-[44px] rounded-[14px] border px-4 text-sm font-medium transition-colors ${
                    draft.dealType === dealKey
                      ? 'border-[#143A30] bg-[#143A30] text-white'
                      : 'border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]'
                  }`}
                >
                  {t.common.dealTypes[dealKey]}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="wiz-property-type" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.categoryLabel} *
            </label>
            <select
              id="wiz-property-type"
              value={draft.propertyType}
              onChange={(e) => updateDraft({ propertyType: e.target.value as PropertyType })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            >
              {propertyTypeKeys.map((key) => (
                <option key={key} value={key}>
                  {t.common.propertyTypes[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="wiz-title" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.titleLabel} *
            </label>
            <input
              id="wiz-title"
              type="text"
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              placeholder={t.wizard.titlePlaceholder}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="wiz-area" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.areaLabel} *
            </label>
            <input
              id="wiz-area"
              type="number"
              min={10}
              value={draft.areaSqm}
              onChange={(e) => updateDraft({ areaSqm: e.target.value })}
              placeholder="165"
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="wiz-bedrooms" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.roomsLabel}
            </label>
            <input
              id="wiz-bedrooms"
              type="number"
              min={0}
              max={30}
              value={draft.bedrooms}
              onChange={(e) => updateDraft({ bedrooms: e.target.value })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="wiz-bathrooms" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.bathroomsLabel}
            </label>
            <input
              id="wiz-bathrooms"
              type="number"
              min={0}
              value={draft.bathrooms}
              onChange={(e) => updateDraft({ bathrooms: e.target.value })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="wiz-floor" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.floorLabel} *
            </label>
            <input
              id="wiz-floor"
              type="number"
              min={1}
              value={draft.floor}
              onChange={(e) => updateDraft({ floor: e.target.value })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="wiz-total-floors" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.totalFloorsLabel} *
            </label>
            <input
              id="wiz-total-floors"
              type="number"
              min={1}
              value={draft.totalFloors}
              onChange={(e) => updateDraft({ totalFloors: e.target.value })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="wiz-description" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.descriptionLabel} *
            </label>
            <textarea
              id="wiz-description"
              rows={5}
              value={draft.description}
              onChange={(e) => updateDraft({ description: e.target.value })}
              placeholder={t.wizard.descriptionPlaceholder}
              className="mt-1.5 w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-6 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#143A30] text-white">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {isRent ? t.wizard.landlordContactsHeading : t.wizard.sellerContactsHeading}
                </h3>
                <p className="mt-0.5 text-xs text-[#525252] dark:text-[#A0A0A0]">
                  {t.wizard.contactVisibilityHint}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wiz-step1-contact-name" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                  {isRent ? t.wizard.landlordNameLabel : t.wizard.sellerNameLabel} *
                </label>
                <input
                  id="wiz-step1-contact-name"
                  type="text"
                  value={draft.contactName}
                  onChange={(e) => updateDraft({ contactName: e.target.value })}
                  placeholder="Timur Rakhimov"
                  className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-white px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                />
              </div>

              <div>
                <label htmlFor="wiz-step1-contact-phone" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                  {isRent ? t.wizard.landlordPhoneLabel : t.wizard.sellerPhoneLabel} *
                </label>
                <input
                  id="wiz-step1-contact-phone"
                  type="tel"
                  value={draft.contactPhone}
                  onChange={(e) => updateDraft({ contactPhone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-white px-3.5 font-mono text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div className="mt-4">
              <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.wizard.contactMethodLabel}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {contactKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateDraft({ contactMethod: key })}
                    className={`min-h-[40px] rounded-[12px] border px-3 text-xs font-medium transition-colors ${
                      draft.contactMethod === key
                        ? 'border-[#143A30] bg-[#143A30] text-white'
                        : 'border-[#E5E4E0] bg-white text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]'
                    }`}
                  >
                    {t.common.contactMethods[key]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 2 — {t.wizard.steps[1]}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step2Hint}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="wiz-country" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.countryLabel}
            </label>
            <input
              id="wiz-country"
              type="text"
              readOnly
              value={t.common.uzbekistan}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#ECEBE8] px-3.5 text-sm font-medium text-[#171717] dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]"
            />
          </div>

          <div>
            <label htmlFor="wiz-city" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.cityLabel} *
            </label>
            <select
              id="wiz-city"
              value={draft.city}
              onChange={(e) => {
                const nextCity = e.target.value;
                const coords = UZBEKISTAN_CITY_COORDS[nextCity];
                updateDraft({
                  city: nextCity,
                  ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
                });
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            >
              {UZBEKISTAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {localizeCity(c)}
                </option>
              ))}
              <option value="__other__">{t.wizard.customCityOption}</option>
            </select>
            {draft.city === '__other__' && (
              <input
                type="text"
                aria-label={t.wizard.customCityPlaceholder}
                value={draft.customCity}
                onChange={(e) => updateDraft({ customCity: e.target.value })}
                placeholder={t.wizard.customCityPlaceholder}
                className="mt-2 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            )}
          </div>

          <div>
            <label htmlFor="wiz-district" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.districtLabel} *
            </label>
            <input
              id="wiz-district"
              type="text"
              value={draft.district}
              onChange={(e) => updateDraft({ district: e.target.value })}
              placeholder={t.wizard.districtPlaceholder}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div>
            <label htmlFor="wiz-address" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.streetLabel} *
            </label>
            <input
              id="wiz-address"
              type="text"
              value={draft.address}
              onChange={(e) => updateDraft({ address: e.target.value })}
              placeholder={t.wizard.streetPlaceholder}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>
        </div>

        <UzbekistanMapPicker
          city={draft.city === '__other__' ? draft.customCity : draft.city}
          latitude={draft.latitude}
          longitude={draft.longitude}
          onChange={(latitude, longitude) => updateDraft({ latitude, longitude })}
        />
      </div>
    );
  }

  if (step === 3) {
    const rawAmount = Number(draft.priceAmount) || 0;
    const usdEquivalent = convertToUsd(rawAmount, draft.priceCurrency);
    const uzsEquivalent = convertFromUsd(usdEquivalent, 'UZS');

    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 3 — {t.wizard.steps[2]}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step3Hint}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="wiz-currency" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.currencyLabel}
            </label>
            <select
              id="wiz-currency"
              value={draft.priceCurrency}
              onChange={(e) => updateDraft({ priceCurrency: e.target.value as CurrencyCode })}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            >
              <option value="USD">USD ($)</option>
              <option value="UZS">UZS ({t.common.uzsCurrencySuffix})</option>
            </select>
          </div>

          <div>
            <label htmlFor="wiz-price" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {draft.dealType === 'rent'
                ? `${t.wizard.monthlyRentLabel} (${draft.priceCurrency}) *`
                : `${t.wizard.priceLabel} (${draft.priceCurrency}) *`}
            </label>
            <input
              id="wiz-price"
              type="number"
              min={1}
              value={draft.priceAmount}
              onChange={(e) => {
                const val = e.target.value;
                updateDraft({
                  priceAmount: val,
                  ...(draft.dealType === 'rent' ? { monthlyRentAmount: val } : {}),
                });
              }}
              placeholder={draft.priceCurrency === 'UZS' ? '3200000000' : '380000'}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 font-mono text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="wiz-monthly-rent" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.monthlyRentLabel} ({draft.priceCurrency})
              {draft.dealType === 'rent' ? ' *' : ''}
            </label>
            <input
              id="wiz-monthly-rent"
              type="number"
              min={0}
              value={draft.monthlyRentAmount}
              onChange={(e) => updateDraft({ monthlyRentAmount: e.target.value })}
              placeholder={draft.priceCurrency === 'UZS' ? '25000000' : '2500'}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 font-mono text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]">
          <p className="text-xs font-medium text-[#737373] dark:text-[#A0A0A0]">
            {t.wizard.autoCalcNote}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-4 font-mono tabular-nums">
            <span className="text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
              ${usdEquivalent.toLocaleString('en-US').replace(/,/g, ' ')}
              {draft.dealType === 'rent' ? ` ${t.common.perMonth}` : ''}
            </span>
            <span className="text-sm text-[#525252] dark:text-[#A0A0A0]">
              ≈ {uzsEquivalent.toLocaleString(language === 'uz' ? 'uz-Latn-UZ' : 'ru-RU')}{' '}
              {t.common.uzsCurrencySuffix}
              {draft.dealType === 'rent' ? ` ${t.common.perMonth}` : ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Step 4 — Характеристики
  const toggleAmenity = (item: string) => {
    const exists = draft.amenities.includes(item);
    updateDraft({
      amenities: exists
        ? draft.amenities.filter((a) => a !== item)
        : [...draft.amenities, item],
    });
  };

  const handleAddCustomAmenity = () => {
    const clean = customAmenity.trim();
    if (!clean) return;
    if (!draft.amenities.includes(clean)) {
      updateDraft({ amenities: [...draft.amenities, clean] });
    }
    setCustomAmenity('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
          {t.wizard.stepOf} 4 — {t.wizard.steps[3]}
        </h2>
        <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
          {t.wizard.step4Hint}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wiz-renovation" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.renovationLabel}
          </label>
          <select
            id="wiz-renovation"
            value={draft.renovation}
            onChange={(e) => updateDraft({ renovation: e.target.value as RenovationType })}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            {renovationKeys.map((key) => (
              <option key={key} value={key}>
                {t.common.renovations[key]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="wiz-heating" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.heatingLabel}
          </label>
          <select
            id="wiz-heating"
            value={draft.heating}
            onChange={(e) => updateDraft({ heating: e.target.value as HeatingType })}
            className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            {heatingKeys.map((key) => (
              <option key={key} value={key}>
                {t.common.heating[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: 'furnished', label: t.wizard.furnishedCheckbox, checked: draft.furnished },
          { key: 'airConditioning', label: t.wizard.acCheckbox, checked: draft.airConditioning },
          { key: 'parking', label: t.wizard.parkingCheckbox, checked: draft.parking },
          { key: 'balcony', label: t.wizard.balconyCheckbox, checked: draft.balcony },
        ].map((item) => (
          <label
            key={item.key}
            className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-4 text-sm font-medium text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => updateDraft({ [item.key]: e.target.checked })}
              className="h-4 w-4 accent-[#143A30]"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
          {t.wizard.amenitiesTitle}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {Array.from(new Set([...EXTRA_AMENITY_OPTIONS, ...draft.amenities])).map((item) => {
            const active = draft.amenities.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleAmenity(item)}
                className={`min-h-[38px] rounded-[12px] border px-3.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#143A30] bg-[#143A30] text-white'
                    : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            aria-label={t.wizard.customAmenityPlaceholder}
            value={customAmenity}
            onChange={(e) => setCustomAmenity(e.target.value)}
            placeholder={t.wizard.customAmenityPlaceholder}
            className="min-h-[42px] flex-1 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          />
          <button
            type="button"
            onClick={handleAddCustomAmenity}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[14px] border border-[#E5E4E0] bg-white px-4 text-sm font-medium text-[#171717] hover:bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{t.wizard.addAmenityBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
