import { useState, type ChangeEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileCheck2,
  MapPin,
  Phone,
  Star,
  Trash2,
  UploadCloud,
  X,
  ImagePlus,
} from 'lucide-react';
import { Tour3DUploader } from './Tour3DUploader';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { apiFetch } from '../../lib/api';
import type { ContactMethod } from '../../types/estora';
import {
  CONTACT_METHOD_LABELS,
  convertFromUsd,
  convertToUsd,
  type ListingWizardDraft,
  movePhoto,
  removePhoto,
  setPrimaryPhoto,
  UPLOAD_RULES,
  validateUploadFile,
} from '../../utils/listingWizard';

interface WizardStepsMediaProps {
  step: number;
  draft: ListingWizardDraft;
  updateDraft: (patch: Partial<ListingWizardDraft>) => void;
  submitting: boolean;
  onPublishAction: (targetStatus: 'draft' | 'pending') => void;
}

const ARCHITECTURAL_GALLERY_PRESETS = [
  {
    label: 'Tashkent Residence',
    url: '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg',
  },
  {
    label: 'Club House Tashkent',
    url: '/src/assets/images/prop_new_build_tashkent_1794854289325.jpg',
  },
  {
    label: 'Pool Villa',
    url: '/src/assets/images/hero_tashkent_residence_1794853627912.jpg',
  },
  {
    label: 'Modern House',
    url: '/src/assets/images/prop_modern_house_uz_1794854289249.jpg',
  },
  {
    label: 'Panoramic Penthouse',
    url: '/src/assets/images/prop_tashkent_penthouse_1794853628028.jpg',
  },
  {
    label: 'Samarkand Villa',
    url: '/src/assets/images/prop_samarkand_villa_1794853628391.jpg',
  },
] as const;

export function WizardStepsMedia({
  step,
  draft,
  updateDraft,
  submitting,
  onPublishAction,
}: WizardStepsMediaProps) {
  const { idToken, signInWithGoogle } = useAuth();
  const { t, localizeCity, language } = useI18n();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const contactKeys = Object.keys(CONTACT_METHOD_LABELS) as ContactMethod[];

  const uploadSingleFile = async (
    file: File,
    kind: 'photo' | 'model3d' | 'panorama'
  ): Promise<string> => {
    const check = validateUploadFile(
      { name: file.name, type: file.type, size: file.size },
      kind
    );
    if (!check.valid) {
      throw new Error(check.error || t.common.loadingError);
    }

    if (idToken) {
      const formData = new FormData();
      formData.append('kind', kind);
      formData.append('file', file);
      const res = await apiFetch<{ asset: { url: string } }>('/api/uploads', {
        method: 'POST',
        token: idToken,
        body: formData,
      });
      return res.asset.url;
    }

    return URL.createObjectURL(file);
  };

  const handlePhotoFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadError(null);
    setUploading(true);
    try {
      const added: { id: string; url: string; name: string; sizeBytes?: number }[] = [];
      for (const file of files) {
        const url = await uploadSingleFile(file, 'photo');
        added.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url,
          name: file.name,
          sizeBytes: file.size,
        });
      }
      const nextPhotos = [...draft.photos, ...added].slice(0, 15);
      updateDraft({
        photos: nextPhotos,
        primaryPhotoId: draft.primaryPhotoId || nextPhotos[0]?.id || '',
      });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setUploading(false);
    }
  };

  if (step === 5) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 5 — {t.wizard.steps[4]}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step5Hint}
          </p>
        </div>

        <div className="rounded-[18px] border border-dashed border-[#C9C7C0] bg-[#F8F8F7] p-6 text-center dark:border-[#2C2C2C] dark:bg-[#141414]">
          <UploadCloud className="mx-auto h-8 w-8 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.dropPhotosTitle}
          </p>
          <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
            {UPLOAD_RULES.photo.label}
          </p>

          <label className="mt-4 inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[14px] bg-[#143A30] px-5 text-sm font-medium text-white hover:bg-[#0F2C24]">
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <span>{uploading ? t.common.updating : t.wizard.uploadPhotosBtn}</span>
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => void handlePhotoFilesChange(e)}
              className="sr-only"
            />
          </label>

          {!idToken && (
            <p className="mt-3 text-xs text-[#737373] dark:text-[#A0A0A0]">
              {t.wizard.localPreviewHint}
            </p>
          )}
        </div>

        {uploadError && (
          <div
            role="alert"
            className="rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-3.5 text-xs text-[#991B1B]"
          >
            {uploadError}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.presetsHint}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ARCHITECTURAL_GALLERY_PRESETS.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => {
                  if (draft.photos.some((p) => p.url === preset.url)) return;
                  const next = [
                    ...draft.photos,
                    { id: `preset-${Date.now()}-${preset.label}`, url: preset.url, name: preset.label },
                  ];
                  updateDraft({
                    photos: next,
                    primaryPhotoId: draft.primaryPhotoId || next[0].id,
                  });
                }}
                className="min-h-[36px] rounded-[12px] border border-[#E5E4E0] bg-white px-3 text-xs text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {draft.photos.map((photo, index) => {
            const isPrimary = photo.id === draft.primaryPhotoId;
            return (
              <div
                key={photo.id}
                className={`overflow-hidden rounded-[16px] border bg-white dark:bg-[#141414] ${
                  isPrimary ? 'border-[#143A30] ring-1 ring-[#143A30]' : 'border-[#E5E4E0] dark:border-[#2C2C2C]'
                }`}
              >
                <div className="relative aspect-[4/3] bg-[#ECEBE8] dark:bg-[#242424]">
                  <img
                    src={photo.url}
                    alt={photo.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`${t.wizard.previewTitle}: ${photo.name}`}
                    onClick={() => setPreviewUrl(photo.url)}
                    className="absolute end-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#171717] hover:bg-white"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {isPrimary && (
                    <span className="absolute start-2.5 top-2.5 rounded-[8px] bg-[#143A30] px-2.5 py-1 text-[11px] font-medium text-white">
                      {t.wizard.primaryBadge}
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 p-3.5">
                  <p className="truncate text-xs font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {index + 1}. {photo.name}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`${t.wizard.prevStep}: ${photo.name}`}
                        onClick={() =>
                          updateDraft({ photos: movePhoto(draft.photos, index, -1) })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E5E4E0] text-[#171717] disabled:opacity-40 dark:border-[#2C2C2C] dark:text-[#F5F5F5]"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.photos.length - 1}
                        aria-label={`${t.wizard.nextStep}: ${photo.name}`}
                        onClick={() =>
                          updateDraft({ photos: movePhoto(draft.photos, index, 1) })
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#E5E4E0] text-[#171717] disabled:opacity-40 dark:border-[#2C2C2C] dark:text-[#F5F5F5]"
                      >
                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(setPrimaryPhoto(draft.photos, photo.id))
                          }
                          className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-[#E5E4E0] px-2.5 text-xs font-medium text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:text-[#F5F5F5]"
                        >
                          <Star className="h-3 w-3" aria-hidden="true" />
                          <span>{t.wizard.makePrimaryBtn}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`${t.common.delete}: ${photo.name}`}
                        onClick={() =>
                          updateDraft(
                            removePhoto(draft.photos, draft.primaryPhotoId, photo.id)
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEF2F2]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {previewUrl && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.wizard.previewTitle}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <div className="relative max-w-4xl overflow-hidden rounded-[20px] bg-white p-2 dark:bg-[#1C1C1C]">
              <button
                type="button"
                aria-label={t.common.close}
                onClick={() => setPreviewUrl(null)}
                className="absolute end-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#171717]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <img
                src={previewUrl}
                alt={t.wizard.previewTitle}
                referrerPolicy="no-referrer"
                className="max-h-[80vh] w-full rounded-[14px] object-contain"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 6) {
    return <Tour3DUploader draft={draft} updateDraft={updateDraft} />;
  }

  if (step === 7) {
    const isRent = draft.dealType === 'rent';
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 7 — {isRent ? t.wizard.landlordContactsHeading : t.wizard.sellerContactsHeading}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step7Hint} {t.wizard.contactVisibilityHint}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="wiz-contact-name" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {isRent ? t.wizard.landlordNameLabel : t.wizard.sellerNameLabel} *
            </label>
            <input
              id="wiz-contact-name"
              type="text"
              value={draft.contactName}
              onChange={(e) => updateDraft({ contactName: e.target.value })}
              placeholder="Timur Rakhimov"
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>

          <div>
            <label htmlFor="wiz-contact-phone" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
              {isRent ? t.wizard.landlordPhoneLabel : t.wizard.sellerPhoneLabel} *
            </label>
            <input
              id="wiz-contact-phone"
              type="tel"
              value={draft.contactPhone}
              onChange={(e) => updateDraft({ contactPhone: e.target.value })}
              placeholder="+998 90 123 45 67"
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 font-mono text-sm text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
            />
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.contactMethodLabel}
          </span>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {contactKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => updateDraft({ contactMethod: key })}
                className={`min-h-[44px] rounded-[14px] border px-4 text-xs font-medium transition-colors ${
                  draft.contactMethod === key
                    ? 'border-[#143A30] bg-[#143A30] text-white'
                    : 'border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]'
                }`}
              >
                {t.common.contactMethods[key]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 8 — Публикация и Предпросмотр
  const effectiveCity = draft.city === '__other__' ? draft.customCity : draft.city;
  const primaryPhoto =
    draft.photos.find((p) => p.id === draft.primaryPhotoId)?.url ||
    draft.photos[0]?.url ||
    '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg';
  const rawEnteredPrice = Number(draft.priceAmount) || 0;
  const priceUsd = convertToUsd(rawEnteredPrice, draft.priceCurrency);
  const priceUzs =
    draft.priceCurrency === 'UZS' && rawEnteredPrice > 0
      ? Math.round(rawEnteredPrice)
      : convertFromUsd(priceUsd, 'UZS');
  const currentStatus = draft.status ?? 'draft';

  const has3dAttached = Boolean(
    draft.model3dUrl.trim() ||
      draft.panoramaUrl.trim() ||
      draft.virtualTourUrl.trim() ||
      draft.tourRooms.length > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 8 — {t.wizard.previewTitle}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step8Hint}
          </p>
        </div>

        <div className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 py-2 text-xs dark:border-[#2C2C2C] dark:bg-[#141414]">
          {t.wizard.statusLabel}{' '}
          <span className="font-semibold text-[#143A30] dark:text-[#D4B483]">
            {t.common.statuses[currentStatus]}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#2C2C2C] dark:bg-[#141414]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="aspect-[4/3] bg-[#ECEBE8] lg:col-span-5 lg:aspect-auto dark:bg-[#242424]">
            <img
              src={primaryPhoto}
              alt={draft.title || t.wizard.previewTitle}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="space-y-4 bg-white p-6 lg:col-span-7 dark:bg-[#1C1C1C]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
              <span>{t.common.dealTypes[draft.dealType]}</span>
              <span>·</span>
              <span>{t.common.propertyTypes[draft.propertyType]}</span>
              <span>·</span>
              <span>
                {t.common.uzbekistan}, {localizeCity(effectiveCity || 'Ташкент')}
              </span>
            </div>

            <h3 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
              {draft.title || t.wizard.noTitleFallback}
            </h3>

            <p className="flex items-center gap-1.5 text-sm text-[#525252] dark:text-[#A0A0A0]">
              <MapPin className="h-4 w-4 text-[#143A30] shrink-0 dark:text-[#D4B483]" aria-hidden="true" />
              <span>
                {localizeCity(effectiveCity || 'Ташкент')}, {draft.district || '—'},{' '}
                {draft.address || '—'} ({draft.latitude.toFixed(4)},{' '}
                {draft.longitude.toFixed(4)})
              </span>
            </p>

            <div className="font-mono tabular-nums">
              <p className="text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
                ${priceUsd.toLocaleString('en-US').replace(/,/g, ' ')}
                {draft.dealType === 'rent' ? ` ${t.common.perMonth}` : ''}
              </p>
              <p className="text-xs text-[#737373] dark:text-[#A0A0A0]">
                {priceUzs.toLocaleString(language === 'uz' ? 'uz-Latn-UZ' : 'ru-RU')}{' '}
                {t.common.uzsCurrencySuffix}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-[#E5E4E0] py-3 text-xs sm:grid-cols-4 dark:border-[#2C2C2C]">
              <div>
                <span className="text-[#737373] dark:text-[#A0A0A0]">{t.detail.area}</span>
                <p className="mt-0.5 font-mono font-medium text-[#171717] dark:text-[#F5F5F5]">
                  {draft.areaSqm || '—'} {t.common.sqm}
                </p>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A0A0A0]">{t.detail.rooms}</span>
                <p className="mt-0.5 font-mono font-medium text-[#171717] dark:text-[#F5F5F5]">
                  {draft.bedrooms}
                </p>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A0A0A0]">{t.detail.floors}</span>
                <p className="mt-0.5 font-mono font-medium text-[#171717] dark:text-[#F5F5F5]">
                  {draft.floor} / {draft.totalFloors}
                </p>
              </div>
              <div>
                <span className="text-[#737373] dark:text-[#A0A0A0]">{t.wizard.photos3dCol}</span>
                <p className="mt-0.5 font-mono font-medium text-[#171717] dark:text-[#F5F5F5]">
                  {draft.photos.length}
                  {has3dAttached
                    ? draft.tourRooms.length > 0
                      ? ` · ${draft.tourRooms.length} 360°`
                      : ' · 3D'
                    : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-[#525252] sm:grid-cols-2 dark:text-[#A0A0A0]">
              <p>
                {t.detail.renovation}: {t.common.renovations[draft.renovation]}
              </p>
              <p>
                {t.detail.heating}: {t.common.heating[draft.heating]}
              </p>
              <p className="sm:col-span-2">
                {[
                  draft.furnished ? t.common.furnishedYes : null,
                  draft.airConditioning ? t.common.acYes : null,
                  draft.parking ? t.common.parkingYes : null,
                  draft.balcony ? t.common.balconyYes : null,
                ]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-4 py-3 dark:border-[#2C2C2C] dark:bg-[#141414]">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#737373] dark:text-[#A0A0A0]">
                  {draft.dealType === 'rent' ? t.detail.landlordLabel : t.detail.sellerOnlyLabel} ·{' '}
                  {t.common.contactMethods[draft.contactMethod]}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {draft.contactName || '—'}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#143A30]/20 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-[#143A30] dark:border-[#D4B483]/30 dark:bg-[#1C1C1C] dark:text-[#D4B483]">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{draft.contactPhone || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!idToken && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 dark:border-[#2C2C2C] dark:bg-[#141414]">
          <p className="text-sm text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.authSaveHint}
          </p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex min-h-[40px] items-center rounded-[12px] bg-[#143A30] px-4 text-xs font-medium text-white hover:bg-[#0F2C24]"
          >
            {t.nav.signInGoogle}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onPublishAction('draft')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-[#E5E4E0] bg-white px-5 text-sm font-medium text-[#171717] hover:bg-[#F8F8F7] disabled:opacity-50 dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]"
        >
          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
          <span>{submitting ? t.common.saving : t.wizard.saveDraft}</span>
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onPublishAction('pending')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] bg-[#143A30] px-6 text-sm font-medium text-white hover:bg-[#0F2C24] disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{submitting ? t.detail.sending : t.wizard.submitModeration}</span>
        </button>
      </div>
    </div>
  );
}
