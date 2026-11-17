import { useEffect, useState } from 'react';
import { AuthGateNotice } from '../components/AuthGateNotice';
import { PropertyCard } from '../components/PropertyCard';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type { FavoriteRecord, PropertyListing } from '../types/estora';

interface FavoritesPageProps {
  onNavigate: (path: string) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

export function FavoritesPage({ onNavigate, onSelectProperty }: FavoritesPageProps) {
  const { idToken, favoriteIds } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) {
      setItems([]);
      return;
    }
    let active = true;
    const loadFavs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ favorites: FavoriteRecord[] }>('/api/favorites', {
          token: idToken,
        });
        if (!active) return;
        const mapped: PropertyListing[] = res.favorites.map((f) => ({
          id: f.propertyId,
          ownerId: 0,
          title: f.title,
          slug: String(f.propertyId),
          dealType: f.dealType,
          propertyType: f.propertyType,
          city: f.city,
          district: f.district,
          address: f.address,
          priceUsd: f.priceUsd,
          areaSqm: f.areaSqm,
          bedrooms: f.bedrooms,
          bathrooms: f.bathrooms,
          floor: f.floor ?? 1,
          totalFloors: f.totalFloors ?? 1,
          renovation: f.renovation,
          furnished: f.furnished,
          parking: f.parking,
          has3dTour: f.has3dTour,
          tour3dLabel: '',
          status: 'active',
          isFeatured: false,
          imageUrl: f.imageUrl,
          description: f.description,
          amenities: '[]',
          contactName: f.contactName,
          contactPhone: f.contactPhone,
          contactMethod: f.contactMethod,
          ownerName: f.ownerName,
          ownerPhone: f.ownerPhone,
          createdAt: f.createdAt,
        }));
        setItems(mapped);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : t.common.loadingError);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadFavs();
    return () => {
      active = false;
    };
  }, [idToken, favoriteIds, t.common.loadingError]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
        {t.favorites.title}
      </h1>
      <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">{t.favorites.subtitle}</p>

      <div className="mt-8">
        {!idToken ? (
          <AuthGateNotice title={t.favorites.authTitle} description={t.favorites.authDesc} />
        ) : error ? (
          <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            {error}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-80 animate-pulse rounded-[18px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-10 text-center transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
            <p className="text-base font-medium text-[#171717] dark:text-[#F5F5F5]">
              {t.favorites.empty}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/catalog')}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#143A30] px-6 text-sm font-medium text-white hover:bg-[#0F2C24]"
            >
              {t.favorites.goToCatalog}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <PropertyCard key={item.id} property={item} onSelect={onSelectProperty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
