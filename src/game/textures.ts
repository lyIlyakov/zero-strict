import * as THREE from 'three';

/**
 * 100% procedural CanvasTexture generators for «Станция Каскад».
 * Zero external image/model URLs; proper SRGBColorSpace & max anisotropy.
 */
export function createDeckFloorTexture(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  ctx.fillStyle = '#39475c';
  ctx.fillRect(0, 0, size, size);

  // Brushed industrial metal plates & rivets
  ctx.strokeStyle = '#202a38';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.strokeStyle = '#4f627d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();

  // Subtle traction diamonds
  ctx.fillStyle = '#475870';
  for (let y = 24; y < size; y += 32) {
    for (let x = 24; x < size; x += 32) {
      ctx.fillRect(x - 3, y - 1, 6, 2);
    }
  }

  // Corner bolts
  ctx.fillStyle = '#64748b';
  const bolts = [
    [14, 14],
    [size - 14, 14],
    [14, size - 14],
    [size - 14, size - 14],
  ];
  for (const [bx, by] of bolts) {
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;

  // Grayscale bump map (linear colorSpace)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  bctx.strokeStyle = '#202020';
  bctx.lineWidth = 5;
  bctx.strokeRect(2, 2, size - 4, size - 4);
  bctx.fillStyle = '#b5b5b5';
  for (let y = 24; y < size; y += 32) {
    for (let x = 24; x < size; x += 32) {
      bctx.fillRect(x - 3, y - 1, 6, 2);
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = anisotropy;

  return { map, bumpMap };
}

export function createWallPanelTexture(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Upper matte ceramic-composite bulkhead
  ctx.fillStyle = '#52647e';
  ctx.fillRect(0, 0, w, h);

  // Lower armored kick-plate
  ctx.fillStyle = '#2e3b4e';
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // Horizontal technical groove & bright safety stripe
  ctx.fillStyle = '#1b2432';
  ctx.fillRect(0, h * 0.63, w, 12);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, h * 0.65, w, 4);

  // Vertical seam lines
  ctx.strokeStyle = '#263345';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(2, h);
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  // Recessed vent louvers
  ctx.fillStyle = '#344257';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(28, 34 + i * 12, 72, 5);
    ctx.fillRect(156, 34 + i * 12, 72, 5);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = anisotropy;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = w;
  bCanvas.height = h;
  const bctx = bCanvas.getContext('2d')!;
  bctx.fillStyle = '#888888';
  bctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#303030';
  bctx.fillRect(0, h * 0.64, w, 10);
  bctx.fillRect(0, 0, 4, h);
  bctx.fillRect(w / 2 - 2, 0, 4, h);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = anisotropy;

  return { map, bumpMap };
}

export function createSignTexture(
  text: string,
  accentHex: string,
  anisotropy: number,
  subtitle?: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, 512, 128);

  // Accent top and bottom trim bars
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 118, 512, 10);

  // Crisp subtle border
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 14, 504, 100);

  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = subtitle
    ? '700 40px "Exo 2", sans-serif'
    : '700 32px "Exo 2", sans-serif';
  ctx.fillText(text, 256, subtitle ? 52 : 64, 480);

  if (subtitle) {
    ctx.fillStyle = accentHex;
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText(subtitle, 256, 94, 480);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createTerminalScreenTexture(
  label: string,
  accentHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#09111c';
  ctx.fillRect(0, 0, 256, 160);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 256, 22);

  // Diagnostic bars
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(16, 82 + i * 16, 224, 8);
  }
  ctx.fillStyle = accentHex;
  ctx.fillRect(16, 82, 150, 8);
  ctx.fillRect(16, 98, 192, 8);
  ctx.fillRect(16, 114, 118, 8);
  ctx.fillRect(16, 130, 175, 8);

  ctx.fillStyle = '#eef2f7';
  ctx.font = '700 18px "Exo 2", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 24), 16, 52, 224);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createNameplateTexture(name: string, colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(10, 14, 21, 0.85)';
  ctx.fillRect(8, 8, 240, 48);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 240, 48);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 24px "Manrope", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 16), 128, 33, 224);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
