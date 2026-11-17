import { useState } from 'react';
import { Building2, Heart, Phone, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import type { DealType, PropertyListing, PropertyType } from '../types/estora';
import { formatSellerRating } from '../utils/formatters';
import { hasReal3dContent } from '../utils/tour3d';

interface PropertyCardProps {
  property: PropertyListing;
  onSelect: (property: PropertyListing) => void;
}

export function PropertyCard({ property, onSelect }: PropertyCardProps) {
  const { currency, favoriteIds, togglePropertyFavorite } = useAuth();
  const { t, formatPrice, localizeCity } = useI18n();
  const [imageError, setImageError] = useState(false);
  const [savingFav, setSavingFav] = useState(false);

  const isSaved = favoriteIds.has(property.id);
  const show3dBadge = property.has3dTour && hasReal3dContent(property);

  const dealLabel =
    t.common.dealTypes[property.dealType as DealType] ?? property.dealType;
  const typeLabel =
    t.common.propertyTypes[property.propertyType as PropertyType] ?? property.propertyType;
  const roleLabel =
    property.dealType === 'rent' ? t.card.landlordRole : t.card.sellerRole;
  const displayPhone = (property.contactPhone || property.ownerPhone || '').trim();
  const contactPerson = (property.contactName || property.ownerName || '').trim();

  const handleFavorite = async () => {
    setSavingFav(true);
    try {
      await togglePropertyFavorite(property.id);
    } finally {
      setSavingFav(false);
    }
  };

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-[18px] border border-[#E5E4E0] bg-white transition-all duration-200 hover:-translate-y-0.5 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#ECEBE8] dark:bg-[#242424]">
          {!imageError ? (
            <img
              src={property.imageUrl}
              alt={`${property.title} — ${localizeCity(property.city)}`}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F1F1EE] to-[#E5E4E0] p-6 text-center dark:from-[#202020] dark:to-[#181818]">
              <Building2 className="h-8 w-8 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
              <span className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {property.title}
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={savingFav}
            onClick={() => void handleFavorite()}
            aria-label={
              isSaved
                ? `${t.card.removeFromFavoritesAria}: ${property.title}`
                : `${t.card.addToFavoritesAria}: ${property.title}`
            }
            className={`absolute end-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#143A30] ${
              isSaved
                ? 'border-[#143A30] bg-[#143A30] text-white'
                : 'border-white/70 bg-white/90 text-[#171717] hover:bg-white dark:border-[#343434] dark:bg-[#1C1C1C]/90 dark:text-[#F5F5F5]'
            }`}
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>{dealLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{typeLabel}</span>
              {show3dBadge && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#8C6D46] dark:text-[#D4B483]">3D / 360°</span>
                </>
              )}
            </div>

            <span className="inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
              <Star className="h-3.5 w-3.5 fill-[#8C6D46] text-[#8C6D46]" aria-hidden="true" />
              {formatSellerRating(property.sellerRatingTenths)}
            </span>
          </div>

          <h3 className="mt-2 text-lg font-semibold leading-snug text-[#171717] dark:text-[#F5F5F5]">
            {property.title}
          </h3>

          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {localizeCity(property.city)}, {property.district}, {property.address}
          </p>

          <p className="mt-4 font-mono text-xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
            {formatPrice(property.priceUsd, currency, property.dealType)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#525252] tabular-nums dark:text-[#A0A0A0]">
            <span>
              {property.areaSqm} {t.common.sqm}
            </span>
            {property.bedrooms > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {property.bedrooms} {t.card.roomsShort}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>
              {property.floor}/{property.totalFloors} {t.common.floorShort}
            </span>
          </div>

          {displayPhone && (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 py-2 text-xs dark:border-[#2C2C2C] dark:bg-[#141414]">
              <span className="truncate font-medium text-[#525252] dark:text-[#A0A0A0]">
                {roleLabel}
                {contactPerson ? ` · ${contactPerson}` : ''}
              </span>
              <a
                href={`tel:${displayPhone.replace(/[^+\d]/g, '')}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex shrink-0 items-center gap-1.5 font-mono font-semibold text-[#143A30] hover:underline dark:text-[#D4B483]"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{displayPhone}</span>
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[#E5E4E0] px-6 py-4 dark:border-[#2C2C2C]">
        <button
          type="button"
          onClick={() => onSelect(property)}
          className="flex min-h-[40px] w-full items-center justify-center rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-4 text-sm font-medium text-[#171717] transition-colors duration-150 hover:border-[#143A30] hover:bg-[#143A30] hover:text-white focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#242424] dark:text-[#F5F5F5] dark:hover:border-[#D4B483]"
        >
          {t.card.detailsButton}
        </button>
      </div>
    </article>
  );
}
