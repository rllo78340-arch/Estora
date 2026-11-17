import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Box,
  Camera,
  Check,
  Compass,
  Copy,
  Download,
  Eye,
  FolderOpen,
  Home,
  Layers,
  Lock,
  Maximize2,
  Move,
  Palette,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Undo2,
  Unlock,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../lib/api';
import { detectSoftwareGl, isWebGLAvailable, waitAfterDraw } from '../utils/webglSupport';
import {
  clampItemToHouseBounds,
  createHistoryStack,
  evaluateSceneCollisions,
  getFurnishedHouseItemsForProperty,
  HOUSE_ROOMS,
  pushHistoryState,
  redoHistoryState,
  snapValueToGrid,
  UHD_4K_DIMENSIONS,
  undoHistoryState,
  type FurnitureCategory,
  type FurnitureItem,
  type RoomId,
} from '../utils/interiorLayoutLogic';
import {
  createArchitecturalHouseGroup,
  createCompositeFurnitureGroup,
} from '../utils/proceduralArchitecture3d';
import {
  generatePropertyArchConfig,
  getDollhouseCameraForArchetype,
  getRoomCameraForArchetype,
  type PropertyReconstructionConfig,
  type VisionArchOverride,
} from '../utils/propertyReconstruction';

export type StudioViewMode = 'exterior' | 'dollhouse' | '3d' | '2d' | 'walk' | 'demo';
export type LightingPreset = 'daylight' | 'golden' | 'evening' | 'studio';

export interface RoomDesignState {
  title: string;
  viewMode: StudioViewMode;
  activeRoom: RoomId;
  activeFloorFilter: 'all' | 1 | 2;
  showRoof: boolean;
  showExteriorWalls: boolean;
  showYard: boolean;
  qualityMode: 'realtime' | 'ultra4k';
  lightingPreset: LightingPreset;
  style: 'modern' | 'minimalism' | 'scandinavian' | 'classic' | 'luxury' | 'industrial' | 'japandi';
  facadeStyle: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
  wallColor: string;
  wallFinish: 'paint' | 'plaster' | 'brick' | 'marble' | 'tile';
  floorMaterial: string;
  floorFinish: 'parquet' | 'walnut' | 'marble' | 'tile' | 'concrete';
  ceilingColor: string;
  snapStep: number;
  items: FurnitureItem[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  category: FurnitureCategory;
  defaultRoom: RoomId;
  defaultFloor: 1 | 2;
  width: number;
  height: number;
  depth: number;
  color: string;
  secondaryColor?: string;
  material: FurnitureItem['material'];
}

const FURNITURE_CATALOG: CatalogEntry[] = [
  // Living Room
  { id: 'sofa_sectional', name: 'Угловой диван Grand Milano', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 2.8, height: 0.86, depth: 1.65, color: '#2F3E46', secondaryColor: '#D4B483', material: 'fabric' },
  { id: 'sofa_modern', name: 'Прямой 3-местный диван Велюр', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 2.2, height: 0.84, depth: 0.95, color: '#3B4D54', secondaryColor: '#E5DCCB', material: 'velvet' },
  { id: 'armchair', name: 'Дизайнерское кресло Lounger', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 0.92, height: 0.84, depth: 0.9, color: '#C89F70', material: 'velvet' },
  { id: 'coffee_table', name: 'Журнальный столик Carrara', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 1.35, height: 0.44, depth: 0.75, color: '#F4F1EA', secondaryColor: '#4A3525', material: 'marble' },
  { id: 'tv_stand', name: 'ТВ-консоль + OLED 77" 4K', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 2.2, height: 1.45, depth: 0.46, color: '#3B2B20', secondaryColor: '#111111', material: 'walnut' },
  { id: 'bookshelf', name: 'Библиотечный стеллаж с книгами', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 1.4, height: 2.1, depth: 0.42, color: '#4A3525', material: 'walnut' },
  { id: 'rug', name: 'Шерстяной ковёр Samarkand Loft', category: 'living', defaultRoom: 'living', defaultFloor: 1, width: 3.2, height: 0.025, depth: 2.4, color: '#E6E1D6', secondaryColor: '#8C6D46', material: 'wool' },

  // Bedroom
  { id: 'bed_double', name: 'Кровать King Size с мягким изголовьем', category: 'bedroom', defaultRoom: 'bedroom', defaultFloor: 2, width: 2.0, height: 1.18, depth: 2.25, color: '#EAE4DC', secondaryColor: '#2A3B36', material: 'fabric' },
  { id: 'bed_single', name: 'Односпальная кровать / Тахта', category: 'bedroom', defaultRoom: 'study', defaultFloor: 2, width: 1.1, height: 0.92, depth: 2.05, color: '#D8E2DC', secondaryColor: '#4A5759', material: 'fabric' },
  { id: 'wardrobe', name: 'Гардеробный шкаф 3-створчатый', category: 'bedroom', defaultRoom: 'bedroom', defaultFloor: 2, width: 2.1, height: 2.35, depth: 0.65, color: '#3D312A', secondaryColor: '#D4B483', material: 'walnut' },
  { id: 'nightstand', name: 'Прикроватная тумба с лампой', category: 'bedroom', defaultRoom: 'bedroom', defaultFloor: 2, width: 0.55, height: 0.85, depth: 0.45, color: '#5C4033', material: 'walnut' },
  { id: 'dresser', name: 'Комод с латунной фурнитурой', category: 'bedroom', defaultRoom: 'bedroom', defaultFloor: 2, width: 1.3, height: 0.86, depth: 0.5, color: '#4A3525', material: 'walnut' },

  // Kitchen & Dining
  { id: 'kitchen_set', name: 'Кухонный гарнитур со встроенной техникой', category: 'kitchen', defaultRoom: 'kitchen', defaultFloor: 1, width: 3.6, height: 2.25, depth: 0.68, color: '#1A3C34', secondaryColor: '#EAE6DF', material: 'stone' },
  { id: 'kitchen_island', name: 'Кухонный остров с барными стульями', category: 'kitchen', defaultRoom: 'kitchen', defaultFloor: 1, width: 2.1, height: 0.92, depth: 0.95, color: '#F3EFEA', secondaryColor: '#2B2B2B', material: 'marble' },
  { id: 'fridge', name: 'Холодильник Side-by-Side', category: 'kitchen', defaultRoom: 'kitchen', defaultFloor: 1, width: 0.92, height: 2.0, depth: 0.76, color: '#CFD4D8', material: 'metal' },
  { id: 'dining_table', name: 'Обеденный стол + 4 стула', category: 'kitchen', defaultRoom: 'kitchen', defaultFloor: 1, width: 1.75, height: 0.78, depth: 1.0, color: '#7A5230', secondaryColor: '#D8D2C7', material: 'oak' },

  // Bathroom
  { id: 'bathtub', name: 'Отдельностоящая овальная ванна', category: 'bathroom', defaultRoom: 'bathroom2', defaultFloor: 2, width: 1.75, height: 0.68, depth: 0.82, color: '#FFFFFF', secondaryColor: '#D4B483', material: 'ceramic' },
  { id: 'shower', name: 'Стеклянная душевая кабина Walk-In', category: 'bathroom', defaultRoom: 'bathroom1', defaultFloor: 1, width: 1.1, height: 2.1, depth: 1.0, color: '#E8F1F5', material: 'glass' },
  { id: 'sink', name: 'Тумба с раковиной и LED-зеркалом', category: 'bathroom', defaultRoom: 'bathroom1', defaultFloor: 1, width: 1.0, height: 1.85, depth: 0.52, color: '#FFFFFF', secondaryColor: '#5C4033', material: 'ceramic' },
  { id: 'toilet', name: 'Подвесной унитаз Rimless', category: 'bathroom', defaultRoom: 'bathroom1', defaultFloor: 1, width: 0.44, height: 0.78, depth: 0.65, color: '#FFFFFF', material: 'ceramic' },

  // Office & Study
  { id: 'desk', name: 'Рабочая станция с монитором и креслом', category: 'office', defaultRoom: 'study', defaultFloor: 2, width: 1.5, height: 1.15, depth: 0.78, color: '#8C6239', secondaryColor: '#2B2D42', material: 'oak' },

  // Decor & Lighting
  { id: 'floor_lamp', name: 'Торшер Brass Arc с тёплым светом', category: 'decor', defaultRoom: 'living', defaultFloor: 1, width: 0.5, height: 1.85, depth: 0.5, color: '#D4B483', material: 'brass' },
  { id: 'plant', name: 'Фикус Лирата в керамическом кашпо', category: 'decor', defaultRoom: 'living', defaultFloor: 1, width: 0.65, height: 1.45, depth: 0.65, color: '#2D6A4F', material: 'ceramic' },
  { id: 'mirror', name: 'Ростовое зеркало в латунной раме', category: 'decor', defaultRoom: 'hallway', defaultFloor: 1, width: 0.8, height: 1.6, depth: 0.06, color: '#D4B483', material: 'glass' },
  { id: 'painting', name: 'Арт-панно Registan Gold', category: 'decor', defaultRoom: 'living', defaultFloor: 1, width: 1.5, height: 1.05, depth: 0.06, color: '#143A30', secondaryColor: '#D4B483', material: 'wood' },

  // Structural Partitions
  { id: 'partition_glass', name: 'Лофт-перегородка из закалённого стекла', category: 'partition', defaultRoom: 'living', defaultFloor: 1, width: 2.2, height: 2.8, depth: 0.08, color: '#DCEEF8', material: 'glass' },
  { id: 'partition_wall', name: 'Межкомнатная гипсокартонная перегородка', category: 'partition', defaultRoom: 'living', defaultFloor: 1, width: 2.4, height: 3.0, depth: 0.14, color: '#F2EFE9', material: 'plaster' },
];

const INTERIOR_STYLES: Record<
  RoomDesignState['style'],
  {
    name: string;
    subtitle: string;
    wall: string;
    floor: string;
    ceiling: string;
    facade: RoomDesignState['facadeStyle'];
    floorFinish: RoomDesignState['floorFinish'];
  }
> = {
  modern: { name: 'Modern Architectural', subtitle: 'Тёплый камень, дуб и графитовые акценты', wall: '#F2EFE9', floor: '#9E7347', ceiling: '#FFFFFF', facade: 'travertine', floorFinish: 'parquet' },
  minimalism: { name: 'Pure Minimalism', subtitle: 'Чистые белые плоскости и светлый микроцемент', wall: '#FFFFFF', floor: '#DCD9D0', ceiling: '#FFFFFF', facade: 'modern_white', floorFinish: 'marble' },
  scandinavian: { name: 'Scandinavian Nordic', subtitle: 'Светлый ясень, мягкий текстиль и много света', wall: '#F8F7F4', floor: '#C9AD86', ceiling: '#FFFFFF', facade: 'modern_white', floorFinish: 'parquet' },
  classic: { name: 'Neoclassic Tashkent', subtitle: 'Травертин, ореховый паркет и латунь', wall: '#FAF5EB', floor: '#614128', ceiling: '#FDFBF7', facade: 'travertine', floorFinish: 'walnut' },
  luxury: { name: 'Royal Luxury 4K', subtitle: 'Итальянский мрамор, тёмный орех и золото', wall: '#EAE4DC', floor: '#4A3222', ceiling: '#FAF8F5', facade: 'travertine', floorFinish: 'marble' },
  industrial: { name: 'Industrial Loft', subtitle: 'Клинкерный кирпич, металл и тёмное дерево', wall: '#E2DDD5', floor: '#6C6863', ceiling: '#F4F1EA', facade: 'brick', floorFinish: 'concrete' },
  japandi: { name: 'Japandi Zen', subtitle: 'Природные текстуры, низкая мебель и баланс', wall: '#EFECE6', floor: '#B89F7D', ceiling: '#F9F8F6', facade: 'travertine', floorFinish: 'parquet' },
};

const STUDIO_STORAGE_PREFIX = 'estora_3d_studio_v3_prop_';

interface StudioPropertyItem {
  id: number;
  title: string;
  propertyType: string;
  totalFloors?: number;
  bedrooms?: number;
  areaSqm?: number;
  balcony?: boolean;
  description?: string;
  amenities?: string;
  galleryImages?: string;
  imageUrl?: string;
}

const DEFAULT_STUDIO_PROPERTIES: StudioPropertyItem[] = [
  {
    id: 1,
    title: 'Резиденция Boulevard Park',
    propertyType: 'villa',
    totalFloors: 2,
    imageUrl: '/src/assets/images/hero_tashkent_residence_1794853627912.jpg',
  },
  {
    id: 3,
    title: 'Вилла Silk Road Courtyard',
    propertyType: 'villa',
    totalFloors: 2,
    imageUrl: '/src/assets/images/prop_samarkand_villa_1794853628391.jpg',
  },
  {
    id: 4,
    title: 'Пентхаус Tashkent Skyline',
    propertyType: 'penthouse',
    totalFloors: 7,
    imageUrl: '/src/assets/images/prop_tashkent_penthouse_1794853628028.jpg',
  },
  {
    id: 5,
    title: 'Исторический особняк Ark Heritage',
    propertyType: 'house',
    totalFloors: 2,
    imageUrl: '/src/assets/images/prop_bukhara_estate_1794853628569.jpg',
  },
  {
    id: 6,
    title: 'Бизнес-центр Amir Temur',
    propertyType: 'commercial',
    totalFloors: 6,
    imageUrl: '/src/assets/images/prop_luxury_office_uz_1794854288611.jpg',
  },
  {
    id: 7,
    title: 'Вилла Mirzo Courtyard',
    propertyType: 'villa',
    totalFloors: 2,
    imageUrl: '/src/assets/images/prop_modern_house_uz_1794854287490.jpg',
  },
  {
    id: 8,
    title: 'ЖК Tashkent Residences',
    propertyType: 'new_build',
    totalFloors: 8,
    imageUrl: '/src/assets/images/prop_new_build_tashkent_1794854289325.jpg',
  },
];

const SEEDED_PHOTO_TOKENS = [
  'hero_tashkent_residence',
  'hero_estora_residence',
  'prop_samarkand_villa',
  'prop_new_build_tashkent',
  'prop_bukhara_estate',
  'prop_modern_house_uz',
  'prop_commercial_tower',
  'prop_luxury_office_uz',
  'prop_tashkent_penthouse',
  'prop_tashkent_apartment',
];

function isKnownSeededPhotoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return SEEDED_PHOTO_TOKENS.some((tok) => lower.includes(tok));
}

function getFloor2Elevation(archetype: PropertyReconstructionConfig['archetype']): number {
  switch (archetype) {
    case 'tashkent_residences_complex':
      return 2.95;
    case 'commercial_glass_tower':
      return 3.18;
    case 'bukhara_heritage_courtyard':
      return 3.88;
    case 'penthouse_skyline_tower':
      return 3.25;
    case 'samarkand_courtyard_villa':
    case 'modern_pergola_villa':
      return 3.15;
    default:
      return 3.2;
  }
}

function buildInitialDesignState(
  prop: StudioPropertyItem,
  archConfig: PropertyReconstructionConfig,
  overrideTitle?: string,
  ignoreStorage = false
): RoomDesignState {
  if (!ignoreStorage) {
    try {
      const raw = localStorage.getItem(`${STUDIO_STORAGE_PREFIX}${prop.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RoomDesignState>;
        if (parsed && Array.isArray(parsed.items) && parsed.items.length >= 4) {
          return {
            title: parsed.title || prop.title || overrideTitle || archConfig.styleLabel,
            viewMode: parsed.viewMode || 'dollhouse',
            activeRoom: parsed.activeRoom || 'living',
            activeFloorFilter: parsed.activeFloorFilter || 'all',
            showRoof: parsed.showRoof ?? false,
            showExteriorWalls: parsed.showExteriorWalls ?? true,
            showYard: parsed.showYard ?? true,
            qualityMode: parsed.qualityMode || 'ultra4k',
            lightingPreset: parsed.lightingPreset || 'daylight',
            style: parsed.style || 'modern',
            facadeStyle: parsed.facadeStyle || archConfig.facadeStyle,
            wallColor: parsed.wallColor || archConfig.interior.wallColor,
            wallFinish: parsed.wallFinish || 'plaster',
            floorMaterial: parsed.floorMaterial || archConfig.interior.floorColor,
            floorFinish: parsed.floorFinish || archConfig.interior.floorFinish,
            ceilingColor: parsed.ceilingColor || INTERIOR_STYLES.modern.ceiling,
            snapStep: parsed.snapStep ?? 0.1,
            items: parsed.items,
          };
        }
      }
    } catch {
      // Ignore storage parse failure
    }
  }

  return {
    title: prop.title || overrideTitle || archConfig.styleLabel,
    viewMode: 'dollhouse',
    activeRoom: 'living',
    activeFloorFilter: 'all',
    showRoof: false,
    showExteriorWalls: true,
    showYard: true,
    qualityMode: 'ultra4k',
    lightingPreset: 'daylight',
    style: 'modern',
    facadeStyle: archConfig.facadeStyle,
    wallColor: archConfig.interior.wallColor,
    wallFinish: 'plaster',
    floorMaterial: archConfig.interior.floorColor,
    floorFinish: archConfig.interior.floorFinish,
    ceilingColor: INTERIOR_STYLES.modern.ceiling,
    snapStep: 0.1,
    items: getFurnishedHouseItemsForProperty(prop.id, prop.propertyType, archConfig),
  };
}

interface InteriorDesigner3DProps {
  propertyId?: number;
  initialTitle?: string;
  onClose?: () => void;
}

export function InteriorDesigner3D({
  propertyId,
  initialTitle = 'ESTORA 3D Архитектурная студия',
  onClose,
}: InteriorDesigner3DProps) {
  const { idToken, signInWithGoogle } = useAuth();
  const { t } = useI18n();

  const [studioProperties, setStudioProperties] = useState<StudioPropertyItem[]>(DEFAULT_STUDIO_PROPERTIES);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number>(propertyId ?? DEFAULT_STUDIO_PROPERTIES[0].id);
  const [visionMap, setVisionMap] = useState<Record<number, VisionArchOverride | null>>({});

  useEffect(() => {
    if (propertyId !== undefined) {
      setSelectedBuildingId(propertyId);
    }
  }, [propertyId]);

  useEffect(() => {
    let active = true;
    apiFetch<{ properties: StudioPropertyItem[] }>('/api/properties?limit=30')
      .then((res) => {
        if (!active || !Array.isArray(res.properties) || res.properties.length === 0) return;
        setStudioProperties((prev) => {
          const byId = new Map<number, StudioPropertyItem>();
          for (const p of res.properties) byId.set(p.id, p);
          for (const d of prev) {
            if (!byId.has(d.id) && d.id === propertyId) {
              byId.set(d.id, d);
            }
          }
          return Array.from(byId.values());
        });
      })
      .catch(() => {});

    if (propertyId !== undefined) {
      apiFetch<{ property: StudioPropertyItem }>(`/api/properties/${propertyId}`)
        .then((res) => {
          if (!active || !res?.property) return;
          setStudioProperties((prev) => {
            const exists = prev.some((p) => p.id === res.property.id);
            return exists
              ? prev.map((p) => (p.id === res.property.id ? res.property : p))
              : [res.property, ...prev];
          });
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [propertyId]);

  const activeProperty = useMemo(
    () =>
      studioProperties.find((p) => p.id === selectedBuildingId) ||
      studioProperties[0] ||
      DEFAULT_STUDIO_PROPERTIES[0],
    [studioProperties, selectedBuildingId]
  );

  // Analyze custom uploaded photo if needed
  useEffect(() => {
    const photo = (activeProperty.imageUrl || '').trim();
    if (!photo || isKnownSeededPhotoUrl(photo) || activeProperty.id in visionMap) return;

    let cancelled = false;
    fetch('/api/properties/analyze-architecture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: photo,
        title: activeProperty.title || '',
        propertyType: activeProperty.propertyType || '',
        description: activeProperty.description || '',
      }),
    })
      .then((r) => (r.ok ? r.json() : { visionOverride: null }))
      .then((data: { visionOverride?: VisionArchOverride | null }) => {
        if (cancelled) return;
        setVisionMap((prev) => ({ ...prev, [activeProperty.id]: data?.visionOverride ?? null }));
      })
      .catch(() => {
        if (!cancelled) {
          setVisionMap((prev) => ({ ...prev, [activeProperty.id]: null }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProperty, visionMap]);

  const activeVisionOverride = visionMap[activeProperty.id] ?? null;

  const activeArchConfig = useMemo(
    () => generatePropertyArchConfig(activeProperty, activeVisionOverride),
    [activeProperty, activeVisionOverride]
  );

  const archConfigRef = useRef(activeArchConfig);
  archConfigRef.current = activeArchConfig;
  const activePropertyRef = useRef(activeProperty);
  activePropertyRef.current = activeProperty;

  const initialState = useMemo<RoomDesignState>(
    () => buildInitialDesignState(activeProperty, activeArchConfig, initialTitle),
    // Only seed on mount; building switches sync via dedicated effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [history, setHistory] = useState(() => createHistoryStack<RoomDesignState>(initialState));
  const designState = history.present;
  const syncedSignatureRef = useRef<string>('');

  // Sync studio building & interior whenever user selects a different property or its Vision config resolves
  useEffect(() => {
    const signature = `${activeProperty.id}::${activeArchConfig.archetype}::${activeArchConfig.isAiVisionMatched ? 'v' : 's'}::${activeProperty.imageUrl || ''}`;
    if (syncedSignatureRef.current === signature) return;
    syncedSignatureRef.current = signature;

    const nextState = buildInitialDesignState(activeProperty, activeArchConfig, initialTitle);
    setHistory(createHistoryStack(nextState));
    setSelectedItemId(nextState.items[0]?.id ?? null);
    threeCtxRef.current.applyViewModeCamera?.(
      nextState.viewMode,
      nextState.activeRoom,
      nextState.activeFloorFilter
    );
  }, [activeProperty, activeArchConfig, initialTitle]);

  const commitState = useCallback(
    (updater: RoomDesignState | ((prev: RoomDesignState) => RoomDesignState), recordHistory = true) => {
      setHistory((prevStack) => {
        const nextState = typeof updater === 'function' ? updater(prevStack.present) : updater;
        try {
          localStorage.setItem(
            `${STUDIO_STORAGE_PREFIX}${activePropertyRef.current.id}`,
            JSON.stringify(nextState)
          );
        } catch {
          // Ignore quota error
        }
        if (!recordHistory) {
          return { ...prevStack, present: nextState };
        }
        return pushHistoryState(prevStack, nextState);
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => undoHistoryState(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoHistoryState(prev));
  }, []);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialState.items[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'materials' | 'styles' | 'partitions' | 'saved'>('catalog');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<FurnitureCategory | 'all'>('all');
  const [savedDesigns, setSavedDesigns] = useState<Array<{ id: number; title: string; updatedAt: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [render4KModal, setRender4KModal] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    timestamp: string;
  } | null>(null);
  const [rendering4K, setRendering4K] = useState(false);

  // Real-time collision & doorway clearance report tailored to the active building archetype
  const collisionReport = useMemo(
    () => evaluateSceneCollisions(designState.items, activeArchConfig.archetype),
    [designState.items, activeArchConfig.archetype]
  );

  const collidingIdsSet = useMemo(() => {
    const s = new Set<string>();
    for (const [a, b] of collisionReport.overlappingPairs) {
      s.add(a);
      s.add(b);
    }
    for (const id of collisionReport.outOfBoundsIds) s.add(id);
    for (const bd of collisionReport.blockedDoors) s.add(bd.itemId);
    return s;
  }, [collisionReport]);

  // Three.js viewport refs
  const containerRef = useRef<HTMLDivElement>(null);
  const threeCtxRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    houseRoot?: THREE.Group;
    furnitureRoot?: THREE.Group;
    furnitureMap: Map<string, THREE.Group>;
    floorMeshes: THREE.Object3D[];
    keyLight?: THREE.DirectionalLight;
    hemiLight?: THREE.HemisphereLight;
    requestRender?: () => void;
    walkCameraStep?: (forward: number, strafe: number, yawDelta: number) => void;
    teleportToRoom?: (roomId: RoomId) => void;
    applyViewModeCamera?: (mode: StudioViewMode, room: RoomId, floorFilter: 'all' | 1 | 2) => void;
  }>({
    furnitureMap: new Map(),
    floorMeshes: [],
  });

  const designStateRef = useRef(designState);
  designStateRef.current = designState;
  const selectedItemIdRef = useRef(selectedItemId);
  selectedItemIdRef.current = selectedItemId;

  // Load saved designs from PostgreSQL
  const refreshSavedDesigns = useCallback(() => {
    if (!idToken) return;
    apiFetch<{ designs: Array<{ id: number; title: string; updatedAt: string }> }>('/api/designs', {
      token: idToken,
    })
      .then((res) => setSavedDesigns(res.designs))
      .catch(() => {});
  }, [idToken]);

  useEffect(() => {
    refreshSavedDesigns();
  }, [refreshSavedDesigns]);

  // Keyboard shortcuts (Undo/Redo, Delete, WASD in walkthrough mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (designStateRef.current.viewMode === 'walk' && threeCtxRef.current.walkCameraStep) {
        const key = e.key.toLowerCase();
        if (key === 'w' || e.key === 'ArrowUp') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(0.45, 0, 0);
        } else if (key === 's' || e.key === 'ArrowDown') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(-0.45, 0, 0);
        } else if (key === 'a') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(0, -0.4, 0);
        } else if (key === 'd') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(0, 0.4, 0);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(0, 0, 0.12);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          threeCtxRef.current.walkCameraStep(0, 0, -0.12);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Initialize Three.js Scene, Renderer, Controls, Raycaster & Floor Dragging
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isWebGLAvailable()) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(280, container.clientHeight || 640);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdce6f0);
    scene.fog = new THREE.Fog(0xdce6f0, 32, 85);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 220);
    camera.position.set(17.5, 16.5, 19.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.minDistance = 0.8;
    controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 2.2, 0);

    // Lighting rig
    const hemiLight = new THREE.HemisphereLight(0xe4effa, 0x453d34, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.1);
    keyLight.position.set(15, 24, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(isSoftwareGl ? 512 : 2048, isSoftwareGl ? 512 : 2048);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc8daf0, 0.65);
    fillLight.position.set(-14, 12, -12);
    scene.add(fillLight);

    // Warm interior ceiling lights across rooms
    const roomLightsCoords: Array<[number, number, number]> = [
      [-3.5, 2.95, -0.5], // Living
      [3.5, 2.95, -1.8],  // Kitchen
      [1.8, 2.95, 3.0],   // Hallway
      [5.3, 2.95, 3.0],   // Bath 1
      [-3.5, 5.95, -1.2], // Master Bedroom
      [3.5, 5.95, -1.8],  // Study
      [5.3, 5.95, 3.0],   // Bath 2
    ];
    for (const [lx, ly, lz] of roomLightsCoords) {
      const pt = new THREE.PointLight(0xffe6ba, 1.05, 11);
      pt.position.set(lx, ly, lz);
      scene.add(pt);
    }

    // Subtle ground architectural coordinate grid
    const grid = new THREE.GridHelper(32, 32, 0x6b7075, 0x9aa0a6);
    grid.position.y = -0.14;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    scene.add(grid);

    const houseRoot = new THREE.Group();
    const furnitureRoot = new THREE.Group();
    scene.add(houseRoot);
    scene.add(furnitureRoot);

    let disposed = false;
    let frameId = 0;
    const timers: number[] = [];
    let renderBusy = false;
    let renderDirty = false;
    const registerTimer = (id: number) => timers.push(id);

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || (controls.autoRotate && !isSoftwareGl))) {
            requestRender();
          }
        };
        if (isSoftwareGl) {
          waitAfterDraw(renderer, registerTimer, done);
        } else {
          done();
        }
      });
    };

    const applyViewModeCamera = (
      mode: StudioViewMode,
      room: RoomId,
      floorFilter: 'all' | 1 | 2
    ) => {
      const cfg = archConfigRef.current;
      controls.autoRotate = mode === 'demo' && !isSoftwareGl;
      controls.autoRotateSpeed = 1.1;

      if (mode === '2d') {
        const targetY = floorFilter === 2 ? getFloor2Elevation(cfg.archetype) : 0;
        camera.position.set(0, 24.5, 0.01);
        controls.target.set(0, targetY, 0);
      } else if (mode === 'exterior' || mode === 'demo') {
        camera.position.set(...cfg.cameraPos);
        controls.target.set(...cfg.cameraTarget);
      } else if (mode === 'dollhouse') {
        const dhMode = floorFilter === 1 ? 'floor1' : floorFilter === 2 ? 'floor2' : 'dollhouse';
        const cam = getDollhouseCameraForArchetype(cfg.archetype, dhMode);
        camera.position.set(...cam.pos);
        controls.target.set(...cam.target);
      } else if (mode === 'walk') {
        const cam = getRoomCameraForArchetype(cfg.archetype, room);
        const rm = HOUSE_ROOMS[room] || HOUSE_ROOMS.living;
        const eyeY = rm.floor === 2 ? getFloor2Elevation(cfg.archetype) + 1.65 : 1.68;
        camera.position.set(cam.pos[0], eyeY, cam.pos[2]);
        controls.target.set(cam.target[0], eyeY - 0.08, cam.target[2]);
      } else {
        // '3d' room focus
        const cam = getRoomCameraForArchetype(cfg.archetype, room);
        camera.position.set(...cam.pos);
        controls.target.set(...cam.target);
      }
      const w = Math.max(320, container.clientWidth || 800);
      const h = Math.max(320, container.clientHeight || 600);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      controls.update();
      renderer.render(scene, camera);
      requestRender();
    };

    const teleportToRoom = (roomId: RoomId) => {
      const cam = getRoomCameraForArchetype(archConfigRef.current.archetype, roomId);
      camera.position.set(...cam.pos);
      controls.target.set(...cam.target);
      const w = Math.max(320, container.clientWidth || 800);
      const h = Math.max(320, container.clientHeight || 600);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      controls.update();
      renderer.render(scene, camera);
      requestRender();
    };

    const walkCameraStep = (forward: number, strafe: number, yawDelta: number) => {
      const dir = new THREE.Vector3().subVectors(controls.target, camera.position);
      dir.y = 0;
      if (dir.lengthSq() < 0.0001) dir.set(0, 0, -1);
      dir.normalize();

      if (yawDelta !== 0) {
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawDelta);
      }

      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const move = new THREE.Vector3()
        .addScaledVector(dir, forward)
        .addScaledVector(right, strafe);

      camera.position.add(move);
      controls.target.copy(camera.position).addScaledVector(dir, 2.5);
      controls.update();
      renderer.render(scene, camera);
      requestRender();
    };

    threeCtxRef.current = {
      renderer,
      scene,
      camera,
      controls,
      houseRoot,
      furnitureRoot,
      furnitureMap: new Map(),
      floorMeshes: [],
      keyLight,
      hemiLight,
      requestRender,
      walkCameraStep,
      teleportToRoom,
      applyViewModeCamera,
    };

    // Raycasting & Direct Floor-Plane Dragging of Furniture
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragIntersect = new THREE.Vector3();
    let draggingItemId: string | null = null;
    let dragOffset = new THREE.Vector3();
    let pointerDownPos = { x: 0, y: 0 };
    let didDragMove = false;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const findFurnitureGroup = (obj: THREE.Object3D | null): string | null => {
      let curr: THREE.Object3D | null = obj;
      while (curr) {
        if (curr.userData && typeof curr.userData.furnitureId === 'string') {
          return curr.userData.furnitureId;
        }
        curr = curr.parent;
      }
      return null;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
      didDragMove = false;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      const furnitureObjects = Array.from(threeCtxRef.current.furnitureMap.values());
      const hits = raycaster.intersectObjects(furnitureObjects, true);
      if (hits.length > 0) {
        const hitId = findFurnitureGroup(hits[0].object);
        if (hitId) {
          setSelectedItemId(hitId);
          const targetItem = designStateRef.current.items.find((it) => it.id === hitId);
          if (targetItem && !targetItem.locked) {
            draggingItemId = hitId;
            const planeY =
              targetItem.floor === 2 ? getFloor2Elevation(archConfigRef.current.archetype) : 0;
            dragPlane.setComponents(0, 1, 0, -planeY);
            if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
              dragOffset.set(targetItem.x - dragIntersect.x, 0, targetItem.z - dragIntersect.z);
            }
            controls.enabled = false;
          }
          requestRender();
        }
      }
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingItemId) return;
      if (Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y) > 4) {
        didDragMove = true;
      }
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);

      if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        const step = designStateRef.current.snapStep || 0.1;
        const nextX = snapValueToGrid(dragIntersect.x + dragOffset.x, step);
        const nextZ = snapValueToGrid(dragIntersect.z + dragOffset.z, step);

        const grp = threeCtxRef.current.furnitureMap.get(draggingItemId);
        if (grp) {
          grp.position.x = nextX;
          grp.position.z = nextZ;
          renderer.render(scene, camera);
          requestRender();
        }
      }
    };

    const finishDrag = () => {
      if (!draggingItemId) return;
      const finishedId = draggingItemId;
      draggingItemId = null;
      controls.enabled = true;

      if (didDragMove) {
        const grp = threeCtxRef.current.furnitureMap.get(finishedId);
        if (grp) {
          const finalX = Number(grp.position.x.toFixed(2));
          const finalZ = Number(grp.position.z.toFixed(2));
          const currArch = archConfigRef.current.archetype;
          commitState((prev) => ({
            ...prev,
            items: prev.items.map((it) =>
              it.id === finishedId ? clampItemToHouseBounds({ ...it, x: finalX, z: finalZ }, currArch) : it
            ),
          }));
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishDrag);

    const onControlsChange = () => requestRender();
    controls.addEventListener('change', onControlsChange);

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(300, entry.contentRect.width);
      const h = Math.max(300, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      controls.update();
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    applyViewModeCamera(
      designStateRef.current.viewMode,
      designStateRef.current.activeRoom,
      designStateRef.current.activeFloorFilter
    );

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      timers.forEach((t) => window.clearTimeout(t));
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, [commitState]);

  // Sync Scene Architecture, Lighting & Furniture whenever designState or selection changes
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx.scene || !ctx.houseRoot || !ctx.furnitureRoot || !ctx.renderer || !ctx.camera) return;

    const isSoftwareGl = detectSoftwareGl();
    const isUltra4K = designState.qualityMode === 'ultra4k';

    // Update lighting preset & sky background
    if (ctx.keyLight && ctx.hemiLight) {
      if (designState.lightingPreset === 'golden') {
        ctx.scene.background = new THREE.Color(0xf3d5b5);
        ctx.scene.fog = new THREE.Fog(0xf3d5b5, 32, 85);
        ctx.keyLight.color.setHex(0xffb86c);
        ctx.keyLight.intensity = 2.3;
        ctx.keyLight.position.set(22, 11, 18);
      } else if (designState.lightingPreset === 'evening') {
        ctx.scene.background = new THREE.Color(0x141c29);
        ctx.scene.fog = new THREE.Fog(0x141c29, 30, 80);
        ctx.keyLight.color.setHex(0x88a4cc);
        ctx.keyLight.intensity = 0.65;
        ctx.hemiLight.intensity = 0.45;
      } else if (designState.lightingPreset === 'studio') {
        ctx.scene.background = new THREE.Color(0xf2f0ec);
        ctx.scene.fog = new THREE.Fog(0xf2f0ec, 35, 90);
        ctx.keyLight.color.setHex(0xffffff);
        ctx.keyLight.intensity = 2.0;
        ctx.hemiLight.intensity = 1.15;
      } else {
        // daylight
        ctx.scene.background = new THREE.Color(0xdce6f0);
        ctx.scene.fog = new THREE.Fog(0xdce6f0, 32, 85);
        ctx.keyLight.color.setHex(0xfff4e0);
        ctx.keyLight.intensity = 2.1;
        ctx.keyLight.position.set(15, 24, 16);
        ctx.hemiLight.intensity = 0.95;
      }
    }

    // Clear and rebuild architectural shell
    while (ctx.houseRoot.children.length > 0) {
      const child = ctx.houseRoot.children[0];
      ctx.houseRoot.remove(child);
    }

    const effectiveShowRoof =
      designState.viewMode === 'exterior' || designState.viewMode === 'demo'
        ? true
        : designState.viewMode === 'dollhouse' || designState.viewMode === '2d'
          ? designState.showRoof
          : false;

    const effectiveWallOpacity =
      designState.viewMode === 'dollhouse' || designState.viewMode === '2d'
        ? 0.24
        : 1.0;

    const houseGroup = createArchitecturalHouseGroup({
      wallColor: activeArchConfig.wallColor,
      wallFinish: designState.wallFinish,
      floorMaterial: designState.floorMaterial,
      floorFinish: designState.floorFinish,
      ceilingColor: designState.ceilingColor,
      facadeStyle: designState.facadeStyle,
      archetype: activeArchConfig.archetype,
      accentColor: activeArchConfig.accentColor,
      interiorWallColor: designState.wallColor,
      interiorFloorColor: designState.floorMaterial,
      poolPlacement: activeArchConfig.poolPlacement,
      hasPergola: activeArchConfig.hasPergola,
      hasWoodBalconies: activeArchConfig.hasWoodBalconies,
      hasGlassSunroom: activeArchConfig.hasGlassSunroom,
      hasCourtyardArches: activeArchConfig.hasCourtyardArches,
      hasGarage: activeArchConfig.hasGarage,
      hasPool: activeArchConfig.hasPool,
      hasBalcony: activeArchConfig.hasBalcony,
      hasTerrace: activeArchConfig.hasTerrace,
      roofType: activeArchConfig.roofType,
      floors: activeArchConfig.floors,
      showRoof: effectiveShowRoof,
      showExteriorWalls: designState.showExteriorWalls,
      exteriorWallOpacity: effectiveWallOpacity,
      activeFloorFilter: designState.activeFloorFilter,
      showYard: designState.showYard,
      isUltra4K,
      isSoftwareGl,
    });
    ctx.houseRoot.add(houseGroup);

    // Clear and rebuild composite furniture groups
    while (ctx.furnitureRoot.children.length > 0) {
      const child = ctx.furnitureRoot.children[0];
      ctx.furnitureRoot.remove(child);
    }
    ctx.furnitureMap.clear();

    const isFullExteriorPenthouse =
      activeArchConfig.archetype === 'penthouse_skyline_tower' && effectiveShowRoof;
    const penthouseCrownOffsetY = isFullExteriorPenthouse
      ? (Math.max(5, Math.min(9, activeArchConfig.floors || 7)) - 1) * 3.0 - 3.25
      : 0;

    for (const item of designState.items) {
      if (
        designState.activeFloorFilter !== 'all' &&
        item.floor !== designState.activeFloorFilter
      ) {
        continue;
      }
      const isSelected = item.id === selectedItemId;
      const hasCollision = collidingIdsSet.has(item.id);
      const furnGroup = createCompositeFurnitureGroup(item, {
        isSelected,
        hasCollision,
        isUltra4K,
        isSoftwareGl,
      });
      const yPos =
        isFullExteriorPenthouse && item.floor === 2
          ? item.y + penthouseCrownOffsetY
          : item.y;
      furnGroup.position.set(item.x, yPos, item.z);
      furnGroup.rotation.y = item.rotationY;
      ctx.furnitureRoot.add(furnGroup);
      ctx.furnitureMap.set(item.id, furnGroup);
    }

    if (containerRef.current) {
      const w = Math.max(320, containerRef.current.clientWidth || 800);
      const h = Math.max(320, containerRef.current.clientHeight || 600);
      ctx.camera.aspect = w / h;
      ctx.camera.updateProjectionMatrix();
      ctx.renderer.setSize(w, h);
    }
    ctx.controls?.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.requestRender?.();
  }, [designState, selectedItemId, collidingIdsSet, activeArchConfig]);

  // Actions
  const handleSelectViewMode = (mode: StudioViewMode) => {
    commitState((prev) => ({
      ...prev,
      viewMode: mode,
      showRoof: mode === 'exterior' || mode === 'demo',
    }), false);
    threeCtxRef.current.applyViewModeCamera?.(
      mode,
      designState.activeRoom,
      designState.activeFloorFilter
    );
  };

  const handleTeleportRoom = (roomId: RoomId) => {
    const rm = HOUSE_ROOMS[roomId];
    const nextFloorFilter = rm.floor;
    commitState((prev) => ({
      ...prev,
      activeRoom: roomId,
      viewMode: roomId === 'yard' ? 'exterior' : prev.viewMode === 'exterior' ? '3d' : prev.viewMode,
      activeFloorFilter: roomId === 'yard' ? 'all' : nextFloorFilter,
      showRoof: roomId === 'yard',
    }), false);
    threeCtxRef.current.teleportToRoom?.(roomId);
  };

  const handleAddItem = (entry: CatalogEntry) => {
    const targetRoomId =
      designState.activeRoom && designState.activeRoom !== 'yard'
        ? designState.activeRoom
        : entry.defaultRoom;
    const room = HOUSE_ROOMS[targetRoomId] || HOUSE_ROOMS.living;
    const roomTarget = getRoomCameraForArchetype(activeArchConfig.archetype, room.id).target;
    const centerX = snapValueToGrid(roomTarget[0] + (Math.random() - 0.5) * 0.9, designState.snapStep);
    const centerZ = snapValueToGrid(roomTarget[2] + (Math.random() - 0.5) * 0.9, designState.snapStep);
    const baseFloorY = room.floor === 2 ? getFloor2Elevation(activeArchConfig.archetype) : 0.06;

    const newItem: FurnitureItem = clampItemToHouseBounds(
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: entry.name,
        category: entry.category,
        type: entry.id.startsWith('partition_') ? 'partition' : entry.id,
        roomId: room.id,
        floor: room.floor,
        x: centerX,
        y: baseFloorY,
        z: centerZ,
        width: entry.width,
        height: entry.height,
        depth: entry.depth,
        rotationY: 0,
        color: entry.color,
        secondaryColor: entry.secondaryColor,
        material: entry.material,
      },
      activeArchConfig.archetype
    );

    commitState((prev) => ({
      ...prev,
      activeFloorFilter: prev.activeFloorFilter === 'all' ? 'all' : room.floor,
      items: [...prev.items, newItem],
    }));
    setSelectedItemId(newItem.id);
  };

  const updateSelectedItem = (patch: Partial<FurnitureItem>) => {
    if (!selectedItemId) return;
    commitState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === selectedItemId
          ? clampItemToHouseBounds({ ...it, ...patch }, activeArchConfig.archetype)
          : it
      ),
    }));
  };

  const deleteSelectedItem = () => {
    if (!selectedItemId) return;
    const target = designState.items.find((it) => it.id === selectedItemId);
    if (target?.locked) return;
    commitState((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== selectedItemId),
    }));
    setSelectedItemId(null);
  };

  const duplicateSelectedItem = () => {
    if (!selectedItemId) return;
    const target = designState.items.find((it) => it.id === selectedItemId);
    if (!target) return;
    const copy: FurnitureItem = clampItemToHouseBounds(
      {
        ...target,
        id: `item_${Date.now()}`,
        name: `${target.name} (копия)`,
        x: target.x + 0.6,
        z: target.z + 0.6,
        locked: false,
      },
      activeArchConfig.archetype
    );
    commitState((prev) => ({
      ...prev,
      items: [...prev.items, copy],
    }));
    setSelectedItemId(copy.id);
  };

  const handleResetDefaultHouse = () => {
    try {
      localStorage.removeItem(`${STUDIO_STORAGE_PREFIX}${activeProperty.id}`);
    } catch {
      // ignore
    }
    const freshState = buildInitialDesignState(activeProperty, activeArchConfig, initialTitle, true);
    commitState(freshState);
    setSelectedItemId(freshState.items[0]?.id ?? null);
    setSaveNotice(`Интерьер объекта «${activeProperty.title}» восстановлен по фото.`);
  };

  // True 4K UHD (3840x2160) Offscreen/Resized Render & PNG Export
  const handleExport4KRender = async () => {
    const ctx = threeCtxRef.current;
    if (!ctx.renderer || !ctx.scene || !ctx.camera || !containerRef.current) return;

    setRendering4K(true);
    setSaveNotice(null);

    await new Promise((r) => window.setTimeout(r, 40));

    try {
      const origWidth = containerRef.current.clientWidth || 960;
      const origHeight = containerRef.current.clientHeight || 640;
      const origPixelRatio = ctx.renderer.getPixelRatio();
      const origAspect = ctx.camera.aspect;

      const targetW = UHD_4K_DIMENSIONS.width;  // 3840
      const targetH = UHD_4K_DIMENSIONS.height; // 2160

      ctx.renderer.setPixelRatio(1);
      ctx.renderer.setSize(targetW, targetH, false);
      ctx.camera.aspect = targetW / targetH;
      ctx.camera.updateProjectionMatrix();

      ctx.renderer.render(ctx.scene, ctx.camera);
      const dataUrl = ctx.renderer.domElement.toDataURL('image/png');

      // Restore interactive viewport dimensions
      ctx.renderer.setPixelRatio(origPixelRatio);
      ctx.renderer.setSize(origWidth, origHeight);
      ctx.camera.aspect = origAspect;
      ctx.camera.updateProjectionMatrix();
      ctx.renderer.render(ctx.scene, ctx.camera);

      setRender4KModal({
        dataUrl,
        width: targetW,
        height: targetH,
        timestamp: new Date().toLocaleTimeString('ru-RU'),
      });

      // Trigger automatic download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${designState.title.replace(/\s+/g, '-').toLowerCase()}-4k-3840x2160.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setSaveNotice('Не удалось сформировать 4K-рендер.');
    } finally {
      setRendering4K(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!idToken) {
      await signInWithGoogle();
      return;
    }
    setSaving(true);
    setSaveNotice(null);
    try {
      let thumb = '';
      if (threeCtxRef.current.renderer && threeCtxRef.current.scene && threeCtxRef.current.camera) {
        threeCtxRef.current.renderer.render(threeCtxRef.current.scene, threeCtxRef.current.camera);
        thumb = threeCtxRef.current.renderer.domElement.toDataURL('image/jpeg', 0.6);
      }

      await apiFetch('/api/designs', {
        method: 'POST',
        token: idToken,
        body: JSON.stringify({
          title: designState.title,
          propertyId: activeProperty.id ?? propertyId ?? null,
          designJson: JSON.stringify(designState),
          thumbnailUrl: thumb.slice(0, 120000),
        }),
      });
      refreshSavedDesigns();
      setSaveNotice('Проект 3D-планировки и интерьера успешно сохранён в облаке ESTORA!');
    } catch (err: unknown) {
      setSaveNotice(err instanceof Error ? err.message : 'Ошибка сохранения проекта');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavedDesign = async (id: number) => {
    if (!idToken) return;
    try {
      await apiFetch(`/api/designs/${id}`, { method: 'DELETE', token: idToken });
      refreshSavedDesigns();
    } catch {
      // ignore
    }
  };

  const selectedItem = designState.items.find((it) => it.id === selectedItemId) ?? null;

  const filteredCatalog = useMemo(
    () =>
      catalogCategoryFilter === 'all'
        ? FURNITURE_CATALOG
        : FURNITURE_CATALOG.filter((c) => c.category === catalogCategoryFilter),
    [catalogCategoryFilter]
  );

  return (
    <div
      data-testid="interior-designer-3d"
      className="flex min-h-[calc(100vh-73px)] w-full flex-col bg-[#F8F8F7] text-[#171717] dark:bg-[#111111] dark:text-[#F5F5F5]"
    >
      {/* Top Studio Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E4E0] bg-white px-4 py-2.5 sm:px-6 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-2.5 py-1 dark:border-[#343434] dark:bg-[#141414]">
            <Home className="h-3.5 w-3.5 shrink-0 text-[#143A30] dark:text-[#D4B483]" aria-hidden="true" />
            <select
              data-testid="studio-property-selector"
              aria-label="Выбрать здание из каталога ESTORA"
              value={activeProperty.id}
              onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
              className="max-w-[230px] truncate bg-transparent text-xs font-semibold text-[#171717] outline-none dark:text-[#F5F5F5]"
            >
              {studioProperties.map((prop) => (
                <option key={prop.id} value={prop.id} className="bg-white text-[#171717] dark:bg-[#1C1C1C] dark:text-[#F5F5F5]">
                  {prop.title}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            aria-label="Название 3D-проекта"
            value={designState.title}
            onChange={(e) =>
              commitState((prev) => ({ ...prev, title: e.target.value }), false)
            }
            className="w-40 truncate rounded-[10px] border border-transparent bg-transparent px-2 py-1 font-display text-sm font-semibold hover:border-[#E5E4E0] focus:border-[#143A30] focus:bg-white sm:w-52 sm:text-base dark:hover:border-[#343434] dark:focus:bg-[#141414]"
          />
          <span className="hidden max-w-[240px] truncate rounded-[8px] bg-[#143A30]/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#143A30] xl:inline-block dark:bg-[#D4B483]/15 dark:text-[#D4B483]">
            {activeArchConfig.styleLabel}
          </span>
        </div>

        {/* Camera & Architectural View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Режимы 3D-визуализации"
            className="inline-flex flex-wrap items-center rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-1 dark:border-[#343434] dark:bg-[#141414]"
          >
            {(
              [
                { id: 'exterior', label: 'Дом 360°' },
                { id: 'dollhouse', label: 'Dollhouse' },
                { id: '3d', label: 'Комната 3D' },
                { id: '2d', label: '2D План' },
                { id: 'walk', label: 'Прогулка (1-е лицо)' },
                { id: 'demo', label: 'Авто-тур' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`studio-view-${m.id}`}
                onClick={() => handleSelectViewMode(m.id)}
                className={`min-h-[32px] rounded-[9px] px-2.5 text-xs font-medium transition-colors ${
                  designState.viewMode === m.id
                    ? 'bg-[#143A30] text-white shadow-xs dark:bg-[#D4B483] dark:text-[#111111]'
                    : 'text-[#525252] hover:text-[#171717] dark:text-[#A0A0A0] dark:hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className="inline-flex items-center rounded-[12px] border border-[#E5E4E0] bg-white p-0.5 dark:border-[#343434] dark:bg-[#141414]">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.past.length === 0}
              title="Отменить (Ctrl+Z)"
              aria-label="Отменить действие"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#525252] hover:bg-[#F8F8F7] disabled:opacity-35 dark:text-[#A0A0A0] dark:hover:bg-[#262626]"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={history.future.length === 0}
              title="Повторить (Ctrl+Y)"
              aria-label="Повторить действие"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#525252] hover:bg-[#F8F8F7] disabled:opacity-35 dark:text-[#A0A0A0] dark:hover:bg-[#262626]"
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Graphics Quality Toggle: Real-time vs Ultra 4K */}
          <button
            type="button"
            data-testid="toggle-quality-4k"
            onClick={() =>
              commitState(
                (prev) => ({
                  ...prev,
                  qualityMode: prev.qualityMode === 'ultra4k' ? 'realtime' : 'ultra4k',
                }),
                false
              )
            }
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] border px-3 text-xs font-semibold transition-colors ${
              designState.qualityMode === 'ultra4k'
                ? 'border-[#8C6D46] bg-[#D4B483]/20 text-[#8C6D46] dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                : 'border-[#E5E4E0] bg-white text-[#525252] dark:border-[#343434] dark:bg-[#141414] dark:text-[#A0A0A0]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{designState.qualityMode === 'ultra4k' ? 'Ultra 4K' : 'Real-Time'}</span>
          </button>

          {/* True 4K UHD Render Export Button */}
          <button
            type="button"
            data-testid="export-4k-render-btn"
            onClick={() => void handleExport4KRender()}
            disabled={rendering4K}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] border border-[#143A30] bg-white px-3 text-xs font-semibold text-[#143A30] hover:bg-[#F3F7F5] disabled:opacity-50 dark:border-[#D4B483] dark:bg-[#141414] dark:text-[#D4B483]"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{rendering4K ? 'Рендер 4K...' : 'Рендер 4K (3840×2160)'}</span>
          </button>

          {/* Save Project */}
          <button
            type="button"
            data-testid="save-design-btn"
            onClick={() => void handleSaveDesign()}
            disabled={saving}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-[12px] bg-[#143A30] px-3.5 text-xs font-medium text-white hover:bg-[#0F2C24]"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{saving ? t.common.saving : t.common.save}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#E5E4E0] hover:bg-[#F8F8F7] dark:border-[#343434] dark:hover:bg-[#262626]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Save / Collision Notification Bar */}
      {saveNotice && (
        <div className="flex items-center justify-between bg-[#143A30] px-6 py-2 text-xs font-medium text-white dark:bg-[#D4B483] dark:text-[#111111]">
          <span>{saveNotice}</span>
          <button type="button" onClick={() => setSaveNotice(null)} className="underline">
            Закрыть
          </button>
        </div>
      )}

      {collisionReport.hasIssues && (
        <div
          data-testid="collision-warning-banner"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F59E0B]/40 bg-[#FFFBEB] px-6 py-2 text-xs font-medium text-[#92400E] dark:bg-[#2E2110] dark:text-[#FCD34D]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {collisionReport.overlappingPairs.length > 0 &&
                `Пересечение предметов мебели (${collisionReport.overlappingPairs.length}). `}
              {collisionReport.blockedDoors.length > 0 &&
                `Перекрыт дверной проём: ${collisionReport.blockedDoors[0].doorName}. `}
              {collisionReport.outOfBoundsIds.length > 0 &&
                `Предмет выходит за границы стены.`}
            </span>
          </div>
          <span className="font-mono text-[11px]">Переместите выделенный предмет</span>
        </div>
      )}

      {/* Main 3-Column Studio Workspace */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:h-[740px] lg:grid-cols-12">
        {/* Left Sidebar: Furniture Catalog, Materials, Styles, Partitions, Saved Projects */}
        <div className="flex max-h-[46vh] min-h-0 flex-col overflow-hidden border-b border-[#E5E4E0] bg-white lg:col-span-3 lg:h-[740px] lg:max-h-[740px] lg:border-b-0 lg:border-e dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <div className="grid grid-cols-5 gap-1 border-b border-[#E5E4E0] p-2 dark:border-[#2C2C2C]">
            {[
              { id: 'catalog', label: 'Мебель', icon: Box },
              { id: 'materials', label: 'Отделка', icon: Palette },
              { id: 'styles', label: 'Стили', icon: Sparkles },
              { id: 'partitions', label: 'Стены', icon: Ruler },
              { id: 'saved', label: 'Проекты', icon: FolderOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`studio-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex min-h-[38px] flex-col items-center justify-center gap-0.5 rounded-[10px] px-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#143A30] text-white dark:bg-[#D4B483] dark:text-[#111111]'
                      : 'text-[#525252] hover:bg-[#F8F8F7] dark:text-[#A0A0A0] dark:hover:bg-[#262626]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {activeTab === 'catalog' && (
              <div className="space-y-4">
                {/* Category Filter Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'Все (26+)' },
                    { id: 'living', label: 'Гостиная' },
                    { id: 'bedroom', label: 'Спальня' },
                    { id: 'kitchen', label: 'Кухня' },
                    { id: 'bathroom', label: 'Ванная' },
                    { id: 'office', label: 'Кабинет' },
                    { id: 'decor', label: 'Декор/Свет' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCatalogCategoryFilter(cat.id as typeof catalogCategoryFilter)}
                      className={`rounded-[9px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        catalogCategoryFilter === cat.id
                          ? 'bg-[#143A30] text-white dark:bg-[#D4B483] dark:text-[#111111]'
                          : 'bg-[#F8F8F7] text-[#525252] hover:bg-[#E5E4E0] dark:bg-[#141414] dark:text-[#A0A0A0]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Catalog Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredCatalog.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      data-testid={`add-catalog-${entry.id}`}
                      onClick={() => handleAddItem(entry)}
                      className="group flex flex-col items-start justify-between rounded-[14px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-start transition-all hover:border-[#143A30] hover:bg-white dark:border-[#343434] dark:bg-[#141414] dark:hover:border-[#D4B483]"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span
                          className="h-4 w-4 rounded-full border border-black/15"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="rounded-[6px] bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-[#525252] dark:bg-white/10 dark:text-[#A0A0A0]">
                          {entry.defaultFloor} эт.
                        </span>
                      </div>
                      <span className="mt-2 line-clamp-2 text-xs font-semibold text-[#171717] group-hover:text-[#143A30] dark:text-[#F5F5F5] dark:group-hover:text-[#D4B483]">
                        {entry.name}
                      </span>
                      <span className="mt-1 font-mono text-[10px] text-[#737373] dark:text-[#A0A0A0]">
                        {entry.width}×{entry.depth}×{entry.height} м
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="space-y-5">
                {/* Facade Exterior Finish */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Материал фасада дома (Экстерьер)
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { id: 'travertine', label: 'Травертин' },
                      { id: 'brick', label: 'Клинкер' },
                      { id: 'modern_white', label: 'Белый минимализм' },
                    ].map((fac) => (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() =>
                          commitState((prev) => ({
                            ...prev,
                            facadeStyle: fac.id as RoomDesignState['facadeStyle'],
                          }))
                        }
                        className={`rounded-[10px] border p-2 text-center text-xs font-medium ${
                          designState.facadeStyle === fac.id
                            ? 'border-[#143A30] bg-[#143A30] text-white dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                            : 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414]'
                        }`}
                      >
                        {fac.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wall Finish & Color */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Фактура и цвет внутренних стен
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'plaster', label: 'Декор. штукатурка' },
                      { id: 'paint', label: 'Матовая краска' },
                      { id: 'marble', label: 'Мрамор' },
                      { id: 'brick', label: 'Лофт-кирпич' },
                      { id: 'tile', label: 'Керамогранит' },
                    ].map((wf) => (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() =>
                          commitState((prev) => ({
                            ...prev,
                            wallFinish: wf.id as RoomDesignState['wallFinish'],
                          }))
                        }
                        className={`rounded-[9px] border px-2 py-1.5 text-[11px] font-medium ${
                          designState.wallFinish === wf.id
                            ? 'border-[#143A30] bg-[#143A30] text-white dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                            : 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414]'
                        }`}
                      >
                        {wf.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5 grid grid-cols-4 gap-2">
                    {[
                      '#F2EFE9',
                      '#FFFFFF',
                      '#FAF5EB',
                      '#E4E9ED',
                      '#D9E2DC',
                      '#E8DDD3',
                      '#363B40',
                      '#232E2B',
                    ].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          commitState((prev) => ({ ...prev, wallColor: color }))
                        }
                        style={{ backgroundColor: color }}
                        className={`h-9 rounded-[10px] border shadow-xs ${
                          designState.wallColor === color
                            ? 'ring-2 ring-[#143A30] dark:ring-[#D4B483]'
                            : 'border-[#E5E4E0] dark:border-[#343434]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Floor Material */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Напольное покрытие (PBR текстура)
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {[
                      { name: 'Дубовый паркет «Ёлочка»', color: '#9E7347', finish: 'parquet' as const },
                      { name: 'Американский тёмный орех', color: '#5A3E28', finish: 'walnut' as const },
                      { name: 'Светлый скандинавский ясень', color: '#C9AD86', finish: 'parquet' as const },
                      { name: 'Мрамор Carrara Bianco', color: '#EDEAE4', finish: 'marble' as const },
                      { name: 'Керамогранит Антрацит', color: '#6E7275', finish: 'tile' as const },
                    ].map((fl) => (
                      <button
                        key={fl.name}
                        type="button"
                        onClick={() =>
                          commitState((prev) => ({
                            ...prev,
                            floorMaterial: fl.color,
                            floorFinish: fl.finish,
                          }))
                        }
                        className={`flex items-center justify-between rounded-[12px] border p-2.5 text-xs font-medium ${
                          designState.floorMaterial === fl.color
                            ? 'border-[#143A30] bg-[#143A30]/10 text-[#143A30] dark:border-[#D4B483] dark:bg-[#D4B483]/15 dark:text-[#D4B483]'
                            : 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-5 w-5 rounded-full border border-black/15"
                            style={{ backgroundColor: fl.color }}
                          />
                          <span>{fl.name}</span>
                        </span>
                        {designState.floorMaterial === fl.color && (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lighting Preset */}
                <div>
                  <label className="block text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Освещение сцены
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { id: 'daylight', label: 'Дневное солнце' },
                      { id: 'golden', label: 'Золотой закат' },
                      { id: 'evening', label: 'Вечерний уют' },
                      { id: 'studio', label: 'Студийный 4K' },
                    ].map((lp) => (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() =>
                          commitState(
                            (prev) => ({
                              ...prev,
                              lightingPreset: lp.id as LightingPreset,
                            }),
                            false
                          )
                        }
                        className={`rounded-[10px] border px-3 py-2 text-xs font-medium ${
                          designState.lightingPreset === lp.id
                            ? 'border-[#143A30] bg-[#143A30] text-white dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                            : 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414]'
                        }`}
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'styles' && (
              <div className="space-y-3">
                <p className="text-xs text-[#525252] dark:text-[#A0A0A0]">
                  Примените готовую архитектурную концепцию отделки всего дома:
                </p>
                <div className="space-y-2">
                  {Object.entries(INTERIOR_STYLES).map(([key, st]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        commitState((prev) => ({
                          ...prev,
                          style: key as RoomDesignState['style'],
                          wallColor: st.wall,
                          floorMaterial: st.floor,
                          ceilingColor: st.ceiling,
                          facadeStyle: st.facade,
                          floorFinish: st.floorFinish,
                        }))
                      }
                      className={`flex w-full flex-col rounded-[14px] border p-3 text-start transition-colors ${
                        designState.style === key
                          ? 'border-[#143A30] bg-[#143A30] text-white dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                          : 'border-[#E5E4E0] bg-[#F8F8F7] text-[#171717] hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold">{st.name}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/30"
                            style={{ backgroundColor: st.wall }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/30"
                            style={{ backgroundColor: st.floor }}
                          />
                        </span>
                      </div>
                      <span className="mt-1 text-[11px] opacity-80">{st.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'partitions' && (
              <div className="space-y-4">
                <div className="rounded-[14px] border border-[#D4B483]/40 bg-[#FAF6ED] p-3 text-xs text-[#5C4033] dark:bg-[#241E14] dark:text-[#E5DCCB]">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-[#8C6D46]" aria-hidden="true" />
                    <span>Режим перепланировки и замеров</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    Внешние несущие стены и центральные опоры дома защищены от сноса. Виртуальная расстановка перегородок носит ознакомительный характер и не является строительным разрешением.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Добавить ненесущую перегородку
                  </p>
                  {FURNITURE_CATALOG.filter((c) => c.category === 'partition').map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => handleAddItem(part)}
                      className="flex w-full items-center justify-between rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-start text-xs font-medium hover:border-[#143A30] dark:border-[#343434] dark:bg-[#141414]"
                    >
                      <span>{part.name}</span>
                      <Plus className="h-4 w-4 text-[#143A30] dark:text-[#D4B483]" />
                    </button>
                  ))}
                </div>

                <div className="space-y-2 border-t border-[#E5E4E0] pt-3 dark:border-[#2C2C2C]">
                  <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Экспликация помещений дома (251.9 м²)
                  </p>
                  <div className="space-y-1.5">
                    {Object.values(HOUSE_ROOMS)
                      .filter((r) => r.id !== 'yard')
                      .map((rm) => (
                        <button
                          key={rm.id}
                          type="button"
                          onClick={() => handleTeleportRoom(rm.id)}
                          className="flex w-full items-center justify-between rounded-[10px] bg-[#F8F8F7] px-3 py-2 text-xs hover:bg-[#E5E4E0]/60 dark:bg-[#141414]"
                        >
                          <span>
                            {rm.name} <span className="opacity-60">({rm.floor} эт.)</span>
                          </span>
                          <span className="font-mono font-semibold text-[#143A30] dark:text-[#D4B483]">
                            {rm.areaSqm} м²
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                    Сохранённые проекты ({savedDesigns.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleResetDefaultHouse}
                    className="text-[11px] font-medium text-[#8C6D46] hover:underline dark:text-[#D4B483]"
                  >
                    Сбросить к эталону
                  </button>
                </div>

                {savedDesigns.length === 0 ? (
                  <p className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-4 text-xs text-[#737373] dark:border-[#343434] dark:bg-[#141414] dark:text-[#A0A0A0]">
                    У вас пока нет сохранённых в облаке проектов. Нажмите «Сохранить» в верхней панели, чтобы сохранить вашу планировку.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedDesigns.map((sd) => (
                      <div
                        key={sd.id}
                        className="flex items-center justify-between gap-2 rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-xs dark:border-[#343434] dark:bg-[#141414]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{sd.title}</p>
                          <p className="font-mono text-[10px] text-[#737373]">
                            {new Date(sd.updatedAt).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!idToken) return;
                              apiFetch<{ design: { designJson: string } }>(`/api/designs/${sd.id}`, {
                                token: idToken,
                              })
                                .then((res) => {
                                  const parsed = JSON.parse(res.design.designJson) as RoomDesignState;
                                  if (parsed && Array.isArray(parsed.items)) {
                                    commitState(parsed);
                                    setSaveNotice(`Загружен проект «${sd.title}»`);
                                  }
                                })
                                .catch(() => {});
                            }}
                            className="rounded-[8px] bg-[#143A30] px-2.5 py-1 text-[11px] font-medium text-white dark:bg-[#D4B483] dark:text-[#111111]"
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSavedDesign(sd.id)}
                            aria-label="Удалить проект"
                            className="rounded-[8px] p-1 text-[#991B1B] hover:bg-[#FEE2E2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center 3D Interactive Architectural Viewport */}
        <div className="relative flex h-[480px] min-h-0 flex-col overflow-hidden bg-[#DCE6F0] sm:h-[580px] lg:col-span-6 lg:h-[740px] dark:bg-[#121619]">
          <div
            ref={containerRef}
            data-testid="studio-3d-canvas-container"
            className="h-full w-full flex-1"
          />

          {/* Top-Left Floor & Cutaway Controls Overlay */}
          <div className="pointer-events-auto absolute start-3 top-3 z-10 flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-1 rounded-[12px] border border-white/15 bg-[#141414]/90 p-1 text-white">
              {(
                [
                  { id: 'all', label: 'Все этажи' },
                  { id: 1, label: '1 Этаж' },
                  { id: 2, label: '2 Этаж' },
                ] as const
              ).map((fl) => (
                <button
                  key={String(fl.id)}
                  type="button"
                  data-testid={`floor-filter-${fl.id}`}
                  onClick={() =>
                    commitState(
                      (prev) => ({ ...prev, activeFloorFilter: fl.id }),
                      false
                    )
                  }
                  className={`min-h-[28px] rounded-[8px] px-2.5 text-[11px] font-medium transition-colors ${
                    designState.activeFloorFilter === fl.id
                      ? 'bg-[#D4B483] text-[#171717]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {fl.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                commitState((prev) => ({ ...prev, showRoof: !prev.showRoof }), false)
              }
              className={`min-h-[34px] rounded-[10px] border px-2.5 text-[11px] font-medium ${
                designState.showRoof
                  ? 'border-[#D4B483] bg-[#D4B483] text-[#171717]'
                  : 'border-white/15 bg-[#141414]/90 text-white'
              }`}
            >
              Крыша: {designState.showRoof ? 'Вкл' : 'Разрез'}
            </button>

            <button
              type="button"
              onClick={() =>
                commitState((prev) => ({ ...prev, showYard: !prev.showYard }), false)
              }
              className={`min-h-[34px] rounded-[10px] border px-2.5 text-[11px] font-medium ${
                designState.showYard
                  ? 'border-[#D4B483] bg-[#141414]/90 text-[#D4B483]'
                  : 'border-white/15 bg-[#141414]/90 text-white/70'
              }`}
            >
              Двор и ландшафт
            </button>
          </div>

          {/* Walkthrough Touch/Click Navigation Pad when in 'walk' mode */}
          {designState.viewMode === 'walk' && (
            <div className="pointer-events-auto absolute end-3 top-3 z-10 flex items-center gap-1 rounded-[12px] border border-white/15 bg-[#141414]/95 p-1.5 text-white">
              <button
                type="button"
                onClick={() => threeCtxRef.current.walkCameraStep?.(0, 0, 0.2)}
                className="rounded-[8px] bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={() => threeCtxRef.current.walkCameraStep?.(0.55, 0, 0)}
                className="rounded-[8px] bg-[#D4B483] px-2.5 py-1 text-xs font-semibold text-[#171717]"
              >
                Вперёд (W)
              </button>
              <button
                type="button"
                onClick={() => threeCtxRef.current.walkCameraStep?.(-0.55, 0, 0)}
                className="rounded-[8px] bg-white/10 px-2.5 py-1 text-xs hover:bg-white/20"
              >
                Назад (S)
              </button>
              <button
                type="button"
                onClick={() => threeCtxRef.current.walkCameraStep?.(0, 0, -0.2)}
                className="rounded-[8px] bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
              >
                ↻
              </button>
            </div>
          )}

          {/* Bottom Room Quick-Teleport Bar */}
          <div className="pointer-events-auto absolute bottom-3 start-3 end-3 z-10 flex items-center gap-1.5 overflow-x-auto pb-1">
            {(activeArchConfig.archetype === 'commercial_glass_tower'
              ? ([
                  { id: 'living', label: 'Переговорная' },
                  { id: 'kitchen', label: 'Кабинет CEO' },
                  { id: 'hallway', label: 'Атриум и ресепшн' },
                  { id: 'bedroom', label: 'Конференц-зал' },
                  { id: 'bathroom1', label: 'Лаунж-зона' },
                  { id: 'study', label: 'Open-space офис' },
                  { id: 'balcony', label: 'Центральный вход' },
                  { id: 'yard', label: 'Фасад и плаза' },
                ] as const)
              : ([
                  { id: 'living', label: 'Гостиная' },
                  { id: 'kitchen', label: 'Кухня-столовая' },
                  { id: 'bedroom', label: 'Мастер-спальня' },
                  { id: 'study', label: 'Кабинет / Лаунж' },
                  { id: 'bathroom1', label: 'Ванная 1 эт.' },
                  { id: 'bathroom2', label: 'Ванная 2 эт.' },
                  { id: 'hallway', label: 'Холл и лестница' },
                  { id: 'balcony', label: 'Терраса' },
                  { id: 'yard', label: 'Экстерьер и двор' },
                ] as const)
            ).map((rm) => {
              const active = designState.activeRoom === rm.id;
              return (
                <button
                  key={rm.id}
                  type="button"
                  data-testid={`room-teleport-${rm.id}`}
                  onClick={() => handleTeleportRoom(rm.id)}
                  className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-[10px] border px-3 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#D4B483] bg-[#D4B483] text-[#171717]'
                      : 'border-white/15 bg-[#141414]/90 text-white/90 hover:bg-[#1E1E1E]'
                  }`}
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  <span>{rm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Inspector: Selected 3D Furniture Properties & Scene Hierarchy */}
        <div className="flex max-h-[46vh] min-h-0 flex-col overflow-hidden border-t border-[#E5E4E0] bg-white lg:col-span-3 lg:h-[740px] lg:max-h-[740px] lg:border-s lg:border-t-0 dark:border-[#2C2C2C] dark:bg-[#1C1C1C]">
          <div className="flex items-center justify-between border-b border-[#E5E4E0] px-4 py-3 dark:border-[#2C2C2C]">
            <h2 className="font-display text-sm font-semibold text-[#171717] dark:text-[#F5F5F5]">
              Инспектор объекта
            </h2>
            <span className="font-mono text-xs text-[#737373] dark:text-[#A0A0A0]">
              Объектов: {designState.items.length}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-[#525252] dark:text-[#A0A0A0]">
                      Выбранный 3D-объект
                    </label>
                    <input
                      type="text"
                      value={selectedItem.name}
                      onChange={(e) => updateSelectedItem({ name: e.target.value })}
                      className="mt-1 min-h-[36px] w-full rounded-[10px] border border-[#E5E4E0] bg-[#F8F8F7] px-3 text-xs font-medium text-[#171717] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSelectedItem({ locked: !selectedItem.locked })}
                    title={selectedItem.locked ? 'Разблокировать' : 'Заблокировать позицию'}
                    className={`mt-5 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border ${
                      selectedItem.locked
                        ? 'border-[#D4B483] bg-[#D4B483]/20 text-[#8C6D46]'
                        : 'border-[#E5E4E0] text-[#737373] dark:border-[#343434]'
                    }`}
                  >
                    {selectedItem.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                </div>

                {/* Floor & Room Placement */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#737373]">Этаж</label>
                    <select
                      value={selectedItem.floor}
                      onChange={(e) => {
                        const nextFloor = Number(e.target.value) === 2 ? 2 : 1;
                        updateSelectedItem({
                          floor: nextFloor,
                          y: nextFloor === 2 ? getFloor2Elevation(activeArchConfig.archetype) : 0.06,
                        });
                      }}
                      className="mt-1 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 text-xs dark:border-[#343434] dark:bg-[#141414]"
                    >
                      <option value={1}>1 этаж (0.0 м)</option>
                      <option value={2}>2 этаж ({getFloor2Elevation(activeArchConfig.archetype)} м)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#737373]">Привязка к сетке</label>
                    <select
                      value={designState.snapStep}
                      onChange={(e) =>
                        commitState((prev) => ({ ...prev, snapStep: Number(e.target.value) }), false)
                      }
                      className="mt-1 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                    >
                      <option value={0.05}>5 см (Точно)</option>
                      <option value={0.1}>10 см (Стандарт)</option>
                      <option value={0.25}>25 см (Быстро)</option>
                    </select>
                  </div>
                </div>

                {/* Coordinates X / Y / Z */}
                <div>
                  <span className="block text-[11px] font-semibold text-[#525252] dark:text-[#A0A0A0]">
                    Координаты в доме (метры)
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#737373]">X (Ширина)</label>
                      <input
                        type="number"
                        step={0.1}
                        value={selectedItem.x}
                        onChange={(e) => updateSelectedItem({ x: Number(e.target.value) || 0 })}
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#737373]">Y (Высота)</label>
                      <input
                        type="number"
                        step={0.1}
                        value={selectedItem.y}
                        onChange={(e) => updateSelectedItem({ y: Number(e.target.value) || 0 })}
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#737373]">Z (Глубина)</label>
                      <input
                        type="number"
                        step={0.1}
                        value={selectedItem.z}
                        onChange={(e) => updateSelectedItem({ z: Number(e.target.value) || 0 })}
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                  </div>
                </div>

                {/* Dimensions (Width, Depth, Height) */}
                <div>
                  <span className="block text-[11px] font-semibold text-[#525252] dark:text-[#A0A0A0]">
                    Габариты предмета (м)
                  </span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#737373]">Ширина</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.2}
                        max={6.0}
                        value={selectedItem.width}
                        onChange={(e) =>
                          updateSelectedItem({ width: Math.max(0.2, Number(e.target.value) || 0.5) })
                        }
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#737373]">Глубина</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.05}
                        max={6.0}
                        value={selectedItem.depth}
                        onChange={(e) =>
                          updateSelectedItem({ depth: Math.max(0.05, Number(e.target.value) || 0.5) })
                        }
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#737373]">Высота</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.02}
                        max={3.2}
                        value={selectedItem.height}
                        onChange={(e) =>
                          updateSelectedItem({ height: Math.max(0.02, Number(e.target.value) || 0.5) })
                        }
                        className="mt-0.5 min-h-[34px] w-full rounded-[9px] border border-[#E5E4E0] bg-[#F8F8F7] px-2 font-mono text-xs dark:border-[#343434] dark:bg-[#141414]"
                      />
                    </div>
                  </div>
                </div>

                {/* Rotation Controls */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[#525252] dark:text-[#A0A0A0]">
                      Поворот
                    </label>
                    <span className="font-mono text-[11px] text-[#737373]">
                      {Math.round((selectedItem.rotationY * 180) / Math.PI)}°
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedItem({ rotationY: selectedItem.rotationY - Math.PI / 4 })
                      }
                      className="flex-1 rounded-[8px] border border-[#E5E4E0] bg-[#F8F8F7] py-1.5 font-mono text-xs hover:bg-[#E5E4E0] dark:border-[#343434] dark:bg-[#141414]"
                    >
                      -45°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedItem({ rotationY: selectedItem.rotationY + Math.PI / 2 })
                      }
                      className="flex-1 rounded-[8px] border border-[#E5E4E0] bg-[#F8F8F7] py-1.5 font-mono text-xs hover:bg-[#E5E4E0] dark:border-[#343434] dark:bg-[#141414]"
                    >
                      +90°
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedItem({ rotationY: 0 })}
                      className="flex-1 rounded-[8px] border border-[#E5E4E0] bg-[#F8F8F7] py-1.5 font-mono text-xs hover:bg-[#E5E4E0] dark:border-[#343434] dark:bg-[#141414]"
                    >
                      0°
                    </button>
                  </div>
                  <input
                    type="range"
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.05}
                    value={selectedItem.rotationY}
                    onChange={(e) => updateSelectedItem({ rotationY: Number(e.target.value) || 0 })}
                    className="mt-2 w-full accent-[#143A30]"
                  />
                </div>

                {/* Material & Color Swatches */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#525252] dark:text-[#A0A0A0]">
                    Материал и цвет предмета
                  </label>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'fabric', label: 'Ткань' },
                        { id: 'velvet', label: 'Велюр' },
                        { id: 'walnut', label: 'Орех' },
                        { id: 'oak', label: 'Дуб' },
                        { id: 'marble', label: 'Мрамор' },
                        { id: 'brass', label: 'Латунь' },
                      ] as const
                    ).map((mat) => (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => updateSelectedItem({ material: mat.id })}
                        className={`rounded-[8px] border px-2 py-1 text-[11px] font-medium ${
                          selectedItem.material === mat.id
                            ? 'border-[#143A30] bg-[#143A30] text-white dark:border-[#D4B483] dark:bg-[#D4B483] dark:text-[#111111]'
                            : 'border-[#E5E4E0] bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414]'
                        }`}
                      >
                        {mat.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {[
                      '#2F3E46',
                      '#C89F70',
                      '#EAE4DC',
                      '#143A30',
                      '#4A3525',
                      '#8B5A2B',
                      '#D4B483',
                      '#1F2428',
                    ].map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        onClick={() => updateSelectedItem({ color: sw })}
                        style={{ backgroundColor: sw }}
                        className={`h-6 w-6 rounded-full border ${
                          selectedItem.color === sw
                            ? 'ring-2 ring-[#143A30] dark:ring-[#D4B483]'
                            : 'border-black/20'
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Выбрать произвольный цвет"
                      value={selectedItem.color}
                      onChange={(e) => updateSelectedItem({ color: e.target.value })}
                      className="h-7 w-7 cursor-pointer rounded-[6px] border-0 bg-transparent"
                    />
                  </div>
                </div>

                {/* Duplicate & Delete Actions */}
                <div className="flex items-center gap-2 border-t border-[#E5E4E0] pt-3 dark:border-[#2C2C2C]">
                  <button
                    type="button"
                    onClick={duplicateSelectedItem}
                    className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[#E5E4E0] bg-white text-xs font-medium text-[#171717] hover:bg-[#F8F8F7] dark:border-[#343434] dark:bg-[#141414] dark:text-[#F5F5F5]"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Дублировать</span>
                  </button>
                  <button
                    type="button"
                    data-testid="delete-selected-item-btn"
                    onClick={deleteSelectedItem}
                    disabled={selectedItem.locked}
                    className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-[#991B1B] text-xs font-medium text-white hover:bg-[#7F1D1D] disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="rounded-[12px] border border-[#E5E4E0] bg-[#F8F8F7] p-3 text-xs text-[#737373] dark:border-[#343434] dark:bg-[#141414] dark:text-[#A0A0A0]">
                Кликните на любой предмет мебели прямо на 3D-сцене (или выберите ниже из списка), чтобы переместить его мышью по полу, повернуть или изменить отделку.
              </p>
            )}

            {/* Quick Scene Items List */}
            <div className="border-t border-[#E5E4E0] pt-3 dark:border-[#2C2C2C]">
              <p className="text-xs font-semibold text-[#171717] dark:text-[#F5F5F5]">
                Предметы в доме ({designState.items.length})
              </p>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pe-1">
                {designState.items.map((it) => {
                  const isSel = it.id === selectedItemId;
                  const hasCol = collidingIdsSet.has(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setSelectedItemId(it.id)}
                      className={`flex w-full items-center justify-between rounded-[9px] px-2.5 py-1.5 text-start text-xs transition-colors ${
                        isSel
                          ? 'bg-[#143A30] text-white dark:bg-[#D4B483] dark:text-[#111111]'
                          : hasCol
                            ? 'bg-[#FEE2E2] text-[#991B1B]'
                            : 'bg-[#F8F8F7] text-[#171717] hover:bg-[#E5E4E0]/60 dark:bg-[#141414] dark:text-[#F5F5F5]'
                      }`}
                    >
                      <span className="truncate font-medium">{it.name}</span>
                      <span className="ms-2 shrink-0 font-mono text-[10px] opacity-75">
                        {it.floor} эт.
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4K UHD Render Preview Modal */}
      {render4KModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="4K UHD Render Preview"
          data-testid="render-4k-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#1C1C1C] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <span className="font-mono text-xs font-semibold text-[#D4B483]">
                  ULTRA HD 4K ARCHITECTURAL RENDER · {render4KModal.width} × {render4KModal.height} PX
                </span>
                <h3 className="mt-0.5 font-display text-lg font-semibold">
                  {designState.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRender4KModal(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/10 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-black p-4">
              <img
                src={render4KModal.dataUrl}
                alt="4K UHD Render"
                className="mx-auto max-h-[62vh] w-auto rounded-[12px] border border-white/10 object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-3.5 text-xs">
              <span className="font-mono text-white/75">
                Разрешение кадра: {render4KModal.width}×{render4KModal.height} (UHD 4K) · Сформировано в {render4KModal.timestamp}
              </span>
              <a
                href={render4KModal.dataUrl}
                download={`${designState.title.replace(/\s+/g, '-').toLowerCase()}-4k-3840x2160.png`}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-[12px] bg-[#D4B483] px-4 font-semibold text-[#171717] hover:bg-[#e2c699]"
              >
                <Download className="h-4 w-4" />
                <span>Скачать PNG 4K (3840×2160)</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
