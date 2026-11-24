import type { RoomId } from './types';

export interface Rect2D {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface RoomDefinition {
  id: RoomId;
  name: string;
  shortName: string;
  bounds: Rect2D;
  accentColor: string;
  floorTint: string;
  lightColor: string;
  description: string;
}

export interface CorridorDefinition {
  id: string;
  bounds: Rect2D;
  signA?: { x: number; z: number; yaw: number; text: string };
  signB?: { x: number; z: number; yaw: number; text: string };
}

export interface SolidObstacle {
  id: string;
  roomId: RoomId | 'corridor';
  bounds: Rect2D;
  height: number;
  blocksSight: boolean;
  kind: 'table' | 'core' | 'rack' | 'console' | 'bed' | 'hydro_tank' | 'crate' | 'transformer';
}

export interface TerminalPoint {
  id: string;
  roomId: RoomId;
  label: string;
  x: number;
  z: number;
  yaw: number;
  kind: 'task' | 'emergency' | 'sensor_echo' | 'lights';
}

export interface WallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  orientation: 'h' | 'v';
}

export interface DirectionalSign {
  x: number;
  z: number;
  yaw: number;
  text: string;
  accent: string;
}

export const STATION_BOUNDS: Rect2D = {
  x1: -37,
  z1: -23,
  x2: 37,
  z2: 23,
};

export const WALL_HEIGHT = 3.8;
export const PLAYER_RADIUS = 0.45;
export const PLAYER_EYE_HEIGHT = 1.62;
export const INTERACT_RADIUS = 3.0;
export const KILL_RANGE = 2.75;
export const REPORT_RANGE = 3.6;

/**
 * «Станция Каскад» — single-level orbital station with:
 * - Two full ring loops (West Technical Ring & East Operations Ring)
 * - Central transverse corridor connecting Reactor <-> Command <-> Airlock
 * - Central vertical spine connecting Medbay <-> Command <-> Storage
 * - Every remote compartment has at least 2–3 independent routes (zero dead ends).
 */
export const ROOMS: RoomDefinition[] = [
  {
    id: 'command',
    name: 'Командный зал',
    shortName: 'КОМАНДНЫЙ',
    bounds: { x1: -6, z1: -5, x2: 6, z2: 5 },
    accentColor: '#38bdf8',
    floorTint: '#1a2433',
    lightColor: '#cfe8ff',
    description: 'Центр управления, стол собраний и терминал «Эхо датчика».',
  },
  {
    id: 'medbay',
    name: 'Медотсек',
    shortName: 'МЕДОТСЕК',
    bounds: { x1: -5, z1: -21, x2: 5, z2: -13 },
    accentColor: '#2dd4bf',
    floorTint: '#17292b',
    lightColor: '#ccfbf1',
    description: 'Биоанализатор образцов и диагностические капсулы.',
  },
  {
    id: 'storage',
    name: 'Склад',
    shortName: 'СКЛАД',
    bounds: { x1: -6, z1: 13, x2: 6, z2: 21 },
    accentColor: '#f59e0b',
    floorTint: '#262118',
    lightColor: '#fef3c7',
    description: 'Грузовые контейнеры, резервные модули и уплотнители.',
  },
  {
    id: 'comms',
    name: 'Связь',
    shortName: 'СВЯЗЬ',
    bounds: { x1: -22, z1: -20, x2: -12, z2: -12 },
    accentColor: '#60a5fa',
    floorTint: '#192233',
    lightColor: '#dbeafe',
    description: 'Ретрансляторы телеметрии и антенный блок.',
  },
  {
    id: 'navigation',
    name: 'Навигация',
    shortName: 'НАВИГАЦИЯ',
    bounds: { x1: 12, z1: -20, x2: 22, z2: -12 },
    accentColor: '#818cf8',
    floorTint: '#1b1d33',
    lightColor: '#e0e7ff',
    description: 'Орбитальный курс, гироскопы и запись телеметрии.',
  },
  {
    id: 'reactor',
    name: 'Реакторная',
    shortName: 'РЕАКТОРНАЯ',
    bounds: { x1: -35, z1: -7, x2: -25, z2: 7 },
    accentColor: '#fb923c',
    floorTint: '#291c17',
    lightColor: '#ffedd5',
    description: 'Энергетическое ядро и резервный контур охлаждения.',
  },
  {
    id: 'airlock',
    name: 'Внешний шлюз',
    shortName: 'ШЛЮЗ',
    bounds: { x1: 25, z1: -7, x2: 35, z2: 7 },
    accentColor: '#94a3b8',
    floorTint: '#1e242c',
    lightColor: '#e2e8f0',
    description: 'Шлюзовая камера, проверка скафандров и клапаны давления.',
  },
  {
    id: 'electrical',
    name: 'Электрощитовая',
    shortName: 'ЭЛЕКТРО',
    bounds: { x1: -22, z1: 12, x2: -12, z2: 20 },
    accentColor: '#facc15',
    floorTint: '#262417',
    lightColor: '#fef9c3',
    description: 'Распределительные шины, батареи и панель освещения.',
  },
  {
    id: 'hydroponics',
    name: 'Гидропоника',
    shortName: 'ГИДРОПОНИКА',
    bounds: { x1: 12, z1: 12, x2: 22, z2: 20 },
    accentColor: '#34d399',
    floorTint: '#162821',
    lightColor: '#d1fae5',
    description: 'Оранжерея, насосы полива и воздушные фильтры.',
  },
];

export const ROOM_BY_ID: Record<RoomId, RoomDefinition> = Object.fromEntries(
  ROOMS.map((r) => [r.id, r]),
) as Record<RoomId, RoomDefinition>;

/**
 * Wide 4m corridors forming two outer ring loops + central transverse cross-corridor.
 */
export const CORRIDORS: CorridorDefinition[] = [
  // Central vertical spine: Medbay <-> Command <-> Storage
  { id: 'c_cmd_med', bounds: { x1: -2, z1: -13, x2: 2, z2: -5 } },
  { id: 'c_cmd_sto', bounds: { x1: -2, z1: 5, x2: 2, z2: 13 } },

  // Central transverse corridor: Reactor <-> Command <-> Airlock
  { id: 'c_rea_cmd', bounds: { x1: -25, z1: -2, x2: -6, z2: 2 } },
  { id: 'c_cmd_air', bounds: { x1: 6, z1: -2, x2: 25, z2: 2 } },

  // North horizontal ring: Comms <-> Medbay <-> Navigation
  { id: 'c_com_med', bounds: { x1: -12, z1: -18, x2: -5, z2: -14 } },
  { id: 'c_med_nav', bounds: { x1: 5, z1: -18, x2: 12, z2: -14 } },

  // South horizontal ring: Electrical <-> Storage <-> Hydroponics
  { id: 'c_ele_sto', bounds: { x1: -12, z1: 14, x2: -6, z2: 18 } },
  { id: 'c_sto_hyd', bounds: { x1: 6, z1: 14, x2: 12, z2: 18 } },

  // West outer ring elbows: Comms <-> Reactor <-> Electrical
  { id: 'c_com_rea_h', bounds: { x1: -32, z1: -18, x2: -22, z2: -14 } },
  { id: 'c_com_rea_v', bounds: { x1: -32, z1: -14, x2: -28, z2: -7 } },
  { id: 'c_rea_ele_v', bounds: { x1: -32, z1: 7, x2: -28, z2: 18 } },
  { id: 'c_rea_ele_h', bounds: { x1: -28, z1: 14, x2: -22, z2: 18 } },

  // East outer ring elbows: Navigation <-> Airlock <-> Hydroponics
  { id: 'c_nav_air_h', bounds: { x1: 22, z1: -18, x2: 32, z2: -14 } },
  { id: 'c_nav_air_v', bounds: { x1: 28, z1: -14, x2: 32, z2: -7 } },
  { id: 'c_air_hyd_v', bounds: { x1: 28, z1: 7, x2: 32, z2: 18 } },
  { id: 'c_air_hyd_h', bounds: { x1: 22, z1: 14, x2: 28, z2: 18 } },
];

export const WALKABLE_RECTS: Rect2D[] = [
  ...ROOMS.map((r) => r.bounds),
  ...CORRIDORS.map((c) => c.bounds),
];

/**
 * Large physical props inside rooms that provide silhouettes, landmarks, and collision.
 * Positioned so players always have >= 2m wide walk paths around every obstacle.
 */
export const SOLID_OBSTACLES: SolidObstacle[] = [
  // Command Hall central meeting table (low height so players can see across it!)
  {
    id: 'obs_cmd_table',
    roomId: 'command',
    bounds: { x1: -1.6, z1: -1.2, x2: 1.6, z2: 1.2 },
    height: 1.05,
    blocksSight: false,
    kind: 'table',
  },
  // Reactor central core (tall, blocks line of sight!)
  {
    id: 'obs_reactor_core',
    roomId: 'reactor',
    bounds: { x1: -31.8, z1: -1.8, x2: -28.2, z2: 1.8 },
    height: 3.6,
    blocksSight: true,
    kind: 'core',
  },
  // Storage central cargo rack
  {
    id: 'obs_storage_crates',
    roomId: 'storage',
    bounds: { x1: -1.5, z1: 16.0, x2: 1.5, z2: 18.0 },
    height: 2.0,
    blocksSight: true,
    kind: 'crate',
  },
  // Electrical transformer block
  {
    id: 'obs_elec_trans',
    roomId: 'electrical',
    bounds: { x1: -18.5, z1: 15.2, x2: -15.5, z2: 17.0 },
    height: 2.1,
    blocksSight: true,
    kind: 'transformer',
  },
  // Hydroponics twin grow beds
  {
    id: 'obs_hydro_bed_1',
    roomId: 'hydroponics',
    bounds: { x1: 14.5, z1: 15.0, x2: 19.5, z2: 16.8 },
    height: 1.15,
    blocksSight: false,
    kind: 'hydro_tank',
  },
  // Medbay diagnostic bed
  {
    id: 'obs_med_bed',
    roomId: 'medbay',
    bounds: { x1: -1.4, z1: -18.2, x2: 1.4, z2: -16.6 },
    height: 1.0,
    blocksSight: false,
    kind: 'bed',
  },
  // Comms server rack
  {
    id: 'obs_comms_rack',
    roomId: 'comms',
    bounds: { x1: -18.2, z1: -17.0, x2: -15.8, z2: -15.2 },
    height: 2.2,
    blocksSight: true,
    kind: 'rack',
  },
  // Navigation bridge console
  {
    id: 'obs_nav_console',
    roomId: 'navigation',
    bounds: { x1: 15.6, z1: -17.0, x2: 18.4, z2: -15.4 },
    height: 1.15,
    blocksSight: false,
    kind: 'console',
  },
  // Airlock pressure suit rack
  {
    id: 'obs_airlock_console',
    roomId: 'airlock',
    bounds: { x1: 29.0, z1: -1.3, x2: 31.4, z2: 1.3 },
    height: 1.25,
    blocksSight: false,
    kind: 'console',
  },
];

/**
 * Interactive terminals mounted cleanly near walls or central pedestals.
 */
export const TERMINALS: TerminalPoint[] = [
  // Command Hall
  { id: 'cmd_emergency', roomId: 'command', label: 'Кнопка экстренного собрания', x: 0, z: 0, yaw: 0, kind: 'emergency' },
  { id: 'cmd_sensor_echo', roomId: 'command', label: 'Терминал «Эхо датчика»', x: 4.5, z: -4.2, yaw: 0, kind: 'sensor_echo' },
  { id: 'cmd_pass', roomId: 'command', label: 'Панель пропуска', x: -4.5, z: -4.2, yaw: 0, kind: 'task' },
  { id: 'cmd_shield', roomId: 'command', label: 'Консоль щита станции', x: -4.5, z: 4.2, yaw: Math.PI, kind: 'task' },
  { id: 'cmd_route', roomId: 'command', label: 'Подтверждение маршрута', x: 4.5, z: 4.2, yaw: Math.PI, kind: 'task' },

  // Electrical
  { id: 'ele_lights', roomId: 'electrical', label: 'Щит освещения станции', x: -17.0, z: 19.3, yaw: Math.PI, kind: 'lights' },
  { id: 'ele_wires', roomId: 'electrical', label: 'Коммутационный узел', x: -13.0, z: 12.7, yaw: 0, kind: 'task' },
  { id: 'ele_fuses', roomId: 'electrical', label: 'Блок предохранителей', x: -21.3, z: 13.5, yaw: Math.PI / 2, kind: 'task' },
  { id: 'ele_batteries', roomId: 'electrical', label: 'Стенд батарей', x: -13.5, z: 19.3, yaw: Math.PI, kind: 'task' },

  // Comms
  { id: 'com_antenna', roomId: 'comms', label: 'Блок настройки антенны', x: -17.0, z: -19.3, yaw: 0, kind: 'task' },
  { id: 'com_uplink', roomId: 'comms', label: 'Передатчик телеметрии', x: -13.2, z: -12.7, yaw: Math.PI, kind: 'task' },

  // Navigation
  { id: 'nav_gyro', roomId: 'navigation', label: 'Гироскопический пост', x: 17.0, z: -19.3, yaw: 0, kind: 'task' },
  { id: 'nav_telemetry', roomId: 'navigation', label: 'Регистратор телеметрии', x: 21.3, z: -13.5, yaw: -Math.PI / 2, kind: 'task' },
  { id: 'nav_route', roomId: 'navigation', label: 'Навигационный прокладчик', x: 13.5, z: -12.7, yaw: Math.PI, kind: 'task' },

  // Reactor
  { id: 'rea_power', roomId: 'reactor', label: 'Маршрутизатор питания', x: -34.3, z: -3.5, yaw: Math.PI / 2, kind: 'task' },
  { id: 'rea_backup', roomId: 'reactor', label: 'Резервный контур', x: -34.3, z: 3.5, yaw: Math.PI / 2, kind: 'task' },

  // Storage
  { id: 'sto_container', roomId: 'storage', label: 'Терминал контейнера', x: -4.5, z: 20.3, yaw: Math.PI, kind: 'task' },
  { id: 'sto_module', roomId: 'storage', label: 'Стеллаж резервных модулей', x: 4.5, z: 20.3, yaw: Math.PI, kind: 'task' },
  { id: 'sto_seal', roomId: 'storage', label: 'Ящик уплотнителей', x: 4.5, z: 13.7, yaw: 0, kind: 'task' },

  // Medbay
  { id: 'med_sample', roomId: 'medbay', label: 'Биоанализатор образцов', x: 0, z: -20.3, yaw: 0, kind: 'task' },
  { id: 'med_leak', roomId: 'medbay', label: 'Диагностика магистралей', x: -4.2, z: -14.2, yaw: Math.PI, kind: 'task' },

  // Hydroponics
  { id: 'hyd_filter', roomId: 'hydroponics', label: 'Воздушный фильтр', x: 17.0, z: 12.7, yaw: 0, kind: 'task' },
  { id: 'hyd_pump', roomId: 'hydroponics', label: 'Насос полива', x: 14.0, z: 19.3, yaw: Math.PI, kind: 'task' },
  { id: 'hyd_manifold', roomId: 'hydroponics', label: 'Коллектор трёх линий', x: 20.2, z: 19.3, yaw: Math.PI, kind: 'task' },

  // Airlock
  { id: 'air_pressure', roomId: 'airlock', label: 'Клапан давления шлюза', x: 34.3, z: -3.5, yaw: -Math.PI / 2, kind: 'task' },
  { id: 'air_suit', roomId: 'airlock', label: 'Стенд проверки скафандра', x: 34.3, z: 3.5, yaw: -Math.PI / 2, kind: 'task' },
];

export const TERMINAL_BY_ID: Record<string, TerminalPoint> = Object.fromEntries(
  TERMINALS.map((t) => [t.id, t]),
);

/**
 * Directional corridor signs to aid 1st-person spatial navigation.
 */
export const DIRECTIONAL_SIGNS: DirectionalSign[] = [
  // Inside Command Hall pointing to all 4 exits
  { x: 0, z: -4.85, yaw: 0, text: '↑ МЕДОТСЕК · СВЯЗЬ · НАВИГАЦИЯ', accent: '#2dd4bf' },
  { x: 0, z: 4.85, yaw: Math.PI, text: '↑ СКЛАД · ЭЛЕКТРО · ГИДРОПОНИКА', accent: '#f59e0b' },
  { x: -5.85, z: 0, yaw: Math.PI / 2, text: '↑ РЕАКТОРНАЯ', accent: '#fb923c' },
  { x: 5.85, z: 0, yaw: -Math.PI / 2, text: '↑ ВНЕШНИЙ ШЛЮЗ', accent: '#94a3b8' },

  // Transverse corridors
  { x: -15.5, z: -1.85, yaw: 0, text: '← РЕАКТОРНАЯ   |   КОМАНДНЫЙ →', accent: '#fb923c' },
  { x: 15.5, z: -1.85, yaw: 0, text: '← КОМАНДНЫЙ   |   ШЛЮЗ →', accent: '#94a3b8' },

  // North & South rings
  { x: -8.5, z: -17.85, yaw: 0, text: '← СВЯЗЬ   |   МЕДОТСЕК →', accent: '#60a5fa' },
  { x: 8.5, z: -17.85, yaw: 0, text: '← МЕДОТСЕК   |   НАВИГАЦИЯ →', accent: '#818cf8' },
  { x: -9.0, z: 17.85, yaw: Math.PI, text: '← СКЛАД   |   ЭЛЕКТРО →', accent: '#facc15' },
  { x: 9.0, z: 17.85, yaw: Math.PI, text: '← ГИДРОПОНИКА   |   СКЛАД →', accent: '#34d399' },

  // Outer West & East rings
  { x: -31.85, z: -10.5, yaw: Math.PI / 2, text: '← СВЯЗЬ   |   РЕАКТОРНАЯ →', accent: '#fb923c' },
  { x: -31.85, z: 10.5, yaw: Math.PI / 2, text: '← РЕАКТОРНАЯ   |   ЭЛЕКТРО →', accent: '#facc15' },
  { x: 31.85, z: -10.5, yaw: -Math.PI / 2, text: '← ШЛЮЗ   |   НАВИГАЦИЯ →', accent: '#818cf8' },
  { x: 31.85, z: 10.5, yaw: -Math.PI / 2, text: '← ГИДРОПОНИКА   |   ШЛЮЗ →', accent: '#34d399' },
];

/**
 * Spawn positions around Command Hall table (facing inward toward the table and crewmates).
 */
export const SPAWN_POINTS: Array<{ x: number; z: number; yaw: number }> = [
  { x: 0, z: 3.1, yaw: 0 },
  { x: 0, z: -3.1, yaw: Math.PI },
  { x: 3.3, z: 0, yaw: Math.PI / 2 },
  { x: -3.3, z: 0, yaw: -Math.PI / 2 },
  { x: 2.5, z: 2.5, yaw: Math.PI * 0.25 },
  { x: -2.5, z: 2.5, yaw: -Math.PI * 0.25 },
  { x: 2.5, z: -2.5, yaw: Math.PI * 0.75 },
  { x: -2.5, z: -2.5, yaw: -Math.PI * 0.75 },
];

/**
 * Deterministically compiles the exact outer perimeter wall segments of WALKABLE_RECTS
 * by subdividing each rectangle edge against all other overlapping rectangles.
 * Guarantees 100% consistency across 3D geometry, collision checks, LOS, and the 2D Tab map.
 */
function subtractInterval(
  start: number,
  end: number,
  cuts: Array<[number, number]>,
): Array<[number, number]> {
  let remaining: Array<[number, number]> = [[start, end]];
  for (const [c1, c2] of cuts) {
    const next: Array<[number, number]> = [];
    for (const [r1, r2] of remaining) {
      if (c2 <= r1 + 1e-4 || c1 >= r2 - 1e-4) {
        next.push([r1, r2]);
      } else {
        if (c1 > r1 + 1e-4) next.push([r1, c1]);
        if (c2 < r2 - 1e-4) next.push([c2, r2]);
      }
    }
    remaining = next;
  }
  return remaining;
}

export function compilePerimeterWalls(rects: Rect2D[] = WALKABLE_RECTS): WallSegment[] {
  const segments: WallSegment[] = [];
  const eps = 1e-3;

  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];

    // Top edge (z = r.z1)
    const topCuts: Array<[number, number]> = [];
    // Bottom edge (z = r.z2)
    const botCuts: Array<[number, number]> = [];
    // Left edge (x = r.x1)
    const leftCuts: Array<[number, number]> = [];
    // Right edge (x = r.x2)
    const rightCuts: Array<[number, number]> = [];

    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue;
      const o = rects[j];

      // Adjacent or overlapping top edge: o covers z just outside r.z1 (o.z1 < r.z1 && o.z2 >= r.z1 - eps)
      if (o.z1 < r.z1 - eps && o.z2 >= r.z1 - eps) {
        const xMin = Math.max(r.x1, o.x1);
        const xMax = Math.min(r.x2, o.x2);
        if (xMax > xMin + eps) topCuts.push([xMin, xMax]);
      }

      // Bottom edge
      if (o.z2 > r.z2 + eps && o.z1 <= r.z2 + eps) {
        const xMin = Math.max(r.x1, o.x1);
        const xMax = Math.min(r.x2, o.x2);
        if (xMax > xMin + eps) botCuts.push([xMin, xMax]);
      }

      // Left edge
      if (o.x1 < r.x1 - eps && o.x2 >= r.x1 - eps) {
        const zMin = Math.max(r.z1, o.z1);
        const zMax = Math.min(r.z2, o.z2);
        if (zMax > zMin + eps) leftCuts.push([zMin, zMax]);
      }

      // Right edge
      if (o.x2 > r.x2 + eps && o.x1 <= r.x2 + eps) {
        const zMin = Math.max(r.z1, o.z1);
        const zMax = Math.min(r.z2, o.z2);
        if (zMax > zMin + eps) rightCuts.push([zMin, zMax]);
      }
    }

    for (const [a, b] of subtractInterval(r.x1, r.x2, topCuts)) {
      segments.push({ x1: a, z1: r.z1, x2: b, z2: r.z1, orientation: 'h' });
    }
    for (const [a, b] of subtractInterval(r.x1, r.x2, botCuts)) {
      segments.push({ x1: a, z1: r.z2, x2: b, z2: r.z2, orientation: 'h' });
    }
    for (const [a, b] of subtractInterval(r.z1, r.z2, leftCuts)) {
      segments.push({ x1: r.x1, z1: a, x2: r.x1, z2: b, orientation: 'v' });
    }
    for (const [a, b] of subtractInterval(r.z1, r.z2, rightCuts)) {
      segments.push({ x1: r.x2, z1: a, x2: r.x2, z2: b, orientation: 'v' });
    }
  }

  return segments;
}

export const WALL_SEGMENTS: WallSegment[] = compilePerimeterWalls(WALKABLE_RECTS);

export function pointInRect(x: number, z: number, r: Rect2D, margin = 0): boolean {
  return x >= r.x1 - margin && x <= r.x2 + margin && z >= r.z1 - margin && z <= r.z2 + margin;
}

export function getRoomAt(x: number, z: number): RoomId | null {
  for (const room of ROOMS) {
    if (pointInRect(x, z, room.bounds, 0.01)) {
      return room.id;
    }
  }
  return null;
}

export function isPointWalkable(x: number, z: number, radius = PLAYER_RADIUS): boolean {
  // Check 4 cardinal + 4 diagonal samples around player disc are inside union of walkable rects
  const offsets: Array<[number, number]> = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.72, radius * 0.72],
    [-radius * 0.72, radius * 0.72],
    [radius * 0.72, -radius * 0.72],
    [-radius * 0.72, -radius * 0.72],
  ];

  for (const [ox, oz] of offsets) {
    const px = x + ox;
    const pz = z + oz;
    let insideAny = false;
    for (const rect of WALKABLE_RECTS) {
      if (pointInRect(px, pz, rect, 0.001)) {
        insideAny = true;
        break;
      }
    }
    if (!insideAny) return false;
  }

  // Check against solid obstacles (circle vs AABB)
  for (const obs of SOLID_OBSTACLES) {
    const cx = Math.max(obs.bounds.x1, Math.min(x, obs.bounds.x2));
    const cz = Math.max(obs.bounds.z1, Math.min(z, obs.bounds.z2));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) {
      return false;
    }
  }

  return true;
}

/**
 * Smooth wall-sliding collision resolution shared identically by client prediction and server validation.
 */
export function resolvePlayerMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius = PLAYER_RADIUS,
): { x: number; z: number } {
  // Sub-step long movements to prevent tunneling across corners
  const totalDx = toX - fromX;
  const totalDz = toZ - fromZ;
  const dist = Math.hypot(totalDx, totalDz);
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  let curX = fromX;
  let curZ = fromZ;
  const stepDx = totalDx / steps;
  const stepDz = totalDz / steps;

  for (let s = 0; s < steps; s++) {
    const tryX = curX + stepDx;
    const tryZ = curZ + stepDz;
    if (isPointWalkable(tryX, tryZ, radius)) {
      curX = tryX;
      curZ = tryZ;
    } else if (isPointWalkable(tryX, curZ, radius)) {
      curX = tryX;
    } else if (isPointWalkable(curX, tryZ, radius)) {
      curZ = tryZ;
    }
  }

  return { x: curX, z: curZ };
}

function segmentsIntersect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = dx - cx;
  const sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-8) return false;
  const u = ((cx - ax) * rZ - (cz - az) * rX) / denom;
  const t = ((cx - ax) * sZ - (cz - az) * sX) / denom;
  return t > 0.001 && t < 0.999 && u >= -0.001 && u <= 1.001;
}

function segmentIntersectsRect(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  r: Rect2D,
): boolean {
  if (pointInRect(x1, z1, r) || pointInRect(x2, z2, r)) return true;
  return (
    segmentsIntersect(x1, z1, x2, z2, r.x1, r.z1, r.x2, r.z1) ||
    segmentsIntersect(x1, z1, x2, z2, r.x1, r.z2, r.x2, r.z2) ||
    segmentsIntersect(x1, z1, x2, z2, r.x1, r.z1, r.x1, r.z2) ||
    segmentsIntersect(x1, z1, x2, z2, r.x2, r.z1, r.x2, r.z2)
  );
}

/**
 * Server & client line-of-sight check: returns false if any station wall or tall sight-blocking
 * obstacle intersects the segment from (x1, z1) to (x2, z2), or if midpoint exits walkable space.
 */
export function hasLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
  for (const w of WALL_SEGMENTS) {
    if (segmentsIntersect(x1, z1, x2, z2, w.x1, w.z1, w.x2, w.z2)) {
      return false;
    }
  }
  for (const obs of SOLID_OBSTACLES) {
    if (!obs.blocksSight) continue;
    if (segmentIntersectsRect(x1, z1, x2, z2, obs.bounds)) {
      return false;
    }
  }
  // Extra safeguard: verify interior samples stay inside walkable union (prevents cutting across outer void corners)
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const samples = Math.max(2, Math.ceil(dist / 0.8));
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const sx = x1 + (x2 - x1) * t;
    const sz = z1 + (z2 - z1) * t;
    let inside = false;
    for (const rect of WALKABLE_RECTS) {
      if (pointInRect(sx, sz, rect, 0.05)) {
        inside = true;
        break;
      }
    }
    if (!inside) return false;
  }
  return true;
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  return Math.hypot(x2 - x1, z2 - z1);
}
