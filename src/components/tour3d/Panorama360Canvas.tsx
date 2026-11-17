import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AlertCircle, ArrowUpRight, Compass } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import type { TourHotspot } from '../../types/estora';
import {
  clampPitchDeg,
  normalizeYawDeg,
  sphericalDegToVector3,
  vector3ToSphericalDeg,
} from '../../utils/tour3d';
import { detectSoftwareGl, isWebGLAvailable, waitAfterDraw } from '../../utils/webglSupport';

export interface Panorama360Controls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  lookAt: (yaw: number, pitch: number) => void;
}

interface ProjectedHotspot {
  index: number;
  hotspot: TourHotspot;
  xPercent: number;
  yPercent: number;
  visible: boolean;
}

interface Panorama360CanvasProps {
  imageUrl: string;
  preloadUrls?: string[];
  hotspots?: TourHotspot[];
  initialYaw?: number;
  initialPitch?: number;
  defaultFov?: number;
  autoRotate?: boolean;
  placementMode?: boolean;
  controlsApiRef?: { current: Panorama360Controls | null };
  onHotspotClick?: (hotspot: TourHotspot) => void;
  onPlaceHotspot?: (yaw: number, pitch: number) => void;
  onCameraChange?: (yaw: number, pitch: number, fov: number) => void;
}

const _projVec = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export function Panorama360Canvas({
  imageUrl,
  preloadUrls = [],
  hotspots = [],
  initialYaw = 0,
  initialPitch = 0,
  defaultFov = 75,
  autoRotate = false,
  placementMode = false,
  controlsApiRef,
  onHotspotClick,
  onPlaceHotspot,
  onCameraChange,
}: Panorama360CanvasProps) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const placementModeRef = useRef(placementMode);
  placementModeRef.current = placementMode;
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const callbacksRef = useRef({ onHotspotClick, onPlaceHotspot, onCameraChange });
  callbacksRef.current = { onHotspotClick, onPlaceHotspot, onCameraChange };

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [projectedHotspots, setProjectedHotspots] = useState<ProjectedHotspot[]>([]);

  const engineRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    sphereMesh?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
    textureCache?: Map<string, THREE.Texture>;
    targetYaw: number;
    targetPitch: number;
    targetFov: number;
    curYaw: number;
    curPitch: number;
    curFov: number;
    requestRender?: () => void;
    projectMarkers?: () => void;
  }>({
    targetYaw: initialYaw,
    targetPitch: initialPitch,
    targetFov: defaultFov,
    curYaw: initialYaw,
    curPitch: initialPitch,
    curFov: defaultFov,
  });

  // Update target camera orientation smoothly when switching rooms
  useEffect(() => {
    engineRef.current.targetYaw = initialYaw;
    engineRef.current.targetPitch = clampPitchDeg(initialPitch);
    engineRef.current.requestRender?.();
  }, [initialYaw, initialPitch, imageUrl]);

  useEffect(() => {
    engineRef.current.targetFov = Math.max(40, Math.min(100, defaultFov || 75));
    engineRef.current.requestRender?.();
  }, [defaultFov]);

  useEffect(() => {
    engineRef.current.projectMarkers?.();
  }, [hotspots]);

  // Initialize Three.js renderer once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (!isWebGLAvailable()) {
      setLoading(false);
      setLoadError('WebGL недоступен в текущем браузере для 360°-просмотра.');
      return;
    }

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(300, container.clientWidth || 640);
    const height = Math.max(240, container.clientHeight || 420);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = placementModeRef.current ? 'crosshair' : 'grab';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(
      engineRef.current.curFov,
      width / height,
      0.1,
      200
    );
    camera.position.set(0, 0, 0);

    const sphereGeo = new THREE.SphereGeometry(50, 64, 48);
    sphereGeo.scale(-1, 1, 1); // Render panorama on inside surface
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphereMesh);

    const textureCache = new Map<string, THREE.Texture>();
    let disposed = false;
    let frameId = 0;
    const timers: number[] = [];
    let renderBusy = false;
    let renderDirty = false;
    let lastClock = performance.now();

    const registerTimer = (id: number) => timers.push(id);

    const projectMarkers = () => {
      if (disposed) return;
      camera.getWorldDirection(_camDir);
      const list: ProjectedHotspot[] = hotspotsRef.current.map((h, index) => {
        const pt = sphericalDegToVector3(h.yaw, h.pitch, 20);
        _projVec.set(pt.x, pt.y, pt.z);
        const facing = _projVec.clone().normalize().dot(_camDir) > 0.15;
        _projVec.project(camera);
        const xPercent = (_projVec.x * 0.5 + 0.5) * 100;
        const yPercent = (-_projVec.y * 0.5 + 0.5) * 100;
        const inView =
          facing && xPercent >= 3 && xPercent <= 97 && yPercent >= 8 && yPercent <= 92;
        return {
          index,
          hotspot: h,
          xPercent,
          yPercent,
          visible: inView,
        };
      });
      setProjectedHotspots(list);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame((now) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastClock) / 1000));
        lastClock = now;
        renderDirty = false;

        const st = engineRef.current;
        if (autoRotateRef.current && !isSoftwareGl && !isDragging) {
          st.targetYaw = normalizeYawDeg(st.targetYaw + dt * 8);
        }

        // Smooth shortest-angle yaw damping
        let yawDiff = st.targetYaw - st.curYaw;
        if (yawDiff > 180) yawDiff -= 360;
        if (yawDiff < -180) yawDiff += 360;

        if (isSoftwareGl) {
          st.curYaw = st.targetYaw;
          st.curPitch = st.targetPitch;
          st.curFov = st.targetFov;
        } else {
          const factor = 1 - Math.exp(-14 * dt);
          st.curYaw = normalizeYawDeg(st.curYaw + yawDiff * factor);
          st.curPitch = THREE.MathUtils.lerp(st.curPitch, st.targetPitch, factor);
          st.curFov = THREE.MathUtils.lerp(st.curFov, st.targetFov, factor);
        }

        if (Math.abs(camera.fov - st.curFov) > 0.02) {
          camera.fov = st.curFov;
          camera.updateProjectionMatrix();
        }

        const look = sphericalDegToVector3(st.curYaw, st.curPitch, 10);
        camera.lookAt(look.x, look.y, look.z);
        renderer.render(scene, camera);
        projectMarkers();
        callbacksRef.current.onCameraChange?.(st.curYaw, st.curPitch, st.curFov);

        const stillMoving =
          !isSoftwareGl &&
          (Math.abs(yawDiff) > 0.05 ||
            Math.abs(st.targetPitch - st.curPitch) > 0.05 ||
            Math.abs(st.targetFov - st.curFov) > 0.05 ||
            autoRotateRef.current);

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || stillMoving)) {
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

    engineRef.current = {
      ...engineRef.current,
      renderer,
      scene,
      camera,
      sphereMesh,
      textureCache,
      requestRender,
      projectMarkers,
    };

    if (controlsApiRef) {
      controlsApiRef.current = {
        zoomIn: () => {
          engineRef.current.targetFov = Math.max(40, engineRef.current.targetFov - 10);
          requestRender();
        },
        zoomOut: () => {
          engineRef.current.targetFov = Math.min(100, engineRef.current.targetFov + 10);
          requestRender();
        },
        resetView: () => {
          engineRef.current.targetYaw = initialYaw;
          engineRef.current.targetPitch = initialPitch;
          engineRef.current.targetFov = defaultFov;
          requestRender();
        },
        lookAt: (yaw: number, pitch: number) => {
          engineRef.current.targetYaw = normalizeYawDeg(yaw);
          engineRef.current.targetPitch = clampPitchDeg(pitch);
          requestRender();
        },
      };
    }

    // Pointer + touch drag + pinch zoom handlers
    let isDragging = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let movedDistance = 0;
    let pinchStartDist = 0;
    let pinchStartFov = engineRef.current.targetFov;

    const canvas = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isDragging = true;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      movedDistance = 0;
      canvas.style.cursor = placementModeRef.current ? 'crosshair' : 'grabbing';
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      movedDistance += Math.hypot(dx, dy);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      const sensitivity = (engineRef.current.curFov / 75) * 0.22;
      engineRef.current.targetYaw = normalizeYawDeg(engineRef.current.targetYaw - dx * sensitivity);
      engineRef.current.targetPitch = clampPitchDeg(
        engineRef.current.targetPitch + dy * sensitivity
      );
      requestRender();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      canvas.style.cursor = placementModeRef.current ? 'crosshair' : 'grab';
      canvas.releasePointerCapture?.(e.pointerId);

      // Clean click on sphere in hotspot placement mode
      if (placementModeRef.current && movedDistance < 6) {
        const rect = canvas.getBoundingClientRect();
        _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_ndc, camera);
        const hits = _raycaster.intersectObject(sphereMesh, false);
        if (hits[0]) {
          const p = hits[0].point;
          const angles = vector3ToSphericalDeg(p.x, p.y, p.z);
          callbacksRef.current.onPlaceHotspot?.(angles.yaw, angles.pitch);
        } else {
          const angles = vector3ToSphericalDeg(
            _raycaster.ray.direction.x,
            _raycaster.ray.direction.y,
            _raycaster.ray.direction.z
          );
          callbacksRef.current.onPlaceHotspot?.(angles.yaw, angles.pitch);
        }
      }
      void pointerDownX;
      void pointerDownY;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * 0.04;
      engineRef.current.targetFov = Math.max(40, Math.min(100, engineRef.current.targetFov + delta));
      requestRender();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartFov = engineRef.current.targetFov;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = pinchStartDist / Math.max(20, dist);
        engineRef.current.targetFov = Math.max(40, Math.min(100, pinchStartFov * scale));
        requestRender();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(260, entry.contentRect.width);
      const h = Math.max(220, entry.contentRect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    requestRender();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      timers.forEach((t) => window.clearTimeout(t));
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      textureCache.forEach((tex) => tex.dispose());
      textureCache.clear();
      sphereGeo.dispose();
      sphereMat.dispose();
      renderer.dispose();
      if (controlsApiRef) {
        controlsApiRef.current = null;
      }
    };
  }, [controlsApiRef, defaultFov, initialPitch, initialYaw]);

  // Update cursor when toggling placement mode
  useEffect(() => {
    const canvas = engineRef.current.renderer?.domElement;
    if (canvas) {
      canvas.style.cursor = placementMode ? 'crosshair' : 'grab';
    }
  }, [placementMode]);

  // Load room panorama texture lazily with cache & adjacent room preloading
  useEffect(() => {
    const { renderer, sphereMesh, textureCache, requestRender } = engineRef.current;
    if (!renderer || !sphereMesh || !textureCache || !imageUrl) return;

    let cancelled = false;
    setLoadError(null);

    const applyTexture = (tex: THREE.Texture) => {
      if (cancelled) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      sphereMesh.material.map = tex;
      sphereMesh.material.needsUpdate = true;
      setLoading(false);
      requestRender?.();
    };

    const cached = textureCache.get(imageUrl);
    if (cached) {
      applyTexture(cached);
    } else {
      setLoading(true);
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        imageUrl,
        (tex) => {
          textureCache.set(imageUrl, tex);
          applyTexture(tex);
        },
        undefined,
        () => {
          if (cancelled) return;
          setLoading(false);
          setLoadError('Не удалось загрузить 360°-панораму. Проверьте доступность файла.');
        }
      );
    }

    // Lazy preload adjacent connected rooms in background
    if (preloadUrls.length > 0) {
      const preloader = new THREE.TextureLoader();
      preloader.setCrossOrigin('anonymous');
      preloadUrls.slice(0, 3).forEach((url) => {
        if (!url || textureCache.has(url)) return;
        preloader.load(url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          textureCache.set(url, tex);
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [imageUrl, preloadUrls]);

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      tabIndex={0}
      aria-label="Интерактивный 360°-просмотрщик: перетаскивайте мышью, пальцем или стрелками клавиатуры"
      onKeyDown={(e) => {
        const st = engineRef.current;
        if (e.key === 'ArrowLeft') {
          st.targetYaw = normalizeYawDeg(st.targetYaw - 12);
          st.requestRender?.();
        } else if (e.key === 'ArrowRight') {
          st.targetYaw = normalizeYawDeg(st.targetYaw + 12);
          st.requestRender?.();
        } else if (e.key === 'ArrowUp') {
          st.targetPitch = clampPitchDeg(st.targetPitch + 8);
          st.requestRender?.();
        } else if (e.key === 'ArrowDown') {
          st.targetPitch = clampPitchDeg(st.targetPitch - 8);
          st.requestRender?.();
        }
      }}
    >
      <div ref={mountRef} data-testid="three-panorama-canvas" className="h-full w-full" />

      {/* Projected 3D transition hotspots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {projectedHotspots.map(
          ({ index, hotspot, xPercent, yPercent, visible }) =>
            visible && (
              <button
                key={`${hotspot.fromRoomKey}-${hotspot.targetRoomKey}-${index}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHotspotClick?.(hotspot);
                }}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-label={`Перейти в комнату: ${hotspot.label}`}
                className="pointer-events-auto absolute inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/80 bg-[#143A30]/92 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#143A30]"
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-[#D4B483]" aria-hidden="true" />
                <span className="max-w-[160px] truncate">{hotspot.label}</span>
              </button>
            )
        )}
      </div>

      {loading && !loadError && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#111111]/75 text-white">
          <Compass className="h-7 w-7 text-[#D4B483]" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">{t.tour3d.modelLoading}</p>
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
