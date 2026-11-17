import type { BuildingArchetype, PropertyReconstructionConfig } from './propertyReconstruction.ts';

export type RoomId =
  | 'living'
  | 'kitchen'
  | 'hallway'
  | 'bathroom1'
  | 'bedroom'
  | 'study'
  | 'bathroom2'
  | 'balcony'
  | 'yard';

export type FurnitureCategory = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'decor' | 'partition';

export interface FurnitureItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  type: string;
  roomId: RoomId;
  floor: 1 | 2;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationY: number;
  color: string;
  secondaryColor?: string;
  material: 'fabric' | 'velvet' | 'leather' | 'wood' | 'walnut' | 'oak' | 'metal' | 'brass' | 'glass' | 'marble' | 'ceramic' | 'stone' | 'wool' | 'plaster';
  locked?: boolean;
}

export interface RoomBounds {
  id: RoomId;
  name: string;
  floor: 1 | 2;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  height: number;
  areaSqm: number;
  defaultCameraPos: [number, number, number];
  defaultCameraTarget: [number, number, number];
}

export interface DoorOpening {
  id: string;
  name: string;
  floor: 1 | 2;
  x: number;
  z: number;
  clearanceRadius: number;
}

export interface CollisionReport {
  hasIssues: boolean;
  overlappingPairs: Array<[string, string]>;
  outOfBoundsIds: string[];
  blockedDoors: Array<{ itemId: string; doorName: string }>;
}

/**
 * Multi-story architectural house layout (14m wide x 10m deep per floor, 2 floors)
 * Floor 1: y = 0 .. 3.2m
 * Floor 2: y = 3.2 .. 6.4m
 */
export const HOUSE_ROOMS: Record<RoomId, RoomBounds> = {
  living: {
    id: 'living',
    name: 'Гостиная',
    floor: 1,
    minX: -6.8,
    maxX: -0.2,
    minZ: -4.8,
    maxZ: 4.8,
    baseY: 0,
    height: 3.2,
    areaSqm: 63.4,
    defaultCameraPos: [-3.5, 2.3, 4.3],
    defaultCameraTarget: [-3.5, 1.0, -1.2],
  },
  kitchen: {
    id: 'kitchen',
    name: 'Кухня-столовая',
    floor: 1,
    minX: 0.2,
    maxX: 6.8,
    minZ: -4.8,
    maxZ: 1.2,
    baseY: 0,
    height: 3.2,
    areaSqm: 39.6,
    defaultCameraPos: [3.5, 2.3, 0.9],
    defaultCameraTarget: [3.5, 1.0, -2.8],
  },
  hallway: {
    id: 'hallway',
    name: 'Прихожая и холл',
    floor: 1,
    minX: 0.2,
    maxX: 3.6,
    minZ: 1.4,
    maxZ: 4.8,
    baseY: 0,
    height: 3.2,
    areaSqm: 11.6,
    defaultCameraPos: [1.8, 2.2, 4.4],
    defaultCameraTarget: [1.8, 1.1, 2.0],
  },
  bathroom1: {
    id: 'bathroom1',
    name: 'Ванная (1 этаж)',
    floor: 1,
    minX: 3.8,
    maxX: 6.8,
    minZ: 1.4,
    maxZ: 4.8,
    baseY: 0,
    height: 3.2,
    areaSqm: 10.2,
    defaultCameraPos: [5.3, 2.2, 4.4],
    defaultCameraTarget: [5.3, 1.0, 2.2],
  },
  bedroom: {
    id: 'bedroom',
    name: 'Мастер-спальня',
    floor: 2,
    minX: -6.8,
    maxX: -0.2,
    minZ: -4.8,
    maxZ: 4.8,
    baseY: 3.2,
    height: 3.0,
    areaSqm: 63.4,
    defaultCameraPos: [-3.5, 5.4, 4.1],
    defaultCameraTarget: [-3.5, 4.2, -1.5],
  },
  study: {
    id: 'study',
    name: 'Детская / Кабинет',
    floor: 2,
    minX: 0.2,
    maxX: 6.8,
    minZ: -4.8,
    maxZ: 1.2,
    baseY: 3.2,
    height: 3.0,
    areaSqm: 39.6,
    defaultCameraPos: [3.5, 5.4, 0.8],
    defaultCameraTarget: [3.5, 4.2, -2.5],
  },
  bathroom2: {
    id: 'bathroom2',
    name: 'Ванная (2 этаж)',
    floor: 2,
    minX: 3.8,
    maxX: 6.8,
    minZ: 1.4,
    maxZ: 4.8,
    baseY: 3.2,
    height: 3.0,
    areaSqm: 10.2,
    defaultCameraPos: [5.3, 5.4, 4.3],
    defaultCameraTarget: [5.3, 4.1, 2.2],
  },
  balcony: {
    id: 'balcony',
    name: 'Терраса / Балкон',
    floor: 2,
    minX: -6.8,
    maxX: -0.5,
    minZ: 5.0,
    maxZ: 7.2,
    baseY: 3.2,
    height: 3.0,
    areaSqm: 13.9,
    defaultCameraPos: [-1.0, 5.3, 6.8],
    defaultCameraTarget: [-4.2, 4.2, 5.8],
  },
  yard: {
    id: 'yard',
    name: 'Двор и экстерьер',
    floor: 1,
    minX: -14,
    maxX: 14,
    minZ: -11,
    maxZ: 12,
    baseY: 0,
    height: 8.0,
    areaSqm: 340,
    defaultCameraPos: [14.5, 8.5, 16.5],
    defaultCameraTarget: [0, 2.6, 0],
  },
};

export const HOUSE_DOORS: DoorOpening[] = [
  { id: 'front_door', name: 'Главный вход', floor: 1, x: 1.8, z: 4.8, clearanceRadius: 0.85 },
  { id: 'living_hall_door', name: 'Проход Гостиная ↔ Холл', floor: 1, x: 0.0, z: 2.8, clearanceRadius: 0.75 },
  { id: 'kitchen_hall_door', name: 'Проход Кухня ↔ Холл', floor: 1, x: 1.8, z: 1.3, clearanceRadius: 0.75 },
  { id: 'bath1_door', name: 'Дверь ванной 1 этажа', floor: 1, x: 3.8, z: 3.0, clearanceRadius: 0.7 },
  { id: 'bedroom_door', name: 'Дверь мастер-спальни', floor: 2, x: 0.0, z: 2.8, clearanceRadius: 0.75 },
  { id: 'study_door', name: 'Дверь кабинета/детской', floor: 2, x: 1.8, z: 1.3, clearanceRadius: 0.75 },
  { id: 'bath2_door', name: 'Дверь ванной 2 этажа', floor: 2, x: 3.8, z: 3.0, clearanceRadius: 0.7 },
  { id: 'balcony_door', name: 'Выход на террасу', floor: 2, x: -3.5, z: 4.9, clearanceRadius: 0.75 },
];

export function snapValueToGrid(value: number, step = 0.1): number {
  if (step <= 0) return value;
  return Number((Math.round(value / step) * step).toFixed(4));
}

export function getOrientedFootprint(item: Pick<FurnitureItem, 'width' | 'depth' | 'rotationY'>): {
  halfW: number;
  halfD: number;
} {
  const cos = Math.abs(Math.cos(item.rotationY));
  const sin = Math.abs(Math.sin(item.rotationY));
  const effW = item.width * cos + item.depth * sin;
  const effD = item.width * sin + item.depth * cos;
  return { halfW: effW / 2, halfD: effD / 2 };
}

function getArchetypeFootprintBounds(
  archetype: BuildingArchetype | undefined,
  floor: 1 | 2,
  roomId: RoomId
): { minX: number; maxX: number; minZ: number; maxZ: number; floorY: number; enforceClassicDoors: boolean } {
  switch (archetype) {
    case 'boulevard_cantilever_villa':
      return { minX: -10.8, maxX: 10.8, minZ: -5.4, maxZ: roomId === 'balcony' ? 5.6 : 4.6, floorY: floor === 2 ? 3.2 : 0.06, enforceClassicDoors: false };
    case 'samarkand_courtyard_villa':
      return { minX: -8.9, maxX: 8.9, minZ: -5.5, maxZ: 6.4, floorY: floor === 2 ? 3.15 : 0.06, enforceClassicDoors: false };
    case 'tashkent_residences_complex':
      return { minX: -11.4, maxX: 11.4, minZ: -6.2, maxZ: 4.6, floorY: floor === 2 ? 2.95 : 0.0, enforceClassicDoors: false };
    case 'bukhara_heritage_courtyard':
      return { minX: -10.8, maxX: 9.8, minZ: -8.2, maxZ: 4.8, floorY: floor === 2 ? 3.88 : 0.06, enforceClassicDoors: false };
    case 'modern_pergola_villa':
      return { minX: -8.6, maxX: 8.6, minZ: -7.5, maxZ: 2.2, floorY: floor === 2 ? 3.15 : 0.06, enforceClassicDoors: false };
    case 'commercial_glass_tower':
      return { minX: -11.2, maxX: 11.2, minZ: -5.8, maxZ: 3.8, floorY: floor === 2 ? 3.18 : 0.06, enforceClassicDoors: false };
    case 'penthouse_skyline_tower':
      return { minX: -6.7, maxX: 6.7, minZ: -5.5, maxZ: 4.5, floorY: floor === 2 ? 3.25 : 0.06, enforceClassicDoors: false };
    case 'classic_estate':
    default:
      return {
        minX: -6.75,
        maxX: 6.75,
        minZ: -4.75,
        maxZ: roomId === 'balcony' ? 7.05 : 4.75,
        floorY: floor === 2 ? 3.2 : 0,
        enforceClassicDoors: true,
      };
  }
}

export function clampItemToHouseBounds(
  item: FurnitureItem,
  archetype?: BuildingArchetype
): FurnitureItem {
  const { halfW, halfD } = getOrientedFootprint(item);
  const bounds = getArchetypeFootprintBounds(archetype, item.floor, item.roomId);
  const minX = bounds.minX + halfW;
  const maxX = bounds.maxX - halfW;
  const minZ = bounds.minZ + halfD;
  const maxZ = bounds.maxZ - halfD;

  return {
    ...item,
    x: Number(Math.min(maxX, Math.max(minX, item.x)).toFixed(2)),
    z: Number(Math.min(maxZ, Math.max(minZ, item.z)).toFixed(2)),
    y: Number(Math.max(bounds.floorY, item.y).toFixed(2)),
  };
}

export function evaluateSceneCollisions(
  items: FurnitureItem[],
  archetype?: BuildingArchetype
): CollisionReport {
  const overlappingPairs: Array<[string, string]> = [];
  const outOfBoundsIds: string[] = [];
  const blockedDoors: Array<{ itemId: string; doorName: string }> = [];

  // Rugs, wall art, ceiling lamps, and curtains don't trigger floor furniture collision
  const isNonBlockingDecor = (type: string) =>
    type === 'rug' || type === 'painting' || type === 'mirror' || type === 'curtains' || type === 'chandelier';

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const footA = getOrientedFootprint(a);
    const bounds = getArchetypeFootprintBounds(archetype, a.floor, a.roomId);

    // Check house bounds
    const maxAllowZ = bounds.enforceClassicDoors && a.roomId === 'balcony' ? 7.2 : bounds.maxZ + 0.15;
    if (
      a.x - footA.halfW < bounds.minX - 0.15 ||
      a.x + footA.halfW > bounds.maxX + 0.15 ||
      a.z - footA.halfD < bounds.minZ - 0.15 ||
      a.z + footA.halfD > maxAllowZ
    ) {
      outOfBoundsIds.push(a.id);
    }

    if (isNonBlockingDecor(a.type)) continue;

    // Check door clearance on same floor for classic layout
    if (bounds.enforceClassicDoors) {
      for (const door of HOUSE_DOORS) {
        if (door.floor !== a.floor) continue;
        const closestX = Math.max(a.x - footA.halfW, Math.min(door.x, a.x + footA.halfW));
        const closestZ = Math.max(a.z - footA.halfD, Math.min(door.z, a.z + footA.halfD));
        const dist = Math.hypot(door.x - closestX, door.z - closestZ);
        if (dist < door.clearanceRadius * 0.65) {
          blockedDoors.push({ itemId: a.id, doorName: door.name });
        }
      }
    }

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (a.floor !== b.floor) continue;
      if (isNonBlockingDecor(b.type)) continue;

      const footB = getOrientedFootprint(b);
      const margin = 0.04; // 4cm tolerance
      const overlapX = Math.abs(a.x - b.x) < footA.halfW + footB.halfW - margin;
      const overlapZ = Math.abs(a.z - b.z) < footA.halfD + footB.halfD - margin;
      const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2 - margin;

      if (overlapX && overlapZ && overlapY) {
        overlappingPairs.push([a.id, b.id]);
      }
    }
  }

  return {
    hasIssues: overlappingPairs.length > 0 || outOfBoundsIds.length > 0 || blockedDoors.length > 0,
    overlappingPairs,
    outOfBoundsIds,
    blockedDoors,
  };
}

export interface HistoryStack<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistoryStack<T>(initial: T): HistoryStack<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistoryState<T>(stack: HistoryStack<T>, next: T, maxDepth = 40): HistoryStack<T> {
  const past = [...stack.past, stack.present].slice(-maxDepth);
  return {
    past,
    present: next,
    future: [],
  };
}

export function undoHistoryState<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.past.length === 0) return stack;
  const previous = stack.past[stack.past.length - 1];
  const newPast = stack.past.slice(0, -1);
  return {
    past: newPast,
    present: previous,
    future: [stack.present, ...stack.future],
  };
}

export function redoHistoryState<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.future.length === 0) return stack;
  const next = stack.future[0];
  const newFuture = stack.future.slice(1);
  return {
    past: [...stack.past, stack.present],
    present: next,
    future: newFuture,
  };
}

export const UHD_4K_DIMENSIONS = {
  width: 3840,
  height: 2160,
  label: '3840 × 2160 (4K UHD)',
} as const;

export function getDefaultFurnishedHouseItems(): FurnitureItem[] {
  return [
    // ==================== FLOOR 1: LIVING ROOM ====================
    {
      id: 'liv_sofa_1',
      name: 'Угловой диван Grand Milano',
      category: 'living',
      type: 'sofa_sectional',
      roomId: 'living',
      floor: 1,
      x: -3.6,
      y: 0,
      z: -1.6,
      width: 2.8,
      height: 0.86,
      depth: 1.65,
      rotationY: 0,
      color: '#2F3E46',
      secondaryColor: '#D4B483',
      material: 'fabric',
    },
    {
      id: 'liv_armchair_1',
      name: 'Дизайнерское кресло Lounger',
      category: 'living',
      type: 'armchair',
      roomId: 'living',
      floor: 1,
      x: -1.4,
      y: 0,
      z: -0.4,
      width: 0.92,
      height: 0.84,
      depth: 0.9,
      rotationY: -0.65,
      color: '#C89F70',
      material: 'velvet',
    },
    {
      id: 'liv_coffee_1',
      name: 'Журнальный столик Carrara',
      category: 'living',
      type: 'coffee_table',
      roomId: 'living',
      floor: 1,
      x: -3.4,
      y: 0,
      z: 0.15,
      width: 1.35,
      height: 0.44,
      depth: 0.75,
      rotationY: 0,
      color: '#F4F1EA',
      secondaryColor: '#4A3525',
      material: 'marble',
    },
    {
      id: 'liv_tv_1',
      name: 'ТВ-консоль и OLED 77" 4K',
      category: 'living',
      type: 'tv_stand',
      roomId: 'living',
      floor: 1,
      x: -3.5,
      y: 0,
      z: -4.25,
      width: 2.2,
      height: 1.45,
      depth: 0.46,
      rotationY: 0,
      color: '#3B2B20',
      secondaryColor: '#111111',
      material: 'walnut',
    },
    {
      id: 'liv_rug_1',
      name: 'Шерстяной ковёр Samarkand Loft',
      category: 'living',
      type: 'rug',
      roomId: 'living',
      floor: 1,
      x: -3.4,
      y: 0,
      z: -0.7,
      width: 3.6,
      height: 0.025,
      depth: 2.8,
      rotationY: 0,
      color: '#E6E1D6',
      secondaryColor: '#8C6D46',
      material: 'wool',
    },
    {
      id: 'liv_lamp_1',
      name: 'Дуговой торшер Brass Arc',
      category: 'decor',
      type: 'floor_lamp',
      roomId: 'living',
      floor: 1,
      x: -5.6,
      y: 0,
      z: -2.6,
      width: 0.5,
      height: 1.85,
      depth: 0.5,
      rotationY: 0.5,
      color: '#D4B483',
      material: 'brass',
    },
    {
      id: 'liv_bookshelf_1',
      name: 'Стеллаж с коллекцией книг',
      category: 'living',
      type: 'bookshelf',
      roomId: 'living',
      floor: 1,
      x: -6.25,
      y: 0,
      z: 1.4,
      width: 0.45,
      height: 2.15,
      depth: 1.5,
      rotationY: 0,
      color: '#4A3525',
      material: 'walnut',
    },
    {
      id: 'liv_plant_1',
      name: 'Фикус Лирата в керамическом кашпо',
      category: 'decor',
      type: 'plant',
      roomId: 'living',
      floor: 1,
      x: -5.9,
      y: 0,
      z: 3.7,
      width: 0.65,
      height: 1.45,
      depth: 0.65,
      rotationY: 0,
      color: '#2D6A4F',
      material: 'ceramic',
    },
    {
      id: 'liv_painting_1',
      name: 'Абстрактный триптих Registan Gold',
      category: 'decor',
      type: 'painting',
      roomId: 'living',
      floor: 1,
      x: -6.72,
      y: 1.45,
      z: -1.2,
      width: 0.06,
      height: 1.1,
      depth: 1.6,
      rotationY: 0,
      color: '#143A30',
      secondaryColor: '#D4B483',
      material: 'wood',
    },

    // ==================== FLOOR 1: KITCHEN & DINING ====================
    {
      id: 'kit_set_1',
      name: 'Кухонный гарнитур со встроенной техникой',
      category: 'kitchen',
      type: 'kitchen_set',
      roomId: 'kitchen',
      floor: 1,
      x: 3.4,
      y: 0,
      z: -4.3,
      width: 3.8,
      height: 2.25,
      depth: 0.68,
      rotationY: 0,
      color: '#1A3C34',
      secondaryColor: '#EAE6DF',
      material: 'stone',
    },
    {
      id: 'kit_fridge_1',
      name: 'Двухдверный холодильник Side-by-Side',
      category: 'kitchen',
      type: 'fridge',
      roomId: 'kitchen',
      floor: 1,
      x: 5.95,
      y: 0,
      z: -4.25,
      width: 0.92,
      height: 2.0,
      depth: 0.76,
      rotationY: 0,
      color: '#CFD4D8',
      material: 'metal',
    },
    {
      id: 'kit_island_1',
      name: 'Кухонный остров с барными стульями',
      category: 'kitchen',
      type: 'kitchen_island',
      roomId: 'kitchen',
      floor: 1,
      x: 3.4,
      y: 0,
      z: -2.35,
      width: 2.1,
      height: 0.92,
      depth: 0.95,
      rotationY: 0,
      color: '#F3EFEA',
      secondaryColor: '#2B2B2B',
      material: 'marble',
    },
    {
      id: 'kit_dining_1',
      name: 'Обеденная группа на 4 персоны',
      category: 'kitchen',
      type: 'dining_table',
      roomId: 'kitchen',
      floor: 1,
      x: 3.7,
      y: 0,
      z: -0.35,
      width: 1.75,
      height: 0.78,
      depth: 1.0,
      rotationY: 0,
      color: '#7A5230',
      secondaryColor: '#D8D2C7',
      material: 'oak',
    },

    // ==================== FLOOR 1: HALLWAY ====================
    {
      id: 'hall_mirror_1',
      name: 'Ростовое зеркало в латунной раме',
      category: 'decor',
      type: 'mirror',
      roomId: 'hallway',
      floor: 1,
      x: 0.3,
      y: 0.95,
      z: 3.6,
      width: 0.06,
      height: 1.5,
      depth: 0.8,
      rotationY: 0,
      color: '#D4B483',
      material: 'glass',
    },

    // ==================== FLOOR 1: BATHROOM 1 ====================
    {
      id: 'bath1_shower_1',
      name: 'Стеклянная душевая кабина Walk-In',
      category: 'bathroom',
      type: 'shower',
      roomId: 'bathroom1',
      floor: 1,
      x: 6.1,
      y: 0,
      z: 2.1,
      width: 1.1,
      height: 2.1,
      depth: 1.0,
      rotationY: 0,
      color: '#E8F1F5',
      material: 'glass',
    },
    {
      id: 'bath1_sink_1',
      name: 'Тумба с раковиной и зеркалом LED',
      category: 'bathroom',
      type: 'sink',
      roomId: 'bathroom1',
      floor: 1,
      x: 5.2,
      y: 0,
      z: 4.35,
      width: 1.0,
      height: 1.85,
      depth: 0.52,
      rotationY: Math.PI,
      color: '#FFFFFF',
      secondaryColor: '#5C4033',
      material: 'ceramic',
    },
    {
      id: 'bath1_toilet_1',
      name: 'Подвесной унитаз Rimless',
      category: 'bathroom',
      type: 'toilet',
      roomId: 'bathroom1',
      floor: 1,
      x: 6.25,
      y: 0,
      z: 3.9,
      width: 0.44,
      height: 0.78,
      depth: 0.65,
      rotationY: -Math.PI / 2,
      color: '#FFFFFF',
      material: 'ceramic',
    },

    // ==================== FLOOR 2: MASTER BEDROOM ====================
    {
      id: 'bed_king_1',
      name: 'Двуспальная кровать King Size с мягким изголовьем',
      category: 'bedroom',
      type: 'bed_double',
      roomId: 'bedroom',
      floor: 2,
      x: -3.5,
      y: 3.2,
      z: -2.4,
      width: 2.0,
      height: 1.18,
      depth: 2.25,
      rotationY: 0,
      color: '#EAE4DC',
      secondaryColor: '#2A3B36',
      material: 'fabric',
    },
    {
      id: 'bed_night_1',
      name: 'Прикроватная тумба с лампой (левая)',
      category: 'bedroom',
      type: 'nightstand',
      roomId: 'bedroom',
      floor: 2,
      x: -4.85,
      y: 3.2,
      z: -3.15,
      width: 0.55,
      height: 0.85,
      depth: 0.45,
      rotationY: 0,
      color: '#5C4033',
      material: 'walnut',
    },
    {
      id: 'bed_night_2',
      name: 'Прикроватная тумба с лампой (правая)',
      category: 'bedroom',
      type: 'nightstand',
      roomId: 'bedroom',
      floor: 2,
      x: -2.15,
      y: 3.2,
      z: -3.15,
      width: 0.55,
      height: 0.85,
      depth: 0.45,
      rotationY: 0,
      color: '#5C4033',
      material: 'walnut',
    },
    {
      id: 'bed_wardrobe_1',
      name: 'Гардеробный шкаф 3-створчатый',
      category: 'bedroom',
      type: 'wardrobe',
      roomId: 'bedroom',
      floor: 2,
      x: -6.2,
      y: 3.2,
      z: 0.8,
      width: 0.65,
      height: 2.35,
      depth: 2.2,
      rotationY: 0,
      color: '#3D312A',
      secondaryColor: '#D4B483',
      material: 'walnut',
    },
    {
      id: 'bed_rug_1',
      name: 'Мягкий ковёр у кровати',
      category: 'bedroom',
      type: 'rug',
      roomId: 'bedroom',
      floor: 2,
      x: -3.5,
      y: 3.2,
      z: -1.8,
      width: 2.9,
      height: 0.025,
      depth: 2.4,
      rotationY: 0,
      color: '#DCD4C8',
      material: 'wool',
    },

    // ==================== FLOOR 2: STUDY / KIDS ROOM ====================
    {
      id: 'study_desk_1',
      name: 'Рабочая станция с монитором и креслом',
      category: 'office',
      type: 'desk',
      roomId: 'study',
      floor: 2,
      x: 4.6,
      y: 3.2,
      z: -3.7,
      width: 1.5,
      height: 1.15,
      depth: 0.78,
      rotationY: 0,
      color: '#8C6239',
      material: 'oak',
    },
    {
      id: 'study_bed_1',
      name: 'Кушетка / Односпальная кровать',
      category: 'bedroom',
      type: 'bed_single',
      roomId: 'study',
      floor: 2,
      x: 1.6,
      y: 3.2,
      z: -3.1,
      width: 1.1,
      height: 0.92,
      depth: 2.05,
      rotationY: 0,
      color: '#D8E2DC',
      material: 'fabric',
    },
    {
      id: 'study_books_1',
      name: 'Библиотечный стеллаж',
      category: 'living',
      type: 'bookshelf',
      roomId: 'study',
      floor: 2,
      x: 6.3,
      y: 3.2,
      z: -1.4,
      width: 0.42,
      height: 2.1,
      depth: 1.4,
      rotationY: 0,
      color: '#5C4033',
      material: 'walnut',
    },

    // ==================== FLOOR 2: BATHROOM 2 ====================
    {
      id: 'bath2_tub_1',
      name: 'Отдельностоящая овальная ванна',
      category: 'bathroom',
      type: 'bathtub',
      roomId: 'bathroom2',
      floor: 2,
      x: 5.5,
      y: 3.2,
      z: 2.2,
      width: 1.75,
      height: 0.68,
      depth: 0.82,
      rotationY: 0,
      color: '#FFFFFF',
      secondaryColor: '#D4B483',
      material: 'ceramic',
    },
    {
      id: 'bath2_sink_1',
      name: 'Двойная раковина с тумбой',
      category: 'bathroom',
      type: 'sink',
      roomId: 'bathroom2',
      floor: 2,
      x: 5.3,
      y: 3.2,
      z: 4.35,
      width: 1.1,
      height: 1.85,
      depth: 0.52,
      rotationY: Math.PI,
      color: '#FFFFFF',
      material: 'ceramic',
    },

    // ==================== FLOOR 2: BALCONY ====================
    {
      id: 'balc_chair_1',
      name: 'Лаунж-кресло на террасе',
      category: 'living',
      type: 'armchair',
      roomId: 'balcony',
      floor: 2,
      x: -4.6,
      y: 3.2,
      z: 6.0,
      width: 0.86,
      height: 0.8,
      depth: 0.86,
      rotationY: 0.4,
      color: '#E5DCCB',
      material: 'fabric',
    },
    {
      id: 'balc_plant_1',
      name: 'Кипарис в терракотовом вазоне',
      category: 'decor',
      type: 'plant',
      roomId: 'balcony',
      floor: 2,
      x: -5.9,
      y: 3.2,
      z: 6.2,
      width: 0.55,
      height: 1.35,
      depth: 0.55,
      rotationY: 0,
      color: '#2D6A4F',
      material: 'ceramic',
    },
  ];
}

const PROPERTY_COLOR_PALETTES = [
  { sofa: '#2F3E46', bed: '#EAE4DC', kitchen: '#1A3C34', wood: '#4A3525', accent: '#D4B483', mat: 'fabric' as const },
  { sofa: '#4A3B32', bed: '#F5EBE6', kitchen: '#2B2D42', wood: '#3D2B1F', accent: '#C89F70', mat: 'velvet' as const },
  { sofa: '#1D3557', bed: '#F1FAEE', kitchen: '#457B9D', wood: '#1D2D44', accent: '#E0A96D', mat: 'leather' as const },
  { sofa: '#283618', bed: '#FEFAE0', kitchen: '#606C38', wood: '#38220F', accent: '#DDA15E', mat: 'fabric' as const },
  { sofa: '#582F0E', bed: '#FAF0CA', kitchen: '#7F4F24', wood: '#3B2F2F', accent: '#E07A5F', mat: 'velvet' as const },
  { sofa: '#3A0CA3', bed: '#F7EDE2', kitchen: '#4361EE', wood: '#240046', accent: '#4CC9F0', mat: 'leather' as const },
];

export function getFurnishedHouseItemsForArchetype(
  arch: PropertyReconstructionConfig
): FurnitureItem[] {
  const s = arch.interior;
  const items: FurnitureItem[] = [];

  switch (arch.archetype) {
    case 'boulevard_cantilever_villa': {
      const f1Y = 0.06;
      const f2Y = 3.49;
      items.push(
        // Center Glass Living Room (visible through front panoramic glass!)
        { id: 'bv_rug_1', name: 'Тканый ковёр Boulevard', category: 'living', type: 'rug', roomId: 'living', floor: 1, x: 0, y: f1Y, z: -1.4, width: 4.4, height: 0.025, depth: 3.2, rotationY: 0, color: s.rugColor, secondaryColor: s.accentColor, material: 'wool' },
        { id: 'bv_sofa_1', name: 'Диван Linen Bouclé', category: 'living', type: 'sofa_sectional', roomId: 'living', floor: 1, x: -0.2, y: f1Y, z: -0.3, width: 3.0, height: 0.84, depth: 1.5, rotationY: Math.PI, color: s.sofaColor, secondaryColor: s.accentColor, material: s.sofaMaterial },
        { id: 'bv_coffee_1', name: 'Журнальный столик Travertine', category: 'living', type: 'coffee_table', roomId: 'living', floor: 1, x: -0.2, y: f1Y, z: -1.85, width: 1.4, height: 0.42, depth: 0.8, rotationY: 0, color: '#EFE8DB', secondaryColor: s.woodTone, material: 'marble' },
        { id: 'bv_chair_1', name: 'Кресло Boulevard', category: 'living', type: 'armchair', roomId: 'living', floor: 1, x: 2.35, y: f1Y, z: -1.7, width: 0.9, height: 0.82, depth: 0.9, rotationY: -1.1, color: s.accentColor, material: 'velvet' },
        { id: 'bv_lamp_1', name: 'Торшер Brass Arc', category: 'decor', type: 'floor_lamp', roomId: 'living', floor: 1, x: -2.8, y: f1Y, z: -2.4, width: 0.45, height: 1.85, depth: 0.45, rotationY: 0.4, color: '#D4B483', material: 'brass' },
        { id: 'bv_plant_1', name: 'Фикус Лирата', category: 'decor', type: 'plant', roomId: 'living', floor: 1, x: 3.2, y: f1Y, z: 0.4, width: 0.6, height: 1.5, depth: 0.6, rotationY: 0, color: '#2D6A4F', material: 'ceramic' },

        // Left Wing Floor 1 Guest Suite
        { id: 'bv_bed_1', name: 'Кровать Boulevard Suite', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 1, x: -7.4, y: f1Y, z: -2.8, width: 2.0, height: 1.15, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'bv_night_1', name: 'Тумба (левая)', category: 'bedroom', type: 'nightstand', roomId: 'bedroom', floor: 1, x: -8.75, y: f1Y, z: -3.5, width: 0.55, height: 0.82, depth: 0.45, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bv_night_2', name: 'Тумба (правая)', category: 'bedroom', type: 'nightstand', roomId: 'bedroom', floor: 1, x: -6.05, y: f1Y, z: -3.5, width: 0.55, height: 0.82, depth: 0.45, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bv_ward_1', name: 'Шкаф в шпоне ореха', category: 'bedroom', type: 'wardrobe', roomId: 'bedroom', floor: 1, x: -10.1, y: f1Y, z: -0.6, width: 0.65, height: 2.3, depth: 2.2, rotationY: 0, color: s.woodTone, secondaryColor: s.accentColor, material: 'walnut' },
        { id: 'bv_rug_bed1', name: 'Ковёр спальни', category: 'bedroom', type: 'rug', roomId: 'bedroom', floor: 1, x: -7.4, y: f1Y, z: -2.2, width: 2.9, height: 0.025, depth: 2.4, rotationY: 0, color: s.rugColor, material: 'wool' },

        // Right Wing Floor 1 Kitchen & Dining
        { id: 'bv_kit_1', name: 'Кухонный гарнитур Walnut', category: 'kitchen', type: 'kitchen_set', roomId: 'kitchen', floor: 1, x: 7.5, y: f1Y, z: -3.2, width: 3.8, height: 2.25, depth: 0.68, rotationY: 0, color: s.kitchenColor, secondaryColor: '#EAE6DF', material: 'stone' },
        { id: 'bv_isl_1', name: 'Остров из травертина', category: 'kitchen', type: 'kitchen_island', roomId: 'kitchen', floor: 1, x: 7.5, y: f1Y, z: -1.4, width: 2.2, height: 0.92, depth: 0.95, rotationY: 0, color: '#EFE8DB', secondaryColor: '#2B2B2B', material: 'marble' },
        { id: 'bv_din_1', name: 'Обеденный стол на 6 персон', category: 'kitchen', type: 'dining_table', roomId: 'kitchen', floor: 1, x: 7.5, y: f1Y, z: 1.0, width: 2.1, height: 0.78, depth: 1.05, rotationY: 0, color: s.woodTone, secondaryColor: s.sofaColor, material: 'oak' },

        // Floor 2 Center Gallery Lounge
        { id: 'bv_sofa_2', name: 'Лаунж-диван 2 этажа', category: 'living', type: 'sofa_modern', roomId: 'study', floor: 2, x: 0, y: f2Y, z: -2.4, width: 2.6, height: 0.82, depth: 1.0, rotationY: 0, color: s.sofaColor, material: s.sofaMaterial },
        { id: 'bv_coffee_2', name: 'Столик галереи', category: 'living', type: 'coffee_table', roomId: 'study', floor: 2, x: 0, y: f2Y, z: -1.0, width: 1.2, height: 0.4, depth: 0.7, rotationY: 0, color: '#EFE8DB', material: 'marble' },
        { id: 'bv_books_2', name: 'Библиотечный стеллаж', category: 'living', type: 'bookshelf', roomId: 'study', floor: 2, x: -3.5, y: f2Y, z: -1.8, width: 0.45, height: 2.1, depth: 1.5, rotationY: 0, color: s.woodTone, material: 'walnut' },

        // Floor 2 Right Master Suite
        { id: 'bv_bed_2', name: 'Мастер-кровать с видом на перголу', category: 'bedroom', type: 'bed_double', roomId: 'bathroom2', floor: 2, x: 7.5, y: f2Y, z: -2.0, width: 2.0, height: 1.15, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'bv_night_3', name: 'Прикроватная тумба', category: 'bedroom', type: 'nightstand', roomId: 'bathroom2', floor: 2, x: 6.1, y: f2Y, z: -2.7, width: 0.52, height: 0.82, depth: 0.45, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bv_night_4', name: 'Прикроватная тумба', category: 'bedroom', type: 'nightstand', roomId: 'bathroom2', floor: 2, x: 8.9, y: f2Y, z: -2.7, width: 0.52, height: 0.82, depth: 0.45, rotationY: 0, color: s.woodTone, material: 'walnut' },

        // Floor 2 Right Pergola Terrace
        { id: 'bv_balc_ch1', name: 'Шезлонг на террасе с перголой', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: 6.4, y: f2Y, z: 2.9, width: 0.9, height: 0.78, depth: 1.1, rotationY: 0.25, color: '#EAE2D6', material: 'fabric' },
        { id: 'bv_balc_ch2', name: 'Шезлонг на террасе с перголой', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: 8.6, y: f2Y, z: 2.9, width: 0.9, height: 0.78, depth: 1.1, rotationY: -0.25, color: '#EAE2D6', material: 'fabric' },
        { id: 'bv_balc_pl', name: 'Оливковое дерево в кашпо', category: 'decor', type: 'plant', roomId: 'balcony', floor: 2, x: 4.9, y: f2Y, z: 3.9, width: 0.6, height: 1.4, depth: 0.6, rotationY: 0, color: '#5A7350', material: 'ceramic' }
      );
      return items;
    }

    case 'samarkand_courtyard_villa': {
      const f1Y = 0.0;
      const f2Y = 3.18;
      items.push(
        // Protruding Front-Left Glass Sunroom (matches L-shaped sage/cream sofa seen through sunroom glass!)
        { id: 'sk_rug_sun', name: 'Ковёр стеклянного павильона', category: 'living', type: 'rug', roomId: 'living', floor: 1, x: -5.8, y: f1Y, z: 3.1, width: 3.8, height: 0.025, depth: 3.2, rotationY: 0, color: s.rugColor, material: 'wool' },
        { id: 'sk_sofa_sun', name: 'Угловой диван павильона', category: 'living', type: 'sofa_sectional', roomId: 'living', floor: 1, x: -6.0, y: f1Y, z: 2.4, width: 2.8, height: 0.84, depth: 1.65, rotationY: 0, color: s.sofaColor, secondaryColor: s.woodTone, material: s.sofaMaterial },
        { id: 'sk_cof_sun', name: 'Столик из известняка', category: 'living', type: 'coffee_table', roomId: 'living', floor: 1, x: -5.8, y: f1Y, z: 4.1, width: 1.3, height: 0.42, depth: 0.75, rotationY: 0, color: '#E8DEC9', material: 'marble' },
        { id: 'sk_pl_sun', name: 'Фикус у панорамного окна', category: 'decor', type: 'plant', roomId: 'living', floor: 1, x: -3.5, y: f1Y, z: 4.9, width: 0.6, height: 1.45, depth: 0.6, rotationY: 0, color: '#2D6A4F', material: 'ceramic' },

        // Left Rear Dining & Kitchen
        { id: 'sk_kit_1', name: 'Кухня из ореха и известняка', category: 'kitchen', type: 'kitchen_set', roomId: 'kitchen', floor: 1, x: -5.8, y: f1Y, z: -5.1, width: 3.8, height: 2.25, depth: 0.68, rotationY: 0, color: s.kitchenColor, secondaryColor: '#EAE2D2', material: 'stone' },
        { id: 'sk_isl_1', name: 'Кухонный остров', category: 'kitchen', type: 'kitchen_island', roomId: 'kitchen', floor: 1, x: -5.8, y: f1Y, z: -3.2, width: 2.0, height: 0.92, depth: 0.9, rotationY: 0, color: '#EFE8DB', material: 'marble' },
        { id: 'sk_din_1', name: 'Обеденная группа', category: 'kitchen', type: 'dining_table', roomId: 'kitchen', floor: 1, x: -5.8, y: f1Y, z: -1.1, width: 1.8, height: 0.78, depth: 1.0, rotationY: 0, color: s.woodTone, material: 'oak' },

        // Right Wing Ground Guest Suite / Study & Bath
        { id: 'sk_desk_1', name: 'Кабинетный стол', category: 'office', type: 'desk', roomId: 'bathroom1', floor: 1, x: 5.2, y: f1Y, z: -4.2, width: 1.6, height: 1.1, depth: 0.78, rotationY: 0, color: s.woodTone, material: 'oak' },
        { id: 'sk_arm_1', name: 'Кресло для отдыха', category: 'living', type: 'armchair', roomId: 'bathroom1', floor: 1, x: 4.0, y: f1Y, z: -0.6, width: 0.9, height: 0.84, depth: 0.9, rotationY: -0.5, color: s.sofaColor, material: 'fabric' },
        { id: 'sk_show_1', name: 'Душевая Walk-In', category: 'bathroom', type: 'shower', roomId: 'bathroom1', floor: 1, x: 7.8, y: f1Y, z: -3.8, width: 1.1, height: 2.1, depth: 1.0, rotationY: 0, color: '#E8F1F5', material: 'glass' },

        // Floor 2 Left Upper Master Bedroom
        { id: 'sk_bed_2', name: 'Мастер-кровать с резным изголовьем', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 2, x: -5.8, y: f2Y, z: -3.2, width: 2.0, height: 1.15, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'sk_ward_2', name: 'Шкаф в нише', category: 'bedroom', type: 'wardrobe', roomId: 'bedroom', floor: 2, x: -8.2, y: f2Y, z: -0.8, width: 0.65, height: 2.3, depth: 2.1, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'sk_rug_b2', name: 'Шерстяной ковёр', category: 'bedroom', type: 'rug', roomId: 'bedroom', floor: 2, x: -5.8, y: f2Y, z: -2.5, width: 2.9, height: 0.025, depth: 2.4, rotationY: 0, color: s.rugColor, material: 'wool' },

        // Floor 2 Right Wing Suite, Bath & Balcony
        { id: 'sk_bed_r2', name: 'Гостевая кровать', category: 'bedroom', type: 'bed_single', roomId: 'study', floor: 2, x: 4.0, y: f2Y, z: -3.4, width: 1.3, height: 0.95, depth: 2.05, rotationY: 0, color: s.bedColor, material: 'fabric' },
        { id: 'sk_tub_2', name: 'Ванна-чаша', category: 'bathroom', type: 'bathtub', roomId: 'bathroom2', floor: 2, x: 7.4, y: f2Y, z: -3.4, width: 1.7, height: 0.68, depth: 0.82, rotationY: 0, color: '#FFFFFF', secondaryColor: s.accentColor, material: 'ceramic' },
        { id: 'sk_balc_1', name: 'Кресло террасы', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: 6.9, y: 3.27, z: 2.6, width: 0.85, height: 0.8, depth: 0.85, rotationY: 0.3, color: '#EFE8DB', material: 'fabric' }
      );
      return items;
    }

    case 'tashkent_residences_complex': {
      // Floor 1 Lobby + Show Studio; Floor 2 Showcase Apartment matching prop_tashkent_apartment_1794853628562.jpg!
      const f1Y = 0.0;
      const f2Y = 2.95;
      items.push(
        // Ground Floor Lobby & Co-living Lounge
        { id: 'tr_lob_desk', name: 'Стойка ресепшн лобби', category: 'office', type: 'kitchen_island', roomId: 'hallway', floor: 1, x: 7.2, y: f1Y, z: -0.4, width: 2.2, height: 1.0, depth: 0.85, rotationY: 0, color: '#DDD2BE', secondaryColor: s.woodTone, material: 'marble' },
        { id: 'tr_lob_sofa', name: 'Диван лобби', category: 'living', type: 'sofa_modern', roomId: 'hallway', floor: 1, x: 7.2, y: f1Y, z: 2.2, width: 2.4, height: 0.82, depth: 0.95, rotationY: Math.PI, color: s.sofaColor, material: 'fabric' },
        { id: 'tr_lob_pl', name: 'Оливковое дерево лобби', category: 'decor', type: 'plant', roomId: 'hallway', floor: 1, x: 4.5, y: f1Y, z: 2.6, width: 0.65, height: 1.6, depth: 0.65, rotationY: 0, color: '#5A7350', material: 'ceramic' },

        // Upper Showcase Residence (matches prop_tashkent_apartment_1794853628562.jpg: walnut kitchen + white marble island + bouclé sectional + herringbone oak!)
        { id: 'tr_kit_2', name: 'Шкафы кухни Dark Walnut', category: 'kitchen', type: 'kitchen_set', roomId: 'kitchen', floor: 2, x: -7.8, y: f2Y, z: -4.2, width: 3.8, height: 2.25, depth: 0.68, rotationY: 0, color: s.kitchenColor, secondaryColor: '#EAE6DF', material: 'walnut' },
        { id: 'tr_isl_2', name: 'Остров Calacatta Marble', category: 'kitchen', type: 'kitchen_island', roomId: 'kitchen', floor: 2, x: -7.4, y: f2Y, z: -2.1, width: 2.2, height: 0.92, depth: 0.98, rotationY: 0, color: '#F5F2EC', secondaryColor: '#2B2B2B', material: 'marble' },
        { id: 'tr_rug_2', name: 'Шерстяной ковёр гостиной', category: 'living', type: 'rug', roomId: 'living', floor: 2, x: -0.8, y: f2Y, z: -1.4, width: 3.8, height: 0.025, depth: 2.9, rotationY: 0, color: s.rugColor, material: 'wool' },
        { id: 'tr_sofa_2', name: 'Диван Bouclé Cream L-Shape', category: 'living', type: 'sofa_sectional', roomId: 'living', floor: 2, x: -1.0, y: f2Y, z: -2.0, width: 2.9, height: 0.84, depth: 1.65, rotationY: 0, color: s.sofaColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'tr_cof_2', name: 'Дубовый журнальный столик', category: 'living', type: 'coffee_table', roomId: 'living', floor: 2, x: -0.8, y: f2Y, z: -0.2, width: 1.35, height: 0.42, depth: 0.75, rotationY: 0, color: s.woodTone, material: 'oak' },
        { id: 'tr_din_2', name: 'Обеденный стол Oak', category: 'kitchen', type: 'dining_table', roomId: 'kitchen', floor: 2, x: 1.8, y: f2Y, z: -3.8, width: 1.75, height: 0.78, depth: 0.95, rotationY: 0, color: s.woodTone, material: 'oak' },
        { id: 'tr_pl_2', name: 'Оливковое дерево у окна', category: 'decor', type: 'plant', roomId: 'living', floor: 2, x: 1.8, y: f2Y, z: 0.8, width: 0.6, height: 1.55, depth: 0.6, rotationY: 0, color: '#5A7350', material: 'ceramic' },

        // Right Wing Master Bedroom & Bath
        { id: 'tr_bed_2', name: 'Мастер-кровать Bouclé', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 2, x: 7.2, y: f2Y, z: -1.8, width: 2.0, height: 1.15, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'tr_ward_2', name: 'Гардеробная система', category: 'bedroom', type: 'wardrobe', roomId: 'bedroom', floor: 2, x: 9.8, y: f2Y, z: -1.0, width: 0.65, height: 2.3, depth: 2.0, rotationY: 0, color: s.kitchenColor, material: 'walnut' },
        { id: 'tr_tub_2', name: 'Ванна Spa', category: 'bathroom', type: 'bathtub', roomId: 'bathroom2', floor: 2, x: 7.2, y: f2Y, z: 2.2, width: 1.7, height: 0.68, depth: 0.82, rotationY: 0, color: '#FFFFFF', material: 'ceramic' },
        { id: 'tr_balc_2', name: 'Кресло на балконе', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: -1.2, y: 3.3, z: 2.4, width: 0.8, height: 0.8, depth: 0.8, rotationY: 0, color: s.sofaColor, material: 'fabric' }
      );
      return items;
    }

    case 'bukhara_heritage_courtyard': {
      const f1Y = 0.06;
      const f2Y = 3.88;
      items.push(
        // Right Modern Glass Pavilion (exact furniture seen in prop_bukhara_estate_1794853628569.jpg!)
        { id: 'bk_rug_pav', name: 'Бухарский ковёр ручной работы', category: 'living', type: 'rug', roomId: 'living', floor: 1, x: 6.1, y: f1Y, z: 0.6, width: 3.4, height: 0.025, depth: 2.8, rotationY: 0, color: '#7E2326', secondaryColor: '#D4B483', material: 'wool' },
        { id: 'bk_sofa_pav', name: 'Диван из тика с тёмно-синими подушками', category: 'living', type: 'sofa_modern', roomId: 'living', floor: 1, x: 5.5, y: f1Y, z: -0.8, width: 2.4, height: 0.84, depth: 0.95, rotationY: 0, color: '#E6DFD3', secondaryColor: '#24324A', material: 'fabric' },
        { id: 'bk_cof_pav', name: 'Кофейный столик из ореха', category: 'living', type: 'coffee_table', roomId: 'living', floor: 1, x: 5.5, y: f1Y, z: 0.6, width: 1.15, height: 0.42, depth: 0.7, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bk_din_pav', name: 'Обеденный стол в стеклянном зале', category: 'kitchen', type: 'dining_table', roomId: 'kitchen', floor: 1, x: 6.4, y: f1Y, z: 2.5, width: 1.8, height: 0.78, depth: 1.0, rotationY: 0, color: s.woodTone, material: 'oak' },

        // Rear Historic Brick Reception & Kitchen Wing
        { id: 'bk_kit_1', name: 'Традиционная кухня из ореха', category: 'kitchen', type: 'kitchen_set', roomId: 'hallway', floor: 1, x: -5.2, y: f1Y, z: -6.8, width: 3.6, height: 2.2, depth: 0.68, rotationY: 0, color: s.kitchenColor, material: 'walnut' },
        { id: 'bk_din_2', name: 'Парадный стол в кирпичном зале', category: 'kitchen', type: 'dining_table', roomId: 'hallway', floor: 1, x: -0.6, y: f1Y, z: -5.6, width: 2.1, height: 0.78, depth: 1.05, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bk_arm_l', name: 'Чайный уголок в арке', category: 'living', type: 'armchair', roomId: 'bathroom1', floor: 1, x: -8.6, y: f1Y, z: -0.5, width: 0.9, height: 0.84, depth: 0.9, rotationY: Math.PI / 2, color: '#24324A', material: 'velvet' },

        // Floor 2 Historic Brick Master Suite & Ayvan Gallery
        { id: 'bk_bed_2', name: 'Кровать с узбекским текстилем', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 2, x: -4.8, y: f2Y, z: -5.8, width: 2.0, height: 1.18, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: '#7E2326', material: 'fabric' },
        { id: 'bk_rug_2', name: 'Ковёр спальни Бухара', category: 'bedroom', type: 'rug', roomId: 'bedroom', floor: 2, x: -4.8, y: f2Y, z: -5.2, width: 2.8, height: 0.025, depth: 2.3, rotationY: 0, color: '#7E2326', material: 'wool' },
        { id: 'bk_ward_2', name: 'Резной шкаф', category: 'bedroom', type: 'wardrobe', roomId: 'bathroom2', floor: 2, x: 2.2, y: f2Y, z: -5.8, width: 1.8, height: 2.2, depth: 0.65, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'bk_ayvan_ch', name: 'Кресло на резном айване', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: -0.6, y: 3.9, z: -2.9, width: 0.85, height: 0.8, depth: 0.85, rotationY: 0, color: '#E6DFD3', material: 'fabric' }
      );
      return items;
    }

    case 'modern_pergola_villa': {
      const f1Y = 0.06;
      const f2Y = 3.15;
      items.push(
        // Left 2-Story Volume Living
        { id: 'mp_rug_1', name: 'Шерстяной ковёр', category: 'living', type: 'rug', roomId: 'living', floor: 1, x: -4.4, y: f1Y, z: -1.8, width: 3.8, height: 0.025, depth: 3.0, rotationY: 0, color: s.rugColor, material: 'wool' },
        { id: 'mp_sofa_1', name: 'Бархатный угловой диван', category: 'living', type: 'sofa_sectional', roomId: 'living', floor: 1, x: -4.4, y: f1Y, z: -2.8, width: 2.9, height: 0.84, depth: 1.65, rotationY: 0, color: s.sofaColor, secondaryColor: s.accentColor, material: 'velvet' },
        { id: 'mp_cof_1', name: 'Мраморный столик Carrara', category: 'living', type: 'coffee_table', roomId: 'living', floor: 1, x: -4.4, y: f1Y, z: -0.8, width: 1.35, height: 0.42, depth: 0.78, rotationY: 0, color: '#F4F1EA', material: 'marble' },
        { id: 'mp_book_1', name: 'Стеллаж Walnut', category: 'living', type: 'bookshelf', roomId: 'living', floor: 1, x: -7.2, y: f1Y, z: -2.2, width: 0.45, height: 2.15, depth: 1.6, rotationY: 0, color: s.woodTone, material: 'walnut' },

        // Right Volume Kitchen & Dining
        { id: 'mp_kit_1', name: 'Современная кухня Graphite', category: 'kitchen', type: 'kitchen_set', roomId: 'kitchen', floor: 1, x: 4.8, y: f1Y, z: -6.2, width: 3.8, height: 2.25, depth: 0.68, rotationY: 0, color: s.kitchenColor, secondaryColor: '#EAE6DF', material: 'stone' },
        { id: 'mp_isl_1', name: 'Остров из камня', category: 'kitchen', type: 'kitchen_island', roomId: 'kitchen', floor: 1, x: 4.8, y: f1Y, z: -4.2, width: 2.1, height: 0.92, depth: 0.95, rotationY: 0, color: '#F3EFEA', material: 'marble' },
        { id: 'mp_din_1', name: 'Обеденная группа', category: 'kitchen', type: 'dining_table', roomId: 'kitchen', floor: 1, x: 4.8, y: f1Y, z: -1.8, width: 1.8, height: 0.78, depth: 1.0, rotationY: 0, color: s.woodTone, material: 'oak' },

        // Floor 2 Master & Study
        { id: 'mp_bed_2', name: 'Мастер-кровать King', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 2, x: -4.4, y: f2Y, z: -3.2, width: 2.0, height: 1.18, depth: 2.2, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'mp_desk_2', name: 'Рабочая станция', category: 'office', type: 'desk', roomId: 'study', floor: 2, x: 4.8, y: f2Y, z: -5.2, width: 1.5, height: 1.15, depth: 0.78, rotationY: 0, color: s.woodTone, material: 'oak' },
        { id: 'mp_tub_2', name: 'Ванна-чаша', category: 'bathroom', type: 'bathtub', roomId: 'bathroom2', floor: 2, x: 6.2, y: f2Y, z: -1.8, width: 1.75, height: 0.68, depth: 0.82, rotationY: 0, color: '#FFFFFF', material: 'ceramic' },
        { id: 'mp_balc_2', name: 'Лаунж-кресло на балконе', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: 0.5, y: 3.12, z: -0.8, width: 0.85, height: 0.8, depth: 0.85, rotationY: 0, color: '#EAE2D6', material: 'fabric' }
      );
      return items;
    }

    case 'commercial_glass_tower': {
      // Matches prop_luxury_office_uz_1794854288611.jpg & prop_commercial_tower_1794853629336.jpg:
      // ZERO beds/bathtubs — authentic executive boardrooms, travertine slab conference tables, oak desks & lobby atrium!
      const f1Y = 0.06;
      const f2Y = 3.18;
      items.push(
        // Central Atrium Reception & Lounge
        { id: 'cm_rec_1', name: 'Стойка ресепшн из травертина', category: 'office', type: 'kitchen_island', roomId: 'hallway', floor: 1, x: 0, y: f1Y, z: -2.4, width: 2.8, height: 1.05, depth: 0.9, rotationY: 0, color: '#D6C6AE', secondaryColor: '#2B3640', material: 'marble' },
        { id: 'cm_lob_s1', name: 'Кожаный диван ожидания', category: 'living', type: 'sofa_modern', roomId: 'hallway', floor: 1, x: -1.6, y: f1Y, z: 0.8, width: 2.1, height: 0.82, depth: 0.9, rotationY: Math.PI / 2, color: s.sofaColor, material: 'leather' },
        { id: 'cm_lob_s2', name: 'Кожаный диван ожидания', category: 'living', type: 'sofa_modern', roomId: 'hallway', floor: 1, x: 1.6, y: f1Y, z: 0.8, width: 2.1, height: 0.82, depth: 0.9, rotationY: -Math.PI / 2, color: s.sofaColor, material: 'leather' },
        { id: 'cm_lob_pl', name: 'Оливковое дерево атриума', category: 'decor', type: 'plant', roomId: 'hallway', floor: 1, x: 0, y: f1Y, z: 1.8, width: 0.7, height: 1.7, depth: 0.7, rotationY: 0, color: '#5A7350', material: 'ceramic' },

        // Floor 1 Wing Offices
        { id: 'cm_dsk_r1', name: 'Рабочее место менеджера', category: 'office', type: 'desk', roomId: 'bathroom1', floor: 1, x: 7.6, y: f1Y, z: -2.2, width: 1.7, height: 1.15, depth: 0.82, rotationY: 0, color: s.woodTone, material: 'oak' },
        { id: 'cm_dsk_l1', name: 'Рабочее место аналитика', category: 'office', type: 'desk', roomId: 'bedroom', floor: 1, x: -7.6, y: f1Y, z: -2.2, width: 1.7, height: 1.15, depth: 0.82, rotationY: 0, color: s.woodTone, material: 'oak' },

        // Floor 2 Right Wing: Signature Oak-Paneled Boardroom with Travertine Slab Table (matches prop_luxury_office_uz_1794854288611.jpg!)
        { id: 'cm_board_tbl', name: 'Переговорный стол из травертина', category: 'office', type: 'dining_table', roomId: 'living', floor: 2, x: 7.6, y: f2Y, z: -0.6, width: 3.1, height: 0.78, depth: 1.3, rotationY: Math.PI / 2, color: '#D6C6AE', secondaryColor: '#2C3034', material: 'stone' },
        { id: 'cm_cred_2', name: 'Консоль переговорной', category: 'office', type: 'bookshelf', roomId: 'living', floor: 2, x: 4.5, y: f2Y, z: -1.0, width: 0.48, height: 1.9, depth: 2.2, rotationY: 0, color: s.woodTone, material: 'oak' },

        // Floor 2 Left Wing: CEO Suite & Lounge
        { id: 'cm_ceo_desk', name: 'Кабинет руководителя CEO', category: 'office', type: 'desk', roomId: 'kitchen', floor: 2, x: -7.6, y: f2Y, z: -2.8, width: 1.9, height: 1.15, depth: 0.9, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'cm_ceo_sofa', name: 'Кожаный диван кабинета', category: 'living', type: 'sofa_modern', roomId: 'kitchen', floor: 2, x: -7.6, y: f2Y, z: 1.0, width: 2.4, height: 0.82, depth: 0.95, rotationY: Math.PI, color: '#2C3034', material: 'leather' },
        { id: 'cm_ceo_cof', name: 'Кофейный столик', category: 'living', type: 'coffee_table', roomId: 'kitchen', floor: 2, x: -7.6, y: f2Y, z: -0.4, width: 1.2, height: 0.42, depth: 0.7, rotationY: 0, color: '#D6C6AE', material: 'marble' }
      );
      return items;
    }

    case 'penthouse_skyline_tower': {
      // Matches prop_tashkent_penthouse_1794853628028.jpg: travertine slab floor, cream bouclé sofa + twin swivel armchairs + walnut/travertine coffee table + travertine fireplace!
      const f1Y = 0.06;
      const f2Y = 3.25;
      items.push(
        // Lower Penthouse Level: Master Suite & Spa Bath
        { id: 'ph_bed_1', name: 'Кровать Penthouse King', category: 'bedroom', type: 'bed_double', roomId: 'bedroom', floor: 1, x: -3.2, y: f1Y, z: -1.6, width: 2.1, height: 1.18, depth: 2.25, rotationY: 0, color: s.bedColor, secondaryColor: s.woodTone, material: 'fabric' },
        { id: 'ph_ward_1', name: 'Гардеробная в тёмном шпоне', category: 'bedroom', type: 'wardrobe', roomId: 'bedroom', floor: 1, x: -5.8, y: f1Y, z: 0.5, width: 0.65, height: 2.35, depth: 2.2, rotationY: 0, color: s.woodTone, material: 'walnut' },
        { id: 'ph_tub_1', name: 'Панорамная ванна-чаша', category: 'bathroom', type: 'bathtub', roomId: 'bathroom1', floor: 1, x: 4.2, y: f1Y, z: -1.4, width: 1.8, height: 0.68, depth: 0.85, rotationY: 0, color: '#FFFFFF', secondaryColor: s.accentColor, material: 'ceramic' },
        { id: 'ph_sink_1', name: 'Раковина из травертина', category: 'bathroom', type: 'sink', roomId: 'bathroom1', floor: 1, x: 4.2, y: f1Y, z: 2.2, width: 1.2, height: 1.85, depth: 0.55, rotationY: Math.PI, color: '#FFFFFF', secondaryColor: s.woodTone, material: 'ceramic' },

        // Crown Penthouse Sky Lounge (matches prop_tashkent_penthouse_1794853628028.jpg!)
        { id: 'ph_rug_2', name: 'Ковёр Sky Lounge', category: 'living', type: 'rug', roomId: 'living', floor: 2, x: -1.8, y: f2Y, z: -0.6, width: 4.0, height: 0.025, depth: 3.2, rotationY: 0, color: s.rugColor, material: 'wool' },
        { id: 'ph_sofa_2', name: 'Модульный диван Bouclé Cream', category: 'living', type: 'sofa_modern', roomId: 'living', floor: 2, x: -1.6, y: f2Y, z: -2.0, width: 2.9, height: 0.84, depth: 1.05, rotationY: 0, color: s.sofaColor, material: 'fabric' },
        { id: 'ph_arm_l2', name: 'Поворотное кресло Bouclé', category: 'living', type: 'armchair', roomId: 'living', floor: 2, x: -4.1, y: f2Y, z: -0.2, width: 0.92, height: 0.82, depth: 0.9, rotationY: 1.1, color: '#E3DDD2', material: 'fabric' },
        { id: 'ph_arm_r2', name: 'Поворотное кресло Bouclé', category: 'living', type: 'armchair', roomId: 'living', floor: 2, x: -3.6, y: f2Y, z: 1.3, width: 0.92, height: 0.82, depth: 0.9, rotationY: 1.8, color: '#E3DDD2', material: 'fabric' },
        { id: 'ph_cof_2', name: 'Столик из ореха и травертина', category: 'living', type: 'coffee_table', roomId: 'living', floor: 2, x: -1.6, y: f2Y, z: -0.3, width: 1.4, height: 0.42, depth: 0.9, rotationY: 0, color: '#DFD2BC', secondaryColor: s.woodTone, material: 'marble' },

        // Crown Kitchen & Sky Terrace
        { id: 'ph_kit_2', name: 'Кухня Dark Walnut', category: 'kitchen', type: 'kitchen_set', roomId: 'kitchen', floor: 2, x: 2.5, y: f2Y, z: -4.1, width: 3.2, height: 2.2, depth: 0.68, rotationY: 0, color: s.kitchenColor, material: 'walnut' },
        { id: 'ph_isl_2', name: 'Барный остров', category: 'kitchen', type: 'kitchen_island', roomId: 'kitchen', floor: 2, x: 2.5, y: f2Y, z: -2.3, width: 1.9, height: 0.92, depth: 0.9, rotationY: 0, color: '#DED3C0', material: 'marble' },
        { id: 'ph_balc_2', name: 'Лаунж-кресло скай-террасы', category: 'living', type: 'armchair', roomId: 'balcony', floor: 2, x: 4.4, y: 3.3, z: 2.6, width: 0.88, height: 0.8, depth: 0.88, rotationY: -0.4, color: '#EAE2D6', material: 'fabric' }
      );
      return items;
    }

    case 'classic_estate':
    default:
      return getFurnishedHouseItemsForProperty(arch.propertyId, arch.propertyType);
  }
}

export function getFurnishedHouseItemsForProperty(
  propertyId = 1,
  propertyType = 'house',
  archConfig?: PropertyReconstructionConfig
): FurnitureItem[] {
  if (archConfig && archConfig.archetype !== 'classic_estate') {
    return getFurnishedHouseItemsForArchetype(archConfig);
  }

  const baseItems = getDefaultFurnishedHouseItems();
  const pid = Math.abs(propertyId || 1);
  const palette = PROPERTY_COLOR_PALETTES[pid % PROPERTY_COLOR_PALETTES.length];
  const s = archConfig?.interior;

  return baseItems.map((item, idx) => {
    const jx = (((pid * 17 + idx * 7) % 7) - 3) * 0.05;
    const jz = (((pid * 13 + idx * 5) % 7) - 3) * 0.05;

    let color = item.color;
    let secondaryColor = item.secondaryColor;
    let material = item.material;

    if (item.category === 'living' || item.type === 'sofa_sectional' || item.type === 'sofa_modern' || item.type === 'armchair') {
      color = s?.sofaColor ?? palette.sofa;
      secondaryColor = s?.accentColor ?? palette.accent;
      material = s?.sofaMaterial ?? palette.mat;
    } else if (item.category === 'bedroom' || item.type.startsWith('bed_')) {
      color = s?.bedColor ?? palette.bed;
      material = palette.mat;
    } else if (item.category === 'kitchen' || item.type === 'kitchen_set' || item.type === 'kitchen_island') {
      color = s?.kitchenColor ?? palette.kitchen;
      secondaryColor = s?.accentColor ?? palette.accent;
    } else if (item.material === 'walnut' || item.material === 'oak') {
      color = s?.woodTone ?? palette.wood;
    } else if (item.type === 'rug' && s?.rugColor) {
      color = s.rugColor;
    }

    return {
      ...item,
      x: Number((item.x + jx).toFixed(2)),
      z: Number((item.z + jz).toFixed(2)),
      color,
      secondaryColor,
      material,
    };
  });
}


