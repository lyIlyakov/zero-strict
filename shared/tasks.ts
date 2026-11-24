import type { RoomId, TaskCategory, TaskTypeId } from './types';

export interface TaskStageDefinition {
  roomId: RoomId;
  terminalId: string;
  title: string;
  instruction: string;
  /** Optional wait duration (ms) after this stage before the next stage opens */
  waitAfterMs?: number;
}

export interface TaskDefinition {
  id: TaskTypeId;
  title: string;
  category: TaskCategory;
  stages: TaskStageDefinition[];
}

export const TASK_CATALOG: TaskDefinition[] = [
  // === ОБЩИЕ (2) ===
  {
    id: 'sync_pass',
    title: 'Синхронизировать пропуск',
    category: 'common',
    stages: [
      {
        roomId: 'command',
        terminalId: 'cmd_pass',
        title: 'Сопоставить символы пропуска',
        instruction: 'Выберите на панели доступа символы, совпадающие с вашим пропуском.',
      },
    ],
  },
  {
    id: 'rewire_line',
    title: 'Перекоммутировать линию',
    category: 'common',
    stages: [
      {
        roomId: 'electrical',
        terminalId: 'ele_wires',
        title: 'Соединить кабели по цвету и значку',
        instruction: 'Соедините каждый левый разъём с правым по совпадению цвета и геометрического значка.',
      },
    ],
  },

  // === КОРОТКИЕ (10) ===
  {
    id: 'tune_antenna',
    title: 'Настроить антенну',
    category: 'short',
    stages: [
      {
        roomId: 'comms',
        terminalId: 'com_antenna',
        title: 'Совместить формы сигнала',
        instruction: 'Подстройте частоту и фазу так, чтобы рабочий сигнал совпал с эталонной волной.',
      },
    ],
  },
  {
    id: 'replace_fuses',
    title: 'Заменить предохранители',
    category: 'short',
    stages: [
      {
        roomId: 'electrical',
        terminalId: 'ele_fuses',
        title: 'Установить модули по маркировке',
        instruction: 'Вставьте каждый предохранитель в слот с соответствующим номиналом тока.',
      },
    ],
  },
  {
    id: 'clean_filter',
    title: 'Очистить фильтр',
    category: 'short',
    stages: [
      {
        roomId: 'hydroponics',
        terminalId: 'hyd_filter',
        title: 'Удалить засор из воздуховода',
        instruction: 'Убирайте фрагменты засора по одному, не перекрывая активный воздушный поток.',
      },
    ],
  },
  {
    id: 'balance_pressure',
    title: 'Выравнять давление',
    category: 'short',
    stages: [
      {
        roomId: 'airlock',
        terminalId: 'air_pressure',
        title: 'Удержать индикатор в рабочей зоне',
        instruction: 'Удерживайте подачу клапана, чтобы стрелка оставалась в зелёной зоне 2 секунды.',
      },
    ],
  },
  {
    id: 'check_batteries',
    title: 'Проверить батареи',
    category: 'short',
    stages: [
      {
        roomId: 'electrical',
        terminalId: 'ele_batteries',
        title: 'Отсортировать элементы по тестеру',
        instruction: 'Проверьте напряжение каждого элемента (норма: 11.5–13.0 В) и распределите на исправные и брак.',
      },
    ],
  },
  {
    id: 'reroute_power',
    title: 'Перенаправить питание',
    category: 'short',
    stages: [
      {
        roomId: 'reactor',
        terminalId: 'rea_power',
        title: 'Собрать электрическую цепь',
        instruction: 'Поворачивайте узлы схемы, чтобы замкнуть линию от источника слева до потребителя справа.',
      },
    ],
  },
  {
    id: 'calibrate_gyro',
    title: 'Настроить гироскоп',
    category: 'short',
    stages: [
      {
        roomId: 'navigation',
        terminalId: 'nav_gyro',
        title: 'Удержать точку в центре мишени',
        instruction: 'Наводите указатель на движущуюся цель и удерживайте его внутри кольца до 100%.',
      },
    ],
  },
  {
    id: 'unload_container',
    title: 'Разгрузить контейнер',
    category: 'short',
    stages: [
      {
        roomId: 'storage',
        terminalId: 'sto_container',
        title: 'Разложить предметы по меткам',
        instruction: 'Распределите 6 модулей груза по ящикам с соответствующей маркировкой отсека.',
      },
    ],
  },
  {
    id: 'calibrate_shield',
    title: 'Калибровать щит станции',
    category: 'short',
    stages: [
      {
        roomId: 'command',
        terminalId: 'cmd_shield',
        title: 'Повторить последовательность панелей',
        instruction: 'Запомните порядок подсветки шестиугольных панелей и активируйте их в той же последовательности.',
      },
    ],
  },
  {
    id: 'find_leak',
    title: 'Найти утечку',
    category: 'short',
    stages: [
      {
        roomId: 'medbay',
        terminalId: 'med_leak',
        title: 'Закрыть клапан повреждённого сегмента',
        instruction: 'Определите на графике магистраль с падением давления и перекройте соответствующий клапан.',
      },
    ],
  },

  // === ДЛИННЫЕ (6) ===
  {
    id: 'transmit_telemetry',
    title: 'Передать телеметрию',
    category: 'long',
    stages: [
      {
        roomId: 'navigation',
        terminalId: 'nav_telemetry',
        title: 'Записать пакет в навигации',
        instruction: 'Зафиксируйте 3 орбитальных маркера и запишите контрольный пакет данных.',
      },
      {
        roomId: 'comms',
        terminalId: 'com_uplink',
        title: 'Передать пакет из отсека связи',
        instruction: 'Введите записанный код пакета и выровняйте азимут передачи.',
      },
    ],
  },
  {
    id: 'analyze_sample',
    title: 'Проверить образец',
    category: 'long',
    stages: [
      {
        roomId: 'medbay',
        terminalId: 'med_sample',
        title: 'Запустить анализатор образцов',
        instruction: 'Загрузите реагент и запустите цикл анализа. Вы можете уйти на другое задание и вернуться через 10 секунд.',
        waitAfterMs: 10000,
      },
      {
        roomId: 'medbay',
        terminalId: 'med_sample',
        title: 'Забрать результат анализа',
        instruction: 'Анализ завершён. Выберите образец с аномальным пиком спектра.',
      },
    ],
  },
  {
    id: 'start_backup_loop',
    title: 'Запустить резервный контур',
    category: 'long',
    stages: [
      {
        roomId: 'storage',
        terminalId: 'sto_module',
        title: 'Забрать модуль со склада',
        instruction: 'Найдите на стеллаже резервный модуль охлаждения по серийному номеру.',
      },
      {
        roomId: 'reactor',
        terminalId: 'rea_backup',
        title: 'Настроить контур в реакторной',
        instruction: 'Установите модуль и выровняйте 3 тепловых вентиля до целевой температуры.',
      },
    ],
  },
  {
    id: 'inspect_suit',
    title: 'Проверить скафандр',
    category: 'long',
    stages: [
      {
        roomId: 'storage',
        terminalId: 'sto_seal',
        title: 'Подобрать уплотнитель на складе',
        instruction: 'Выберите уплотнительное кольцо нужного диаметра и класса герметичности.',
      },
      {
        roomId: 'airlock',
        terminalId: 'air_suit',
        title: 'Провести тест во внешнем шлюзе',
        instruction: 'Выполните поэтапную проверку герметичности: шлем, торс, перчатки.',
      },
    ],
  },
  {
    id: 'restore_irrigation',
    title: 'Восстановить полив',
    category: 'long',
    stages: [
      {
        roomId: 'hydroponics',
        terminalId: 'hyd_pump',
        title: 'Откалибровать насос полива',
        instruction: 'Выставьте обороты главного насоса на целевое значение.',
      },
      {
        roomId: 'hydroponics',
        terminalId: 'hyd_manifold',
        title: 'Восстановить поток по трём линиям',
        instruction: 'Настройте пропускную способность всех трёх линий орошения до заданных норм.',
      },
    ],
  },
  {
    id: 'update_station_route',
    title: 'Обновить маршрут станции',
    category: 'long',
    stages: [
      {
        roomId: 'navigation',
        terminalId: 'nav_route',
        title: 'Построить путь вокруг препятствий',
        instruction: 'Проложите непрерывный маршрут от старта до финиша, обходя зоны космического мусора.',
      },
      {
        roomId: 'command',
        terminalId: 'cmd_route',
        title: 'Подтвердить маршрут в командном зале',
        instruction: 'Сверьте контрольный код маршрута и подтвердите обновление курса.',
      },
    ],
  },
];

export const TASK_BY_ID: Record<TaskTypeId, TaskDefinition> = Object.fromEntries(
  TASK_CATALOG.map((t) => [t.id, t]),
) as Record<TaskTypeId, TaskDefinition>;

export const COMMON_TASK_IDS: TaskTypeId[] = TASK_CATALOG.filter((t) => t.category === 'common').map((t) => t.id);
export const SHORT_TASK_IDS: TaskTypeId[] = TASK_CATALOG.filter((t) => t.category === 'short').map((t) => t.id);
export const LONG_TASK_IDS: TaskTypeId[] = TASK_CATALOG.filter((t) => t.category === 'long').map((t) => t.id);

export interface ServerChallengeRecord {
  taskId: TaskTypeId;
  stageIndex: number;
  createdAt: number;
  clientPayload: Record<string, unknown>;
  secret: Record<string, unknown>;
}

// Helper deterministic/random utilities
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates server-authoritative challenge data (client-safe prompt + server secret)
 * for any of the 18 tasks and their stages.
 */
export function generateTaskChallenge(
  taskId: TaskTypeId,
  stageIndex: number,
  rng: () => number = Math.random,
  now = Date.now(),
  carryover?: Record<string, unknown>,
): ServerChallengeRecord {
  switch (taskId) {
    case 'sync_pass': {
      const symbols = ['◈', '▲', '●', '■', '✦', '⬡', '✛', '◩'];
      const target = shuffle(symbols, rng).slice(0, 4);
      const grid = shuffle(symbols, rng);
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { badgeSymbols: target, panelSymbols: grid },
        secret: { expected: target },
      };
    }

    case 'rewire_line': {
      const pairs = [
        { id: 'amber', color: '#f59e0b', shape: 'triangle', label: 'A1' },
        { id: 'cyan', color: '#38bdf8', shape: 'square', label: 'B2' },
        { id: 'emerald', color: '#10b981', shape: 'circle', label: 'C3' },
        { id: 'crimson', color: '#ef4444', shape: 'diamond', label: 'D4' },
      ];
      const left = shuffle(pairs, rng);
      const right = shuffle(pairs, rng);
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { left, right },
        secret: { expectedMap: Object.fromEntries(pairs.map((p) => [p.id, p.id])) },
      };
    }

    case 'tune_antenna': {
      const targetFreq = randInt(rng, 2, 7);
      const targetPhase = randInt(rng, 0, 11) * 30;
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: {
          targetFreq,
          targetPhase,
          initialFreq: targetFreq === 4 ? 2 : 4,
          initialPhase: (targetPhase + 120) % 360,
        },
        secret: { targetFreq, targetPhase },
      };
    }

    case 'replace_fuses': {
      const ratings = ['15A', '30A', '45A', '60A'];
      const slots = shuffle(ratings, rng);
      const modules = shuffle(ratings, rng);
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { slots, modules },
        secret: { expectedSlots: slots },
      };
    }

    case 'clean_filter': {
      const count = 6;
      const debris = Array.from({ length: count }, (_, idx) => ({
        id: `d_${idx}`,
        x: 15 + ((idx % 3) * 30) + randInt(rng, -5, 5),
        y: 22 + Math.floor(idx / 3) * 42 + randInt(rng, -6, 6),
        weight: randInt(rng, 1, 3),
      }));
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { debris },
        secret: { totalDebris: count },
      };
    }

    case 'balance_pressure': {
      const targetMin = randInt(rng, 45, 58);
      const targetMax = targetMin + 18;
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { targetMin, targetMax, requiredHoldMs: 2000 },
        secret: { targetMin, targetMax, requiredHoldMs: 2000 },
      };
    }

    case 'check_batteries': {
      const cells = Array.from({ length: 5 }, (_, i) => {
        const isGood = i < 3 ? true : false;
        const voltage = isGood
          ? Number((11.6 + rng() * 1.2).toFixed(1))
          : Number((rng() > 0.5 ? 8.4 + rng() * 2.5 : 13.5 + rng() * 1.6).toFixed(1));
        return { id: `cell_${i + 1}`, label: `Элемент #${i + 1}`, voltage, isGood };
      });
      const shuffled = shuffle(cells, rng);
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: {
          cells: shuffled.map(({ id, label, voltage }) => ({ id, label, voltage })),
        },
        secret: {
          expected: Object.fromEntries(shuffled.map((c) => [c.id, c.isGood ? 'good' : 'faulty'])),
        },
      };
    }

    case 'reroute_power': {
      // 3x3 grid of pipes connecting (row=1, col=0) left-entry to (row=1, col=2) right-exit.
      // Base shapes with openings at rotation 0: 'I' (L-R), 'L' (T-R), 'T' (L-T-R)
      // Solved straight/stepped layout:
      // Row 0: [L(rot1=R-B), I(rot0=L-R), L(rot2=B-L)] -> top bypass
      // Row 1: [L(rot0=T-R) -> wait simpler: use guaranteed solvable 3x3 path!]
      // Path: (1,0)[L-T] -> (0,0)[B-R] -> (0,1)[L-R] -> (0,2)[L-B] -> (1,2)[T-R]
      // Define pipe type base openings [N, E, S, W]:
      // 'I': [0,1,0,1], 'L': [1,1,0,0], 'T': [1,1,0,1]
      const layout: Array<{ type: 'I' | 'L' | 'T'; solvedRot: number }> = [
        { type: 'L', solvedRot: 1 }, // (0,0) E,S
        { type: 'I', solvedRot: 0 }, // (0,1) E,W
        { type: 'L', solvedRot: 2 }, // (0,2) S,W
        { type: 'L', solvedRot: 3 }, // (1,0) N,W (entry from W, goes N)
        { type: 'T', solvedRot: 2 }, // (1,1) decorative
        { type: 'L', solvedRot: 0 }, // (1,2) N,E (from N, exits E)
        { type: 'I', solvedRot: 1 }, // (2,0)
        { type: 'L', solvedRot: 0 }, // (2,1)
        { type: 'I', solvedRot: 0 }, // (2,2)
      ];
      const initialRotations = layout.map((cell, idx) =>
        [0, 1, 2, 3, 5].includes(idx) ? (cell.solvedRot + randInt(rng, 1, 3)) % 4 : randInt(rng, 0, 3),
      );
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: {
          types: layout.map((c) => c.type),
          initialRotations,
        },
        secret: {
          types: layout.map((c) => c.type),
        },
      };
    }

    case 'calibrate_gyro': {
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: {
          speed: 1.15,
          radius: 26,
          requiredHoldMs: 2200,
        },
        secret: { requiredHoldMs: 2200 },
      };
    }

    case 'unload_container': {
      const bins = [
        { id: 'MED', label: 'A-МЕД' },
        { id: 'ENG', label: 'B-ЭНЕРГ' },
        { id: 'BIO', label: 'C-БИО' },
      ];
      const items = shuffle(
        [
          { id: 'i1', name: 'Ампулы-К', code: 'A-МЕД', binId: 'MED' },
          { id: 'i2', name: 'Пакет плазмы', code: 'A-МЕД', binId: 'MED' },
          { id: 'i3', name: 'Инвертор 40В', code: 'B-ЭНЕРГ', binId: 'ENG' },
          { id: 'i4', name: 'Реле шины', code: 'B-ЭНЕРГ', binId: 'ENG' },
          { id: 'i5', name: 'Семена-7', code: 'C-БИО', binId: 'BIO' },
          { id: 'i6', name: 'Субстрат', code: 'C-БИО', binId: 'BIO' },
        ],
        rng,
      );
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: {
          bins,
          items: items.map(({ id, name, code }) => ({ id, name, code })),
        },
        secret: {
          expected: Object.fromEntries(items.map((it) => [it.id, it.binId])),
        },
      };
    }

    case 'calibrate_shield': {
      const sequence = Array.from({ length: 5 }, () => randInt(rng, 0, 5));
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { nodeCount: 6, sequence },
        secret: { sequence },
      };
    }

    case 'find_leak': {
      const leakIndex = randInt(rng, 0, 5);
      const segments = Array.from({ length: 6 }, (_, i) => {
        const base = 92 + randInt(rng, -3, 3);
        const points = [
          base,
          base - (i === leakIndex ? 8 : randInt(rng, 0, 2)),
          base - (i === leakIndex ? 24 : randInt(rng, 0, 3)),
          base - (i === leakIndex ? 45 : randInt(rng, 0, 2)),
          base - (i === leakIndex ? 62 : randInt(rng, 0, 3)),
        ];
        return { id: `V-${i + 1}`, points };
      });
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { segments },
        secret: { leakId: `V-${leakIndex + 1}` },
      };
    }

    case 'transmit_telemetry': {
      if (stageIndex === 0) {
        const packetCode = `TLM-${randInt(rng, 100, 999)}`;
        const markers = [
          { id: 'm1', x: randInt(rng, 18, 35), y: randInt(rng, 20, 45) },
          { id: 'm2', x: randInt(rng, 45, 62), y: randInt(rng, 50, 78) },
          { id: 'm3', x: randInt(rng, 70, 84), y: randInt(rng, 22, 55) },
        ];
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { packetCode, markers },
          secret: { packetCode, markerIds: markers.map((m) => m.id) },
        };
      }
      const packetCode = String(carryover?.packetCode ?? 'TLM-404');
      const targetAzimuth = randInt(rng, 2, 16) * 15;
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { packetCode, targetAzimuth },
        secret: { packetCode, targetAzimuth },
      };
    }

    case 'analyze_sample': {
      if (stageIndex === 0) {
        const reagentCode = ['R-ALPHA', 'R-BETA', 'R-GAMMA'][randInt(rng, 0, 2)];
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { reagentCode },
          secret: { reagentCode },
        };
      }
      const anomalyIndex = randInt(rng, 0, 4);
      const samples = Array.from({ length: 5 }, (_, i) => ({
        id: `S-${i + 1}`,
        spectrum: i === anomalyIndex ? randInt(rng, 84, 98) : randInt(rng, 24, 48),
      }));
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { samples },
        secret: { anomalyId: `S-${anomalyIndex + 1}` },
      };
    }

    case 'start_backup_loop': {
      if (stageIndex === 0) {
        const serials = ['MK-104', 'MK-219', 'MK-382', 'MK-450', 'MK-517', 'MK-693'];
        const targetSerial = serials[randInt(rng, 0, serials.length - 1)];
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { targetSerial, shelfSerials: shuffle(serials, rng) },
          secret: { targetSerial },
        };
      }
      const targets = [randInt(rng, 35, 75), randInt(rng, 35, 75), randInt(rng, 35, 75)];
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { targets },
        secret: { targets },
      };
    }

    case 'inspect_suit': {
      if (stageIndex === 0) {
        const options = [
          { id: 'seal_38a', label: 'Ø 38 мм · Класс A' },
          { id: 'seal_42b', label: 'Ø 42 мм · Класс B' },
          { id: 'seal_46a', label: 'Ø 46 мм · Класс A' },
          { id: 'seal_50c', label: 'Ø 50 мм · Класс C' },
        ];
        const target = options[randInt(rng, 0, options.length - 1)];
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { requiredLabel: target.label, options: shuffle(options, rng) },
          secret: { expectedId: target.id },
        };
      }
      const steps = ['helmet', 'torso', 'gloves'];
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { steps },
        secret: { steps },
      };
    }

    case 'restore_irrigation': {
      if (stageIndex === 0) {
        const targetRpm = randInt(rng, 18, 34) * 50; // 900..1700
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { targetRpm, minRpm: 600, maxRpm: 2000 },
          secret: { targetRpm },
        };
      }
      const lineTargets = [randInt(rng, 40, 80), randInt(rng, 40, 80), randInt(rng, 40, 80)];
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { lineTargets },
        secret: { lineTargets },
      };
    }

    case 'update_station_route': {
      if (stageIndex === 0) {
        // 5x5 grid from (0,0) to (4,4) with guaranteed unobstructed corridor
        const obstacles = [
          [1, 0],
          [1, 1],
          [3, 2],
          [3, 3],
          [0, 3],
        ];
        const routeCode = `NAV-${randInt(rng, 200, 899)}`;
        return {
          taskId,
          stageIndex,
          createdAt: now,
          clientPayload: { gridSize: 5, start: [0, 0], end: [4, 4], obstacles, routeCode },
          secret: { gridSize: 5, start: [0, 0], end: [4, 4], obstacles, routeCode },
        };
      }
      const routeCode = String(carryover?.routeCode ?? 'NAV-512');
      return {
        taskId,
        stageIndex,
        createdAt: now,
        clientPayload: { routeCode },
        secret: { routeCode },
      };
    }
  }
}

function getPipeOpenings(type: 'I' | 'L' | 'T', rot: number): [boolean, boolean, boolean, boolean] {
  // Base [N, E, S, W]
  const base: [boolean, boolean, boolean, boolean] =
    type === 'I'
      ? [false, true, false, true]
      : type === 'L'
        ? [true, true, false, false]
        : [true, true, false, true];
  const r = ((rot % 4) + 4) % 4;
  return [
    base[(4 - r) % 4],
    base[(5 - r) % 4],
    base[(6 - r) % 4],
    base[(7 - r) % 4],
  ];
}

function verifyPowerCircuit(types: Array<'I' | 'L' | 'T'>, rotations: number[]): boolean {
  if (rotations.length !== 9) return false;
  // Start at (row=1, col=0) which must have West opening (index 3)
  const startOpen = getPipeOpenings(types[3], rotations[3]);
  if (!startOpen[3]) return false;

  const visited = new Set<number>([3]);
  const queue = [3];
  const dirs = [
    { dr: -1, dc: 0, outIdx: 0, inIdx: 2 }, // N
    { dr: 0, dc: 1, outIdx: 1, inIdx: 3 },  // E
    { dr: 1, dc: 0, outIdx: 2, inIdx: 0 },  // S
    { dr: 0, dc: -1, outIdx: 3, inIdx: 1 }, // W
  ];

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    const open = getPipeOpenings(types[idx], rotations[idx]);
    // Goal: (row=1, col=2) = idx 5 with East opening (index 1)
    if (idx === 5 && open[1]) return true;

    for (const d of dirs) {
      if (!open[d.outIdx]) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) continue;
      const nIdx = nr * 3 + nc;
      if (visited.has(nIdx)) continue;
      const nOpen = getPipeOpenings(types[nIdx], rotations[nIdx]);
      if (nOpen[d.inIdx]) {
        visited.add(nIdx);
        queue.push(nIdx);
      }
    }
  }
  return false;
}

/**
 * Authoritative server-side solution validator for all 18 tasks.
 */
export function validateTaskAnswer(
  challenge: ServerChallengeRecord,
  answer: Record<string, unknown>,
): { valid: boolean; reason?: string; carryover?: Record<string, unknown> } {
  const { taskId, stageIndex, secret } = challenge;

  switch (taskId) {
    case 'sync_pass': {
      const selected = answer.selected;
      const expected = secret.expected as string[];
      if (!Array.isArray(selected) || selected.length !== expected.length) {
        return { valid: false, reason: 'Выберите все 4 символа пропуска.' };
      }
      const match = expected.every((sym, i) => selected[i] === sym);
      return match ? { valid: true } : { valid: false, reason: 'Порядок символов не совпадает с пропуском.' };
    }

    case 'rewire_line': {
      const connections = answer.connections as Record<string, string> | undefined;
      const expectedMap = secret.expectedMap as Record<string, string>;
      if (!connections || typeof connections !== 'object') {
        return { valid: false, reason: 'Соедините все 4 кабеля.' };
      }
      const ok = Object.entries(expectedMap).every(([k, v]) => connections[k] === v);
      return ok ? { valid: true } : { valid: false, reason: 'Не все разъёмы соединены верно.' };
    }

    case 'tune_antenna': {
      const freq = Number(answer.freq);
      const phase = Number(answer.phase);
      const tf = Number(secret.targetFreq);
      const tp = Number(secret.targetPhase);
      const phaseDiff = Math.min(Math.abs(phase - tp), 360 - Math.abs(phase - tp));
      if (Math.abs(freq - tf) <= 0.25 && phaseDiff <= 15) {
        return { valid: true };
      }
      return { valid: false, reason: 'Сигналы ещё не совмещены.' };
    }

    case 'replace_fuses': {
      const placed = answer.placed;
      const expected = secret.expectedSlots as string[];
      if (!Array.isArray(placed) || placed.length !== expected.length) {
        return { valid: false, reason: 'Заполните все 4 слота предохранителей.' };
      }
      const ok = expected.every((rating, i) => placed[i] === rating);
      return ok ? { valid: true } : { valid: false, reason: 'Номиналы предохранителей не соответствуют слотам.' };
    }

    case 'clean_filter': {
      const clearedCount = Number(answer.clearedCount);
      const minAirflow = Number(answer.minAirflow);
      if (clearedCount >= Number(secret.totalDebris) && minAirflow >= 35) {
        return { valid: true };
      }
      return { valid: false, reason: 'Уберите весь засор, сохраняя воздушный поток.' };
    }

    case 'balance_pressure': {
      const holdMs = Number(answer.holdMs);
      const lastValue = Number(answer.lastValue);
      const min = Number(secret.targetMin);
      const max = Number(secret.targetMax);
      if (holdMs >= Number(secret.requiredHoldMs) && lastValue >= min && lastValue <= max) {
        return { valid: true };
      }
      return { valid: false, reason: 'Удерживайте давление внутри рабочей зоны.' };
    }

    case 'check_batteries': {
      const sorted = answer.sorted as Record<string, string> | undefined;
      const expected = secret.expected as Record<string, string>;
      if (!sorted || typeof sorted !== 'object') {
        return { valid: false, reason: 'Отсортируйте все элементы питания.' };
      }
      const ok = Object.entries(expected).every(([id, state]) => sorted[id] === state);
      return ok ? { valid: true } : { valid: false, reason: 'Ошибка сортировки батарей по напряжению.' };
    }

    case 'reroute_power': {
      const rotations = answer.rotations;
      const types = secret.types as Array<'I' | 'L' | 'T'>;
      if (!Array.isArray(rotations) || rotations.length !== 9) {
        return { valid: false, reason: 'Некорректная конфигурация узлов.' };
      }
      const ok = verifyPowerCircuit(types, rotations.map(Number));
      return ok ? { valid: true } : { valid: false, reason: 'Цепь от источника до потребителя не замкнута.' };
    }

    case 'calibrate_gyro': {
      const holdMs = Number(answer.holdMs);
      if (holdMs >= Number(secret.requiredHoldMs)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Калибровка гироскопа не завершена.' };
    }

    case 'unload_container': {
      const assignments = answer.assignments as Record<string, string> | undefined;
      const expected = secret.expected as Record<string, string>;
      if (!assignments || typeof assignments !== 'object') {
        return { valid: false, reason: 'Разложите все предметы по ящикам.' };
      }
      const ok = Object.entries(expected).every(([itemId, binId]) => assignments[itemId] === binId);
      return ok ? { valid: true } : { valid: false, reason: 'Некоторые предметы находятся не в том ящике.' };
    }

    case 'calibrate_shield': {
      const input = answer.sequence;
      const expected = secret.sequence as number[];
      if (!Array.isArray(input) || input.length !== expected.length) {
        return { valid: false, reason: 'Повторите всю последовательность.' };
      }
      const ok = expected.every((v, i) => Number(input[i]) === v);
      return ok ? { valid: true } : { valid: false, reason: 'Последовательность калибровки неверна.' };
    }

    case 'find_leak': {
      const valveId = String(answer.valveId ?? '');
      if (valveId === String(secret.leakId)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Выбран исправный сегмент. Проверьте падение давления на графике.' };
    }

    case 'transmit_telemetry': {
      if (stageIndex === 0) {
        const locked = answer.lockedIds;
        const expected = secret.markerIds as string[];
        if (Array.isArray(locked) && expected.every((id) => locked.includes(id))) {
          return { valid: true, carryover: { packetCode: secret.packetCode } };
        }
        return { valid: false, reason: 'Зафиксируйте все 3 маркера телеметрии.' };
      }
      const code = String(answer.packetCode ?? '').trim().toUpperCase();
      const azimuth = Number(answer.azimuth);
      const targetAz = Number(secret.targetAzimuth);
      if (code === String(secret.packetCode) && Math.abs(azimuth - targetAz) <= 10) {
        return { valid: true };
      }
      return { valid: false, reason: 'Проверьте код пакета и азимут передачи.' };
    }

    case 'analyze_sample': {
      if (stageIndex === 0) {
        if (String(answer.reagentCode) === String(secret.reagentCode)) {
          return { valid: true };
        }
        return { valid: false, reason: 'Выберите требуемый реагент для запуска анализатора.' };
      }
      if (String(answer.sampleId) === String(secret.anomalyId)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Этот образец в норме. Найдите аномальный пик.' };
    }

    case 'start_backup_loop': {
      if (stageIndex === 0) {
        if (String(answer.serial) === String(secret.targetSerial)) {
          return { valid: true };
        }
        return { valid: false, reason: 'Серийный номер модуля не совпадает.' };
      }
      const values = answer.values;
      const targets = secret.targets as number[];
      if (
        Array.isArray(values) &&
        values.length === targets.length &&
        targets.every((t, i) => Math.abs(Number(values[i]) - t) <= 6)
      ) {
        return { valid: true };
      }
      return { valid: false, reason: 'Выровняйте все 3 тепловых вентиля в целевой диапазон.' };
    }

    case 'inspect_suit': {
      if (stageIndex === 0) {
        if (String(answer.sealId) === String(secret.expectedId)) {
          return { valid: true };
        }
        return { valid: false, reason: 'Выбран неподходящий уплотнитель.' };
      }
      const checked = answer.checked;
      const expected = secret.steps as string[];
      if (Array.isArray(checked) && expected.every((s, i) => checked[i] === s)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Выполните проверку шлема, торса и перчаток по порядку.' };
    }

    case 'restore_irrigation': {
      if (stageIndex === 0) {
        const rpm = Number(answer.rpm);
        if (Math.abs(rpm - Number(secret.targetRpm)) <= 25) {
          return { valid: true };
        }
        return { valid: false, reason: 'Обороты насоса вне целевого диапазона.' };
      }
      const lines = answer.lines;
      const targets = secret.lineTargets as number[];
      if (
        Array.isArray(lines) &&
        lines.length === targets.length &&
        targets.every((t, i) => Math.abs(Number(lines[i]) - t) <= 5)
      ) {
        return { valid: true };
      }
      return { valid: false, reason: 'Поток по трём линиям ещё не выровнен.' };
    }

    case 'update_station_route': {
      if (stageIndex === 0) {
        const path = answer.path as Array<[number, number]> | undefined;
        const obstacles = secret.obstacles as Array<[number, number]>;
        const gridSize = Number(secret.gridSize);
        if (!Array.isArray(path) || path.length < 2) {
          return { valid: false, reason: 'Постройте маршрут от старта до финиша.' };
        }
        const first = path[0];
        const last = path[path.length - 1];
        if (first[0] !== 0 || first[1] !== 0 || last[0] !== gridSize - 1 || last[1] !== gridSize - 1) {
          return { valid: false, reason: 'Маршрут должен начинаться в (1,1) и заканчиваться в (5,5).' };
        }
        const obstacleSet = new Set(obstacles.map(([r, c]) => `${r},${c}`));
        for (let i = 0; i < path.length; i++) {
          const [r, c] = path[i];
          if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
            return { valid: false, reason: 'Координаты вне сетки.' };
          }
          if (obstacleSet.has(`${r},${c}`)) {
            return { valid: false, reason: 'Маршрут проходит через препятствие.' };
          }
          if (i > 0) {
            const [pr, pc] = path[i - 1];
            if (Math.abs(r - pr) + Math.abs(c - pc) !== 1) {
              return { valid: false, reason: 'Клетки маршрута должны быть соседними.' };
            }
          }
        }
        return { valid: true, carryover: { routeCode: secret.routeCode } };
      }
      const code = String(answer.routeCode ?? '').trim().toUpperCase();
      if (code === String(secret.routeCode)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Контрольный код маршрута не совпадает.' };
    }
  }
}
