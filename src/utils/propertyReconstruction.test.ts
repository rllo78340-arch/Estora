import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  detectArchetypeFromListing,
  generatePropertyArchConfig,
  getDollhouseCameraForArchetype,
  getRoomCameraForArchetype,
  type VisionArchOverride,
} from './propertyReconstruction';
import { createArchitecturalHouseGroup } from './proceduralArchitecture3d';
import { getFurnishedHouseItemsForProperty } from './interiorLayoutLogic';

test('detectArchetypeFromListing maps seeded ESTORA listing photos to distinct building archetypes', () => {
  const boulevard = generatePropertyArchConfig({
    id: 1,
    title: 'Резиденция Boulevard Park',
    propertyType: 'villa',
    totalFloors: 2,
    imageUrl: '/src/assets/images/hero_tashkent_residence_1794853627912.jpg',
  });

  const samarkand = generatePropertyArchConfig({
    id: 3,
    title: 'Вилла Silk Road Courtyard',
    propertyType: 'villa',
    totalFloors: 2,
    imageUrl: '/src/assets/images/prop_samarkand_villa_1794853628391.jpg',
  });

  const complex = generatePropertyArchConfig({
    id: 8,
    title: 'ЖК Tashkent Residences — Новая очередь',
    propertyType: 'new_build',
    totalFloors: 12,
    imageUrl: '/src/assets/images/prop_new_build_tashkent_1794854289325.jpg',
  });

  const bukhara = generatePropertyArchConfig({
    id: 5,
    title: 'Исторический особняк Ark Heritage',
    propertyType: 'house',
    totalFloors: 2,
    imageUrl: '/src/assets/images/prop_bukhara_estate_1794853628569.jpg',
  });

  const commercial = generatePropertyArchConfig({
    id: 6,
    title: 'Бизнес-центр Amir Temur',
    propertyType: 'commercial',
    totalFloors: 6,
    imageUrl: '/src/assets/images/prop_commercial_tower_1794853629336.jpg',
  });

  assert.equal(boulevard.archetype, 'boulevard_cantilever_villa');
  assert.equal(boulevard.poolPlacement, 'front_center');
  assert.equal(boulevard.hasPergola, true);

  assert.equal(samarkand.archetype, 'samarkand_courtyard_villa');
  assert.equal(samarkand.poolPlacement, 'courtyard_stepping');
  assert.equal(samarkand.hasGlassSunroom, true);

  assert.equal(complex.archetype, 'tashkent_residences_complex');
  assert.equal(complex.hasWoodBalconies, true);
  assert.ok(complex.floors >= 6);

  assert.equal(bukhara.archetype, 'bukhara_heritage_courtyard');
  assert.equal(bukhara.hasCourtyardArches, true);

  assert.equal(commercial.archetype, 'commercial_glass_tower');
  assert.equal(commercial.hasPool, false);

  const uniqueArchetypes = new Set([
    boulevard.archetype,
    samarkand.archetype,
    complex.archetype,
    bukhara.archetype,
    commercial.archetype,
  ]);
  assert.equal(uniqueArchetypes.size, 5);
});

test('generatePropertyArchConfig respects VisionArchOverride from Gemini Vision', () => {
  const override: VisionArchOverride = {
    archetype: 'modern_pergola_villa',
    floors: 3,
    hasPool: true,
    poolPlacement: 'side',
    hasPergola: true,
    wallColor: '#E8DAC4',
    interiorWallColor: '#EDE6DA',
    interiorFloorFinish: 'marble',
    sofaColor: '#DCD4C8',
    styleLabel: 'Вилла с панорамным остеклением и перголой (AI Vision)',
  };

  const cfg = generatePropertyArchConfig(
    {
      id: 99,
      title: 'Пользовательское объявление',
      propertyType: 'house',
      imageUrl: '/uploads/custom-photo-123.jpg',
    },
    override
  );

  assert.equal(cfg.archetype, 'modern_pergola_villa');
  assert.equal(cfg.floors, 3);
  assert.equal(cfg.poolPlacement, 'side');
  assert.equal(cfg.isAiVisionMatched, true);
  assert.equal(cfg.interior.wallColor, '#EDE6DA');
  assert.equal(cfg.interior.floorFinish, 'marble');
  assert.equal(cfg.interior.sofaColor, '#DCD4C8');
  assert.equal(cfg.styleLabel, 'Вилла с панорамным остеклением и перголой (AI Vision)');
});

test('createArchitecturalHouseGroup keeps photo-matched geometry across Exterior, Dollhouse, and Floor1 views', () => {
  const cfg1 = generatePropertyArchConfig({
    id: 1,
    propertyType: 'villa',
    imageUrl: '/src/assets/images/hero_tashkent_residence_1794853627912.jpg',
  });
  const cfg3 = generatePropertyArchConfig({
    id: 3,
    propertyType: 'villa',
    imageUrl: '/src/assets/images/prop_samarkand_villa_1794853628391.jpg',
  });
  const cfg8 = generatePropertyArchConfig({
    id: 8,
    propertyType: 'new_build',
    totalFloors: 12,
    imageUrl: '/src/assets/images/prop_new_build_tashkent_1794854289325.jpg',
  });

  const buildFromCfg = (
    cfg: ReturnType<typeof generatePropertyArchConfig>,
    overrides: Partial<Parameters<typeof createArchitecturalHouseGroup>[0]> = {}
  ) =>
    createArchitecturalHouseGroup({
      wallColor: cfg.wallColor,
      wallFinish: 'plaster',
      floorMaterial: cfg.interior.floorColor,
      floorFinish: cfg.interior.floorFinish,
      ceilingColor: '#FFFFFF',
      facadeStyle: cfg.facadeStyle,
      archetype: cfg.archetype,
      accentColor: cfg.accentColor,
      interiorWallColor: cfg.interior.wallColor,
      interiorFloorColor: cfg.interior.floorColor,
      poolPlacement: cfg.poolPlacement,
      hasPergola: cfg.hasPergola,
      hasWoodBalconies: cfg.hasWoodBalconies,
      hasGlassSunroom: cfg.hasGlassSunroom,
      hasCourtyardArches: cfg.hasCourtyardArches,
      hasGarage: cfg.hasGarage,
      showRoof: true,
      showExteriorWalls: true,
      exteriorWallOpacity: 1,
      activeFloorFilter: 'all',
      showYard: true,
      isUltra4K: false,
      isSoftwareGl: true,
      hasPool: cfg.hasPool,
      hasBalcony: cfg.hasBalcony,
      hasTerrace: cfg.hasTerrace,
      roofType: cfg.roofType,
      floors: cfg.floors,
      ...overrides,
    });

  const g1 = buildFromCfg(cfg1);
  const g3 = buildFromCfg(cfg3);
  const g8 = buildFromCfg(cfg8);

  assert.equal(g1.name, 'archetype_boulevard_cantilever_villa');
  assert.equal(g3.name, 'archetype_samarkand_courtyard_villa');
  assert.equal(g8.name, 'archetype_tashkent_residences_complex');

  // Dollhouse cutaway & single-floor views MUST keep the same photo-matched building instead of falling back
  const g1Dollhouse = buildFromCfg(cfg1, { showRoof: false, exteriorWallOpacity: 0.25 });
  const g3Floor1 = buildFromCfg(cfg3, { showRoof: false, exteriorWallOpacity: 0.25, activeFloorFilter: 1 });
  assert.equal(g1Dollhouse.name, 'archetype_boulevard_cantilever_villa');
  assert.equal(g3Floor1.name, 'archetype_samarkand_courtyard_villa');

  const box1 = new THREE.Box3().setFromObject(g1).getSize(new THREE.Vector3());
  const box8 = new THREE.Box3().setFromObject(g8).getSize(new THREE.Vector3());
  assert.ok(box8.y > box1.y + 4, 'Multi-story complex must be significantly taller than 2-story villa');

  // Verify default cutaway mode remains intact for InteriorDesigner3D when no archetype is passed
  const cutaway = createArchitecturalHouseGroup({
    wallColor: '#F3F1EC',
    wallFinish: 'paint',
    floorMaterial: '#9E7347',
    floorFinish: 'parquet',
    ceilingColor: '#FFFFFF',
    facadeStyle: 'classic',
    showRoof: false,
    showExteriorWalls: true,
    exteriorWallOpacity: 0.25,
    activeFloorFilter: 'all',
    showYard: true,
    isUltra4K: false,
    isSoftwareGl: true,
  });
  assert.equal(cutaway.name, 'estora_architectural_house');
  assert.equal(
    detectArchetypeFromListing({ id: 4, imageUrl: '/src/assets/images/prop_tashkent_apartment_1794853628562.jpg' }),
    'penthouse_skyline_tower'
  );
});

test('getFurnishedHouseItemsForProperty builds distinct interiors and cameras matched to each archetype', () => {
  const bukharaCfg = generatePropertyArchConfig({
    id: 5,
    propertyType: 'house',
    imageUrl: '/src/assets/images/prop_bukhara_estate_1794853628569.jpg',
  });
  const commercialCfg = generatePropertyArchConfig({
    id: 6,
    propertyType: 'commercial',
    imageUrl: '/src/assets/images/prop_luxury_office_uz_1794854288611.jpg',
  });

  const bukharaItems = getFurnishedHouseItemsForProperty(5, 'house', bukharaCfg);
  const commercialItems = getFurnishedHouseItemsForProperty(6, 'commercial', commercialCfg);

  const bukharaRug = bukharaItems.find((it) => it.type === 'rug');
  assert.ok(bukharaRug, 'Bukhara pavilion should include heritage wool rug');
  assert.equal(bukharaRug.color, '#7E2326');

  const commercialBeds = commercialItems.filter((it) => it.type === 'bed');
  const commercialTubs = commercialItems.filter((it) => it.type === 'bathtub');
  assert.equal(commercialBeds.length, 0, 'Commercial business center must not place residential beds');
  assert.equal(commercialTubs.length, 0, 'Commercial business center must not place bathtubs');

  const samarkandLivingCam = getRoomCameraForArchetype('samarkand_courtyard_villa', 'living');
  const boulevardLivingCam = getRoomCameraForArchetype('boulevard_cantilever_villa', 'living');
  assert.notDeepEqual(samarkandLivingCam.pos, boulevardLivingCam.pos);

  const commercialDollCam = getDollhouseCameraForArchetype('commercial_glass_tower', 'dollhouse');
  const classicDollCam = getDollhouseCameraForArchetype('classic_estate', 'dollhouse');
  assert.notDeepEqual(commercialDollCam.pos, classicDollCam.pos);
});
