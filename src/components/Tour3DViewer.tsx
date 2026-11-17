import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Box,
  Compass,
  ExternalLink,
  Layers,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import type { Tour3DConfig, TourHotspot, TourRoom } from '../types/estora';
import { hasReal3dContent } from '../utils/tour3d';
import { Model3DCanvas, type Model3DCanvasControls } from './tour3d/Model3DCanvas';
import { Panorama360Canvas, type Panorama360Controls } from './tour3d/Panorama360Canvas';

type ViewerTab = 'panorama' | 'model' | 'virtual';

interface Tour3DViewerProps {
  title: string;
  label?: string;
  propertyId?: number;
  propertyType?: string;
  totalFloors?: number;
  description?: string;
  amenities?: string;
  galleryImages?: string[];
  imageUrl?: string;
  model3dUrl?: string;
  panoramaUrl?: string;
  virtualTourUrl?: string;
  tourConfig?: Tour3DConfig | null;
  tourRooms?: TourRoom[];
  tourHotspots?: TourHotspot[];
}

export function Tour3DViewer({
  title,
  label,
  propertyId,
  propertyType,
  totalFloors,
  description,
  amenities,
  galleryImages,
  imageUrl,
  model3dUrl = '',
  panoramaUrl = '',
  virtualTourUrl = '',
  tourConfig,
  tourRooms = [],
  tourHotspots = [],
}: Tour3DViewerProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaControlsRef = useRef<Panorama360Controls | null>(null);
  const modelControlsRef = useRef<Model3DCanvasControls | null>(null);

  const normalizedRooms = useMemo<TourRoom[]>(() => {
    const sorted = [...tourRooms]
      .filter((r) => typeof r.filePath === 'string' && r.filePath.trim().length > 0)
      .sort((a, b) => a.roomOrder - b.roomOrder);

    if (sorted.length > 0) return sorted;
    if (panoramaUrl.trim()) {
      return [
        {
          roomKey: 'primary-panorama',
          roomName: t.tour3d.tabPanorama,
          roomOrder: 0,
          filePath: panoramaUrl.trim(),
          initialYaw: 0,
          initialPitch: 0,
        },
      ];
    }
    return [];
  }, [tourRooms, panoramaUrl, t.tour3d.tabPanorama]);

  const hasPanorama = normalizedRooms.length > 0;
  const hasModel = Boolean(model3dUrl.trim());
  const hasVirtual = Boolean(virtualTourUrl.trim());
  const hasAny3d = hasReal3dContent({
    model3dUrl,
    panoramaUrl,
    virtualTourUrl,
    tourRooms: normalizedRooms,
  });

  const [activeTab, setActiveTab] = useState<ViewerTab>(() => {
    if (hasModel) return 'model';
    if (hasPanorama) return 'panorama';
    return 'virtual';
  });

  useEffect(() => {
    if (hasModel) {
      setActiveTab('model');
    } else if (hasPanorama) {
      setActiveTab('panorama');
    } else if (hasVirtual) {
      setActiveTab('virtual');
    }
  }, [hasPanorama, hasModel, hasVirtual, title]);

  const [activeRoomKey, setActiveRoomKey] = useState<string>(
    normalizedRooms[0]?.roomKey ?? ''
  );
  const [roomHistory, setRoomHistory] = useState<string[]>([]);
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(Boolean(tourConfig?.autoRotate));
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setRoomHistory([]);
    if (normalizedRooms.length > 0) {
      if (!normalizedRooms.some((r) => r.roomKey === activeRoomKey)) {
        setActiveRoomKey(normalizedRooms[0].roomKey);
      }
    } else {
      setActiveRoomKey('');
    }
  }, [normalizedRooms, activeRoomKey]);

  useEffect(() => {
    setAutoRotate(Boolean(tourConfig?.autoRotate));
  }, [tourConfig?.autoRotate]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!hasAny3d) {
    return (
      <div className="rounded-[18px] border border-[#E5E4E0] bg-[#F8F8F7] p-6 text-center dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <Compass className="mx-auto h-7 w-7 text-[#8C6D46]" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-[#171717] dark:text-[#F5F5F5]">
          {t.detail.tourAvailableVirtual}
        </p>
      </div>
    );
  }

  const currentRoom =
    normalizedRooms.find((r) => r.roomKey === activeRoomKey) ?? normalizedRooms[0] ?? null;

  const currentHotspots = currentRoom
    ? tourHotspots.filter((h) => h.fromRoomKey === currentRoom.roomKey)
    : [];

  const adjacentPreloadUrls = currentRoom
    ? Array.from(
        new Set(
          currentHotspots
            .map((h) => normalizedRooms.find((r) => r.roomKey === h.targetRoomKey)?.filePath)
            .filter((u): u is string => Boolean(u))
        )
      )
    : [];

  const navigateToRoom = (targetKey: string, pushHistory = true) => {
    if (!targetKey || targetKey === currentRoom?.roomKey) return;
    if (pushHistory && currentRoom?.roomKey) {
      setRoomHistory((prev) => [...prev.slice(-14), currentRoom.roomKey]);
    }
    setActiveRoomKey(targetKey);
    setRoomsDrawerOpen(false);
  };

  const handleGoBackRoom = () => {
    if (roomHistory.length === 0) return;
    const prevKey = roomHistory[roomHistory.length - 1];
    setRoomHistory((prev) => prev.slice(0, -1));
    if (normalizedRooms.some((r) => r.roomKey === prevKey)) {
      setActiveRoomKey(prevKey);
    }
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen permissions failure in restricted frames
    }
  };

  const isDarkViewer = theme === 'dark';

  const handleZoomIn = () => {
    if (activeTab === 'panorama') panoramaControlsRef.current?.zoomIn();
    if (activeTab === 'model') modelControlsRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    if (activeTab === 'panorama') panoramaControlsRef.current?.zoomOut();
    if (activeTab === 'model') modelControlsRef.current?.zoomOut();
  };

  const handleResetView = () => {
    if (activeTab === 'panorama') panoramaControlsRef.current?.resetView();
    if (activeTab === 'model') modelControlsRef.current?.resetView();
  };

  return (
    <div
      ref={containerRef}
      data-testid="tour-3d-viewer"
      className="flex flex-col overflow-hidden rounded-[18px] border border-[#E5E4E0] bg-[#141414] text-white shadow-sm dark:border-[#2C2C2C]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1C1C1C] px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-[#D4B483]">
            {activeTab === 'model' ? (
              <Box className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate font-medium">
              {label || `${t.tour3d.tabPanorama} · ${title}`}
            </span>
          </div>
          {activeTab === 'panorama' && currentRoom && (
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {t.tour3d.currentRoom}: <span className="text-[#D4B483]">{currentRoom.roomName}</span>
            </p>
          )}
          {activeTab === 'model' && (
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {t.tour3d.tabModel} · {title}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Number(hasPanorama) + Number(hasModel) + Number(hasVirtual)) > 1 && (
            <div
              role="tablist"
              aria-label={t.tour3d.tabPanorama}
              className="inline-flex items-center gap-1 rounded-[12px] border border-white/15 bg-black/30 p-1"
            >
              {hasPanorama && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'panorama'}
                  onClick={() => setActiveTab('panorama')}
                  className={`min-h-[36px] rounded-[9px] px-3 text-xs font-medium transition-colors ${
                    activeTab === 'panorama'
                      ? 'bg-[#D4B483] text-[#171717]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t.tour3d.tabPanorama}
                </button>
              )}
              {hasModel && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'model'}
                  onClick={() => setActiveTab('model')}
                  className={`min-h-[36px] rounded-[9px] px-3 text-xs font-medium transition-colors ${
                    activeTab === 'model'
                      ? 'bg-[#D4B483] text-[#171717]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t.tour3d.tabModel}
                </button>
              )}
              {hasVirtual && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'virtual'}
                  onClick={() => setActiveTab('virtual')}
                  className={`min-h-[36px] rounded-[9px] px-3 text-xs font-medium transition-colors ${
                    activeTab === 'virtual'
                      ? 'bg-[#D4B483] text-[#171717]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t.tour3d.tabVirtual}
                </button>
              )}
            </div>
          )}

          <a
            href="/design"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/design');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            data-testid="open-4k-studio-from-viewer"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[12px] bg-[#D4B483] px-3 text-xs font-semibold text-[#171717] hover:bg-[#e3c699]"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Конструктор интерьера 4K</span>
          </a>

          <button
            type="button"
            aria-label={t.tour3d.themeToggle}
            onClick={toggleTheme}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-white/15 bg-white/5 text-white hover:bg-white/15 sm:min-h-[38px] sm:min-w-[38px]"
            title={t.tour3d.themeToggle}
          >
            {isDarkViewer ? (
              <Sun className="h-4 w-4 text-[#D4B483]" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            aria-label={isFullscreen ? t.tour3d.fullscreenExit : t.tour3d.fullscreenEnter}
            onClick={() => void toggleFullscreen()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-white/15 bg-white/5 text-white hover:bg-white/15 sm:min-h-[38px] sm:min-w-[38px]"
            title={isFullscreen ? t.tour3d.fullscreenExit : t.tour3d.fullscreenEnter}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div
        className={`relative w-full overflow-hidden bg-[#111111] ${
          isFullscreen ? 'flex-1 min-h-[65vh]' : 'h-[420px] sm:h-[540px]'
        }`}
      >
        {activeTab === 'panorama' && currentRoom && (
          <Panorama360Canvas
            imageUrl={currentRoom.filePath}
            preloadUrls={adjacentPreloadUrls}
            hotspots={currentHotspots}
            initialYaw={currentRoom.initialYaw ?? 0}
            initialPitch={currentRoom.initialPitch ?? 0}
            defaultFov={tourConfig?.defaultFov ?? 75}
            autoRotate={autoRotate}
            controlsApiRef={panoramaControlsRef}
            onHotspotClick={(hotspot) => navigateToRoom(hotspot.targetRoomKey, true)}
          />
        )}

        {activeTab === 'model' && hasModel && (
          <Model3DCanvas
            modelUrl={model3dUrl}
            propertyId={propertyId}
            title={title}
            imageUrl={imageUrl}
            propertyType={propertyType}
            totalFloors={totalFloors}
            description={description}
            amenities={amenities}
            galleryImages={galleryImages}
            autoRotate={autoRotate}
            exposure={tourConfig?.exposure ?? 1.05}
            isDarkTheme={isDarkViewer}
            controlsApiRef={modelControlsRef}
          />
        )}

        {activeTab === 'virtual' && hasVirtual && (
          <div className="relative h-full w-full bg-[#111111]">
            <iframe
              src={virtualTourUrl}
              title={`${t.tour3d.tabVirtual}: ${title}`}
              allowFullScreen
              className="h-full w-full border-0"
            />
            <a
              href={virtualTourUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute end-4 top-4 inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-white/25 bg-[#143A30] px-3.5 text-xs font-medium text-white shadow-md hover:bg-[#0F2C24]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.tour3d.openExternal}</span>
            </a>
          </div>
        )}

        {activeTab === 'panorama' && roomsDrawerOpen && normalizedRooms.length > 0 && (
          <div
            role="region"
            aria-label={t.tour3d.roomsBtn}
            className="absolute bottom-3 start-3 top-3 z-20 flex w-64 max-w-[82vw] flex-col rounded-[16px] border border-white/15 bg-[#1C1C1C] p-3 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-semibold text-white">
                {t.tour3d.roomsBtn} ({normalizedRooms.length})
              </span>
              <button
                type="button"
                onClick={() => setRoomsDrawerOpen(false)}
                className="rounded-[8px] px-2 py-1 text-xs text-white/75 hover:bg-white/10 hover:text-white"
              >
                {t.common.close}
              </button>
            </div>
            <ul className="mt-2 flex-1 space-y-1.5 overflow-y-auto pe-1">
              {normalizedRooms.map((room, idx) => {
                const isActive = room.roomKey === currentRoom?.roomKey;
                return (
                  <li key={room.roomKey}>
                    <button
                      type="button"
                      onClick={() => navigateToRoom(room.roomKey, true)}
                      className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-3 text-start text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#D4B483] text-[#171717]'
                          : 'bg-white/5 text-white/90 hover:bg-white/15'
                      }`}
                    >
                      <span className="font-mono opacity-75">{idx + 1}.</span>
                      <span className="truncate">{room.roomName}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 bg-[#1C1C1C] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'panorama' && (
              <>
                <button
                  type="button"
                  disabled={roomHistory.length === 0}
                  onClick={handleGoBackRoom}
                  aria-label={t.tour3d.prevRoom}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border border-white/15 bg-white/5 px-3 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-40 sm:min-h-[38px]"
                >
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  <span>{t.tour3d.prevRoom}</span>
                </button>

                {normalizedRooms.length > 1 && (
                  <button
                    type="button"
                    aria-expanded={roomsDrawerOpen}
                    onClick={() => setRoomsDrawerOpen((prev) => !prev)}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border px-3 text-xs font-medium transition-colors sm:min-h-[38px] ${
                      roomsDrawerOpen
                        ? 'border-[#D4B483] bg-[#D4B483] text-[#171717]'
                        : 'border-white/15 bg-white/5 text-white hover:bg-white/15'
                    }`}
                  >
                    <Layers className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {t.tour3d.roomsBtn} ({normalizedRooms.length})
                    </span>
                  </button>
                )}
              </>
            )}

            <span className="hidden text-xs text-white/60 md:inline">{t.tour3d.dragHint}</span>
          </div>

          {activeTab !== 'virtual' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t.tour3d.zoomOut}
                onClick={handleZoomOut}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-white/15 bg-white/5 text-white hover:bg-white/15 sm:min-h-[38px] sm:min-w-[38px]"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t.tour3d.zoomIn}
                onClick={handleZoomIn}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-white/15 bg-white/5 text-white hover:bg-white/15 sm:min-h-[38px] sm:min-w-[38px]"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t.tour3d.resetView}
                onClick={handleResetView}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-white/15 bg-white/5 text-white hover:bg-white/15 sm:min-h-[38px] sm:min-w-[38px]"
                title={t.tour3d.resetView}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setAutoRotate((prev) => !prev)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border px-3 text-xs font-medium transition-colors sm:min-h-[38px] ${
                  autoRotate
                    ? 'border-[#D4B483] bg-[#D4B483] text-[#171717]'
                    : 'border-white/15 bg-white/5 text-white hover:bg-white/15'
                }`}
              >
                {autoRotate ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{t.tour3d.autoRotate}</span>
              </button>
            </div>
          )}
        </div>

        {activeTab === 'panorama' && normalizedRooms.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {normalizedRooms.map((room, idx) => {
              const active = room.roomKey === currentRoom?.roomKey;
              return (
                <button
                  key={room.roomKey}
                  type="button"
                  onClick={() => navigateToRoom(room.roomKey, true)}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#D4B483] text-[#171717]'
                      : 'bg-white/10 text-white/85 hover:bg-white/20'
                  }`}
                >
                  <span className="font-mono opacity-75">{idx + 1}.</span>
                  <span>{room.roomName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
