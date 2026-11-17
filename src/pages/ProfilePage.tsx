import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  Bookmark,
  Clock,
  Edit3,
  Eye,
  Heart,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { AuthGateNotice } from '../components/AuthGateNotice';
import { PropertyCard } from '../components/PropertyCard';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import { apiFetch } from '../lib/api';
import type {
  CabinetOverviewResponse,
  FavoriteRecord,
  MessageRecord,
  NotificationType,
  PropertyListing,
  PropertyStatus,
} from '../types/estora';
import { buildPropertyQueryString, formatSellerRating } from '../utils/formatters';
import {
  groupMessagesIntoThreads,
  parseSavedFiltersJson,
  summarizeSellerPortfolioStats,
} from '../utils/social';

interface ProfilePageProps {
  querySearch?: string;
  onNavigate: (path: string) => void;
  onSelectProperty: (property: PropertyListing) => void;
}

type CabinetTab = 'buyer' | 'seller' | 'notifications';

export function ProfilePage({ querySearch = '', onNavigate, onSelectProperty }: ProfilePageProps) {
  const { idToken, dbUser, currency, favoriteIds } = useAuth();
  const { t, formatPrice, formatDate, localizeCity } = useI18n();
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    subscribeRealtime,
  } = useRealtime();

  const [activeTab, setActiveTab] = useState<CabinetTab>('buyer');
  const [overview, setOverview] = useState<CabinetOverviewResponse | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PropertyStatus>('all');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Seller inline review reply
  const [replyingReviewId, setReplyingReviewId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(querySearch);
    const tabParam = params.get('tab');
    if (tabParam === 'buyer' || tabParam === 'seller' || tabParam === 'notifications') {
      setActiveTab(tabParam);
    }
  }, [querySearch]);

  const loadCabinet = useCallback(
    async (token: string) => {
      setLoading(true);
      setActionError(null);
      try {
        const [cabinetRes, msgRes] = await Promise.all([
          apiFetch<CabinetOverviewResponse>('/api/cabinet/overview', { token }),
          apiFetch<{ messages: MessageRecord[] }>('/api/messages', { token }),
        ]);
        setOverview(cabinetRes);
        setMessages(msgRes.messages);
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : t.common.loadingError);
      } finally {
        setLoading(false);
      }
    },
    [t.common.loadingError]
  );

  useEffect(() => {
    if (!idToken) return;
    void loadCabinet(idToken);
  }, [idToken, loadCabinet]);

  useEffect(() => {
    if (!idToken) return;
    return subscribeRealtime((event) => {
      if (
        event.type === 'message:created' ||
        event.type === 'notification:created' ||
        event.type === 'review:updated'
      ) {
        void loadCabinet(idToken);
      }
    });
  }, [idToken, subscribeRealtime, loadCabinet]);

  const myProperties = useMemo(() => overview?.myProperties ?? [], [overview]);
  const portfolioStats = useMemo(
    () => summarizeSellerPortfolioStats(myProperties),
    [myProperties]
  );
  const totalIncomingMsgs = useMemo(
    () => myProperties.reduce((sum, p) => sum + (p.incomingMessagesCount ?? 0), 0),
    [myProperties]
  );

  const threads = useMemo(() => {
    if (!dbUser) return [];
    return groupMessagesIntoThreads(messages, dbUser.id);
  }, [messages, dbUser]);

  const sellerInboxThreads = useMemo(() => {
    if (!dbUser) return [];
    const myPropIds = new Set(myProperties.map((p) => p.id));
    return threads.filter(
      (th) =>
        (th.propertyId !== null && myPropIds.has(th.propertyId)) ||
        th.lastMessage.recipientId === dbUser.id
    );
  }, [threads, myProperties, dbUser]);

  const filteredProperties =
    statusFilter === 'all'
      ? myProperties
      : myProperties.filter((p) => p.status === statusFilter);

  const handleOpenFavorite = async (fav: FavoriteRecord) => {
    try {
      const res = await apiFetch<{ property: PropertyListing }>(`/api/properties/${fav.propertyId}`);
      if (res.property) {
        onSelectProperty(res.property);
      }
    } catch {
      onNavigate(`/catalog?q=${encodeURIComponent(fav.title)}`);
    }
  };

  const handleStatusUpdate = async (property: PropertyListing, nextStatus: PropertyStatus) => {
    if (!idToken) return;
    setBusyId(property.id);
    setActionError(null);
    try {
      await apiFetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        token: idToken,
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteListing = async (propertyId: number) => {
    if (!idToken) return;
    setBusyId(propertyId);
    setActionError(null);
    try {
      await apiFetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        token: idToken,
      });
      setConfirmDeleteId(null);
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleFilterNotify = async (id: number, current: boolean) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/saved-filters/${id}`, {
        method: 'PATCH',
        token: idToken,
        body: JSON.stringify({ notifyOnMatch: !current }),
      });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleDeleteSavedFilter = async (id: number) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/saved-filters/${id}`, { method: 'DELETE', token: idToken });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleDeleteSearchItem = async (id: number) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/search-history/${id}`, { method: 'DELETE', token: idToken });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleClearSearchHistory = async () => {
    if (!idToken) return;
    try {
      await apiFetch('/api/search-history', { method: 'DELETE', token: idToken });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleClearViewHistory = async () => {
    if (!idToken) return;
    try {
      await apiFetch('/api/view-history', { method: 'DELETE', token: idToken });
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    }
  };

  const handleSellerReply = async (reviewId: number) => {
    if (!idToken || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await apiFetch(`/api/reviews/${reviewId}/reply`, {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      setReplyingReviewId(null);
      setReplyText('');
      await loadCabinet(idToken);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
        {t.profile.title}
      </h1>
      <p className="mt-2 text-sm text-[#525252] dark:text-[#A0A0A0]">{t.profile.subtitle}</p>

      <div className="mt-8">
        {!idToken || !dbUser ? (
          <AuthGateNotice title={t.profile.authTitle} description={t.profile.authDesc} />
        ) : (
          <div className="space-y-8">
            {/* Top Summary Card */}
            <div className="grid grid-cols-1 gap-6 rounded-[20px] border border-[#E5E4E0] bg-white p-6 md:grid-cols-4 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
              <div>
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.profile.nameLabel}</p>
                <p className="mt-1 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {dbUser.fullName}
                </p>
                <p className="mt-0.5 text-xs text-[#525252] dark:text-[#A0A0A0]">{dbUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">
                  {t.profile.priorityCity}
                </p>
                <p className="mt-1 text-base font-medium text-[#171717] dark:text-[#F5F5F5]">
                  {localizeCity(dbUser.preferredCity)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.profile.inFavorites}</p>
                <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                  {overview?.favorites.length ?? favoriteIds.size}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.profile.myListings}</p>
                <p className="mt-1 font-mono text-xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                  {myProperties.length}
                </p>
              </div>
            </div>

            {/* Cabinet Role & Notifications Tabs */}
            <div
              role="tablist"
              aria-label={t.profile.title}
              className="flex flex-wrap gap-2 border-b border-[#E5E4E0] pb-4 dark:border-[#2C2C2C]"
            >
              {(
                [
                  { id: 'buyer', label: t.cabinet.tabBuyer },
                  { id: 'seller', label: t.cabinet.tabSeller },
                  { id: 'notifications', label: t.cabinet.tabNotifications },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border px-4 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[#143A30] bg-[#143A30] text-white'
                        : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] hover:text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.id === 'notifications' && unreadNotificationsCount > 0 && (
                      <span
                        className={`inline-flex min-w-[20px] h-5 items-center justify-center rounded-[7px] px-1.5 font-mono text-[11px] font-semibold ${
                          active
                            ? 'bg-white text-[#143A30]'
                            : 'bg-[#143A30] text-white dark:bg-[#D4B483] dark:text-[#111111]'
                        }`}
                      >
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {actionError && (
              <div className="rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B]">
                {actionError}
              </div>
            )}

            {loading && !overview ? (
              <div className="h-64 animate-pulse rounded-[20px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]" />
            ) : null}

            {/* TAB 1: BUYER & TENANT */}
            {activeTab === 'buyer' && overview && (
              <div className="space-y-10">
                {/* Favorites */}
                <section>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      <Heart className="h-5 w-5 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                      <span>{t.profile.inFavorites}</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('/favorites')}
                      className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                    >
                      {t.favorites.goToCatalog}
                    </button>
                  </div>
                  {overview.favorites.length === 0 ? (
                    <div className="mt-4 rounded-[18px] border border-[#E5E4E0] bg-white p-6 text-sm text-[#525252] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]">
                      {t.favorites.empty}
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {overview.favorites.map((fav) => (
                        <button
                          key={fav.favoriteId}
                          type="button"
                          onClick={() => void handleOpenFavorite(fav)}
                          className="group overflow-hidden rounded-[18px] border border-[#E5E4E0] bg-white text-start transition-colors hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
                        >
                          <div className="aspect-[16/10] w-full overflow-hidden bg-[#ECEBE8] dark:bg-[#242424]">
                            <img
                              src={fav.imageUrl}
                              alt={fav.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </div>
                          <div className="p-4">
                            <p className="font-mono text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {formatPrice(fav.priceUsd, currency, fav.dealType)}
                            </p>
                            <p className="mt-1 truncate text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
                              {fav.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[#737373] dark:text-[#A0A0A0]">
                              {localizeCity(fav.city)}, {fav.district}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Saved Filters & Search History */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Saved Filters */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        <Bookmark className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                        <span>{t.cabinet.savedFiltersTitle}</span>
                      </h2>
                    </div>

                    {overview.savedFilters.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptySavedFilters}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {overview.savedFilters.map((sf) => {
                          const parsed = parseSavedFiltersJson(sf.filtersJson);
                          const qs = buildPropertyQueryString(parsed);
                          return (
                            <div
                              key={sf.id}
                              className="rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 dark:border-[#2C2C2C] dark:bg-[#141414]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                    {sf.name}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[11px] text-[#737373] dark:text-[#A0A0A0]">
                                    {formatDate(sf.createdAt)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  aria-label={`${t.common.delete}: ${sf.name}`}
                                  onClick={() => void handleDeleteSavedFilter(sf.id)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#737373] hover:text-[#991B1B]"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onNavigate(`/catalog${qs}`)}
                                  className="inline-flex min-h-[34px] items-center rounded-[10px] bg-[#143A30] px-3 text-xs font-medium text-white hover:bg-[#0F2C24]"
                                >
                                  {t.cabinet.applyFilter}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleToggleFilterNotify(sf.id, sf.notifyOnMatch)
                                  }
                                  className={`inline-flex min-h-[34px] items-center rounded-[10px] border px-3 text-xs font-medium ${
                                    sf.notifyOnMatch
                                      ? 'border-[#143A30]/40 bg-white text-[#143A30] dark:bg-[#1C1C1C] dark:text-[#D4B483]'
                                      : 'border-[#E5E4E0] bg-white text-[#737373] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]'
                                  }`}
                                >
                                  {sf.notifyOnMatch ? t.cabinet.notifyOn : t.cabinet.notifyOff}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Search History */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        <Search className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                        <span>{t.cabinet.searchHistoryTitle}</span>
                      </h2>
                      {overview.searchHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleClearSearchHistory()}
                          className="text-xs font-medium text-[#737373] hover:text-[#991B1B] dark:text-[#A0A0A0]"
                        >
                          {t.cabinet.clearHistory}
                        </button>
                      )}
                    </div>

                    {overview.searchHistory.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptySearchHistory}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-2.5">
                        {overview.searchHistory.map((item) => {
                          const parsed = parseSavedFiltersJson(item.filtersJson);
                          const qs = buildPropertyQueryString(parsed);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 py-2.5 dark:border-[#2C2C2C] dark:bg-[#141414]"
                            >
                              <button
                                type="button"
                                onClick={() => onNavigate(`/catalog${qs}`)}
                                className="min-w-0 flex-1 text-start"
                              >
                                <p className="truncate text-sm font-medium text-[#171717] hover:underline dark:text-[#F5F5F5]">
                                  {item.queryText || (parsed.city ? localizeCity(parsed.city) : t.nav.catalog)}
                                </p>
                                <p className="text-[11px] text-[#737373] dark:text-[#A0A0A0]">
                                  {t.cabinet.resultsCount} {item.resultsCount} ·{' '}
                                  {formatDate(item.createdAt, true)}
                                </p>
                              </button>
                              <button
                                type="button"
                                aria-label={t.common.delete}
                                onClick={() => void handleDeleteSearchItem(item.id)}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#737373] hover:text-[#991B1B]"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                {/* View History */}
                <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      <Clock className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                      <span>{t.cabinet.viewHistoryTitle}</span>
                    </h2>
                    {overview.viewHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleClearViewHistory()}
                        className="text-xs font-medium text-[#737373] hover:text-[#991B1B] dark:text-[#A0A0A0]"
                      >
                        {t.cabinet.clearViews}
                      </button>
                    )}
                  </div>

                  {overview.viewHistory.length === 0 ? (
                    <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                      {t.cabinet.emptyViewHistory}
                    </p>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {overview.viewHistory.map((vh) => (
                        <button
                          key={vh.id}
                          type="button"
                          onClick={() => onSelectProperty(vh.property)}
                          className="flex items-center gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-start transition-colors hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414]"
                        >
                          <img
                            src={vh.property.imageUrl}
                            alt={vh.property.title}
                            referrerPolicy="no-referrer"
                            className="h-16 w-20 shrink-0 rounded-[10px] object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {vh.property.title}
                            </p>
                            <p className="font-mono text-xs text-[#143A30] dark:text-[#D4B483]">
                              {formatPrice(vh.property.priceUsd, currency, vh.property.dealType)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#737373] dark:text-[#A0A0A0]">
                              {formatDate(vh.viewedAt, true)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Conversations & Reviews */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Conversations */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        <MessageSquare
                          className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]"
                          aria-hidden="true"
                        />
                        <span>{t.cabinet.conversationsTitle}</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() => onNavigate('/messages')}
                        className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                      >
                        {t.cabinet.openMessenger}
                      </button>
                    </div>

                    {threads.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptyConversations}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-2.5">
                        {threads.slice(0, 6).map((th) => (
                          <button
                            key={th.threadKey}
                            type="button"
                            onClick={() =>
                              onNavigate(
                                `/messages?with=${th.otherUserId}${
                                  th.propertyId ? `&propertyId=${th.propertyId}` : ''
                                }`
                              )
                            }
                            className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-start hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                  {th.otherUserName}
                                </span>
                                {th.unreadCount > 0 && (
                                  <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-[6px] bg-[#143A30] px-1 font-mono text-[10px] font-semibold text-white">
                                    {th.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-[#525252] dark:text-[#A0A0A0]">
                                {th.propertyTitle ? `${th.propertyTitle}: ` : ''}
                                {th.lastMessage.body}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-[#737373] shrink-0 dark:text-[#A0A0A0]">
                              {formatDate(th.lastMessage.createdAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Buyer Reviews */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      <Star className="h-4 w-4 text-[#8C6D46] dark:text-[#D4B483]" aria-hidden="true" />
                      <span>{t.cabinet.reviewsByMeTitle}</span>
                    </h2>
                    {overview.reviewsAuthored.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptyReviews}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {overview.reviewsAuthored.map((rev) => (
                          <div
                            key={rev.id}
                            className="rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 dark:border-[#2C2C2C] dark:bg-[#141414]"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                {rev.sellerName}
                              </span>
                              <span className="font-mono text-[#8C6D46] dark:text-[#D4B483]">
                                {rev.rating}/5 · {formatDate(rev.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                              {rev.comment}
                            </p>
                            {rev.sellerReply && (
                              <p className="mt-2 rounded-[10px] bg-white px-2.5 py-2 text-xs text-[#143A30] dark:bg-[#1C1C1C] dark:text-[#D4B483]">
                                {t.reviews.sellerReplyBadge}: {rev.sellerReply}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* TAB 2: SELLER & LANDLORD */}
            {activeTab === 'seller' && overview && (
              <div className="space-y-10">
                {/* 4 Seller KPI Cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-5 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A0A0A0]">
                      <span>{t.cabinet.totalViewsKpi}</span>
                      <Eye className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                      {portfolioStats.totalViews}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-5 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A0A0A0]">
                      <span>{t.cabinet.totalFavoritesKpi}</span>
                      <Heart className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                      {portfolioStats.totalFavorites}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-5 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A0A0A0]">
                      <span>{t.cabinet.incomingMessagesKpi}</span>
                      <MessageSquare
                        className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                      {totalIncomingMsgs}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E4E0] bg-white p-5 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A0A0A0]">
                      <span>{t.cabinet.sellerRatingKpi}</span>
                      <Star className="h-4 w-4 fill-[#8C6D46] text-[#8C6D46]" aria-hidden="true" />
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                      {formatSellerRating(overview.sellerAverageRatingTenths)}
                    </p>
                  </div>
                </div>

                {/* Seller Listings & Publication Management */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {t.profile.listedObjects}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('/add')}
                      className="inline-flex min-h-[40px] items-center rounded-[14px] bg-[#143A30] px-4 text-sm font-medium text-white hover:bg-[#0F2C24]"
                    >
                      {t.profile.addObject}
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: t.profile.filterAll },
                      { id: 'active', label: t.common.statuses.active },
                      { id: 'pending', label: t.common.statuses.pending },
                      { id: 'draft', label: t.common.statuses.draft },
                      { id: 'archived', label: t.common.statuses.archived },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStatusFilter(tab.id as 'all' | PropertyStatus)}
                        className={`min-h-[36px] rounded-[12px] border px-3.5 text-xs font-medium transition-colors ${
                          statusFilter === tab.id
                            ? 'border-[#143A30] bg-[#143A30] text-white'
                            : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {filteredProperties.length === 0 ? (
                    <div className="mt-6 rounded-[18px] border border-[#E5E4E0] bg-white p-8 text-center text-sm text-[#525252] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]">
                      {t.profile.emptyCategory}
                    </div>
                  ) : (
                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {filteredProperties.map((prop) => {
                        const isBusy = busyId === prop.id;
                        const statusLabel =
                          t.common.statuses[prop.status as PropertyStatus] || prop.status;
                        return (
                          <div key={prop.id} className="flex flex-col gap-3">
                            <PropertyCard property={prop} onSelect={onSelectProperty} />

                            <div className="rounded-[16px] border border-[#E5E4E0] bg-white p-3.5 transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-[#737373] dark:text-[#A0A0A0]">
                                  {t.profile.statusLabel}
                                </span>
                                <span className="font-semibold text-[#143A30] dark:text-[#D4B483]">
                                  {statusLabel}
                                </span>
                              </div>

                              {/* Per-Listing Statistics */}
                              <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-[10px] bg-[#F8F8F7] px-2.5 py-2 text-[11px] dark:bg-[#141414]">
                                <div>
                                  <span className="block text-[#737373] dark:text-[#A0A0A0]">
                                    {t.cabinet.cardViewsLabel}
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                                    {prop.viewsCount ?? 0}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[#737373] dark:text-[#A0A0A0]">
                                    {t.cabinet.cardFavoritesLabel}
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                                    {prop.favoritesCount ?? 0}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[#737373] dark:text-[#A0A0A0]">
                                    {t.cabinet.cardMessagesLabel}
                                  </span>
                                  <span className="font-mono font-semibold tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                                    {prop.incomingMessagesCount ?? 0}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onNavigate(`/add?edit=${prop.id}`)}
                                  className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-xs font-medium text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#242424] dark:text-[#F5F5F5]"
                                >
                                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{t.common.edit}</span>
                                </button>

                                {prop.status === 'archived' || prop.status === 'draft' ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleStatusUpdate(prop, 'pending')}
                                    className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#143A30] bg-[#143A30] px-3 text-xs font-medium text-white hover:bg-[#0F2C24]"
                                  >
                                    {prop.status === 'archived' ? (
                                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                      <Send
                                        className="h-3.5 w-3.5 rtl:rotate-180"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>{t.profile.toModeration}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleStatusUpdate(prop, 'archived')}
                                    className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E4E0] bg-white px-3 text-xs font-medium text-[#525252] hover:text-[#171717] dark:border-[#343434] dark:bg-[#242424] dark:text-[#A0A0A0]"
                                  >
                                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>{t.profile.archive}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isBusy}
                                  aria-label={`${t.profile.deleteForeverAria}: ${prop.title}`}
                                  onClick={() =>
                                    setConfirmDeleteId(confirmDeleteId === prop.id ? null : prop.id)
                                  }
                                  className="inline-flex min-h-[36px] items-center justify-center rounded-[10px] border border-[#FCA5A5] bg-white px-2.5 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] dark:bg-[#1C1C1C]"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>

                              {confirmDeleteId === prop.id && (
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-xs">
                                  <span className="font-medium text-[#991B1B]">
                                    {t.profile.deleteConfirm}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="rounded-[8px] bg-white px-2.5 py-1 text-[#171717]"
                                    >
                                      {t.common.cancel}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void handleDeleteListing(prop.id)}
                                      className="rounded-[8px] bg-[#991B1B] px-2.5 py-1 font-medium text-white"
                                    >
                                      {t.common.delete}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Seller Inbox & Received Reviews */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Seller Inbox */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                        {t.cabinet.sellerInboxTitle}
                      </h2>
                      <button
                        type="button"
                        onClick={() => onNavigate('/messages')}
                        className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                      >
                        {t.cabinet.openMessenger}
                      </button>
                    </div>

                    {sellerInboxThreads.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptyConversations}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-2.5">
                        {sellerInboxThreads.slice(0, 8).map((th) => (
                          <button
                            key={th.threadKey}
                            type="button"
                            onClick={() =>
                              onNavigate(
                                `/messages?with=${th.otherUserId}${
                                  th.propertyId ? `&propertyId=${th.propertyId}` : ''
                                }`
                              )
                            }
                            className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-start hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                {th.otherUserName}
                              </p>
                              <p className="truncate text-xs text-[#525252] dark:text-[#A0A0A0]">
                                {th.propertyTitle ? `${th.propertyTitle}: ` : ''}
                                {th.lastMessage.body}
                              </p>
                            </div>
                            <span className="font-mono text-[11px] text-[#737373] shrink-0 dark:text-[#A0A0A0]">
                              {formatDate(th.lastMessage.createdAt)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Reviews About Me (Seller Reply Capable) */}
                  <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <h2 className="font-display text-lg font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {t.cabinet.reviewsAboutMeTitle}
                    </h2>

                    {overview.reviewsReceived.length === 0 ? (
                      <p className="mt-4 text-sm text-[#525252] dark:text-[#A0A0A0]">
                        {t.cabinet.emptyReviews}
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {overview.reviewsReceived.map((rev) => (
                          <div
                            key={rev.id}
                            className="rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 dark:border-[#2C2C2C] dark:bg-[#141414]"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
                                {rev.authorName}
                              </span>
                              <span className="font-mono text-[#8C6D46] dark:text-[#D4B483]">
                                {rev.rating}/5 · {formatDate(rev.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                              {rev.comment}
                            </p>

                            {rev.sellerReply ? (
                              <p className="mt-2 rounded-[10px] bg-white px-2.5 py-2 text-xs text-[#143A30] dark:bg-[#1C1C1C] dark:text-[#D4B483]">
                                {t.reviews.sellerReplyBadge}: {rev.sellerReply}
                              </p>
                            ) : (
                              <div className="mt-2">
                                {replyingReviewId === rev.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      rows={2}
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder={t.reviews.replyPlaceholder}
                                      className="w-full rounded-[10px] border border-[#E5E4E0] bg-white p-2 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setReplyingReviewId(null)}
                                        className="rounded-[8px] px-2 py-1 text-xs text-[#525252]"
                                      >
                                        {t.common.cancel}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={sendingReply}
                                        onClick={() => void handleSellerReply(rev.id)}
                                        className="rounded-[8px] bg-[#143A30] px-3 py-1 text-xs font-medium text-white"
                                      >
                                        {t.reviews.sendReply}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingReviewId(rev.id);
                                      setReplyText('');
                                    }}
                                    className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                                  >
                                    {t.reviews.replyBtn}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* TAB 3: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <section className="rounded-[20px] border border-[#E5E4E0] bg-white p-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E4E0] pb-4 dark:border-[#2C2C2C]">
                  <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    <Bell className="h-5 w-5 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                    <span>{t.notifications.title}</span>
                  </h2>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="rounded-[12px] border border-[#E5E4E0] px-3.5 py-1.5 text-xs font-medium text-[#143A30] hover:border-[#143A30] dark:border-[#343434] dark:text-[#D4B483]"
                    >
                      {t.notifications.markAllRead}
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[#525252] dark:text-[#A0A0A0]">
                    {t.notifications.empty}
                  </p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {notifications.map((notif) => {
                      const typeLabel =
                        t.notifications.types[notif.type as NotificationType] ?? notif.type;
                      return (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            void markNotificationRead(notif.id);
                            if (notif.linkPath) {
                              onNavigate(notif.linkPath);
                            }
                          }}
                          className={`block w-full rounded-[14px] border p-4 text-start transition-colors ${
                            notif.isRead
                              ? 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#141414]'
                              : 'border-[#D4B483] bg-[#FAF8F4] dark:border-[#6A573B] dark:bg-[#221F19]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#8C6D46] dark:text-[#D4B483]">
                              {typeLabel}
                            </span>
                            <span className="font-mono text-[#737373] tabular-nums dark:text-[#A0A0A0]">
                              {formatDate(notif.createdAt, true)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
                              {notif.body}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
