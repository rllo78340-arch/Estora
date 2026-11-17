import type * as THREE from 'three';

export function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const ok = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export function waitAfterDraw(
  renderer: THREE.WebGLRenderer,
  registerTimer: (id: number) => void,
  cb: () => void
) {
  const rawGl = renderer.getContext();
  const gl2 = rawGl as WebGL2RenderingContext;
  if (typeof gl2.fenceSync !== 'function') {
    const id = window.setTimeout(cb, 80);
    registerTimer(id);
    return;
  }

  const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) {
    const id = window.setTimeout(cb, 80);
    registerTimer(id);
    return;
  }
  gl2.flush();

  const poll = () => {
    const state = gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
    if (state === gl2.UNSIGNALED) {
      const id = window.setTimeout(poll, 5);
      registerTimer(id);
    } else {
      gl2.deleteSync(sync);
      const id = window.setTimeout(cb, 80);
      registerTimer(id);
    }
  };

  const id = window.setTimeout(poll, 5);
  registerTimer(id);
}

export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Не удалось прочитать изображение "${file.name}".`));
    };
    img.src = objectUrl;
  });
}
