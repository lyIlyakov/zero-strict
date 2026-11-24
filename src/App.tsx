import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  LightsSabotageState,
  RoomSnapshot,
  RoomSettings,
  SkinId,
  SensorEchoSnapshot,
  ServerToClientEvents,
  ShieldEventNotice,
} from '../shared/types';
import {
  FirstPersonViewport,
  type NearbyInteraction,
  type RemoteMotionUpdate,
  type ViewportHudTelemetry,
} from './game/FirstPersonViewport';
import { soundEngine } from './game/sound';
import { MainMenu } from './components/MainMenu';
import { LobbyView } from './components/LobbyView';
import { GameHud } from './components/GameHud';
import { StationMapModal } from './components/StationMapModal';
import { SensorEchoModal } from './components/SensorEchoModal';
import { LightsRepairModal } from './components/LightsRepairModal';
import { MeetingModal } from './components/MeetingModal';
import { MatchEndModal } from './components/MatchEndModal';
import { PauseModal } from './components/PauseModal';
import { TaskModal, type ActiveTaskChallenge } from './components/TaskModal';
import './station-controls.css';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SavedSession {
  roomCode: string;
  sessionToken: string;
}

const DEFAULT_TELEMETRY: ViewportHudTelemetry = {
  roomId: 'command',
  playerX: 0,
  playerZ: 3.1,
  playerYaw: 0,
  nearbyInteraction: null,
  nearbyBodyId: null,
  nearbyAttackTarget: null,
  pointerLocked: false,
  graphicsUnavailable: false,
};

function getInitialQueryParams() {
  if (typeof window === 'undefined') return { room: '', autostart: false };
  const params = new URLSearchParams(window.location.search);
  return {
    room: (params.get('room') ?? '').trim().toUpperCase(),
    autostart: params.get('autostart') === '1',
  };
}

export default function App() {
  const initialParams = useRef(getInitialQueryParams());

  const socketRef = useRef<TypedSocket | null>(null);
  const sessionRef = useRef<SavedSession | null>(null);
  const remoteMotionRef = useRef<Map<string, RemoteMotionUpdate>>(new Map());
  const latestSnapshotRef = useRef<RoomSnapshot | null>(null);
  const overlayRequestRef = useRef(0);
  const dialogLayerRef = useRef<HTMLDivElement | null>(null);
  const prevLightsRef = useRef<boolean>(false);

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [lobbyPanelOpen, setLobbyPanelOpen] = useState(false);
  const [gateStartedAt, setGateStartedAt] = useState<number | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ShieldEventNotice | null>(null);

  // Settings
  const [sensitivity, setSensitivity] = useState(1.0);
  const [muted, setMuted] = useState(false);

  // Active overlays (while any is open, cursor unlocks & WASD pauses)
  const [mapOpen, setMapOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<ActiveTaskChallenge | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [sensorSnapshot, setSensorSnapshot] = useState<SensorEchoSnapshot | null>(null);
  const [lightsState, setLightsState] = useState<LightsSabotageState | null>(null);

  const [telemetry, setTelemetry] = useState<ViewportHudTelemetry>(DEFAULT_TELEMETRY);

  const flashError = useCallback((msg: string) => {
    setActionError(msg);
    soundEngine.playError();
    window.setTimeout(() => {
      setActionError((cur) => (cur === msg ? null : cur));
    }, 3500);
  }, []);

  const flashNotice = useCallback((n: ShieldEventNotice) => {
    setNotice(n);
    if (n.type === 'blocked') soundEngine.playShieldBlock();
    else if (n.type === 'activated') soundEngine.playShieldActivate();
    else soundEngine.playTerminalOpen();
    window.setTimeout(() => {
      setNotice((cur) => (cur?.timestamp === n.timestamp ? null : cur));
    }, 4500);
  }, []);

  // Initialize single persistent Socket.IO connection with automatic 30s session reconnect
  useEffect(() => {
    const socket: TypedSocket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const saved = sessionRef.current;
      if (saved) {
        socket.emit('room:reconnect', saved, (res) => {
          if (!res.ok) {
            sessionRef.current = null;
            latestSnapshotRef.current = null;
            remoteMotionRef.current.clear();
            overlayRequestRef.current++;
            setGateStartedAt(null);
            setSnapshot(null);
            setMenuError(res.error ?? 'Соединение с комнатой потеряно.');
          }
        });
      }
    });

    socket.on('room:snapshot', (nextSnap) => {
      const previous = latestSnapshotRef.current;
      const sameSession = previous?.self.sessionToken === nextSnap.self.sessionToken;
      const enteringPhase = !sameSession || previous?.phase !== nextSnap.phase;
      latestSnapshotRef.current = nextSnap;
      setSnapshot(nextSnap);
      if (enteringPhase) {
        overlayRequestRef.current++;
        setLobbyPanelOpen(false);
        setLobbyError(null);
        setActionError(null);
        setNotice(null);
        setTelemetry(DEFAULT_TELEMETRY);
        const opening = sameSession && previous?.phase === 'lobby' && nextSnap.phase === 'playing';
        setGateStartedAt(opening ? performance.now() : null);
        if (opening) soundEngine.playGate();
      }
      if (sameSession && nextSnap.phase === 'lobby') {
        const previousSelf = previous?.players.find((p) => p.id === nextSnap.self.playerId);
        const nextSelf = nextSnap.players.find((p) => p.id === nextSnap.self.playerId);
        if (previousSelf && nextSelf && previousSelf.skin !== nextSelf.skin) soundEngine.playSuit();
      }
      sessionRef.current = {
        roomCode: nextSnap.roomCode,
        sessionToken: nextSnap.self.sessionToken,
      };

      // Sync room code cleanly into browser URL without reloading
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('room') !== nextSnap.roomCode) {
          url.searchParams.set('room', nextSnap.roomCode);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        // Ignore history restriction in sandboxed iframes
      }

      // Update remote motion baselines from authoritative snapshot
      remoteMotionRef.current.clear();
      for (const p of nextSnap.players) {
        if (p.id !== nextSnap.self.playerId) {
          remoteMotionRef.current.set(p.id, {
            playerId: p.id,
            x: p.x,
            z: p.z,
            yaw: p.yaw,
            shieldActiveUntil: p.shieldActiveUntil,
          });
        }
      }

      // Close gameplay panels on phase change (meeting / ended / lobby)
      if (enteringPhase) {
        setMapOpen(false);
        setPauseOpen(false);
        setActiveTask(null);
        setTaskError(null);
        setSensorSnapshot(null);
        setLightsState(null);
      }

      // Audio feedback on phase & lights transitions
      if (enteringPhase) {
        if (nextSnap.phase === 'meeting') soundEngine.playAlarm();
        if (nextSnap.phase === 'ended' && nextSnap.matchEnd) {
          if (nextSnap.matchEnd.winner === nextSnap.self.role) {
            soundEngine.playVictory();
          } else {
            soundEngine.playDefeat();
          }
        }
      }

      if (prevLightsRef.current !== nextSnap.lightsOut) {
        if (nextSnap.lightsOut) soundEngine.playSabotageLights();
        else soundEngine.playLightsRestored();
        prevLightsRef.current = nextSnap.lightsOut;
      }
    });

    socket.on('player:moved', (payload) => {
      if (latestSnapshotRef.current?.players.some((p) => p.id === payload.playerId)) {
        remoteMotionRef.current.set(payload.playerId, payload);
      }
    });

    socket.on('game:notice', (incoming) => {
      flashNotice(incoming);
    });

    socket.on('lights:updated', (state) => {
      setLightsState((prev) => {
        if (!prev) return null;
        return state.active ? state : null;
      });
    });

    socket.on('meeting:chatMessage', (msg) => {
      setSnapshot((prev) => {
        if (!prev || !prev.meeting) return prev;
        if (prev.meeting.chat.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          meeting: {
            ...prev.meeting,
            chat: [...prev.meeting.chat, msg],
          },
        };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [flashNotice]);

  // Support ?autostart=1 for automated inspection (auto-creates a room cleanly)
  useEffect(() => {
    if (!initialParams.current.autostart) return;
    const timer = window.setTimeout(() => {
      if (!snapshot && socketRef.current) {
        socketRef.current.emit('room:create', { name: 'Пилот-1' }, () => {});
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  // Mirror state machine to document.body.dataset.state for accessibility & automated tests
  const viewportMode = snapshot?.phase;
  useEffect(() => {
    const bodyState =
      !snapshot
        ? 'title'
        : snapshot.phase === 'ended'
          ? 'gameover'
          : pauseOpen
            ? 'paused'
            : snapshot.phase;
    document.body.dataset.state = bodyState;
  }, [snapshot, pauseOpen]);

  const activePanel = mapOpen ? 'map' : pauseOpen ? 'pause' : activeTask ? 'task' :
    sensorSnapshot ? 'sensor' : lightsState ? 'lights' : null;
  const panelOpen = activePanel !== null || (viewportMode === 'lobby' && lobbyPanelOpen);
  const dialog = viewportMode === 'playing' ? activePanel :
    viewportMode === 'meeting' || viewportMode === 'ended' ? viewportMode : null;
  const handleGateOpened = useCallback(() => setGateStartedAt(null), []);

  useLayoutEffect(() => {
    if (!dialog) return;
    const layer = dialogLayerRef.current;
    // Native dialogs already manage focus and Tab, including LobbyView's panel.
    const panel = layer?.querySelector<HTMLElement>('[role="dialog"]:not(dialog)');
    if (!panel) return;
    const restoreFocus = document.activeElement;
    const selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = [...panel.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const focused = document.activeElement;
      if (!controls.some((el) => el === focused) || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    panel.addEventListener('keydown', containTab);
    return () => {
      panel.removeEventListener('keydown', containTab);
      if (restoreFocus instanceof HTMLElement && restoreFocus !== document.body && restoreFocus.isConnected) {
        restoreFocus.focus({ preventScroll: true });
      }
    };
  }, [dialog]);

  // Room & Lobby actions
  const handleCreateRoom = useCallback((name: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    setMenuBusy(true);
    setMenuError(null);
    socket.emit('room:create', { name }, (res) => {
      setMenuBusy(false);
      if (!res.ok) {
        setMenuError(res.error ?? 'Не удалось создать комнату.');
      }
    });
  }, []);

  const handleJoinRoom = useCallback((roomCode: string, name: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    setMenuBusy(true);
    setMenuError(null);
    socket.emit('room:join', { roomCode, name }, (res) => {
      setMenuBusy(false);
      if (!res.ok) {
        setMenuError(res.error ?? 'Не удалось войти в комнату.');
      }
    });
  }, []);

  const handleLobbyResponse = useCallback((res: { ok: boolean; error?: string }, fallback: string) => {
    if (latestSnapshotRef.current?.phase !== 'lobby') return;
    setLobbyError(res.ok ? null : res.error ?? fallback);
    if (!res.ok) soundEngine.playError();
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    socketRef.current?.emit('room:selectColor', { color }, (res) => handleLobbyResponse(res, 'Не удалось сменить цвет скафандра.'));
  }, [handleLobbyResponse]);

  const handleSelectSkin = useCallback((skin: SkinId) => {
    socketRef.current?.emit('room:skin', { skin }, (res) => handleLobbyResponse(res, 'Не удалось сменить модель скафандра.'));
  }, [handleLobbyResponse]);

  const handleSettings = useCallback((patch: Partial<RoomSettings>) => {
    socketRef.current?.emit('room:settings', patch, (res) => handleLobbyResponse(res, 'Не удалось сохранить правила комнаты.'));
  }, [handleLobbyResponse]);

  const handleStartMatch = useCallback(() => {
    socketRef.current?.emit('game:start', (res) => handleLobbyResponse(res, 'Не удалось начать раунд.'));
  }, [handleLobbyResponse]);

  const handleLeaveRoom = useCallback(() => {
    sessionRef.current = null;
    latestSnapshotRef.current = null;
    overlayRequestRef.current++;
    setGateStartedAt(null);
    setLobbyPanelOpen(false);
    socketRef.current?.emit('room:leave', () => {});
    setSnapshot(null);
    setPauseOpen(false);
    setMapOpen(false);
    setActiveTask(null);
    setSensorSnapshot(null);
    setLightsState(null);
    remoteMotionRef.current.clear();
  }, []);

  const handleReturnToLobby = useCallback(() => {
    socketRef.current?.emit('game:returnToLobby', (res) => {
      if (!res.ok && res.error) flashError(res.error);
    });
  }, [flashError]);

  // Gameplay actions
  const handleSendMove = useCallback((x: number, z: number, yaw: number) => {
    socketRef.current?.volatile.emit('player:move', { x, z, yaw });
  }, []);

  const handleInteract = useCallback(
    (interaction: NearbyInteraction) => {
      const socket = socketRef.current;
      if (!socket || gateStartedAt !== null || panelOpen) return;
      const request = ++overlayRequestRef.current;
      const isCurrent = () => overlayRequestRef.current === request && latestSnapshotRef.current?.phase === 'playing';

      if (interaction.kind === 'task' && interaction.taskId) {
        socket.emit(
          'task:open',
          { taskId: interaction.taskId, terminalId: interaction.terminalId },
          (res) => {
            if (!isCurrent()) return;
            if (!res.ok || !res.taskId || !res.payload) {
              flashError(res.error ?? 'Не удалось открыть терминал.');
              return;
            }
            soundEngine.playTerminalOpen();
            setTaskError(null);
            setActiveTask({
              taskId: res.taskId,
              stageIndex: res.stageIndex ?? 0,
              title: res.title ?? interaction.label,
              instruction: res.instruction ?? '',
              payload: res.payload,
            });
          },
        );
      } else if (interaction.kind === 'lights') {
        socket.emit('lights:open', (res) => {
          if (!isCurrent()) return;
          if (!res.ok || !res.state) {
            flashError(res.error ?? 'Щит освещения недоступен.');
            return;
          }
          soundEngine.playTerminalOpen();
          setLightsState(res.state);
        });
      } else if (interaction.kind === 'sensor_echo') {
        socket.emit('sensor:read', (res) => {
          if (!isCurrent()) return;
          if (!res.ok || !res.snapshot) {
            flashError(res.error ?? 'Терминал «Эхо датчика» недоступен.');
            return;
          }
          soundEngine.playTerminalOpen();
          setSensorSnapshot(res.snapshot);
        });
      } else if (interaction.kind === 'emergency') {
        socket.emit('meeting:callEmergency', (res) => {
          if (!res.ok) {
            flashError(res.error ?? 'Не удалось созвать собрание.');
          }
        });
      }
    },
    [flashError, gateStartedAt, panelOpen],
  );

  const handleTaskSubmit = useCallback(
    (answer: Record<string, unknown>) => {
      if (!activeTask || !socketRef.current) return;
      const request = overlayRequestRef.current;
      socketRef.current.emit(
        'task:submit',
        {
          taskId: activeTask.taskId,
          stageIndex: activeTask.stageIndex,
          answer,
        },
        (res) => {
          if (overlayRequestRef.current !== request) return;
          if (!res.ok) {
            soundEngine.playError();
            setTaskError(res.error ?? 'Проверьте решение.');
            return;
          }
          soundEngine.playTaskComplete();
          setActiveTask(null);
          setTaskError(null);
        },
      );
    },
    [activeTask],
  );

  const handleToggleLightsSwitch = useCallback(
    (index: number) => {
      const request = overlayRequestRef.current;
      soundEngine.playClick();
      socketRef.current?.emit('lights:toggleSwitch', { index }, (res) => {
        if (overlayRequestRef.current !== request) return;
        if (!res.ok) {
          flashError(res.error ?? 'Ошибка переключения.');
          return;
        }
        if (res.restored) {
          setLightsState(null);
        } else if (res.state) {
          setLightsState(res.state);
        }
      });
    },
    [flashError],
  );

  const handleRefreshSensor = useCallback(() => {
    const request = overlayRequestRef.current;
    soundEngine.playClick();
    socketRef.current?.emit('sensor:read', (res) => {
      if (overlayRequestRef.current !== request) return;
      if (res.ok && res.snapshot) {
        setSensorSnapshot(res.snapshot);
      } else {
        flashError(res.error ?? 'Не удалось обновить показания датчика.');
      }
    });
  }, [flashError]);

  const handleReportBody = useCallback(
    (bodyId: string) => {
      socketRef.current?.emit('meeting:reportBody', { bodyId }, (res) => {
        if (!res.ok) flashError(res.error ?? 'Не удалось сообщить о выбывшем.');
      });
    },
    [flashError],
  );

  const handleActivateShield = useCallback(() => {
    socketRef.current?.emit('shield:activate', (res) => {
      if (!res.ok && res.error) flashError(res.error);
    });
  }, [flashError]);

  const handleAttackTarget = useCallback(
    (targetId: string) => {
      socketRef.current?.emit('sabotage:attack', { targetId }, (res) => {
        if (!res.ok && res.error) {
          flashError(res.error);
        }
      });
    },
    [flashError],
  );

  const handleSabotageLights = useCallback(() => {
    socketRef.current?.emit('sabotage:lights', (res) => {
      if (!res.ok && res.error) flashError(res.error);
    });
  }, [flashError]);

  const handleVote = useCallback(
    (targetId: string | 'skip') => {
      socketRef.current?.emit('meeting:vote', { targetId }, (res) => {
        if (res.ok) soundEngine.playVote();
        else flashError(res.error ?? 'Не удалось сохранить голос.');
      });
    },
    [flashError],
  );

  const handleSendChat = useCallback((text: string) => {
    socketRef.current?.emit('meeting:chat', { text }, () => {});
  }, []);

  const closeGameplayPanels = useCallback(() => {
    overlayRequestRef.current++;
    setMapOpen(false);
    setPauseOpen(false);
    setActiveTask(null);
    setTaskError(null);
    setSensorSnapshot(null);
    setLightsState(null);
  }, []);

  const handleToggleMap = useCallback(() => {
    if (activePanel && activePanel !== 'map') return;
    overlayRequestRef.current++;
    setMapOpen((prev) => !prev);
  }, [activePanel]);

  const handleTogglePause = useCallback(() => {
    if (activePanel) closeGameplayPanels();
    else {
      overlayRequestRef.current++;
      setPauseOpen(true);
    }
  }, [activePanel, closeGameplayPanels]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0e15]">
      {snapshot && <FirstPersonViewport
        key={`${snapshot.roomCode}:${snapshot.self.playerId}`}
        mode={snapshot.phase}
        snapshot={snapshot}
        gateStartedAt={gateStartedAt}
        onGateOpened={handleGateOpened}
        panelOpen={panelOpen}
        sensitivity={sensitivity}
        remoteMotionRef={remoteMotionRef}
        onSendMove={handleSendMove}
        onTelemetryChange={setTelemetry}
        onInteract={handleInteract}
        onReportBody={handleReportBody}
        onActivateShield={handleActivateShield}
        onAttackTarget={handleAttackTarget}
        onSabotageLights={handleSabotageLights}
        onToggleMute={handleToggleMute}
        onToggleMap={handleToggleMap}
        onTogglePause={handleTogglePause}
      />}

      {/* Screen 1: Main Menu */}
      {!snapshot && (
        <MainMenu
          initialRoomCode={initialParams.current.room}
          initialName=""
          busy={menuBusy}
          error={menuError}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {/* Screen 2: Room Lobby */}
      {snapshot && snapshot.phase === 'lobby' && (
        <LobbyView
          snapshot={snapshot}
          sensitivity={sensitivity}
          error={lobbyError}
          onSensitivityChange={setSensitivity}
          onSelectColor={handleSelectColor}
          onSelectSkin={handleSelectSkin}
          onSettings={handleSettings}
          onPanelChange={setLobbyPanelOpen}
          onStartMatch={handleStartMatch}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Screen 3: Active 3D First-Person Gameplay HUD */}
      {snapshot && snapshot.phase === 'playing' && gateStartedAt !== null && (
        <p className="station-gate-status" role="status">Ворота открываются…</p>
      )}
      {snapshot && snapshot.phase === 'playing' && gateStartedAt === null && (
        <GameHud
          snapshot={snapshot}
          telemetry={telemetry}
          panelOpen={panelOpen}
          muted={muted}
          notice={notice}
          actionError={actionError}
          onToggleMap={handleToggleMap}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onInteract={handleInteract}
          onReportBody={handleReportBody}
          onActivateShield={handleActivateShield}
          onAttackTarget={handleAttackTarget}
          onSabotageLights={handleSabotageLights}
        />
      )}

      <div ref={dialogLayerRef} className="station-dialog-layer">
        {dialog && actionError && <p className="station-panel-error" role="alert">{actionError}</p>}
        {/* Gameplay Overlays */}
        {snapshot && snapshot.phase === 'playing' && mapOpen && (
          <StationMapModal
            snapshot={snapshot}
            playerX={telemetry.playerX}
            playerZ={telemetry.playerZ}
            playerYaw={telemetry.playerYaw}
            onClose={closeGameplayPanels}
          />
        )}

        {snapshot && snapshot.phase === 'playing' && activeTask && (
          <TaskModal
            challenge={activeTask}
            error={taskError}
            onSubmit={handleTaskSubmit}
            onClose={closeGameplayPanels}
          />
        )}

        {snapshot && snapshot.phase === 'playing' && sensorSnapshot && (
          <SensorEchoModal
            snapshot={sensorSnapshot}
            onRefresh={handleRefreshSensor}
            onClose={closeGameplayPanels}
          />
        )}

        {snapshot && snapshot.phase === 'playing' && lightsState && (
          <LightsRepairModal
            state={lightsState}
            onToggleSwitch={handleToggleLightsSwitch}
            onClose={closeGameplayPanels}
          />
        )}

        {snapshot && snapshot.phase === 'playing' && pauseOpen && (
          <PauseModal
            sensitivity={sensitivity}
            muted={muted}
            onSensitivityChange={setSensitivity}
            onToggleMute={handleToggleMute}
            onResume={closeGameplayPanels}
            onLeaveRoom={handleLeaveRoom}
          />
        )}

        {/* Screen 4: Meeting / Voting / Live Text Chat */}
        {snapshot && snapshot.phase === 'meeting' && (
          <MeetingModal
            snapshot={snapshot}
            onVote={handleVote}
            onSendChat={handleSendChat}
          />
        )}

        {/* Screen 5: Match End Summary & Return to Same Lobby */}
        {snapshot && snapshot.phase === 'ended' && (
          <MatchEndModal snapshot={snapshot} onReturnToLobby={handleReturnToLobby} />
        )}
      </div>
    </div>
  );
}
