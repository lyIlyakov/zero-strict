import { useState } from 'react';
import { soundEngine } from '../../game/sound';
import type { TaskMiniGameProps } from './CommonAndTechTasks';

interface StageMiniGameProps extends TaskMiniGameProps {
  stageIndex: number;
}

/* 13. Передать телеметрию (2 этапа) */
export function TransmitTelemetryTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  const [locked, setLocked] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [azimuth, setAzimuth] = useState(90);

  if (stageIndex === 0) {
    type Marker = { id: string; x: number; y: number };
    const markers = (payload.markers as Marker[]) ?? [];
    const packetCode = String(payload.packetCode ?? '');

    const lockMarker = (id: string) => {
      if (locked.includes(id)) return;
      soundEngine.playClick();
      const next = [...locked, id];
      setLocked(next);
      if (next.length === markers.length) {
        onSubmit({ lockedIds: next });
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono-tabular">
          <span className="text-slate-400">Пакет телеметрии:</span>
          <span className="text-amber-300 font-bold">{packetCode}</span>
        </div>
        <div className="relative h-52 bg-[#09101a] border border-slate-700 rounded-md overflow-hidden">
          {markers.map((m, i) => {
            const isLocked = locked.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => lockMarker(m.id)}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded border text-xs font-mono-tabular font-bold ${
                  isLocked
                    ? 'bg-emerald-600 border-emerald-300 text-slate-950'
                    : 'bg-sky-900/90 hover:bg-sky-700 border-sky-400 text-sky-100'
                }`}
              >
                {isLocked ? 'OK' : `M-${i + 1}`}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-400">
          Зафиксировано маркеров: {locked.length} / {markers.length}
        </div>
      </div>
    );
  }

  const packetCode = String(payload.packetCode ?? '');
  const targetAzimuth = Number(payload.targetAzimuth ?? 180);

  return (
    <div className="space-y-4">
      <div className="p-3 bg-[#0b111c] border border-slate-700 rounded text-xs font-mono-tabular flex justify-between">
        <span className="text-slate-400">Записанный код пакета:</span>
        <span className="text-amber-300 font-bold">{packetCode}</span>
      </div>

      <div>
        <label className="block text-xs text-slate-300 mb-1">Введите код пакета:</label>
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder={packetCode}
          className="w-full px-3 py-2 bg-[#0a0f18] border border-slate-600 rounded font-mono-tabular text-sm text-amber-300"
        />
      </div>

      <div>
        <div className="flex justify-between text-xs font-mono-tabular mb-1">
          <span>Азимут антенны (цель: {targetAzimuth}°)</span>
          <span className={Math.abs(azimuth - targetAzimuth) <= 10 ? 'text-emerald-400' : 'text-amber-300'}>
            {azimuth}°
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={270}
          step={5}
          value={azimuth}
          onChange={(e) => setAzimuth(Number(e.target.value))}
          className="w-full accent-sky-400"
        />
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ packetCode: codeInput || packetCode, azimuth })}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Передать телеметрию
      </button>
    </div>
  );
}

/* 14. Проверить образец (2 этапа с ожиданием 10 с) */
export function AnalyzeSampleTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  if (stageIndex === 0) {
    const required = String(payload.reagentCode ?? 'R-ALPHA');
    const options = ['R-ALPHA', 'R-BETA', 'R-GAMMA'];

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[#0b111c] border border-teal-500/40 rounded text-xs">
          Требуемый реагент для цикла анализа:{' '}
          <span className="font-mono-tabular font-bold text-teal-300">{required}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {options.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSubmit({ reagentCode: code });
              }}
              className="py-4 bg-[#121e2b] hover:bg-teal-900/60 border border-slate-600 hover:border-teal-400 rounded-md font-mono-tabular font-bold text-sm text-teal-200"
            >
              {code}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          После запуска можно уйти выполнять другие задания и вернуться в медотсек через 10 секунд.
        </p>
      </div>
    );
  }

  type Sample = { id: string; spectrum: number };
  const samples = (payload.samples as Sample[]) ?? [];
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400">
        Выберите образец с аномально высоким спектральным пиком:
      </div>
      <div className="grid grid-cols-5 gap-2.5 items-end pt-2">
        {samples.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onSubmit({ sampleId: s.id });
            }}
            className="flex flex-col items-center gap-2 p-2 bg-[#0b111c] hover:bg-[#152336] border border-slate-700 hover:border-teal-400 rounded-md"
          >
            <div className="w-full h-28 bg-[#070b12] rounded flex items-end p-1">
              <div
                className={`w-full rounded-sm ${s.spectrum > 75 ? 'bg-red-500' : 'bg-teal-400'}`}
                style={{ height: `${s.spectrum}%` }}
              />
            </div>
            <span className="text-xs font-mono-tabular font-bold text-slate-200">{s.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* 15. Запустить резервный контур (2 этапа) */
export function StartBackupLoopTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  const targets = (payload.targets as number[]) ?? [50, 50, 50];
  const [vals, setVals] = useState<number[]>([20, 20, 20]);

  if (stageIndex === 0) {
    const targetSerial = String(payload.targetSerial ?? '');
    const shelfSerials = (payload.shelfSerials as string[]) ?? [];

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[#0b111c] border border-amber-500/40 rounded text-xs">
          Найдите на стеллаже резервный модуль охлаждения:{' '}
          <span className="font-mono-tabular font-bold text-amber-300">{targetSerial}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shelfSerials.map((serial) => (
            <button
              key={serial}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSubmit({ serial });
              }}
              className="py-3.5 bg-[#151e2c] hover:bg-amber-950/60 border border-slate-600 hover:border-amber-400 rounded-md font-mono-tabular font-bold text-sm text-slate-100"
            >
              {serial}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {targets.map((target, idx) => {
          const ok = Math.abs(vals[idx] - target) <= 6;
          return (
            <div key={idx} className="space-y-1 text-xs font-mono-tabular">
              <div className="flex justify-between">
                <span>Вентиль контура #{idx + 1} (цель: {target}°)</span>
                <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>{vals[idx]}°</span>
              </div>
              <input
                type="range"
                min={10}
                max={95}
                value={vals[idx]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVals((prev) => prev.map((x, i) => (i === idx ? v : x)));
                }}
                className="w-full accent-orange-400"
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSubmit({ values: vals })}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Запустить резервный контур
      </button>
    </div>
  );
}

/* 16. Проверить скафандр (2 этапа) */
export function InspectSuitTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  const [checked, setChecked] = useState<string[]>([]);

  if (stageIndex === 0) {
    type SealOpt = { id: string; label: string };
    const requiredLabel = String(payload.requiredLabel ?? '');
    const options = (payload.options as SealOpt[]) ?? [];

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[#0b111c] border border-sky-500/40 rounded text-xs">
          Требуемый уплотнитель по спецификации:{' '}
          <span className="font-mono-tabular font-bold text-sky-300">{requiredLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSubmit({ sealId: opt.id });
              }}
              className="py-3.5 px-3 bg-[#151f2f] hover:bg-[#1e2d44] border border-slate-600 hover:border-sky-400 rounded-md text-xs font-mono-tabular font-semibold text-slate-100"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const steps: Array<{ id: string; label: string }> = [
    { id: 'helmet', label: '1. Герметичность шлема' },
    { id: 'torso', label: '2. Клапан торса' },
    { id: 'gloves', label: '3. Фиксация перчаток' },
  ];

  const handleCheck = (id: string) => {
    if (checked.includes(id)) return;
    soundEngine.playClick();
    const next = [...checked, id];
    setChecked(next);
    if (next.length === steps.length) {
      onSubmit({ checked: next });
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400">
        Проведите проверку скафандра строго по порядку (1 → 2 → 3):
      </div>
      <div className="space-y-2.5">
        {steps.map((s) => {
          const done = checked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              disabled={done}
              onClick={() => handleCheck(s.id)}
              className={`w-full px-4 py-3 rounded-md border text-left text-sm font-semibold flex justify-between items-center ${
                done
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                  : 'bg-[#141e2e] hover:bg-[#1d2c42] border-slate-600 text-slate-100'
              }`}
            >
              <span>{s.label}</span>
              <span className="text-xs font-mono-tabular">{done ? 'ПРОВЕРЕНО' : 'ТЕСТ'}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setChecked([])}
        className="text-xs text-amber-300 hover:underline"
      >
        Сбросить порядок проверки
      </button>
    </div>
  );
}

/* 17. Восстановить полив (2 этапа) */
export function RestoreIrrigationTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  const [rpm, setRpm] = useState(800);
  const lineTargets = (payload.lineTargets as number[]) ?? [60, 60, 60];
  const [lines, setLines] = useState<number[]>([25, 25, 25]);

  if (stageIndex === 0) {
    const targetRpm = Number(payload.targetRpm ?? 1200);
    const minRpm = Number(payload.minRpm ?? 600);
    const maxRpm = Number(payload.maxRpm ?? 2000);
    const aligned = Math.abs(rpm - targetRpm) <= 25;

    return (
      <div className="space-y-4">
        <div className="p-3 bg-[#0b111c] border border-emerald-500/40 rounded text-xs font-mono-tabular flex justify-between">
          <span>Целевые обороты насоса:</span>
          <span className="text-emerald-300 font-bold">{targetRpm} об/мин</span>
        </div>
        <div>
          <div className="flex justify-between text-xs font-mono-tabular mb-1">
            <span>Текущее значение</span>
            <span className={aligned ? 'text-emerald-400' : 'text-amber-300'}>{rpm} об/мин</span>
          </div>
          <input
            type="range"
            min={minRpm}
            max={maxRpm}
            step={25}
            value={rpm}
            onChange={(e) => setRpm(Number(e.target.value))}
            className="w-full accent-emerald-400"
          />
        </div>
        <button
          type="button"
          onClick={() => onSubmit({ rpm })}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-md"
        >
          Зафиксировать калибровку насоса
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lineTargets.map((target, idx) => {
          const ok = Math.abs(lines[idx] - target) <= 5;
          return (
            <div key={idx} className="space-y-1 text-xs font-mono-tabular">
              <div className="flex justify-between">
                <span>Линия орошения #{idx + 1} (норма: {target} л/м)</span>
                <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>{lines[idx]} л/м</span>
              </div>
              <input
                type="range"
                min={10}
                max={95}
                value={lines[idx]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLines((prev) => prev.map((x, i) => (i === idx ? v : x)));
                }}
                className="w-full accent-emerald-400"
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSubmit({ lines })}
        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Восстановить поток по трём линиям
      </button>
    </div>
  );
}

/* 18. Обновить маршрут станции (2 этапа) */
export function UpdateStationRouteTask({ stageIndex, payload, onSubmit }: StageMiniGameProps) {
  const [path, setPath] = useState<Array<[number, number]>>([[0, 0]]);
  const [codeInput, setCodeInput] = useState('');

  if (stageIndex === 0) {
    const gridSize = Number(payload.gridSize ?? 5);
    const obstacles = (payload.obstacles as Array<[number, number]>) ?? [];
    const routeCode = String(payload.routeCode ?? '');
    const obsSet = new Set(obstacles.map(([r, c]) => `${r},${c}`));
    const pathSet = new Set(path.map(([r, c]) => `${r},${c}`));

    const handleCellClick = (r: number, c: number) => {
      if (obsSet.has(`${r},${c}`)) return;
      const last = path[path.length - 1];
      if (last[0] === r && last[1] === c) return;

      // Allow backtracking if clicking previous cell
      if (path.length >= 2) {
        const prev = path[path.length - 2];
        if (prev[0] === r && prev[1] === c) {
          soundEngine.playClick();
          setPath(path.slice(0, -1));
          return;
        }
      }

      if (Math.abs(r - last[0]) + Math.abs(c - last[1]) === 1 && !pathSet.has(`${r},${c}`)) {
        soundEngine.playClick();
        const next: Array<[number, number]> = [...path, [r, c]];
        setPath(next);
        if (r === gridSize - 1 && c === gridSize - 1) {
          onSubmit({ path: next });
        }
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono-tabular">
          <span className="text-slate-400">Кликайте соседние клетки от СТАРТ до ЦЕЛЬ</span>
          <span className="text-amber-300 font-bold">Код: {routeCode}</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 max-w-[290px] mx-auto">
          {Array.from({ length: gridSize * gridSize }, (_, idx) => {
            const r = Math.floor(idx / gridSize);
            const c = idx % gridSize;
            const k = `${r},${c}`;
            const isObs = obsSet.has(k);
            const inPath = pathSet.has(k);
            const isStart = r === 0 && c === 0;
            const isEnd = r === gridSize - 1 && c === gridSize - 1;
            return (
              <button
                key={k}
                type="button"
                disabled={isObs}
                onClick={() => handleCellClick(r, c)}
                className={`h-12 rounded border text-[10px] font-mono-tabular font-bold transition-colors ${
                  isObs
                    ? 'bg-red-950/80 border-red-700/80 text-red-300 cursor-not-allowed'
                    : inPath
                      ? 'bg-sky-500 border-sky-200 text-slate-950'
                      : isEnd
                        ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                        : 'bg-[#0e1522] border-slate-700 hover:border-sky-400 text-slate-400'
                }`}
              >
                {isObs ? 'МУСОР' : isStart ? 'СТАРТ' : isEnd ? 'ЦЕЛЬ' : inPath ? '●' : ''}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPath([[0, 0]])}
          className="text-xs text-amber-300 hover:underline"
        >
          Очистить траекторию
        </button>
      </div>
    );
  }

  const routeCode = String(payload.routeCode ?? '');
  return (
    <div className="space-y-4">
      <div className="p-3 bg-[#0b111c] border border-sky-500/40 rounded text-xs font-mono-tabular flex justify-between">
        <span>Контрольный код маршрута:</span>
        <span className="text-amber-300 font-bold">{routeCode}</span>
      </div>
      <div>
        <label className="block text-xs text-slate-300 mb-1">
          Подтвердите код маршрута в Командном зале:
        </label>
        <input
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder={routeCode}
          className="w-full px-3 py-2 bg-[#0a0f18] border border-slate-600 rounded font-mono-tabular text-sm text-amber-300"
        />
      </div>
      <button
        type="button"
        onClick={() => onSubmit({ routeCode: codeInput || routeCode })}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Подтвердить орбитальный курс
      </button>
    </div>
  );
}
