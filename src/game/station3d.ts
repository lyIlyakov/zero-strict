import * as THREE from 'three';
import {
  CORRIDORS,
  DIRECTIONAL_SIGNS,
  ROOMS,
  ROOM_BY_ID,
  SOLID_OBSTACLES,
  TERMINALS,
  WALL_HEIGHT,
  WALL_SEGMENTS,
  type RoomDefinition,
  type SolidObstacle,
  type TerminalPoint,
} from '../../shared/mapData';
import { ROOM_LANDMARK_NAMES } from './dockLandmarks';
import type { SkinId } from '../../shared/types';
import { createCrewPuppet } from './crewPuppet';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createContactShadowTexture,
  createDeckMaterial,
  createBulkheadMaterial,
  createNameplateTexture,
  createSignTexture,
  createTerminalScreenTexture,
} from './textures';

export interface StationSceneHandles {
  root: THREE.Group;
  ceilingLightMaterials: THREE.MeshStandardMaterial[];
  roomLights: THREE.PointLight[];
  terminalMeshes: Map<string, THREE.Group>;
  animatedProps: Array<(elapsed: number, dt: number) => void>;
  setGate: (progress: number) => void;
  disposables: Array<{ dispose: () => void }>;
}

/**
 * Builds «Станция Каскад» 3D world directly from shared/mapData.ts so 3D geometry,
 * server collisions, and the Tab map are 100% mathematically synchronized.
 */
export function buildStation3D(anisotropy: number): StationSceneHandles {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const ceilingLightMaterials: THREE.MeshStandardMaterial[] = [];
  const roomLights: THREE.PointLight[] = [];
  const terminalMeshes = new Map<string, THREE.Group>();
  const animatedProps: Array<(elapsed: number, dt: number) => void> = [];

  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x303130, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x282a2a, roughness: 0.84 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x424645, roughness: 0.8 });
  const matteCrateMat = new THREE.MeshStandardMaterial({ color: 0x757769, roughness: 0.9 });
  const ochreMat = new THREE.MeshStandardMaterial({ color: 0xb38147, roughness: 0.83 });
  disposables.push(ceilingMat, trimMat, darkMetalMat, matteCrateMat, ochreMat);

  const sharedWallMat = createBulkheadMaterial();
  const sharedCorridorFloorMat = createDeckMaterial('#53514c');
  const sharedCorridorLightMat = new THREE.MeshStandardMaterial({
    color: 0xddd8cd,
    emissive: 0xab9e89,
    emissiveIntensity: 1.25,
    roughness: 0.25,
  });
  ceilingLightMaterials.push(sharedCorridorLightMat);
  disposables.push(sharedWallMat, sharedCorridorFloorMat, sharedCorridorLightMat);

  for (const room of ROOMS) {
    const w = room.bounds.x2 - room.bounds.x1;
    const d = room.bounds.z2 - room.bounds.z1;
    const cx = (room.bounds.x1 + room.bounds.x2) / 2;
    const cz = (room.bounds.z1 + room.bounds.z2) / 2;

    const floorMat = createDeckMaterial(new THREE.Color('#55524c').lerp(new THREE.Color(room.accentColor), 0.13));
    const floorGeo = new THREE.PlaneGeometry(w, d);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(cx, 0, cz);
    floorMesh.receiveShadow = true;
    root.add(floorMesh);
    disposables.push(floorMat, floorGeo);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(w, d);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(cx, WALL_HEIGHT, cz);
    root.add(ceilMesh);
    disposables.push(ceilGeo);

    // Broad, diffused ceiling fixture
    const lightStripMat = new THREE.MeshStandardMaterial({
      color: room.lightColor,
      emissive: new THREE.Color(room.lightColor).lerp(new THREE.Color(0x9d978b), 0.45),
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    ceilingLightMaterials.push(lightStripMat);
    disposables.push(lightStripMat);

    const stripGeo = new THREE.BoxGeometry(2.6, 0.1, 1.5);
    const stripMesh = new THREE.Mesh(stripGeo, lightStripMat);
    stripMesh.position.set(cx, WALL_HEIGHT - 0.05, cz);
    root.add(stripMesh);
    disposables.push(stripGeo);

    // Hanging overhead room nameplate (readable from both sides)
    addRoomOverheadSign(root, room, cx, cz, anisotropy, disposables);
  }

  // 2. Corridors: neutral slate deck plates, ceilings, and guide light strips (shared materials)
  for (const cor of CORRIDORS) {
    const w = cor.bounds.x2 - cor.bounds.x1;
    const d = cor.bounds.z2 - cor.bounds.z1;
    const cx = (cor.bounds.x1 + cor.bounds.x2) / 2;
    const cz = (cor.bounds.z1 + cor.bounds.z2) / 2;

    const fGeo = new THREE.PlaneGeometry(w, d);
    const fMesh = new THREE.Mesh(fGeo, sharedCorridorFloorMat);
    fMesh.rotation.x = -Math.PI / 2;
    fMesh.position.set(cx, 0, cz);
    fMesh.receiveShadow = true;
    root.add(fMesh);
    disposables.push(fGeo);

    const cGeo = new THREE.PlaneGeometry(w, d);
    const cMesh = new THREE.Mesh(cGeo, ceilingMat);
    cMesh.rotation.x = Math.PI / 2;
    cMesh.position.set(cx, WALL_HEIGHT, cz);
    root.add(cMesh);
    disposables.push(cGeo);

    const lGeo = new THREE.BoxGeometry(1.6, 0.08, 1.05);
    const lMesh = new THREE.Mesh(lGeo, sharedCorridorLightMat);
    lMesh.position.set(cx, WALL_HEIGHT - 0.05, cz);
    root.add(lMesh);
    disposables.push(lGeo);
  }

  // 3. Perimeter Walls from unified WALL_SEGMENTS (1 shared wall material!)
  const wallThickness = 0.32;
  for (const seg of WALL_SEGMENTS) {
    const length = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (length < 0.05) continue;
    const cx = (seg.x1 + seg.x2) / 2;
    const cz = (seg.z1 + seg.z2) / 2;

    const wGeo =
      seg.orientation === 'h'
        ? new THREE.BoxGeometry(length + wallThickness * 0.5, WALL_HEIGHT, wallThickness)
        : new THREE.BoxGeometry(wallThickness, WALL_HEIGHT, length + wallThickness * 0.5);
    const wMesh = new THREE.Mesh(wGeo, sharedWallMat);
    wMesh.position.set(cx, WALL_HEIGHT / 2, cz);
    wMesh.receiveShadow = true;
    root.add(wMesh);
    disposables.push(wGeo);

  }

  const setGate = addCommandGates(root, ochreMat, trimMat, disposables);

  // 4. Directional Corridor Wall Signs
  for (const sign of DIRECTIONAL_SIGNS) {
    const tex = createSignTexture(sign.text, sign.accent, anisotropy);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.43,
      roughness: 0.35,
    });
    const geo = new THREE.PlaneGeometry(3.35, 0.68);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sign.x, 3.15, sign.z);
    mesh.rotation.y = sign.yaw;
    root.add(mesh);
    disposables.push(tex, mat, geo);
  }

  // 5. Composite 3–12 Part Landmark Props inside each room (matching SOLID_OBSTACLES)
  for (const obs of SOLID_OBSTACLES) {
    const group = buildLandmarkProp(obs, darkMetalMat, matteCrateMat, ochreMat, disposables);
    root.add(group);
  }

  // 6. Interactive Terminal Consoles (grounded composite meshes)
  for (const term of TERMINALS) {
    const tGroup = buildTerminalProp(term, darkMetalMat, anisotropy, disposables);
    root.add(tGroup);
    terminalMeshes.set(term.id, tGroup);
  }

  // 7. Pooled dynamic PointLights (2 bright lights repositioned near the player within CPU/GPU budget)
  for (let i = 0; i < 2; i++) {
    const pl = new THREE.PointLight(0xdbeafe, 14, 28, 1.35);
    pl.position.set(0, 3.25, 0);
    root.add(pl);
    roomLights.push(pl);
  }

  return {
    root,
    ceilingLightMaterials,
    roomLights,
    terminalMeshes,
    animatedProps,
    setGate,
    disposables,
  };
}

function addCommandGates(
  root: THREE.Group,
  panel: THREE.MeshStandardMaterial,
  frame: THREE.MeshStandardMaterial,
  disposables: StationSceneHandles['disposables'],
): StationSceneHandles['setGate'] {
  // Each command exit is 4 m wide in shared/mapData. Door halves tuck into the adjoining walls.
  const { x1, x2, z1, z2 } = ROOM_BY_ID.command.bounds;
  const portals = [
    [0, z1, 0], [0, z2, Math.PI], [x1, 0, Math.PI / 2], [x2, 0, -Math.PI / 2],
  ];
  const lamp = new THREE.MeshStandardMaterial({ color: 0xe8cda0, emissive: 0xc9a47b, emissiveIntensity: 0.42 });
  disposables.push(lamp);
  const leaves: Array<{ node: THREE.Group; direction: number }> = [];
  for (const [x, z, yaw] of portals) {
    const portal = new THREE.Group();
    portal.position.set(x, 0, z);
    portal.rotation.y = yaw;
    const add = (node: THREE.Group, mat: THREE.Material, w: number, h: number, d: number, px: number, py: number, pz = 0) => {
      const geo = new RoundedBoxGeometry(w, h, d, 1, 0.055);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      node.add(mesh);
      disposables.push(geo);
    };
    add(portal, frame, 4.18, 0.52, 0.54, 0, 3.52);
    for (const direction of [-1, 1]) {
      add(portal, frame, 0.34, 3.5, 0.52, direction * 1.98, 1.75);
      add(portal, lamp, 0.22, 0.22, 0.12, direction * 1.98, 2.83, 0.28);
      const node = new THREE.Group();
      add(node, panel, 1.98, 3.3, 0.22, 0, 1.66);
      add(node, frame, 0.54, 0.34, 0.11, direction * -0.47, 1.42, 0.13);
      portal.add(node);
      leaves.push({ node, direction });
    }
    root.add(portal);
  }
  const setGate = (progress: number) => {
    const p = THREE.MathUtils.clamp(Number.isNaN(progress) ? 0 : progress, 0, 1);
    for (const { node, direction } of leaves) {
      node.position.x = direction * (0.99 + p * 2);
      node.visible = p < 1;
    }
  };
  setGate(1);
  return setGate;
}

function addRoomOverheadSign(
  root: THREE.Group,
  room: RoomDefinition,
  cx: number,
  cz: number,
  anisotropy: number,
  disposables: Array<{ dispose: () => void }>,
): void {
  const tex = createSignTexture(room.name.toUpperCase(), room.accentColor, anisotropy, ROOM_LANDMARK_NAMES[room.id]);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.52,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 });
  const signGeo = new THREE.PlaneGeometry(4.1, 0.94);
  const frameGeo = new THREE.BoxGeometry(4.22, 1.02, 0.1);

  const holder = new THREE.Group();
  const frame = new THREE.Mesh(frameGeo, frameMat);
  const front = new THREE.Mesh(signGeo, mat);
  front.position.z = 0.056;
  const back = new THREE.Mesh(signGeo, mat);
  back.position.z = -0.056;
  back.rotation.y = Math.PI;
  holder.add(frame, front, back);
  holder.position.set(cx, WALL_HEIGHT - 0.52, cz);
  if (room.id === 'reactor' || room.id === 'airlock') {
    holder.rotation.y = Math.PI / 2;
  }
  root.add(holder);
  disposables.push(tex, mat, frameMat, signGeo, frameGeo);
}

function buildLandmarkProp(
  obs: SolidObstacle,
  graphite: THREE.MeshStandardMaterial,
  enamel: THREE.MeshStandardMaterial,
  ochre: THREE.MeshStandardMaterial,
  disposables: StationSceneHandles['disposables'],
): THREE.Group {
  const g = new THREE.Group();
  const { x1, x2, z1, z2 } = obs.bounds;
  const w = x2 - x1;
  const d = z2 - z1;
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    disposables.push(geo);
    g.add(mesh);
    return mesh;
  };
  const box = (mat: THREE.Material, bw: number, h: number, depth: number, x: number, y: number, z: number) =>
    part(new RoundedBoxGeometry(bw, h, depth, 1, 0.09), mat, x, y, z);
  const color = (value: number, glow = 0) => {
    const mat = new THREE.MeshStandardMaterial({ color: value, roughness: 0.8, emissive: value, emissiveIntensity: glow });
    disposables.push(mat);
    return mat;
  };

  switch (obs.kind) {
    case 'table': {
      // Broad octagonal briefing desk with a single guarded emergency button.
      box(graphite, 1.33, 0.75, 1.1, 0, 0.38, 0);
      const top = part(new THREE.CylinderGeometry(1.53, 1.5, 0.15, 8), ochre, 0, 0.82, 0);
      top.scale.z = 0.74;
      box(graphite, 0.62, 0.08, 0.52, 0, 0.91, 0);
      part(new THREE.CylinderGeometry(0.21, 0.22, 0.1, 20), color(0xb6493d, 0.22), 0, 0.99, 0);
      break;
    }
    case 'core': {
      // Static ceramic pressure vessel, held in a hexagonal graphite frame.
      part(new THREE.CylinderGeometry(1.5, 1.64, 0.36, 12), graphite, 0, 0.18, 0);
      part(new THREE.CylinderGeometry(1.29, 1.17, 2.46, 12), ochre, 0, 1.63, 0);
      part(new THREE.CylinderGeometry(0.84, 1.48, 0.61, 12), graphite, 0, 3.13, 0);
      part(new THREE.CylinderGeometry(0.62, 0.77, 0.15, 12), color(0xcaa471, 0.28), 0, 3.51, 0);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const post = box(enamel, 0.28, 2.8, 0.32, 1.48 * Math.cos(angle), 1.67, 1.48 * Math.sin(angle));
        post.rotation.y = -angle;
      }
      break;
    }
    case 'hydro_tank': {
      box(graphite, w - 0.1, 0.55, d - 0.08, 0, 0.28, 0);
      box(color(0x596c54), w - 0.16, 0.18, d - 0.15, 0, 0.61, 0);
      const leaf = color(0x8a9b71);
      for (let i = -2; i <= 2; i++) {
        const stem = part(new THREE.SphereGeometry(0.4, 9, 6), leaf, i * 0.87, 0.82, 0);
        stem.scale.set(1.12, 0.76 + 0.06 * (i + 2), 1.2);
        const branch = part(new THREE.SphereGeometry(0.33, 9, 6), leaf, i * 0.87 - 0.16, 0.79, 0.35);
        branch.scale.set(1, 0.8, 1.05);
      }
      break;
    }
    case 'bed': {
      box(graphite, w - 0.09, 0.6, d - 0.09, 0, 0.3, 0);
      box(color(0x94ada6), w - 0.44, 0.23, d - 0.28, 0, 0.68, 0);
      const hood = part(new THREE.SphereGeometry(0.73, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), enamel, 0.59, 0.75, 0);
      hood.scale.set(1, 0.36, 0.98);
      break;
    }
    case 'crate': {
      box(graphite, w - 0.06, 0.22, d - 0.05, 0, 0.12, 0);
      box(ochre, w - 0.18, 0.87, d - 0.18, 0, 0.66, 0);
      box(enamel, w - 0.45, 0.85, d - 0.38, -0.11, 1.53, 0);
      box(graphite, 0.73, 0.21, 0.07, -0.11, 1.52, (d - 0.37) / 2);
      break;
    }
    case 'transformer': {
      box(graphite, w - 0.06, 0.78, d - 0.08, 0, 0.39, 0);
      for (const x of [-0.91, 0, 0.91]) {
        part(new THREE.CylinderGeometry(0.34, 0.39, 1.26, 12), enamel, x, 1.38, 0);
        part(new THREE.CylinderGeometry(0.22, 0.28, 0.21, 12), ochre, x, 1.97, 0);
      }
      break;
    }
    case 'rack': {
      box(graphite, w - 0.04, obs.height, d - 0.06, 0, obs.height / 2, 0);
      for (const x of [-0.53, 0.53]) {
        box(enamel, 0.91, 1.58, 0.14, x, 1.18, d / 2 - 0.11);
      }
      box(color(0x82a2a5, 0.25), 0.76, 0.31, 0.08, 0, 1.64, d / 2 - 0.03);
      break;
    }
    case 'console': {
      if (obs.roomId === 'airlock') {
        box(graphite, w - 0.08, 0.23, d - 0.14, 0, 0.13, 0);
        for (const x of [-0.64, 0.64]) {
          part(new THREE.CylinderGeometry(0.44, 0.51, 0.74, 12), ochre, x, 0.64, 0);
          part(new THREE.CylinderGeometry(0.29, 0.36, 0.21, 12), enamel, x, 1.09, 0);
        }
      } else {
        box(graphite, w - 0.38, 0.76, d - 0.31, 0, 0.4, 0);
        const visor = box(color(0x808ca5, 0.17), w - 0.12, 0.24, d - 0.22, 0, 0.93, 0);
        visor.rotation.x = -0.14;
      }
      break;
    }
  }
  return g;
}

function buildTerminalProp(
  term: TerminalPoint,
  darkMetalMat: THREE.MeshStandardMaterial,
  anisotropy: number,
  disposables: Array<{ dispose: () => void }>,
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(term.x, 0, term.z);
  g.rotation.y = term.yaw;

  // Command Hall emergency button already sits on the central table
  if (term.kind === 'emergency') {
    return g;
  }

  const accent =
    term.kind === 'lights'
      ? '#dfbd7f'
      : term.kind === 'sensor_echo'
        ? '#89b6b8'
        : '#d5ae75';

  const pedGeo = new THREE.BoxGeometry(0.86, 1.05, 0.42);
  const topGeo = new THREE.BoxGeometry(0.96, 0.56, 0.32);
  const screenGeo = new THREE.PlaneGeometry(0.82, 0.44);
  const beaconGeo = new RoundedBoxGeometry(0.19, 0.14, 0.12, 1, 0.035);

  const screenTex = createTerminalScreenTexture(term.label, accent, anisotropy);
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissiveMap: screenTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.15,
  });

  // The viewport owns status colors; this lens uses constant radiance, not its legacy pulse.
  beaconMat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      'totalEmissiveRadiance = diffuseColor.rgb * 0.58;');
  };

  const ped = new THREE.Mesh(pedGeo, darkMetalMat);
  ped.position.y = 0.525;
  const head = new THREE.Mesh(topGeo, darkMetalMat);
  head.position.set(0, 1.32, 0.04);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.34, 0.21);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0.34, 1.65, 0.16);
  beacon.name = 'terminal_beacon';

  g.add(ped, head, screen, beacon);
  disposables.push(pedGeo, topGeo, screenGeo, beaconGeo, screenTex, screenMat, beaconMat);
  return g;
}

export interface PlayerAvatarRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  shieldDome: THREE.Mesh;
  nameSprite: THREE.Sprite;
  color: string;
  dispose: () => void;
}

/** Four grounded crew silhouettes, sharing the same animation and gameplay rig. */
export function createPlayerAvatar(name: string, colorHex: string, skin: SkinId = 'standard'): PlayerAvatarRig {
  const group = new THREE.Group();
  const disposables: StationSceneHandles['disposables'] = [];
  const puppet = createCrewPuppet(skin, colorHex);

  // Keep the articulated legs' pivots at hip height so the existing walk cycle remains intact.
  for (const leg of [puppet.leftLeg, puppet.rightLeg]) {
    const pivotX = leg.position.x;
    leg.geometry.translate(-pivotX, -leg.position.y, -leg.position.z);
    leg.position.set(pivotX, 0.342, 0);
  }
  group.add(puppet.body, puppet.leftLeg, puppet.rightLeg);

  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), shadowMat);
  shadow.position.set(0, 0.02, 0);
  shadow.rotation.x = -Math.PI / 2;
  group.add(shadow);

  const shieldMat = new THREE.MeshStandardMaterial({
    color: '#79c2cd', emissive: '#27909d', emissiveIntensity: 0.55,
    transparent: true, opacity: 0.29, depthWrite: false, side: THREE.DoubleSide,
  });
  const shieldDome = new THREE.Mesh(new THREE.SphereGeometry(0.98, 20, 14), shieldMat);
  shieldDome.position.set(0, 0.95, 0);
  shieldDome.visible = false;
  shieldDome.renderOrder = 5;
  group.add(shieldDome);

  const nameTex = createNameplateTexture(name, colorHex);
  const nameMat = new THREE.SpriteMaterial({ map: nameTex, depthTest: true, transparent: true });
  const nameSprite = new THREE.Sprite(nameMat);
  nameSprite.scale.set(1.3, 0.34, 1);
  nameSprite.position.set(0, 2.08, 0);
  group.add(nameSprite);

  disposables.push(shadowTex, shadowMat, shadow.geometry, shieldMat, shieldDome.geometry, nameTex, nameMat);
  return {
    group,
    leftLeg: puppet.leftLeg,
    rightLeg: puppet.rightLeg,
    shieldDome,
    nameSprite,
    color: colorHex,
    dispose: () => {
      puppet.dispose();
      disposables.forEach((disposable) => disposable.dispose());
    },
  };
}

/**
 * Non-gory stasis beacon representing an eliminated crewmate (for reporting with R).
 */
export function createDownedBeaconMesh(colorHex: string): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const bodyGeo = new THREE.BoxGeometry(0.56, 0.34, 0.72);
  const helmGeo = new THREE.SphereGeometry(0.24, 12, 10);
  const ringGeo = new THREE.TorusGeometry(0.68, 0.04, 8, 24);
  const mastGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8);
  const orbGeo = new THREE.OctahedronGeometry(0.14, 0);

  const body = new THREE.Mesh(bodyGeo, suitMat);
  body.position.set(0, 0.17, 0);
  const helm = new THREE.Mesh(helmGeo, darkMat);
  helm.position.set(0, 0.24, -0.45);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  const mast = new THREE.Mesh(mastGeo, darkMat);
  mast.position.set(0, 0.6, 0);
  const orb = new THREE.Mesh(orbGeo, ringMat);
  orb.position.set(0, 1.08, 0);

  group.add(body, helm, ring, mast, orb);

  return {
    group,
    dispose: () => {
      suitMat.dispose();
      darkMat.dispose();
      ringMat.dispose();
      bodyGeo.dispose();
      helmGeo.dispose();
      ringGeo.dispose();
      mastGeo.dispose();
      orbGeo.dispose();
    },
  };
}
