import type { PropertyListing, Tour3DConfig, TourHotspot, TourRoom } from '../types/estora.ts';

export const MAX_3D_MODEL_BYTES = 25 * 1024 * 1024;
export const MAX_PANORAMA_BYTES = 15 * 1024 * 1024;
export const PANORAMA_ASPECT_RATIO = 2;
export const PANORAMA_RATIO_TOLERANCE = 0.12;

export function formatBytesCompact(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function isValidPanoramaAspectRatio(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  const ratio = width / height;
  return Math.abs(ratio - PANORAMA_ASPECT_RATIO) <= PANORAMA_RATIO_TOLERANCE;
}

export function validate3DModelFile(file: {
  name: string;
  type?: string;
  size: number;
}): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.glb') && !lowerName.endsWith('.gltf')) {
    return {
      valid: false,
      error: `Файл "${file.name}" не является 3D-моделью. Выберите файл в формате GLB или GLTF.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: `Файл "${file.name}" пуст или повреждён.`,
    };
  }
  if (file.size > MAX_3D_MODEL_BYTES) {
    return {
      valid: false,
      error: `Файл "${file.name}" слишком большой. Максимальный размер 3D-модели — 25 МБ.`,
    };
  }
  return { valid: true };
}

export function validatePanoramaImageFile(file: {
  name: string;
  type?: string;
  size: number;
  width?: number;
  height?: number;
}): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const validExt =
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp');
  const mime = (file.type ?? '').toLowerCase();
  const validMime = !mime || ['image/jpeg', 'image/png', 'image/webp'].includes(mime);

  if (!validExt || !validMime) {
    return {
      valid: false,
      error: `Файл "${file.name}" не поддерживается. Для 360°-панорамы загрузите JPG, PNG или WEBP.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: `Файл "${file.name}" пуст.`,
    };
  }
  if (file.size > MAX_PANORAMA_BYTES) {
    return {
      valid: false,
      error: `Панорама "${file.name}" превышает ограничение 15 МБ.`,
    };
  }

  if (typeof file.width === 'number' && typeof file.height === 'number') {
    if (!isValidPanoramaAspectRatio(file.width, file.height)) {
      return {
        valid: false,
        error: `Фото "${file.name}" (${file.width}×${file.height}) является обычным снимком, а не 360°-панорамой. Загрузите сферическую панораму с соотношением сторон 2:1 (например, 4096×2048 px).`,
      };
    }
  }

  return { valid: true };
}

export function isValidGlbMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // "glTF" ASCII header (0x67 0x6C 0x54 0x46)
  return bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
}

export function isValidGltfJson(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText);
    return Boolean(
      parsed &&
        typeof parsed === 'object' &&
        parsed.asset &&
        typeof parsed.asset.version === 'string'
    );
  } catch {
    return false;
  }
}

export function hasReal3dContent(
  property: Pick<
    PropertyListing,
    'model3dUrl' | 'panoramaUrl' | 'virtualTourUrl' | 'tourRooms'
  > | null | undefined
): boolean {
  if (!property) return false;
  return Boolean(
    property.model3dUrl?.trim() ||
      property.panoramaUrl?.trim() ||
      property.virtualTourUrl?.trim() ||
      (Array.isArray(property.tourRooms) && property.tourRooms.length > 0)
  );
}

export function normalizeYawDeg(yawDeg: number): number {
  if (!Number.isFinite(yawDeg)) return 0;
  let deg = ((yawDeg + 180) % 360 + 360) % 360 - 180;
  if (deg === -180) deg = 180;
  return Number(deg.toFixed(2));
}

export function clampPitchDeg(pitchDeg: number): number {
  if (!Number.isFinite(pitchDeg)) return 0;
  return Number(Math.max(-85, Math.min(85, pitchDeg)).toFixed(2));
}

export function sphericalDegToVector3(
  yawDeg: number,
  pitchDeg: number,
  radius = 10
): { x: number; y: number; z: number } {
  const phi = ((90 - clampPitchDeg(pitchDeg)) * Math.PI) / 180;
  const theta = (normalizeYawDeg(yawDeg) * Math.PI) / 180;
  return {
    x: radius * Math.sin(phi) * Math.sin(theta),
    y: radius * Math.cos(phi),
    z: -radius * Math.sin(phi) * Math.cos(theta),
  };
}

export function vector3ToSphericalDeg(
  x: number,
  y: number,
  z: number
): { yaw: number; pitch: number } {
  const len = Math.hypot(x, y, z) || 1;
  const nx = x / len;
  const ny = Math.max(-1, Math.min(1, y / len));
  const nz = z / len;
  const pitchRad = Math.asin(ny);
  const yawRad = Math.atan2(nx, -nz);
  return {
    yaw: normalizeYawDeg((yawRad * 180) / Math.PI),
    pitch: clampPitchDeg((pitchRad * 180) / Math.PI),
  };
}

export function deriveRoomNameFromFilename(fileName: string, index: number): string {
  const clean = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length >= 2 && !/^\d+$/.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1, 48);
  }
  return `Комната ${index + 1}`;
}

export function moveRoomOrder(
  rooms: TourRoom[],
  index: number,
  direction: -1 | 1
): TourRoom[] {
  const target = index + direction;
  if (index < 0 || index >= rooms.length || target < 0 || target >= rooms.length) {
    return rooms;
  }
  const next = [...rooms];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next.map((room, idx) => ({ ...room, roomOrder: idx }));
}

export function renameRoom(
  rooms: TourRoom[],
  roomKey: string,
  nextName: string
): TourRoom[] {
  return rooms.map((room) =>
    room.roomKey === roomKey ? { ...room, roomName: nextName } : room
  );
}

export function removeRoomAndHotspots(
  rooms: TourRoom[],
  hotspots: TourHotspot[],
  roomKey: string
): { rooms: TourRoom[]; hotspots: TourHotspot[] } {
  const nextRooms = rooms
    .filter((r) => r.roomKey !== roomKey)
    .map((r, idx) => ({ ...r, roomOrder: idx }));
  const nextHotspots = hotspots.filter(
    (h) => h.fromRoomKey !== roomKey && h.targetRoomKey !== roomKey
  );
  return { rooms: nextRooms, hotspots: nextHotspots };
}

export function autoConnectRooms(rooms: TourRoom[]): TourHotspot[] {
  if (rooms.length < 2) return [];
  const ordered = [...rooms].sort((a, b) => a.roomOrder - b.roomOrder);
  const generated: TourHotspot[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const current = ordered[i];
    const next = ordered[i + 1];

    generated.push({
      fromRoomKey: current.roomKey,
      targetRoomKey: next.roomKey,
      label: next.roomName || `Комната ${i + 2}`,
      yaw: 15,
      pitch: -4,
    });

    generated.push({
      fromRoomKey: next.roomKey,
      targetRoomKey: current.roomKey,
      label: current.roomName || `Комната ${i + 1}`,
      yaw: -165,
      pitch: -4,
    });
  }

  return generated;
}

export function sanitizeTourHotspots(
  rooms: TourRoom[],
  hotspots: TourHotspot[]
): TourHotspot[] {
  const validKeys = new Set(rooms.map((r) => r.roomKey));
  return hotspots
    .filter(
      (h) =>
        validKeys.has(h.fromRoomKey) &&
        validKeys.has(h.targetRoomKey) &&
        h.fromRoomKey !== h.targetRoomKey
    )
    .map((h) => ({
      ...h,
      label: h.label.trim() || rooms.find((r) => r.roomKey === h.targetRoomKey)?.roomName || 'Переход',
      yaw: normalizeYawDeg(h.yaw),
      pitch: clampPitchDeg(h.pitch),
    }));
}

export function buildEffectiveTourConfig(input: {
  model3dUrl?: string;
  tourRooms?: TourRoom[];
  virtualTourUrl?: string;
  autoRotate?: boolean;
  defaultFov?: number;
  exposure?: number;
}): Tour3DConfig {
  const hasRooms = Boolean(input.tourRooms && input.tourRooms.length > 0);
  const hasModel = Boolean(input.model3dUrl?.trim());
  const hasVirtual = Boolean(input.virtualTourUrl?.trim());

  const contentType: Tour3DConfig['contentType'] = hasRooms
    ? 'panorama_360'
    : hasModel
      ? 'model_3d'
      : hasVirtual
        ? 'virtual_tour'
        : 'none';

  return {
    contentType,
    filePath: input.model3dUrl?.trim() || input.tourRooms?.[0]?.filePath || input.virtualTourUrl?.trim() || '',
    processingStatus: 'ready',
    autoRotate: Boolean(input.autoRotate),
    defaultFov: Math.max(45, Math.min(100, Number(input.defaultFov) || 75)),
    exposure: Math.max(0.6, Math.min(1.8, Number(input.exposure) || 1.05)),
  };
}
