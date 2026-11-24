import * as THREE from 'three';

/** Broad, static tonal falloff across each deck slab; no repeating marks or bump map. */
export function createDeckMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.05 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec2 deckUv;\n' + shader.vertexShader.replace(
      '#include <uv_vertex>', '#include <uv_vertex>\n deckUv = uv;',
    );
    shader.fragmentShader = 'varying vec2 deckUv;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= mix(0.78, 1.06, 1.0 - smoothstep(0.0, 0.72, length(deckUv - 0.5)));',
    );
  };
  return material;
}

/** Matte ceramic: the base is darker, then opens into a soft satin shoulder. */
export function createBulkheadMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: '#656560', roughness: 0.86, metalness: 0.02 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying float bulkheadY;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n bulkheadY = position.y;',
    );
    shader.fragmentShader = 'varying float bulkheadY;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(0.55, 0.57, 0.58), vec3(1.04, 1.00, 0.93), smoothstep(-1.85, 1.6, bulkheadY));',
    ).replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n roughnessFactor -= 0.11 * smoothstep(-0.65, 1.8, bulkheadY);',
    );
  };
  return material;
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

  ctx.fillStyle = '#222423';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff0d8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = subtitle ? '700 46px system-ui' : '700 43px system-ui';
  ctx.fillText(text, 256, subtitle ? 48 : 65, 480);
  if (subtitle) {
    ctx.fillStyle = accentHex;
    ctx.font = '600 29px system-ui';
    ctx.fillText(subtitle, 256, 96, 480);
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

  ctx.fillStyle = '#232523';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = accentHex;
  ctx.font = '650 18px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ТЕРМИНАЛ', 16, 36);
  ctx.fillStyle = '#fff1dc';
  ctx.font = '700 25px system-ui';
  const words = label.split(' ');
  const middle = Math.ceil(words.length / 2);
  ctx.fillText(words.slice(0, middle).join(' '), 16, words.length > 1 ? 81 : 96, 224);
  if (words.length > 1) ctx.fillText(words.slice(middle).join(' '), 16, 112, 224);

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
