import crypto from 'node:crypto';
import {
  INTERACT_RADIUS,
  KILL_RANGE,
  REPORT_RANGE,
  ROOM_BY_ID,
  ROOMS,
  SPAWN_POINTS,
  TERMINAL_BY_ID,
  distance2D,
  getRoomAt,
  hasLineOfSight,
  resolvePlayerMovement,
} from '../shared/mapData';
import {
  COMMON_TASK_IDS,
  LONG_TASK_IDS,
  SHORT_TASK_IDS,
  TASK_BY_ID,
  generateTaskChallenge,
  validateTaskAnswer,
  type ServerChallengeRecord,
} from '../shared/tasks';
import {
  DEFAULT_ROOM_SETTINGS,
  PLAYER_COLORS,
  ROOM_SETTINGS_LIMITS,
  SKIN_IDS,
  type ActionResponse,
  type BodyMarker,
  type ChatMessage,
  type ClientTaskState,
  type GamePhase,
  type LightsSabotageState,
  type MatchEndSummary,
  type MeetingResult,
  type MeetingState,
  type PlayerStatus,
  type PublicPlayerState,
  type Role,
  type RoomId,
  type RoomSettings,
  type RoomSnapshot,
  type SkinId,
  type SensorEchoSnapshot,
  type ShieldEventNotice,
  type ShieldUnlockReason,
  type TaskTypeId,
} from '../shared/types';

export const MIN_PLAYERS = ROOM_SETTINGS_LIMITS.maxPlayers.min;
export const MAX_PLAYERS = ROOM_SETTINGS_LIMITS.maxPlayers.max;
export const RECONNECT_WINDOW_MS = 30_000;
export const KILL_COOLDOWN_MS = DEFAULT_ROOM_SETTINGS.killCooldownSeconds * 1000;
export const INITIAL_KILL_COOLDOWN_MS = 12_000;
export const SABOTAGE_COOLDOWN_MS = 32_000;
export const INITIAL_SABOTAGE_COOLDOWN_MS = 15_000;
export const SHIELD_DURATION_MS = 2_000;
export const SHIELD_SLOW_DURATION_MS = 3_000;
export const MEETING_DURATION_MS = DEFAULT_ROOM_SETTINGS.meetingSeconds * 1000;
export const MEETING_RESULT_DELAY_MS = 5_000;
export const BASE_MOVE_SPEED = 6.2; // meters per second
const LOBBY_BOUND = 5.5;

interface InternalTaskStage {
  roomId: RoomId;
  terminalId: string;
  title: string;
  completed: boolean;
  readyAt?: number;
}

interface InternalTask {
  taskId: TaskTypeId;
  completed: boolean;
  currentStageIndex: number;
  stages: InternalTaskStage[];
  carryover?: Record<string, unknown>;
}

interface InternalPlayer {
  id: string;
  socketId: string | null;
  sessionToken: string;
  name: string;
  color: string;
  skin: SkinId;
  isHost: boolean;
  role: Role | null;
  status: PlayerStatus;
  connected: boolean;
  disconnectedUntil: number | null;
  permanentlyLeft: boolean;
  x: number;
  z: number;
  yaw: number;
  lastMoveAt: number;
  lastRoomId: RoomId | null;
  tasks: InternalTask[];
  activeChallenge: ServerChallengeRecord | null;
  shieldCharge: number;
  shieldActiveUntil: number;
  killCooldownUntil: number;
  sabotageCooldownUntil: number;
  slowedUntil: number;
  emergencyUsed: boolean;
}

interface InternalMeeting {
  id: string;
  reason: 'body' | 'emergency';
  callerId: string;
  callerName: string;
  victimId: string | null;
  victimName: string | null;
  victimRoomId: RoomId | null;
  startedAt: number;
  endsAt: number;
  resolveAt: number | null;
  votes: Map<string, string | 'skip'>;
  chat: ChatMessage[];
  result: MeetingResult | null;
}

export interface EngineCallbacks {
  onStateChange?: (roomCode: string) => void;
  onNotice?: (roomCode: string, targetPlayerIds: string[] | 'all', notice: ShieldEventNotice) => void;
  onLightsUpdated?: (roomCode: string, state: LightsSabotageState) => void;
  onChatMessage?: (roomCode: string, msg: ChatMessage) => void;
}

export interface EngineOptions {
  now?: () => number;
  rng?: () => number;
  callbacks?: EngineCallbacks;
}

function isValidRoomSettingNumber(value: unknown, limits: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= limits.min && value <= limits.max;
}

function sanitizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  return trimmed;
}

function generateCode(rng: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

function pickRandomDistinct<T>(items: T[], count: number, rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/**
 * Authoritative server-side room & match state machine for «Нулевая смена».
 * Decoupled from Socket.IO transport so all rules can be unit-tested deterministically.
 */
export class RoomGameEngine {
  readonly roomCode: string;
  phase: GamePhase = 'lobby';
  roundNumber = 0;

  private readonly now: () => number;
  private readonly rng: () => number;
  private readonly callbacks: EngineCallbacks;

  private settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  private players = new Map<string, InternalPlayer>();
  private bodies: BodyMarker[] = [];

  // Task progress & shield unlock state
  private completedCrewTasks = 0;
  private requiredCrewTasks = 0;
  private initialTotalCrewTasks = 0;
  private shieldUnlocked = false;
  private shieldUnlockReason: ShieldUnlockReason = null;

  // Sabotage lights
  private lightsOut = false;
  private lightsSwitches: boolean[] = [false, false, false, false, false];
  private lightsTargetSwitches: boolean[] = [true, true, true, true, true];

  // Sensor Echo timestamps (roomId -> last trigger timestamp in ms)
  private sensorLastTrigger = new Map<RoomId, number>();

  // Meeting & Match End
  private meeting: InternalMeeting | null = null;
  private matchEnd: MatchEndSummary | null = null;

  constructor(roomCode: string, options: EngineOptions = {}) {
    this.roomCode = roomCode;
    this.now = options.now ?? (() => Date.now());
    this.rng = options.rng ?? (() => Math.random());
    this.callbacks = options.callbacks ?? {};
  }

  static createRoomCode(rng: () => number = Math.random): string {
    return generateCode(rng);
  }

  private emitStateChange(): void {
    this.callbacks.onStateChange?.(this.roomCode);
  }

  private emitNotice(targets: string[] | 'all', type: ShieldEventNotice['type'], message: string): void {
    this.callbacks.onNotice?.(this.roomCode, targets, {
      type,
      message,
      timestamp: this.now(),
    });
  }

  getPlayerIds(): string[] {
    return [...this.players.values()].filter((p) => !p.permanentlyLeft).map((p) => p.id);
  }

  getSocketIdForPlayer(playerId: string): string | null {
    return this.players.get(playerId)?.socketId ?? null;
  }

  isEmpty(): boolean {
    for (const p of this.players.values()) {
      if (!p.permanentlyLeft && (p.connected || p.disconnectedUntil !== null)) {
        return false;
      }
    }
    return true;
  }

  private pickAvailableColor(): string {
    const used = new Set(
      [...this.players.values()].filter((p) => !p.permanentlyLeft).map((p) => p.color),
    );
    const free = PLAYER_COLORS.find((c) => !used.has(c.hex));
    return free ? free.hex : PLAYER_COLORS[0].hex;
  }

  addPlayer(
    rawName: string,
    socketId: string | null,
  ): { ok: boolean; error?: string; playerId?: string; sessionToken?: string } {
    const name = sanitizeName(rawName);
    if (name.length < 2) {
      return { ok: false, error: 'Введите имя от 2 до 18 символов.' };
    }
    if (this.phase !== 'lobby') {
      return { ok: false, error: 'Матч уже идёт. Дождитесь завершения смены.' };
    }
    const currentCount = [...this.players.values()].filter((p) => !p.permanentlyLeft).length;
    if (currentCount >= this.settings.maxPlayers) {
      return { ok: false, error: `В комнате нет свободных мест. Лимит: ${this.settings.maxPlayers}.` };
    }

    const id = `p_${crypto.randomBytes(6).toString('hex')}`;
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const isHost = currentCount === 0;
    const spawn = SPAWN_POINTS[currentCount % SPAWN_POINTS.length];

    const player: InternalPlayer = {
      id,
      socketId,
      sessionToken,
      name,
      color: this.pickAvailableColor(),
      skin: 'standard',
      isHost,
      role: null,
      status: 'alive',
      connected: true,
      disconnectedUntil: null,
      permanentlyLeft: false,
      x: spawn.x,
      z: spawn.z,
      yaw: spawn.yaw,
      lastMoveAt: this.now(),
      lastRoomId: 'command',
      tasks: [],
      activeChallenge: null,
      shieldCharge: 0,
      shieldActiveUntil: 0,
      killCooldownUntil: 0,
      sabotageCooldownUntil: 0,
      slowedUntil: 0,
      emergencyUsed: false,
    };

    this.players.set(id, player);
    this.emitStateChange();
    return { ok: true, playerId: id, sessionToken };
  }

  selectColor(playerId: string, colorHex: string): { ok: boolean; error?: string } {
    if (this.phase !== 'lobby') {
      return { ok: false, error: 'Цвет можно менять только в лобби.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft) return { ok: false, error: 'Игрок не найден.' };
    if (!PLAYER_COLORS.some((c) => c.hex === colorHex)) {
      return { ok: false, error: 'Недопустимый цвет скафандра.' };
    }
    const takenByOther = [...this.players.values()].some(
      (p) => !p.permanentlyLeft && p.id !== playerId && p.color === colorHex,
    );
    if (takenByOther) {
      return { ok: false, error: 'Этот цвет уже занят другим игроком.' };
    }
    player.color = colorHex;
    this.emitStateChange();
    return { ok: true };
  }

  selectSkin(playerId: string, skin: unknown): ActionResponse {
    if (this.phase !== 'lobby') return { ok: false, error: 'Скафандр можно менять только в лобби.' };
    const player = this.players.get(playerId);
    if (!player?.connected) return { ok: false, error: 'Игрок не найден.' };
    const selected = SKIN_IDS.find((id) => id === skin);
    if (!selected) return { ok: false, error: 'Неизвестная модель скафандра.' };
    if (player.skin !== selected) {
      player.skin = selected;
      this.emitStateChange();
    }
    return { ok: true };
  }

  updateSettings(playerId: string, patch: unknown): ActionResponse {
    if (this.phase !== 'lobby') return { ok: false, error: 'Правила можно менять только в лобби.' };
    const player = this.players.get(playerId);
    if (!player?.connected || !player.isHost) {
      return { ok: false, error: 'Только хозяин комнаты может менять правила.' };
    }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
      return { ok: false, error: 'Укажите настройки комнаты.' };
    }

    const next = { ...this.settings };
    for (const [key, value] of Object.entries(patch)) {
      switch (key) {
        case 'maxPlayers':
        case 'meetingSeconds':
        case 'killCooldownSeconds': {
          const limits = ROOM_SETTINGS_LIMITS[key];
          if (!isValidRoomSettingNumber(value, limits)) {
            return { ok: false, error: `Укажите целое значение от ${limits.min} до ${limits.max}.` };
          }
          next[key] = value;
          break;
        }
        case 'emergencyEnabled':
          if (typeof value !== 'boolean') {
            return { ok: false, error: 'Некорректное значение для экстренного созыва.' };
          }
          next.emergencyEnabled = value;
          break;
        default:
          return { ok: false, error: 'Неизвестная настройка комнаты.' };
      }
    }
    if (next.maxPlayers < this.getPlayerIds().length) {
      return { ok: false, error: 'Лимит не может быть меньше числа занятых мест.' };
    }
    this.settings = next;
    this.emitStateChange();
    return { ok: true };
  }

  reconnectPlayer(
    sessionToken: string,
    socketId: string | null,
  ): { ok: boolean; error?: string; playerId?: string } {
    const t = this.now();
    this.tick(t);

    const player = [...this.players.values()].find((p) => p.sessionToken === sessionToken);
    if (!player || player.permanentlyLeft) {
      return { ok: false, error: 'Сессия истекла или игрок уже выбыл из комнаты.' };
    }
    if (!player.connected && player.disconnectedUntil !== null && t > player.disconnectedUntil) {
      this.finalizeDisconnect(player);
      return { ok: false, error: 'Время переподключения (30 с) истекло.' };
    }

    player.socketId = socketId;
    player.connected = true;
    player.disconnectedUntil = null;
    player.lastMoveAt = t;
    this.emitStateChange();
    return { ok: true, playerId: player.id };
  }

  markDisconnected(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) return;

    player.connected = false;
    player.socketId = null;
    player.disconnectedUntil = this.now() + RECONNECT_WINDOW_MS;
    player.activeChallenge = null;

    if (player.isHost) {
      this.transferHostIfNeeded(playerId);
    }

    this.emitStateChange();
  }

  leaveExplicitly(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft) return;
    this.finalizeDisconnect(player);
  }

  private transferHostIfNeeded(leavingPlayerId: string): void {
    const leaving = this.players.get(leavingPlayerId);
    if (!leaving || !leaving.isHost) return;
    const candidate = [...this.players.values()].find(
      (p) => !p.permanentlyLeft && p.id !== leavingPlayerId && p.connected,
    ) ?? [...this.players.values()].find((p) => !p.permanentlyLeft && p.id !== leavingPlayerId);

    if (candidate) {
      leaving.isHost = false;
      candidate.isHost = true;
    }
  }

  private finalizeDisconnect(player: InternalPlayer): void {
    if (player.permanentlyLeft) return;
    const wasHost = player.isHost;
    player.connected = false;
    player.socketId = null;
    player.disconnectedUntil = null;
    player.permanentlyLeft = true;
    player.activeChallenge = null;

    if (wasHost) {
      this.transferHostIfNeeded(player.id);
    }

    if (this.phase === 'lobby') {
      this.players.delete(player.id);
      this.emitStateChange();
      return;
    }

    if (this.phase === 'playing' || this.phase === 'meeting') {
      const wasSaboteur = player.role === 'saboteur';
      const wasCrew = player.role === 'crew';
      player.status = 'eliminated';

      if (wasSaboteur) {
        this.endMatch(
          'crew',
          'saboteur_disconnected',
          `Саботажник (${player.name}) окончательно отключился — смена завершена победой экипажа.`,
        );
        return;
      }

      if (wasCrew) {
        // Exclude their unfinished tasks from requiredCrewTasks for win condition,
        // while keeping initialTotalCrewTasks FIXED and NOT counting unfinished tasks as completed for shield!
        const unfinished = player.tasks.filter((task) => !task.completed).length;
        this.requiredCrewTasks = Math.max(this.completedCrewTasks, this.requiredCrewTasks - unfinished);
      }

      // Check win conditions FIRST before checking shield unlock!
      if (this.checkAndApplyWinConditions()) {
        return;
      }

      this.evaluateShieldUnlock();

      // If in meeting and everyone remaining voted, resolve meeting
      if (this.phase === 'meeting' && this.meeting && !this.meeting.result) {
        this.checkMeetingAllVoted();
      }
    }

    this.emitStateChange();
  }

  /**
   * Periodic tick called by server timer (and manually in deterministic unit tests).
   */
  tick(nowOverride?: number): void {
    const t = nowOverride ?? this.now();

    // 1. Check 30-second disconnect grace timers
    for (const player of [...this.players.values()]) {
      if (!player.permanentlyLeft && !player.connected && player.disconnectedUntil !== null) {
        if (t >= player.disconnectedUntil) {
          this.finalizeDisconnect(player);
        }
      }
    }

    // 2. Check meeting vote timer & result transition
    if (this.phase === 'meeting' && this.meeting) {
      if (!this.meeting.result && t >= this.meeting.endsAt) {
        this.resolveMeetingVotes();
      } else if (this.meeting.result && this.meeting.resolveAt !== null && t >= this.meeting.resolveAt) {
        this.finishMeetingAndResume();
      }
    }
  }

  private getActivePlayers(): InternalPlayer[] {
    return [...this.players.values()].filter(
      (p) => !p.permanentlyLeft && p.status === 'alive',
    );
  }

  private getActiveConnectedPlayers(): InternalPlayer[] {
    return [...this.players.values()].filter(
      (p) => !p.permanentlyLeft && p.status === 'alive' && p.connected,
    );
  }

  private createTaskInstance(taskId: TaskTypeId): InternalTask {
    const def = TASK_BY_ID[taskId];
    return {
      taskId,
      completed: false,
      currentStageIndex: 0,
      stages: def.stages.map((s) => ({
        roomId: s.roomId,
        terminalId: s.terminalId,
        title: s.title,
        completed: false,
      })),
    };
  }

  startMatch(
    requesterId: string,
    forcedSaboteurIndex?: number,
  ): { ok: boolean; error?: string } {
    if (this.phase !== 'lobby') {
      return { ok: false, error: 'Матч уже запущен.' };
    }
    const requester = this.players.get(requesterId);
    if (!requester?.connected || !requester.isHost) {
      return { ok: false, error: 'Только хозяин комнаты может запустить смену.' };
    }
    const connectedPlayers = [...this.players.values()].filter(
      (p) => !p.permanentlyLeft && p.connected,
    );
    if (connectedPlayers.length < MIN_PLAYERS || connectedPlayers.length > this.settings.maxPlayers) {
      return {
        ok: false,
        error: `Для запуска нужно от ${MIN_PLAYERS} до ${this.settings.maxPlayers} подключённых игроков (сейчас ${connectedPlayers.length}).`,
      };
    }

    const t = this.now();
    this.roundNumber += 1;
    this.phase = 'playing';
    this.bodies = [];
    this.meeting = null;
    this.matchEnd = null;
    this.lightsOut = false;
    this.lightsSwitches = [true, true, true, true, true];
    this.lightsTargetSwitches = [true, true, true, true, true];
    this.shieldUnlocked = false;
    this.shieldUnlockReason = null;
    this.sensorLastTrigger.clear();

    // Choose exactly one saboteur
    const sabIdx =
      typeof forcedSaboteurIndex === 'number'
        ? Math.max(0, Math.min(connectedPlayers.length - 1, forcedSaboteurIndex))
        : Math.floor(this.rng() * connectedPlayers.length);

    // Choose 1 shared common task for everyone
    const commonTaskId = COMMON_TASK_IDS[Math.floor(this.rng() * COMMON_TASK_IDS.length)];

    let totalCrewTasks = 0;

    connectedPlayers.forEach((player, idx) => {
      const isSaboteur = idx === sabIdx;
      player.role = isSaboteur ? 'saboteur' : 'crew';
      player.status = 'alive';
      player.activeChallenge = null;
      player.shieldCharge = isSaboteur ? 0 : 1;
      player.shieldActiveUntil = 0;
      player.killCooldownUntil = isSaboteur ? t + INITIAL_KILL_COOLDOWN_MS : 0;
      player.sabotageCooldownUntil = isSaboteur ? t + INITIAL_SABOTAGE_COOLDOWN_MS : 0;
      player.slowedUntil = 0;
      player.emergencyUsed = false;

      const spawn = SPAWN_POINTS[idx % SPAWN_POINTS.length];
      player.x = spawn.x;
      player.z = spawn.z;
      player.yaw = spawn.yaw;
      player.lastMoveAt = t;
      player.lastRoomId = 'command';

      // Assign 1 shared common + 3 random short + 1 random long (5 tasks each)
      const shortIds = pickRandomDistinct(SHORT_TASK_IDS, 3, this.rng);
      const longIds = pickRandomDistinct(LONG_TASK_IDS, 1, this.rng);
      const assignedIds: TaskTypeId[] = [commonTaskId, ...shortIds, ...longIds];
      player.tasks = assignedIds.map((tid) => this.createTaskInstance(tid));

      if (!isSaboteur) {
        totalCrewTasks += player.tasks.length;
      }
    });

    // Record initial Command Hall sensor trigger
    this.sensorLastTrigger.set('command', t);

    this.completedCrewTasks = 0;
    this.requiredCrewTasks = totalCrewTasks;
    this.initialTotalCrewTasks = totalCrewTasks;

    this.emitStateChange();
    return { ok: true };
  }

  returnToLobby(requesterId: string): { ok: boolean; error?: string } {
    if (this.phase !== 'ended') {
      return { ok: false, error: 'Вернуться в лобби можно после завершения раунда.' };
    }
    const requester = this.players.get(requesterId);
    if (!requester || requester.permanentlyLeft) {
      return { ok: false, error: 'Игрок не найден.' };
    }

    this.phase = 'lobby';
    this.bodies = [];
    this.meeting = null;
    this.matchEnd = null;
    this.lightsOut = false;
    this.shieldUnlocked = false;
    this.shieldUnlockReason = null;
    this.completedCrewTasks = 0;
    this.requiredCrewTasks = 0;
    this.initialTotalCrewTasks = 0;
    this.sensorLastTrigger.clear();

    const t = this.now();
    let spawnIndex = 0;
    // Remove departed players and bring the remaining crew back to Command Hall.
    for (const [id, p] of [...this.players.entries()]) {
      if (p.permanentlyLeft || !p.connected) {
        this.players.delete(id);
      } else {
        p.role = null;
        p.status = 'alive';
        p.tasks = [];
        p.activeChallenge = null;
        p.shieldCharge = 0;
        p.shieldActiveUntil = 0;
        p.killCooldownUntil = 0;
        p.sabotageCooldownUntil = 0;
        p.slowedUntil = 0;
        p.emergencyUsed = false;
        const spawn = SPAWN_POINTS[spawnIndex++ % SPAWN_POINTS.length];
        p.x = spawn.x;
        p.z = spawn.z;
        p.yaw = spawn.yaw;
        p.lastMoveAt = t;
        p.lastRoomId = 'command';
      }
    }

    // Ensure someone is host
    const remaining = [...this.players.values()];
    if (remaining.length > 0 && !remaining.some((p) => p.isHost)) {
      remaining[0].isHost = true;
    }

    this.emitStateChange();
    return { ok: true };
  }

  /**
   * Authoritative player movement with speed limit, shield-slow penalty, collision resolution,
   * and Sensor Echo tracking (paused during blackout).
   */
  movePlayer(playerId: string, targetX: number, targetZ: number, yaw: number): boolean {
    if (this.phase !== 'playing' && this.phase !== 'lobby') return false;
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) return false;
    if (!Number.isFinite(targetX) || !Number.isFinite(targetZ) || !Number.isFinite(yaw)) return false;

    const t = this.now();
    const inLobby = this.phase === 'lobby';
    const elapsed = Math.max(0, Math.min(0.35, (t - player.lastMoveAt) / 1000));
    player.lastMoveAt = Math.max(player.lastMoveAt, t);

    const isSlowed = player.role === 'saboteur' && t < player.slowedUntil;
    const maxSpeed = isSlowed ? BASE_MOVE_SPEED * 0.52 : BASE_MOVE_SPEED;
    // Keep jitter tolerance, but never grant extra lobby distance per packet.
    const maxStep = inLobby ? maxSpeed * elapsed * 1.45 : maxSpeed * Math.max(0.016, elapsed) * 1.45 + 0.25;
    if (inLobby) {
      targetX = Math.max(-LOBBY_BOUND, Math.min(LOBBY_BOUND, targetX));
      targetZ = Math.max(-LOBBY_BOUND, Math.min(LOBBY_BOUND, targetZ));
    }

    let dx = targetX - player.x;
    let dz = targetZ - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist > maxStep && dist > 0) {
      const scale = maxStep / dist;
      dx *= scale;
      dz *= scale;
    }

    const resolved = resolvePlayerMovement(player.x, player.z, player.x + dx, player.z + dz);
    player.x = resolved.x;
    player.z = resolved.z;
    player.yaw = yaw;

    // Update Sensor Echo for alive players only when lights are ON
    if (this.phase === 'playing' && player.status === 'alive') {
      const newRoom = getRoomAt(player.x, player.z);
      if (newRoom && newRoom !== player.lastRoomId) {
        player.lastRoomId = newRoom;
        if (!this.lightsOut) {
          this.sensorLastTrigger.set(newRoom, t);
        }
      } else if (newRoom && !this.lightsOut) {
        // Refresh sensor when moving inside a room after lights come back on
        if (!this.sensorLastTrigger.has(newRoom)) {
          this.sensorLastTrigger.set(newRoom, t);
        }
      } else if (!newRoom) {
        player.lastRoomId = null;
      }
    }

    return true;
  }

  /**
   * Sensor Echo terminal in Command Hall.
   * Returns only elapsed seconds since last trigger per room — no names, roles, or live positions.
   */
  readSensorEcho(playerId: string): { ok: boolean; error?: string; snapshot?: SensorEchoSnapshot } {
    if (this.phase !== 'playing') return { ok: false, error: 'Терминал доступен только во время смены.' };
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    const term = TERMINAL_BY_ID['cmd_sensor_echo'];
    if (distance2D(player.x, player.z, term.x, term.z) > INTERACT_RADIUS + 0.5) {
      return { ok: false, error: 'Подойдите ближе к терминалу «Эхо датчика».' };
    }

    const t = this.now();
    const entries = ROOMS.map((room) => {
      const last = this.sensorLastTrigger.get(room.id);
      return {
        roomId: room.id,
        roomName: room.name,
        secondsAgo: typeof last === 'number' ? Math.max(0, Math.floor((t - last) / 1000)) : null,
      };
    });

    return {
      ok: true,
      snapshot: {
        pausedByBlackout: this.lightsOut,
        entries,
      },
    };
  }

  /**
   * Opens an interactive task terminal. Both alive players and eliminated crewmates (observers)
   * can complete their own assigned tasks via terminals.
   */
  openTask(
    playerId: string,
    taskId: TaskTypeId,
    terminalId: string,
  ): {
    ok: boolean;
    error?: string;
    taskId?: TaskTypeId;
    stageIndex?: number;
    title?: string;
    instruction?: string;
    payload?: Record<string, unknown>;
  } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Задания выполняются только в активной фазе.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    // Eliminated saboteur cannot do tasks; eliminated crew CAN finish remaining tasks in observer mode
    if (player.status === 'eliminated' && player.role !== 'crew') {
      return { ok: false, error: 'Наблюдатель-саботажник не может выполнять задания.' };
    }

    const task = player.tasks.find((item) => item.taskId === taskId);
    if (!task) {
      return { ok: false, error: 'Это задание не назначено вам.' };
    }
    if (task.completed) {
      return { ok: false, error: 'Задание уже выполнено.' };
    }

    const stage = task.stages[task.currentStageIndex];
    if (!stage || stage.terminalId !== terminalId) {
      return { ok: false, error: 'Сначала выполните предыдущий этап задания на нужном терминале.' };
    }

    const t = this.now();
    if (stage.readyAt && t < stage.readyAt) {
      const remainSec = Math.ceil((stage.readyAt - t) / 1000);
      return {
        ok: false,
        error: `Анализатор ещё работает — вернитесь через ${remainSec} с.`,
      };
    }

    const term = TERMINAL_BY_ID[terminalId];
    if (!term) return { ok: false, error: 'Терминал не найден.' };
    if (distance2D(player.x, player.z, term.x, term.z) > INTERACT_RADIUS + 0.5) {
      return { ok: false, error: 'Подойдите ближе к терминалу.' };
    }
    if (player.status === 'alive' && !hasLineOfSight(player.x, player.z, term.x, term.z)) {
      return { ok: false, error: 'Нет прямой видимости терминала.' };
    }

    const challenge = generateTaskChallenge(
      taskId,
      task.currentStageIndex,
      this.rng,
      t,
      task.carryover,
    );
    player.activeChallenge = challenge;

    const stageDef = TASK_BY_ID[taskId].stages[task.currentStageIndex];
    return {
      ok: true,
      taskId,
      stageIndex: task.currentStageIndex,
      title: stageDef.title,
      instruction: stageDef.instruction,
      payload: challenge.clientPayload,
    };
  }

  /**
   * Authoritatively verifies submitted task stage solution, rejects replays/stage skipping,
   * updates global repair progress ONLY on final stage for crewmates, and checks win + shield 50%.
   */
  submitTask(
    playerId: string,
    taskId: TaskTypeId,
    stageIndex: number,
    answer: Record<string, unknown>,
  ): { ok: boolean; error?: string; stageCompleted?: boolean; taskCompleted?: boolean } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Невозможно сдать задание вне активной фазы.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    if (player.status === 'eliminated' && player.role !== 'crew') {
      return { ok: false, error: 'Действие недоступно.' };
    }

    const task = player.tasks.find((item) => item.taskId === taskId);
    if (!task) return { ok: false, error: 'Задание не найдено.' };
    if (task.completed) return { ok: false, error: 'Задание уже засчитано ранее.' };
    if (task.currentStageIndex !== stageIndex) {
      return { ok: false, error: 'Нарушен порядок этапов задания.' };
    }

    const challenge = player.activeChallenge;
    if (!challenge || challenge.taskId !== taskId || challenge.stageIndex !== stageIndex) {
      return { ok: false, error: 'Сначала откройте терминал задания.' };
    }

    const stage = task.stages[stageIndex];
    const term = TERMINAL_BY_ID[stage.terminalId];
    if (!term || distance2D(player.x, player.z, term.x, term.z) > INTERACT_RADIUS + 0.8) {
      return { ok: false, error: 'Вы слишком далеко от терминала.' };
    }

    const check = validateTaskAnswer(challenge, answer);
    if (!check.valid) {
      return { ok: false, error: check.reason ?? 'Решение неверно.' };
    }

    // Consume active challenge immediately to prevent double submission
    player.activeChallenge = null;
    stage.completed = true;
    if (check.carryover) {
      task.carryover = { ...(task.carryover ?? {}), ...check.carryover };
    }

    const stageDef = TASK_BY_ID[taskId].stages[stageIndex];
    const isFinalStage = stageIndex >= task.stages.length - 1;

    if (!isFinalStage) {
      task.currentStageIndex = stageIndex + 1;
      if (stageDef.waitAfterMs && task.stages[task.currentStageIndex]) {
        task.stages[task.currentStageIndex].readyAt = this.now() + stageDef.waitAfterMs;
      }
      this.emitStateChange();
      return { ok: true, stageCompleted: true, taskCompleted: false };
    }

    // Final stage completed!
    task.completed = true;

    // Only real crewmates contribute to global repair progress (saboteur tasks are cover only)
    if (player.role === 'crew') {
      this.completedCrewTasks += 1;

      if (this.checkAndApplyWinConditions()) {
        return { ok: true, stageCompleted: true, taskCompleted: true };
      }

      this.evaluateShieldUnlock();
    }

    this.emitStateChange();
    return { ok: true, stageCompleted: true, taskCompleted: true };
  }

  /**
   * Evaluates Crew Self-Defense Shield unlock conditions.
   * Must ONLY be called after verifying the match has NOT ended!
   * Condition A: completedCrewTasks * 2 >= initialTotalCrewTasks (exact integer comparison, fixed denominator)
   * Condition B: activePlayersCount <= 3 (all active alive players including saboteur; observers excluded)
   */
  private evaluateShieldUnlock(): void {
    if (this.phase !== 'playing' && this.phase !== 'meeting') return;
    if (this.shieldUnlocked) return;

    const activeCount = this.getActivePlayers().length;

    if (this.initialTotalCrewTasks > 0 && this.completedCrewTasks * 2 >= this.initialTotalCrewTasks) {
      this.shieldUnlocked = true;
      this.shieldUnlockReason = 'tasks_50';
      const crewIds = [...this.players.values()]
        .filter((p) => !p.permanentlyLeft && p.role === 'crew' && p.status === 'alive')
        .map((p) => p.id);
      this.emitNotice(crewIds, 'unlocked', 'Щит экипажа разблокирован: выполнено 50% ремонта станции!');
      return;
    }

    if (activeCount <= 3) {
      this.shieldUnlocked = true;
      this.shieldUnlockReason = 'players_3';
      const crewIds = [...this.players.values()]
        .filter((p) => !p.permanentlyLeft && p.role === 'crew' && p.status === 'alive')
        .map((p) => p.id);
      this.emitNotice(crewIds, 'unlocked', 'Щит экипажа разблокирован: на станции осталось 3 активных участника!');
    }
  }

  /**
   * Crewmate activates 2-second personal shield with Q.
   * Consumes charge immediately even if no attack arrives.
   */
  activateShield(playerId: string): { ok: boolean; error?: string } {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'Во время собрания щит активировать нельзя.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    if (player.status !== 'alive') {
      return { ok: false, error: 'После выбывания щит недоступен.' };
    }
    if (player.role !== 'crew') {
      return { ok: false, error: 'Саботажник не имеет щита самообороны.' };
    }
    if (!this.shieldUnlocked) {
      return { ok: false, error: 'Щит ещё заблокирован.' };
    }
    if (player.shieldCharge <= 0) {
      return { ok: false, error: 'Заряд щита уже потрачен.' };
    }

    const t = this.now();
    player.shieldCharge = 0;
    player.shieldActiveUntil = t + SHIELD_DURATION_MS;
    this.emitNotice([player.id], 'activated', 'Персональный щит активен (2 с)!');
    this.emitStateChange();
    return { ok: true };
  }

  /**
   * Saboteur lights blackout sabotage.
   */
  sabotageLights(playerId: string): { ok: boolean; error?: string } {
    if (this.phase !== 'playing') return { ok: false, error: 'Саботаж доступен только во время смены.' };
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected || player.status !== 'alive') {
      return { ok: false, error: 'Действие недоступно.' };
    }
    if (player.role !== 'saboteur') {
      return { ok: false, error: 'Только саботажник может отключать свет.' };
    }
    if (this.lightsOut) {
      return { ok: false, error: 'Освещение уже отключено.' };
    }
    const t = this.now();
    if (t < player.sabotageCooldownUntil) {
      const sec = Math.ceil((player.sabotageCooldownUntil - t) / 1000);
      return { ok: false, error: `Перезарядка саботажа: ${sec} с.` };
    }

    this.lightsOut = true;
    // Generate non-matching switch states (at least 2 switches flipped off)
    this.lightsTargetSwitches = [true, true, true, true, true];
    this.lightsSwitches = [true, true, true, true, true];
    const indices = pickRandomDistinct([0, 1, 2, 3, 4], 3, this.rng);
    for (const idx of indices) {
      this.lightsSwitches[idx] = false;
    }

    this.callbacks.onLightsUpdated?.(this.roomCode, this.getLightsState());
    this.emitStateChange();
    return { ok: true };
  }

  getLightsState(): LightsSabotageState {
    return {
      active: this.lightsOut,
      switches: [...this.lightsSwitches],
      targetSwitches: [...this.lightsTargetSwitches],
    };
  }

  openLightsPanel(playerId: string): { ok: boolean; error?: string; state?: LightsSabotageState } {
    if (this.phase !== 'playing') return { ok: false, error: 'Недоступно сейчас.' };
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected || player.status !== 'alive') {
      return { ok: false, error: 'Восстановить свет может только активный игрок.' };
    }
    if (!this.lightsOut) {
      return { ok: false, error: 'Освещение станции в норме.' };
    }
    const panel = TERMINAL_BY_ID['ele_lights'];
    if (distance2D(player.x, player.z, panel.x, panel.z) > INTERACT_RADIUS + 0.5) {
      return { ok: false, error: 'Подойдите ближе к щиту освещения в электрощитовой.' };
    }
    return { ok: true, state: this.getLightsState() };
  }

  toggleLightsSwitch(
    playerId: string,
    index: number,
  ): { ok: boolean; error?: string; state?: LightsSabotageState; restored?: boolean } {
    const check = this.openLightsPanel(playerId);
    if (!check.ok) return check;
    if (!Number.isInteger(index) || index < 0 || index >= this.lightsSwitches.length) {
      return { ok: false, error: 'Неверный номер тумблера.' };
    }

    this.lightsSwitches[index] = !this.lightsSwitches[index];
    const allMatched = this.lightsSwitches.every((v, i) => v === this.lightsTargetSwitches[i]);

    if (allMatched) {
      this.lightsOut = false;
      const t = this.now();
      for (const p of this.players.values()) {
        if (p.role === 'saboteur') {
          p.sabotageCooldownUntil = t + SABOTAGE_COOLDOWN_MS;
        }
      }
      // Sensor Echo resumes collecting future room entries without backfilling the blackout gap!
      this.callbacks.onLightsUpdated?.(this.roomCode, this.getLightsState());
      this.emitStateChange();
      return { ok: true, state: this.getLightsState(), restored: true };
    }

    this.callbacks.onLightsUpdated?.(this.roomCode, this.getLightsState());
    return { ok: true, state: this.getLightsState(), restored: false };
  }

  /**
   * Saboteur attacks an active crewmate: checks proximity, line-of-sight, cooldown,
   * and target's 2-second personal shield!
   */
  attackPlayer(
    saboteurId: string,
    targetId: string,
  ): { ok: boolean; error?: string; blockedByShield?: boolean } {
    if (this.phase !== 'playing') return { ok: false, error: 'Атака возможна только во время смены.' };
    const saboteur = this.players.get(saboteurId);
    const target = this.players.get(targetId);

    if (!saboteur || saboteur.permanentlyLeft || !saboteur.connected || saboteur.status !== 'alive') {
      return { ok: false, error: 'Вы не можете атаковать.' };
    }
    if (saboteur.role !== 'saboteur') {
      return { ok: false, error: 'У экипажа нет способности атаки.' };
    }
    if (!target || target.permanentlyLeft || target.status !== 'alive' || target.id === saboteur.id) {
      return { ok: false, error: 'Цель недоступна.' };
    }

    const t = this.now();
    if (t < saboteur.killCooldownUntil) {
      const sec = Math.ceil((saboteur.killCooldownUntil - t) / 1000);
      return { ok: false, error: `Перезарядка атаки: ${sec} с.` };
    }

    const dist = distance2D(saboteur.x, saboteur.z, target.x, target.z);
    if (dist > KILL_RANGE) {
      return { ok: false, error: 'Цель слишком далеко.' };
    }
    if (!hasLineOfSight(saboteur.x, saboteur.z, target.x, target.z)) {
      return { ok: false, error: 'Цель скрыта за стеной или препятствием.' };
    }

    // Normal cooldown always starts whether blocked or landed
    saboteur.killCooldownUntil = t + this.settings.killCooldownSeconds * 1000;

    // Check if target's personal shield is active at this exact server processing moment!
    if (t <= target.shieldActiveUntil) {
      saboteur.slowedUntil = t + SHIELD_SLOW_DURATION_MS;
      this.emitNotice(
        [target.id],
        'blocked',
        'Щит отразил атаку саботажника! У вас есть 3 секунды, чтобы оторваться.',
      );
      this.emitNotice(
        [saboteur.id],
        'blocked',
        'Атака заблокирована щитом экипажа! Скорость снижена на 3 с.',
      );
      this.emitStateChange();
      return { ok: true, blockedByShield: true };
    }

    // Target eliminated -> enters observer mode & leaves a non-gory stasis beacon
    target.status = 'eliminated';
    target.activeChallenge = null;
    target.shieldActiveUntil = 0;

    this.bodies.push({
      id: `body_${crypto.randomBytes(4).toString('hex')}`,
      victimId: target.id,
      victimName: target.name,
      victimColor: target.color,
      x: target.x,
      z: target.z,
      roomId: getRoomAt(target.x, target.z),
      reported: false,
    });

    // Check win conditions BEFORE checking shield unlock condition B!
    if (this.checkAndApplyWinConditions()) {
      return { ok: true, blockedByShield: false };
    }

    this.evaluateShieldUnlock();
    this.emitStateChange();
    return { ok: true, blockedByShield: false };
  }

  callEmergencyMeeting(playerId: string): { ok: boolean; error?: string } {
    if (this.phase !== 'playing') return { ok: false, error: 'Собрание нельзя вызвать сейчас.' };
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected || player.status !== 'alive') {
      return { ok: false, error: 'Только активный игрок может созвать собрание.' };
    }
    if (!this.settings.emergencyEnabled) {
      return { ok: false, error: 'Экстренный созыв отключён правилами комнаты.' };
    }
    if (this.lightsOut) {
      return { ok: false, error: 'Во время отключения света кнопка экстренного собрания не работает.' };
    }
    if (player.emergencyUsed) {
      return { ok: false, error: 'Вы уже использовали экстренный вызов в этом раунде.' };
    }
    const btn = TERMINAL_BY_ID['cmd_emergency'];
    if (distance2D(player.x, player.z, btn.x, btn.z) > INTERACT_RADIUS + 0.5) {
      return { ok: false, error: 'Подойдите к кнопке в центре Командного зала.' };
    }

    player.emergencyUsed = true;
    this.startMeeting('emergency', player, null);
    return { ok: true };
  }

  reportBody(playerId: string, preferredBodyId?: string): { ok: boolean; error?: string } {
    if (this.phase !== 'playing') return { ok: false, error: 'Сообщить о выбывшем можно только во время смены.' };
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected || player.status !== 'alive') {
      return { ok: false, error: 'Только активный игрок может сообщить о выбывшем.' };
    }

    // Reporting a downed crewmate IS allowed even during blackout!
    const candidates = this.bodies.filter((b) => !b.reported);
    let found: BodyMarker | undefined;

    if (preferredBodyId) {
      found = candidates.find(
        (b) =>
          b.id === preferredBodyId &&
          distance2D(player.x, player.z, b.x, b.z) <= REPORT_RANGE &&
          hasLineOfSight(player.x, player.z, b.x, b.z),
      );
    }

    if (!found) {
      let bestDist = Infinity;
      for (const b of candidates) {
        const d = distance2D(player.x, player.z, b.x, b.z);
        if (d <= REPORT_RANGE && d < bestDist && hasLineOfSight(player.x, player.z, b.x, b.z)) {
          bestDist = d;
          found = b;
        }
      }
    }

    if (!found) {
      return { ok: false, error: 'Рядом нет выбывшего участника в зоне видимости.' };
    }

    found.reported = true;
    this.startMeeting('body', player, found);
    return { ok: true };
  }

  private startMeeting(
    reason: 'body' | 'emergency',
    caller: InternalPlayer,
    body: BodyMarker | null,
  ): void {
    const t = this.now();
    this.phase = 'meeting';

    // Close open task challenges & active shields
    for (const p of this.players.values()) {
      p.activeChallenge = null;
      p.shieldActiveUntil = 0;
    }

    this.meeting = {
      id: `meet_${crypto.randomBytes(4).toString('hex')}`,
      reason,
      callerId: caller.id,
      callerName: caller.name,
      victimId: body?.victimId ?? null,
      victimName: body?.victimName ?? null,
      victimRoomId: body?.roomId ?? null,
      startedAt: t,
      endsAt: t + this.settings.meetingSeconds * 1000,
      resolveAt: null,
      votes: new Map(),
      chat: [],
      result: null,
    };

    this.emitStateChange();
  }

  sendMeetingChat(playerId: string, rawText: string): { ok: boolean; error?: string } {
    if (this.phase !== 'meeting' || !this.meeting) {
      return { ok: false, error: 'Чат доступен только во время собрания.' };
    }
    if (this.meeting.result || this.now() >= this.meeting.endsAt) {
      return { ok: false, error: 'Обсуждение уже завершено.' };
    }
    const player = this.players.get(playerId);
    if (!player || player.permanentlyLeft || !player.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    if (player.status !== 'alive') {
      return { ok: false, error: 'Выбывшие наблюдатели не могут писать в чат активных игроков.' };
    }

    const text = rawText.trim().slice(0, 240);
    if (!text) return { ok: false, error: 'Пустое сообщение.' };

    const msg: ChatMessage = {
      id: `msg_${crypto.randomBytes(4).toString('hex')}`,
      senderId: player.id,
      senderName: player.name,
      senderColor: player.color,
      text,
      timestamp: this.now(),
    };

    this.meeting.chat.push(msg);
    if (this.meeting.chat.length > 80) {
      this.meeting.chat.shift();
    }

    this.callbacks.onChatMessage?.(this.roomCode, msg);
    return { ok: true };
  }

  castVote(playerId: string, targetId: string | 'skip'): { ok: boolean; error?: string } {
    if (this.phase !== 'meeting' || !this.meeting) {
      return { ok: false, error: 'Голосование не активно.' };
    }
    if (this.meeting.result || this.now() >= this.meeting.endsAt) {
      return { ok: false, error: 'Голосование уже завершено.' };
    }
    const voter = this.players.get(playerId);
    if (!voter || voter.permanentlyLeft || !voter.connected) {
      return { ok: false, error: 'Игрок не найден.' };
    }
    if (voter.status !== 'alive') {
      return { ok: false, error: 'Выбывшие игроки не могут голосовать.' };
    }
    if (this.meeting.votes.has(playerId)) {
      return { ok: false, error: 'Вы уже проголосовали в этом собрании.' };
    }

    if (targetId !== 'skip') {
      const target = this.players.get(targetId);
      if (!target || target.permanentlyLeft || target.status !== 'alive') {
        return { ok: false, error: 'Можно голосовать только за активных игроков.' };
      }
    }

    this.meeting.votes.set(playerId, targetId);
    this.checkMeetingAllVoted();
    this.emitStateChange();
    return { ok: true };
  }

  private checkMeetingAllVoted(): void {
    if (!this.meeting || this.meeting.result) return;
    const eligibleVoters = this.getActiveConnectedPlayers();
    if (eligibleVoters.length === 0) {
      this.resolveMeetingVotes();
      return;
    }
    const allVoted = eligibleVoters.every((p) => this.meeting!.votes.has(p.id));
    if (allVoted) {
      this.resolveMeetingVotes();
    }
  }

  private resolveMeetingVotes(): void {
    if (!this.meeting || this.meeting.result) return;

    const tallies: Record<string, number> = {};
    let skipVotes = 0;

    for (const [, choice] of this.meeting.votes.entries()) {
      if (choice === 'skip') {
        skipVotes += 1;
      } else {
        tallies[choice] = (tallies[choice] ?? 0) + 1;
      }
    }

    let topId: string | null = null;
    let topVotes = 0;
    let isTie = false;

    for (const [candidateId, count] of Object.entries(tallies)) {
      if (count > topVotes) {
        topId = candidateId;
        topVotes = count;
        isTie = false;
      } else if (count === topVotes && count > 0) {
        isTie = true;
      }
    }

    let result: MeetingResult;
    if (!topId || topVotes === 0 || skipVotes >= topVotes) {
      result = {
        outcome: isTie && skipVotes < topVotes ? 'tie' : 'skipped',
        ejectedPlayerId: null,
        ejectedPlayerName: null,
        tallies,
        skipVotes,
      };
    } else if (isTie) {
      result = {
        outcome: 'tie',
        ejectedPlayerId: null,
        ejectedPlayerName: null,
        tallies,
        skipVotes,
      };
    } else {
      const ejected = this.players.get(topId);
      if (ejected) {
        ejected.status = 'eliminated';
      }
      result = {
        outcome: 'ejected',
        ejectedPlayerId: topId,
        ejectedPlayerName: ejected?.name ?? null,
        tallies,
        skipVotes,
      };
    }

    this.meeting.result = result;
    this.meeting.resolveAt = this.now() + MEETING_RESULT_DELAY_MS;
    this.emitStateChange();
  }

  private finishMeetingAndResume(): void {
    if (this.phase !== 'meeting') return;

    this.meeting = null;

    // Clear all reported/old bodies on resume
    this.bodies = [];

    // Check win conditions FIRST!
    if (this.checkAndApplyWinConditions()) {
      return;
    }

    // Check shield unlock B (<= 3 active players) ONLY if match continues!
    this.evaluateShieldUnlock();

    // Resume play & place alive players around Command Hall
    const t = this.now();
    this.phase = 'playing';
    const alive = this.getActivePlayers();
    alive.forEach((p, idx) => {
      const spawn = SPAWN_POINTS[idx % SPAWN_POINTS.length];
      p.x = spawn.x;
      p.z = spawn.z;
      p.yaw = spawn.yaw;
      p.lastMoveAt = t;
      p.lastRoomId = 'command';
      if (p.role === 'saboteur') {
        p.killCooldownUntil = Math.max(p.killCooldownUntil, t + INITIAL_KILL_COOLDOWN_MS);
      }
    });

    if (!this.lightsOut) {
      this.sensorLastTrigger.set('command', t);
    }

    this.emitStateChange();
  }

  private checkAndApplyWinConditions(): boolean {
    if (this.phase !== 'playing' && this.phase !== 'meeting') return false;

    const allPlayers = [...this.players.values()].filter((p) => !p.permanentlyLeft);
    const saboteursAlive = allPlayers.filter((p) => p.role === 'saboteur' && p.status === 'alive');
    const crewAlive = allPlayers.filter((p) => p.role === 'crew' && p.status === 'alive');

    // 1. All saboteurs eliminated -> Crew wins
    if (saboteursAlive.length === 0) {
      this.endMatch('crew', 'saboteur_ejected', 'Саботажник исключён — станция спасена!');
      return true;
    }

    // 2. All required crew tasks completed -> Crew wins
    if (this.requiredCrewTasks > 0 && this.completedCrewTasks >= this.requiredCrewTasks) {
      this.endMatch('crew', 'tasks_completed', 'Все ремонтные задания выполнены — экипаж победил!');
      return true;
    }

    // 3. Active crew <= active saboteurs -> Saboteur wins
    if (crewAlive.length <= saboteursAlive.length) {
      this.endMatch(
        'saboteur',
        'saboteur_parity',
        'Активных членов экипажа осталось не больше, чем саботажников — победа саботажника!',
      );
      return true;
    }

    return false;
  }

  private endMatch(
    winner: Role,
    reasonCode: MatchEndSummary['reasonCode'],
    reasonText: string,
  ): void {
    const saboteur = [...this.players.values()].find((p) => p.role === 'saboteur');
    this.phase = 'ended';
    this.meeting = null;
    this.matchEnd = {
      winner,
      reasonCode,
      reasonText,
      saboteurId: saboteur?.id ?? '',
      saboteurName: saboteur?.name ?? 'Неизвестно',
      completedTasks: this.completedCrewTasks,
      totalRequiredTasks: this.requiredCrewTasks,
    };
    this.emitStateChange();
  }

  /**
   * Produces a strictly privacy-filtered snapshot for a specific player:
   * - Never reveals other players' roles until phase === 'ended'
   * - Never sends observer positions to active alive players
   * - Never sends other players' task lists or challenge secrets
   */
  getSnapshotForPlayer(viewerId: string): RoomSnapshot | null {
    const viewer = this.players.get(viewerId);
    if (!viewer || viewer.permanentlyLeft) return null;

    const viewerIsObserver = viewer.status === 'eliminated';
    const revealAllRoles = this.phase === 'ended';

    const publicPlayers: PublicPlayerState[] = [...this.players.values()]
      .filter((p) => !p.permanentlyLeft)
      .map((p) => {
        const hideObserverCoords =
          this.phase === 'playing' && !viewerIsObserver && p.status === 'eliminated' && p.id !== viewer.id;

        const pub: PublicPlayerState = {
          id: p.id,
          name: p.name,
          color: p.color,
          skin: p.skin,
          isHost: p.isHost,
          status: p.status,
          connected: p.connected,
          disconnectedUntil: p.disconnectedUntil,
          x: hideObserverCoords ? 0 : p.x,
          z: hideObserverCoords ? 0 : p.z,
          yaw: hideObserverCoords ? 0 : p.yaw,
          shieldActiveUntil: p.shieldActiveUntil,
        };
        if (revealAllRoles && p.role) {
          pub.revealedRole = p.role;
        }
        return pub;
      });

    const clientTasks: ClientTaskState[] = viewer.tasks.map((task) => {
      const def = TASK_BY_ID[task.taskId];
      return {
        taskId: task.taskId,
        title: def.title,
        category: def.category,
        completed: task.completed,
        currentStageIndex: task.currentStageIndex,
        stages: task.stages.map((s) => ({
          roomId: s.roomId,
          terminalId: s.terminalId,
          title: s.title,
          completed: s.completed,
          readyAt: s.readyAt,
        })),
      };
    });

    const meetingView: MeetingState | null = this.meeting
      ? {
          id: this.meeting.id,
          reason: this.meeting.reason,
          callerId: this.meeting.callerId,
          callerName: this.meeting.callerName,
          victimId: this.meeting.victimId,
          victimName: this.meeting.victimName,
          victimRoomId: this.meeting.victimRoomId,
          startedAt: this.meeting.startedAt,
          endsAt: this.meeting.endsAt,
          resolveAt: this.meeting.resolveAt,
          votedPlayerIds: [...this.meeting.votes.keys()],
          myVote: this.meeting.votes.get(viewerId) ?? null,
          chat: this.meeting.chat,
          result: this.meeting.result,
        }
      : null;

    return {
      roomCode: this.roomCode,
      phase: this.phase,
      roundNumber: this.roundNumber,
      serverTime: this.now(),
      settings: { ...this.settings },
      players: publicPlayers,
      bodies: this.bodies,
      lightsOut: this.lightsOut,
      completedCrewTasks: this.completedCrewTasks,
      requiredCrewTasks: this.requiredCrewTasks,
      initialTotalCrewTasks: this.initialTotalCrewTasks,
      activePlayersCount: this.getActivePlayers().length,
      shieldUnlocked: this.shieldUnlocked,
      shieldUnlockReason: this.shieldUnlockReason,
      meeting: meetingView,
      matchEnd: this.matchEnd,
      self: {
        playerId: viewer.id,
        sessionToken: viewer.sessionToken,
        role: viewer.role,
        tasks: clientTasks,
        shieldCharge: viewer.shieldCharge,
        shieldActiveUntil: viewer.shieldActiveUntil,
        killCooldownUntil: viewer.killCooldownUntil,
        sabotageCooldownUntil: viewer.sabotageCooldownUntil,
        slowedUntil: viewer.slowedUntil,
        emergencyUsed: viewer.emergencyUsed,
      },
    };
  }

  /** Helper strictly for tests / internal server inspection */
  getDebugPlayerRole(playerId: string): Role | null {
    return this.players.get(playerId)?.role ?? null;
  }

  getDebugActiveChallenge(playerId: string): ServerChallengeRecord | null {
    return this.players.get(playerId)?.activeChallenge ?? null;
  }

  setPlayerPositionForTest(playerId: string, x: number, z: number): void {
    const p = this.players.get(playerId);
    if (!p) return;
    p.x = x;
    p.z = z;
    p.lastRoomId = getRoomAt(x, z);
    if (this.phase === 'playing' && p.status === 'alive' && p.lastRoomId && !this.lightsOut) {
      this.sensorLastTrigger.set(p.lastRoomId, this.now());
    }
  }
}

export function getRoomLabel(roomId: RoomId | null): string {
  if (!roomId) return 'Коридор';
  return ROOM_BY_ID[roomId]?.name ?? 'Станция Каскад';
}
