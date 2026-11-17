import * as THREE from 'three';
import type { BuildingArchetype, InteriorFloorFinish, PoolPlacement } from './propertyReconstruction.ts';
import {
  createBrickOrStoneTexture,
  createCeramicTileTexture,
  createGrassLawnTexture,
  createMarbleTexture,
  createParquetTexture,
  createPBRMaterial,
} from './proceduralMaterials3d.ts';

export interface ArchetypeExteriorOptions {
  archetype: BuildingArchetype;
  wallColor: string;
  accentColor: string;
  facadeStyle: 'travertine' | 'brick' | 'modern_white' | 'classic' | 'minimalist';
  floors: number;
  roofType: 'sloped' | 'flat' | 'mansard';
  hasPool: boolean;
  poolPlacement: PoolPlacement;
  hasPergola: boolean;
  hasWoodBalconies: boolean;
  hasGlassSunroom: boolean;
  hasCourtyardArches: boolean;
  hasGarage: boolean;
  isUltra4K: boolean;
  isSoftwareGl: boolean;
  // Interior & Cutaway support so Exterior and Interior match 100%
  showRoof?: boolean;
  isCutaway?: boolean;
  activeFloorFilter?: 'all' | 1 | 2;
  interiorWallColor?: string;
  interiorFloorFinish?: InteriorFloorFinish;
  interiorFloorColor?: string;
}

function enableShadows(obj: THREE.Object3D, cast = true, receive = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

function createSharedMaterials(opts: ArchetypeExteriorOptions) {
  const {
    wallColor,
    accentColor,
    facadeStyle,
    isUltra4K,
    isSoftwareGl,
    interiorWallColor,
    interiorFloorFinish = 'parquet',
    interiorFloorColor = '#B98E5B',
  } = opts;

  const stoneMat = createPBRMaterial({
    color: wallColor || '#DDD2BE',
    materialType: facadeStyle === 'brick' ? 'brick' : 'stone',
    isUltra4K,
    isSoftwareGl,
    repeatX: 4,
    repeatY: 2,
  });

  const interiorWallMat = createPBRMaterial({
    color: interiorWallColor || '#EFE9DE',
    materialType: 'plaster',
    isUltra4K,
    isSoftwareGl,
    repeatX: 4,
    repeatY: 2,
  });

  const warmWoodMat = createPBRMaterial({
    color: accentColor || '#8B5E3C',
    materialType: 'walnut',
    isUltra4K,
    isSoftwareGl,
    repeatX: 3,
    repeatY: 2,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: '#22262A',
    roughness: 0.35,
    metalness: 0.78,
  });

  // Real clear architectural glazing so interiors & furniture are visible through exterior windows
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#CBE4F2',
    roughness: 0.06,
    metalness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.42,
    depthWrite: false,
    ior: 1.5,
  });

  const lawnMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: createGrassLawnTexture(14, 14) ?? undefined,
    roughness: 0.9,
  });

  const stoneTileMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: createBrickOrStoneTexture('#DCD3C2', '#B5AA96', 6, 6) ?? undefined,
    roughness: 0.72,
  });

  const marbleDeckMat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    map: createMarbleTexture('#E7DFD2', isUltra4K, 4, 4) ?? undefined,
    roughness: 0.35,
    clearcoat: isSoftwareGl ? 0 : 0.25,
  });

  let interiorFloorMat: THREE.Material;
  if (interiorFloorFinish === 'marble') {
    interiorFloorMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      map: createMarbleTexture(interiorFloorColor, isUltra4K, 5, 5) ?? undefined,
      roughness: 0.24,
      clearcoat: isSoftwareGl ? 0 : 0.35,
    });
  } else if (interiorFloorFinish === 'concrete') {
    interiorFloorMat = new THREE.MeshStandardMaterial({
      color: interiorFloorColor || '#82868A',
      roughness: 0.36,
      metalness: 0.1,
    });
  } else if (interiorFloorFinish === 'tile') {
    interiorFloorMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      map: createCeramicTileTexture(interiorFloorColor || '#C8B498', '#A59277', 6, 6) ?? undefined,
      roughness: 0.28,
      clearcoat: isSoftwareGl ? 0 : 0.2,
    });
  } else {
    interiorFloorMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: createParquetTexture(interiorFloorColor, isUltra4K, 6, 6) ?? undefined,
      roughness: interiorFloorFinish === 'walnut' ? 0.32 : 0.42,
      metalness: 0.05,
    });
  }

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#197B8C',
    roughness: 0.06,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.78,
    ior: 1.33,
    transparent: true,
    opacity: 0.88,
  });

  const emberMat = new THREE.MeshStandardMaterial({
    color: '#FF9A3C',
    emissive: '#FF6B1A',
    emissiveIntensity: 1.35,
    roughness: 0.4,
  });

  return {
    stoneMat,
    interiorWallMat,
    warmWoodMat,
    darkSteelMat,
    glassMat,
    lawnMat,
    stoneTileMat,
    marbleDeckMat,
    interiorFloorMat,
    waterMat,
    emberMat,
  };
}

function addCypressTree(parent: THREE.Group, x: number, y: number, z: number, height = 5.4) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: '#4A3525', roughness: 0.9 })
  );
  trunk.position.y = 0.45;
  grp.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({ color: '#274E2E', roughness: 0.8 });
  const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.62, height * 0.72, 10), foliageMat);
  cone1.position.y = 0.7 + height * 0.36;
  grp.add(cone1);

  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, height * 0.52, 10), foliageMat);
  cone2.position.y = 0.7 + height * 0.65;
  grp.add(cone2);

  parent.add(grp);
}

function addOliveTree(parent: THREE.Group, x: number, y: number, z: number, scale = 1.0) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.scale.setScalar(scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.22, 1.8, 10),
    new THREE.MeshStandardMaterial({ color: '#614A38', roughness: 0.92 })
  );
  trunk.position.y = 0.9;
  grp.add(trunk);

  const oliveLeaf = new THREE.MeshStandardMaterial({ color: '#5A7350', roughness: 0.78 });
  const oliveLeaf2 = new THREE.MeshStandardMaterial({ color: '#6D8561', roughness: 0.78 });
  for (const [cx, cy, cz, r, mat] of [
    [0, 2.3, 0, 1.15, oliveLeaf],
    [0.6, 2.55, 0.3, 0.85, oliveLeaf2],
    [-0.55, 2.45, -0.3, 0.8, oliveLeaf],
    [0.15, 2.9, -0.2, 0.72, oliveLeaf2],
  ] as const) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
    c.scale.set(1.15, 0.78, 1.05);
    c.position.set(cx, cy, cz);
    grp.add(c);
  }
  parent.add(grp);
}

function addClearGlassWall(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  panelsX: number,
  frameMat: THREE.Material,
  glassMat: THREE.Material
) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.08, Math.max(0.03, d - 0.04)), glassMat);
  glass.renderOrder = 2;
  grp.add(glass);

  const topF = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d + 0.02), frameMat);
  topF.position.y = h / 2 - 0.04;
  grp.add(topF);
  const botF = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d + 0.02), frameMat);
  botF.position.y = -h / 2 + 0.04;
  grp.add(botF);

  for (let i = 0; i <= panelsX; i++) {
    const mx = -w / 2 + (i * w) / panelsX;
    const mul = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, d + 0.03), frameMat);
    mul.position.x = mx;
    grp.add(mul);
  }

  parent.add(grp);
}

/**
 * Builds a hollow furnished-ready room shell so exterior windows look directly into real rooms
 * AND Dollhouse / Floor cutaway modes expose the exact same building walls & flooring!
 */
function addHollowRoomShell(params: {
  parent: THREE.Group;
  cx: number;
  baseY: number;
  cz: number;
  w: number;
  h: number;
  d: number;
  extMat: THREE.Material;
  intMat: THREE.Material;
  floorMat: THREE.Material;
  frameMat: THREE.Material;
  glassMat: THREE.Material;
  isCutaway: boolean;
  backWall?: boolean;
  leftWall?: boolean;
  rightWall?: boolean;
  frontMode?: 'glass' | 'solid' | 'open';
  leftGlass?: boolean;
  rightGlass?: boolean;
  panelsX?: number;
}) {
  const {
    parent,
    cx,
    baseY,
    cz,
    w,
    h,
    d,
    extMat,
    intMat,
    floorMat,
    frameMat,
    glassMat,
    isCutaway,
    backWall = true,
    leftWall = true,
    rightWall = true,
    frontMode = 'glass',
    leftGlass = false,
    rightGlass = false,
    panelsX = 4,
  } = params;

  const wallThick = 0.22;
  const backH = isCutaway ? Math.min(h, 2.35) : h;
  const sideH = isCutaway ? Math.min(h, 1.75) : h;

  // Interior floor slab sitting cleanly at baseY
  const floorSlab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), floorMat);
  floorSlab.position.set(cx, baseY - 0.05, cz);
  floorSlab.receiveShadow = true;
  parent.add(floorSlab);

  if (backWall) {
    const bw = new THREE.Mesh(new THREE.BoxGeometry(w, backH, wallThick), extMat);
    bw.position.set(cx, baseY + backH / 2, cz - d / 2 + wallThick / 2);
    parent.add(bw);

    const bwInt = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, backH - 0.04, 0.04), intMat);
    bwInt.position.set(cx, baseY + backH / 2, cz - d / 2 + wallThick + 0.02);
    parent.add(bwInt);
  }

  if (leftWall) {
    if (leftGlass && !isCutaway) {
      const grp = new THREE.Group();
      addClearGlassWall(grp, 0, baseY + h / 2, 0, d - 0.2, h, 0.08, 3, frameMat, glassMat);
      grp.rotation.y = Math.PI / 2;
      grp.position.set(cx - w / 2 + 0.08, 0, cz);
      parent.add(grp);
    } else if (!leftGlass) {
      const lw = new THREE.Mesh(new THREE.BoxGeometry(wallThick, sideH, d), extMat);
      lw.position.set(cx - w / 2 + wallThick / 2, baseY + sideH / 2, cz);
      parent.add(lw);
    } else {
      const lCurb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, d), frameMat);
      lCurb.position.set(cx - w / 2 + 0.06, baseY + 0.08, cz);
      parent.add(lCurb);
    }
  }

  if (rightWall) {
    if (rightGlass && !isCutaway) {
      const grp = new THREE.Group();
      addClearGlassWall(grp, 0, baseY + h / 2, 0, d - 0.2, h, 0.08, 3, frameMat, glassMat);
      grp.rotation.y = Math.PI / 2;
      grp.position.set(cx + w / 2 - 0.08, 0, cz);
      parent.add(grp);
    } else if (!rightGlass) {
      const rw = new THREE.Mesh(new THREE.BoxGeometry(wallThick, sideH, d), extMat);
      rw.position.set(cx + w / 2 - wallThick / 2, baseY + sideH / 2, cz);
      parent.add(rw);
    } else {
      const rCurb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, d), frameMat);
      rCurb.position.set(cx + w / 2 - 0.06, baseY + 0.08, cz);
      parent.add(rCurb);
    }
  }

  if (frontMode === 'glass') {
    if (isCutaway) {
      // Sleek low floor threshold curb in Dollhouse so front rooms remain completely visible
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.14, 0.12), frameMat);
      curb.position.set(cx, baseY + 0.07, cz + d / 2 - 0.06);
      parent.add(curb);
    } else {
      addClearGlassWall(
        parent,
        cx,
        baseY + h / 2,
        cz + d / 2 - 0.08,
        w - 0.24,
        h,
        0.08,
        panelsX,
        frameMat,
        glassMat
      );
    }
  } else if (frontMode === 'solid') {
    const fwH = isCutaway ? 0.34 : h;
    const fw = new THREE.Mesh(new THREE.BoxGeometry(w, fwH, wallThick), extMat);
    fw.position.set(cx, baseY + fwH / 2, cz + d / 2 - wallThick / 2);
    parent.add(fw);
  }
}

function addFireplaceHearth(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  stoneMat: THREE.Material,
  emberMat: THREE.Material,
  darkMat: THREE.Material
) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const surround = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.55), stoneMat);
  surround.position.y = 1.1;
  grp.add(surround);

  const firebox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.65, 0.35), darkMat);
  firebox.position.set(0, 0.55, 0.15);
  grp.add(firebox);

  const flame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 0.18), emberMat);
  flame.position.set(0, 0.42, 0.25);
  grp.add(flame);
  parent.add(grp);
}

function addOutdoorLoungeCluster(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  woodMat: THREE.Material
) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const cushMat = new THREE.MeshStandardMaterial({ color: '#EAE2D6', roughness: 0.85 });

  const sBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.8), woodMat);
  sBase.position.set(0, 0.18, -0.5);
  grp.add(sBase);
  const sCush = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.72), cushMat);
  sCush.position.set(0, 0.35, -0.48);
  grp.add(sCush);
  const sBack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.38, 0.16), cushMat);
  sBack.position.set(0, 0.52, -0.78);
  grp.add(sBack);

  const tbl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), woodMat);
  tbl.position.set(0, 0.32, 0.32);
  grp.add(tbl);

  const chBase = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.75), woodMat);
  chBase.position.set(1.25, 0.18, 0.25);
  chBase.rotation.y = -0.5;
  grp.add(chBase);
  const chCush = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.68), cushMat);
  chCush.position.set(1.25, 0.35, 0.25);
  chCush.rotation.y = -0.5;
  grp.add(chCush);

  parent.add(grp);
}

function addFloatingStaircase(
  parent: THREE.Group,
  x: number,
  baseY: number,
  startZ: number,
  riseH: number,
  woodMat: THREE.Material,
  glassMat: THREE.Material
) {
  const grp = new THREE.Group();
  grp.position.set(x, baseY, startZ);
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.26), woodMat);
    tread.position.set(0, ((i + 1) / steps) * riseH, -i * 0.24);
    grp.add(tread);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 2.9), glassMat);
  rail.position.set(0.54, riseH * 0.55 + 0.3, -1.35);
  rail.rotation.x = 0.72;
  grp.add(rail);
  parent.add(grp);
}

/**
 * 1. BOULEVARD PARK CANTILEVERED VILLA (matches hero_tashkent_residence_1794853627912.jpg)
 * Both Exterior AND Interior cutaway match the wide horizontal travertine & wood pavilion!
 */
function buildBoulevardCantileverVilla(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_boulevard_cantilever_villa';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  // Lawn & travertine courtyard deck
  const lawn = new THREE.Mesh(new THREE.BoxGeometry(34, 0.18, 28), m.lawnMat);
  lawn.position.set(0, -0.24, 1.5);
  root.add(lawn);

  const terrace = new THREE.Mesh(new THREE.BoxGeometry(23.5, 0.22, 12.5), m.marbleDeckMat);
  terrace.position.set(0, -0.05, 0.2);
  root.add(terrace);

  if (showF1) {
    // Left Wing Suite (hollow furnished shell)
    addHollowRoomShell({
      parent: root,
      cx: -7.4,
      baseY: 0.06,
      cz: -1.4,
      w: 6.8,
      h: 3.2,
      d: 8.4,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });

    // Center Double-Height Living Hall with travertine fireplace on rear wall
    addHollowRoomShell({
      parent: root,
      cx: 0,
      baseY: 0.06,
      cz: -1.5,
      w: 7.8,
      h: 3.3,
      d: 6.2,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      leftWall: false,
      rightWall: false,
      frontMode: 'glass',
      panelsX: 5,
    });
    addFireplaceHearth(root, 0, 0.06, -4.15, m.stoneMat, m.emberMat, m.darkSteelMat);

    // Right Wing Kitchen & Dining Pavilion
    addHollowRoomShell({
      parent: root,
      cx: 7.5,
      baseY: 0.06,
      cz: -0.8,
      w: 6.8,
      h: 3.2,
      d: 6.6,
      extMat: m.warmWoodMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      leftWall: false,
      rightGlass: true,
      frontMode: 'glass',
      panelsX: 4,
    });
  }

  if (showF2) {
    // Center Floor 2 Gallery + Glass Balcony
    addHollowRoomShell({
      parent: root,
      cx: 0,
      baseY: 3.48,
      cz: -1.5,
      w: 8.0,
      h: 2.75,
      d: 6.2,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      leftWall: false,
      rightWall: false,
      frontMode: 'glass',
      panelsX: 5,
    });
    const centerGlassRail = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.0, 0.05), m.glassMat);
    centerGlassRail.position.set(0, 3.98, 2.05);
    root.add(centerGlassRail);

    // Left Wing Floor 2 travertine cornice cap
    if (showRoof || !isCutaway) {
      const leftUpperSlab = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.34, 8.8), m.stoneMat);
      leftUpperSlab.position.set(-7.4, 3.38, -1.4);
      root.add(leftUpperSlab);
    }

    // Right Extended Upper Terrace Deck & Wood-Clad Bedroom Suite
    const rightUpperDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.24, 8.4), m.stoneMat);
    rightUpperDeck.position.set(7.8, 3.36, 0.6);
    root.add(rightUpperDeck);

    addHollowRoomShell({
      parent: root,
      cx: 7.5,
      baseY: 3.49,
      cz: -1.7,
      w: 6.8,
      h: 2.75,
      d: 4.6,
      extMat: m.warmWoodMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 4,
    });

    // Glass railing around right upper terrace
    const rRailF = new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.0, 0.05), m.glassMat);
    rRailF.position.set(7.8, 3.98, 4.72);
    root.add(rRailF);
    const rRailR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 8.2), m.glassMat);
    rRailR.position.set(11.82, 3.98, 0.6);
    root.add(rRailR);

    // Signature Wooden Slatted Pergola Columns & Beams (louvers rendered in Exterior mode or translucent frame in Dollhouse)
    const pergolaBaseY = 3.49;
    const pergolaH = 3.05;
    for (const [px, pz] of [
      [4.0, 4.6],
      [11.6, 4.6],
      [11.6, -2.8],
      [4.0, -2.8],
    ]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, pergolaH, 0.22), m.warmWoodMat);
      col.position.set(px, pergolaBaseY + pergolaH / 2, pz);
      root.add(col);
    }
    if (showRoof) {
      const beamF = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.24, 0.26), m.warmWoodMat);
      beamF.position.set(7.8, pergolaBaseY + pergolaH, 4.6);
      root.add(beamF);
      const beamB = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.24, 0.26), m.warmWoodMat);
      beamB.position.set(7.8, pergolaBaseY + pergolaH, -2.8);
      root.add(beamB);
      for (let i = 0; i <= 14; i++) {
        const lx = 4.0 + i * 0.54;
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 7.6), m.warmWoodMat);
        louver.position.set(lx, pergolaBaseY + pergolaH + 0.04, 0.9);
        root.add(louver);
      }
    }
  }

  // Main long horizontal cantilevered travertine roof canopy (only when showRoof = true)
  if (showRoof && floorFilter === 'all') {
    const mainRoofSlab = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.42, 9.6), m.stoneMat);
    mainRoofSlab.position.set(-2.5, 6.42, -1.0);
    root.add(mainRoofSlab);

    const woodSoffit = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.08, 9.2), m.warmWoodMat);
    woodSoffit.position.set(-2.5, 6.18, -1.0);
    root.add(woodSoffit);
  }

  // Outdoor lounge, walkway, foreground reflecting infinity pool, and Mediterranean trees
  addOutdoorLoungeCluster(root, 7.8, 0.06, 4.4, m.warmWoodMat);
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 4.6), m.marbleDeckMat);
  walkway.position.set(0, -0.02, 5.2);
  root.add(walkway);

  if (opts.hasPool) {
    const poolCoping = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.28, 8.2), m.marbleDeckMat);
    poolCoping.position.set(0.5, -0.14, 10.6);
    root.add(poolCoping);

    const poolBasin = new THREE.Mesh(
      new THREE.BoxGeometry(18.2, 0.26, 7.0),
      new THREE.MeshStandardMaterial({ color: '#102A33', roughness: 0.4 })
    );
    poolBasin.position.set(0.5, -0.09, 10.6);
    root.add(poolBasin);

    const poolWater = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.06, 6.8), m.waterMat);
    poolWater.position.set(0.5, 0.0, 10.6);
    root.add(poolWater);
  }

  addCypressTree(root, -13.2, -0.15, 3.8, 6.4);
  addCypressTree(root, -11.6, -0.15, -2.5, 5.8);
  addCypressTree(root, 13.5, -0.15, 2.2, 6.0);
  addCypressTree(root, 14.2, -0.15, -3.5, 6.6);
  addOliveTree(root, -7.8, 0.05, 5.4, 1.05);
  addOliveTree(root, -2.5, 0.05, 5.1, 0.85);
  addOliveTree(root, 2.7, 0.05, 5.1, 0.85);

  enableShadows(root, true, true);
  return root;
}

/**
 * 2. SAMARKAND COURTYARD VILLA (matches prop_samarkand_villa_1794853628391.jpg)
 */
function buildSamarkandCourtyardVilla(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_samarkand_courtyard_villa';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const lawn = new THREE.Mesh(new THREE.BoxGeometry(30, 0.16, 26), m.lawnMat);
  lawn.position.set(0, -0.24, 1.0);
  root.add(lawn);

  const patio = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.14, 17.5), m.stoneTileMat);
  patio.position.set(0, -0.09, 1.2);
  root.add(patio);

  if (showF1) {
    // Left Rear Kitchen & Dining Room (hollow limestone shell)
    addHollowRoomShell({
      parent: root,
      cx: -5.8,
      baseY: 0.0,
      cz: -2.6,
      w: 6.6,
      h: 3.15,
      d: 6.6,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'open',
    });

    // Protruding 1-story Glass Sunroom Pavilion on Front-Left (clear glass showing L-sofa inside!)
    addHollowRoomShell({
      parent: root,
      cx: -5.8,
      baseY: 0.0,
      cz: 3.2,
      w: 6.4,
      h: 3.05,
      d: 5.6,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      backWall: false,
      leftGlass: true,
      rightGlass: true,
      frontMode: 'glass',
      panelsX: 4,
    });
    if (showRoof || showF2) {
      const sunRoof = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.32, 6.0), m.stoneMat);
      sunRoof.position.set(-5.8, 3.18, 3.2);
      root.add(sunRoof);
    }

    // Center Bridge 2-story Glass Atrium + Floating Oak Staircase
    addHollowRoomShell({
      parent: root,
      cx: -0.4,
      baseY: 0.0,
      cz: -2.0,
      w: 4.4,
      h: 3.15,
      d: 4.0,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      leftWall: false,
      rightWall: false,
      frontMode: 'glass',
      panelsX: 2,
    });
    addFloatingStaircase(root, -0.4, 0.0, -0.8, 3.18, m.warmWoodMat, m.glassMat);

    // Right Wing Ground Floor (Study / Guest Room & Bath)
    addHollowRoomShell({
      parent: root,
      cx: 5.4,
      baseY: 0.0,
      cz: -1.8,
      w: 7.0,
      h: 3.15,
      d: 7.2,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'solid',
    });
    if (!isCutaway) {
      const woodDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.25, 0.24), m.warmWoodMat);
      woodDoor.position.set(3.2, 1.15, 1.82);
      root.add(woodDoor);
    }
  }

  if (showF2) {
    // Left Wing Upper Floor Master Suite
    addHollowRoomShell({
      parent: root,
      cx: -5.8,
      baseY: 3.18,
      cz: -2.2,
      w: 6.6,
      h: 2.75,
      d: 7.4,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'solid',
    });
    if (!isCutaway) {
      const panjaraFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 0.18), m.warmWoodMat);
      panjaraFrame.position.set(-5.8, 4.35, 1.56);
      root.add(panjaraFrame);
      for (let i = -3; i <= 3; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.22), m.darkSteelMat);
        slat.position.set(-5.8 + i * 0.25, 4.35, 1.58);
        root.add(slat);
      }
    }

    // Center Bridge Upper Gallery Glass
    if (!isCutaway) {
      addClearGlassWall(root, -0.4, 4.5, -0.1, 4.2, 2.5, 0.12, 2, m.darkSteelMat, m.glassMat);
    }

    // Right Wing Upper Suite + Recessed Balcony
    addHollowRoomShell({
      parent: root,
      cx: 5.4,
      baseY: 3.18,
      cz: -1.8,
      w: 7.0,
      h: 2.75,
      d: 7.2,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });
    const balcFloor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.22, 2.2), m.warmWoodMat);
    balcFloor.position.set(6.9, 3.16, 2.6);
    root.add(balcFloor);
    const balcGlass = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.96, 0.05), m.glassMat);
    balcGlass.position.set(6.9, 3.75, 3.68);
    root.add(balcGlass);
  }

  if (showRoof && floorFilter === 'all') {
    const leftParapet = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.38, 7.8), m.stoneMat);
    leftParapet.position.set(-5.8, 5.95, -2.2);
    root.add(leftParapet);
    const centerRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.34, 4.2), m.stoneMat);
    centerRoof.position.set(-0.4, 5.85, -2.0);
    root.add(centerRoof);
    const rightRoof = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.38, 7.6), m.stoneMat);
    rightRoof.position.set(5.4, 5.95, -1.8);
    root.add(rightRoof);
    const balcCanopy = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.16, 2.5), m.darkSteelMat);
    balcCanopy.position.set(6.9, 5.72, 2.55);
    root.add(balcCanopy);
  }

  const gardenWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.6, 14.0), m.stoneMat);
  gardenWall.position.set(9.8, 1.25, 3.8);
  root.add(gardenWall);

  if (opts.hasPool) {
    const poolBasin = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 0.18, 6.2),
      new THREE.MeshStandardMaterial({ color: '#174A54', roughness: 0.35 })
    );
    poolBasin.position.set(4.5, -0.07, 7.6);
    root.add(poolBasin);

    const poolWater = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.06, 6.0), m.waterMat);
    poolWater.position.set(4.5, 0.0, 7.6);
    root.add(poolWater);

    for (let s = 0; s < 4; s++) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 1.15), m.marbleDeckMat);
      stone.position.set(1.2 + s * 1.9, 0.02, 5.25);
      root.add(stone);
    }
  }

  addOutdoorLoungeCluster(root, -6.4, 0.0, 7.6, m.warmWoodMat);
  const planter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 3.4), m.stoneTileMat);
  planter.position.set(5.2, 0.08, 3.6);
  root.add(planter);
  addOliveTree(root, 5.2, 0.18, 3.6, 1.1);
  addOliveTree(root, -9.2, 0.0, 6.2, 1.15);

  enableShadows(root, true, true);
  return root;
}

/**
 * 3. TASHKENT RESIDENCES MULTI-STORY COMPLEX (matches prop_new_build_tashkent_1794854289325.jpg
 * AND apartment interior prop_tashkent_apartment_1794853628562.jpg)
 */
function buildTashkentResidencesComplex(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_tashkent_residences_complex';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const fullFloors = Math.max(5, Math.min(8, opts.floors || 6));
  const floorH = 2.9;

  const parkLawn = new THREE.Mesh(new THREE.BoxGeometry(36, 0.16, 30), m.lawnMat);
  parkLawn.position.set(0, -0.24, 2.0);
  root.add(parkLawn);

  // Lower 2 Showcase Levels built hollow so both Exterior windows AND Dollhouse cutaway expose the real apartment!
  const wings = [
    { x: -7.4, z: -2.4, w: 7.4, d: 7.4, f: fullFloors - 1 },
    { x: -0.2, z: -1.4, w: 7.6, d: 7.8, f: fullFloors },
    { x: 7.2, z: -0.6, w: 7.6, d: 7.8, f: fullFloors },
  ];

  for (let wi = 0; wi < wings.length; wi++) {
    const wing = wings[wi];
    if (showF1) {
      addHollowRoomShell({
        parent: root,
        cx: wing.x,
        baseY: 0.0,
        cz: wing.z,
        w: wing.w,
        h: floorH,
        d: wing.d,
        extMat: m.stoneMat,
        intMat: m.interiorWallMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway,
        leftWall: wi === 0,
        rightWall: wi === 2,
        frontMode: 'glass',
        panelsX: 3,
      });
    }

    if (showF2) {
      addHollowRoomShell({
        parent: root,
        cx: wing.x,
        baseY: 2.95,
        cz: wing.z,
        w: wing.w,
        h: floorH,
        d: wing.d,
        extMat: m.stoneMat,
        intMat: m.interiorWallMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway,
        leftWall: wi === 0,
        rightWall: wi === 2,
        frontMode: 'glass',
        panelsX: 3,
      });
    }

    // Upper tower stories (3..N) + flat crown only rendered in full Exterior mode!
    if (showRoof && !isCutaway && floorFilter === 'all') {
      const upperH = Math.max(1, wing.f - 2) * floorH;
      const upperCore = new THREE.Mesh(new THREE.BoxGeometry(wing.w, upperH, wing.d), m.darkSteelMat);
      upperCore.position.set(wing.x, 2 * floorH + upperH / 2, wing.z);
      root.add(upperCore);

      addClearGlassWall(
        root,
        wing.x,
        2 * floorH + upperH / 2,
        wing.z + wing.d / 2 + 0.02,
        wing.w - 0.9,
        upperH - 0.4,
        0.1,
        3,
        m.darkSteelMat,
        m.glassMat
      );

      for (const px of [-wing.w / 2 + 0.38, wing.w / 2 - 0.38]) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.75, wing.f * floorH + 0.2, wing.d + 0.2), m.stoneMat);
        pier.position.set(wing.x + px, (wing.f * floorH) / 2 + 0.1, wing.z);
        root.add(pier);
      }

      const crown = new THREE.Mesh(new THREE.BoxGeometry(wing.w + 0.3, 0.45, wing.d + 0.3), m.darkSteelMat);
      crown.position.set(wing.x, wing.f * floorH + 0.22, wing.z);
      root.add(crown);
    }

    // Signature Horizontal Wood-Slatted Balconies + Planter greenery
    const plantMat = new THREE.MeshStandardMaterial({ color: '#3B6E3D', roughness: 0.8 });
    const maxBalconyFloor = showRoof && !isCutaway && floorFilter === 'all' ? wing.f : showF2 ? 2 : 0;
    for (let fl = 1; fl < maxBalconyFloor; fl++) {
      const by = fl * floorH + 0.32;
      const offsetX = (fl % 2 === 0 ? -0.9 : 0.9) * (wi % 2 === 0 ? 1 : -1);
      const balcW = wing.w * 0.62;

      const slab = new THREE.Mesh(new THREE.BoxGeometry(balcW, 0.18, 1.45), m.darkSteelMat);
      slab.position.set(wing.x + offsetX, by, wing.z + wing.d / 2 + 0.65);
      root.add(slab);

      const woodCladding = new THREE.Mesh(new THREE.BoxGeometry(balcW + 0.06, 0.56, 1.48), m.warmWoodMat);
      woodCladding.position.set(wing.x + offsetX, by + 0.32, wing.z + wing.d / 2 + 0.66);
      root.add(woodCladding);

      const glassTop = new THREE.Mesh(new THREE.BoxGeometry(balcW, 0.38, 0.05), m.glassMat);
      glassTop.position.set(wing.x + offsetX, by + 0.78, wing.z + wing.d / 2 + 1.38);
      root.add(glassTop);

      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), plantMat);
      bush.scale.set(1.3, 0.9, 0.8);
      bush.position.set(wing.x + offsetX - balcW * 0.28, by + 0.8, wing.z + wing.d / 2 + 0.9);
      root.add(bush);
    }
  }

  // Ground-floor travertine lobby portal
  if (showF1 && !isCutaway) {
    const lobbyPortal = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.0, 0.6), m.stoneMat);
    lobbyPortal.position.set(7.2, 1.5, 3.55);
    root.add(lobbyPortal);
  }

  // Landscaped Park & Pond
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.08, 2.4), m.stoneTileMat);
  walkway.position.set(-1.5, -0.1, 8.2);
  walkway.rotation.y = 0.12;
  root.add(walkway);

  if (opts.hasPool) {
    const pondBorder = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.18, 4.8), m.stoneTileMat);
    pondBorder.position.set(-4.2, -0.1, 10.2);
    root.add(pondBorder);
    const pondWater = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.06, 4.2), m.waterMat);
    pondWater.position.set(-4.2, 0.0, 10.2);
    root.add(pondWater);
  }

  for (const [ox, oz, sc] of [
    [-11.5, 6.2, 1.1],
    [-8.4, 11.4, 0.95],
    [1.8, 7.2, 1.0],
    [3.6, 11.0, 1.15],
    [11.8, 8.2, 1.05],
  ] as const) {
    addOliveTree(root, ox, -0.14, oz, sc);
  }

  enableShadows(root, true, true);
  return root;
}

/**
 * 4. BUKHARA HERITAGE COURTYARD (matches prop_bukhara_estate_1794853628569.jpg)
 */
function buildBukharaHeritageCourtyard(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_bukhara_heritage_courtyard';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const brickMat = createPBRMaterial({
    color: opts.wallColor || '#C8A982',
    materialType: 'brick',
    isUltra4K: opts.isUltra4K,
    isSoftwareGl: opts.isSoftwareGl,
    repeatX: 6,
    repeatY: 3,
  });

  const courtyard = new THREE.Mesh(new THREE.BoxGeometry(24, 0.18, 22), m.stoneTileMat);
  courtyard.position.set(0, -0.05, 1.5);
  root.add(courtyard);

  if (showF1) {
    // Back Historic Brick Wing Floor 1 (hollow dining & reception hall)
    addHollowRoomShell({
      parent: root,
      cx: -1.8,
      baseY: 0.06,
      cz: -5.8,
      w: 15.6,
      h: 3.6,
      d: 4.4,
      extMat: brickMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'open',
    });

    // Left Brick Arcade Wing Floor 1
    addHollowRoomShell({
      parent: root,
      cx: -9.0,
      baseY: 0.06,
      cz: -0.5,
      w: 3.6,
      h: 3.6,
      d: 11.8,
      extMat: brickMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      rightWall: false,
      frontMode: 'open',
    });

    // Contrasting Modern Glass Living Pavilion on the Right Side (clear glass showing teak sofa & crimson Bukhara carpet!)
    addHollowRoomShell({
      parent: root,
      cx: 6.2,
      baseY: 0.06,
      cz: 0.4,
      w: 6.0,
      h: 3.25,
      d: 7.0,
      extMat: m.interiorWallMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      backWall: true,
      leftGlass: true,
      rightWall: true,
      frontMode: 'glass',
      panelsX: 4,
    });
    if (showRoof || !isCutaway) {
      const modRoof = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.32, 7.4), m.darkSteelMat);
      modRoof.position.set(6.2, 3.45, 0.4);
      root.add(modRoof);
    }
  }

  if (showF2) {
    // Upper Floor Historic Brick Suite
    addHollowRoomShell({
      parent: root,
      cx: -1.8,
      baseY: 3.88,
      cz: -5.8,
      w: 15.6,
      h: 3.2,
      d: 4.4,
      extMat: brickMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'open',
    });

    // Pointed Arch Peshtak Portals + 2nd Floor Carved Wood Ayvan Galleries
    for (const ax of [-5.2, -0.6]) {
      if (!isCutaway) {
        const portalL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.8, 0.65), brickMat);
        portalL.position.set(ax - 1.45, 3.4, -3.35);
        root.add(portalL);
        const portalR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 6.8, 0.65), brickMat);
        portalR.position.set(ax + 1.45, 3.4, -3.35);
        root.add(portalR);
      }
      const ayvanDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1.2), m.warmWoodMat);
      ayvanDeck.position.set(ax, 3.82, -2.95);
      root.add(ayvanDeck);

      const ayvanRail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.72, 0.1), m.warmWoodMat);
      ayvanRail.position.set(ax, 4.25, -2.42);
      root.add(ayvanRail);

      for (const cx of [-1.1, 1.1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 10), m.warmWoodMat);
        col.position.set(ax + cx, 5.1, -2.52);
        root.add(col);
      }
    }
  }

  if (showRoof && floorFilter === 'all') {
    const backRoof = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.35, 4.8), brickMat);
    backRoof.position.set(-1.8, 7.22, -5.8);
    root.add(backRoof);
  }

  // Central Rectangular Carved Stone Courtyard Fountain Pool
  if (opts.hasPool) {
    const fRim = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.52, 5.2), m.stoneMat);
    fRim.position.set(-1.5, 0.24, 2.5);
    root.add(fRim);
    const fWater = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 4.6), m.waterMat);
    fWater.position.set(-1.5, 0.46, 2.5);
    root.add(fWater);
  }

  addCypressTree(root, -4.6, 0.0, 1.2, 7.2);
  addCypressTree(root, 0.8, 0.0, 0.6, 7.8);
  addCypressTree(root, 2.0, 0.0, -2.2, 6.8);
  addOutdoorLoungeCluster(root, 5.4, 0.04, 6.0, m.warmWoodMat);

  enableShadows(root, true, true);
  return root;
}

/**
 * 5. MODERN PERGOLA VILLA (matches prop_modern_house_uz_1794854289249.jpg)
 */
function buildModernPergolaVilla(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_modern_pergola_villa';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const lawn = new THREE.Mesh(new THREE.BoxGeometry(32, 0.16, 28), m.lawnMat);
  lawn.position.set(0, -0.24, 1.5);
  root.add(lawn);

  if (showF1) {
    addHollowRoomShell({
      parent: root,
      cx: -4.4,
      baseY: 0.06,
      cz: -2.4,
      w: 7.2,
      h: 3.05,
      d: 8.0,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });
    addHollowRoomShell({
      parent: root,
      cx: 4.8,
      baseY: 0.06,
      cz: -3.4,
      w: 6.8,
      h: 3.05,
      d: 7.4,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });
  }

  if (showF2) {
    addHollowRoomShell({
      parent: root,
      cx: -4.4,
      baseY: 3.15,
      cz: -2.4,
      w: 7.2,
      h: 2.8,
      d: 8.0,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });
    addHollowRoomShell({
      parent: root,
      cx: 4.8,
      baseY: 3.15,
      cz: -3.4,
      w: 6.8,
      h: 2.5,
      d: 7.4,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 3,
    });

    const midBalc = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.2, 2.0), m.stoneMat);
    midBalc.position.set(0.5, 3.0, -0.8);
    root.add(midBalc);
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.95, 0.05), m.glassMat);
    midRail.position.set(0.5, 3.55, 0.18);
    root.add(midRail);
  }

  if (showRoof && floorFilter === 'all') {
    const leftCrown = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.68, 8.8), m.stoneMat);
    leftCrown.position.set(-4.4, 6.28, -2.4);
    root.add(leftCrown);
    const rightCrown = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.6, 8.2), m.stoneMat);
    rightCrown.position.set(4.8, 5.95, -3.4);
    root.add(rightCrown);
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(16.0, 0.12, 9.5), m.marbleDeckMat);
  deck.position.set(0.5, -0.1, 6.0);
  root.add(deck);

  const pergX = -0.8;
  const pergZ = 6.2;
  for (const [px, pz] of [
    [-2.4, -2.0],
    [2.4, -2.0],
    [-2.4, 2.0],
    [2.4, 2.0],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 0.2), m.warmWoodMat);
    post.position.set(pergX + px, 1.35, pergZ + pz);
    root.add(post);
  }
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.18, 4.3), m.warmWoodMat);
  topFrame.position.set(pergX, 2.8, pergZ);
  root.add(topFrame);

  const fabricSailMat = new THREE.MeshStandardMaterial({ color: '#F3ECE0', roughness: 0.9 });
  for (let s = -1; s <= 1; s++) {
    const sail = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.04, 3.9), fabricSailMat);
    sail.position.set(pergX + s * 1.55, 2.68, pergZ);
    root.add(sail);
  }
  addOutdoorLoungeCluster(root, pergX, -0.04, pergZ, m.warmWoodMat);

  if (opts.hasPool) {
    const poolRim = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.22, 8.6), m.marbleDeckMat);
    poolRim.position.set(7.4, -0.09, 5.8);
    root.add(poolRim);
    const poolWater = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.06, 7.9), m.waterMat);
    poolWater.position.set(7.4, 0.0, 5.8);
    root.add(poolWater);
  }

  addOliveTree(root, -9.2, -0.15, 5.2, 1.15);
  addOliveTree(root, 11.4, -0.15, 1.5, 1.05);
  addCypressTree(root, -10.5, -0.15, -4.5, 5.8);

  enableShadows(root, true, true);
  return root;
}

/**
 * 6. COMMERCIAL GLASS TOWER (matches prop_commercial_tower_1794853629336.jpg
 * AND oak-paneled travertine boardroom prop_luxury_office_uz_1794854288611.jpg)
 */
function buildCommercialGlassTower(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_commercial_glass_tower';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const floors = Math.max(4, Math.min(7, opts.floors || 5));
  const floorH = 3.1;
  const fullH = floors * floorH;

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(34, 0.16, 26), m.stoneTileMat);
  plaza.position.set(0, -0.14, 2.0);
  root.add(plaza);

  // Lower 2 Showcase Levels built hollow (Atrium + Left/Right Executive Wings)
  if (showF1) {
    addHollowRoomShell({
      parent: root,
      cx: 0,
      baseY: 0.06,
      cz: -1.6,
      w: 7.0,
      h: floorH,
      d: 8.4,
      extMat: m.darkSteelMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      leftWall: false,
      rightWall: false,
      frontMode: 'glass',
      panelsX: 4,
    });
    for (const sx of [-1, 1]) {
      addHollowRoomShell({
        parent: root,
        cx: sx * 7.6,
        baseY: 0.06,
        cz: -1.0,
        w: 7.6,
        h: floorH,
        d: 9.8,
        extMat: m.stoneMat,
        intMat: m.warmWoodMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway,
        frontMode: 'glass',
        panelsX: 4,
      });
    }
  }

  if (showF2) {
    for (const sx of [-1, 1]) {
      addHollowRoomShell({
        parent: root,
        cx: sx * 7.6,
        baseY: 3.18,
        cz: -1.0,
        w: 7.6,
        h: floorH,
        d: 9.8,
        extMat: m.stoneMat,
        intMat: m.warmWoodMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway,
        frontMode: 'glass',
        panelsX: 4,
      });
    }
  }

  // Upper Tower Floors (3..N) & vertical travertine pilasters only in full Exterior mode
  if (showRoof && !isCutaway && floorFilter === 'all') {
    const upperH = Math.max(1, floors - 2) * floorH;
    const upperAtrium = new THREE.Mesh(new THREE.BoxGeometry(7.2, upperH, 8.6), m.darkSteelMat);
    upperAtrium.position.set(0, 2 * floorH + upperH / 2, -1.6);
    root.add(upperAtrium);
    addClearGlassWall(root, 0, fullH / 2, 2.75, 7.0, fullH - 0.5, 0.12, 6, m.darkSteelMat, m.glassMat);

    for (const sx of [-1, 1]) {
      const wx = sx * 7.6;
      const upperWing = new THREE.Mesh(new THREE.BoxGeometry(7.8, upperH, 10.0), m.stoneMat);
      upperWing.position.set(wx, 2 * floorH + upperH / 2, -1.0);
      root.add(upperWing);
      addClearGlassWall(root, wx, fullH / 2, 4.02, 7.1, fullH - 0.8, 0.12, 5, m.darkSteelMat, m.glassMat);

      for (let r = -2; r <= 2; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, fullH, 0.32), m.stoneMat);
        rib.position.set(wx + r * 1.65, fullH / 2, 4.06);
        root.add(rib);
      }

      for (let f = 1; f <= floors; f++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.34, 10.2), m.stoneMat);
        band.position.set(wx, f * floorH - 0.17, -1.0);
        root.add(band);
      }
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 2.2), m.darkSteelMat);
    canopy.position.set(7.6, 3.2, 4.8);
    root.add(canopy);
  }

  for (const px of [-9.5, -4.5, 4.5, 11.2]) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 2.8), m.lawnMat);
    bed.position.set(px, -0.02, 8.2);
    root.add(bed);
    addOliveTree(root, px, 0.02, 8.2, 0.95);
  }

  enableShadows(root, true, true);
  return root;
}

/**
 * 7. PENTHOUSE SKYLINE TOWER (matches prop_tashkent_penthouse_1794853628028.jpg)
 */
function buildPenthouseSkylineTower(opts: ArchetypeExteriorOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'archetype_penthouse_skyline_tower';
  const m = createSharedMaterials(opts);
  const showRoof = opts.showRoof ?? true;
  const isCutaway = opts.isCutaway ?? false;
  const floorFilter = opts.activeFloorFilter ?? 'all';
  const showF1 = floorFilter === 'all' || floorFilter === 1;
  const showF2 = floorFilter === 'all' || floorFilter === 2;

  const floors = Math.max(5, Math.min(9, opts.floors || 7));
  const floorH = 3.0;
  const towerH = (floors - 1) * floorH;

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(32, 0.16, 26), m.stoneTileMat);
  plaza.position.set(0, -0.14, 1.5);
  root.add(plaza);

  if (showF1) {
    // Lower Penthouse Level (Master Bedroom & Spa Bath)
    addHollowRoomShell({
      parent: root,
      cx: 0,
      baseY: 0.06,
      cz: -0.5,
      w: 13.4,
      h: 3.1,
      d: 10.2,
      extMat: m.stoneMat,
      intMat: m.interiorWallMat,
      floorMat: m.interiorFloorMat,
      frameMat: m.darkSteelMat,
      glassMat: m.glassMat,
      isCutaway,
      frontMode: 'glass',
      panelsX: 6,
    });
  }

  if (showF2) {
    // Crown Sky Lounge Level (travertine floor + right fireplace wall + skyline windows matching prop_tashkent_penthouse_1794853628028.jpg!)
    const crownBaseY = showRoof && !isCutaway ? towerH : 3.25;
    if (isCutaway || !showRoof) {
      addHollowRoomShell({
        parent: root,
        cx: -0.4,
        baseY: 3.25,
        cz: -1.0,
        w: 11.4,
        h: 3.1,
        d: 8.4,
        extMat: m.darkSteelMat,
        intMat: m.interiorWallMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway,
        leftGlass: true,
        frontMode: 'glass',
        panelsX: 5,
      });
      // Signature travertine fireplace hearth on the right wall of the penthouse lounge
      addFireplaceHearth(root, 4.4, 3.25, -0.4, m.stoneMat, m.emberMat, m.darkSteelMat);

      // Sky terrace deck wrapping front/right
      const deck = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.18, 10.4), m.marbleDeckMat);
      deck.position.set(0, 3.14, -0.4);
      root.add(deck);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.9, 0.05), m.glassMat);
      rail.position.set(0, 3.68, 4.75);
      root.add(rail);
    } else {
      // Full high-rise shaft below crown penthouse in Exterior 360°
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(13.5, towerH - 3.1, 10.5), m.stoneMat);
      shaft.position.set(0, 3.1 + (towerH - 3.1) / 2, -0.5);
      root.add(shaft);
      addClearGlassWall(root, 0, towerH / 2, 4.78, 11.6, towerH - 0.8, 0.14, 6, m.darkSteelMat, m.glassMat);

      for (let f = 1; f < floors; f++) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.28, 11.2), m.stoneMat);
        slab.position.set(0, f * floorH, -0.5);
        root.add(slab);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(14.1, 0.82, 0.05), m.glassMat);
        rail.position.set(0, f * floorH + 0.5, 5.08);
        root.add(rail);
      }

      // Hollow Illuminated Crown Penthouse Floor at top of tower
      addHollowRoomShell({
        parent: root,
        cx: -0.6,
        baseY: crownBaseY,
        cz: -1.2,
        w: 10.8,
        h: 3.3,
        d: 8.2,
        extMat: m.darkSteelMat,
        intMat: m.interiorWallMat,
        floorMat: m.interiorFloorMat,
        frameMat: m.darkSteelMat,
        glassMat: m.glassMat,
        isCutaway: false,
        leftGlass: true,
        frontMode: 'glass',
        panelsX: 5,
      });

      const pentRoof = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.42, 10.8), m.warmWoodMat);
      pentRoof.position.set(0, crownBaseY + 3.45, -0.5);
      root.add(pentRoof);

      addOutdoorLoungeCluster(root, 4.2, crownBaseY + 0.14, 3.6, m.warmWoodMat);
    }
  }

  addOliveTree(root, -9.5, -0.06, 7.2, 1.0);
  addOliveTree(root, 9.5, -0.06, 7.2, 1.0);

  enableShadows(root, true, true);
  return root;
}

export function buildPhotoMatchedExteriorGroup(opts: ArchetypeExteriorOptions): THREE.Group | null {
  switch (opts.archetype) {
    case 'boulevard_cantilever_villa':
      return buildBoulevardCantileverVilla(opts);
    case 'samarkand_courtyard_villa':
      return buildSamarkandCourtyardVilla(opts);
    case 'tashkent_residences_complex':
      return buildTashkentResidencesComplex(opts);
    case 'bukhara_heritage_courtyard':
      return buildBukharaHeritageCourtyard(opts);
    case 'modern_pergola_villa':
      return buildModernPergolaVilla(opts);
    case 'commercial_glass_tower':
      return buildCommercialGlassTower(opts);
    case 'penthouse_skyline_tower':
      return buildPenthouseSkylineTower(opts);
    case 'classic_estate':
    default:
      return null;
  }
}
