import { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Box,
  CheckCircle2,
  ChevronDown,
  Compass,
  Crosshair,
  Eye,
  Link2,
  MousePointerClick,
  RefreshCw,
  Sliders,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../lib/api';
import type { TourHotspot, TourRoom } from '../../types/estora';
import type { ListingWizardDraft } from '../../utils/listingWizard';
import {
  autoConnectRooms,
  deriveRoomNameFromFilename,
  formatBytesCompact,
  moveRoomOrder,
  removeRoomAndHotspots,
  renameRoom,
  sanitizeTourHotspots,
  validate3DModelFile,
  validatePanoramaImageFile,
} from '../../utils/tour3d';
import { readImageDimensions } from '../../utils/webglSupport';
import { Model3DCanvas } from '../tour3d/Model3DCanvas';
import { Panorama360Canvas } from '../tour3d/Panorama360Canvas';
import { Tour3DViewer } from '../Tour3DViewer';

interface Tour3DUploaderProps {
  draft: ListingWizardDraft;
  updateDraft: (patch: Partial<ListingWizardDraft>) => void;
}

export function Tour3DUploader({ draft, updateDraft }: Tour3DUploaderProps) {
  const { idToken } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const [selectedOption, setSelectedOption] = useState<'model_3d' | 'panorama_360' | 'none'>(() => {
    if (draft.tourRooms.length > 0 || draft.panoramaUrl) return 'panorama_360';
    if (draft.model3dUrl) return 'model_3d';
    return draft.tourMode;
  });
  const [uploaderOpened, setUploaderOpened] = useState<boolean>(
    () =>
      Boolean(
        draft.model3dUrl ||
          draft.panoramaUrl ||
          draft.tourRooms.length > 0 ||
          draft.virtualTourUrl ||
          draft.tourMode !== 'none'
      )
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgressLabel, setUploadProgressLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [savingTour, setSavingTour] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Room & Hotspot editor state
  const [activeRoomKey, setActiveRoomKey] = useState<string>(
    () => draft.tourRooms[0]?.roomKey ?? ''
  );
  const [placementMode, setPlacementMode] = useState(false);
  const [targetRoomKey, setTargetRoomKey] = useState<string>('');
  const [customHotspotLabel, setCustomHotspotLabel] = useState('');
  const [previewWalkMode, setPreviewWalkMode] = useState(false);

  // Track server upload asset IDs for clean deletion
  const [uploadedAssetIds, setUploadedAssetIds] = useState<Record<string, number>>({});

  const uploadToServer = async (
    file: File,
    kind: 'model3d' | 'panorama'
  ): Promise<{ url: string; assetId?: number }> => {
    if (!idToken) {
      return { url: URL.createObjectURL(file) };
    }
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const res = await apiFetch<{ asset: { id: number; url: string } }>('/api/uploads', {
      method: 'POST',
      token: idToken,
      body: formData,
    });
    return { url: res.asset.url, assetId: res.asset.id };
  };

  const handleModelFile = async (file: File) => {
    setErrorMsg(null);
    setSavedFeedback(null);
    const check = validate3DModelFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'Недопустимый файл 3D-модели.');
      return;
    }

    setUploading(true);
    setUploadProgressLabel(`Загрузка 3D-модели «${file.name}»...`);
    try {
      const { url, assetId } = await uploadToServer(file, 'model3d');
      if (assetId) {
        setUploadedAssetIds((prev) => ({ ...prev, [url]: assetId }));
      }
      setSelectedOption('model_3d');
      setUploaderOpened(true);
      updateDraft({
        tourMode: 'model_3d',
        has3dTour: true,
        model3dUrl: url,
        model3dName: file.name,
        model3dSizeBytes: file.size,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось загрузить 3D-модель.');
    } finally {
      setUploading(false);
      setUploadProgressLabel('');
    }
  };

  const handlePanoramaFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setErrorMsg(null);
    setSavedFeedback(null);
    setUploading(true);

    try {
      const addedRooms: TourRoom[] = [];
      const baseIndex = draft.tourRooms.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgressLabel(`Проверка 360°-формата (${i + 1}/${files.length}): ${file.name}`);
        const basicCheck = validatePanoramaImageFile({
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if (!basicCheck.valid) {
          throw new Error(basicCheck.error || `Файл «${file.name}» не подходит.`);
        }

        const dims = await readImageDimensions(file);
        const dimCheck = validatePanoramaImageFile({
          name: file.name,
          type: file.type,
          size: file.size,
          width: dims.width,
          height: dims.height,
        });
        if (!dimCheck.valid) {
          throw new Error(
            dimCheck.error ||
              `Фото «${file.name}» не соответствует формату 360°-панорамы 2:1.`
          );
        }

        setUploadProgressLabel(`Загрузка комнаты (${i + 1}/${files.length}): ${file.name}`);
        const { url, assetId } = await uploadToServer(file, 'panorama');
        if (assetId) {
          setUploadedAssetIds((prev) => ({ ...prev, [url]: assetId }));
        }

        const roomKey = `room-${Date.now()}-${baseIndex + i}-${Math.random().toString(36).slice(2, 6)}`;
        addedRooms.push({
          roomKey,
          roomName: deriveRoomNameFromFilename(file.name, baseIndex + i),
          roomOrder: baseIndex + addedRooms.length,
          filePath: url,
          contentType: 'panorama_360',
          processingStatus: 'ready',
          initialYaw: 0,
          initialPitch: 0,
        });
      }

      const nextRooms = [...draft.tourRooms, ...addedRooms];
      const nextHotspots =
        draft.tourRooms.length === 0 && addedRooms.length >= 2
          ? autoConnectRooms(nextRooms)
          : draft.tourHotspots;

      setSelectedOption('panorama_360');
      setUploaderOpened(true);
      setActiveRoomKey((prev) => prev || nextRooms[0]?.roomKey || '');
      updateDraft({
        tourMode: 'panorama_360',
        has3dTour: true,
        tourRooms: nextRooms,
        tourHotspots: nextHotspots,
        panoramaUrl: nextRooms[0]?.filePath || '',
        panoramaName: nextRooms[0]?.roomName || '',
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Не удалось обработать 360°-панораму.'
      );
    } finally {
      setUploading(false);
      setUploadProgressLabel('');
    }
  };

  const handleRemoveModel = async () => {
    const oldUrl = draft.model3dUrl;
    const assetId = uploadedAssetIds[oldUrl];
    if (assetId && idToken) {
      try {
        await apiFetch(`/api/uploads/${assetId}`, { method: 'DELETE', token: idToken });
      } catch {
        // Non-blocking cleanup
      }
    }
    const stillHasTour = Boolean(draft.tourRooms.length > 0 || draft.virtualTourUrl.trim());
    updateDraft({
      model3dUrl: '',
      model3dName: '',
      model3dSizeBytes: undefined,
      has3dTour: stillHasTour,
      tourMode: draft.tourRooms.length > 0 ? 'panorama_360' : 'none',
    });
  };

  const handleRemoveRoom = async (room: TourRoom) => {
    const assetId = uploadedAssetIds[room.filePath];
    if (assetId && idToken) {
      try {
        await apiFetch(`/api/uploads/${assetId}`, { method: 'DELETE', token: idToken });
      } catch {
        // Non-blocking cleanup
      }
    }
    const { rooms, hotspots } = removeRoomAndHotspots(
      draft.tourRooms,
      draft.tourHotspots,
      room.roomKey
    );
    const stillHasTour = Boolean(
      rooms.length > 0 || draft.model3dUrl.trim() || draft.virtualTourUrl.trim()
    );
    if (activeRoomKey === room.roomKey) {
      setActiveRoomKey(rooms[0]?.roomKey || '');
    }
    updateDraft({
      tourRooms: rooms,
      tourHotspots: hotspots,
      panoramaUrl: rooms[0]?.filePath || '',
      panoramaName: rooms[0]?.roomName || '',
      has3dTour: stillHasTour,
      tourMode: rooms.length > 0 ? 'panorama_360' : draft.model3dUrl ? 'model_3d' : 'none',
    });
  };

  const handleSkipWithout3d = () => {
    setErrorMsg(null);
    setSavedFeedback(t.wizard.tourSkipFeedback);
    setSelectedOption('none');
    updateDraft({
      tourMode: 'none',
      has3dTour: Boolean(draft.virtualTourUrl.trim()),
    });
  };

  const handleSave3dStep = async () => {
    setErrorMsg(null);
    setSavedFeedback(null);

    if (draft.editingId && idToken) {
      setSavingTour(true);
      try {
        await apiFetch(`/api/properties/${draft.editingId}/tour`, {
          method: 'PUT',
          token: idToken,
          body: JSON.stringify({
            model3dUrl: draft.model3dUrl.startsWith('blob:') ? '' : draft.model3dUrl,
            panoramaUrl: draft.panoramaUrl.startsWith('blob:') ? '' : draft.panoramaUrl,
            virtualTourUrl: draft.virtualTourUrl.trim(),
            tour3dLabel: draft.tour3dLabel.trim(),
            tourRooms: draft.tourRooms.filter((r) => !r.filePath.startsWith('blob:')),
            tourHotspots: sanitizeTourHotspots(draft.tourRooms, draft.tourHotspots),
            autoRotate: draft.tourAutoRotate,
            defaultFov: draft.tourDefaultFov,
            exposure: draft.tourExposure,
          }),
        });
        setSavedFeedback('3D-тур и переходы между комнатами сохранены.');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Не удалось сохранить 3D-тур.');
      } finally {
        setSavingTour(false);
      }
    } else {
      setSavedFeedback('Настройки 3D-тура сохранены в черновик объявления.');
    }
  };

  const currentRoom =
    draft.tourRooms.find((r) => r.roomKey === activeRoomKey) ?? draft.tourRooms[0] ?? null;
  const otherRooms = currentRoom
    ? draft.tourRooms.filter((r) => r.roomKey !== currentRoom.roomKey)
    : [];
  const effectiveTargetRoomKey =
    otherRooms.find((r) => r.roomKey === targetRoomKey)?.roomKey ?? otherRooms[0]?.roomKey ?? '';

  const handlePlaceHotspotOnSphere = (yaw: number, pitch: number) => {
    if (!currentRoom || !effectiveTargetRoomKey) return;
    const targetRoom = draft.tourRooms.find((r) => r.roomKey === effectiveTargetRoomKey);
    const label = customHotspotLabel.trim() || targetRoom?.roomName || 'Переход';
    const nextHotspot: TourHotspot = {
      fromRoomKey: currentRoom.roomKey,
      targetRoomKey: effectiveTargetRoomKey,
      label,
      yaw,
      pitch,
    };
    updateDraft({
      tourHotspots: [...draft.tourHotspots, nextHotspot],
    });
    setCustomHotspotLabel('');
    setPlacementMode(false);
    setSavedFeedback(`Добавлен переход из «${currentRoom.roomName}» в «${label}».`);
  };

  const onDropModel = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handleModelFile(file);
  };

  const onDropPanoramas = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void handlePanoramaFiles(files);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {t.wizard.stepOf} 6 — {t.wizard.steps[5]}
          </h2>
          <p className="mt-1 text-sm text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.step6Hint}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setUploaderOpened(true);
            if (selectedOption === 'none') {
              setSelectedOption('panorama_360');
            }
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[14px] bg-[#143A30] px-5 text-sm font-medium text-white hover:bg-[#0F2C24]"
        >
          <Sparkles className="h-4 w-4 text-[#D4B483]" aria-hidden="true" />
          <span>{t.wizard.tourAddBtn}</span>
        </button>
      </div>

      {/* 5-step simple guide */}
      <ol
        aria-label={t.wizard.tourAddBtn}
        className="grid grid-cols-1 gap-2 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 text-xs sm:grid-cols-5 dark:border-[#2C2C2C] dark:bg-[#141414]"
      >
        {t.wizard.tourGuideSteps.map((label) => (
          <li
            key={label}
            className="flex items-center rounded-[10px] bg-white px-3 py-2 font-medium text-[#171717] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
          >
            {label}
          </li>
        ))}
      </ol>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs font-medium text-[#991B1B]"
        >
          {errorMsg}
        </div>
      )}

      {savedFeedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[14px] border border-[#143A30]/30 bg-[#F3F7F5] p-3.5 text-xs font-medium text-[#143A30] dark:border-[#2F6A58] dark:bg-[#162721] dark:text-[#B9E2D2]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{savedFeedback}</span>
        </div>
      )}

      {/* 3 Simple Options */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => {
            setUploaderOpened(true);
            setSelectedOption('model_3d');
          }}
          className={`flex flex-col items-start rounded-[18px] border p-5 text-start transition-colors ${
            uploaderOpened && selectedOption === 'model_3d'
              ? 'border-[#143A30] bg-[#F3F7F5] ring-1 ring-[#143A30] dark:border-[#D4B483] dark:bg-[#1C231F] dark:ring-[#D4B483]'
              : 'border-[#E5E4E0] bg-white hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
            <Box className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
            <span>{t.wizard.tourOptATitle}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.tourOptADesc}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setUploaderOpened(true);
            setSelectedOption('panorama_360');
          }}
          className={`flex flex-col items-start rounded-[18px] border p-5 text-start transition-colors ${
            uploaderOpened && selectedOption === 'panorama_360'
              ? 'border-[#143A30] bg-[#F3F7F5] ring-1 ring-[#143A30] dark:border-[#D4B483] dark:bg-[#1C231F] dark:ring-[#D4B483]'
              : 'border-[#E5E4E0] bg-white hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
            <Compass className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
            <span>{t.wizard.tourOptBTitle}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.tourOptBDesc}
          </p>
        </button>

        <button
          type="button"
          onClick={handleSkipWithout3d}
          className={`flex flex-col items-start rounded-[18px] border p-5 text-start transition-colors ${
            selectedOption === 'none'
              ? 'border-[#8C6D46] bg-[#FAF8F4] ring-1 ring-[#8C6D46] dark:border-[#D4B483] dark:bg-[#23201A] dark:ring-[#D4B483]'
              : 'border-[#E5E4E0] bg-white hover:border-[#8C6D46] dark:border-[#2C2C2C] dark:bg-[#1C1C1C]'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
            <CheckCircle2 className="h-4 w-4 text-[#8C6D46] dark:text-[#D4B483]" aria-hidden="true" />
            <span>{t.wizard.tourOptCTitle}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.tourOptCDesc}
          </p>
        </button>
      </div>

      {/* Option A — GLB / GLTF Uploader & Automatic Live Preview */}
      {uploaderOpened && selectedOption === 'model_3d' && (
        <div className="space-y-5 rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropModel}
            className="rounded-[16px] border border-dashed border-[#C9C7C0] bg-white p-6 text-center dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
          >
            <UploadCloud className="mx-auto h-8 w-8 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
              {t.wizard.tourDropModelTitle}
            </p>
            <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.tourDropModelHint}
            </p>

            <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[14px] bg-[#143A30] px-5 text-sm font-medium text-white hover:bg-[#0F2C24]">
              <Box className="h-4 w-4" aria-hidden="true" />
              <span>
                {uploading
                  ? uploadProgressLabel || t.common.updating
                  : draft.model3dUrl
                    ? t.wizard.tourReplaceFile
                    : t.wizard.tourChooseFile}
              </span>
              <input
                type="file"
                accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleModelFile(f);
                }}
                className="sr-only"
              />
            </label>
          </div>

          {draft.model3dUrl && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E5E4E0] bg-white px-4 py-3 text-xs dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                  <span className="font-mono font-medium text-[#171717] dark:text-[#F5F5F5]">
                    {draft.model3dName || 'model.glb'}
                  </span>
                  {draft.model3dSizeBytes && (
                    <span className="text-[#737373] dark:text-[#A0A0A0]">
                      ({formatBytesCompact(draft.model3dSizeBytes)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-[10px] border border-[#E5E4E0] px-3 font-medium text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:text-[#F5F5F5]">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.wizard.tourReplaceFile}</span>
                    <input
                      type="file"
                      accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void handleModelFile(f);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleRemoveModel()}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-[10px] border border-[#FCA5A5] px-3 font-medium text-[#991B1B] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.common.delete}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[16px] border border-[#E5E4E0] bg-[#111111] dark:border-[#2C2C2C]">
                <div className="border-b border-white/10 px-4 py-2.5 text-xs font-medium text-white/85">
                  {t.wizard.tourModelPreviewTitle}
                </div>
                <div className="aspect-[16/9] min-h-[300px] w-full">
                  <Model3DCanvas
                    modelUrl={draft.model3dUrl}
                    propertyId={draft.editingId ?? undefined}
                    title={draft.title}
                    imageUrl={
                      draft.photos.find((p) => p.id === draft.primaryPhotoId)?.url ||
                      draft.photos[0]?.url
                    }
                    propertyType={draft.propertyType}
                    totalFloors={Number(draft.totalFloors) || undefined}
                    description={draft.description}
                    amenities={JSON.stringify(draft.amenities)}
                    galleryImages={draft.photos.map((p) => p.url)}
                    autoRotate={draft.tourAutoRotate}
                    exposure={draft.tourExposure}
                    isDarkTheme={theme === 'dark'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Option B — Multi-Room 360° Panorama Uploader + Visual Room Connector */}
      {uploaderOpened && selectedOption === 'panorama_360' && (
        <div className="space-y-6 rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-5 dark:border-[#2C2C2C] dark:bg-[#141414]">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropPanoramas}
            className="rounded-[16px] border border-dashed border-[#C9C7C0] bg-white p-6 text-center dark:border-[#2C2C2C] dark:bg-[#1C1C1C]"
          >
            <UploadCloud className="mx-auto h-8 w-8 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
              {t.wizard.tourDropPanoTitle}
            </p>
            <p className="mt-1 text-xs text-[#525252] dark:text-[#A0A0A0]">
              {t.wizard.tourDropPanoHint}
            </p>

            <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[14px] bg-[#143A30] px-5 text-sm font-medium text-white hover:bg-[#0F2C24]">
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>
                {uploading ? uploadProgressLabel || t.common.updating : t.wizard.tourChoosePanos}
              </span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  if (files.length > 0) void handlePanoramaFiles(files);
                }}
                className="sr-only"
              />
            </label>
          </div>

          {draft.tourRooms.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#171717] dark:text-[#F5F5F5]">
                  {t.wizard.tourRoomsHeading} ({draft.tourRooms.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.tourRooms.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const generated = autoConnectRooms(draft.tourRooms);
                        updateDraft({ tourHotspots: generated });
                        setSavedFeedback(`${t.wizard.tourRoomsHeading}: ${draft.tourRooms.length}`);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] border border-[#E5E4E0] bg-white px-3.5 text-xs font-medium text-[#171717] hover:border-[#143A30] dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]"
                    >
                      <Link2 className="h-3.5 w-3.5 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
                      <span>{t.wizard.tourAutoConnectBtn}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewWalkMode((prev) => !prev);
                      setPlacementMode(false);
                    }}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] px-3.5 text-xs font-medium transition-colors ${
                      previewWalkMode
                        ? 'bg-[#D4B483] text-[#171717]'
                        : 'bg-[#143A30] text-white hover:bg-[#0F2C24]'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {previewWalkMode ? t.wizard.tourEditRoomsBtn : t.wizard.tourTestModeBtn}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {draft.tourRooms.map((room, index) => {
                  const isActive = room.roomKey === currentRoom?.roomKey;
                  return (
                    <div
                      key={room.roomKey}
                      className={`flex flex-wrap items-center gap-3 rounded-[14px] border p-3 transition-colors ${
                        isActive
                          ? 'border-[#143A30] bg-white ring-1 ring-[#143A30] dark:border-[#D4B483] dark:bg-[#242424] dark:ring-[#D4B483]'
                          : 'border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveRoomKey(room.roomKey)}
                        className="h-12 w-20 shrink-0 overflow-hidden rounded-[8px] border border-[#E5E4E0] bg-[#111111] dark:border-[#2C2C2C]"
                        title={room.roomName}
                      >
                        <img
                          src={room.filePath}
                          alt={room.roomName}
                          className="h-full w-full object-cover"
                        />
                      </button>

                      <div className="min-w-[180px] flex-1">
                        <label className="sr-only" htmlFor={`room-name-${room.roomKey}`}>
                          {room.roomName}
                        </label>
                        <input
                          id={`room-name-${room.roomKey}`}
                          type="text"
                          value={room.roomName}
                          onChange={(e) =>
                            updateDraft({
                              tourRooms: renameRoom(draft.tourRooms, room.roomKey, e.target.value),
                            })
                          }
                          className="min-h-[38px] w-full rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-sm font-medium text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveRoomKey(room.roomKey)}
                          className={`inline-flex min-h-[36px] items-center rounded-[10px] px-3 text-xs font-medium ${
                            isActive
                              ? 'bg-[#143A30] text-white'
                              : 'border border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] dark:border-[#2C2C2C] dark:bg-[#242424] dark:text-[#F5F5F5]'
                          }`}
                        >
                          {isActive ? t.wizard.tourSelectedBtn : t.wizard.tourPreviewBtn}
                        </button>

                        <button
                          type="button"
                          disabled={index === 0}
                          aria-label={`${t.wizard.prevStep}: ${room.roomName}`}
                          onClick={() =>
                            updateDraft({ tourRooms: moveRoomOrder(draft.tourRooms, index, -1) })
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E4E0] text-[#171717] disabled:opacity-35 dark:border-[#2C2C2C] dark:text-[#F5F5F5]"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={index === draft.tourRooms.length - 1}
                          aria-label={`${t.wizard.nextStep}: ${room.roomName}`}
                          onClick={() =>
                            updateDraft({ tourRooms: moveRoomOrder(draft.tourRooms, index, 1) })
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E4E0] text-[#171717] disabled:opacity-35 dark:border-[#2C2C2C] dark:text-[#F5F5F5]"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${t.common.delete}: ${room.roomName}`}
                          onClick={() => void handleRemoveRoom(room)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#FCA5A5] text-[#991B1B] hover:bg-[#FEF2F2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {previewWalkMode ? (
                <Tour3DViewer
                  title={draft.title || t.tour3d.tabPanorama}
                  label={draft.tour3dLabel || t.tour3d.tabPanorama}
                  propertyId={draft.editingId ?? undefined}
                  propertyType={draft.propertyType}
                  totalFloors={Number(draft.totalFloors) || undefined}
                  description={draft.description}
                  amenities={JSON.stringify(draft.amenities)}
                  galleryImages={draft.photos.map((p) => p.url)}
                  imageUrl={
                    draft.photos.find((p) => p.id === draft.primaryPhotoId)?.url ||
                    draft.photos[0]?.url
                  }
                  tourRooms={draft.tourRooms}
                  tourHotspots={draft.tourHotspots}
                  model3dUrl={draft.model3dUrl}
                  virtualTourUrl={draft.virtualTourUrl}
                  tourConfig={{
                    contentType: 'panorama_360',
                    autoRotate: draft.tourAutoRotate,
                    defaultFov: draft.tourDefaultFov,
                    exposure: draft.tourExposure,
                  }}
                />
              ) : (
                currentRoom && (
                  <div className="space-y-4 rounded-[16px] border border-[#E5E4E0] bg-white p-4 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
                          {t.wizard.tourConnectTitle} {currentRoom.roomName}
                        </h4>
                        <p className="text-xs text-[#525252] dark:text-[#A0A0A0]">
                          {otherRooms.length > 0
                            ? t.wizard.tourConnectHint
                            : t.wizard.tourConnectNeedMore}
                        </p>
                      </div>
                    </div>

                    {otherRooms.length > 0 && (
                      <div className="grid grid-cols-1 gap-3 rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3.5 md:grid-cols-12 md:items-end dark:border-[#2C2C2C] dark:bg-[#141414]">
                        <div className="md:col-span-4">
                          <label
                            htmlFor="connector-target-room"
                            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                          >
                            {t.wizard.tourTargetRoomLabel}
                          </label>
                          <select
                            id="connector-target-room"
                            value={effectiveTargetRoomKey}
                            onChange={(e) => setTargetRoomKey(e.target.value)}
                            className="mt-1 min-h-[40px] w-full rounded-[10px] border border-[#E5E4E0] bg-white px-3 text-xs text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                          >
                            {otherRooms.map((r) => (
                              <option key={r.roomKey} value={r.roomKey}>
                                {r.roomName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-4">
                          <label
                            htmlFor="connector-label"
                            className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]"
                          >
                            {t.wizard.tourArrowLabel}
                          </label>
                          <input
                            id="connector-label"
                            type="text"
                            value={customHotspotLabel}
                            onChange={(e) => setCustomHotspotLabel(e.target.value)}
                            placeholder={t.wizard.tourArrowPlaceholder}
                            className="mt-1 min-h-[40px] w-full rounded-[10px] border border-[#E5E4E0] bg-white px-3 text-xs text-[#171717] dark:border-[#2C2C2C] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <button
                            type="button"
                            onClick={() => setPlacementMode((prev) => !prev)}
                            className={`inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-xs font-medium transition-colors ${
                              placementMode
                                ? 'bg-[#D4B483] text-[#171717]'
                                : 'bg-[#143A30] text-white hover:bg-[#0F2C24]'
                            }`}
                          >
                            {placementMode ? (
                              <>
                                <Crosshair className="h-4 w-4" aria-hidden="true" />
                                <span>{t.wizard.tourClickPanoBtn}</span>
                              </>
                            ) : (
                              <>
                                <MousePointerClick className="h-4 w-4" aria-hidden="true" />
                                <span>{t.wizard.tourPlacePointBtn}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="aspect-[16/9] min-h-[300px] w-full overflow-hidden rounded-[14px] border border-[#E5E4E0] bg-[#111111] dark:border-[#2C2C2C]">
                      <Panorama360Canvas
                        imageUrl={currentRoom.filePath}
                        hotspots={draft.tourHotspots.filter(
                          (h) => h.fromRoomKey === currentRoom.roomKey
                        )}
                        defaultFov={draft.tourDefaultFov}
                        placementMode={placementMode}
                        onPlaceHotspot={handlePlaceHotspotOnSphere}
                        onHotspotClick={(h) => setActiveRoomKey(h.targetRoomKey)}
                      />
                    </div>

                    {draft.tourHotspots.some((h) => h.fromRoomKey === currentRoom.roomKey) && (
                      <div>
                        <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                          {t.wizard.tourTransitionsFrom} «{currentRoom.roomName}»:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {draft.tourHotspots.map((hotspot, hIdx) => {
                            if (hotspot.fromRoomKey !== currentRoom.roomKey) return null;
                            const target = draft.tourRooms.find(
                              (r) => r.roomKey === hotspot.targetRoomKey
                            );
                            return (
                              <div
                                key={`${hotspot.fromRoomKey}-${hotspot.targetRoomKey}-${hIdx}`}
                                className="inline-flex items-center gap-2 rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 py-1.5 text-xs dark:border-[#2C2C2C] dark:bg-[#141414]"
                              >
                                <span className="font-medium text-[#171717] dark:text-[#F5F5F5]">
                                  {hotspot.label} → {target?.roomName || 'Room'}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`${t.common.delete}: ${hotspot.label}`}
                                  onClick={() =>
                                    updateDraft({
                                      tourHotspots: draft.tourHotspots.filter((_, i) => i !== hIdx),
                                    })
                                  }
                                  className="text-[#991B1B] hover:opacity-80"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Additional Settings */}
      <div className="rounded-[16px] border border-[#E5E4E0] bg-white dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 px-5 py-3 text-start text-sm font-medium text-[#171717] dark:text-[#F5F5F5]"
        >
          <span className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#8C6D46]" aria-hidden="true" />
            <span>{t.wizard.tourAdvancedBtn}</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-1 gap-4 border-t border-[#E5E4E0] p-5 sm:grid-cols-2 dark:border-[#2C2C2C]">
            <div>
              <label htmlFor="wiz-tour-label" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.wizard.tourLabelInput}
              </label>
              <input
                id="wiz-tour-label"
                type="text"
                value={draft.tour3dLabel}
                onChange={(e) => updateDraft({ tour3dLabel: e.target.value })}
                placeholder="360° Penthouse Tour"
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label htmlFor="wiz-tour-url" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.wizard.tourUrlInput}
              </label>
              <input
                id="wiz-tour-url"
                type="url"
                value={draft.virtualTourUrl}
                onChange={(e) =>
                  updateDraft({
                    virtualTourUrl: e.target.value,
                    has3dTour: Boolean(
                      e.target.value.trim() ||
                        draft.model3dUrl ||
                        draft.panoramaUrl ||
                        draft.tourRooms.length > 0
                    ),
                  })
                }
                placeholder="https://my.matterport.com/show/?m=..."
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 text-sm dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label htmlFor="wiz-tour-fov" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.wizard.tourFovLabel} <span className="font-mono">{draft.tourDefaultFov}°</span>
              </label>
              <input
                id="wiz-tour-fov"
                type="range"
                min={55}
                max={95}
                step={1}
                value={draft.tourDefaultFov}
                onChange={(e) => updateDraft({ tourDefaultFov: Number(e.target.value) })}
                className="mt-2.5 w-full accent-[#143A30]"
              />
            </div>

            <div>
              <label htmlFor="wiz-tour-exposure" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
                {t.wizard.tourExposureLabel} <span className="font-mono">{draft.tourExposure.toFixed(2)}</span>
              </label>
              <input
                id="wiz-tour-exposure"
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={draft.tourExposure}
                onChange={(e) => updateDraft({ tourExposure: Number(e.target.value) })}
                className="mt-2.5 w-full accent-[#143A30]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex min-h-[42px] cursor-pointer items-center gap-3 text-sm text-[#171717] dark:text-[#F5F5F5]">
                <input
                  type="checkbox"
                  checked={draft.tourAutoRotate}
                  onChange={(e) => updateDraft({ tourAutoRotate: e.target.checked })}
                  className="h-4 w-4 accent-[#143A30]"
                />
                <span>{t.wizard.tourAutoRotateLabel}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Explicit Save Step 6 action */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#E5E4E0] bg-[#F8F8F7] px-5 py-3.5 dark:border-[#2C2C2C] dark:bg-[#141414]">
        <span className="text-xs text-[#525252] dark:text-[#A0A0A0]">
          {draft.tourRooms.length > 0
            ? `${t.wizard.tourSummaryRooms} ${draft.tourRooms.length} (${draft.tourHotspots.length})`
            : draft.model3dUrl
              ? `${t.wizard.tourSummaryModel} ${draft.model3dName}`
              : t.wizard.tourSummaryNone}
        </span>
        <button
          type="button"
          disabled={savingTour}
          onClick={() => void handleSave3dStep()}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] bg-[#143A30] px-4 text-xs font-medium text-white hover:bg-[#0F2C24] disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{savingTour ? t.common.saving : t.common.save}</span>
        </button>
      </div>
    </div>
  );
}
