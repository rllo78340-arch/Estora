import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box, AlertCircle, Eye, Home, Layers, Sparkles } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { detectSoftwareGl, isWebGLAvailable, waitAfterDraw } from '../../utils/webglSupport';
import {
  createArchitecturalHouseGroup,
  createCompositeFurnitureGroup,
} from '../../utils/proceduralArchitecture3d';
import { getFurnishedHouseItemsForProperty, type RoomId } from '../../utils/interiorLayoutLogic';

import {
  generatePropertyArchConfig,
  getDollhouseCameraForArchetype,
  getRoomCameraForArchetype,
  type PropertyReconstructionConfig,
  type VisionArchOverride,
} from '../../utils/propertyReconstruction';

export interface Model3DCanvasControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Model3DCanvasProps {
  modelUrl: string;
  propertyId?: number;
  title?: string;
  imageUrl?: string;
  propertyType?: string;
  totalFloors?: number;
  description?: string;
  amenities?: string;
  galleryImages?: string[];
  autoRotate?: boolean;
  exposure?: number;
  isDarkTheme?: boolean;
  controlsApiRef?: { current: Model3DCanvasControls | null };
  onLoaded?: () => void;
  onError?: (message: string) => void;
}

type ArchViewMode = 'exterior' | 'dollhouse' | 'floor1' | 'floor2';

const clientArchVisionCache = new Map<string, VisionArchOverride | null>();

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

function getSkyColorHex(isDark: boolean, skyMood: PropertyReconstructionConfig['skyMood']): number {
  if (isDark) {
    return skyMood === 'dusk' ? 0x10161e : 0x121619;
  }
  if (skyMood === 'sunset') return 0xefe2d1;
  if (skyMood === 'dusk') return 0xd2dbe6;
  return 0xdfe9f2;
}

export function Model3DCanvas({
  modelUrl,
  propertyId,
  title,
  imageUrl,
  propertyType,
  totalFloors,
  description,
  amenities,
  galleryImages,
  autoRotate = false,
  exposure = 1.05,
  isDarkTheme = true,
  controlsApiRef,
  onLoaded,
  onError,
}: Model3DCanvasProps) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef(autoRotate);
  const exposureRef = useRef(exposure);
  const isDarkRef = useRef(isDarkTheme);
  const callbacksRef = useRef({ onLoaded, onError });
  callbacksRef.current = { onLoaded, onError };

  // Determine whether this is one of the seeded sample URLs or a custom uploaded GLB
  const isSeededSample =
    !modelUrl ||
    modelUrl.includes('/uploads/samples/') ||
    modelUrl.startsWith('procedural:');

  const [archMode, setArchMode] = useState<ArchViewMode>('exterior');
  const [activeRoomFocus, setActiveRoomFocus] = useState<RoomId | null>(null);
  const [quality4K, setQuality4K] = useState<boolean>(false);
  const [useProceduralForCustom, setUseProceduralForCustom] = useState<boolean>(false);
  const [visionOverride, setVisionOverride] = useState<VisionArchOverride | null>(null);

  const [loadProgress, setLoadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const primaryPhotoUrl = (imageUrl || galleryImages?.[0] || '').trim();
  const galleryKey = galleryImages?.join('|') || '';

  const resolvedGalleryList = useMemo(() => {
    const items = [...(galleryImages ?? [])].filter(Boolean);
    if (primaryPhotoUrl && !items.includes(primaryPhotoUrl)) {
      items.unshift(primaryPhotoUrl);
    }
    return items;
  }, [galleryImages, primaryPhotoUrl]);

  const activeArchConfig = useMemo(
    () =>
      generatePropertyArchConfig(
        {
          id: propertyId ?? 1,
          title: title || 'ESTORA Property',
          propertyType,
          totalFloors,
          description,
          amenities,
          galleryImages: JSON.stringify(resolvedGalleryList),
          imageUrl: primaryPhotoUrl || modelUrl,
        },
        visionOverride
      ),
    [
      propertyId,
      title,
      propertyType,
      totalFloors,
      description,
      amenities,
      resolvedGalleryList,
      primaryPhotoUrl,
      modelUrl,
      visionOverride,
    ]
  );

  const latestArchRef = useRef({
    archConfig: activeArchConfig,
    propertyId,
    propertyType,
  });
  latestArchRef.current = {
    archConfig: activeArchConfig,
    propertyId,
    propertyType,
  };

  // Reset camera mode when switching properties
  useEffect(() => {
    setActiveRoomFocus(null);
    setArchMode('exterior');
  }, [propertyId, primaryPhotoUrl]);

  // Analyze custom uploaded or external property photography with Gemini Vision on the server
  useEffect(() => {
    if (!primaryPhotoUrl || isKnownSeededPhotoUrl(primaryPhotoUrl)) {
      setVisionOverride(null);
      return;
    }

    const cacheKey = `${primaryPhotoUrl}::${propertyType || ''}`;
    if (clientArchVisionCache.has(cacheKey)) {
      setVisionOverride(clientArchVisionCache.get(cacheKey) ?? null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/properties/analyze-architecture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        imageUrl: primaryPhotoUrl,
        title: title || '',
        propertyType: propertyType || '',
        description: description || '',
      }),
    })
      .then((res) => (res.ok ? res.json() : { visionOverride: null }))
      .then((data: { visionOverride?: VisionArchOverride | null }) => {
        if (cancelled) return;
        const parsed = data?.visionOverride ?? null;
        clientArchVisionCache.set(cacheKey, parsed);
        setVisionOverride(parsed);
      })
      .catch(() => {
        if (!cancelled) {
          setVisionOverride(null);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [primaryPhotoUrl, propertyType, title, description]);

  const sceneStateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    requestRender?: () => void;
    initialCamPos?: THREE.Vector3;
    initialTarget?: THREE.Vector3;
    rebuildProceduralScene?: (mode: ArchViewMode, ultra: boolean, roomFocus: RoomId | null) => void;
  }>({});

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (sceneStateRef.current.controls) {
      const isSoft = detectSoftwareGl();
      sceneStateRef.current.controls.autoRotate = Boolean(autoRotate && !isSoft);
      sceneStateRef.current.requestRender?.();
    }
  }, [autoRotate]);

  useEffect(() => {
    exposureRef.current = exposure;
    if (sceneStateRef.current.renderer) {
      sceneStateRef.current.renderer.toneMappingExposure = exposure;
      sceneStateRef.current.requestRender?.();
    }
  }, [exposure]);

  useEffect(() => {
    isDarkRef.current = isDarkTheme;
    const { scene, requestRender } = sceneStateRef.current;
    if (scene) {
      const bg = getSkyColorHex(isDarkTheme, latestArchRef.current.archConfig.skyMood);
      scene.background = new THREE.Color(bg);
      scene.fog = new THREE.Fog(bg, 32, 85);
      requestRender?.();
    }
  }, [isDarkTheme, activeArchConfig.skyMood]);

  useEffect(() => {
    if (sceneStateRef.current.rebuildProceduralScene && (isSeededSample || useProceduralForCustom)) {
      sceneStateRef.current.rebuildProceduralScene(archMode, quality4K, activeRoomFocus);
    }
  }, [
    archMode,
    quality4K,
    activeRoomFocus,
    isSeededSample,
    useProceduralForCustom,
    propertyId,
    title,
    primaryPhotoUrl,
    propertyType,
    totalFloors,
    description,
    amenities,
    galleryKey,
    visionOverride,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (!isWebGLAvailable()) {
      setLoading(false);
      setLoadError('WebGL недоступен в текущем браузере для отображения 3D-модели.');
      return;
    }

    setLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setContextLost(false);

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(300, container.clientWidth || 640);
    const height = Math.max(240, container.clientHeight || 420);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposureRef.current;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialBg = getSkyColorHex(isDarkRef.current, latestArchRef.current.archConfig.skyMood);
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.Fog(initialBg, 32, 85);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 220);
    camera.position.set(...latestArchRef.current.archConfig.cameraPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.minDistance = 1.6;
    controls.maxDistance = 54;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = Boolean(autoRotateRef.current && !isSoftwareGl);
    controls.autoRotateSpeed = 0.75;

    // 3-point warm/cool architectural lighting + warm interior lights
    const hemi = new THREE.HemisphereLight(0xdce8f5, 0x3b352d, 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff3de, 2.0);
    keyLight.position.set(16, 26, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(isSoftwareGl ? 512 : 2048, isSoftwareGl ? 512 : 2048);
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xc9d8e8, 0.75);
    rimLight.position.set(-16, 12, -14);
    scene.add(rimLight);

    // Warm interior point lights on Floor 1 & Floor 2
    const livingLight = new THREE.PointLight(0xffe6b8, 1.2, 12);
    livingLight.position.set(-3.5, 2.9, 0);
    scene.add(livingLight);

    const kitchenLight = new THREE.PointLight(0xfff0d4, 1.2, 12);
    kitchenLight.position.set(3.5, 2.9, -1.8);
    scene.add(kitchenLight);

    const masterBedLight = new THREE.PointLight(0xffe2ad, 1.1, 12);
    masterBedLight.position.set(-3.5, 5.9, -1.2);
    scene.add(masterBedLight);

    let disposed = false;
    let frameId = 0;
    const timers: number[] = [];
    let renderBusy = false;
    let renderDirty = false;
    let loadedRoot: THREE.Object3D | null = null;

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

    const initialCamPos = new THREE.Vector3(...latestArchRef.current.archConfig.cameraPos);
    const initialTarget = new THREE.Vector3(...latestArchRef.current.archConfig.cameraTarget);

    const disposeObjectTree = (root: THREE.Object3D | null) => {
      if (!root) return;
      scene.remove(root);
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
        }
      });
    };

    const rebuildProceduralScene = (
      mode: ArchViewMode,
      ultra: boolean,
      roomFocus: RoomId | null
    ) => {
      if (disposed) return;
      disposeObjectTree(loadedRoot);

      const {
        archConfig,
        propertyId: currentPropId,
        propertyType: currentPropType,
      } = latestArchRef.current;

      const skyHex = getSkyColorHex(isDarkRef.current, archConfig.skyMood);
      scene.background = new THREE.Color(skyHex);
      scene.fog = new THREE.Fog(skyHex, 32, 85);

      const showRoof = mode === 'exterior' && !roomFocus;
      const activeFloorFilter = mode === 'floor1' ? 1 : mode === 'floor2' ? 2 : 'all';
      const exteriorWallOpacity = mode === 'exterior' && !roomFocus ? 1.0 : 0.25;

      const rootGroup = new THREE.Group();
      const houseMesh = createArchitecturalHouseGroup({
        wallColor: archConfig.wallColor,
        wallFinish: 'plaster',
        floorMaterial: archConfig.interior.floorColor,
        floorFinish: archConfig.interior.floorFinish,
        ceilingColor: '#FFFFFF',
        facadeStyle: archConfig.facadeStyle,
        archetype: archConfig.archetype,
        accentColor: archConfig.accentColor,
        interiorWallColor: archConfig.interior.wallColor,
        interiorFloorColor: archConfig.interior.floorColor,
        poolPlacement: archConfig.poolPlacement,
        hasPergola: archConfig.hasPergola,
        hasWoodBalconies: archConfig.hasWoodBalconies,
        hasGlassSunroom: archConfig.hasGlassSunroom,
        hasCourtyardArches: archConfig.hasCourtyardArches,
        hasGarage: archConfig.hasGarage,
        showRoof,
        showExteriorWalls: true,
        exteriorWallOpacity,
        activeFloorFilter,
        showYard: true,
        isUltra4K: ultra,
        isSoftwareGl,
        hasPool: archConfig.hasPool,
        hasBalcony: archConfig.hasBalcony,
        hasTerrace: archConfig.hasTerrace,
        roofType: archConfig.roofType,
        floors: archConfig.floors,
      });
      rootGroup.add(houseMesh);

      // Render archetype-matched furnished interior inside ALL modes (visible through clear exterior windows AND cutaway views)
      const furnitureItems = getFurnishedHouseItemsForProperty(
        currentPropId,
        currentPropType,
        archConfig
      );
      const isFullExteriorPenthouse =
        archConfig.archetype === 'penthouse_skyline_tower' && showRoof;
      const penthouseCrownOffsetY = isFullExteriorPenthouse
        ? (Math.max(5, Math.min(9, archConfig.floors || 7)) - 1) * 3.0 - 3.25
        : 0;

      for (const item of furnitureItems) {
        if (activeFloorFilter !== 'all' && item.floor !== activeFloorFilter) continue;
        const furnGrp = createCompositeFurnitureGroup(item, {
          isUltra4K: ultra,
          isSoftwareGl,
        });
        const yPos =
          isFullExteriorPenthouse && item.floor === 2
            ? item.y + penthouseCrownOffsetY
            : item.y;
        furnGrp.position.set(item.x, yPos, item.z);
        furnGrp.rotation.y = item.rotationY;
        rootGroup.add(furnGrp);
      }

      loadedRoot = rootGroup;
      scene.add(rootGroup);

      initialCamPos.set(...archConfig.cameraPos);
      initialTarget.set(...archConfig.cameraTarget);

      const w = Math.max(320, container.clientWidth || 800);
      const h = Math.max(320, container.clientHeight || 520);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);

      if (roomFocus) {
        const cam = getRoomCameraForArchetype(archConfig.archetype, roomFocus);
        camera.position.set(...cam.pos);
        controls.target.set(...cam.target);
      } else if (mode === 'dollhouse' || mode === 'floor1' || mode === 'floor2') {
        const cam = getDollhouseCameraForArchetype(archConfig.archetype, mode);
        camera.position.set(...cam.pos);
        controls.target.set(...cam.target);
      } else {
        camera.position.copy(initialCamPos);
        controls.target.copy(initialTarget);
      }
      controls.update();
      renderer.render(scene, camera);
      setLoading(false);
      setLoadProgress(100);
      callbacksRef.current.onLoaded?.();
      requestRender();
    };

    sceneStateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      requestRender,
      initialCamPos,
      initialTarget,
      rebuildProceduralScene,
    };

    if (controlsApiRef) {
      controlsApiRef.current = {
        zoomIn: () => {
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(0.8);
          if (offset.length() >= controls.minDistance) {
            camera.position.copy(controls.target).add(offset);
            controls.update();
            renderer.render(scene, camera);
            requestRender();
          }
        },
        zoomOut: () => {
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(1.25);
          if (offset.length() <= controls.maxDistance) {
            camera.position.copy(controls.target).add(offset);
            controls.update();
            renderer.render(scene, camera);
            requestRender();
          }
        },
        resetView: () => {
          setActiveRoomFocus(null);
          setArchMode('exterior');
          camera.position.copy(initialCamPos);
          controls.target.copy(initialTarget);
          controls.update();
          renderer.render(scene, camera);
          requestRender();
        },
      };
    }

    const onControlsChange = () => requestRender();
    controls.addEventListener('change', onControlsChange);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

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

    if (isSeededSample || useProceduralForCustom) {
      rebuildProceduralScene(archMode, quality4K, activeRoomFocus);
    } else {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const scale = 8.5 / maxDim;

          root.scale.setScalar(scale);
          root.position.set(
            -center.x * scale,
            -box.min.y * scale,
            -center.z * scale
          );

          root.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = !isSoftwareGl;
              mesh.receiveShadow = !isSoftwareGl;
            }
          });

          loadedRoot = root;
          scene.add(root);

          const fittedHeight = Math.max(1.2, size.y * scale);
          initialTarget.set(0, fittedHeight * 0.42, 0);
          initialCamPos.set(7.5, fittedHeight * 0.8 + 3.2, 8.5);
          camera.position.copy(initialCamPos);
          controls.target.copy(initialTarget);
          controls.update();
          renderer.render(scene, camera);

          setLoading(false);
          setLoadProgress(100);
          callbacksRef.current.onLoaded?.();
          requestRender();
        },
        (progressEvent) => {
          if (disposed) return;
          if (progressEvent.total > 0) {
            setLoadProgress(Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
          }
        },
        (err) => {
          if (disposed) return;
          const msg =
            err instanceof Error && err.message
              ? `Не удалось открыть 3D-модель: ${err.message}`
              : 'Не удалось загрузить или разобрать 3D-модель GLB/GLTF.';
          setLoading(false);
          setLoadError(msg);
          callbacksRef.current.onError?.(msg);
        }
      );
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      timers.forEach((t) => window.clearTimeout(t));
      resizeObserver.disconnect();
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      disposeObjectTree(loadedRoot);
      envTex.dispose();
      renderer.dispose();
      if (controlsApiRef) {
        controlsApiRef.current = null;
      }
      sceneStateRef.current = {};
    };
  }, [modelUrl, isSeededSample, useProceduralForCustom, controlsApiRef]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden sm:min-h-[540px]">
      <div ref={mountRef} data-testid="three-model-canvas" className="h-full min-h-[420px] w-full sm:min-h-[540px]" />

      {/* Top Architectural Controls Overlay */}
      <div className="pointer-events-auto absolute start-3 end-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(isSeededSample || useProceduralForCustom) ? (
            <>
              <div className="inline-flex items-center gap-1 rounded-[12px] border border-white/15 bg-[#141414]/90 p-1">
                {[
                  { id: 'exterior', label: 'Экстерьер 360°', icon: Home },
                  { id: 'dollhouse', label: 'Dollhouse (Внутри)', icon: Layers },
                  { id: 'floor1', label: '1 Этаж', icon: Box },
                  { id: 'floor2', label: '2 Этаж', icon: Box },
                ].map((m) => {
                  const Icon = m.icon;
                  const active = archMode === m.id && !activeRoomFocus;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveRoomFocus(null);
                        setArchMode(m.id as ArchViewMode);
                      }}
                      className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-medium transition-colors ${
                        active
                          ? 'bg-[#D4B483] text-[#171717]'
                          : 'text-white/85 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setQuality4K((prev) => !prev)}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] border px-3 text-[11px] font-semibold transition-colors ${
                  quality4K
                    ? 'border-[#D4B483] bg-[#D4B483] text-[#171717]'
                    : 'border-white/15 bg-[#141414]/90 text-white hover:bg-[#1E1E1E]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{quality4K ? 'Ultra 4K PBR' : 'Real-Time 3D'}</span>
              </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-[#141414]/90 px-3 py-1.5 text-xs text-white">
              <span className="font-mono text-[#D4B483]">GLB 3D</span>
              <span>Загруженная модель продавца</span>
              <button
                type="button"
                onClick={() => setUseProceduralForCustom(true)}
                className="rounded-[8px] bg-[#D4B483] px-2 py-0.5 text-[11px] font-semibold text-[#171717]"
              >
                Открыть 3D по фото
              </button>
            </div>
          )}
        </div>

        {(isSeededSample || useProceduralForCustom) && (
          <div
            data-testid="arch-style-badge"
            className="hidden max-w-[360px] items-center gap-1.5 rounded-[10px] border border-white/15 bg-[#141414]/90 px-3 py-1.5 text-[11px] text-white/90 lg:inline-flex"
          >
            <span className="truncate font-medium text-[#D4B483]">{activeArchConfig.styleLabel}</span>
          </div>
        )}
      </div>

      {/* Bottom Room Quick-Teleport Pills */}
      {(isSeededSample || useProceduralForCustom) && (
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
                { id: 'bathroom1', label: 'Ванная 1' },
                { id: 'bathroom2', label: 'Ванная 2' },
                { id: 'balcony', label: 'Терраса' },
                { id: 'yard', label: 'Двор и фасад' },
              ] as const)
          ).map((rm) => {
            const active = activeRoomFocus === rm.id;
            return (
              <button
                key={rm.id}
                type="button"
                onClick={() => {
                  setActiveRoomFocus(rm.id);
                  if (rm.id !== 'yard') {
                    setArchMode('dollhouse');
                  } else {
                    setArchMode('exterior');
                  }
                }}
                className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-[9px] border px-2.5 text-[11px] font-medium transition-colors ${
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
      )}

      {loading && !loadError && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#111111]/80 text-white">
          <Box className="h-7 w-7 text-[#D4B483]" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">
            {t.tour3d.modelLoading}{loadProgress > 0 ? ` · ${loadProgress}%` : ''}
          </p>
          <p className="mt-1 text-xs text-white/70">{t.tour3d.dragHint}</p>
        </div>
      )}

      {(loadError || contextLost) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1C1C1C] p-6 text-center text-white">
          <AlertCircle className="h-7 w-7 text-[#FCA5A5]" aria-hidden="true" />
          <p className="mt-2 max-w-md text-sm font-medium">
            {contextLost ? t.tour3d.noWebglDesc : loadError}
          </p>
        </div>
      )}
    </div>
  );
}
