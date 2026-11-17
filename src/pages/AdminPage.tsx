import { useEffect, useState } from 'react';
import { AuthGateNotice } from '../components/AuthGateNotice';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type { DealType, PropertyListing, ReviewStatus, SellerReviewRecord } from '../types/estora';

interface AdminOverviewResponse {
  totalProperties: number;
  totalUsers: number;
  totalMessages: number;
  properties: PropertyListing[];
  flaggedReviews?: SellerReviewRecord[];
}

export function AdminPage() {
  const { idToken, currency } = useAuth();
  const { t, formatPrice, formatDate, localizeCity } = useI18n();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdmin = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AdminOverviewResponse>('/api/admin/overview', { token });
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!idToken) return;
    void loadAdmin(idToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const handleStatusChange = async (id: number, status: string, isFeatured: boolean) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/admin/properties/${id}`, {
        method: 'PATCH',
        token: idToken,
        body: JSON.stringify({ status, isFeatured }),
      });
      await loadAdmin(idToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleReviewModeration = async (id: number, status: ReviewStatus) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        token: idToken,
        body: JSON.stringify({ status }),
      });
      await loadAdmin(idToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const flaggedReviews = data?.flaggedReviews ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
        {t.admin.title}
      </h1>
      <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">{t.admin.subtitle}</p>

      <div className="mt-8">
        {!idToken ? (
          <AuthGateNotice title={t.admin.authTitle} description={t.admin.authDesc} />
        ) : error ? (
          <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            {error}
          </div>
        ) : loading || !data ? (
          <div className="h-64 animate-pulse rounded-[20px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]" />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">
                  {t.admin.totalProperties}
                </p>
                <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                  {data.totalProperties}
                </p>
              </div>
              <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.admin.totalUsers}</p>
                <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                  {data.totalUsers}
                </p>
              </div>
              <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">
                  {t.admin.totalMessages}
                </p>
                <p className="mt-2 font-mono text-3xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                  {data.totalMessages}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[20px] border border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-[#E5E4E0] bg-[#F8F8F7] text-xs text-[#525252] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#A0A0A0]">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colObject}</th>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colCity}</th>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colDeal}</th>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colPrice}</th>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colStatus}</th>
                    <th className="px-5 py-3.5 font-medium">{t.admin.colFeatured}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E4E0] dark:divide-[#2C2C2C]">
                  {data.properties.map((prop) => (
                    <tr
                      key={prop.id}
                      className="hover:bg-[#F8F8F7]/60 dark:hover:bg-[#242424]/60"
                    >
                      <td className="px-5 py-4 font-medium text-[#171717] dark:text-[#F5F5F5]">
                        <div>{prop.title}</div>
                        {(prop.contactPhone || prop.ownerPhone) && (
                          <div className="mt-0.5 font-mono text-xs font-normal text-[#525252] dark:text-[#A0A0A0]">
                            {prop.dealType === 'rent' ? t.card.landlordRole : t.card.sellerRole}:{' '}
                            {prop.contactPhone || prop.ownerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[#525252] dark:text-[#A0A0A0]">
                        {localizeCity(prop.city)}
                      </td>
                      <td className="px-5 py-4 text-[#525252] dark:text-[#A0A0A0]">
                        {t.common.dealTypes[prop.dealType as DealType] ?? prop.dealType}
                      </td>
                      <td className="px-5 py-4 font-mono tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                        {formatPrice(prop.priceUsd, currency, prop.dealType)}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          aria-label={`${t.admin.colStatus}: ${prop.title}`}
                          value={prop.status}
                          onChange={(e) =>
                            void handleStatusChange(prop.id, e.target.value, prop.isFeatured)
                          }
                          className="min-h-[36px] rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-2.5 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                        >
                          <option value="active">{t.common.statuses.active}</option>
                          <option value="pending">{t.common.statuses.pending}</option>
                          <option value="draft">{t.common.statuses.draft}</option>
                          <option value="archived">{t.common.statuses.archived}</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            void handleStatusChange(prop.id, prop.status, !prop.isFeatured)
                          }
                          className={`min-h-[34px] rounded-[10px] border px-3 text-xs font-medium ${
                            prop.isFeatured
                              ? 'border-[#143A30] bg-[#143A30] text-white'
                              : 'border-[#E5E4E0] bg-white text-[#525252] dark:border-[#343434] dark:bg-[#141414] dark:text-[#A0A0A0]'
                          }`}
                        >
                          {prop.isFeatured ? t.admin.featuredTop : t.admin.featuredRegular}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Flagged Reviews Moderation */}
            <div className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
              <h2 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                {t.cabinet.flaggedReviewsAdminTitle}
              </h2>

              {flaggedReviews.length === 0 ? (
                <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                  {t.cabinet.noFlaggedReviews}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {flaggedReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="flex flex-col justify-between gap-4 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 sm:flex-row sm:items-center dark:border-[#2C2C2C] dark:bg-[#141414]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373] dark:text-[#A0A0A0]">
                          <span className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                            {rev.authorName}
                          </span>
                          <span>→ {rev.sellerName}</span>
                          <span className="font-mono">{rev.rating}/5</span>
                          <span>·</span>
                          <span className="font-mono">{formatDate(rev.createdAt)}</span>
                          <span className="rounded-[6px] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-medium text-[#991B1B]">
                            {rev.status} ({rev.reportsCount})
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-[#171717] dark:text-[#F5F5F5]">
                          {rev.comment}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleReviewModeration(rev.id, 'visible')}
                          className="min-h-[36px] rounded-[10px] border border-[#E5E4E0] bg-white px-3 text-xs font-medium text-[#143A30] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#D4B483]"
                        >
                          {t.reviews.restoreReview}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewModeration(rev.id, 'hidden')}
                          className="min-h-[36px] rounded-[10px] bg-[#991B1B] px-3 text-xs font-medium text-white hover:bg-[#7F1D1D]"
                        >
                          {t.reviews.hideReview}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
