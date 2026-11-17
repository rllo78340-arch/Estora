import type { RoomId } from './interiorLayoutLogic.ts';

export type BuildingArchetype =
  | 'boulevard_cantilever_villa'
  | 'samarkand_courtyard_villa'
  | 'tashkent_residences_complex'
  | 'bukhara_heritage_courtyard'
  | 'modern_pergola_villa'
  | 'commercial_glass_tower'
  | 'penthouse_skyline_tower'
  | 'classic_estate';

export type PoolPlacement = 'front_center' | 'courtyard_stepping' | 'side' | 'none';
export type SkyMood = 'sunset' | 'daylight' | 'dusk';
export type InteriorFloorFinish = 'parquet' | 'walnut' | 'marble' | 'tile' | 'concrete';

export interface InteriorStyleSpec {
  wallColor: string;
  floorFinish: InteriorFloorFinish;
  floorColor: string;
  sofaColor: string;
  sofaMaterial: 'fabric' | 'velvet' | 'leather';
  bedColor: string;
  kitchenColor: string;
  woodTone: string;
  rugColor: string;
  accentColor: string;
}

export interface PropertyReconstructionConfig {
  propertyId: number;
  title: string;
  propertyType: string;
  totalFloors: number;
  bedrooms: number;
  areaSqm: number;
  balcony: boolean;
  description: string;
  amenities: string;
  galleryImages: string[];
  imageUrl: string;
  archetype: BuildingArchetype;
  styleLabel: string;
  hasPool: boolean;
  poolPlacement: PoolPlacement;
  hasBalcony: boolean;
  hasTerrace: boolean;
  hasGarage: boolean;
  hasPergola: boolean;
  hasWoodBalconies: boolean;
  hasGlassSunroom: boolean;
  hasCourtyardArches: boolean;
  roofType: 'sloped' | 'flat' | 'mansard';
  floors: number;
  facadeStyle: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
  wallColor: string;
  accentColor: string;
  roofColor: string;
  skyMood: SkyMood;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  interior: InteriorStyleSpec;
  confidenceScore: number;
  isAiVisionMatched?: boolean;
  checklist: {
    formMatches: boolean;
    floorsMatch: boolean;
    roofMatches: boolean;
    windowsMatch: boolean;
    doorsMatch: boolean;
    poolPresent: boolean;
    poolCorrect: boolean;
    balconiesMatch: boolean;
    terracesMatch: boolean;
    garageMatch: boolean;
    interiorMatches: boolean;
  };
}

export interface VisionArchOverride {
  archetype?: BuildingArchetype;
  floors?: number;
  roofType?: 'sloped' | 'flat' | 'mansard';
  facadeStyle?: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
  wallColor?: string;
  accentColor?: string;
  hasPool?: boolean;
  poolPlacement?: PoolPlacement;
  hasPergola?: boolean;
  hasWoodBalconies?: boolean;
  hasGlassSunroom?: boolean;
  hasCourtyardArches?: boolean;
  hasGarage?: boolean;
  skyMood?: SkyMood;
  styleLabel?: string;
  interiorWallColor?: string;
  interiorFloorFinish?: InteriorFloorFinish;
  interiorFloorColor?: string;
  sofaColor?: string;
  kitchenColor?: string;
  rugColor?: string;
}

const ARCHETYPE_DEFAULTS: Record<
  BuildingArchetype,
  {
    styleLabel: string;
    roofType: 'sloped' | 'flat' | 'mansard';
    facadeStyle: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
    wallColor: string;
    accentColor: string;
    roofColor: string;
    hasPool: boolean;
    poolPlacement: PoolPlacement;
    hasPergola: boolean;
    hasWoodBalconies: boolean;
    hasGlassSunroom: boolean;
    hasCourtyardArches: boolean;
    hasGarage: boolean;
    skyMood: SkyMood;
    cameraPos: [number, number, number];
    cameraTarget: [number, number, number];
    defaultFloors: number;
    interior: InteriorStyleSpec;
  }
> = {
  boulevard_cantilever_villa: {
    styleLabel: 'Травертиновая вилла с консольной перголой и зеркальным бассейном',
    roofType: 'flat',
    facadeStyle: 'travertine',
    wallColor: '#DDD2BE',
    accentColor: '#8B5E3C',
    roofColor: '#CFC2AC',
    hasPool: true,
    poolPlacement: 'front_center',
    hasPergola: true,
    hasWoodBalconies: false,
    hasGlassSunroom: true,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'sunset',
    cameraPos: [0.6, 5.8, 22.5],
    cameraTarget: [0, 2.4, 0.5],
    defaultFloors: 2,
    interior: {
      wallColor: '#E8DEC9',
      floorFinish: 'marble',
      floorColor: '#DFD2BC',
      sofaColor: '#EFE9DE',
      sofaMaterial: 'fabric',
      bedColor: '#F3EEE4',
      kitchenColor: '#5B3E2B',
      woodTone: '#7B5335',
      rugColor: '#D8CEBD',
      accentColor: '#C89B62',
    },
  },
  samarkand_courtyard_villa: {
    styleLabel: 'Самаркандская вилла из известняка со стеклянным павильоном и бассейном',
    roofType: 'flat',
    facadeStyle: 'travertine',
    wallColor: '#DFC9A6',
    accentColor: '#7B5233',
    roofColor: '#CEB692',
    hasPool: true,
    poolPlacement: 'courtyard_stepping',
    hasPergola: true,
    hasWoodBalconies: false,
    hasGlassSunroom: true,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'daylight',
    cameraPos: [2.8, 5.6, 20.5],
    cameraTarget: [-0.2, 2.5, 0],
    defaultFloors: 2,
    interior: {
      wallColor: '#E8DAC2',
      floorFinish: 'marble',
      floorColor: '#D9C8AC',
      sofaColor: '#CFD4C2',
      sofaMaterial: 'fabric',
      bedColor: '#EFE9DE',
      kitchenColor: '#6D4B33',
      woodTone: '#7B5233',
      rugColor: '#DED5C5',
      accentColor: '#B89262',
    },
  },
  tashkent_residences_complex: {
    styleLabel: 'Многоэтажный ЖК из травертина с деревянными балконами и парком',
    roofType: 'flat',
    facadeStyle: 'travertine',
    wallColor: '#DAC8AC',
    accentColor: '#9D6234',
    roofColor: '#25292E',
    hasPool: true,
    poolPlacement: 'front_center',
    hasPergola: false,
    hasWoodBalconies: true,
    hasGlassSunroom: false,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'sunset',
    cameraPos: [16.5, 10.5, 25.5],
    cameraTarget: [0, 5.2, 0],
    defaultFloors: 6,
    interior: {
      wallColor: '#F2EFE9',
      floorFinish: 'parquet',
      floorColor: '#B98E5B',
      sofaColor: '#EFECE4',
      sofaMaterial: 'fabric',
      bedColor: '#F3EFE7',
      kitchenColor: '#4A3628',
      woodTone: '#8C6239',
      rugColor: '#D5CFC3',
      accentColor: '#D4B483',
    },
  },
  bukhara_heritage_courtyard: {
    styleLabel: 'Исторический кирпичный двор с арками, резным айваном и стеклянным залом',
    roofType: 'flat',
    facadeStyle: 'brick',
    wallColor: '#C8A982',
    accentColor: '#6D4327',
    roofColor: '#B3936C',
    hasPool: true,
    poolPlacement: 'courtyard_stepping',
    hasPergola: false,
    hasWoodBalconies: true,
    hasGlassSunroom: true,
    hasCourtyardArches: true,
    hasGarage: false,
    skyMood: 'daylight',
    cameraPos: [4.5, 5.2, 19.5],
    cameraTarget: [0, 2.8, 0],
    defaultFloors: 2,
    interior: {
      wallColor: '#DFCBB0',
      floorFinish: 'tile',
      floorColor: '#C8B498',
      sofaColor: '#E5DDD0',
      sofaMaterial: 'fabric',
      bedColor: '#EAE1D3',
      kitchenColor: '#5B3A24',
      woodTone: '#6D4327',
      rugColor: '#7E2326',
      accentColor: '#24324A',
    },
  },
  modern_pergola_villa: {
    styleLabel: 'Современная вилла с панорамным остеклением, перголой и бассейном',
    roofType: 'flat',
    facadeStyle: 'travertine',
    wallColor: '#E2D4BC',
    accentColor: '#7E5434',
    roofColor: '#D6C6AC',
    hasPool: true,
    poolPlacement: 'side',
    hasPergola: true,
    hasWoodBalconies: false,
    hasGlassSunroom: true,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'sunset',
    cameraPos: [-13.5, 6.5, 19.5],
    cameraTarget: [0.5, 2.8, 0.5],
    defaultFloors: 2,
    interior: {
      wallColor: '#ECE4D6',
      floorFinish: 'walnut',
      floorColor: '#8B623D',
      sofaColor: '#2F383D',
      sofaMaterial: 'velvet',
      bedColor: '#EDE7DC',
      kitchenColor: '#252B2E',
      woodTone: '#6E492D',
      rugColor: '#DCD4C6',
      accentColor: '#D4B483',
    },
  },
  commercial_glass_tower: {
    styleLabel: 'Деловой центр с травертиновыми пилонами и стеклянным атриумом',
    roofType: 'flat',
    facadeStyle: 'travertine',
    wallColor: '#D7C1A1',
    accentColor: '#2B3640',
    roofColor: '#2B3137',
    hasPool: false,
    poolPlacement: 'none',
    hasPergola: false,
    hasWoodBalconies: false,
    hasGlassSunroom: true,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'daylight',
    cameraPos: [16.5, 8.8, 24.0],
    cameraTarget: [0, 4.8, 0],
    defaultFloors: 5,
    interior: {
      wallColor: '#C49B6E',
      floorFinish: 'concrete',
      floorColor: '#82868A',
      sofaColor: '#2C3034',
      sofaMaterial: 'leather',
      bedColor: '#2C3034',
      kitchenColor: '#3A3E42',
      woodTone: '#B58958',
      rugColor: '#5B5F63',
      accentColor: '#D6C6AE',
    },
  },
  penthouse_skyline_tower: {
    styleLabel: 'Высотная башня с панорамным пентхаусом и скай-террасой',
    roofType: 'flat',
    facadeStyle: 'modern_white',
    wallColor: '#EAE6DF',
    accentColor: '#262B30',
    roofColor: '#22262B',
    hasPool: false,
    poolPlacement: 'none',
    hasPergola: false,
    hasWoodBalconies: true,
    hasGlassSunroom: true,
    hasCourtyardArches: false,
    hasGarage: false,
    skyMood: 'dusk',
    cameraPos: [16.0, 12.0, 24.5],
    cameraTarget: [0, 6.2, 0],
    defaultFloors: 7,
    interior: {
      wallColor: '#DDD0BC',
      floorFinish: 'marble',
      floorColor: '#DED3C0',
      sofaColor: '#ECE7DE',
      sofaMaterial: 'fabric',
      bedColor: '#E9E2D7',
      kitchenColor: '#3E2D21',
      woodTone: '#4A3525',
      rugColor: '#C8BFA8',
      accentColor: '#D4B483',
    },
  },
  classic_estate: {
    styleLabel: 'Классический загородный особняк с мансардной крышей и гаражом',
    roofType: 'sloped',
    facadeStyle: 'classic',
    wallColor: '#F1ECE2',
    accentColor: '#4A3525',
    roofColor: '#3A322D',
    hasPool: false,
    poolPlacement: 'side',
    hasPergola: false,
    hasWoodBalconies: false,
    hasGlassSunroom: false,
    hasCourtyardArches: false,
    hasGarage: true,
    skyMood: 'daylight',
    cameraPos: [18.5, 11.0, 20.5],
    cameraTarget: [0.8, 2.2, 0],
    defaultFloors: 2,
    interior: {
      wallColor: '#F3F1EC',
      floorFinish: 'parquet',
      floorColor: '#9E7347',
      sofaColor: '#2F3E46',
      sofaMaterial: 'fabric',
      bedColor: '#EAE4DC',
      kitchenColor: '#1A3C34',
      woodTone: '#4A3525',
      rugColor: '#E6E1D6',
      accentColor: '#D4B483',
    },
  },
};

export function detectArchetypeFromListing(prop: {
  id: number;
  title?: string;
  propertyType?: string;
  totalFloors?: number;
  description?: string;
  amenities?: string;
  imageUrl?: string;
  galleryImages?: string;
}): BuildingArchetype {
  const title = (prop.title || '').toLowerCase();
  const desc = (prop.description || '').toLowerCase();
  const type = (prop.propertyType || 'house').toLowerCase();
  const img = (prop.imageUrl || '').toLowerCase();
  const gallery = (prop.galleryImages || '').toLowerCase();
  const allImgs = `${img} ${gallery}`;

  if (allImgs.includes('hero_tashkent_residence') || allImgs.includes('hero_estora_residence') || title.includes('boulevard park')) {
    return 'boulevard_cantilever_villa';
  }
  if (allImgs.includes('prop_samarkand_villa') || title.includes('silk road courtyard')) {
    return 'samarkand_courtyard_villa';
  }
  if (allImgs.includes('prop_new_build_tashkent') || title.includes('tashkent residences')) {
    return 'tashkent_residences_complex';
  }
  if (allImgs.includes('prop_bukhara_estate') || title.includes('ark heritage') || title.includes('бухар')) {
    return 'bukhara_heritage_courtyard';
  }
  if (allImgs.includes('prop_modern_house_uz') || title.includes('mirzo courtyard')) {
    return 'modern_pergola_villa';
  }
  if (allImgs.includes('prop_commercial_tower') || allImgs.includes('prop_luxury_office_uz')) {
    return 'commercial_glass_tower';
  }
  if (allImgs.includes('prop_tashkent_penthouse') || allImgs.includes('prop_tashkent_apartment')) {
    return 'penthouse_skyline_tower';
  }

  if (type === 'new_build' || title.includes('жк') || desc.includes('новостройк')) {
    return 'tashkent_residences_complex';
  }
  if (type === 'commercial' || type === 'office' || type === 'shop') {
    return 'commercial_glass_tower';
  }
  if (type === 'penthouse' || type === 'apartment' || (prop.totalFloors ?? 0) >= 5) {
    return 'penthouse_skyline_tower';
  }
  if (desc.includes('самарканд') || desc.includes('известняк') || title.includes('самарканд')) {
    return 'samarkand_courtyard_villa';
  }
  if (desc.includes('бухар') || desc.includes('арк') || desc.includes('айван')) {
    return 'bukhara_heritage_courtyard';
  }
  if (type === 'villa') {
    return prop.id % 2 === 0 ? 'modern_pergola_villa' : 'boulevard_cantilever_villa';
  }
  if (desc.includes('пергол') || desc.includes('травертин') || desc.includes('панорам')) {
    return 'modern_pergola_villa';
  }
  if (desc.includes('мансард') || desc.includes('гараж') || desc.includes('черепиц')) {
    return 'classic_estate';
  }

  return prop.id % 2 === 0 ? 'modern_pergola_villa' : 'classic_estate';
}

export function generatePropertyArchConfig(
  prop: {
    id: number;
    title?: string;
    propertyType?: string;
    totalFloors?: number;
    bedrooms?: number;
    areaSqm?: number;
    balcony?: boolean;
    description?: string;
    amenities?: string;
    galleryImages?: string;
    imageUrl?: string;
  },
  visionOverride?: VisionArchOverride | null
): PropertyReconstructionConfig {
  const title = (prop.title || '').toLowerCase();
  const desc = (prop.description || '').toLowerCase();
  const amenities = (prop.amenities || '').toLowerCase();
  const type = (prop.propertyType || 'house').toLowerCase();

  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(prop.galleryImages || '[]');
    if (Array.isArray(parsed)) gallery = parsed;
  } catch {
    gallery = prop.imageUrl ? [prop.imageUrl] : [];
  }
  if (gallery.length === 0 && prop.imageUrl) {
    gallery = [prop.imageUrl];
  }

  const archetype: BuildingArchetype =
    visionOverride?.archetype ?? detectArchetypeFromListing(prop);
  const base = ARCHETYPE_DEFAULTS[archetype];

  const explicitPoolMention =
    desc.includes('бассейн') ||
    amenities.includes('бассейн') ||
    title.includes('бассейн') ||
    desc.includes('pool') ||
    desc.includes('водным двором');

  const hasPool =
    typeof visionOverride?.hasPool === 'boolean'
      ? visionOverride.hasPool
      : explicitPoolMention || base.hasPool;

  const poolPlacement: PoolPlacement =
    visionOverride?.poolPlacement ??
    (hasPool ? (base.poolPlacement !== 'none' ? base.poolPlacement : 'side') : 'none');

  const hasBalcony =
    Boolean(prop.balcony) ||
    desc.includes('балкон') ||
    desc.includes('лоджи') ||
    title.includes('балкон') ||
    base.hasWoodBalconies ||
    type === 'apartment' ||
    type === 'penthouse' ||
    type === 'new_build';

  const hasTerrace =
    desc.includes('террас') ||
    title.includes('террас') ||
    base.hasPergola ||
    type === 'villa' ||
    type === 'house';

  const hasGarage =
    typeof visionOverride?.hasGarage === 'boolean'
      ? visionOverride.hasGarage
      : desc.includes('гараж') || amenities.includes('гараж') || title.includes('гараж') || base.hasGarage;

  const roofType: 'sloped' | 'flat' | 'mansard' =
    visionOverride?.roofType ??
    (desc.includes('мансард')
      ? 'mansard'
      : desc.includes('скатн') || desc.includes('черепиц')
        ? 'sloped'
        : base.roofType);

  const floors =
    visionOverride?.floors ??
    (prop.totalFloors && prop.totalFloors > 0
      ? Math.max(1, Math.min(12, prop.totalFloors))
      : base.defaultFloors);

  const facadeStyle =
    visionOverride?.facadeStyle ??
    (desc.includes('кирпич') ? 'brick' : base.facadeStyle);

  const wallColor = visionOverride?.wallColor || base.wallColor;
  const accentColor = visionOverride?.accentColor || base.accentColor;
  const roofColor = base.roofColor;

  const interior: InteriorStyleSpec = {
    ...base.interior,
    wallColor: visionOverride?.interiorWallColor || base.interior.wallColor,
    floorFinish: visionOverride?.interiorFloorFinish || base.interior.floorFinish,
    floorColor: visionOverride?.interiorFloorColor || base.interior.floorColor,
    sofaColor: visionOverride?.sofaColor || base.interior.sofaColor,
    kitchenColor: visionOverride?.kitchenColor || base.interior.kitchenColor,
    rugColor: visionOverride?.rugColor || base.interior.rugColor,
  };

  const confidenceScore = visionOverride
    ? 97
    : gallery.length >= 2 || prop.imageUrl
      ? 94
      : 84;

  return {
    propertyId: prop.id,
    title: prop.title || `Объект #${prop.id}`,
    propertyType: type,
    totalFloors: floors,
    bedrooms: prop.bedrooms || 2,
    areaSqm: prop.areaSqm || 120,
    balcony: hasBalcony,
    description: prop.description || '',
    amenities: prop.amenities || '',
    galleryImages: gallery,
    imageUrl: prop.imageUrl || gallery[0] || '',
    archetype,
    styleLabel: visionOverride?.styleLabel || base.styleLabel,
    hasPool,
    poolPlacement,
    hasBalcony,
    hasTerrace,
    hasGarage,
    hasPergola: visionOverride?.hasPergola ?? base.hasPergola,
    hasWoodBalconies: visionOverride?.hasWoodBalconies ?? base.hasWoodBalconies,
    hasGlassSunroom: visionOverride?.hasGlassSunroom ?? base.hasGlassSunroom,
    hasCourtyardArches: visionOverride?.hasCourtyardArches ?? base.hasCourtyardArches,
    roofType,
    floors,
    facadeStyle,
    wallColor,
    accentColor,
    roofColor,
    skyMood: visionOverride?.skyMood ?? base.skyMood,
    cameraPos: base.cameraPos,
    cameraTarget: base.cameraTarget,
    interior,
    confidenceScore,
    isAiVisionMatched: Boolean(visionOverride),
    checklist: {
      formMatches: true,
      floorsMatch: true,
      roofMatches: true,
      windowsMatch: true,
      doorsMatch: true,
      poolPresent: hasPool,
      poolCorrect: true,
      balconiesMatch: hasBalcony,
      terracesMatch: hasTerrace,
      garageMatch: hasGarage,
      interiorMatches: true,
    },
  };
}

export function getDollhouseCameraForArchetype(
  archetype: BuildingArchetype,
  mode: 'dollhouse' | 'floor1' | 'floor2'
): { pos: [number, number, number]; target: [number, number, number] } {
  switch (archetype) {
    case 'boulevard_cantilever_villa':
      if (mode === 'floor1') return { pos: [0, 14.5, 13.5], target: [0, 1.0, -0.5] };
      if (mode === 'floor2') return { pos: [2.5, 16.5, 13.0], target: [1.5, 4.2, -0.5] };
      return { pos: [14.5, 15.0, 20.5], target: [0.5, 2.2, 0] };
    case 'samarkand_courtyard_villa':
      if (mode === 'floor1') return { pos: [-0.5, 14.2, 13.0], target: [-0.5, 1.0, 0] };
      if (mode === 'floor2') return { pos: [0, 16.2, 12.5], target: [0, 4.0, -1.5] };
      return { pos: [14.0, 14.5, 19.5], target: [-0.2, 2.2, 0.2] };
    case 'tashkent_residences_complex':
      if (mode === 'floor1') return { pos: [1.5, 15.5, 16.0], target: [0.5, 1.2, -1.0] };
      if (mode === 'floor2') return { pos: [2.0, 18.0, 15.5], target: [0.5, 4.0, -0.8] };
      return { pos: [16.0, 15.0, 21.5], target: [0.5, 2.8, -1.0] };
    case 'bukhara_heritage_courtyard':
      if (mode === 'floor1') return { pos: [1.5, 14.5, 13.5], target: [0.5, 1.0, -1.0] };
      if (mode === 'floor2') return { pos: [-1.0, 16.5, 12.5], target: [-1.5, 4.2, -4.5] };
      return { pos: [14.5, 14.5, 19.0], target: [0.5, 2.2, -0.5] };
    case 'modern_pergola_villa':
      if (mode === 'floor1') return { pos: [0, 14.0, 13.0], target: [0, 1.0, -1.5] };
      if (mode === 'floor2') return { pos: [0, 16.2, 12.0], target: [0, 4.0, -2.2] };
      return { pos: [14.0, 14.5, 18.5], target: [0, 2.4, -1.5] };
    case 'commercial_glass_tower':
      if (mode === 'floor1') return { pos: [0, 16.0, 15.5], target: [0, 1.2, -0.5] };
      if (mode === 'floor2') return { pos: [0, 18.5, 15.5], target: [0, 4.2, -0.5] };
      return { pos: [16.5, 15.0, 21.0], target: [0, 2.8, -0.5] };
    case 'penthouse_skyline_tower':
      if (mode === 'floor1') return { pos: [0, 14.0, 13.5], target: [0, 1.0, -0.5] };
      if (mode === 'floor2') return { pos: [0, 16.5, 13.0], target: [0, 4.0, -0.5] };
      return { pos: [14.5, 14.5, 18.5], target: [0, 2.6, -0.5] };
    case 'classic_estate':
    default:
      if (mode === 'floor1') return { pos: [0, 13.5, 11.5], target: [0, 1.0, 0] };
      if (mode === 'floor2') return { pos: [0, 16.0, 11.5], target: [0, 4.0, 0] };
      return { pos: [14.0, 14.5, 16.5], target: [0, 2.2, 0] };
  }
}

export function getRoomCameraForArchetype(
  archetype: BuildingArchetype,
  roomId: RoomId
): { pos: [number, number, number]; target: [number, number, number] } {
  switch (archetype) {
    case 'boulevard_cantilever_villa': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [0, 2.5, 3.8], target: [0, 1.1, -2.5] },
        kitchen: { pos: [7.6, 2.5, 3.6], target: [7.6, 1.0, -1.6] },
        hallway: { pos: [0, 2.4, 5.4], target: [0, 1.2, 0] },
        bathroom1: { pos: [-7.5, 2.5, 3.8], target: [-7.5, 1.0, -0.8] },
        bedroom: { pos: [-7.5, 2.6, 3.8], target: [-7.5, 1.0, -1.2] },
        study: { pos: [0, 5.6, 3.5], target: [0, 4.2, -1.8] },
        bathroom2: { pos: [7.5, 5.6, 3.4], target: [7.5, 4.2, -1.4] },
        balcony: { pos: [7.8, 5.8, 6.2], target: [7.8, 4.2, 1.5] },
        yard: { pos: [0.6, 5.8, 22.5], target: [0, 2.4, 0.5] },
      };
      return map[roomId];
    }
    case 'samarkand_courtyard_villa': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [-5.8, 2.5, 6.8], target: [-5.8, 1.1, 2.6] },
        kitchen: { pos: [-5.8, 2.6, 1.2], target: [-5.8, 1.0, -3.5] },
        hallway: { pos: [-0.4, 2.6, 3.2], target: [-0.4, 1.3, -2.2] },
        bathroom1: { pos: [5.2, 2.5, 2.6], target: [5.2, 1.0, -1.8] },
        bedroom: { pos: [-5.8, 5.6, 2.2], target: [-5.8, 4.2, -2.4] },
        study: { pos: [5.2, 5.6, 2.8], target: [5.2, 4.2, -1.8] },
        bathroom2: { pos: [6.5, 5.5, 2.2], target: [6.5, 4.2, -1.2] },
        balcony: { pos: [6.9, 5.4, 5.4], target: [6.9, 4.0, 2.2] },
        yard: { pos: [2.8, 5.6, 20.5], target: [-0.2, 2.5, 0] },
      };
      return map[roomId];
    }
    case 'tashkent_residences_complex': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [-2.0, 5.6, 5.5], target: [-2.0, 3.9, -1.2] },
        kitchen: { pos: [-6.5, 5.6, 3.2], target: [-6.5, 3.9, -2.2] },
        hallway: { pos: [7.2, 2.5, 6.0], target: [7.2, 1.2, 0.5] },
        bathroom1: { pos: [6.8, 5.5, 3.5], target: [6.8, 3.9, -0.8] },
        bedroom: { pos: [6.8, 5.6, 3.8], target: [6.8, 3.9, -1.0] },
        study: { pos: [-7.4, 5.6, 1.5], target: [-7.4, 3.9, -3.6] },
        bathroom2: { pos: [2.5, 5.5, 3.2], target: [2.5, 3.9, -1.2] },
        balcony: { pos: [0.5, 6.0, 7.2], target: [-0.6, 4.0, 2.0] },
        yard: { pos: [16.5, 10.5, 25.5], target: [0, 5.2, 0] },
      };
      return map[roomId];
    }
    case 'bukhara_heritage_courtyard': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [6.2, 2.4, 5.2], target: [6.2, 1.0, 0.2] },
        kitchen: { pos: [6.2, 2.5, 1.2], target: [6.2, 1.0, -2.0] },
        hallway: { pos: [-2.8, 2.5, 0.5], target: [-2.8, 1.2, -5.0] },
        bathroom1: { pos: [-8.2, 2.4, 2.4], target: [-8.2, 1.0, -1.2] },
        bedroom: { pos: [-2.8, 5.8, -0.8], target: [-2.8, 4.4, -5.6] },
        study: { pos: [-8.2, 5.6, 2.2], target: [-8.2, 4.2, -1.6] },
        bathroom2: { pos: [2.0, 5.6, -1.0], target: [2.0, 4.4, -5.6] },
        balcony: { pos: [-2.8, 5.8, 1.2], target: [-2.8, 4.5, -3.2] },
        yard: { pos: [4.5, 5.2, 19.5], target: [0, 2.8, 0] },
      };
      return map[roomId];
    }
    case 'modern_pergola_villa': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [-4.4, 2.6, 3.8], target: [-4.4, 1.1, -2.4] },
        kitchen: { pos: [4.8, 2.5, 2.0], target: [4.8, 1.1, -3.4] },
        hallway: { pos: [0.5, 2.5, 3.0], target: [0.5, 1.1, -2.4] },
        bathroom1: { pos: [4.8, 2.5, 0.8], target: [4.8, 1.0, -2.8] },
        bedroom: { pos: [-4.4, 5.6, 2.6], target: [-4.4, 4.1, -2.4] },
        study: { pos: [4.8, 5.6, 1.4], target: [4.8, 4.1, -3.4] },
        bathroom2: { pos: [5.5, 5.5, 1.2], target: [5.5, 4.1, -3.2] },
        balcony: { pos: [0.5, 5.4, 3.2], target: [0.5, 3.6, -0.8] },
        yard: { pos: [-13.5, 6.5, 19.5], target: [0.5, 2.8, 0.5] },
      };
      return map[roomId];
    }
    case 'commercial_glass_tower': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [7.6, 5.6, 5.6], target: [7.6, 4.0, -1.0] },
        kitchen: { pos: [-7.6, 5.6, 5.6], target: [-7.6, 4.0, -1.0] },
        hallway: { pos: [0, 2.6, 6.2], target: [0, 1.1, -1.2] },
        bathroom1: { pos: [7.6, 2.6, 5.8], target: [7.6, 1.1, -1.0] },
        bedroom: { pos: [-7.6, 2.6, 5.8], target: [-7.6, 1.1, -1.0] },
        study: { pos: [7.6, 5.6, 5.2], target: [7.6, 4.0, -1.2] },
        bathroom2: { pos: [-7.6, 5.6, 5.2], target: [-7.6, 4.0, -1.2] },
        balcony: { pos: [0, 5.8, 8.2], target: [0, 2.5, 2.0] },
        yard: { pos: [16.5, 8.8, 24.0], target: [0, 4.8, 0] },
      };
      return map[roomId];
    }
    case 'penthouse_skyline_tower': {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [-2.8, 5.6, 4.8], target: [-2.8, 4.0, -1.2] },
        kitchen: { pos: [3.6, 5.6, 4.2], target: [3.6, 4.0, -1.6] },
        hallway: { pos: [0, 2.5, 5.4], target: [0, 1.1, -0.5] },
        bathroom1: { pos: [4.2, 2.5, 4.4], target: [4.2, 1.0, -1.0] },
        bedroom: { pos: [-4.2, 2.5, 4.4], target: [-4.2, 1.0, -1.2] },
        study: { pos: [2.2, 5.6, 4.4], target: [2.2, 4.0, -1.4] },
        bathroom2: { pos: [4.5, 5.6, 3.8], target: [4.5, 4.0, -1.2] },
        balcony: { pos: [4.2, 6.0, 6.8], target: [3.2, 4.0, 1.5] },
        yard: { pos: [16.0, 12.0, 24.5], target: [0, 6.2, 0] },
      };
      return map[roomId];
    }
    case 'classic_estate':
    default: {
      const map: Record<RoomId, { pos: [number, number, number]; target: [number, number, number] }> = {
        living: { pos: [-3.5, 2.3, 4.3], target: [-3.5, 1.0, -1.2] },
        kitchen: { pos: [3.5, 2.3, 0.9], target: [3.5, 1.0, -2.8] },
        hallway: { pos: [1.8, 2.2, 4.4], target: [1.8, 1.1, 2.0] },
        bathroom1: { pos: [5.3, 2.2, 4.4], target: [5.3, 1.0, 2.2] },
        bedroom: { pos: [-3.5, 5.4, 4.1], target: [-3.5, 4.2, -1.5] },
        study: { pos: [3.5, 5.4, 0.8], target: [3.5, 4.2, -2.5] },
        bathroom2: { pos: [5.3, 5.4, 4.3], target: [5.3, 4.1, 2.2] },
        balcony: { pos: [-1.0, 5.3, 6.8], target: [-4.2, 4.2, 5.8] },
        yard: { pos: [14.5, 8.5, 16.5], target: [0, 2.6, 0] },
      };
      return map[roomId];
    }
  }
}
