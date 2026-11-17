import * as THREE from 'three';
import type { FurnitureItem } from './interiorLayoutLogic.ts';
import type { BuildingArchetype, InteriorFloorFinish, PoolPlacement } from './propertyReconstruction.ts';
import { buildPhotoMatchedExteriorGroup } from './proceduralBuildingArchetypes3d.ts';
import {
  createBrickOrStoneTexture,
  createCeramicTileTexture,
  createGrassLawnTexture,
  createMarbleTexture,
  createParquetTexture,
  createPBRMaterial,
  createRoofTileTexture,
} from './proceduralMaterials3d.ts';

export interface FurnitureBuildOptions {
  isSelected?: boolean;
  hasCollision?: boolean;
  isUltra4K?: boolean;
  isSoftwareGl?: boolean;
}

export interface HouseArchitectureConfig {
  wallColor: string;
  wallFinish: 'paint' | 'plaster' | 'brick' | 'marble' | 'tile';
  floorMaterial: string;
  floorFinish: InteriorFloorFinish;
  ceilingColor: string;
  facadeStyle: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
  showRoof: boolean;
  showExteriorWalls: boolean;
  exteriorWallOpacity: number;
  activeFloorFilter: 'all' | 1 | 2;
  showYard: boolean;
  isUltra4K: boolean;
  isSoftwareGl: boolean;
  hasPool?: boolean;
  poolPlacement?: PoolPlacement;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  roofType?: 'sloped' | 'flat' | 'mansard';
  floors?: number;
  archetype?: BuildingArchetype;
  accentColor?: string;
  interiorWallColor?: string;
  interiorFloorColor?: string;
  hasPergola?: boolean;
  hasWoodBalconies?: boolean;
  hasGlassSunroom?: boolean;
  hasCourtyardArches?: boolean;
  hasGarage?: boolean;
}

function enableShadows(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

/**
 * Builds a composite, multi-part 3D furniture group grounded at y = 0.
 * Every furniture item has 4 to 16 distinct geometric parts (never a single box).
 */
export function createCompositeFurnitureGroup(
  item: FurnitureItem,
  options: FurnitureBuildOptions = {}
): THREE.Group {
  const group = new THREE.Group();
  group.name = `furniture_${item.id}`;
  group.userData = { furnitureId: item.id, item };

  const { isSelected = false, hasCollision = false, isUltra4K = false, isSoftwareGl = false } = options;

  const primaryMat = createPBRMaterial({
    color: item.color,
    materialType: item.material,
    isUltra4K,
    isSoftwareGl,
  });
  const secondaryMat = createPBRMaterial({
    color: item.secondaryColor || '#D4B483',
    materialType: item.material === 'marble' ? 'walnut' : 'fabric',
    isUltra4K,
    isSoftwareGl,
  });
  const darkWoodMat = createPBRMaterial({
    color: '#3D2B1F',
    materialType: 'walnut',
    isUltra4K,
    isSoftwareGl,
  });
  const brassMat = createPBRMaterial({
    color: '#D4B483',
    materialType: 'brass',
    isUltra4K,
    isSoftwareGl,
  });
  const chromeMat = createPBRMaterial({
    color: '#DCE1E5',
    materialType: 'metal',
    isUltra4K,
    isSoftwareGl,
  });
  const whiteFabricMat = createPBRMaterial({
    color: '#F7F5F0',
    materialType: 'fabric',
    isUltra4K,
    isSoftwareGl,
  });
  const glassMat = createPBRMaterial({
    color: '#DCEEF8',
    materialType: 'glass',
    isUltra4K,
    isSoftwareGl,
  });

  const w = item.width;
  const h = item.height;
  const d = item.depth;

  switch (item.type) {
    case 'sofa_sectional':
    case 'sofa_modern': {
      const legH = 0.12;
      const baseH = 0.18;
      const seatH = 0.18;
      const mainDepth = item.type === 'sofa_sectional' ? Math.min(0.95, d * 0.58) : d;

      // 4 tapered brass legs + corner supports
      const legGeo = new THREE.CylinderGeometry(0.025, 0.015, legH, 12);
      const legOffsets = [
        [-w / 2 + 0.12, legH / 2, -d / 2 + 0.12],
        [w / 2 - 0.12, legH / 2, -d / 2 + 0.12],
        [-w / 2 + 0.12, legH / 2, d / 2 - 0.12],
        [w / 2 - 0.12, legH / 2, -d / 2 + mainDepth - 0.12],
      ];
      for (const [lx, ly, lz] of legOffsets) {
        const leg = new THREE.Mesh(legGeo, brassMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      }

      // Main upholstered base platform
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, mainDepth), darkWoodMat);
      baseMesh.position.set(0, legH + baseH / 2, -d / 2 + mainDepth / 2);
      group.add(baseMesh);

      // 3 individual seat cushions
      const cushionCount = 3;
      const innerW = w - 0.36;
      const cushW = innerW / cushionCount - 0.02;
      for (let i = 0; i < cushionCount; i++) {
        const cx = -innerW / 2 + cushW / 2 + i * (cushW + 0.025);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(cushW, seatH, mainDepth - 0.14), primaryMat);
        seat.position.set(cx, legH + baseH + seatH / 2, -d / 2 + mainDepth / 2 + 0.04);
        group.add(seat);

        // Backrest cushion
        const back = new THREE.Mesh(new THREE.BoxGeometry(cushW - 0.02, h - (legH + baseH + 0.08), 0.22), primaryMat);
        back.position.set(cx, legH + baseH + (h - legH - baseH) / 2, -d / 2 + 0.14);
        back.rotation.x = -0.08;
        group.add(back);
      }

      // Chaise lounge extension for sectional
      if (item.type === 'sofa_sectional') {
        const chaiseW = w * 0.34;
        const chaiseD = d - mainDepth;
        const chaiseBase = new THREE.Mesh(new THREE.BoxGeometry(chaiseW, baseH, chaiseD), darkWoodMat);
        chaiseBase.position.set(-w / 2 + chaiseW / 2, legH + baseH / 2, -d / 2 + mainDepth + chaiseD / 2);
        group.add(chaiseBase);

        const chaiseCush = new THREE.Mesh(new THREE.BoxGeometry(chaiseW - 0.18, seatH, chaiseD + 0.05), primaryMat);
        chaiseCush.position.set(-w / 2 + chaiseW / 2 + 0.06, legH + baseH + seatH / 2, -d / 2 + mainDepth + chaiseD / 2);
        group.add(chaiseCush);
      }

      // Left & Right sculpted armrests
      const armH = h * 0.68;
      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, armH - legH, mainDepth), primaryMat);
      leftArm.position.set(-w / 2 + 0.09, legH + (armH - legH) / 2, -d / 2 + mainDepth / 2);
      group.add(leftArm);

      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, armH - legH, mainDepth), primaryMat);
      rightArm.position.set(w / 2 - 0.09, legH + (armH - legH) / 2, -d / 2 + mainDepth / 2);
      group.add(rightArm);

      // Decorative throw pillows
      const pillowGeo = new THREE.BoxGeometry(0.36, 0.34, 0.12);
      const p1 = new THREE.Mesh(pillowGeo, secondaryMat);
      p1.position.set(-w / 2 + 0.34, legH + baseH + seatH + 0.14, -d / 2 + 0.32);
      p1.rotation.set(0.15, 0.25, -0.12);
      group.add(p1);

      const p2 = new THREE.Mesh(pillowGeo, secondaryMat);
      p2.position.set(w / 2 - 0.34, legH + baseH + seatH + 0.14, -d / 2 + 0.32);
      p2.rotation.set(0.15, -0.25, 0.12);
      group.add(p2);
      break;
    }

    case 'armchair': {
      const legH = 0.22;
      const legGeo = new THREE.CylinderGeometry(0.022, 0.014, legH, 10);
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(sx * (w * 0.36), legH / 2, sz * (d * 0.36));
        leg.rotation.z = sx * -0.12;
        leg.rotation.x = sz * 0.12;
        group.add(leg);
      }

      const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 0.18, d * 0.82), primaryMat);
      seat.position.set(0, legH + 0.09, 0.03);
      group.add(seat);

      const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h - legH - 0.1, 0.16), primaryMat);
      back.position.set(0, legH + (h - legH) / 2, -d * 0.34);
      back.rotation.x = -0.14;
      group.add(back);

      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, d * 0.78), primaryMat);
        arm.position.set(sx * (w * 0.42), legH + 0.22, 0);
        group.add(arm);
      }

      const cushion = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.26, 0.1), whiteFabricMat);
      cushion.position.set(0, legH + 0.28, -d * 0.2);
      cushion.rotation.x = -0.18;
      group.add(cushion);
      break;
    }

    case 'coffee_table': {
      const topThick = 0.05;
      const legH = h - topThick;

      // Cross-frame walnut/brass legs
      const legGeo = new THREE.BoxGeometry(0.06, legH, d * 0.78);
      for (const sx of [-1, 1]) {
        const legFrame = new THREE.Mesh(legGeo, darkWoodMat);
        legFrame.position.set(sx * (w * 0.36), legH / 2, 0);
        group.add(legFrame);
      }
      const stretcher = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.04, 0.06), brassMat);
      stretcher.position.set(0, legH * 0.35, 0);
      group.add(stretcher);

      // Tabletop slab
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, topThick, d), primaryMat);
      top.position.set(0, h - topThick / 2, 0);
      group.add(top);

      // Decor tray + stacked art books + sculptural vase on top
      const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.22), secondaryMat);
      book1.position.set(-w * 0.2, h + 0.018, 0.04);
      group.add(book1);

      const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.19), whiteFabricMat);
      book2.position.set(-w * 0.2, h + 0.05, 0.04);
      book2.rotation.y = 0.22;
      group.add(book2);

      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.22, 16), brassMat);
      vase.position.set(w * 0.2, h + 0.11, -0.05);
      group.add(vase);
      break;
    }

    case 'tv_stand': {
      const consoleH = 0.52;
      const legH = 0.12;
      // Legs
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, legH, 10), brassMat);
        leg.position.set(sx * (w * 0.44), legH / 2, sz * (d * 0.36));
        group.add(leg);
      }

      // Console body
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, consoleH - legH, d), primaryMat);
      body.position.set(0, legH + (consoleH - legH) / 2, 0);
      group.add(body);

      // Slatted front doors with brass handles
      const doorCount = 4;
      const doorW = (w - 0.08) / doorCount;
      for (let i = 0; i < doorCount; i++) {
        const dx = -w / 2 + 0.04 + doorW / 2 + i * doorW;
        const door = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.015, consoleH - legH - 0.05, 0.02), darkWoodMat);
        door.position.set(dx, legH + (consoleH - legH) / 2, d / 2 + 0.01);
        group.add(door);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.02), brassMat);
        handle.position.set(dx, consoleH - 0.08, d / 2 + 0.025);
        group.add(handle);
      }

      // Soundbar
      const soundbar = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.5, 0.055, 0.09),
        new THREE.MeshStandardMaterial({ color: '#1F1F1F', roughness: 0.4, metalness: 0.5 })
      );
      soundbar.position.set(0, consoleH + 0.03, d * 0.18);
      group.add(soundbar);

      // 77" 4K Ultra-Thin OLED TV screen + stand
      const tvW = w * 0.78;
      const tvH = Math.max(0.75, h - consoleH - 0.1);
      const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.24), chromeMat);
      standBase.position.set(0, consoleH + 0.01, -0.02);
      group.add(standBase);

      const standNeck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.04), chromeMat);
      standNeck.position.set(0, consoleH + 0.08, -0.05);
      group.add(standNeck);

      const tvFrame = new THREE.Mesh(
        new THREE.BoxGeometry(tvW, tvH, 0.03),
        new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.2, metalness: 0.8 })
      );
      tvFrame.position.set(0, consoleH + 0.12 + tvH / 2, -0.04);
      group.add(tvFrame);

      const tvScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(tvW - 0.03, tvH - 0.03),
        new THREE.MeshPhysicalMaterial({
          color: '#0D1B2A',
          emissive: '#102538',
          emissiveIntensity: 0.35,
          roughness: 0.08,
          metalness: 0.2,
          clearcoat: isSoftwareGl ? 0 : 0.9,
        })
      );
      tvScreen.position.set(0, consoleH + 0.12 + tvH / 2, -0.023);
      group.add(tvScreen);
      break;
    }

    case 'bed_double':
    case 'bed_single': {
      const isDouble = item.type === 'bed_double';
      const frameH = 0.28;
      const mattressH = 0.26;
      const legH = 0.08;

      // 4 corner legs
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, legH, 10), darkWoodMat);
        leg.position.set(sx * (w / 2 - 0.08), legH / 2, sz * (d / 2 - 0.08));
        group.add(leg);
      }

      // Upholstered bed frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, frameH, d), darkWoodMat);
      frame.position.set(0, legH + frameH / 2, 0);
      group.add(frame);

      // Tall tufted headboard (4 vertical panels)
      const headH = h;
      const headThick = 0.14;
      const panelCount = isDouble ? 4 : 2;
      const panelW = w / panelCount;
      for (let i = 0; i < panelCount; i++) {
        const px = -w / 2 + panelW / 2 + i * panelW;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW - 0.02, headH - legH, headThick), secondaryMat);
        panel.position.set(px, legH + (headH - legH) / 2, -d / 2 + headThick / 2);
        group.add(panel);
      }

      // Plush white mattress
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, mattressH, d - 0.2), whiteFabricMat);
      mattress.position.set(0, legH + frameH + mattressH / 2, 0.04);
      group.add(mattress);

      // Layered duvet & throw blanket at foot of bed
      const duvet = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, mattressH + 0.05, (d - 0.2) * 0.68), primaryMat);
      duvet.position.set(0, legH + frameH + mattressH / 2 + 0.02, d * 0.17);
      group.add(duvet);

      const runner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, mattressH + 0.07, 0.42), secondaryMat);
      runner.position.set(0, legH + frameH + mattressH / 2 + 0.03, d * 0.34);
      group.add(runner);

      // Pillows (4 for double, 2 for single)
      const pillowCount = isDouble ? 2 : 1;
      const pW = (w - 0.3) / pillowCount - 0.06;
      for (let i = 0; i < pillowCount; i++) {
        const px = -((w - 0.3) / 2) + pW / 2 + i * (pW + 0.06);
        const backPillow = new THREE.Mesh(new THREE.BoxGeometry(pW, 0.22, 0.34), whiteFabricMat);
        backPillow.position.set(px, legH + frameH + mattressH + 0.1, -d / 2 + 0.32);
        backPillow.rotation.x = 0.28;
        group.add(backPillow);

        const frontPillow = new THREE.Mesh(new THREE.BoxGeometry(pW * 0.78, 0.18, 0.28), secondaryMat);
        frontPillow.position.set(px, legH + frameH + mattressH + 0.09, -d / 2 + 0.52);
        frontPillow.rotation.x = 0.22;
        group.add(frontPillow);
      }
      break;
    }

    case 'nightstand': {
      const cabinetH = 0.48;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, cabinetH - 0.08, d), primaryMat);
      body.position.set(0, 0.08 + (cabinetH - 0.08) / 2, 0);
      group.add(body);

      // 2 drawer fronts + brass knobs
      for (let r = 0; r < 2; r++) {
        const dy = 0.16 + r * 0.18;
        const drawer = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.15, 0.02), darkWoodMat);
        drawer.position.set(0, dy, d / 2 + 0.01);
        group.add(drawer);

        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.025, 12), brassMat);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(0, dy, d / 2 + 0.025);
        group.add(knob);
      }

      // Bedside table lamp (base + stem + warm glowing shade)
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 16), brassMat);
      lampBase.position.set(0, cabinetH + 0.04, 0);
      group.add(lampBase);

      const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), brassMat);
      lampStem.position.set(0, cabinetH + 0.15, 0);
      group.add(lampStem);

      const lampShade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.15, 0.18, 20),
        new THREE.MeshStandardMaterial({
          color: '#FFF8E7',
          emissive: '#FFDF9E',
          emissiveIntensity: 0.45,
          roughness: 0.6,
        })
      );
      lampShade.position.set(0, cabinetH + 0.28, 0);
      group.add(lampShade);
      break;
    }

    case 'wardrobe': {
      // Main cabinet corpus
      const corpus = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), primaryMat);
      corpus.position.set(0, h / 2, 0);
      group.add(corpus);

      // 3 vertical panelled doors with long brass handles
      const isAlongZ = d > w;
      const span = isAlongZ ? d : w;
      const doorCount = 3;
      const doorSpan = (span - 0.08) / doorCount;
      for (let i = 0; i < doorCount; i++) {
        const pos = -span / 2 + 0.04 + doorSpan / 2 + i * doorSpan;
        const doorGeo = isAlongZ
          ? new THREE.BoxGeometry(0.025, h - 0.14, doorSpan - 0.02)
          : new THREE.BoxGeometry(doorSpan - 0.02, h - 0.14, 0.025);
        const door = new THREE.Mesh(doorGeo, darkWoodMat);
        if (isAlongZ) {
          door.position.set(w / 2 + 0.015, h / 2, pos);
        } else {
          door.position.set(pos, h / 2, d / 2 + 0.015);
        }
        group.add(door);

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.65, 0.025), brassMat);
        if (isAlongZ) {
          handle.position.set(w / 2 + 0.035, h * 0.5, pos + doorSpan * 0.32);
        } else {
          handle.position.set(pos + doorSpan * 0.32, h * 0.5, d / 2 + 0.035);
        }
        group.add(handle);
      }
      break;
    }

    case 'kitchen_set': {
      const lowerH = 0.88;
      const counterThick = 0.04;
      const upperH = 0.78;
      const upperBottomY = 1.44;

      // Lower cabinets
      const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(w, lowerH, d - 0.04), primaryMat);
      lowerBody.position.set(0, lowerH / 2, -0.02);
      group.add(lowerBody);

      // Marble/stone countertop
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.02, counterThick, d + 0.02),
        createPBRMaterial({ color: '#F3EFEA', materialType: 'marble', isUltra4K, isSoftwareGl })
      );
      counter.position.set(0, lowerH + counterThick / 2, 0);
      group.add(counter);

      // Recessed stainless sink + arched gooseneck faucet
      const sinkRim = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.02, 0.46), chromeMat);
      sinkRim.position.set(-w * 0.24, lowerH + counterThick + 0.005, 0);
      group.add(sinkRim);

      const sinkWell = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.015, 0.38),
        new THREE.MeshStandardMaterial({ color: '#5A626A', roughness: 0.3, metalness: 0.85 })
      );
      sinkWell.position.set(-w * 0.24, lowerH + counterThick + 0.012, 0.02);
      group.add(sinkWell);

      const faucetStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 12), chromeMat);
      faucetStem.position.set(-w * 0.24, lowerH + counterThick + 0.16, -0.18);
      group.add(faucetStem);

      const faucetSpout = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.18), chromeMat);
      faucetSpout.position.set(-w * 0.24, lowerH + counterThick + 0.31, -0.1);
      group.add(faucetSpout);

      // Induction cooktop + built-in oven on the right
      const cooktop = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.015, 0.5),
        new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.1, metalness: 0.4 })
      );
      cooktop.position.set(w * 0.2, lowerH + counterThick + 0.008, 0.02);
      group.add(cooktop);

      // Built-in oven glass door
      const ovenDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.66, 0.58, 0.03),
        new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.15, metalness: 0.7 })
      );
      ovenDoor.position.set(w * 0.2, 0.48, d / 2 + 0.01);
      group.add(ovenDoor);

      // Upper cabinets (left & center) + stainless range hood (right)
      const upperCab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, upperH, d * 0.58), primaryMat);
      upperCab.position.set(-w * 0.18, upperBottomY + upperH / 2, -d * 0.21);
      group.add(upperCab);

      const hoodCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.5), chromeMat);
      hoodCanopy.position.set(w * 0.2, upperBottomY + 0.08, -0.05);
      group.add(hoodCanopy);

      const hoodChimney = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.68, 0.26), chromeMat);
      hoodChimney.position.set(w * 0.2, upperBottomY + 0.44, -0.16);
      group.add(hoodChimney);
      break;
    }

    case 'fridge': {
      // Main stainless cabinet
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d - 0.05), primaryMat);
      body.position.set(0, h / 2, -0.025);
      group.add(body);

      // Left & right French doors + bottom freezer drawer
      const upperDoorH = h * 0.62;
      const lowerDrawerH = h * 0.34;
      for (const sx of [-1, 1]) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.02, upperDoorH, 0.045), chromeMat);
        door.position.set(sx * (w / 4), h - upperDoorH / 2 - 0.02, d / 2 - 0.02);
        group.add(door);

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, upperDoorH * 0.72, 12), brassMat);
        handle.position.set(sx * 0.06, h - upperDoorH / 2 - 0.02, d / 2 + 0.02);
        group.add(handle);
      }

      const freezer = new THREE.Mesh(new THREE.BoxGeometry(w - 0.03, lowerDrawerH, 0.045), chromeMat);
      freezer.position.set(0, lowerDrawerH / 2 + 0.02, d / 2 - 0.02);
      group.add(freezer);

      // Ice/water dispenser recess
      const dispenser = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.26, 0.02),
        new THREE.MeshStandardMaterial({ color: '#1F2428', roughness: 0.3 })
      );
      dispenser.position.set(-w * 0.24, h * 0.62, d / 2 + 0.008);
      group.add(dispenser);
      break;
    }

    case 'kitchen_island': {
      const baseH = h - 0.05;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, baseH, d * 0.68), darkWoodMat);
      base.position.set(0, baseH / 2, -d * 0.1);
      group.add(base);

      // Waterfall marble top + side panels
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), primaryMat);
      top.position.set(0, h - 0.025, 0);
      group.add(top);

      // 2 bar stools tucked on the front side
      for (const sx of [-0.48, 0.48]) {
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.18, 0.06, 20), secondaryMat);
        stoolSeat.position.set(sx, 0.66, d * 0.32);
        group.add(stoolSeat);

        const stoolPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.64, 12), brassMat);
        stoolPost.position.set(sx, 0.32, d * 0.32);
        group.add(stoolPost);

        const stoolBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.02, 20), brassMat);
        stoolBase.position.set(sx, 0.01, d * 0.32);
        group.add(stoolBase);
      }

      // Fruit bowl on island
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.09, 0.09, 20), whiteFabricMat);
      bowl.position.set(0.25, h + 0.045, -0.05);
      group.add(bowl);
      break;
    }

    case 'dining_table': {
      const topThick = 0.045;
      const legH = h - topThick;

      // Tabletop
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, topThick, d), primaryMat);
      top.position.set(0, h - topThick / 2, 0);
      group.add(top);

      // 4 tapered wooden legs
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.02, legH, 12), primaryMat);
        leg.position.set(sx * (w / 2 - 0.12), legH / 2, sz * (d / 2 - 0.12));
        group.add(leg);
      }

      // 4 sculpted dining chairs around table
      const chairPositions: Array<[number, number, number]> = [
        [-w * 0.24, -d / 2 - 0.22, 0],
        [w * 0.24, -d / 2 - 0.22, 0],
        [-w * 0.24, d / 2 + 0.22, Math.PI],
        [w * 0.24, d / 2 + 0.22, Math.PI],
      ];
      for (const [cx, cz, rot] of chairPositions) {
        const chairGrp = new THREE.Group();
        chairGrp.position.set(cx, 0, cz);
        chairGrp.rotation.y = rot;

        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), secondaryMat);
        seat.position.set(0, 0.46, 0);
        chairGrp.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.04), secondaryMat);
        back.position.set(0, 0.68, -0.2);
        chairGrp.add(back);

        for (const [lsx, lsz] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.45, 8), darkWoodMat);
          cLeg.position.set(lsx * 0.18, 0.225, lsz * 0.18);
          chairGrp.add(cLeg);
        }
        group.add(chairGrp);
      }
      break;
    }

    case 'bathtub': {
      // Sculpted oval freestanding bathtub shell
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, h, 28), primaryMat);
      outer.scale.set(w / 0.84, 1, d / 0.84);
      outer.position.set(0, h / 2, 0);
      group.add(outer);

      // Inner water/basin recess
      const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.32, 0.04, 28),
        new THREE.MeshPhysicalMaterial({
          color: '#BDE0FE',
          roughness: 0.08,
          transmission: isSoftwareGl ? 0 : 0.7,
          transparent: true,
          opacity: 0.85,
        })
      );
      inner.scale.set((w - 0.14) / 0.72, 1, (d - 0.14) / 0.72);
      inner.position.set(0, h - 0.03, 0);
      group.add(inner);

      // Floor-mounted chrome faucet column
      const standpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, h + 0.24, 14), brassMat);
      standpipe.position.set(0, (h + 0.24) / 2, -d / 2 - 0.06);
      group.add(standpipe);

      const spout = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.18), brassMat);
      spout.position.set(0, h + 0.22, -d / 2 + 0.02);
      group.add(spout);
      break;
    }

    case 'shower': {
      // Low marble tray
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.07, d),
        createPBRMaterial({ color: '#EAE6DF', materialType: 'marble', isUltra4K, isSoftwareGl })
      );
      tray.position.set(0, 0.035, 0);
      group.add(tray);

      // Tempered glass panels + black/chrome profile bars
      const glassPanelFront = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.07, 0.02), glassMat);
      glassPanelFront.position.set(0, 0.07 + (h - 0.07) / 2, d / 2 - 0.01);
      group.add(glassPanelFront);

      const glassPanelSide = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - 0.07, d), glassMat);
      glassPanelSide.position.set(-w / 2 + 0.01, 0.07 + (h - 0.07) / 2, 0);
      group.add(glassPanelSide);

      // Rain showerhead + riser bar
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, h * 0.78, 12), chromeMat);
      riser.position.set(w * 0.28, h * 0.48, -d / 2 + 0.05);
      group.add(riser);

      const rainHead = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 20), chromeMat);
      rainHead.position.set(w * 0.28, h * 0.88, -d * 0.18);
      group.add(rainHead);
      break;
    }

    case 'sink': {
      const vanityH = 0.82;
      // Floating wooden cabinet
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(w, 0.52, d), darkWoodMat);
      cabinet.position.set(0, vanityH - 0.28, 0);
      group.add(cabinet);

      // Countertop + ceramic vessel basin
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), primaryMat);
      top.position.set(0, vanityH, 0);
      group.add(top);

      const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.13, 24), primaryMat);
      basin.position.set(0, vanityH + 0.065, 0.02);
      group.add(basin);

      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.18, 12), brassMat);
      tap.position.set(0, vanityH + 0.11, -0.16);
      group.add(tap);

      // Illuminated LED wall mirror above
      const mirrorFrame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.03, 32),
        new THREE.MeshStandardMaterial({
          color: '#FFFDF7',
          emissive: '#FFE8B3',
          emissiveIntensity: 0.4,
        })
      );
      mirrorFrame.rotation.x = Math.PI / 2;
      mirrorFrame.position.set(0, vanityH + 0.62, -d / 2 + 0.02);
      group.add(mirrorFrame);

      const mirrorGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.33, 0.33, 0.035, 32),
        new THREE.MeshStandardMaterial({ color: '#E2EBF0', roughness: 0.05, metalness: 0.92 })
      );
      mirrorGlass.rotation.x = Math.PI / 2;
      mirrorGlass.position.set(0, vanityH + 0.62, -d / 2 + 0.025);
      group.add(mirrorGlass);
      break;
    }

    case 'toilet': {
      const bowlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.42, 20), primaryMat);
      bowlBase.position.set(0, 0.21, 0.06);
      group.add(bowlBase);

      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.04, 20), primaryMat);
      seat.scale.set(1, 1, 1.25);
      seat.position.set(0, 0.43, 0.08);
      group.add(seat);

      const tank = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.38, 0.18), primaryMat);
      tank.position.set(0, 0.58, -d / 2 + 0.1);
      group.add(tank);

      const flushBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), chromeMat);
      flushBtn.position.set(0, 0.78, -d / 2 + 0.1);
      group.add(flushBtn);
      break;
    }

    case 'bookshelf': {
      const shelfCount = 5;
      const sideThick = 0.035;
      const isAlongZ = d > w;
      const span = isAlongZ ? d : w;
      const depthSpan = isAlongZ ? w : d;

      const innerGroup = new THREE.Group();
      // Left & right vertical uprights
      for (const sx of [-1, 1]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(sideThick, h, depthSpan), primaryMat);
        upright.position.set(sx * (span / 2 - sideThick / 2), h / 2, 0);
        innerGroup.add(upright);
      }

      // Horizontal shelves + colorful books
      const bookColors = ['#8C2D19', '#1D3557', '#2A6F4E', '#D4A373', '#4A4E69', '#BC6C25'];
      for (let s = 0; s < shelfCount; s++) {
        const sy = 0.08 + (s * (h - 0.16)) / (shelfCount - 1);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(span - sideThick, 0.03, depthSpan), primaryMat);
        shelf.position.set(0, sy, 0);
        innerGroup.add(shelf);

        if (s < shelfCount - 1) {
          for (let b = 0; b < 5; b++) {
            const bookH = 0.22 + ((s + b) % 3) * 0.03;
            const bookMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.045, bookH, depthSpan * 0.65),
              new THREE.MeshStandardMaterial({ color: bookColors[(s * 3 + b) % bookColors.length], roughness: 0.7 })
            );
            bookMesh.position.set(-span * 0.34 + b * 0.055, sy + 0.015 + bookH / 2, 0);
            innerGroup.add(bookMesh);
          }
        }
      }

      if (isAlongZ) {
        innerGroup.rotation.y = Math.PI / 2;
      }
      group.add(innerGroup);
      break;
    }

    case 'desk': {
      const deskH = 0.75;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), primaryMat);
      top.position.set(0, deskH - 0.02, 0);
      group.add(top);

      // Drawer pedestal on right + metal leg on left
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.42, deskH - 0.04, d * 0.88), darkWoodMat);
      pedestal.position.set(w / 2 - 0.24, (deskH - 0.04) / 2, 0);
      group.add(pedestal);

      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, deskH - 0.04, d * 0.86), brassMat);
      leftLeg.position.set(-w / 2 + 0.08, (deskH - 0.04) / 2, 0);
      group.add(leftLeg);

      // Ultrawide Curved Monitor + Stand on Desk
      const monStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 0.14, 14), chromeMat);
      monStand.position.set(-0.1, deskH + 0.07, -d * 0.22);
      group.add(monStand);

      const monScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.32, 0.02),
        new THREE.MeshStandardMaterial({ color: '#141B24', emissive: '#1D3557', emissiveIntensity: 0.3, roughness: 0.15 })
      );
      monScreen.position.set(-0.1, deskH + 0.26, -d * 0.2);
      group.add(monScreen);

      // Office swivel chair
      const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.46), secondaryMat);
      chairSeat.position.set(-0.1, 0.48, d * 0.38);
      group.add(chairSeat);

      const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.05), secondaryMat);
      chairBack.position.set(-0.1, 0.74, d * 0.6);
      group.add(chairBack);

      const chairPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 10), chromeMat);
      chairPost.position.set(-0.1, 0.225, d * 0.38);
      group.add(chairPost);
      break;
    }

    case 'rug': {
      // Outer border + inner woven field
      const outer = new THREE.Mesh(new THREE.BoxGeometry(w, 0.016, d), secondaryMat);
      outer.position.set(0, 0.008, 0);
      group.add(outer);

      const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.022, d - 0.18), primaryMat);
      inner.position.set(0, 0.011, 0);
      group.add(inner);
      break;
    }

    case 'floor_lamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.05, 20), primaryMat);
      base.position.set(0, 0.025, 0);
      group.add(base);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, h - 0.25, 14), brassMat);
      pole.position.set(0, (h - 0.25) / 2 + 0.05, 0);
      group.add(pole);

      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, 0.28, 24),
        new THREE.MeshStandardMaterial({
          color: '#FFF9EB',
          emissive: '#FFE099',
          emissiveIntensity: 0.55,
          roughness: 0.5,
        })
      );
      shade.position.set(0, h - 0.18, 0);
      group.add(shade);
      break;
    }

    case 'plant': {
      const potH = h * 0.32;
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.34, w * 0.24, potH, 20),
        createPBRMaterial({ color: '#EBE6DC', materialType: 'ceramic', isUltra4K, isSoftwareGl })
      );
      pot.position.set(0, potH / 2, 0);
      group.add(pot);

      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.32, w * 0.32, 0.03, 18),
        new THREE.MeshStandardMaterial({ color: '#3B2818', roughness: 0.95 })
      );
      soil.position.set(0, potH - 0.01, 0);
      group.add(soil);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, h * 0.55, 10), darkWoodMat);
      stem.position.set(0, potH + (h * 0.55) / 2, 0);
      group.add(stem);

      const leafMat = new THREE.MeshStandardMaterial({ color: item.color || '#2D6A4F', roughness: 0.45 });
      const leafCount = 9;
      for (let i = 0; i < leafCount; i++) {
        const angle = (i / leafCount) * Math.PI * 2;
        const tier = i % 3;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(w * 0.24, 12, 10), leafMat);
        leaf.scale.set(1.1, 0.22, 0.65);
        const radius = w * (0.22 + tier * 0.06);
        leaf.position.set(
          Math.cos(angle) * radius,
          potH + h * (0.34 + tier * 0.16),
          Math.sin(angle) * radius
        );
        leaf.rotation.y = -angle;
        leaf.rotation.z = -0.35;
        group.add(leaf);
      }
      break;
    }

    case 'mirror':
    case 'painting': {
      const isAlongZ = d > w;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brassMat);
      frame.position.set(0, h / 2, 0);
      group.add(frame);

      const innerMat =
        item.type === 'mirror'
          ? new THREE.MeshStandardMaterial({ color: '#DCE8EE', roughness: 0.04, metalness: 0.94 })
          : primaryMat;

      const surfaceGeo = isAlongZ
        ? new THREE.BoxGeometry(w + 0.01, h - 0.08, d - 0.08)
        : new THREE.BoxGeometry(w - 0.08, h - 0.08, d + 0.01);
      const surface = new THREE.Mesh(surfaceGeo, innerMat);
      surface.position.set(0, h / 2, 0);
      group.add(surface);
      break;
    }

    default: {
      // Multi-part cabinet / dresser / partition fallback with plinth, body, top cap, and brass trim
      const plinthH = 0.08;
      const capH = 0.04;
      const bodyH = Math.max(0.1, h - plinthH - capH);

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, plinthH, d * 0.94), darkWoodMat);
      plinth.position.set(0, plinthH / 2, 0);
      group.add(plinth);

      const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), primaryMat);
      body.position.set(0, plinthH + bodyH / 2, 0);
      group.add(body);

      const topCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, capH, d + 0.02), brassMat);
      topCap.position.set(0, h - capH / 2, 0);
      group.add(topCap);
      break;
    }
  }

  // Selection or collision outline ring on the floor
  if (isSelected || hasCollision) {
    const ringColor = hasCollision ? '#DC2626' : '#D4B483';
    const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.08, h + 0.06, d + 0.08));
    const outlineMat = new THREE.LineBasicMaterial({ color: ringColor });
    const outline = new THREE.LineSegments(outlineGeo, outlineMat);
    outline.position.set(0, h / 2, 0);
    group.add(outline);
  }

  enableShadows(group, true, true);
  return group;
}

/**
 * Builds the complete 2-story architectural residence with exterior facade, pitched roof,
 * framed windows, entrance door, balcony, staircase, garage, car, lawn, trees, and fence.
 */
export function createArchitecturalHouseGroup(config: HouseArchitectureConfig): THREE.Group {
  const houseGroup = new THREE.Group();
  houseGroup.name = 'estora_architectural_house';

  const {
    wallColor,
    wallFinish,
    floorMaterial,
    floorFinish,
    facadeStyle,
    showRoof,
    showExteriorWalls,
    exteriorWallOpacity,
    activeFloorFilter,
    showYard,
    isUltra4K,
    isSoftwareGl,
    hasPool,
    poolPlacement = 'side',
    roofType = 'sloped',
    floors = 2,
    archetype,
    accentColor = '#8B5E3C',
    interiorWallColor,
    interiorFloorColor,
    hasPergola = false,
    hasWoodBalconies = false,
    hasGlassSunroom = false,
    hasCourtyardArches = false,
    hasGarage = true,
  } = config;

  // Render the unified photo-matched architectural building across Exterior 360°, Dollhouse, Floor 1, and Floor 2
  if (archetype && archetype !== 'classic_estate') {
    const matchedBuilding = buildPhotoMatchedExteriorGroup({
      archetype,
      wallColor,
      accentColor,
      facadeStyle,
      floors,
      roofType,
      hasPool: Boolean(hasPool),
      poolPlacement,
      hasPergola,
      hasWoodBalconies,
      hasGlassSunroom,
      hasCourtyardArches,
      hasGarage,
      isUltra4K,
      isSoftwareGl,
      showRoof,
      isCutaway: !showRoof || !showExteriorWalls || exteriorWallOpacity < 0.95,
      activeFloorFilter,
      interiorWallColor: interiorWallColor || wallColor,
      interiorFloorFinish: floorFinish,
      interiorFloorColor: interiorFloorColor || floorMaterial,
    });
    if (matchedBuilding) {
      return matchedBuilding;
    }
  }

  // Materials
  const interiorWallMat = createPBRMaterial({
    color: wallColor || '#F2EFE9',
    materialType: wallFinish === 'brick' ? 'brick' : wallFinish === 'marble' ? 'marble' : wallFinish === 'tile' ? 'ceramic' : 'plaster',
    isUltra4K,
    isSoftwareGl,
    repeatX: 4,
    repeatY: 2,
  });

  const facadeColor =
    facadeStyle === 'brick' ? '#9E5842' : facadeStyle === 'modern_white' ? '#F5F4F0' : '#E5DEC9';
  const exteriorWallMat = createPBRMaterial({
    color: facadeColor,
    materialType: facadeStyle === 'brick' ? 'brick' : 'stone',
    isUltra4K,
    isSoftwareGl,
    repeatX: 6,
    repeatY: 3,
  }) as THREE.MeshStandardMaterial;

  if (exteriorWallOpacity < 1) {
    exteriorWallMat.transparent = true;
    exteriorWallMat.opacity = exteriorWallOpacity;
  }

  const parquetMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: createParquetTexture(floorMaterial || '#9E7347', isUltra4K, 6, 6) ?? undefined,
    roughness: floorFinish === 'walnut' ? 0.32 : 0.42,
    metalness: 0.05,
  });

  const kitchenMarbleMat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    map: createMarbleTexture('#F2EFE9', isUltra4K, 4, 4) ?? undefined,
    roughness: 0.18,
    clearcoat: isSoftwareGl ? 0 : 0.4,
  });

  const bathTileMat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    map: createCeramicTileTexture('#EAECEF', '#BEC4CA', 6, 6) ?? undefined,
    roughness: 0.15,
    clearcoat: isSoftwareGl ? 0 : 0.5,
  });

  const windowFrameMat = new THREE.MeshStandardMaterial({
    color: '#222629',
    roughness: 0.3,
    metalness: 0.75,
  });

  const windowGlassMat = createPBRMaterial({
    color: '#D8EEF8',
    materialType: 'glass',
    isUltra4K,
    isSoftwareGl,
  });

  const woodDoorMat = createPBRMaterial({
    color: '#4A3222',
    materialType: 'walnut',
    isUltra4K,
    isSoftwareGl,
  });

  const brassMat = createPBRMaterial({
    color: '#D4B483',
    materialType: 'brass',
    isUltra4K,
    isSoftwareGl,
  });

  // ==================== 1. COURTYARD, LAWN, TREES, GARAGE & FENCE ====================
  if (showYard) {
    const yardGroup = new THREE.Group();
    yardGroup.name = 'exterior_yard';

    // Green lawn plot (30m x 26m) positioned below foundation plinth so it never z-fights with Floor 1
    const lawnMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: createGrassLawnTexture(14, 14) ?? undefined,
      roughness: 0.9,
    });
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(30, 0.16, 26), lawnMat);
    lawn.position.set(0, -0.26, 1);
    lawn.receiveShadow = true;
    yardGroup.add(lawn);

    // Optional Luxury Swimming Pool if confirmed by photo reconstruction
    if (hasPool) {
      const poolW = 5.6;
      const poolD = 8.8;
      const poolH = 0.55;
      const poolX = -8.8;
      const poolZ = 3.2;

      const poolCoping = new THREE.Mesh(
        new THREE.BoxGeometry(poolW + 0.8, poolH, poolD + 0.8),
        new THREE.MeshStandardMaterial({ color: '#E8E2DA', roughness: 0.65 })
      );
      poolCoping.position.set(poolX, -0.22, poolZ);
      poolCoping.receiveShadow = true;
      yardGroup.add(poolCoping);

      const poolBasin = new THREE.Mesh(
        new THREE.BoxGeometry(poolW, poolH - 0.08, poolD),
        new THREE.MeshStandardMaterial({ color: '#142834', roughness: 0.3 })
      );
      poolBasin.position.set(poolX, -0.16, poolZ);
      yardGroup.add(poolBasin);

      const poolWater = new THREE.Mesh(
        new THREE.BoxGeometry(poolW - 0.22, 0.08, poolD - 0.22),
        new THREE.MeshPhysicalMaterial({
          color: '#1E88E5',
          roughness: 0.08,
          transmission: 0.85,
          ior: 1.33,
          transparent: true,
          opacity: 0.9,
        })
      );
      poolWater.position.set(poolX, -0.1, poolZ);
      yardGroup.add(poolWater);
    }

    // Stone entrance pathway + patio
    const pathwayMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: createBrickOrStoneTexture('#B8B2A6', '#8E887E', 4, 8) ?? undefined,
      roughness: 0.75,
    });
    const frontWalk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 7.2), pathwayMat);
    frontWalk.position.set(1.8, -0.15, 8.6);
    frontWalk.receiveShadow = true;
    yardGroup.add(frontWalk);

    // Entrance porch steps
    for (let s = 0; s < 2; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4 - s * 0.2, 0.12, 0.7 - s * 0.2), pathwayMat);
      step.position.set(1.8, -0.1 + s * 0.08, 5.25 - s * 0.12);
      yardGroup.add(step);
    }

    // Garage & Asphalt Driveway on the right side (x = 7.2 .. 11.4)
    const driveway = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.06, 11.5),
      new THREE.MeshStandardMaterial({ color: '#484B4E', roughness: 0.85 })
    );
    driveway.position.set(9.3, -0.15, 6.2);
    yardGroup.add(driveway);

    // Garage building + sectional garage door
    const garageBody = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 6.4), exteriorWallMat);
    garageBody.position.set(9.2, 1.48, -1.6);
    yardGroup.add(garageBody);

    const garageRoof = new THREE.Mesh(
      new THREE.BoxGeometry(4.7, 0.24, 6.8),
      new THREE.MeshStandardMaterial({ color: '#2F2C2A', roughness: 0.6 })
    );
    garageRoof.position.set(9.2, 3.2, -1.6);
    yardGroup.add(garageRoof);

    for (let p = 0; p < 4; p++) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.58, 0.06),
        new THREE.MeshStandardMaterial({ color: '#2A2E33', roughness: 0.4, metalness: 0.5 })
      );
      panel.position.set(9.2, 0.25 + p * 0.62, 1.62);
      yardGroup.add(panel);
    }

    // Composite 3D Luxury Sedan parked in driveway
    const carGroup = new THREE.Group();
    carGroup.position.set(9.3, -0.12, 5.4);
    const carBodyMat = new THREE.MeshPhysicalMaterial({
      color: '#143A30',
      roughness: 0.15,
      metalness: 0.65,
      clearcoat: isSoftwareGl ? 0 : 0.9,
    });
    const carChassis = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.58, 4.35), carBodyMat);
    carChassis.position.set(0, 0.46, 0);
    carGroup.add(carChassis);

    const carCabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 2.25), carBodyMat);
    carCabin.position.set(0, 0.96, -0.15);
    carGroup.add(carCabin);

    const carWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.42, 2.3), windowGlassMat);
    carWindshield.position.set(0, 0.95, -0.15);
    carGroup.add(carWindshield);

    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.7 });
    for (const [wx, wz] of [
      [-0.92, -1.35],
      [0.92, -1.35],
      [-0.92, 1.35],
      [0.92, 1.35],
    ]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.34, wz);
      carGroup.add(wheel);
    }
    yardGroup.add(carGroup);

    // Multi-part Trees & Shrubs around the property
    const treeCoords: Array<[number, number, number]> = [
      [-10.2, 0, 6.8, ],
      [-11.0, 0, -2.5],
      [-9.5, 0, -8.2],
      [12.2, 0, -6.5],
      [-5.2, 0, 9.2],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5A3E28', roughness: 0.9 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: '#2D5A36', roughness: 0.75 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: '#3B7044', roughness: 0.75 });

    for (let idx = 0; idx < treeCoords.length; idx++) {
      const [tx, , tz] = treeCoords[idx];
      const tree = new THREE.Group();
      tree.position.set(tx, -0.18, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.1, 12), trunkMat);
      trunk.position.set(0, 1.05, 0);
      tree.add(trunk);

      const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 14), foliageMat1);
      crown1.position.set(0, 2.6, 0);
      tree.add(crown1);

      const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 12), foliageMat2);
      crown2.position.set(0.45, 3.25, 0.25);
      tree.add(crown2);

      const crown3 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), foliageMat1);
      crown3.position.set(-0.4, 3.1, -0.3);
      tree.add(crown3);

      enableShadows(tree, true, true);
      yardGroup.add(tree);
    }

    // Perimeter Fence with stone pillars and metal slats
    const fencePillarMat = new THREE.MeshStandardMaterial({ color: '#D6D0C4', roughness: 0.7 });
    const fenceRailMat = new THREE.MeshStandardMaterial({ color: '#24282C', roughness: 0.4, metalness: 0.6 });
    for (let x = -13; x <= 13; x += 3.25) {
      // Back fence pillars
      const backPillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.65, 0.36), fencePillarMat);
      backPillar.position.set(x, 0.65, -10.5);
      yardGroup.add(backPillar);

      if (x < 13) {
        const backPanel = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.25, 0.08), fenceRailMat);
        backPanel.position.set(x + 1.625, 0.58, -10.5);
        yardGroup.add(backPanel);
      }
    }

    houseGroup.add(yardGroup);
  }

  const isCutaway = exteriorWallOpacity < 0.5;

  // ==================== 2. FOUNDATION PLINTH ====================
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(14.3, 0.16, 10.3),
    new THREE.MeshStandardMaterial({ color: '#6E6A63', roughness: 0.8 })
  );
  plinth.position.set(0, -0.1, 0);
  plinth.receiveShadow = true;
  houseGroup.add(plinth);

  // ==================== 3. FLOOR 1 SLABS, WALLS, WINDOWS & STAIRCASE ====================
  if (activeFloorFilter === 'all' || activeFloorFilter === 1) {
    const floor1Group = new THREE.Group();
    floor1Group.name = 'floor_1_structure';

    // Living Room & Hallway Parquet Floor
    const livingFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.06, 10.0), parquetMat);
    livingFloor.position.set(-3.5, -0.02, 0);
    livingFloor.receiveShadow = true;
    livingFloor.userData = { isFloorPlane: true, floor: 1 };
    floor1Group.add(livingFloor);

    // Kitchen Marble Floor
    const kitchenFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.06, 6.2), kitchenMarbleMat);
    kitchenFloor.position.set(3.5, -0.02, -1.9);
    kitchenFloor.receiveShadow = true;
    kitchenFloor.userData = { isFloorPlane: true, floor: 1 };
    floor1Group.add(kitchenFloor);

    // Hallway & Bathroom 1 Floor
    const hallFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.06, 3.8), parquetMat);
    hallFloor.position.set(1.8, -0.02, 3.1);
    hallFloor.receiveShadow = true;
    hallFloor.userData = { isFloorPlane: true, floor: 1 };
    floor1Group.add(hallFloor);

    const bath1Floor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 3.8), bathTileMat);
    bath1Floor.position.set(5.3, -0.02, 3.1);
    bath1Floor.receiveShadow = true;
    bath1Floor.userData = { isFloorPlane: true, floor: 1 };
    floor1Group.add(bath1Floor);

    // Interior Partition Walls (Floor 1)
    const wallH1 = isCutaway ? 1.15 : 3.2;
    // Center wall between Living & Kitchen/Hall with doorway at z = 2.8
    const centerWallNorth = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH1, 6.6), interiorWallMat);
    centerWallNorth.position.set(0, wallH1 / 2, -1.7);
    floor1Group.add(centerWallNorth);

    const centerWallSouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH1, 1.2), interiorWallMat);
    centerWallSouth.position.set(0, wallH1 / 2, 4.4);
    floor1Group.add(centerWallSouth);

    // Wall between Kitchen and Hall/Bath1 at z = 1.3 (with doorway at x = 1.8)
    const kitHallWallRight = new THREE.Mesh(new THREE.BoxGeometry(4.2, wallH1, 0.16), interiorWallMat);
    kitHallWallRight.position.set(4.9, wallH1 / 2, 1.3);
    floor1Group.add(kitHallWallRight);

    // Wall between Hallway and Bathroom 1 at x = 3.7
    const bathWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, wallH1, 3.6), interiorWallMat);
    bathWall.position.set(3.7, wallH1 / 2, 3.1);
    floor1Group.add(bathWall);

    // Architectural Staircase from Floor 1 (Hallway) to Floor 2
    const stairsGroup = new THREE.Group();
    stairsGroup.position.set(0.75, 0, 1.55);
    const stepsCount = 13;
    for (let i = 0; i < stepsCount; i++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.24), parquetMat);
      tread.position.set(0, (i + 1) * (3.2 / stepsCount), i * 0.22);
      stairsGroup.add(tread);
    }
    // Glass balustrade on staircase
    const stairRail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 2.8), windowGlassMat);
    stairRail.position.set(0.48, 1.9, 1.35);
    stairRail.rotation.x = -0.78;
    stairsGroup.add(stairRail);
    floor1Group.add(stairsGroup);

    // Exterior Walls & Framed Windows for Floor 1
    if (showExteriorWalls) {
      const ext1 = buildFloorExteriorShell(
        1,
        0,
        3.2,
        isCutaway,
        interiorWallMat,
        windowFrameMat,
        windowGlassMat,
        woodDoorMat,
        brassMat
      );
      floor1Group.add(ext1);
    }

    enableShadows(floor1Group, true, true);
    houseGroup.add(floor1Group);
  }

  // ==================== 4. FLOOR 2 SLABS, WALLS, WINDOWS & BALCONY ====================
  if (activeFloorFilter === 'all' || activeFloorFilter === 2) {
    const floor2Group = new THREE.Group();
    floor2Group.name = 'floor_2_structure';
    const baseY2 = 3.2;
    const wallH2 = isCutaway ? 1.1 : 3.0;

    // Master Bedroom Floor (Left)
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.14, 10.0), parquetMat);
    bedFloor.position.set(-3.5, baseY2 - 0.07, 0);
    bedFloor.receiveShadow = true;
    bedFloor.userData = { isFloorPlane: true, floor: 2 };
    floor2Group.add(bedFloor);

    // Study / Kids Room Floor (Right North)
    const studyFloor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.14, 6.2), parquetMat);
    studyFloor.position.set(3.5, baseY2 - 0.07, -1.9);
    studyFloor.receiveShadow = true;
    studyFloor.userData = { isFloorPlane: true, floor: 2 };
    floor2Group.add(studyFloor);

    // Bathroom 2 Floor (Right South)
    const bath2Floor = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 3.8), bathTileMat);
    bath2Floor.position.set(5.3, baseY2 - 0.07, 3.1);
    bath2Floor.receiveShadow = true;
    bath2Floor.userData = { isFloorPlane: true, floor: 2 };
    floor2Group.add(bath2Floor);

    // Upper Hallway landing around stairs
    const landingFloor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 1.4), parquetMat);
    landingFloor.position.set(2.5, baseY2 - 0.07, 2.0);
    landingFloor.receiveShadow = true;
    landingFloor.userData = { isFloorPlane: true, floor: 2 };
    floor2Group.add(landingFloor);

    // Balcony Deck + Glass & Brass Railing (Front Left: x = -6.8 .. -0.4, z = 5.0 .. 7.2)
    const balconySlab = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 2.3), kitchenMarbleMat);
    balconySlab.position.set(-3.6, baseY2 - 0.09, 6.1);
    balconySlab.receiveShadow = true;
    balconySlab.userData = { isFloorPlane: true, floor: 2 };
    floor2Group.add(balconySlab);

    const railFront = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1.05, 0.04), windowGlassMat);
    railFront.position.set(-3.6, baseY2 + 0.52, 7.2);
    floor2Group.add(railFront);

    const railTopBar = new THREE.Mesh(new THREE.BoxGeometry(6.56, 0.05, 0.07), brassMat);
    railTopBar.position.set(-3.6, baseY2 + 1.06, 7.2);
    floor2Group.add(railTopBar);

    const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.05, 2.2), windowGlassMat);
    railLeft.position.set(-6.85, baseY2 + 0.52, 6.1);
    floor2Group.add(railLeft);

    const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.05, 2.2), windowGlassMat);
    railRight.position.set(-0.35, baseY2 + 0.52, 6.1);
    floor2Group.add(railRight);

    // Floor 2 Interior Partition Walls
    const centerWall2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH2, 6.6), interiorWallMat);
    centerWall2.position.set(0, baseY2 + wallH2 / 2, -1.7);
    floor2Group.add(centerWall2);

    const studyBathWall2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, wallH2, 0.16), interiorWallMat);
    studyBathWall2.position.set(4.9, baseY2 + wallH2 / 2, 1.3);
    floor2Group.add(studyBathWall2);

    const bath2Divider = new THREE.Mesh(new THREE.BoxGeometry(0.16, wallH2, 3.6), interiorWallMat);
    bath2Divider.position.set(3.7, baseY2 + wallH2 / 2, 3.1);
    floor2Group.add(bath2Divider);

    if (showExteriorWalls) {
      const ext2 = buildFloorExteriorShell(
        2,
        baseY2,
        3.0,
        isCutaway,
        interiorWallMat,
        windowFrameMat,
        windowGlassMat,
        woodDoorMat,
        brassMat
      );
      floor2Group.add(ext2);
    }

    enableShadows(floor2Group, true, true);
    houseGroup.add(floor2Group);
  }

  // ==================== 5. ARCHITECTURAL PITCHED ROOF & GUTTERS ====================
  if (showRoof && activeFloorFilter === 'all') {
    const roofGroup = new THREE.Group();
    roofGroup.name = 'house_roof';
    const roofBaseY = 6.2;

    // Flat vs Pitched Roof Architecture
    if (roofType === 'flat') {
      const flatRoofSlab = new THREE.Mesh(
        new THREE.BoxGeometry(14.6, 0.35, 10.6),
        new THREE.MeshStandardMaterial({ color: '#2F343A', roughness: 0.6 })
      );
      flatRoofSlab.position.set(0, roofBaseY + 0.18, 0);
      roofGroup.add(flatRoofSlab);

      const parapetMat = exteriorWallMat;
      const pFront = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.7, 0.22), parapetMat);
      pFront.position.set(0, roofBaseY + 0.55, 5.19);
      roofGroup.add(pFront);

      const pBack = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.7, 0.22), parapetMat);
      pBack.position.set(0, roofBaseY + 0.55, -5.19);
      roofGroup.add(pBack);

      const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 10.6), parapetMat);
      pLeft.position.set(-7.19, roofBaseY + 0.55, 0);
      roofGroup.add(pLeft);

      const pRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 10.6), parapetMat);
      pRight.position.set(7.19, roofBaseY + 0.55, 0);
      roofGroup.add(pRight);
    } else {
      const roofTileMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: createRoofTileTexture('#3A322D', 10, 6) ?? undefined,
        roughness: 0.65,
        metalness: 0.1,
      });

      // Overhanging eaves cornice slab
      const eaves = new THREE.Mesh(
        new THREE.BoxGeometry(15.2, 0.22, 11.2),
        new THREE.MeshStandardMaterial({ color: '#2B2623', roughness: 0.5 })
      );
      eaves.position.set(0, roofBaseY + 0.11, 0);
      roofGroup.add(eaves);

      // Main hipped/pitched roof pyramid
      const mainRoofCone = new THREE.Mesh(new THREE.ConeGeometry(9.6, 2.65, 4), roofTileMat);
      mainRoofCone.rotation.y = Math.PI / 4;
      mainRoofCone.scale.set(1.14, 1, 0.84);
      mainRoofCone.position.set(0, roofBaseY + 0.22 + 1.32, 0);
      roofGroup.add(mainRoofCone);
    }

    // Architectural Chimney stack
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.2, 0.85), interiorWallMat);
    chimney.position.set(-4.2, roofBaseY + 1.4, -2.2);
    roofGroup.add(chimney);

    const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.0), windowFrameMat);
    chimneyCap.position.set(-4.2, roofBaseY + 2.55, -2.2);
    roofGroup.add(chimneyCap);

    // Rain downspouts at corners
    for (const [dx, dz] of [
      [-6.95, 4.95],
      [6.95, 4.95],
      [-6.95, -4.95],
      [6.95, -4.95],
    ]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 6.2, 10), windowFrameMat);
      pipe.position.set(dx, 3.1, dz);
      roofGroup.add(pipe);
    }

    enableShadows(roofGroup, true, true);
    houseGroup.add(roofGroup);
  }

  return houseGroup;
}

function buildFloorExteriorShell(
  floor: 1 | 2,
  baseY: number,
  wallH: number,
  isCutaway: boolean,
  wallMat: THREE.Material,
  frameMat: THREE.Material,
  glassMat: THREE.Material,
  doorMat: THREE.Material,
  brassMat: THREE.Material
): THREE.Group {
  const shell = new THREE.Group();
  const wallThick = 0.22;

  const backH = isCutaway ? wallH * 0.72 : wallH;

  // Back wall (z = -4.9) with 2 panoramic windows
  const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(3.2, backH, wallThick), wallMat);
  backWallLeft.position.set(-5.4, baseY + backH / 2, -4.9);
  shell.add(backWallLeft);

  const backWallMid = new THREE.Mesh(new THREE.BoxGeometry(3.2, backH, wallThick), wallMat);
  backWallMid.position.set(0, baseY + backH / 2, -4.9);
  shell.add(backWallMid);

  const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(3.2, backH, wallThick), wallMat);
  backWallRight.position.set(5.4, baseY + backH / 2, -4.9);
  shell.add(backWallRight);

  // Window openings at x = -2.7 and x = 2.7 on back wall
  for (const wx of [-2.7, 2.7]) {
    addFramedWindowWithSpandrels(shell, wx, baseY, -4.9, 2.2, backH, wallThick, 0, wallMat, frameMat, glassMat);
  }

  // Left wall (x = -6.9) with central window
  const leftNorth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, backH, 3.6), wallMat);
  leftNorth.position.set(-6.9, baseY + backH / 2, -3.2);
  shell.add(leftNorth);

  const leftSouth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, backH, 3.6), wallMat);
  leftSouth.position.set(-6.9, baseY + backH / 2, 3.2);
  shell.add(leftSouth);

  addFramedWindowWithSpandrels(shell, -6.9, baseY, 0, 2.8, backH, wallThick, Math.PI / 2, wallMat, frameMat, glassMat);

  if (isCutaway) {
    // In Dollhouse / 2D cutaway mode, render low 0.35m architectural perimeter curbs on South & East sides
    const frontCurb = new THREE.Mesh(new THREE.BoxGeometry(14.0, 0.32, wallThick), wallMat);
    frontCurb.position.set(0, baseY + 0.16, 4.9);
    shell.add(frontCurb);

    const rightCurb = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 0.32, 10.0), wallMat);
    rightCurb.position.set(6.9, baseY + 0.16, 0);
    shell.add(rightCurb);
    return shell;
  }

  // Full-height Right wall (x = 6.9) with window in Exterior / Room mode
  const rightNorth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 3.6), wallMat);
  rightNorth.position.set(6.9, baseY + wallH / 2, -3.2);
  shell.add(rightNorth);

  const rightSouth = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 3.6), wallMat);
  rightSouth.position.set(6.9, baseY + wallH / 2, 3.2);
  shell.add(rightSouth);

  addFramedWindowWithSpandrels(shell, 6.9, baseY, 0, 2.8, wallH, wallThick, Math.PI / 2, wallMat, frameMat, glassMat);

  // Full-height Front facade wall (z = 4.9)
  const frontLeftCorner = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallH, wallThick), wallMat);
  frontLeftCorner.position.set(-5.9, baseY + wallH / 2, 4.9);
  shell.add(frontLeftCorner);

  addFramedWindowWithSpandrels(shell, -3.3, baseY, 4.9, 3.0, wallH, wallThick, 0, wallMat, frameMat, glassMat);

  const frontCenterPier = new THREE.Mesh(new THREE.BoxGeometry(2.2, wallH, wallThick), wallMat);
  frontCenterPier.position.set(-0.7, baseY + wallH / 2, 4.9);
  shell.add(frontCenterPier);

  if (floor === 1) {
    const doorW = 1.3;
    const doorH = 2.35;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, wallH - doorH, wallThick), wallMat);
    lintel.position.set(1.8, baseY + doorH + (wallH - doorH) / 2, 4.9);
    shell.add(lintel);

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.14, doorH, wallThick + 0.04), frameMat);
    doorFrame.position.set(1.8, baseY + doorH / 2, 4.9);
    shell.add(doorFrame);

    const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.08, doorH - 0.08, 0.08), doorMat);
    doorLeaf.position.set(1.8, baseY + doorH / 2, 4.9);
    shell.add(doorLeaf);

    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.06), brassMat);
    doorHandle.position.set(2.22, baseY + 1.15, 4.96);
    shell.add(doorHandle);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.2), frameMat);
    canopy.position.set(1.8, baseY + doorH + 0.18, 5.45);
    shell.add(canopy);
  } else {
    addFramedWindowWithSpandrels(shell, 1.8, baseY, 4.9, 1.6, wallH, wallThick, 0, wallMat, frameMat, glassMat);
  }

  const frontRightPier = new THREE.Mesh(new THREE.BoxGeometry(1.6, wallH, wallThick), wallMat);
  frontRightPier.position.set(3.35, baseY + wallH / 2, 4.9);
  shell.add(frontRightPier);

  addFramedWindowWithSpandrels(shell, 5.1, baseY, 4.9, 1.8, wallH, wallThick, 0, wallMat, frameMat, glassMat);

  const frontFarRight = new THREE.Mesh(new THREE.BoxGeometry(1.0, wallH, wallThick), wallMat);
  frontFarRight.position.set(6.5, baseY + wallH / 2, 4.9);
  shell.add(frontFarRight);

  return shell;
}

function addFramedWindowWithSpandrels(
  parent: THREE.Group,
  x: number,
  baseY: number,
  z: number,
  winW: number,
  wallH: number,
  wallThick: number,
  rotY: number,
  wallMat: THREE.Material,
  frameMat: THREE.Material,
  glassMat: THREE.Material
) {
  const sillH = 0.65;
  const winH = 1.85;
  const lintelH = Math.max(0.15, wallH - sillH - winH);

  const grp = new THREE.Group();
  grp.position.set(x, baseY, z);
  grp.rotation.y = rotY;

  // Lower spandrel wall below window
  const lowerWall = new THREE.Mesh(new THREE.BoxGeometry(winW, sillH, wallThick), wallMat);
  lowerWall.position.set(0, sillH / 2, 0);
  grp.add(lowerWall);

  // Upper lintel wall above window
  const upperWall = new THREE.Mesh(new THREE.BoxGeometry(winW, lintelH, wallThick), wallMat);
  upperWall.position.set(0, sillH + winH + lintelH / 2, 0);
  grp.add(upperWall);

  // Window Sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.12, 0.05, wallThick + 0.1), frameMat);
  sill.position.set(0, sillH, 0);
  grp.add(sill);

  // Outer Frame + Central Mullion
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, wallThick + 0.04), frameMat);
  topFrame.position.set(0, sillH + winH - 0.03, 0);
  grp.add(topFrame);

  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.05, winH, wallThick + 0.03), frameMat);
  mullion.position.set(0, sillH + winH / 2, 0);
  grp.add(mullion);

  // Glass Pane
  const glass = new THREE.Mesh(new THREE.BoxGeometry(winW - 0.08, winH - 0.08, 0.03), glassMat);
  glass.position.set(0, sillH + winH / 2, 0);
  grp.add(glass);

  parent.add(grp);
}
