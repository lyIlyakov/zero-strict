import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { PLAYER_EYE_HEIGHT, ROOM_BY_ID } from '../../shared/mapData';
import { buildStation3D, createPlayerAvatar } from './station3d';

// Only the drawing surface is stubbed; the scene and ray intersections use Three.js.
function withCanvas(run: () => void) {
  const context = {
    fillRect() {}, fillText() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {},
    moveTo() {}, lineTo() {}, stroke() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ getContext: () => context }) },
  });
  try {
    run();
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else Reflect.deleteProperty(globalThis, 'document');
  }
}

test('the command gates block all four thresholds only while closed', () => withCanvas(() => {
  const station = buildStation3D(1);
  const { x2, z2 } = ROOM_BY_ID.command.bounds;
  try {
    const obstruction = (dx: number, dz: number, side = 0) => {
      station.root.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(
        new THREE.Vector3(dx * 2 + dz * side, PLAYER_EYE_HEIGHT, dz * 2 + dx * side),
        new THREE.Vector3(dx, 0, dz), 0, (dx ? x2 : z2) - 1.5,
      );
      return ray.intersectObject(station.root, true).length > 0;
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      station.setGate(-1);
      assert.equal(obstruction(dx, dz), true);
      station.setGate(0.5);
      assert.equal(obstruction(dx, dz), false);
      assert.equal(obstruction(dx, dz, 1.45), true);
      station.setGate(2);
      assert.equal(obstruction(dx, dz, 1.45), false);
    }
  } finally {
    station.disposables.forEach((asset) => asset.dispose());
  }
}));

test('each suit presents a distinct silhouette at the same player scale', () => withCanvas(() => {
  const suits = (['standard', 'survey', 'salvage', 'medic'] as const)
    .map((skin) => createPlayerAvatar('Тест', '#abb077', skin));
  try {
    const silhouettes = suits.map(({ group }) => {
      group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      const meshes: THREE.Mesh[] = [];
      group.traverse((node) => { if (node instanceof THREE.Mesh && node.visible) meshes.push(node); });
      let shape = '';
      for (const z of [-2.5, 2.5]) {
        for (let y = 0.08; y < 1.99; y += 0.055) {
          for (let x = -0.53; x <= 0.53; x += 0.035) {
            ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -Math.sign(z)));
            const hit = ray.intersectObjects(meshes, false)[0];
            shape += hit ? '1' : '0';
          }
        }
      }
      return shape;
    });
    assert.equal(new Set(silhouettes).size, 4);
    assert.ok(suits.every(({ leftLeg, rightLeg, shieldDome }) => leftLeg !== rightLeg && !shieldDome.visible));
  } finally {
    suits.forEach((rig) => rig.dispose());
  }
}));

test('crew face, skin-color details, and role gear use the specified palette', () => withCanvas(() => {
  const expectedGear: Record<'standard' | 'survey' | 'salvage' | 'medic', string[]> = {
    standard: ['#3f527a', '#e7ab50'], // blue cap, honey scarf
    survey: ['#66506b', '#78c4bb', '#292438'], // plum flight cap/earcups, teal goggles
    salvage: ['#e8a94c', '#f7c76e', '#d38c65'], // ochre hardhat, crest, copper apron
    medic: ['#fff3d9', '#529a90', '#eaddbf'], // cream cap, teal band, coat
  };
  const skins = ['standard', 'survey', 'salvage', 'medic'] as const;
  const playerColor = '#abb077';
  const rigs = skins.map((skin) => createPlayerAvatar('Тест', playerColor, skin));
  const linear = (hex: string) => new THREE.Color(hex);
  try {
    rigs.forEach((rig, index) => {
      const skin = skins[index];
      const body = rig.group.children.find((child): child is THREE.Mesh =>
        child instanceof THREE.Mesh && child.geometry.getAttribute('color') !== undefined,
      );
      assert.ok(body, `${skin} should use the colored crew puppet mesh`);
      const positions = body.geometry.getAttribute('position');
      const colors = body.geometry.getAttribute('color');
      const hasColorIn = (hex: string, test: (x: number, y: number, z: number) => boolean) => {
        const target = linear(hex);
        for (let i = 0; i < positions.count; i++) {
          const colorMatches = Math.abs(colors.getX(i) - target.r) < 0.015
            && Math.abs(colors.getY(i) - target.g) < 0.015
            && Math.abs(colors.getZ(i) - target.b) < 0.015;
          if (colorMatches && test(positions.getX(i), positions.getY(i), positions.getZ(i))) return true;
        }
        return false;
      };
      const faceZone = (x: number, y: number, z: number) => Math.abs(x) < 0.44 && y > 1.2 && y < 1.68 && z < -0.12;
      assert.ok(hasColorIn(playerColor, (x, y) => y > 1.15 || (y > 0.65 && y < 0.95 && Math.abs(x) > 0.25)), `${skin} head and hands should match player color`);
      for (const faceColor of ['#fff3d9', '#292438', '#ed816c']) {
        assert.ok(hasColorIn(faceColor, faceZone), `${skin} face should include ${faceColor}`);
      }
      for (const gearColor of expectedGear[skin]) {
        assert.ok(hasColorIn(gearColor, (_x, y) => y > 0.55), `${skin} should include gear color ${gearColor}`);
      }
    });
  } finally {
    rigs.forEach((rig) => rig.dispose());
  }
}));
