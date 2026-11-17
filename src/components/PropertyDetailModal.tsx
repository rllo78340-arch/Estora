import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Box,
  Check,
  Compass,
  ExternalLink,
  Flag,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  Phone,
  Send,
  Star,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import { apiFetch } from '../lib/api';
import type {
  ContactMethod,
  DealType,
  HeatingType,
  PropertyListing,
  PropertyType,
  RenovationType,
  ReviewReportReason,
  SellerReviewRecord,
} from '../types/estora';
import { formatSellerRating, parseAmenities } from '../utils/formatters';
import { parseGalleryImages } from '../utils/listingWizard';
import { isSafeMessageImageUrl } from '../utils/social';
import { hasReal3dContent } from '../utils/tour3d';
import { Tour3DViewer } from './Tour3DViewer';

interface PropertyDetailModalProps {
  property: PropertyListing | null;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

export function PropertyDetailModal({ property, onClose, onNavigate }: PropertyDetailModalProps) {
  const { currency, dbUser, favoriteIds, idToken, signInWithGoogle, togglePropertyFavorite } =
    useAuth();
  const { t, formatPrice, formatDate, localizeCity } = useI18n();
  const { subscribeRealtime } = useRealtime();

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [show3dViewer, setShow3dViewer] = useState(false);

  // Inquiry state
  const [messageBody, setMessageBody] = useState('');
  const [attachedImageUrl, setAttachedImageUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Seller reviews state
  const [reviews, setReviews] = useState<SellerReviewRecord[]>([]);
  const [averageRatingTenths, setAverageRatingTenths] = useState<number>(49);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Seller reply state
  const [replyingReviewId, setReplyingReviewId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Report review state
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState<ReviewReportReason>('inaccurate');
  const [reportDetails, setReportDetails] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<number>>(new Set());

  const loadReviews = useCallback(async (sellerId: number) => {
    setLoadingReviews(true);
    try {
      const res = await apiFetch<{
        reviews: SellerReviewRecord[];
        averageRatingTenths: number;
      }>(`/api/sellers/${sellerId}/reviews`);
      setReviews(res.reviews);
      setAverageRatingTenths(res.averageRatingTenths);
    } catch {
      // ignore transient error
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  useEffect(() => {
    setActivePhotoIndex(0);
    setShow3dViewer(false);
    setMessageBody('');
    setAttachedImageUrl('');
    setSentSuccess(false);
    setSendError(null);
    setReviewFeedback(null);
    setReviewError(null);
    setReplyingReviewId(null);
    setReportingReviewId(null);

    if (!property) return;

    setAverageRatingTenths(property.sellerRatingTenths ?? 49);
    void apiFetch(`/api/properties/${property.id}/view`, {
      method: 'POST',
      token: idToken ?? undefined,
    }).catch(() => {});

    void loadReviews(property.ownerId);
  }, [property, idToken, loadReviews]);

  useEffect(() => {
    if (!property) return;
    return subscribeRealtime((event) => {
      if (event.type === 'review:updated' && event.payload) {
        const payload = event.payload as {
          sellerId?: number;
          averageRatingTenths?: number;
          review?: SellerReviewRecord;
        };
        if (payload.sellerId === property.ownerId) {
          if (typeof payload.averageRatingTenths === 'number') {
            setAverageRatingTenths(payload.averageRatingTenths);
          }
          void loadReviews(property.ownerId);
        }
      }
    });
  }, [property, subscribeRealtime, loadReviews]);

  if (!property) return null;

  const isSaved = favoriteIds.has(property.id);
  const isOwner = Boolean(dbUser && dbUser.id === property.ownerId);
  const amenities = parseAmenities(property.amenities);
  const gallery = parseGalleryImages(property.galleryImages, property.imageUrl);
  const activeImage = gallery[activePhotoIndex] || property.imageUrl;
  const hasReal3d = hasReal3dContent(property);

  const dealLabel = t.common.dealTypes[property.dealType as DealType] ?? property.dealType;
  const typeLabel =
    t.common.propertyTypes[property.propertyType as PropertyType] ?? property.propertyType;
  const renovationLabel =
    t.common.renovations[(property.renovation as RenovationType) || 'designer'] ??
    property.renovation ??
    t.common.renovations.designer;
  const heatingLabel =
    t.common.heating[(property.heating as HeatingType) || 'individual'] ??
    t.common.heating.individual;
  const contactLabel = property.contactMethod
    ? t.common.contactMethods[property.contactMethod as ContactMethod] ?? property.contactMethod
    : '';

  const handleAttachPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    setUploadingPhoto(true);
    setSendError(null);
    try {
      const formData = new FormData();
      formData.append('kind', 'photo');
      formData.append('file', file);
      const res = await apiFetch<{ asset?: { url?: string } }>('/api/uploads', {
        method: 'POST',
        token: idToken,
        body: formData,
      });
      const url = res.asset?.url ?? '';
      if (!url || !isSafeMessageImageUrl(url)) {
        throw new Error(t.messages.sendError);
      }
      setAttachedImageUrl(url);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : t.messages.sendError);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleInquiry = async (e: FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setSentSuccess(false);

    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    if (!messageBody.trim() && !attachedImageUrl) {
      setSendError(t.detail.inquiryErrorEmpty);
      return;
    }

    setSending(true);
    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          propertyId: property.id,
          recipientId: property.ownerId,
          subject: property.title,
          body: messageBody.trim(),
          imageUrl: attachedImageUrl,
        }),
      });
      setMessageBody('');
      setAttachedImageUrl('');
      setSentSuccess(true);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : t.detail.inquiryErrorSend);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    setReviewFeedback(null);

    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await apiFetch<{
        review: SellerReviewRecord;
        averageRatingTenths: number;
      }>('/api/reviews', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          sellerId: property.ownerId,
          propertyId: property.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      setAverageRatingTenths(res.averageRatingTenths);
      setReviewComment('');
      setReviewFeedback(t.reviews.reviewSaved);
      await loadReviews(property.ownerId);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSendReply = async (reviewId: number) => {
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
      await loadReviews(property.ownerId);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSendingReply(false);
    }
  };

  const handleSendReport = async (reviewId: number) => {
    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    setSendingReport(true);
    try {
      await apiFetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      setReportedReviewIds((prev) => new Set(prev).add(reviewId));
      setReportingReviewId(null);
      setReportDetails('');
      await loadReviews(property.ownerId);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[20px] border border-[#E5E4E0] bg-white transition-colors duration-200 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#E5E4E0] bg-white px-6 py-4 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <div className="min-w-0">
            <p className="text-xs text-[#525252] dark:text-[#A0A0A0]">
              {dealLabel} · {typeLabel} · {t.common.uzbekistan}, {localizeCity(property.city)}
            </p>
            <h2
              id="property-detail-title"
              className="truncate font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]"
            >
              {property.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void togglePropertyFavorite(property.id)}
              aria-label={isSaved ? t.card.removeFromFavoritesAria : t.card.addToFavoritesAria}
              className={`inline-flex h-10 items-center gap-2 rounded-[14px] border px-3.5 text-xs font-medium transition-colors ${
                isSaved
                  ? 'border-[#143A30] bg-[#143A30] text-white'
                  : 'border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] hover:bg-[#ECEBE8] dark:border-[#343434] dark:bg-[#242424] dark:text-[#F5F5F5]'
              }`}
            >
              <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} aria-hidden="true" />
              <span>{isSaved ? t.detail.savedButton : t.detail.saveButton}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.detail.closeAria}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#E5E4E0] bg-white text-[#171717] hover:bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#242424] dark:text-[#F5F5F5]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="space-y-8 p-6">
          {hasReal3d && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#D4B483]/50 bg-[#FAF8F4] px-4 py-3 dark:border-[#6A573B] dark:bg-[#221F19]">
              <div className="flex items-center gap-2.5 text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
                <Compass className="h-4 w-4 text-[#8C6D46] dark:text-[#D4B483]" aria-hidden="true" />
                <span>
                  {property.tourRooms && property.tourRooms.length > 0
                    ? `${t.detail.tourAvailableRooms} (${property.tourRooms.length})`
                    : property.model3dUrl
                      ? t.detail.tourAvailableModel
                      : t.detail.tourAvailableVirtual}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {show3dViewer ? (
                  <button
                    type="button"
                    onClick={() => setShow3dViewer(false)}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-[12px] border border-[#E5E4E0] bg-white px-4 text-xs font-semibold text-[#171717] hover:bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#262626] dark:text-[#F5F5F5]"
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    <span>{t.detail.backToPhotos}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShow3dViewer(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-[#143A30] px-5 text-xs font-semibold tracking-wide text-white shadow-sm hover:bg-[#0F2C24]"
                  >
                    <Compass className="h-4 w-4 text-[#D4B483]" aria-hidden="true" />
                    <span>{t.detail.view3dTourBtn}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {hasReal3d && show3dViewer ? (
            <Tour3DViewer
              title={property.title}
              label={property.tour3dLabel}
              propertyId={property.id}
              propertyType={property.propertyType}
              totalFloors={property.totalFloors}
              description={property.description}
              amenities={property.amenities}
              galleryImages={gallery}
              imageUrl={property.imageUrl}
              model3dUrl={property.model3dUrl}
              panoramaUrl={property.panoramaUrl}
              virtualTourUrl={property.virtualTourUrl}
              tourConfig={property.tourConfig}
              tourRooms={property.tourRooms}
              tourHotspots={property.tourHotspots}
            />
          ) : (
            <div className="aspect-[16/9] w-full overflow-hidden rounded-[18px] border border-[#E5E4E0] bg-[#ECEBE8] dark:border-[#2C2C2C] dark:bg-[#242424]">
              <img
                src={activeImage}
                alt={property.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {gallery.length > 1 && (!hasReal3d || !show3dViewer) && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {gallery.map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  type="button"
                  aria-label={`${t.detail.showPhotoAria} ${idx + 1}`}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-[12px] border transition-all ${
                    idx === activePhotoIndex
                      ? 'border-[#143A30] ring-2 ring-[#143A30]'
                      : 'border-[#E5E4E0] opacity-75 hover:opacity-100 dark:border-[#2C2C2C]'
                  }`}
                >
                  <img
                    src={url}
                    alt={`${property.title} ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {hasReal3d && (property.model3dUrl || property.virtualTourUrl) && (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-4 py-3 text-xs dark:border-[#2C2C2C] dark:bg-[#141414]">
              {property.model3dUrl && (
                <a
                  href={property.model3dUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#143A30] underline underline-offset-4 dark:text-[#D4B483]"
                >
                  <Box className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.detail.downloadModel}</span>
                </a>
              )}
              {property.virtualTourUrl && (
                <a
                  href={property.virtualTourUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#143A30] underline underline-offset-4 dark:text-[#D4B483]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.detail.openExternalTour}</span>
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-2xl font-medium tabular-nums text-[#171717] dark:text-[#F5F5F5]">
                      {formatPrice(property.priceUsd, currency, property.dealType)}
                    </p>
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate(`/design?propertyId=${property.id}`);
                      }}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-[14px] bg-[#143A30] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#0F2C24] dark:bg-[#D4B483] dark:text-[#111111]"
                    >
                      <Box className="h-4 w-4" aria-hidden="true" />
                      <span>Создать свой интерьер</span>
                    </button>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[#525252] dark:text-[#A0A0A0]">
                  <MapPin
                    className="h-3.5 w-3.5 text-[#143A30] shrink-0 dark:text-[#D4B483]"
                    aria-hidden="true"
                  />
                  <span>
                    {t.common.uzbekistan}, {localizeCity(property.city)}, {property.district},{' '}
                    {property.address}
                  </span>
                  {typeof property.latitude === 'number' && typeof property.longitude === 'number' && (
                    <span className="font-mono text-xs text-[#737373] dark:text-[#A0A0A0]">
                      ({property.latitude.toFixed(4)}, {property.longitude.toFixed(4)})
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 sm:grid-cols-4 dark:border-[#2C2C2C] dark:bg-[#141414]">
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.area}</p>
                  <p className="mt-1 font-mono text-base font-medium tabular-nums">
                    {property.areaSqm} {t.common.sqm}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.rooms}</p>
                  <p className="mt-1 font-mono text-base font-medium tabular-nums">
                    {property.bedrooms}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.bathrooms}</p>
                  <p className="mt-1 font-mono text-base font-medium tabular-nums">
                    {property.bathrooms}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.floors}</p>
                  <p className="mt-1 font-mono text-base font-medium tabular-nums">
                    {property.floor} / {property.totalFloors}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-[16px] border border-[#E5E4E0] bg-white p-4 text-sm sm:grid-cols-3 dark:border-[#2C2C2C] dark:bg-[#141414]">
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.renovation}</p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {renovationLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.heating}</p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {heatingLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.furniture}</p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {property.furnished ? t.common.furnishedYes : t.common.furnishedNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">
                    {t.detail.airConditioning}
                  </p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {property.airConditioning === false ? t.common.acNo : t.common.acYes}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.parking}</p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {property.parking ? t.common.parkingYes : t.common.parkingNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">{t.detail.balcony}</p>
                  <p className="mt-1 font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {property.balcony === false ? t.common.balconyNo : t.common.balconyYes}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.detail.descriptionTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                  {property.description}
                </p>
              </div>

              {amenities.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    {t.detail.amenitiesTitle}
                  </h3>
                  <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {amenities.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 text-sm text-[#525252] dark:text-[#A0A0A0]"
                      >
                        <Check
                          className="h-4 w-4 text-[#143A30] shrink-0 dark:text-[#D4B483]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <form
                onSubmit={(e) => void handleInquiry(e)}
                className="rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[#737373] dark:text-[#A0A0A0]">
                    {property.dealType === 'rent' ? t.detail.landlordLabel : t.detail.sellerOnlyLabel}
                  </p>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[#171717] dark:text-[#F5F5F5]">
                    <Star className="h-3.5 w-3.5 fill-[#8C6D46] text-[#8C6D46]" aria-hidden="true" />
                    {formatSellerRating(averageRatingTenths)}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {property.contactName || property.ownerName || 'ESTORA Private Advisory'}
                </h3>
                {(property.contactPhone || property.ownerPhone) && (
                  <a
                    href={`tel:${(property.contactPhone || property.ownerPhone || '').replace(/[^+\d]/g, '')}`}
                    className="mt-2.5 flex items-center justify-between gap-2 rounded-[12px] border border-[#143A30]/20 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#143A30] transition-colors hover:border-[#143A30] dark:border-[#D4B483]/30 dark:bg-[#1C1C1C] dark:text-[#D4B483]"
                  >
                    <span className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                      {property.dealType === 'rent'
                        ? t.detail.landlordPhoneLabel
                        : t.detail.sellerPhoneLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{property.contactPhone || property.ownerPhone}</span>
                    </span>
                  </a>
                )}
                {property.contactMethod && (
                  <p className="mt-2 text-xs text-[#737373] dark:text-[#A0A0A0]">
                    {t.detail.contactMethodLabel} {contactLabel}
                  </p>
                )}

                <label
                  htmlFor="detail-inquiry-body"
                  className="mt-4 block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                >
                  {t.detail.inquiryLabel}
                </label>
                <textarea
                  id="detail-inquiry-body"
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder={t.detail.inquiryPlaceholder}
                  className="mt-1.5 w-full rounded-[14px] border border-[#E5E4E0] bg-white p-3 text-sm text-[#171717] placeholder:text-[#737373] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5] dark:placeholder:text-[#A0A0A0]"
                />

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#E5E4E0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#525252] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#A0A0A0]">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {uploadingPhoto ? t.messagesExtra.uploadingPhoto : t.messagesExtra.attachPhoto}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void handleAttachPhoto(e)}
                      disabled={uploadingPhoto}
                      className="sr-only"
                    />
                  </label>
                  {attachedImageUrl && (
                    <button
                      type="button"
                      onClick={() => setAttachedImageUrl('')}
                      className="text-xs font-medium text-[#991B1B] hover:underline dark:text-[#FCA5A5]"
                    >
                      {t.messagesExtra.removePhoto}
                    </button>
                  )}
                </div>

                {attachedImageUrl && (
                  <div className="mt-2 overflow-hidden rounded-[12px] border border-[#E5E4E0] dark:border-[#343434]">
                    <img
                      src={attachedImageUrl}
                      alt={t.messagesExtra.photoAttached}
                      className="h-28 w-full object-cover"
                    />
                  </div>
                )}

                {sendError && (
                  <p className="mt-2 text-xs text-[#991B1B] dark:text-[#FCA5A5]">{sendError}</p>
                )}
                {sentSuccess && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs font-medium text-[#143A30] dark:text-[#D4B483]">
                      {t.detail.inquirySent}
                    </p>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigate(`/messages?with=${property.ownerId}&propertyId=${property.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#143A30] underline dark:text-[#D4B483]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t.cabinet.openMessenger}</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || uploadingPhoto}
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#143A30] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0F2C24] disabled:opacity-60"
                >
                  <Send className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  <span>
                    {!idToken
                      ? t.detail.loginAndSend
                      : sending
                        ? t.detail.sending
                        : t.detail.sendMessage}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Seller Reviews Section */}
          <section
            data-testid="seller-reviews-section"
            className="border-t border-[#E5E4E0] pt-8 dark:border-[#2C2C2C]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.reviews.sectionTitle}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-[#525252] dark:text-[#A0A0A0]">
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    <Star className="h-4 w-4 fill-[#8C6D46] text-[#8C6D46]" aria-hidden="true" />
                    {formatSellerRating(averageRatingTenths)}
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {reviews.length} {t.reviews.reviewsCountLabel}
                  </span>
                </div>
              </div>
            </div>

            {reviewFeedback && (
              <div className="mt-4 rounded-[14px] border border-[#143A30]/30 bg-[#F3F7F5] px-4 py-2.5 text-xs font-medium text-[#143A30] dark:border-[#D4B483]/40 dark:bg-[#1E2B26] dark:text-[#D4B483]">
                {reviewFeedback}
              </div>
            )}
            {reviewError && (
              <div className="mt-4 rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]">
                {reviewError}
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Review List */}
              <div className="space-y-4 lg:col-span-7">
                {loadingReviews ? (
                  <div className="h-32 animate-pulse rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#141414]" />
                ) : reviews.length === 0 ? (
                  <div className="rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-6 text-sm text-[#525252] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#A0A0A0]">
                    {t.reviews.noReviews}
                  </div>
                ) : (
                  reviews.map((rev) => {
                    const isReported = reportedReviewIds.has(rev.id) || rev.status === 'flagged';
                    return (
                      <article
                        key={rev.id}
                        className="rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 dark:border-[#2C2C2C] dark:bg-[#141414]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {rev.authorName}
                            </span>
                            <div
                              className="flex items-center gap-0.5"
                              aria-label={`${rev.rating} / 5`}
                            >
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3.5 w-3.5 ${
                                    star <= rev.rating
                                      ? 'fill-[#8C6D46] text-[#8C6D46]'
                                      : 'text-[#D4D3CE] dark:text-[#3A3A3A]'
                                  }`}
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          </div>
                          <span className="font-mono text-xs text-[#737373] tabular-nums dark:text-[#A0A0A0]">
                            {formatDate(rev.createdAt)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-relaxed text-[#171717] dark:text-[#E5E5E5]">
                          {rev.comment}
                        </p>

                        {rev.sellerReply && (
                          <div className="mt-3 rounded-[12px] border border-[#E5E4E0] bg-white p-3 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-semibold text-[#143A30] dark:text-[#D4B483]">
                                {t.reviews.sellerReplyBadge}
                              </span>
                              {rev.sellerRepliedAt && (
                                <span className="font-mono text-[#737373] dark:text-[#A0A0A0]">
                                  {formatDate(rev.sellerRepliedAt)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
                              {rev.sellerReply}
                            </p>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          {isOwner && !rev.sellerReply && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingReviewId(replyingReviewId === rev.id ? null : rev.id);
                                setReplyText('');
                              }}
                              className="text-xs font-medium text-[#143A30] hover:underline dark:text-[#D4B483]"
                            >
                              {t.reviews.replyBtn}
                            </button>
                          )}

                          {(!dbUser || dbUser.id !== rev.authorId) && (
                            <div className="ms-auto flex items-center gap-2">
                              {isReported && (
                                <span className="text-[11px] font-medium text-[#8C6D46] dark:text-[#D4B483]">
                                  {reportedReviewIds.has(rev.id)
                                    ? t.reviews.reportedSuccess
                                    : t.reviews.flaggedBadge}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setReportingReviewId(reportingReviewId === rev.id ? null : rev.id)
                                }
                                className="inline-flex items-center gap-1 text-xs text-[#737373] hover:text-[#991B1B] dark:text-[#A0A0A0] dark:hover:text-[#FCA5A5]"
                              >
                                <Flag className="h-3 w-3" aria-hidden="true" />
                                <span>{t.reviews.reportBtn}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {replyingReviewId === rev.id && (
                          <div className="mt-3 space-y-2 rounded-[12px] border border-[#E5E4E0] bg-white p-3 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                            <textarea
                              rows={2}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={t.reviews.replyPlaceholder}
                              className="w-full rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] p-2 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingReviewId(null)}
                                className="rounded-[8px] px-2.5 py-1 text-xs text-[#525252]"
                              >
                                {t.common.cancel}
                              </button>
                              <button
                                type="button"
                                disabled={sendingReply}
                                onClick={() => void handleSendReply(rev.id)}
                                className="rounded-[8px] bg-[#143A30] px-3 py-1 text-xs font-medium text-white hover:bg-[#0F2C24]"
                              >
                                {t.reviews.sendReply}
                              </button>
                            </div>
                          </div>
                        )}

                        {reportingReviewId === rev.id && (
                          <div className="mt-3 space-y-2 rounded-[12px] border border-[#FCA5A5]/70 bg-white p-3 dark:border-[#7F1D1D] dark:bg-[#1C1C1C]">
                            <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                              {t.reviews.reportTitle}
                            </p>
                            <label className="block text-[11px] text-[#525252] dark:text-[#A0A0A0]">
                              {t.reviews.reportReasonLabel}
                              <select
                                value={reportReason}
                                onChange={(e) =>
                                  setReportReason(e.target.value as ReviewReportReason)
                                }
                                className="mt-1 min-h-[34px] w-full rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                              >
                                {(
                                  ['spam', 'inaccurate', 'offensive', 'fraud', 'other'] as const
                                ).map((key) => (
                                  <option key={key} value={key}>
                                    {t.reviews.reasons[key]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <input
                              type="text"
                              value={reportDetails}
                              onChange={(e) => setReportDetails(e.target.value)}
                              placeholder={t.reviews.reportDetailsPlaceholder}
                              className="min-h-[34px] w-full rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-2.5 text-xs text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReportingReviewId(null)}
                                className="rounded-[8px] px-2.5 py-1 text-xs text-[#525252]"
                              >
                                {t.common.cancel}
                              </button>
                              <button
                                type="button"
                                disabled={sendingReport}
                                onClick={() => void handleSendReport(rev.id)}
                                className="rounded-[8px] bg-[#991B1B] px-3 py-1 text-xs font-medium text-white"
                              >
                                {t.reviews.sendReport}
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>

              {/* Leave a Review Form */}
              {!isOwner && (
                <div className="lg:col-span-5">
                  <form
                    onSubmit={(e) => void handleSubmitReview(e)}
                    className="rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]"
                  >
                    <h4 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                      {t.reviews.writeReviewTitle}
                    </h4>

                    <div className="mt-3">
                      <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                        {t.reviews.ratingLabel}
                      </span>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={`${star} / 5`}
                            onClick={() => setReviewRating(star)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E4E0] bg-white transition-colors hover:border-[#8C6D46] dark:border-[#343434] dark:bg-[#1C1C1C]"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                star <= reviewRating
                                  ? 'fill-[#8C6D46] text-[#8C6D46]'
                                  : 'text-[#D4D3CE] dark:text-[#444444]'
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <label
                      htmlFor="seller-review-comment"
                      className="mt-4 block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                    >
                      {t.reviews.commentLabel}
                    </label>
                    <textarea
                      id="seller-review-comment"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t.reviews.commentPlaceholder}
                      className="mt-1.5 w-full rounded-[14px] border border-[#E5E4E0] bg-white p-3 text-sm text-[#171717] placeholder:text-[#737373] focus-visible:outline-2 focus-visible:outline-[#143A30] dark:border-[#343434] dark:bg-[#1C1C1C] dark:text-[#F5F5F5] dark:placeholder:text-[#A0A0A0]"
                    />

                    {!idToken && (
                      <p className="mt-2 text-xs text-[#737373] dark:text-[#A0A0A0]">
                        {t.reviews.signInToReview}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-[14px] bg-[#143A30] px-4 text-sm font-medium text-white hover:bg-[#0F2C24] disabled:opacity-60"
                    >
                      {!idToken
                        ? t.nav.signInGoogle
                        : submittingReview
                          ? t.reviews.submitting
                          : t.reviews.submitReview}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
