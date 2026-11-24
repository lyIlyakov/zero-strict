import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { TouchJoystick, useTouchAvailable } from './TouchJoystick';
import { createTouchControls, JOYSTICK_TRAVEL } from './touchControls';
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
  graphicsUnavailable: boolean;
}

export interface RemoteMotionUpdate {
  playerId: string;
  x: number;
  z: number;
  yaw: number;
  shieldActiveUntil: number;
}

interface FirstPersonViewportProps {
  mode: RoomSnapshot['phase'];
  snapshot: RoomSnapshot;
  gateStartedAt: number | null;
  onGateOpened: () => void;
  panelOpen: boolean;
  sensitivity: number;
  remoteMotionRef: React.MutableRefObject<Map<string, RemoteMotionUpdate>>;
  onSendMove: (x: number, z: number, yaw: number) => void;
  onTelemetryChange: (telemetry: ViewportHudTelemetry) => void;
  onInteract: (interaction: NearbyInteraction) => void;
  onReportBody: (bodyId: string) => void;
  onActivateShield: () => void;
  onAttackTarget: (targetId: string) => void;
  onSabotageLights: () => void;
  onToggleMute: () => void;
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

export function FirstPersonViewport(props: FirstPersonViewportProps) {
  const { mode, snapshot, panelOpen, gateStartedAt, remoteMotionRef } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLSpanElement | null>(null);
  const resetInputRef = useRef<(() => void) | null>(null);
  const touchAvailable = useTouchAvailable();
  const [graphicsUnavailable, setGraphicsUnavailable] = useState(false);
  const propsRef = useRef(props);
  useLayoutEffect(() => { propsRef.current = props; });
  useLayoutEffect(() => {
    resetInputRef.current?.();
  }, [mode, panelOpen, gateStartedAt, snapshot.self.playerId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSoftwareGl, powerPreference: 'high-performance' });
    } catch {
      setGraphicsUnavailable(true);
    }
    if (renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
      container.prepend(canvas);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090e16);
    const fog = new THREE.FogExp2(0x090e16, 0.022);
    scene.fog = fog;

    let environment: THREE.WebGLRenderTarget | undefined;
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();
    }

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

    const station = renderer && buildStation3D(renderer.capabilities.getMaxAnisotropy());
    if (station) scene.add(station.root);
    if (!isSoftwareGl) renderer?.compile(scene, camera);

    // Dynamic actors & bodies
    const avatars = new Map<string, { rig: PlayerAvatarRig; skin: RoomSnapshot['players'][number]['skin']; color: string; name: string }>();
    const avatarPositions = new Map<string, { x: number; z: number; yaw: number; walkPhase: number }>();
    const bodyMeshes = new Map<string, { group: THREE.Group; dispose: () => void }>();

    // Local first-person physics state
    const localPos = { x: 0, z: 3.1, yaw: Math.PI, pitch: 0 };
    let lastSyncedRound = -1;
    let lastSyncedPhase: RoomSnapshot['phase'] | null = null;
    let wasConnected = false;
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

    const touch = createTouchControls();
    const captures = new Set<number>();
    let contextLost = false;
    const syncKnob = () => {
      const knob = knobRef.current;
      if (knob) knob.style.transform = `translate(${touch.movement.x * JOYSTICK_TRAVEL}px, ${-touch.movement.z * JOYSTICK_TRAVEL}px)`;
    };
    const releaseLock = () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
    const resetInput = () => {
      keys.clear();
      touch.reset();
      for (const id of captures) {
        if (container.hasPointerCapture(id)) container.releasePointerCapture(id);
      }
      captures.clear();
      syncKnob();
      releaseLock();
    };
    resetInputRef.current = resetInput;
    const inputAllowed = () => {
      const { mode: m, panelOpen: po, gateStartedAt: gate, snapshot: snap } = propsRef.current;
      return (m === 'playing' || m === 'lobby') && !po && gate === null &&
        snap.players.some((p) => p.id === snap.self.playerId && p.connected);
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      sync = null;
      setGraphicsUnavailable(true);
      resetInput();
    };
    const onContextRestored = () => {
      contextLost = false;
      setGraphicsUnavailable(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const onPointerDown = (e: PointerEvent) => {
      if (!inputAllowed()) return;
      if (e.pointerType === 'touch') {
        const joystick = (e.target as Element).closest('[data-joystick]');
        const bounds = container.getBoundingClientRect();
        const kind = joystick ? 'move' : e.clientX >= bounds.left + bounds.width / 2 ? 'look' : null;
        if (kind && touch.start(kind, e.pointerId, e.clientX, e.clientY)) {
          captures.add(e.pointerId);
          container.setPointerCapture(e.pointerId);
        }
      } else if (e.pointerType === 'mouse' && e.button === 0 && e.target === canvas && !pointerLocked && !contextLost) {
        (document.activeElement as HTMLElement | null)?.blur();
        try {
          // Browser implementations can return a Promise or void.
          void canvas.requestPointerLock?.()?.catch(() => { /* Keyboard look remains available. */ });
        } catch {
          // Pointer lock is optional in embedded browsers.
        }
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!captures.has(e.pointerId) || !inputAllowed()) return;
      touch.move(e.pointerId, e.clientX, e.clientY);
      syncKnob();
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (!captures.delete(e.pointerId)) return;
      touch.end(e.pointerId);
      if (e.type !== 'pointerup') touch.takeLook();
      syncKnob();
    };
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerEnd);
    container.addEventListener('pointercancel', onPointerEnd);
    container.addEventListener('lostpointercapture', onPointerEnd);

    const onPointerLockChange = () => {
      pointerLocked = document.pointerLockElement === canvas;
      if (pointerLocked && !inputAllowed()) releaseLock();
      if (!pointerLocked) keys.clear();
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const turn = (dx: number, dy: number, scale: number) => {
      const factor = scale * propsRef.current.sensitivity;
      localPos.yaw -= dx * factor;
      localPos.pitch = THREE.MathUtils.clamp(localPos.pitch - dy * factor, -Math.PI * 0.42, Math.PI * 0.42);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (inputAllowed() && document.pointerLockElement === canvas) turn(e.movementX, e.movementY, 0.0021);
    };
    window.addEventListener('mousemove', onMouseMove);

    const movementKeys = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyI', 'KeyK',
    ]);
    const onKeyDown = (e: KeyboardEvent) => {
      const p = propsRef.current;
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Tab') releaseLock(); // Keep native focus traversal, including in panels.
      if (p.mode === 'playing' && e.code === 'Escape') {
        if (!e.repeat && p.gateStartedAt === null) p.onTogglePause();
        return;
      }
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable]')) return;
      if (p.mode === 'playing' && p.gateStartedAt === null && e.code === 'KeyM') {
        if (!e.repeat) p.onToggleMap();
        return;
      }
      if (p.mode === 'playing' && p.gateStartedAt === null && e.code === 'KeyP') {
        if (!e.repeat) p.onTogglePause();
        return;
      }
      if (!inputAllowed()) return;
      if (movementKeys.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) keys.add(e.code);
        return;
      }
      if (e.repeat || p.mode !== 'playing') return;

      const snap = p.snapshot;
      const alive = snap.players.some((player) => player.id === snap.self.playerId && player.status === 'alive');
      const now = Date.now();
      updateInteractions(snap, localPos.x, localPos.z);
      if (e.code === 'KeyE' && lastNearbyInteraction) {
        p.onInteract(lastNearbyInteraction);
      } else if (e.code === 'KeyR' && lastNearbyBodyId) {
        p.onReportBody(lastNearbyBodyId);
      } else if (e.code === 'KeyQ' && alive && snap.self.role === 'crew' && snap.shieldUnlocked && snap.self.shieldCharge > 0 && snap.self.shieldActiveUntil <= now) {
        p.onActivateShield();
      } else if (e.code === 'KeyF' && lastAttackTarget && snap.self.killCooldownUntil <= now) {
        p.onAttackTarget(lastAttackTarget.id);
      } else if (e.code === 'KeyL' && alive && snap.self.role === 'saboteur' && !snap.lightsOut && snap.self.sabotageCooldownUntil <= now) {
        p.onSabotageLights();
      } else if (e.code === 'KeyV') {
        p.onToggleMute();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
    const onFocusIn = (e: FocusEvent) => {
      // Keyboard focus can move to HUD controls as well as modal fields. In either
      // case, release held movement/look before the next frame can apply it.
      if (!container.contains(e.target as Node | null)) resetInput();
    };
    const onVisibilityChange = () => { if (document.hidden) resetInput(); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', resetInput);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('focusin', onFocusIn);

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer?.setSize(w, h);
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
      if (isAlive && snap.settings?.emergencyEnabled !== false && !snap.lightsOut && !snap.self.emergencyUsed) {
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

    let sync: WebGLSync | null = null;
    let lastGateProgress = -1;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gateDuration = reducedMotion ? 180 : 1200;
    function tick() {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsed = (now - startTime) / 1000;
      const { mode: curMode, snapshot: snap, gateStartedAt: gate } = propsRef.current;
      const me = snap.players.find((p) => p.id === snap.self.playerId);
      const lobby = curMode === 'lobby';
      const connected = me?.connected ?? false;
      if (me && (snap.roundNumber !== lastSyncedRound || lastSyncedPhase !== curMode || (!wasConnected && connected))) {
        localPos.x = me.x;
        localPos.z = me.z;
        localPos.yaw = me.yaw;
        localPos.pitch = 0;
        lastSyncedRound = snap.roundNumber;
        avatarPositions.clear();
      }
      if (wasConnected && !connected) resetInput();
      wasConnected = connected;
      lastSyncedPhase = curMode;

      const gateProgress = lobby ? 0 : curMode === 'playing' && gate !== null
        ? Math.min(1, Math.max(0, (now - gate) / gateDuration)) : 1;
      if (gateProgress !== lastGateProgress) {
        station?.setGate(gateProgress * gateProgress * (3 - 2 * gateProgress));
        lastGateProgress = gateProgress;
      }
      if (gate !== null && gateProgress >= 1) propsRef.current.onGateOpened();

      let moving = false;
      const look = touch.takeLook();
      if (inputAllowed() && me) {
        const keyAxis = (positive: boolean, negative: boolean) => Number(positive) - Number(negative);
        turn(look.x, look.y, 0.005);
        localPos.yaw += keyAxis(keys.has('ArrowLeft'), keys.has('ArrowRight')) * 2.1 * dt;
        turn(0, keyAxis(keys.has('KeyK'), keys.has('KeyI')) * 750 * dt, 0.0021);
        localPos.yaw = Math.atan2(Math.sin(localPos.yaw), Math.cos(localPos.yaw));

        const moveZ = touch.movement.z + keyAxis(keys.has('KeyW') || keys.has('ArrowUp'), keys.has('KeyS') || keys.has('ArrowDown'));
        const moveX = touch.movement.x + keyAxis(keys.has('KeyD'), keys.has('KeyA'));
        if (moveZ || moveX) {
          _forward.set(-Math.sin(localPos.yaw), 0, -Math.cos(localPos.yaw));
          _right.set(Math.cos(localPos.yaw), 0, -Math.sin(localPos.yaw));
          const isSlowed = snap.self.role === 'saboteur' && Date.now() < snap.self.slowedUntil;
          const step = (isSlowed ? 3.2 : 6) * dt / Math.max(1, Math.hypot(moveZ, moveX));
          const x = localPos.x + (_forward.x * moveZ + _right.x * moveX) * step;
          const z = localPos.z + (_forward.z * moveZ + _right.z * moveX) * step;
          const resolved = resolvePlayerMovement(localPos.x, localPos.z,
            lobby ? THREE.MathUtils.clamp(x, -5.5, 5.5) : x,
            lobby ? THREE.MathUtils.clamp(z, -5.5, 5.5) : z);
          moving = Math.hypot(resolved.x - localPos.x, resolved.z - localPos.z) > 0.001;
          localPos.x = resolved.x;
          localPos.z = resolved.z;
          if (moving) {
            walkBobTime += dt * (isSlowed ? 6.5 : 10.5);
            if (me.status === 'alive') soundEngine.playFootstep();
          }
        }
        if (now - lastMoveEmitAt > 62) {
          lastMoveEmitAt = now;
          propsRef.current.onSendMove(localPos.x, localPos.z, localPos.yaw);
        }
      }

      const bobOffset = moving && !reducedMotion ? Math.sin(walkBobTime) * 0.025 : 0;
      camera.position.set(localPos.x, PLAYER_EYE_HEIGHT + bobOffset, localPos.z);
      camera.quaternion.setFromEuler(_euler.set(localPos.pitch, localPos.yaw, 0, 'YXZ'));

      if (station && !contextLost) {
        for (const anim of station.animatedProps) anim(elapsed, dt);
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

          const cached = avatars.get(p.id);
          let rig = cached?.rig;
          if (!cached || cached.color !== p.color || cached.skin !== p.skin || cached.name !== p.name) {
            if (rig) {
              scene.remove(rig.group);
              rig.dispose();
            }
            rig = createPlayerAvatar(p.name, p.color, p.skin);
            scene.add(rig.group);
            avatars.set(p.id, { rig, color: p.color, skin: p.skin, name: p.name });
          }
          if (!rig) continue;

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
        for (const [id, { rig }] of avatars) {
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
            mat.emissiveIntensity = 1.6;
          } else if (activeTermIds.has(termId)) {
            mat.color.set('#f59e0b');
            mat.emissive.set('#f59e0b');
            mat.emissiveIntensity = 1.4;
          } else {
            mat.color.set('#334155');
            mat.emissive.set('#38bdf8');
            mat.emissiveIntensity = 0.25;
          }
        });

      }

      // Telemetry and keyboard actions remain available without a WebGL context.
      if (now - lastTelemetryEmitAt > 125) {
        lastTelemetryEmitAt = now;
        if (curMode === 'playing' && gate === null) {
          updateInteractions(snap, localPos.x, localPos.z);
        } else {
          lastNearbyInteraction = null;
          lastNearbyBodyId = null;
          lastAttackTarget = null;
        }
        propsRef.current.onTelemetryChange({
          roomId: getRoomAt(localPos.x, localPos.z),
          playerX: localPos.x,
          playerZ: localPos.z,
          playerYaw: localPos.yaw,
          nearbyInteraction: lastNearbyInteraction,
          nearbyBodyId: lastNearbyBodyId,
          nearbyAttackTarget: lastAttackTarget,
          pointerLocked,
          graphicsUnavailable: !renderer || contextLost,
        });
      }

      if (renderer && isSoftwareGl && !contextLost) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        frameId = window.setTimeout(tick, 33);
        // Avoid queueing frames faster than a software renderer can complete them.
        if (sync && gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.UNSIGNALED) return;
        if (sync) gl.deleteSync(sync);
        renderer.render(scene, camera);
        sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      } else {
        if (!contextLost) renderer?.render(scene, camera);
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resetInput();
      resetInputRef.current = null;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerEnd);
      container.removeEventListener('pointercancel', onPointerEnd);
      container.removeEventListener('lostpointercapture', onPointerEnd);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', resetInput);
      window.removeEventListener('resize', onResize);

      avatars.forEach(({ rig }) => rig.dispose());
      bodyMeshes.forEach((bm) => bm.dispose());
      station?.disposables.forEach((d) => d.dispose());
      environment?.dispose();
      if (sync && !contextLost) (renderer?.getContext() as WebGL2RenderingContext | undefined)?.deleteSync(sync);
      keyLight.shadow.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
    };
  }, [remoteMotionRef]);

  const walking = (mode === 'playing' || mode === 'lobby') && !panelOpen && gateStartedAt === null;
  return (
    <div ref={mountRef} data-testid="station-3d-viewport" data-phase={mode} className="station-viewport fixed inset-0 select-none">
      {graphicsUnavailable && walking && (
        <p className="station-graphics-fallback" role="status">
          3D недоступно в этом браузере.{mode === 'playing' && ' Положение экипажа можно проверить на карте.'}
        </p>
      )}
      {touchAvailable && walking && <TouchJoystick knobRef={knobRef} />}
    </div>
  );
}
