import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  INTERACT_RADIUS,
  KILL_RANGE,
  PLAYER_EYE_HEIGHT,
  REPORT_RANGE,
  ROOMS,
  TERMINALS,
  distance2D,
  getRoomAt,
  hasLineOfSight,
  resolvePlayerMovement,
} from '../../shared/mapData';
import type { RoomId, RoomSnapshot, TaskTypeId } from '../../shared/types';
import { soundEngine } from './sound';
import {
  buildStation3D,
  createDownedBeaconMesh,
  createPlayerAvatar,
  type PlayerAvatarRig,
} from './station3d';

export interface NearbyInteraction {
  kind: 'task' | 'lights' | 'sensor_echo' | 'emergency';
  label: string;
  terminalId: string;
  taskId?: TaskTypeId;
}

export interface ViewportHudTelemetry {
  roomId: RoomId | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  nearbyInteraction: NearbyInteraction | null;
  nearbyBodyId: string | null;
  nearbyAttackTarget: { id: string; name: string } | null;
  pointerLocked: boolean;
}

export interface RemoteMotionUpdate {
  playerId: string;
  x: number;
  z: number;
  yaw: number;
  shieldActiveUntil: number;
}

interface FirstPersonViewportProps {
  mode: 'menu' | 'lobby' | 'playing' | 'meeting' | 'ended';
  snapshot: RoomSnapshot | null;
  panelOpen: boolean;
  sensitivity: number;
  remoteMotionRef: React.MutableRefObject<Map<string, RemoteMotionUpdate>>;
  onSendMove: (x: number, z: number, yaw: number) => void;
  onTelemetryChange: (telemetry: ViewportHudTelemetry) => void;
  onInteract: (interaction: NearbyInteraction) => void;
  onReportBody: (bodyId: string) => void;
  onActivateShield: () => void;
  onAttackTarget: (targetId: string) => void;
  onToggleMap: () => void;
  onTogglePause: () => void;
}

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function FirstPersonViewport({
  mode,
  snapshot,
  panelOpen,
  sensitivity,
  remoteMotionRef,
  onSendMove,
  onTelemetryChange,
  onInteract,
  onReportBody,
  onActivateShield,
  onAttackTarget,
  onToggleMap,
  onTogglePause,
}: FirstPersonViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props & callbacks in refs so WebGL mounts ONCE and never resets
  const propsRef = useRef({
    mode,
    snapshot,
    panelOpen,
    sensitivity,
    onSendMove,
    onTelemetryChange,
    onInteract,
    onReportBody,
    onActivateShield,
    onAttackTarget,
    onToggleMap,
    onTogglePause,
  });
  propsRef.current = {
    mode,
    snapshot,
    panelOpen,
    sensitivity,
    onSendMove,
    onTelemetryChange,
    onInteract,
    onReportBody,
    onActivateShield,
    onAttackTarget,
    onToggleMap,
    onTogglePause,
  };

  // Release pointer lock automatically whenever any overlay panel or non-playing screen opens
  useEffect(() => {
    if (mode !== 'playing' || panelOpen) {
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }, [mode, panelOpen]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090e16);
    const fog = new THREE.FogExp2(0x090e16, 0.022);
    scene.fog = fog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      72,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      90,
    );

    // Balanced warm/cool lighting rig (never flat ambient alone)
    const hemiLight = new THREE.HemisphereLight(0xd8ecff, 0x2b3648, 1.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.15);
    keyLight.position.set(14, 24, 12);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -40;
      keyLight.shadow.camera.right = 40;
      keyLight.shadow.camera.top = 28;
      keyLight.shadow.camera.bottom = -28;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Personal headlamp attached to camera (helps during blackout while preserving tight darkness)
    const headLamp = new THREE.PointLight(0xe0f2fe, 2.2, 11, 1.6);
    camera.add(headLamp);
    scene.add(camera);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const station = buildStation3D(maxAniso);
    scene.add(station.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Dynamic actors & bodies
    const avatars = new Map<string, PlayerAvatarRig>();
    const avatarPositions = new Map<string, { x: number; z: number; yaw: number; walkPhase: number }>();
    const bodyMeshes = new Map<string, { group: THREE.Group; dispose: () => void }>();

    // Local first-person physics state
    const localPos = { x: 0, z: 3.1, yaw: Math.PI, pitch: 0 };
    let lastSyncedRound = -1;
    let lastSyncedPhase = '';
    let lastMoveEmitAt = 0;
    let lastTelemetryEmitAt = 0;
    let walkBobTime = 0;
    let lastNearbyInteraction: NearbyInteraction | null = null;
    let lastNearbyBodyId: string | null = null;
    let lastAttackTarget: { id: string; name: string } | null = null;
    let pointerLocked = false;

    const keys = new Set<string>();
    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Menu flyover waypoints showcasing Command Hall table, terminals, and directional signage
    const flyPoints = [
      new THREE.Vector3(-4.2, 2.15, 3.8),
      new THREE.Vector3(4.2, 2.15, 3.8),
      new THREE.Vector3(4.2, 2.05, -3.6),
      new THREE.Vector3(-4.2, 2.05, -3.6),
    ];

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const onCanvasClick = () => {
      const { mode: m, panelOpen: po } = propsRef.current;
      if (m === 'playing' && !po && document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
      }
    };
    renderer.domElement.addEventListener('click', onCanvasClick);

    const onPointerLockChange = () => {
      pointerLocked = document.pointerLockElement === renderer.domElement;
      if (!pointerLocked) {
        keys.clear();
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const onMouseMove = (e: MouseEvent) => {
      const { mode: m, panelOpen: po, sensitivity: sens } = propsRef.current;
      if (m !== 'playing' || po) return;
      if (document.pointerLockElement !== renderer.domElement) return;
      const factor = 0.0021 * sens;
      localPos.yaw -= e.movementX * factor;
      localPos.pitch = THREE.MathUtils.clamp(
        localPos.pitch - e.movementY * factor,
        -Math.PI * 0.42,
        Math.PI * 0.42,
      );
    };
    window.addEventListener('mousemove', onMouseMove);

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const { mode: m, panelOpen: po } = propsRef.current;

      if (e.code === 'Tab' && m === 'playing') {
        e.preventDefault();
        propsRef.current.onToggleMap();
        return;
      }

      if (e.code === 'Escape' && m === 'playing') {
        if (po) {
          propsRef.current.onTogglePause();
        } else if (!document.pointerLockElement) {
          propsRef.current.onTogglePause();
        }
        return;
      }

      if (m !== 'playing' || po) return;

      keys.add(e.code);

      if (e.repeat) return;

      if (e.code === 'KeyE' && lastNearbyInteraction) {
        propsRef.current.onInteract(lastNearbyInteraction);
      } else if (e.code === 'KeyR' && lastNearbyBodyId) {
        propsRef.current.onReportBody(lastNearbyBodyId);
      } else if (e.code === 'KeyQ') {
        propsRef.current.onActivateShield();
      } else if (e.code === 'KeyF' && lastAttackTarget) {
        propsRef.current.onAttackTarget(lastAttackTarget.id);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const onBlur = () => {
      keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', onResize);

    // Helper: compute nearest interactable terminal, reportable body, and attackable target
    function updateInteractions(snap: RoomSnapshot, myX: number, myZ: number) {
      const me = snap.players.find((p) => p.id === snap.self.playerId);
      const isAlive = me?.status === 'alive';
      const isCrew = snap.self.role === 'crew';
      const isSaboteur = snap.self.role === 'saboteur';

      let bestInteract: NearbyInteraction | null = null;
      let bestDist = INTERACT_RADIUS;

      // Active task stage terminals
      if (isAlive || isCrew) {
        for (const task of snap.self.tasks) {
          if (task.completed) continue;
          const stage = task.stages[task.currentStageIndex];
          if (!stage) continue;
          const term = TERMINALS.find((t) => t.id === stage.terminalId);
          if (!term) continue;
          const d = distance2D(myX, myZ, term.x, term.z);
          if (d <= bestDist && (!isAlive || hasLineOfSight(myX, myZ, term.x, term.z))) {
            bestDist = d;
            bestInteract = {
              kind: 'task',
              label: `${task.title}: ${stage.title}`,
              terminalId: term.id,
              taskId: task.taskId,
            };
          }
        }
      }

      // Lights repair panel (alive players during blackout)
      if (isAlive && snap.lightsOut) {
        const lightsTerm = TERMINALS.find((t) => t.id === 'ele_lights');
        if (lightsTerm) {
          const d = distance2D(myX, myZ, lightsTerm.x, lightsTerm.z);
          if (d <= bestDist) {
            bestDist = d;
            bestInteract = {
              kind: 'lights',
              label: 'Восстановить освещение станции',
              terminalId: lightsTerm.id,
            };
          }
        }
      }

      // Sensor Echo terminal
      const echoTerm = TERMINALS.find((t) => t.id === 'cmd_sensor_echo');
      if (echoTerm) {
        const d = distance2D(myX, myZ, echoTerm.x, echoTerm.z);
        if (d <= bestDist) {
          bestDist = d;
          bestInteract = {
            kind: 'sensor_echo',
            label: 'Открыть «Эхо датчика»',
            terminalId: echoTerm.id,
          };
        }
      }

      // Command Hall emergency button (alive only, blocked during blackout)
      if (isAlive && !snap.lightsOut && !snap.self.emergencyUsed) {
        const emerTerm = TERMINALS.find((t) => t.id === 'cmd_emergency');
        if (emerTerm) {
          const d = distance2D(myX, myZ, emerTerm.x, emerTerm.z);
          if (d <= bestDist) {
            bestDist = d;
            bestInteract = {
              kind: 'emergency',
              label: 'Созвать экстренное собрание',
              terminalId: emerTerm.id,
            };
          }
        }
      }

      // Reportable downed crewmate (R)
      let nearBody: string | null = null;
      if (isAlive) {
        let nearBodyDist = REPORT_RANGE;
        for (const b of snap.bodies) {
          if (b.reported) continue;
          const d = distance2D(myX, myZ, b.x, b.z);
          if (d <= nearBodyDist && hasLineOfSight(myX, myZ, b.x, b.z)) {
            nearBodyDist = d;
            nearBody = b.id;
          }
        }
      }

      // Saboteur close-range LOS attack target (F)
      let nearTarget: { id: string; name: string } | null = null;
      if (isAlive && isSaboteur) {
        let nearTargetDist = KILL_RANGE;
        for (const p of snap.players) {
          if (p.id === snap.self.playerId || p.status !== 'alive') continue;
          const rm = remoteMotionRef.current.get(p.id);
          const px = rm ? rm.x : p.x;
          const pz = rm ? rm.z : p.z;
          const d = distance2D(myX, myZ, px, pz);
          if (d <= nearTargetDist && hasLineOfSight(myX, myZ, px, pz)) {
            nearTargetDist = d;
            nearTarget = { id: p.id, name: p.name };
          }
        }
      }

      lastNearbyInteraction = bestInteract;
      lastNearbyBodyId = nearBody;
      lastAttackTarget = nearTarget;
    }

    // Frame pacing loop (60fps rAF on GPU, safe afterDraw(tick) on Software WebGL)
    let disposed = false;
    let frameId = 0;
    let lastTime = performance.now();
    const startTime = lastTime;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const { mode: curMode, snapshot: snap, panelOpen: po } = propsRef.current;

      // Animate station landmarks (reactor rings, etc.)
      for (const anim of station.animatedProps) {
        anim(elapsed, dt);
      }

      if (curMode === 'menu' || curMode === 'lobby' || !snap) {
        // Atmospheric flyover inside Command Hall for Title & Lobby
        const t = (elapsed * 0.08) % flyPoints.length;
        const i0 = Math.floor(t);
        const i1 = (i0 + 1) % flyPoints.length;
        const frac = t - i0;
        const smooth = frac * frac * (3 - 2 * frac);
        camera.position.lerpVectors(flyPoints[i0], flyPoints[i1], smooth);
        camera.lookAt(-0.4, 1.2, -0.3);

        fog.density = THREE.MathUtils.damp(fog.density, 0.016, 4, dt);
        hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, 1.35, 4, dt);
        keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, 1.15, 4, dt);
        headLamp.intensity = 2.0;
        if (station.roomLights[0]) {
          station.roomLights[0].position.set(0, 3.25, 0);
          station.roomLights[0].color.set('#cfe8ff');
          station.roomLights[0].intensity = 16;
        }
        if (station.roomLights[1]) {
          station.roomLights[1].position.set(0, 3.1, -9);
          station.roomLights[1].color.set('#2dd4bf');
          station.roomLights[1].intensity = 12;
        }
      } else {
        // Sync spawn teleport when round starts or resumes after meeting
        const me = snap.players.find((p) => p.id === snap.self.playerId);
        if (
          me &&
          (snap.roundNumber !== lastSyncedRound ||
            (lastSyncedPhase === 'meeting' && snap.phase === 'playing') ||
            (lastSyncedPhase !== 'playing' && snap.phase === 'playing'))
        ) {
          localPos.x = me.x;
          localPos.z = me.z;
          localPos.yaw = me.yaw;
          localPos.pitch = 0;
          lastSyncedRound = snap.roundNumber;
        }
        lastSyncedPhase = snap.phase;

        // First-person WASD movement (blocked during overlays/meetings)
        const canMove = curMode === 'playing' && !po && me && me.connected;
        let moving = false;

        if (canMove) {
          // Arrow left/right fallback turning for desktop users without pointer lock
          if (keys.has('ArrowLeft')) localPos.yaw += 2.1 * dt;
          if (keys.has('ArrowRight')) localPos.yaw -= 2.1 * dt;

          const moveZ =
            (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
            (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
          const moveX =
            (keys.has('KeyD') ? 1 : 0) -
            (keys.has('KeyA') ? 1 : 0);

          if (moveZ !== 0 || moveX !== 0) {
            moving = true;
            _forward.set(-Math.sin(localPos.yaw), 0, -Math.cos(localPos.yaw));
            _right.set(Math.cos(localPos.yaw), 0, -Math.sin(localPos.yaw));

            const isSlowed =
              snap.self.role === 'saboteur' && Date.now() < snap.self.slowedUntil;
            const speed = isSlowed ? 3.2 : 6.0;

            let dx = _forward.x * moveZ + _right.x * moveX;
            let dz = _forward.z * moveZ + _right.z * moveX;
            const len = Math.hypot(dx, dz) || 1;
            dx = (dx / len) * speed * dt;
            dz = (dz / len) * speed * dt;

            const resolved = resolvePlayerMovement(
              localPos.x,
              localPos.z,
              localPos.x + dx,
              localPos.z + dz,
            );
            localPos.x = resolved.x;
            localPos.z = resolved.z;

            walkBobTime += dt * (isSlowed ? 6.5 : 10.5);
            if (me.status === 'alive') {
              soundEngine.playFootstep();
            }
          }

          // Emit position at ~16Hz to authoritative server
          if (now - lastMoveEmitAt > 62) {
            lastMoveEmitAt = now;
            propsRef.current.onSendMove(localPos.x, localPos.z, localPos.yaw);
          }
        }

        // First-person camera with subtle head-bob synced to movement
        const bobOffset = moving ? Math.sin(walkBobTime) * 0.045 : 0;
        camera.position.set(localPos.x, PLAYER_EYE_HEIGHT + bobOffset, localPos.z);
        _euler.set(localPos.pitch, localPos.yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(_euler);

        // Blackout lighting & fog contrast (saboteur keeps slightly better night vision)
        const isBlackout = snap.lightsOut;
        const isSaboteur = snap.self.role === 'saboteur';
        const targetFog = isBlackout ? (isSaboteur ? 0.095 : 0.22) : 0.018;
        const targetHemi = isBlackout ? (isSaboteur ? 0.3 : 0.09) : 1.35;
        const targetKey = isBlackout ? 0.08 : 1.15;
        fog.density = THREE.MathUtils.damp(fog.density, targetFog, 5, dt);
        hemiLight.intensity = THREE.MathUtils.damp(hemiLight.intensity, targetHemi, 5, dt);
        keyLight.intensity = THREE.MathUtils.damp(keyLight.intensity, targetKey, 5, dt);
        headLamp.intensity = isBlackout ? (isSaboteur ? 3.2 : 1.8) : 2.0;

        for (const mat of station.ceilingLightMaterials) {
          mat.emissiveIntensity = isBlackout ? 0.12 : 1.35;
        }

        // Reposition 2 pooled room lights to the 2 nearest rooms to the player
        const sortedRooms = [...ROOMS].sort((a, b) => {
          const ax = (a.bounds.x1 + a.bounds.x2) / 2;
          const az = (a.bounds.z1 + a.bounds.z2) / 2;
          const bx = (b.bounds.x1 + b.bounds.x2) / 2;
          const bz = (b.bounds.z1 + b.bounds.z2) / 2;
          return distance2D(localPos.x, localPos.z, ax, az) - distance2D(localPos.x, localPos.z, bx, bz);
        });
        station.roomLights.forEach((pl, idx) => {
          const r = sortedRooms[idx];
          if (!r) return;
          pl.position.set(
            (r.bounds.x1 + r.bounds.x2) / 2,
            3.25,
            (r.bounds.z1 + r.bounds.z2) / 2,
          );
          pl.color.set(isBlackout ? '#ef4444' : r.lightColor);
          pl.intensity = isBlackout ? 1.2 : 15;
        });

        // Sync remote player avatars with smooth exponential damping & strict line-of-sight hiding
        const activeIds = new Set<string>();
        const viewerIsObserver = me?.status === 'eliminated';
        const nowEpoch = Date.now();

        for (const p of snap.players) {
          if (p.id === snap.self.playerId) continue;
          if (!viewerIsObserver && p.status === 'eliminated') continue;
          activeIds.add(p.id);

          let rig = avatars.get(p.id);
          if (!rig || rig.color !== p.color) {
            if (rig) {
              scene.remove(rig.group);
              rig.dispose();
            }
            rig = createPlayerAvatar(p.name, p.color);
            scene.add(rig.group);
            avatars.set(p.id, rig);
          }

          const rm = remoteMotionRef.current.get(p.id);
          const targetX = rm ? rm.x : p.x;
          const targetZ = rm ? rm.z : p.z;
          const targetYaw = rm ? rm.yaw : p.yaw;
          const shieldUntil = Math.max(p.shieldActiveUntil, rm?.shieldActiveUntil ?? 0);

          let cur = avatarPositions.get(p.id);
          if (!cur) {
            cur = { x: targetX, z: targetZ, yaw: targetYaw, walkPhase: 0 };
            avatarPositions.set(p.id, cur);
          } else {
            const prevX = cur.x;
            const prevZ = cur.z;
            cur.x = THREE.MathUtils.damp(cur.x, targetX, 12, dt);
            cur.z = THREE.MathUtils.damp(cur.z, targetZ, 12, dt);
            // Shortest angle interpolation
            let diff = targetYaw - cur.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            cur.yaw += diff * (1 - Math.exp(-12 * dt));
            const movedDist = Math.hypot(cur.x - prevX, cur.z - prevZ);
            if (movedDist > 0.002) {
              cur.walkPhase += movedDist * 5.2;
            }
          }

          rig.group.position.set(cur.x, 0, cur.z);
          rig.group.rotation.y = cur.yaw;
          rig.leftLeg.rotation.x = Math.sin(cur.walkPhase) * 0.48;
          rig.rightLeg.rotation.x = -Math.sin(cur.walkPhase) * 0.48;

          // Anti-wallhack: never show remote players or nameplates through walls!
          const dist = distance2D(localPos.x, localPos.z, cur.x, cur.z);
          const inSight = hasLineOfSight(localPos.x, localPos.z, cur.x, cur.z);
          const visibleInFog = !isBlackout || dist <= (isSaboteur ? 11 : 6.8);
          rig.group.visible = inSight && visibleInFog;
          rig.nameSprite.visible = inSight && dist <= 9.5 && visibleInFog;

          // Shield dome glow
          rig.shieldDome.visible = nowEpoch <= shieldUntil;
          if (rig.shieldDome.visible) {
            const s = 1 + Math.sin(elapsed * 14) * 0.04;
            rig.shieldDome.scale.set(s, s, s);
          }
        }

        // Clean up departed players
        for (const [id, rig] of [...avatars.entries()]) {
          if (!activeIds.has(id)) {
            scene.remove(rig.group);
            rig.dispose();
            avatars.delete(id);
            avatarPositions.delete(id);
          }
        }

        // Sync downed stasis beacons (bodies)
        const activeBodyIds = new Set<string>();
        for (const b of snap.bodies) {
          if (b.reported) continue;
          activeBodyIds.add(b.id);
          let bm = bodyMeshes.get(b.id);
          if (!bm) {
            bm = createDownedBeaconMesh(b.victimColor);
            bm.group.position.set(b.x, 0, b.z);
            scene.add(bm.group);
            bodyMeshes.set(b.id, bm);
          }
          const inSight = hasLineOfSight(localPos.x, localPos.z, b.x, b.z);
          bm.group.visible = inSight;
        }
        for (const [id, bm] of [...bodyMeshes.entries()]) {
          if (!activeBodyIds.has(id)) {
            scene.remove(bm.group);
            bm.dispose();
            bodyMeshes.delete(id);
          }
        }

        // Highlight active task terminal beacons subtly
        const activeTermIds = new Set(
          snap.self.tasks
            .filter((t) => !t.completed)
            .map((t) => t.stages[t.currentStageIndex]?.terminalId),
        );
        station.terminalMeshes.forEach((group, termId) => {
          const beacon = group.getObjectByName('terminal_beacon') as THREE.Mesh | undefined;
          if (!beacon) return;
          const mat = beacon.material as THREE.MeshStandardMaterial;
          if (termId === 'ele_lights' && snap.lightsOut) {
            mat.color.set('#ef4444');
            mat.emissive.set('#ef4444');
            mat.emissiveIntensity = 1.6 + Math.sin(elapsed * 8) * 0.6;
          } else if (activeTermIds.has(termId)) {
            mat.color.set('#f59e0b');
            mat.emissive.set('#f59e0b');
            mat.emissiveIntensity = 1.4 + Math.sin(elapsed * 4) * 0.35;
          } else {
            mat.color.set('#334155');
            mat.emissive.set('#38bdf8');
            mat.emissiveIntensity = 0.25;
          }
        });

        // Update HUD telemetry at <= 8Hz (never 60Hz setState!)
        if (now - lastTelemetryEmitAt > 125) {
          lastTelemetryEmitAt = now;
          updateInteractions(snap, localPos.x, localPos.z);
          propsRef.current.onTelemetryChange({
            roomId: getRoomAt(localPos.x, localPos.z),
            playerX: localPos.x,
            playerZ: localPos.z,
            playerYaw: localPos.yaw,
            nearbyInteraction: lastNearbyInteraction,
            nearbyBodyId: lastNearbyBodyId,
            nearbyAttackTarget: lastAttackTarget,
            pointerLocked,
          });
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);

      avatars.forEach((rig) => rig.dispose());
      bodyMeshes.forEach((bm) => bm.dispose());
      station.disposables.forEach((d) => d.dispose());
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [remoteMotionRef]);

  return (
    <div
      ref={mountRef}
      data-testid="station-3d-viewport"
      className="fixed inset-0 w-full h-full select-none"
    />
  );
}
