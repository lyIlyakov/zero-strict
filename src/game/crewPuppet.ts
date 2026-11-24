import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SkinId } from '../../shared/types';

const INK = '#292438';
const CREAM = '#fff3d9';
const CORAL = '#ed816c';
const WORKWEAR = {
  standard: { coat: '#405779', lapel: '#e7ab50', boots: '#39364b' },
  survey: { coat: '#645276', lapel: '#78c4bb', boots: '#413546' },
  salvage: { coat: '#ab6449', lapel: '#e4ad57', boots: '#45362f' },
  medic: { coat: '#448a84', lapel: '#eaddbf', boots: '#344b51' },
} satisfies Record<SkinId, { coat: string; lapel: string; boots: string }>;

type Triple = [number, number, number];

/** Цвет записан в вершины: все детали куклы укладываются в три непрозрачных вызова отрисовки. */
function makeBatch(material: THREE.Material) {
  const parts: THREE.BufferGeometry[] = [];
  const put = (shape: THREE.BufferGeometry, hex: string, at: Triple, size: Triple, roll = 0) => {
    shape.deleteAttribute('uv');
    shape.scale(...size).rotateZ(roll).translate(...at);
    const { r, g, b } = new THREE.Color(hex);
    const colors = new Float32Array(shape.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
    }
    shape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(shape);
  };
  return {
    oval(hex: string, at: Triple, size: Triple, roll = 0) {
      put(new THREE.SphereGeometry(0.5, 16, 10), hex, at, size, roll);
    },
    turned(hex: string, at: Triple, profile: Array<[number, number]>, depth = 1) {
      put(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24), hex, at, [1, 1, depth]);
    },
    finish() {
      const geometry = mergeGeometries(parts)!;
      parts.forEach((part) => part.dispose());
      return new THREE.Mesh(geometry, material);
    },
  };
}

/** Кукла смотрит вдоль −Z, как камера и сетевой yaw. Начало координат — между подошвами. */
export function createCrewPuppet(skin: SkinId, playerColor: string) {
  const cloth = WORKWEAR[skin];
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const batch = makeBatch(material);
  const { oval, turned } = batch;
  const wide = skin === 'salvage' ? 1.12 : skin === 'survey' ? 0.92 : 1;

  // Округлый подол, высокая талия и узкие плечи: туловище не похоже на скафандр.
  turned(cloth.coat, [0, 0, 0], [[0, 0.34], [0.21 * wide, 0.34], [0.286 * wide, 0.39],
    [0.296 * wide, 0.51], [0.239 * wide, 0.91], [0.20, 1.07], [0.13, 1.13], [0, 1.13]], 0.80);
  turned(cloth.lapel, [0, 0, 0], [[0, 1.021], [0.208, 1.021], [0.215, 1.056], [0.155, 1.112], [0, 1.112]], 0.86);

  // Большая голова, белки и брови читаются на дистанции без светящихся материалов.
  oval(playerColor, [0, 1.4, 0], [0.757 * wide, 0.74, 0.655]);
  for (const side of [-1, 1]) {
    const x = side * 0.144;
    const lift = side === 1 && skin !== 'salvage' ? 0.016 : 0;
    oval(CREAM, [x, 1.438 + lift, -0.274], [0.29, 0.326, 0.196], side * -0.08);
    oval(INK, [x + 0.018, 1.444 + lift, -0.363], [0.133, 0.168, 0.049]);
    oval(INK, [side * 0.153, 1.615 + lift, -0.259], [0.246, 0.083, 0.102], side * (skin === 'salvage' ? 0.16 : -0.12));
  }
  oval(CORAL, [0, 1.316, -0.321], [0.165, 0.105, 0.119]);
  oval(INK, [-0.017, 1.226, -0.278], [0.085, 0.045, 0.048], 0.14);

  // Между рукавом и варежкой оставлен просвет, пальцы образуют цельный силуэт.
  for (const side of [-1, 1]) {
    const x = side * (0.335 * wide + 0.082);
    const y = side === 1 ? 0.78 : 0.82;
    oval(cloth.coat, [side * 0.235 * wide, 0.936, 0.014], [0.186, 0.246, 0.212], side * 0.49);
    oval(playerColor, [x, y, -0.118], [0.211, 0.226, 0.195], side * -0.22);
    oval(playerColor, [x - side * 0.079, y + 0.054, -0.16], [0.099, 0.13, 0.126], side * -0.45);
  }

  if (skin === 'standard') {
    oval('#3f527a', [0, 1.697, 0.014], [0.711, 0.276, 0.634], 0.065);
    oval('#354662', [0, 1.695, -0.207], [0.67, 0.066, 0.462], 0.035);
    oval(cloth.lapel, [-0.095, 0.979, -0.159], [0.105, 0.216, 0.082], -0.48);
    oval(cloth.lapel, [0.135, 1.029, 0.095], [0.122, 0.126, 0.094]);
  } else if (skin === 'survey') {
    const plum = '#66506b';
    oval(plum, [0, 1.68, 0.019], [0.67, 0.289, 0.616]);
    for (const side of [-1, 1]) {
      oval(plum, [side * 0.296, 1.52, 0.047], [0.163, 0.357, 0.271], -side * 0.19);
      oval(cloth.lapel, [side * 0.352, 1.53, 0.035], [0.091, 0.187, 0.18]);
      oval(INK, [side * 0.12, 1.747, -0.213], [0.218, 0.152, 0.144]);
      oval(cloth.lapel, [side * 0.12, 1.751, -0.267], [0.163, 0.102, 0.077]);
    }
    oval('#90745f', [0.158, 0.70, 0.171], [0.338, 0.324, 0.184], -0.19);
  } else if (skin === 'salvage') {
    const gold = '#e8a94c';
    oval(gold, [0, 1.691, 0.019], [0.827, 0.333, 0.69]);
    oval('#c58945', [0, 1.659, -0.023], [0.918, 0.089, 0.775]);
    oval('#f7c76e', [0, 1.744, 0.015], [0.122, 0.276, 0.604]);
    oval('#d38c65', [0, 0.666, -0.164], [0.397, 0.541, 0.106]);
    for (const side of [-1, 1]) oval('#6a5149', [side * 0.121, 0.827, 0.147], [0.069, 0.454, 0.095], side * 0.45);
  } else {
    turned(CREAM, [0, 1.645, 0.017], [[0, 0], [0.328, 0], [0.338, 0.055], [0.297, 0.145], [0.218, 0.171], [0, 0.171]], 0.91);
    turned('#529a90', [0, 1.655, 0.017], [[0.333, 0], [0.339, 0.036]], 0.917);
    oval('#d8cfb9', [-0.201, 0.638, 0.168], [0.267, 0.31, 0.185], 0.1);
    oval(cloth.lapel, [-0.07, 0.966, -0.162], [0.084, 0.202, 0.055], -0.51);
  }

  const leg = (side: number) => {
    const limb = makeBatch(material);
    limb.oval(cloth.boots, [0, -0.098, 0], [0.179 * wide, 0.307, 0.187]);
    limb.oval(cloth.boots, [0, -0.253, -0.049], [0.221 * wide, 0.172, 0.32]);
    const mesh = limb.finish();
    mesh.position.set(side * 0.132 * wide, 0.342, 0);
    return mesh;
  };
  const body = batch.finish();
  const leftLeg = leg(-1);
  const rightLeg = leg(1);
  return { body, leftLeg, rightLeg, dispose() {
    body.geometry.dispose(); leftLeg.geometry.dispose(); rightLeg.geometry.dispose(); material.dispose();
  } };
}
