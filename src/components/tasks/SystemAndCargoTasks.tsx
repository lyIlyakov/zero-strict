import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../game/sound';
import type { TaskMiniGameProps } from './CommonAndTechTasks';

/* 7. Проверить батареи */
export function CheckBatteriesTask({ payload, onSubmit }: TaskMiniGameProps) {
  type Cell = { id: string; label: string; voltage: number };
  const cells = (payload.cells as Cell[]) ?? [];
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [sorted, setSorted] = useState<Record<string, 'good' | 'faulty'>>({});

  const classify = (id: string, kind: 'good' | 'faulty') => {
    soundEngine.playClick();
    const next = { ...sorted, [id]: kind };
    setSorted(next);
    if (Object.keys(next).length === cells.length) {
      onSubmit({ sorted: next });
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400">
        Нажмите «Тест», чтобы измерить напряжение. Норма: <span className="text-emerald-300 font-mono-tabular">11.5–13.0 В</span>.
      </div>
      <div className="space-y-2">
        {cells.map((c) => {
          const isTested = Boolean(tested[c.id]);
          const choice = sorted[c.id];
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0c121e] border border-slate-800 rounded-md text-xs"
            >
              <span className="font-semibold text-slate-200">{c.label}</span>
              <div className="flex items-center gap-2">
                {!isTested ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setTested((t) => ({ ...t, [c.id]: true }));
                    }}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded"
                  >
                    Тест
                  </button>
                ) : (
                  <>
                    <span className="font-mono-tabular font-bold text-amber-300 w-14 text-right">
                      {c.voltage.toFixed(1)} В
                    </span>
                    <button
                      type="button"
                      onClick={() => classify(c.id, 'good')}
                      className={`px-2.5 py-1 rounded font-semibold ${
                        choice === 'good'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#1a2537] hover:bg-emerald-700 text-slate-200'
                      }`}
                    >
                      Исправна
                    </button>
                    <button
                      type="button"
                      onClick={() => classify(c.id, 'faulty')}
                      className={`px-2.5 py-1 rounded font-semibold ${
                        choice === 'faulty'
                          ? 'bg-red-500 text-white'
                          : 'bg-[#1a2537] hover:bg-red-700 text-slate-200'
                      }`}
                    >
                      Брак
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 8. Перенаправить питание (поворот узлов 3x3) */
export function ReroutePowerTask({ payload, onSubmit }: TaskMiniGameProps) {
  const types = (payload.types as Array<'I' | 'L' | 'T'>) ?? [];
  const initRot = (payload.initialRotations as number[]) ?? Array(9).fill(0);
  const [rotations, setRotations] = useState<number[]>(initRot);

  const rotateTile = (idx: number) => {
    soundEngine.playClick();
    setRotations((prev) => prev.map((r, i) => (i === idx ? (r + 1) % 4 : r)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <div className="text-xs font-mono-tabular text-amber-300 font-bold">
          ИСТОЧНИК →
        </div>
        <div className="grid grid-cols-3 gap-2">
          {types.map((type, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => rotateTile(idx)}
              aria-label={`Повернуть узел ${idx + 1}`}
              className={`w-16 h-16 rounded-md border flex items-center justify-center transition-colors ${
                idx === 3 || idx === 5
                  ? 'bg-[#172336] border-amber-400/70'
                  : 'bg-[#0e1522] border-slate-700 hover:border-sky-400'
              }`}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                style={{ transform: `rotate(${rotations[idx] * 90}deg)` }}
                className="transition-transform duration-150"
              >
                {type === 'I' && (
                  <line x1="0" y1="24" x2="48" y2="24" stroke="#38bdf8" strokeWidth="8" />
                )}
                {type === 'L' && (
                  <path d="M24,0 L24,24 L48,24" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinejoin="round" />
                )}
                {type === 'T' && (
                  <path d="M0,24 L48,24 M24,0 L24,24" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinejoin="round" />
                )}
                <circle cx="24" cy="24" r="5" fill="#f59e0b" />
              </svg>
            </button>
          ))}
        </div>
        <div className="text-xs font-mono-tabular text-emerald-300 font-bold">
          → ВЫХОД
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ rotations })}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Подать напряжение по цепи
      </button>
    </div>
  );
}

/* 9. Настроить гироскоп */
export function CalibrateGyroTask({ payload, onSubmit }: TaskMiniGameProps) {
  const requiredHoldMs = Number(payload.requiredHoldMs ?? 2200);
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [holdMs, setHoldMs] = useState(0);
  const cursorRef = useRef({ x: 50, y: 50 });
  const submittedRef = useRef(false);

  useEffect(() => {
    let t = 0;
    const id = window.setInterval(() => {
      t += 0.05;
      const tx = 50 + Math.sin(t * 1.3) * 28;
      const ty = 50 + Math.cos(t * 0.95) * 26;
      setTarget({ x: tx, y: ty });

      const dist = Math.hypot(cursorRef.current.x - tx, cursorRef.current.y - ty);
      if (dist <= 13) {
        setHoldMs((h) => {
          const next = h + 50;
          if (next >= requiredHoldMs && !submittedRef.current) {
            submittedRef.current = true;
            onSubmit({ holdMs: next });
          }
          return next;
        });
      } else {
        setHoldMs((h) => Math.max(0, h - 25));
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [onSubmit, requiredHoldMs]);

  const pct = Math.min(100, Math.round((holdMs / requiredHoldMs) * 100));
  const locked = Math.hypot(cursor.x - target.x, cursor.y - target.y) <= 13;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs font-mono-tabular">
        <span>Удерживайте курсор в центре мишени</span>
        <span className={locked ? 'text-emerald-400' : 'text-amber-300'}>{pct}%</span>
      </div>
      <div
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          cursorRef.current = { x, y };
          setCursor({ x, y });
        }}
        className="relative h-56 bg-[#09101a] border border-slate-700 rounded-md overflow-hidden cursor-crosshair"
      >
        {/* Target moving ring */}
        <div
          style={{ left: `${target.x}%`, top: `${target.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 pointer-events-none ${
            locked ? 'border-emerald-400 bg-emerald-500/20' : 'border-amber-400 bg-amber-500/10'
          }`}
        />
        {/* User dot */}
        <div
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-sky-400 pointer-events-none"
        />
      </div>
    </div>
  );
}

/* 10. Разгрузить контейнер */
export function UnloadContainerTask({ payload, onSubmit }: TaskMiniGameProps) {
  type Bin = { id: string; label: string };
  type Item = { id: string; name: string; code: string };
  const bins = (payload.bins as Bin[]) ?? [];
  const items = (payload.items as Item[]) ?? [];

  const [selectedItem, setSelectedItem] = useState<string | null>(items[0]?.id ?? null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const assignToBin = (binId: string) => {
    if (!selectedItem) return;
    soundEngine.playClick();
    const next = { ...assignments, [selectedItem]: binId };
    setAssignments(next);

    const remaining = items.find((i) => !next[i.id]);
    setSelectedItem(remaining ? remaining.id : null);

    if (Object.keys(next).length === items.length) {
      onSubmit({ assignments: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const done = Boolean(assignments[it.id]);
          const active = selectedItem === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setSelectedItem(it.id);
              }}
              className={`px-3 py-2 rounded-md border text-left text-xs ${
                active
                  ? 'bg-amber-950/60 border-amber-400 text-white'
                  : done
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-[#0e1522] border-slate-700 text-slate-200'
              }`}
            >
              <div className="font-semibold">{it.name}</div>
              <div className="text-[11px] font-mono-tabular text-amber-300">Метка: {it.code}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {bins.map((b) => {
          const count = Object.values(assignments).filter((id) => id === b.id).length;
          return (
            <button
              key={b.id}
              type="button"
              disabled={!selectedItem}
              onClick={() => assignToBin(b.id)}
              className="py-4 px-2 bg-[#162235] hover:bg-[#1f304a] disabled:opacity-50 border border-sky-500/60 rounded-md text-center"
            >
              <div className="text-xs font-mono-tabular font-bold text-sky-300">{b.label}</div>
              <div className="text-[11px] text-slate-400 mt-1">В ящике: {count}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 11. Калибровать щит станции */
export function CalibrateShieldTask({ payload, onSubmit }: TaskMiniGameProps) {
  const nodeCount = Number(payload.nodeCount ?? 6);
  const sequence = (payload.sequence as number[]) ?? [];

  const [showingIdx, setShowingIdx] = useState<number>(-1);
  const [input, setInput] = useState<number[]>([]);
  const [replayCount, setReplayCount] = useState(0);

  useEffect(() => {
    let step = 0;
    setShowingIdx(-1);
    const timers: number[] = [];

    sequence.forEach((nodeId, idx) => {
      const t1 = window.setTimeout(() => {
        setShowingIdx(nodeId);
        soundEngine.playClick();
      }, 450 + idx * 650);
      const t2 = window.setTimeout(() => {
        setShowingIdx(-1);
      }, 450 + idx * 650 + 420);
      timers.push(t1, t2);
      step = idx + 1;
    });

    const endT = window.setTimeout(() => setShowingIdx(-1), 450 + step * 650 + 100);
    timers.push(endT);

    return () => timers.forEach((t) => clearTimeout(t));
  }, [sequence, replayCount]);

  const handlePress = (idx: number) => {
    soundEngine.playClick();
    const next = [...input, idx];
    setInput(next);
    if (next.length === sequence.length) {
      onSubmit({ sequence: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Шаг ввода: {input.length} / {sequence.length}</span>
        <button
          type="button"
          onClick={() => {
            setInput([]);
            setReplayCount((c) => c + 1);
          }}
          className="text-sky-400 hover:underline"
        >
          Повторить показ
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: nodeCount }, (_, idx) => {
          const lit = showingIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handlePress(idx)}
              className={`h-16 rounded-md border font-mono-tabular font-bold text-base transition-colors ${
                lit
                  ? 'bg-sky-400 border-white text-slate-950'
                  : 'bg-[#121c2c] hover:bg-[#1b2a42] border-slate-600 text-slate-200'
              }`}
            >
              Щ-{idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* 12. Найти утечку */
export function FindLeakTask({ payload, onSubmit }: TaskMiniGameProps) {
  type Seg = { id: string; points: number[] };
  const segments = (payload.segments as Seg[]) ?? [];

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-400">
        Найдите сегмент с резким падением давления и перекройте его клапан:
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {segments.map((seg) => {
          const pts = seg.points
            .map((v, i) => `${i * 32 + 6},${60 - (v / 100) * 52}`)
            .join(' ');
          const lastVal = seg.points[seg.points.length - 1];
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSubmit({ valveId: seg.id });
              }}
              className="p-2.5 bg-[#0b111c] hover:bg-[#142033] border border-slate-700 hover:border-amber-400 rounded-md text-left"
            >
              <div className="flex items-center justify-between text-xs font-mono-tabular mb-1">
                <span className="font-bold text-slate-200">Клапан {seg.id}</span>
                <span className={lastVal < 50 ? 'text-red-400' : 'text-emerald-400'}>
                  {lastVal}%
                </span>
              </div>
              <svg viewBox="0 0 140 62" className="w-full h-14 bg-[#070b12] rounded">
                <polyline
                  points={pts}
                  fill="none"
                  stroke={lastVal < 50 ? '#ef4444' : '#38bdf8'}
                  strokeWidth="2.5"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
