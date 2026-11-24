import * as THREE from 'three';
import {
  CORRIDORS,
  DIRECTIONAL_SIGNS,
  ROOMS,
  SOLID_OBSTACLES,
  TERMINALS,
  WALL_HEIGHT,
  WALL_SEGMENTS,
  type RoomDefinition,
  type SolidObstacle,
  type TerminalPoint,
} from '../../shared/mapData';
import {
  createContactShadowTexture,
  createDeckFloorTexture,
  createNameplateTexture,
  createSignTexture,
  createTerminalScreenTexture,
  createWallPanelTexture,
} from './textures';

export interface StationSceneHandles {
  root: THREE.Group;
  ceilingLightMaterials: THREE.MeshStandardMaterial[];
  roomLights: THREE.PointLight[];
  terminalMeshes: Map<string, THREE.Group>;
  animatedProps: Array<(elapsed: number, dt: number) => void>;
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

  const floorTex = createDeckFloorTexture(anisotropy);
  const wallTex = createWallPanelTexture(anisotropy);
  disposables.push(floorTex.map, floorTex.bumpMap, wallTex.map, wallTex.bumpMap);

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x161d29,
    roughness: 0.82,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x101620,
    roughness: 0.4,
    metalness: 0.65,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1d2635,
    roughness: 0.35,
    metalness: 0.72,
  });
  const matteCrateMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.78,
    metalness: 0.15,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  disposables.push(ceilingMat, trimMat, darkMetalMat, matteCrateMat, glassMat);

  const sharedWallMat = new THREE.MeshStandardMaterial({
    color: 0xe2eaf5,
    map: wallTex.map,
    bumpMap: wallTex.bumpMap,
    bumpScale: 0.04,
    roughness: 0.58,
    metalness: 0.25,
  });
  const sharedCorridorFloorMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.04,
    roughness: 0.62,
    metalness: 0.28,
  });
  const sharedCorridorLightMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x93c5fd,
    emissiveIntensity: 1.25,
    roughness: 0.25,
  });
  ceilingLightMaterials.push(sharedCorridorLightMat);
  disposables.push(sharedWallMat, sharedCorridorFloorMat, sharedCorridorLightMat);

  function scalePlaneUVs(geo: THREE.PlaneGeometry, repX: number, repY: number) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * repX, uv.getY(i) * repY);
    }
    uv.needsUpdate = true;
  }

  function scaleBoxHorizontalUVs(geo: THREE.BoxGeometry, repX: number) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setX(i, uv.getX(i) * repX);
    }
    uv.needsUpdate = true;
  }

  // 1. Rooms: tinted floor plates, ceiling slabs, overhead room banners, and ceiling light strips
  for (const room of ROOMS) {
    const w = room.bounds.x2 - room.bounds.x1;
    const d = room.bounds.z2 - room.bounds.z1;
    const cx = (room.bounds.x1 + room.bounds.x2) / 2;
    const cz = (room.bounds.z1 + room.bounds.z2) / 2;

    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(room.floorTint).lerp(new THREE.Color('#ffffff'), 0.68),
      map: floorTex.map,
      bumpMap: floorTex.bumpMap,
      bumpScale: 0.04,
      roughness: 0.58,
      metalness: 0.3,
    });
    const floorGeo = new THREE.PlaneGeometry(w, d);
    scalePlaneUVs(floorGeo, w / 2.5, d / 2.5);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(cx, 0, cz);
    floorMesh.receiveShadow = true;
    root.add(floorMesh);
    disposables.push(floorMat, floorGeo);

    // Colored floor perimeter border inlay (y = 0.02 to prevent Z-fighting)
    const accentMat = new THREE.MeshStandardMaterial({
      color: room.accentColor,
      emissive: room.accentColor,
      emissiveIntensity: 0.75,
      roughness: 0.32,
      metalness: 0.25,
    });
    disposables.push(accentMat);

    const borderStripH = new THREE.BoxGeometry(w - 0.8, 0.02, 0.14);
    const bNorth = new THREE.Mesh(borderStripH, accentMat);
    bNorth.position.set(cx, 0.02, room.bounds.z1 + 0.55);
    const bSouth = new THREE.Mesh(borderStripH, accentMat);
    bSouth.position.set(cx, 0.02, room.bounds.z2 - 0.55);
    root.add(bNorth, bSouth);
    disposables.push(borderStripH);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(w, d);
    const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMat);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.set(cx, WALL_HEIGHT, cz);
    root.add(ceilMesh);
    disposables.push(ceilGeo);

    // Overhead emissive light strip
    const lightStripMat = new THREE.MeshStandardMaterial({
      color: room.lightColor,
      emissive: room.lightColor,
      emissiveIntensity: 1.5,
      roughness: 0.25,
    });
    ceilingLightMaterials.push(lightStripMat);
    disposables.push(lightStripMat);

    const stripGeo = new THREE.BoxGeometry(Math.min(w * 0.58, 5.4), 0.08, 0.48);
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
    scalePlaneUVs(fGeo, Math.max(1, w / 2.5), Math.max(1, d / 2.5));
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

    const isHorizontal = w >= d;
    const lGeo = new THREE.BoxGeometry(
      isHorizontal ? Math.min(w * 0.6, 5.5) : 0.3,
      0.08,
      isHorizontal ? 0.3 : Math.min(d * 0.6, 5.5),
    );
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
    scaleBoxHorizontalUVs(wGeo, Math.max(1, length / 3.2));
    const wMesh = new THREE.Mesh(wGeo, sharedWallMat);
    wMesh.position.set(cx, WALL_HEIGHT / 2, cz);
    wMesh.receiveShadow = true;
    root.add(wMesh);
    disposables.push(wGeo);

    // Baseboard trim
    const trimGeo =
      seg.orientation === 'h'
        ? new THREE.BoxGeometry(length + 0.1, 0.18, wallThickness + 0.08)
        : new THREE.BoxGeometry(wallThickness + 0.08, 0.18, length + 0.1);
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(cx, 0.09, cz);
    root.add(trimMesh);
    disposables.push(trimGeo);
  }

  // 4. Directional Corridor Wall Signs
  for (const sign of DIRECTIONAL_SIGNS) {
    const tex = createSignTexture(sign.text, sign.accent, anisotropy);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    });
    const geo = new THREE.PlaneGeometry(2.45, 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(sign.x, 3.15, sign.z);
    mesh.rotation.y = sign.yaw;
    root.add(mesh);
    disposables.push(tex, mat, geo);
  }

  // 5. Composite 3–12 Part Landmark Props inside each room (matching SOLID_OBSTACLES)
  for (const obs of SOLID_OBSTACLES) {
    const group = buildLandmarkProp(obs, darkMetalMat, matteCrateMat, glassMat, disposables, animatedProps);
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
    disposables,
  };
}

function addRoomOverheadSign(
  root: THREE.Group,
  room: RoomDefinition,
  cx: number,
  cz: number,
  anisotropy: number,
  disposables: Array<{ dispose: () => void }>,
): void {
  const tex = createSignTexture(room.name.toUpperCase(), room.accentColor, anisotropy, 'ОТСЕК СТАНЦИИ КАСКАД');
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.52,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 });
  const signGeo = new THREE.PlaneGeometry(2.9, 0.68);
  const frameGeo = new THREE.BoxGeometry(3.02, 0.76, 0.1);

  const holder = new THREE.Group();
  const frame = new THREE.Mesh(frameGeo, frameMat);
  const front = new THREE.Mesh(signGeo, mat);
  front.position.z = 0.056;
  const back = new THREE.Mesh(signGeo, mat);
  back.position.z = -0.056;
  back.rotation.y = Math.PI;
  holder.add(frame, front, back);
  holder.position.set(cx, WALL_HEIGHT - 0.45, cz);
  if (room.id === 'reactor' || room.id === 'airlock') {
    holder.rotation.y = Math.PI / 2;
  }
  root.add(holder);
  disposables.push(tex, mat, frameMat, signGeo, frameGeo);
}

function buildLandmarkProp(
  obs: SolidObstacle,
  darkMetalMat: THREE.MeshStandardMaterial,
  matteCrateMat: THREE.MeshStandardMaterial,
  glassMat: THREE.MeshStandardMaterial,
  disposables: Array<{ dispose: () => void }>,
  animatedProps: Array<(elapsed: number, dt: number) => void>,
): THREE.Group {
  const g = new THREE.Group();
  const w = obs.bounds.x2 - obs.bounds.x1;
  const d = obs.bounds.z2 - obs.bounds.z1;
  const cx = (obs.bounds.x1 + obs.bounds.x2) / 2;
  const cz = (obs.bounds.z1 + obs.bounds.z2) / 2;
  g.position.set(cx, 0, cz);

  if (obs.kind === 'table') {
    // Command Hall circular tactical meeting table + emergency button casing
    const pedGeo = new THREE.CylinderGeometry(0.62, 0.82, 0.78, 16);
    const topGeo = new THREE.CylinderGeometry(1.42, 1.48, 0.16, 20);
    const holoRingGeo = new THREE.TorusGeometry(0.95, 0.035, 10, 32);
    const btnBaseGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.14, 16);
    const btnGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.1, 16);

    const holoMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const redBtnMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    });

    const ped = new THREE.Mesh(pedGeo, darkMetalMat);
    ped.position.y = 0.39;
    const top = new THREE.Mesh(topGeo, matteCrateMat);
    top.position.y = 0.86;
    const ring = new THREE.Mesh(holoRingGeo, holoMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.96;
    const btnBase = new THREE.Mesh(btnBaseGeo, darkMetalMat);
    btnBase.position.y = 1.01;
    const btn = new THREE.Mesh(btnGeo, redBtnMat);
    btn.position.y = 1.1;

    g.add(ped, top, ring, btnBase, btn);
    disposables.push(pedGeo, topGeo, holoRingGeo, btnBaseGeo, btnGeo, holoMat, redBtnMat);
  } else if (obs.kind === 'core') {
    // Reactor fusion core: glowing inner plasma column + 3 rotating containment rings + 4 stanchions
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.75, 0.4, 16);
    const coreGeo = new THREE.CylinderGeometry(0.65, 0.65, 3.4, 16);
    const ringGeo = new THREE.TorusGeometry(1.18, 0.11, 10, 24);
    const pillarGeo = new THREE.BoxGeometry(0.26, 3.6, 0.26);

    const plasmaMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xf97316,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    const base = new THREE.Mesh(baseGeo, darkMetalMat);
    base.position.y = 0.2;
    const cap = new THREE.Mesh(baseGeo, darkMetalMat);
    cap.position.y = 3.55;
    const core = new THREE.Mesh(coreGeo, plasmaMat);
    core.position.y = 1.85;
    g.add(base, cap, core);

    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(ringGeo, darkMetalMat);
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.95 + i * 0.9;
      g.add(r);
      rings.push(r);
    }

    const corners = [
      [-1.3, -1.3],
      [1.3, -1.3],
      [-1.3, 1.3],
      [1.3, 1.3],
    ];
    for (const [px, pz] of corners) {
      const p = new THREE.Mesh(pillarGeo, matteCrateMat);
      p.position.set(px, 1.8, pz);
      g.add(p);
    }

    animatedProps.push((elapsed) => {
      rings.forEach((r, idx) => {
        r.rotation.z = elapsed * (0.4 + idx * 0.2) * (idx % 2 === 0 ? 1 : -1);
      });
      plasmaMat.emissiveIntensity = 1.5 + Math.sin(elapsed * 2.8) * 0.35;
    });
    disposables.push(baseGeo, coreGeo, ringGeo, pillarGeo, plasmaMat);
  } else if (obs.kind === 'hydro_tank') {
    // Hydroponics planter tank with glowing grow bar and low-poly flora clusters
    const tubGeo = new THREE.BoxGeometry(w - 0.1, 0.72, d - 0.1);
    const soilGeo = new THREE.BoxGeometry(w - 0.3, 0.1, d - 0.3);
    const canopyGeo = new THREE.BoxGeometry(w - 0.1, 0.65, d - 0.1);
    const stemGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.55, 6);
    const leafGeo = new THREE.OctahedronGeometry(0.28, 0);

    const soilMat = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.4,
      roughness: 0.65,
    });

    const tub = new THREE.Mesh(tubGeo, darkMetalMat);
    tub.position.y = 0.36;
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.73;
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    canopy.position.y = 1.08;
    g.add(tub, soil, canopy);

    for (let i = -1.6; i <= 1.6; i += 0.8) {
      const stem = new THREE.Mesh(stemGeo, leafMat);
      stem.position.set(i, 0.98, 0);
      const crown = new THREE.Mesh(leafGeo, leafMat);
      crown.position.set(i, 1.24, (i * 13) % 0.25);
      g.add(stem, crown);
    }

    disposables.push(tubGeo, soilGeo, canopyGeo, stemGeo, leafGeo, soilMat, leafMat);
  } else if (obs.kind === 'bed') {
    // Medbay diagnostic pod + scanner arch
    const frameGeo = new THREE.BoxGeometry(w - 0.1, 0.68, d - 0.2);
    const padGeo = new THREE.BoxGeometry(w - 0.25, 0.14, d - 0.35);
    const archGeo = new THREE.TorusGeometry(0.75, 0.08, 8, 20, Math.PI);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.72 });
    const scanMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.1,
    });

    const frame = new THREE.Mesh(frameGeo, darkMetalMat);
    frame.position.y = 0.34;
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.74;
    const arch = new THREE.Mesh(archGeo, scanMat);
    arch.position.set(0, 0.78, 0);
    g.add(frame, pad, arch);
    disposables.push(frameGeo, padGeo, archGeo, padMat, scanMat);
  } else if (obs.kind === 'crate') {
    // Storage stacked industrial crates with amber trim
    const crate1Geo = new THREE.BoxGeometry(1.35, 1.05, 1.35);
    const crate2Geo = new THREE.BoxGeometry(1.15, 0.9, 1.15);
    const accentCrateMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.62,
      metalness: 0.2,
    });

    const c1 = new THREE.Mesh(crate1Geo, matteCrateMat);
    c1.position.set(-0.68, 0.525, 0);
    const c2 = new THREE.Mesh(crate1Geo, darkMetalMat);
    c2.position.set(0.68, 0.525, 0);
    const c3 = new THREE.Mesh(crate2Geo, accentCrateMat);
    c3.position.set(-0.2, 1.48, 0);
    g.add(c1, c2, c3);
    disposables.push(crate1Geo, crate2Geo, accentCrateMat);
  } else if (obs.kind === 'transformer' || obs.kind === 'rack') {
    // Electrical transformer / Comms server rack with glowing LEDs
    const bodyGeo = new THREE.BoxGeometry(w - 0.12, obs.height, d - 0.12);
    const capGeo = new THREE.BoxGeometry(w + 0.04, 0.16, d + 0.04);
    const ledGeo = new THREE.BoxGeometry(w - 0.45, 0.1, d + 0.02);
    const ledColor = obs.kind === 'transformer' ? 0xfacc15 : 0x60a5fa;
    const ledMat = new THREE.MeshStandardMaterial({
      color: ledColor,
      emissive: ledColor,
      emissiveIntensity: 1.2,
    });

    const body = new THREE.Mesh(bodyGeo, darkMetalMat);
    body.position.y = obs.height / 2;
    const cap = new THREE.Mesh(capGeo, matteCrateMat);
    cap.position.y = obs.height + 0.08;
    const led1 = new THREE.Mesh(ledGeo, ledMat);
    led1.position.y = obs.height * 0.72;
    const led2 = new THREE.Mesh(ledGeo, ledMat);
    led2.position.y = obs.height * 0.46;
    g.add(body, cap, led1, led2);
    disposables.push(bodyGeo, capGeo, ledGeo, ledMat);
  } else {
    // Navigation / Airlock control island
    const baseGeo = new THREE.BoxGeometry(w - 0.1, 0.95, d - 0.1);
    const screenGeo = new THREE.BoxGeometry(w - 0.35, 0.22, d - 0.45);
    const glowColor = obs.roomId === 'navigation' ? 0x818cf8 : 0x38bdf8;
    const screenMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeo, darkMetalMat);
    base.position.y = 0.475;
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.y = 1.05;
    g.add(base, screen);
    disposables.push(baseGeo, screenGeo, screenMat);
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
      ? '#facc15'
      : term.kind === 'sensor_echo'
        ? '#38bdf8'
        : '#f59e0b';

  const pedGeo = new THREE.BoxGeometry(0.86, 1.05, 0.42);
  const topGeo = new THREE.BoxGeometry(0.96, 0.56, 0.32);
  const screenGeo = new THREE.PlaneGeometry(0.82, 0.44);
  const beaconGeo = new THREE.BoxGeometry(0.9, 0.06, 0.06);

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

  const ped = new THREE.Mesh(pedGeo, darkMetalMat);
  ped.position.y = 0.525;
  const head = new THREE.Mesh(topGeo, darkMetalMat);
  head.position.set(0, 1.32, 0.04);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 1.34, 0.21);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 1.64, 0.16);
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

/**
 * Composite 8-part low-poly spacesuit avatar with grounded bottom-center pivot,
 * articulated legs, glossy tinted visor, life-support backpack, contact shadow,
 * and translucent cyan personal self-defense shield dome.
 */
export function createPlayerAvatar(name: string, colorHex: string): PlayerAvatarRig {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const suitMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.58,
    metalness: 0.18,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.35,
    roughness: 0.12,
    metalness: 0.8,
  });
  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  disposables.push(suitMat, trimMat, visorMat, shadowTex, shadowMat, shieldMat);

  // Contact shadow disc
  const shadowGeo = new THREE.CircleGeometry(0.55, 20);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // Boots + Legs
  const legGeo = new THREE.BoxGeometry(0.2, 0.62, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, suitMat);
  leftLeg.position.set(-0.15, 0.31, 0);
  const rightLeg = new THREE.Mesh(legGeo, suitMat);
  rightLeg.position.set(0.15, 0.31, 0);
  group.add(leftLeg, rightLeg);

  // Torso + chest harness
  const torsoGeo = new THREE.BoxGeometry(0.56, 0.68, 0.34);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.y = 0.96;
  const harnessGeo = new THREE.BoxGeometry(0.58, 0.16, 0.36);
  const harness = new THREE.Mesh(harnessGeo, trimMat);
  harness.position.y = 0.88;
  group.add(torso, harness);

  // Backpack life-support unit
  const packGeo = new THREE.BoxGeometry(0.42, 0.52, 0.22);
  const pack = new THREE.Mesh(packGeo, trimMat);
  pack.position.set(0, 1.0, 0.24);
  group.add(pack);

  // Helmet + glossy tinted visor (faces -Z forward)
  const headGeo = new THREE.SphereGeometry(0.27, 14, 12);
  const head = new THREE.Mesh(headGeo, suitMat);
  head.position.set(0, 1.54, 0);
  const visorGeo = new THREE.BoxGeometry(0.36, 0.18, 0.14);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 1.55, -0.21);
  group.add(head, visor);

  // Shield dome (visible only during 2s personal shield activation)
  const domeGeo = new THREE.SphereGeometry(0.98, 20, 14);
  const shieldDome = new THREE.Mesh(domeGeo, shieldMat);
  shieldDome.position.y = 0.95;
  shieldDome.visible = false;
  shieldDome.renderOrder = 5;
  group.add(shieldDome);

  // Nameplate sprite (explicitly hidden behind walls!)
  const nameTex = createNameplateTexture(name, colorHex);
  const nameMat = new THREE.SpriteMaterial({
    map: nameTex,
    depthTest: true,
    transparent: true,
  });
  const nameSprite = new THREE.Sprite(nameMat);
  nameSprite.scale.set(1.3, 0.34, 1);
  nameSprite.position.set(0, 2.08, 0);
  group.add(nameSprite);

  disposables.push(shadowGeo, legGeo, torsoGeo, harnessGeo, packGeo, headGeo, visorGeo, domeGeo, nameTex, nameMat);

  return {
    group,
    leftLeg,
    rightLeg,
    shieldDome,
    nameSprite,
    color: colorHex,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
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
