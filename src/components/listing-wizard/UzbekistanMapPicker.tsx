import { useRef, type MouseEvent } from 'react';
import { MapPin } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import {
  UZBEKISTAN_BOUNDS,
  UZBEKISTAN_CITY_COORDS,
  validateUzbekistanCoordinates,
} from '../../utils/listingWizard';

interface UzbekistanMapPickerProps {
  city: string;
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
}

const SVG_WIDTH = 640;
const SVG_HEIGHT = 320;

function coordsToSvg(lat: number, lng: number): { x: number; y: number } {
  const xRatio =
    (lng - UZBEKISTAN_BOUNDS.minLng) /
    (UZBEKISTAN_BOUNDS.maxLng - UZBEKISTAN_BOUNDS.minLng);
  const yRatio =
    1 -
    (lat - UZBEKISTAN_BOUNDS.minLat) /
      (UZBEKISTAN_BOUNDS.maxLat - UZBEKISTAN_BOUNDS.minLat);

  return {
    x: Math.max(16, Math.min(SVG_WIDTH - 16, xRatio * SVG_WIDTH)),
    y: Math.max(16, Math.min(SVG_HEIGHT - 16, yRatio * SVG_HEIGHT)),
  };
}

function svgToCoords(x: number, y: number): { lat: number; lng: number } {
  const xRatio = Math.max(0, Math.min(1, x / SVG_WIDTH));
  const yRatio = Math.max(0, Math.min(1, y / SVG_HEIGHT));

  const lng =
    UZBEKISTAN_BOUNDS.minLng +
    xRatio * (UZBEKISTAN_BOUNDS.maxLng - UZBEKISTAN_BOUNDS.minLng);
  const lat =
    UZBEKISTAN_BOUNDS.maxLat -
    yRatio * (UZBEKISTAN_BOUNDS.maxLat - UZBEKISTAN_BOUNDS.minLat);

  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
  };
}

const FEATURED_MAP_CITIES = [
  'Нукус',
  'Ургенч',
  'Бухара',
  'Самарканд',
  'Ташкент',
  'Фергана',
  'Андижан',
  'Карши',
  'Термез',
] as const;

export function UzbekistanMapPicker({
  city,
  latitude,
  longitude,
  onChange,
}: UzbekistanMapPickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { t, localizeCity } = useI18n();
  const isValidCoords = validateUzbekistanCoordinates(latitude, longitude);
  const pin = coordsToSvg(
    isValidCoords ? latitude : 41.3111,
    isValidCoords ? longitude : 69.2797
  );

  const handleMapClick = (e: MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * SVG_HEIGHT;
    const next = svgToCoords(x, y);
    onChange(next.lat, next.lng);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
          {t.wizard.mapTitle} ({t.wizard.mapHint})
        </p>
        {UZBEKISTAN_CITY_COORDS[city] && (
          <button
            type="button"
            onClick={() =>
              onChange(UZBEKISTAN_CITY_COORDS[city].lat, UZBEKISTAN_CITY_COORDS[city].lng)
            }
            className="text-xs font-medium text-[#143A30] underline underline-offset-4 hover:text-[#0F2C24] dark:text-[#D4B483]"
          >
            {t.wizard.centerOnCity} {localizeCity(city)}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#E5E4E0] bg-[#F3F2EE] dark:border-[#2C2C2C] dark:bg-[#141414]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          role="img"
          aria-label={t.wizard.mapTitle}
          onClick={handleMapClick}
          className="h-56 w-full cursor-crosshair select-none sm:h-64"
        >
          <defs>
            <pattern id="uz-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="#E5E4E0"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#uz-grid)" />

          {/* Стилизованный контур территории Узбекистана */}
          <path
            d="M 48,74 L 118,52 L 154,108 L 220,122 L 325,134 L 405,120 L 478,136 L 560,148 L 610,168 L 585,205 L 510,185 L 448,218 L 415,286 L 348,274 L 270,218 L 196,178 L 122,162 L 62,138 Z"
            fill="#FFFFFF"
            stroke="#C9C7C0"
            strokeWidth="2"
          />

          {FEATURED_MAP_CITIES.map((cityName) => {
            const c = UZBEKISTAN_CITY_COORDS[cityName];
            if (!c) return null;
            const pos = coordsToSvg(c.lat, c.lng);
            const active = cityName === city;
            return (
              <g
                key={cityName}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onChange(c.lat, c.lng);
                }}
                className="cursor-pointer"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={active ? 5 : 3.5}
                  fill={active ? '#8C6D46' : '#737373'}
                />
                <text
                  x={pos.x + 7}
                  y={pos.y + 4}
                  fontSize="11"
                  fontWeight={active ? '600' : '400'}
                  fill={active ? '#171717' : '#525252'}
                >
                  {localizeCity(cityName)}
                </text>
              </g>
            );
          })}

          {/* Выбранный пин */}
          <g transform={`translate(${pin.x}, ${pin.y})`}>
            <circle cx="0" cy="0" r="14" fill="#143A30" fillOpacity="0.18" />
            <circle cx="0" cy="0" r="6.5" fill="#143A30" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="wizard-lat" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.latLabel}
          </label>
          <input
            id="wizard-lat"
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(e) => onChange(Number(e.target.value), longitude)}
            className="mt-1.5 min-h-[42px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 font-mono text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          />
        </div>
        <div>
          <label htmlFor="wizard-lng" className="block text-xs font-medium text-[#525252] dark:text-[#A0A0A0]">
            {t.wizard.lngLabel}
          </label>
          <input
            id="wizard-lng"
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(e) => onChange(latitude, Number(e.target.value))}
            className="mt-1.5 min-h-[42px] w-full rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] px-3.5 font-mono text-sm tabular-nums text-[#171717] dark:border-[#2C2C2C] dark:bg-[#141414] dark:text-[#F5F5F5]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#525252] dark:text-[#A0A0A0]">
        <MapPin className="h-3.5 w-3.5 text-[#143A30] shrink-0 dark:text-[#D4B483]" aria-hidden="true" />
        <span className="font-mono tabular-nums">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
        <span>·</span>
        <span className={isValidCoords ? 'text-[#143A30] dark:text-[#86EFAC]' : 'text-[#991B1B] dark:text-[#FCA5A5]'}>
          {isValidCoords ? t.wizard.coordsValid : t.wizard.coordsInvalid}
        </span>
      </div>
    </div>
  );
}
