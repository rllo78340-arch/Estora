import * as THREE from 'three';

export interface MaterialOptions {
  color: string;
  materialType: string;
  isUltra4K?: boolean;
  isSoftwareGl?: boolean;
  repeatX?: number;
  repeatY?: number;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateCanvasTexture(
  key: string,
  size: number,
  drawFn: (ctx: CanvasRenderingContext2D, size: number) => void,
  isColorMap = true,
  repeatX = 2,
  repeatY = 2
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const cacheKey = `${key}_${size}_${repeatX}_${repeatY}_${isColorMap ? 'srgb' : 'lin'}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawFn(ctx, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  textureCache.set(cacheKey, tex);
  return tex;
}

export function createParquetTexture(baseHex: string, isUltra = false, repeatX = 4, repeatY = 4): THREE.CanvasTexture | null {
  const size = isUltra ? 512 : 256;
  return getOrCreateCanvasTexture(
    `parquet_${baseHex}`,
    size,
    (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);
      const planks = 8;
      const plankH = s / planks;
      const plankW = s / 2;
      for (let r = 0; r < planks; r++) {
        for (let c = 0; c < 2; c++) {
          const offset = (r % 2) * (plankW / 2);
          const x = (c * plankW + offset) % s;
          const y = r * plankH;
          const shade = ((r * 3 + c * 7) % 5) * 4 - 8;
          ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade / 255})` : `rgba(0,0,0,${-shade / 255})`;
          ctx.fillRect(x, y, plankW - 2, plankH - 2);

          // Wood grain lines
          ctx.strokeStyle = 'rgba(40,22,8,0.14)';
          ctx.lineWidth = 1;
          for (let g = 1; g < 4; g++) {
            ctx.beginPath();
            ctx.moveTo(x + 2, y + (plankH * g) / 4);
            ctx.bezierCurveTo(
              x + plankW * 0.3,
              y + (plankH * g) / 4 + 2,
              x + plankW * 0.7,
              y + (plankH * g) / 4 - 2,
              x + plankW - 4,
              y + (plankH * g) / 4
            );
            ctx.stroke();
          }

          // Plank seam
          ctx.strokeStyle = 'rgba(20,12,5,0.32)';
          ctx.strokeRect(x, y, plankW, plankH);
        }
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createMarbleTexture(baseHex: string, isUltra = false, repeatX = 3, repeatY = 3): THREE.CanvasTexture | null {
  const size = isUltra ? 512 : 256;
  return getOrCreateCanvasTexture(
    `marble_${baseHex}`,
    size,
    (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);

      // Subtle tile grid
      ctx.strokeStyle = 'rgba(120,118,112,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, s - 2, s - 2);
      ctx.beginPath();
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s / 2, s);
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.stroke();

      // Organic marble veins
      const veins = 7;
      for (let i = 0; i < veins; i++) {
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(130,125,118,0.24)' : 'rgba(180,165,140,0.18)';
        ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.1;
        ctx.beginPath();
        const startY = (s / veins) * i;
        ctx.moveTo(0, startY);
        ctx.bezierCurveTo(s * 0.3, startY + 28, s * 0.65, startY - 24, s, (startY + 45) % s);
        ctx.stroke();
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createCeramicTileTexture(baseHex: string, groutHex = '#C8C4BC', repeatX = 6, repeatY = 6): THREE.CanvasTexture | null {
  return getOrCreateCanvasTexture(
    `tile_${baseHex}_${groutHex}`,
    256,
    (ctx, s) => {
      ctx.fillStyle = groutHex;
      ctx.fillRect(0, 0, s, s);
      const cells = 4;
      const cell = s / cells;
      const gap = 3;
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          ctx.fillStyle = baseHex;
          ctx.fillRect(c * cell + gap, r * cell + gap, cell - gap * 2, cell - gap * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(c * cell + gap + 2, r * cell + gap + 2, cell - gap * 2 - 8, 4);
        }
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createBrickOrStoneTexture(baseHex: string, mortarHex = '#DCD7CD', repeatX = 6, repeatY = 3): THREE.CanvasTexture | null {
  return getOrCreateCanvasTexture(
    `brick_${baseHex}_${mortarHex}`,
    256,
    (ctx, s) => {
      ctx.fillStyle = mortarHex;
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const cols = 4;
      const rowH = s / rows;
      const colW = s / cols;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (colW / 2);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const y = r * rowH;
          ctx.fillStyle = baseHex;
          ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
          ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
        }
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createFabricWeaveTexture(baseHex: string, repeatX = 4, repeatY = 4): THREE.CanvasTexture | null {
  return getOrCreateCanvasTexture(
    `fabric_${baseHex}`,
    128,
    (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 0; y < s; y += 4) {
        ctx.fillRect(0, y, s, 1);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let x = 0; x < s; x += 4) {
        ctx.fillRect(x, 0, 1, s);
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createRoofTileTexture(baseHex = '#3D3530', repeatX = 8, repeatY = 5): THREE.CanvasTexture | null {
  return getOrCreateCanvasTexture(
    `rooftile_${baseHex}`,
    256,
    (ctx, s) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, s, s);
      const rows = 6;
      const cols = 6;
      const rH = s / rows;
      const cW = s / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * cW;
          const y = r * rH;
          const grad = ctx.createLinearGradient(x, y, x + cW, y + rH);
          grad.addColorStop(0, 'rgba(255,255,255,0.12)');
          grad.addColorStop(0.5, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.28)');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y + 1, cW - 2, rH - 2);
          ctx.strokeStyle = 'rgba(15,12,10,0.45)';
          ctx.strokeRect(x, y, cW, rH);
        }
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createGrassLawnTexture(repeatX = 10, repeatY = 10): THREE.CanvasTexture | null {
  return getOrCreateCanvasTexture(
    'grass_lawn',
    256,
    (ctx, s) => {
      ctx.fillStyle = '#3F6E43';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 420; i++) {
        const x = (i * 73) % s;
        const y = (i * 137) % s;
        ctx.fillStyle = i % 3 === 0 ? '#4D8251' : i % 3 === 1 ? '#335B37' : '#588E5B';
        ctx.fillRect(x, y, 3, 6);
      }
    },
    true,
    repeatX,
    repeatY
  );
}

export function createPBRMaterial(options: MaterialOptions): THREE.Material {
  const { color, materialType, isUltra4K = false, isSoftwareGl = false, repeatX = 2, repeatY = 2 } = options;

  switch (materialType) {
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color || '#DCEEF8'),
        roughness: 0.06,
        metalness: 0.05,
        transmission: isSoftwareGl ? 0 : 0.88,
        transparent: true,
        opacity: isSoftwareGl ? 0.38 : 0.92,
        ior: 1.5,
        reflectivity: 0.9,
      });

    case 'brass':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color || '#D4B483'),
        roughness: 0.24,
        metalness: 0.88,
      });

    case 'metal':
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color || '#C8CDD2'),
        roughness: 0.22,
        metalness: 0.85,
      });

    case 'marble':
    case 'stone': {
      const map = createMarbleTexture(color || '#F2EFE9', isUltra4K, repeatX, repeatY);
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFFFFF'),
        map: map ?? undefined,
        roughness: 0.18,
        metalness: 0.04,
        clearcoat: isSoftwareGl ? 0 : 0.45,
        clearcoatRoughness: 0.15,
      });
    }

    case 'ceramic': {
      const map = createCeramicTileTexture(color || '#FFFFFF', '#D2CEC6', repeatX, repeatY);
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFFFFF'),
        map: map ?? undefined,
        roughness: 0.14,
        metalness: 0.02,
        clearcoat: isSoftwareGl ? 0 : 0.6,
        clearcoatRoughness: 0.1,
      });
    }

    case 'wood':
    case 'oak':
    case 'walnut': {
      const map = createParquetTexture(
        color || (materialType === 'walnut' ? '#4A3525' : '#8B5A2B'),
        isUltra4K,
        repeatX,
        repeatY
      );
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFFFFF'),
        map: map ?? undefined,
        roughness: materialType === 'walnut' ? 0.34 : 0.42,
        metalness: 0.05,
      });
    }

    case 'velvet':
    case 'fabric':
    case 'wool': {
      const map = createFabricWeaveTexture(color || '#2F3E46', repeatX * 2, repeatY * 2);
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#FFFFFF'),
        map: map ?? undefined,
        roughness: materialType === 'velvet' ? 0.72 : 0.85,
        metalness: 0.0,
        sheen: isSoftwareGl ? 0 : 0.55,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color(color || '#FFFFFF').offsetHSL(0, 0, 0.15),
      });
    }

    case 'brick': {
      const map = createBrickOrStoneTexture(color || '#A65E46', '#DDD6CA', repeatX, repeatY);
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color('#FFFFFF'),
        map: map ?? undefined,
        roughness: 0.82,
        metalness: 0.02,
      });
    }

    default:
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color || '#EAE6DF'),
        roughness: 0.65,
        metalness: 0.04,
      });
  }
}
