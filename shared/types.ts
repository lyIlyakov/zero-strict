export type RoomId =
  | 'command'
  | 'comms'
  | 'electrical'
  | 'reactor'
  | 'storage'
  | 'medbay'
  | 'hydroponics'
  | 'navigation'
  | 'airlock';

export type Role = 'crew' | 'saboteur';

export type PlayerStatus = 'alive' | 'eliminated';

export type GamePhase = 'lobby' | 'playing' | 'meeting' | 'ended';

export type ShieldUnlockReason = 'tasks_50' | 'players_3' | null;

export type TaskCategory = 'common' | 'short' | 'long';

export type TaskTypeId =
  | 'sync_pass'
  | 'rewire_line'
  | 'tune_antenna'
  | 'replace_fuses'
  | 'clean_filter'
  | 'balance_pressure'
  | 'check_batteries'
  | 'reroute_power'
  | 'calibrate_gyro'
  | 'unload_container'
  | 'calibrate_shield'
  | 'find_leak'
  | 'transmit_telemetry'
  | 'analyze_sample'
  | 'start_backup_loop'
  | 'inspect_suit'
  | 'restore_irrigation'
  | 'update_station_route';

export interface PlayerColorOption {
  id: string;
  name: string;
  hex: string;
}

export const PLAYER_COLORS: PlayerColorOption[] = [
  { id: 'amber', name: 'Янтарный', hex: '#f59e0b' },
  { id: 'cyan', name: 'Лазурный', hex: '#38bdf8' },
  { id: 'emerald', name: 'Изумрудный', hex: '#10b981' },
  { id: 'crimson', name: 'Алый', hex: '#ef4444' },
  { id: 'violet', name: 'Кобальтовый', hex: '#8b5cf6' },
  { id: 'coral', name: 'Терракотовый', hex: '#fb7185' },
  { id: 'lime', name: 'Оливковый', hex: '#84cc16' },
  { id: 'silver', name: 'Титановый', hex: '#cbd5e1' },
];

export const SKIN_IDS = ['standard', 'survey', 'salvage', 'medic'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export interface RoomSettings {
  maxPlayers: number;
  meetingSeconds: number;
  killCooldownSeconds: number;
  emergencyEnabled: boolean;
}

export const ROOM_SETTINGS_LIMITS = {
  maxPlayers: { min: 2, max: 12 },
  meetingSeconds: { min: 30, max: 120 },
  killCooldownSeconds: { min: 10, max: 60 },
} as const;

export const DEFAULT_ROOM_SETTINGS: Readonly<RoomSettings> = {
  maxPlayers: 8,
  meetingSeconds: 60,
  killCooldownSeconds: 22,
  emergencyEnabled: true,
};

export interface PublicPlayerState {
  id: string;
  name: string;
  color: string;
  skin: SkinId;
  isHost: boolean;
  status: PlayerStatus;
  connected: boolean;
  disconnectedUntil: number | null;
  x: number;
  z: number;
  yaw: number;
  shieldActiveUntil: number;
  /** Only populated once phase === 'ended' */
  revealedRole?: Role;
}

export interface ClientTaskStage {
  roomId: RoomId;
  terminalId: string;
  title: string;
  completed: boolean;
  /** Used by analyze_sample stage 1->2 wait timer */
  readyAt?: number;
}

export interface ClientTaskState {
  taskId: TaskTypeId;
  title: string;
  category: TaskCategory;
  completed: boolean;
  currentStageIndex: number;
  stages: ClientTaskStage[];
}

export interface SelfPrivateState {
  playerId: string;
  sessionToken: string;
  role: Role | null;
  tasks: ClientTaskState[];
  shieldCharge: number;
  shieldActiveUntil: number;
  killCooldownUntil: number;
  sabotageCooldownUntil: number;
  slowedUntil: number;
  emergencyUsed: boolean;
}

export interface BodyMarker {
  id: string;
  victimId: string;
  victimName: string;
  victimColor: string;
  x: number;
  z: number;
  roomId: RoomId | null;
  reported: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

export interface MeetingResult {
  outcome: 'ejected' | 'tie' | 'skipped';
  ejectedPlayerId: string | null;
  ejectedPlayerName: string | null;
  tallies: Record<string, number>;
  skipVotes: number;
}

export interface MeetingState {
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
  votedPlayerIds: string[];
  myVote: string | 'skip' | null;
  chat: ChatMessage[];
  result: MeetingResult | null;
}

export interface MatchEndSummary {
  winner: Role;
  reasonCode:
    | 'tasks_completed'
    | 'saboteur_ejected'
    | 'saboteur_disconnected'
    | 'saboteur_parity';
  reasonText: string;
  saboteurId: string;
  saboteurName: string;
  completedTasks: number;
  totalRequiredTasks: number;
}

export interface SensorEchoRoomEntry {
  roomId: RoomId;
  roomName: string;
  secondsAgo: number | null;
}

export interface SensorEchoSnapshot {
  pausedByBlackout: boolean;
  entries: SensorEchoRoomEntry[];
}

export interface LightsSabotageState {
  active: boolean;
  switches: boolean[];
  targetSwitches: boolean[];
}

export interface RoomSnapshot {
  roomCode: string;
  phase: GamePhase;
  roundNumber: number;
  serverTime: number;
  settings: RoomSettings;
  players: PublicPlayerState[];
  bodies: BodyMarker[];
  lightsOut: boolean;
  completedCrewTasks: number;
  requiredCrewTasks: number;
  initialTotalCrewTasks: number;
  activePlayersCount: number;
  shieldUnlocked: boolean;
  shieldUnlockReason: ShieldUnlockReason;
  meeting: MeetingState | null;
  matchEnd: MatchEndSummary | null;
  self: SelfPrivateState;
}

export interface TaskChallengeResponse {
  ok: boolean;
  error?: string;
  taskId?: TaskTypeId;
  stageIndex?: number;
  title?: string;
  instruction?: string;
  payload?: Record<string, unknown>;
}

export interface ActionResponse {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface ShieldEventNotice {
  type: 'blocked' | 'unlocked' | 'activated';
  message: string;
  timestamp: number;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: { name: string },
    cb: (res: { ok: boolean; error?: string; roomCode?: string; sessionToken?: string; playerId?: string }) => void,
  ) => void;
  'room:join': (
    payload: { roomCode: string; name: string },
    cb: (res: { ok: boolean; error?: string; roomCode?: string; sessionToken?: string; playerId?: string }) => void,
  ) => void;
  'room:reconnect': (
    payload: { roomCode: string; sessionToken: string },
    cb: (res: { ok: boolean; error?: string; roomCode?: string; playerId?: string }) => void,
  ) => void;
  'room:selectColor': (
    payload: { color: string },
    cb: (res: ActionResponse) => void,
  ) => void;
  'room:skin': (payload: { skin: SkinId }, cb: (res: ActionResponse) => void) => void;
  'room:settings': (patch: Partial<RoomSettings>, cb: (res: ActionResponse) => void) => void;
  'room:leave': (cb?: (res: ActionResponse) => void) => void;
  'game:start': (cb: (res: ActionResponse) => void) => void;
  'game:returnToLobby': (cb: (res: ActionResponse) => void) => void;
  'player:move': (payload: { x: number; z: number; yaw: number }) => void;
  'task:open': (
    payload: { taskId: TaskTypeId; terminalId: string },
    cb: (res: TaskChallengeResponse) => void,
  ) => void;
  'task:submit': (
    payload: { taskId: TaskTypeId; stageIndex: number; answer: Record<string, unknown> },
    cb: (res: ActionResponse) => void,
  ) => void;
  'lights:open': (
    cb: (res: { ok: boolean; error?: string; state?: LightsSabotageState }) => void,
  ) => void;
  'lights:toggleSwitch': (
    payload: { index: number },
    cb: (res: { ok: boolean; error?: string; state?: LightsSabotageState; restored?: boolean }) => void,
  ) => void;
  'sabotage:lights': (cb: (res: ActionResponse) => void) => void;
  'sabotage:attack': (
    payload: { targetId: string },
    cb: (res: ActionResponse) => void,
  ) => void;
  'shield:activate': (cb: (res: ActionResponse) => void) => void;
  'meeting:callEmergency': (cb: (res: ActionResponse) => void) => void;
  'meeting:reportBody': (
    payload: { bodyId?: string },
    cb: (res: ActionResponse) => void,
  ) => void;
  'meeting:vote': (
    payload: { targetId: string | 'skip' },
    cb: (res: ActionResponse) => void,
  ) => void;
  'meeting:chat': (
    payload: { text: string },
    cb: (res: ActionResponse) => void,
  ) => void;
  'sensor:read': (
    cb: (res: { ok: boolean; error?: string; snapshot?: SensorEchoSnapshot }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'player:moved': (payload: { playerId: string; x: number; z: number; yaw: number; shieldActiveUntil: number }) => void;
  'game:notice': (notice: ShieldEventNotice) => void;
  'lights:updated': (state: LightsSabotageState) => void;
  'meeting:chatMessage': (msg: ChatMessage) => void;
}
