import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import type { PropertyListing } from '../types/estora';
import {
  convertToUsd,
  DEFAULT_WIZARD_DRAFT,
  type ListingWizardDraft,
  propertyToWizardDraft,
  validateWizardStep,
  WIZARD_STEPS,
} from '../utils/listingWizard';
import { validateUzbekistanLocation } from '../utils/uzbekistan';
import { WizardStepsBasic } from '../components/listing-wizard/WizardStepsBasic';
import { WizardStepsMedia } from '../components/listing-wizard/WizardStepsMedia';

interface AddPropertyPageProps {
  querySearch?: string;
  onCreated: (property: PropertyListing) => void;
}

const DRAFT_STORAGE_KEY = 'estora_listing_wizard_draft_v1';

export function AddPropertyPage({ querySearch = '', onCreated }: AddPropertyPageProps) {
  const { idToken, dbUser, signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const params = new URLSearchParams(querySearch);
  const editIdParam = Number(params.get('edit'));
  const isEditMode = Number.isFinite(editIdParam) && editIdParam > 0;
  const initialStepParam = Number(params.get('step'));

  const [step, setStep] = useState<number>(() =>
    initialStepParam >= 1 && initialStepParam <= 8 ? initialStepParam : 1
  );
  const [draft, setDraft] = useState<ListingWizardDraft>(() => {
    if (typeof window !== 'undefined' && !isEditMode) {
      try {
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          return { ...DEFAULT_WIZARD_DRAFT, ...JSON.parse(saved) };
        }
      } catch {
        // ignore storage error
      }
    }
    return DEFAULT_WIZARD_DRAFT;
  });
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Предзаполнение контактных данных из профиля, если поля пусты
  useEffect(() => {
    if (!dbUser || isEditMode) return;
    setDraft((prev) => ({
      ...prev,
      contactName: prev.contactName || dbUser.fullName || '',
      contactPhone: prev.contactPhone || dbUser.phone || '',
    }));
  }, [dbUser, isEditMode]);

  // Загрузка существующего объекта при редактировании (?edit=ID)
  useEffect(() => {
    if (!isEditMode) return;
    let active = true;
    const loadForEdit = async () => {
      setLoadingEdit(true);
      setStepError(null);
      try {
        const res = await apiFetch<{ property: PropertyListing }>(
          `/api/properties/${editIdParam}`,
          idToken ? { token: idToken } : {}
        );
        if (active && res.property) {
          setDraft(propertyToWizardDraft(res.property));
        }
      } catch (err: unknown) {
        if (active) {
          setStepError(err instanceof Error ? err.message : t.common.loadingError);
        }
      } finally {
        if (active) setLoadingEdit(false);
      }
    };
    void loadForEdit();
    return () => {
      active = false;
    };
  }, [editIdParam, idToken, isEditMode, t.common.loadingError]);

  // Локальное сохранение черновика формы
  useEffect(() => {
    if (isEditMode || typeof window === 'undefined') return;
    try {
      const serializable = {
        ...draft,
        photos: draft.photos.filter((p) => !p.url.startsWith('blob:')),
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // ignore quota errors
    }
  }, [draft, isEditMode]);

  const updateDraft = (patch: Partial<ListingWizardDraft>) => {
    setStepError(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleNext = () => {
    const err = validateWizardStep(step, draft);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(8, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetDraft = () => {
    setStepError(null);
    setDraft({
      ...DEFAULT_WIZARD_DRAFT,
      contactName: dbUser?.fullName || '',
      contactPhone: dbUser?.phone || '',
    });
    setStep(1);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  };

  const handlePublishAction = async (targetStatus: 'draft' | 'pending') => {
    setStepError(null);

    if (!idToken) {
      await signInWithGoogle();
      return;
    }

    if (targetStatus === 'pending') {
      const err = validateWizardStep(8, draft);
      if (err) {
        setStepError(err);
        return;
      }
    } else {
      const err1 = validateWizardStep(1, draft);
      const err2 = validateWizardStep(2, draft);
      if (err1 || err2) {
        setStepError(err1 || err2);
        return;
      }
    }

    const effectiveCity = draft.city === '__other__' ? draft.customCity.trim() : draft.city;
    const loc = validateUzbekistanLocation({
      country: draft.country,
      city: effectiveCity,
      district: draft.district,
      address: draft.address,
    });
    if (!loc.valid) {
      setStepError(loc.error || t.wizard.step2Hint);
      return;
    }

    const rawPrice = Math.max(1, Number(draft.priceAmount) || 1000);
    const priceUsd = convertToUsd(rawPrice, draft.priceCurrency);
    const rawMonthly = Number(draft.monthlyRentAmount) || (draft.dealType === 'rent' ? rawPrice : 0);
    const monthlyRentUsd = rawMonthly > 0 ? convertToUsd(rawMonthly, draft.priceCurrency) : 0;

    const primaryUrl =
      draft.photos.find((p) => p.id === draft.primaryPhotoId)?.url ||
      draft.photos[0]?.url ||
      '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg';

    const galleryUrls = [
      primaryUrl,
      ...draft.photos.map((p) => p.url).filter((u) => u !== primaryUrl),
    ].filter((u) => !u.startsWith('blob:'));

    const cleanRooms = draft.tourRooms.filter((r) => !r.filePath.startsWith('blob:'));
    const cleanModelUrl = draft.model3dUrl.startsWith('blob:') ? '' : draft.model3dUrl.trim();
    const cleanPanoramaUrl = draft.panoramaUrl.startsWith('blob:')
      ? ''
      : draft.panoramaUrl.trim() || cleanRooms[0]?.filePath || '';
    const cleanVirtualUrl = draft.virtualTourUrl.trim();
    const hasReal3d = Boolean(
      cleanModelUrl || cleanPanoramaUrl || cleanVirtualUrl || cleanRooms.length > 0
    );

    const payload = {
      title: draft.title.trim(),
      country: 'Uzbekistan',
      dealType: draft.dealType,
      propertyType: draft.propertyType,
      city: loc.normalizedCity,
      district: draft.district.trim(),
      address: draft.address.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      priceUsd,
      priceCurrency: draft.priceCurrency,
      originalPrice: rawPrice,
      monthlyRentUsd,
      areaSqm: Math.max(10, Number(draft.areaSqm) || 100),
      bedrooms: Number(draft.bedrooms) || 0,
      bathrooms: Number(draft.bathrooms) || 1,
      floor: Number(draft.floor) || 1,
      totalFloors: Number(draft.totalFloors) || 1,
      renovation: draft.renovation,
      furnished: draft.furnished,
      heating: draft.heating,
      airConditioning: draft.airConditioning,
      parking: draft.parking,
      balcony: draft.balcony,
      has3dTour: hasReal3d,
      tour3dLabel: draft.tour3dLabel.trim(),
      model3dUrl: cleanModelUrl,
      panoramaUrl: cleanPanoramaUrl,
      virtualTourUrl: cleanVirtualUrl,
      tourRooms: cleanRooms,
      tourHotspots: draft.tourHotspots,
      tourAutoRotate: draft.tourAutoRotate,
      tourDefaultFov: draft.tourDefaultFov,
      tourExposure: draft.tourExposure,
      imageUrl: primaryUrl.startsWith('blob:')
        ? '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg'
        : primaryUrl,
      galleryImages:
        galleryUrls.length > 0
          ? galleryUrls
          : ['/src/assets/images/prop_tashkent_apartment_1794853628562.jpg'],
      description: draft.description.trim(),
      amenities: draft.amenities,
      contactName: draft.contactName.trim(),
      contactPhone: draft.contactPhone.trim(),
      contactMethod: draft.contactMethod,
      status: targetStatus,
    };

    setSubmitting(true);
    try {
      const endpoint = draft.editingId ? `/api/properties/${draft.editingId}` : '/api/properties';
      const method = draft.editingId ? 'PATCH' : 'POST';
      const res = await apiFetch<{ property: PropertyListing }>(endpoint, {
        method,
        token: idToken,
        body: JSON.stringify(payload),
      });

      if (!isEditMode && typeof window !== 'undefined') {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      onCreated(res.property);
    } catch (err: unknown) {
      setStepError(err instanceof Error ? err.message : t.common.loadingError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#8C6D46] dark:text-[#D4B483]">
            ESTORA · {t.common.uzbekistanOnlyBadge}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl dark:text-[#F5F5F5]">
            {draft.editingId ? t.wizard.pageEditTitle : t.wizard.pageCreateTitle}
          </h1>
          <p className="mt-1.5 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.pageSubtitle} · {t.wizard.stepOf} {step} / 8
            {draft.status ? ` · ${t.common.statuses[draft.status]}` : ''}
          </p>
        </div>

        {!isEditMode && (
          <button
            type="button"
            onClick={handleResetDraft}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] border border-[#E5E4E0] bg-white px-3.5 text-xs font-medium text-[#525252] hover:text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#A0A0A0] dark:hover:text-[#F5F5F5]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.wizard.resetDraft}</span>
          </button>
        )}
      </div>

      {/* Индикатор шагов */}
      <nav aria-label={t.wizard.pageSubtitle} className="mt-6">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {WIZARD_STEPS.map((item, idx) => {
            const active = item.id === step;
            const completed = item.id < step;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    setStepError(null);
                    setStep(item.id);
                  }}
                  className={`flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-[12px] border px-2.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-[#143A30] bg-[#143A30] text-white'
                      : completed
                        ? 'border-[#143A30]/35 bg-white text-[#143A30] dark:border-[#2F6A58] dark:bg-[#1C1C1C] dark:text-[#B9E2D2]'
                        : 'border-[#E5E4E0] bg-white text-[#525252] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#A0A0A0]'
                  }`}
                >
                  <span className="font-mono">{item.id}.</span>
                  <span className="truncate">{t.wizard.steps[idx]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {loadingEdit ? (
        <div className="mt-6 h-96 animate-pulse rounded-[20px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]" />
      ) : (
        <div className="mt-6 rounded-[20px] border border-[#E5E4E0] bg-white p-5 sm:p-8 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          {step <= 4 ? (
            <WizardStepsBasic step={step} draft={draft} updateDraft={updateDraft} />
          ) : (
            <WizardStepsMedia
              step={step}
              draft={draft}
              updateDraft={updateDraft}
              submitting={submitting}
              onPublishAction={(targetStatus) => void handlePublishAction(targetStatus)}
            />
          )}

          {stepError && (
            <div
              role="alert"
              className="mt-6 rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs font-medium text-[#991B1B]"
            >
              {stepError}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E4E0] pt-6 dark:border-[#2C2C2C]">
            <button
              type="button"
              disabled={step === 1}
              onClick={handlePrev}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border border-[#E5E4E0] bg-white px-5 text-sm font-medium text-[#171717] hover:bg-[#F8F8F7] disabled:opacity-40 dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              <span>{t.wizard.prevStep}</span>
            </button>

            {step < 8 && (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] bg-[#143A30] px-6 text-sm font-medium text-white hover:bg-[#0F2C24]"
              >
                <span>
                  {t.wizard.nextStep}: {t.wizard.steps[step]}
                </span>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
