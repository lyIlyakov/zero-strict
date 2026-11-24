import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../game/sound';

export interface TaskMiniGameProps {
  payload: Record<string, unknown>;
  onSubmit: (answer: Record<string, unknown>) => void;
}

function ShapeIcon({ shape, color }: { shape: string; color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      {shape === 'triangle' && <polygon points="10,2 18,17 2,17" fill={color} />}
      {shape === 'square' && <rect x="3" y="3" width="14" height="14" fill={color} />}
      {shape === 'circle' && <circle cx="10" cy="10" r="7" fill={color} />}
      {shape === 'diamond' && <polygon points="10,2 18,10 10,18 2,10" fill={color} />}
    </svg>
  );
}

/* 1. Синхронизировать пропуск */
export function SyncPassTask({ payload, onSubmit }: TaskMiniGameProps) {
  const badgeSymbols = (payload.badgeSymbols as string[]) ?? [];
  const panelSymbols = (payload.panelSymbols as string[]) ?? [];
  const [selected, setSelected] = useState<string[]>([]);

  const handlePick = (sym: string) => {
    soundEngine.playClick();
    if (selected.includes(sym)) return;
    const next = [...selected, sym];
    setSelected(next);
    if (next.length === badgeSymbols.length) {
      onSubmit({ selected: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3.5 bg-[#0b111c] border border-sky-500/40 rounded-md">
        <div className="text-xs text-slate-400 mb-2">Символы на вашем пропуске (введите по порядку):</div>
        <div className="flex items-center justify-center gap-3">
          {badgeSymbols.map((sym, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded border flex items-center justify-center text-2xl ${
                selected[i]
                  ? 'bg-sky-950 border-sky-400 text-sky-200'
                  : 'bg-[#121c2c] border-slate-700 text-amber-300'
              }`}
            >
              {sym}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {panelSymbols.map((sym) => {
          const used = selected.includes(sym);
          return (
            <button
              key={sym}
              type="button"
              disabled={used}
              onClick={() => handlePick(sym)}
              className={`h-14 rounded-md border text-2xl font-bold transition-colors ${
                used
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#152032] hover:bg-[#1e2d45] border-slate-600 text-slate-100'
              }`}
            >
              {sym}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>Выбрано: {selected.length} / {badgeSymbols.length}</span>
        <button
          type="button"
          onClick={() => setSelected([])}
          className="text-amber-300 hover:underline"
        >
          Сбросить ввод
        </button>
      </div>
    </div>
  );
}

/* 2. Перекоммутировать линию (цвет + значок разъёма) */
export function RewireLineTask({ payload, onSubmit }: TaskMiniGameProps) {
  type WireNode = { id: string; color: string; shape: string; label: string };
  const left = (payload.left as WireNode[]) ?? [];
  const right = (payload.right as WireNode[]) ?? [];

  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, string>>({});

  const handleRightPick = (rightId: string) => {
    if (!activeLeft) return;
    soundEngine.playClick();
    const next = { ...connections, [activeLeft]: rightId };
    setConnections(next);
    setActiveLeft(null);
    if (Object.keys(next).length === left.length) {
      onSubmit({ connections: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative grid grid-cols-2 gap-12 py-2">
        <div className="space-y-3">
          {left.map((node) => {
            const connected = Boolean(connections[node.id]);
            const selected = activeLeft === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveLeft(node.id);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md border text-xs font-mono-tabular ${
                  selected
                    ? 'bg-amber-950/60 border-amber-400 text-white'
                    : connected
                      ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200'
                      : 'bg-[#121c2c] border-slate-700 hover:border-slate-500 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ShapeIcon shape={node.shape} color={node.color} />
                  <span>{node.label}</span>
                </span>
                <span>{connected ? 'Соединён' : selected ? 'Выбран' : '→'}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {right.map((node) => {
            const pairedFrom = Object.entries(connections).find(([, r]) => r === node.id)?.[0];
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => handleRightPick(node.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md border text-xs font-mono-tabular ${
                  pairedFrom
                    ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200'
                    : activeLeft
                      ? 'bg-[#18253a] border-sky-400/70 hover:bg-[#22334f] text-slate-100'
                      : 'bg-[#121c2c] border-slate-700 text-slate-300'
                }`}
              >
                <span>{pairedFrom ? '●' : '○'}</span>
                <span className="flex items-center gap-2">
                  <span>{node.label}</span>
                  <ShapeIcon shape={node.shape} color={node.color} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Соединено: {Object.keys(connections).length} / {left.length}</span>
        <button
          type="button"
          onClick={() => {
            setConnections({});
            setActiveLeft(null);
          }}
          className="text-amber-300 hover:underline"
        >
          Сбросить провода
        </button>
      </div>
    </div>
  );
}

/* 3. Настроить антенну */
export function TuneAntennaTask({ payload, onSubmit }: TaskMiniGameProps) {
  const targetFreq = Number(payload.targetFreq ?? 4);
  const targetPhase = Number(payload.targetPhase ?? 90);
  const [freq, setFreq] = useState(Number(payload.initialFreq ?? 2));
  const [phase, setPhase] = useState(Number(payload.initialPhase ?? 0));

  const buildWavePath = (f: number, pDeg: number) => {
    const pts: string[] = [];
    const pRad = (pDeg * Math.PI) / 180;
    for (let x = 0; x <= 320; x += 4) {
      const t = (x / 320) * Math.PI * 2;
      const y = 55 + Math.sin(t * f + pRad) * 34;
      pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const phaseDiff = Math.min(Math.abs(phase - targetPhase), 360 - Math.abs(phase - targetPhase));
  const aligned = Math.abs(freq - targetFreq) <= 0.25 && phaseDiff <= 15;

  return (
    <div className="space-y-4">
      <div className="bg-[#09101a] border border-slate-700 rounded-md p-3">
        <svg viewBox="0 0 320 110" className="w-full h-32">
          <line x1="0" y1="55" x2="320" y2="55" stroke="#1e293b" strokeWidth="1" />
          <path d={buildWavePath(targetFreq, targetPhase)} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6 4" />
          <path d={buildWavePath(freq, phase)} fill="none" stroke={aligned ? '#10b981' : '#f59e0b'} strokeWidth="2.8" />
        </svg>
        <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400 mt-1">
          <span className="text-sky-400">Пунктир: эталон</span>
          <span className={aligned ? 'text-emerald-400' : 'text-amber-300'}>
            {aligned ? 'Сигналы совмещены' : 'Сплошная: ваш сигнал'}
          </span>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between mb-1 font-mono-tabular">
            <span>Частота</span>
            <span>{freq.toFixed(1)} Гц</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={freq}
            onChange={(e) => setFreq(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1 font-mono-tabular">
            <span>Фаза</span>
            <span>{phase}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={345}
            step={15}
            value={phase}
            onChange={(e) => setPhase(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSubmit({ freq, phase })}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md"
      >
        Зафиксировать настройку антенны
      </button>
    </div>
  );
}

/* 4. Заменить предохранители */
export function ReplaceFusesTask({ payload, onSubmit }: TaskMiniGameProps) {
  const slots = (payload.slots as string[]) ?? [];
  const modules = (payload.modules as string[]) ?? [];

  const [selectedMod, setSelectedMod] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Array<string | null>>(slots.map(() => null));

  const placeIntoSlot = (idx: number) => {
    if (!selectedMod) return;
    soundEngine.playClick();
    const next = placed.map((v) => (v === selectedMod ? null : v));
    next[idx] = selectedMod;
    setPlaced(next);
    setSelectedMod(null);
    if (next.every((v) => v !== null)) {
      onSubmit({ placed: next });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-slate-400 mb-2">1. Выберите предохранитель:</div>
        <div className="grid grid-cols-4 gap-2">
          {modules.map((m) => {
            const isPlaced = placed.includes(m);
            const active = selectedMod === m;
            return (
              <button
                key={m}
                type="button"
                disabled={isPlaced}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedMod(m);
                }}
                className={`py-2.5 rounded-md border font-mono-tabular font-bold text-sm ${
                  active
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : isPlaced
                      ? 'bg-slate-900 border-slate-800 text-slate-600'
                      : 'bg-[#162235] hover:border-amber-400 border-slate-600 text-amber-300'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-2">2. Вставьте в слот с нужной маркировкой:</div>
        <div className="grid grid-cols-4 gap-2.5">
          {slots.map((rating, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => placeIntoSlot(idx)}
              className={`py-4 rounded-md border flex flex-col items-center gap-1.5 ${
                placed[idx]
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                  : selectedMod
                    ? 'bg-[#1a2940] border-sky-400 text-slate-100'
                    : 'bg-[#0c121e] border-slate-700 text-slate-300'
              }`}
            >
              <span className="text-[11px] text-slate-400">Слот {rating}</span>
              <span className="text-sm font-mono-tabular font-bold">
                {placed[idx] ?? 'Пусто'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPlaced(slots.map(() => null))}
        className="text-xs text-amber-300 hover:underline"
      >
        Извлечь все модули
      </button>
    </div>
  );
}

/* 5. Очистить фильтр */
export function CleanFilterTask({ payload, onSubmit }: TaskMiniGameProps) {
  type Debris = { id: string; x: number; y: number; weight: number };
  const initialDebris = (payload.debris as Debris[]) ?? [];
  const [remaining, setRemaining] = useState<Debris[]>(initialDebris);
  const [airflow, setAirflow] = useState(82);
  const [minAirflow, setMinAirflow] = useState(82);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAirflow((a) => Math.min(100, a + 6));
    }, 350);
    return () => window.clearInterval(id);
  }, []);

  const handleRemove = (item: Debris) => {
    if (busy) return;
    soundEngine.playClick();
    // Removing debris temporarily dips airflow — rapid spamming without pause drops it too low!
    const nextFlow = Math.max(15, airflow - 24);
    const nextMin = Math.min(minAirflow, nextFlow);
    setAirflow(nextFlow);
    setMinAirflow(nextMin);
    setBusy(true);
    window.setTimeout(() => setBusy(false), 220);

    const nextList = remaining.filter((d) => d.id !== item.id);
    setRemaining(nextList);
    if (nextList.length === 0) {
      onSubmit({ clearedCount: initialDebris.length, minAirflow: nextMin });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs font-mono-tabular mb-1">
          <span>Воздушный поток (держите выше 40%)</span>
          <span className={airflow < 45 ? 'text-red-400' : 'text-emerald-400'}>{airflow}%</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded overflow-hidden">
          <div
            className={`h-full transition-all ${airflow < 45 ? 'bg-red-500' : 'bg-emerald-400'}`}
            style={{ width: `${airflow}%` }}
          />
        </div>
      </div>

      <div className="relative h-52 bg-[#0a1019] border border-slate-700 rounded-md overflow-hidden">
        {/* Vent louver lines */}
        <div className="absolute inset-0 flex flex-col justify-evenly opacity-25 pointer-events-none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-1 bg-sky-400" />
          ))}
        </div>

        {remaining.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleRemove(item)}
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2 bg-amber-900/90 hover:bg-amber-700 border border-amber-400 rounded text-xs font-semibold text-amber-100 shadow"
          >
            Засор
          </button>
        ))}

        {remaining.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-emerald-300">
            Фильтр очищен!
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Убирайте засор с короткой паузой, чтобы поток воздуха успевал восстановиться.
      </p>
    </div>
  );
}

/* 6. Выравнять давление */
export function BalancePressureTask({ payload, onSubmit }: TaskMiniGameProps) {
  const targetMin = Number(payload.targetMin ?? 48);
  const targetMax = Number(payload.targetMax ?? 66);
  const requiredHoldMs = Number(payload.requiredHoldMs ?? 2000);

  const [pressure, setPressure] = useState(25);
  const [holdMs, setHoldMs] = useState(0);
  const [pumping, setPumping] = useState(false);
  const submittedRef = useRef(false);
  const heldKey = useRef<string | null>(null);
  const heldPointer = useRef<number | null>(null);
  const values = useRef({ pressure: 25, holdMs: 0 });
  const stopPumping = () => {
    heldKey.current = null;
    heldPointer.current = null;
    setPumping(false);
  };

  useEffect(() => {
    let last = performance.now();
    const reset = () => {
      heldKey.current = null;
      heldPointer.current = null;
      setPumping(false);
      last = performance.now();
    };
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const held = heldKey.current !== null || heldPointer.current !== null;
      const next = Math.max(0, Math.min(100, values.current.pressure + (held ? 38 : -24) * dt));
      const nextHold = next >= targetMin && next <= targetMax
        ? values.current.holdMs + dt * 1000
        : Math.max(0, values.current.holdMs - dt * 500);
      values.current = { pressure: next, holdMs: nextHold };
      setPressure(next);
      setHoldMs(nextHold);
      if (nextHold >= requiredHoldMs && !submittedRef.current) {
        submittedRef.current = true;
        onSubmit({ holdMs: nextHold, lastValue: next });
      }
    }, 50);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [onSubmit, requiredHoldMs, targetMax, targetMin]);

  const inZone = pressure >= targetMin && pressure <= targetMax;
  const pct = Math.min(100, Math.round((holdMs / requiredHoldMs) * 100));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono-tabular">
          <span>Давление шлюза: {pressure.toFixed(0)} кПа</span>
          <span className={inZone ? 'text-emerald-400' : 'text-amber-300'}>
            Рабочая зона: {targetMin}–{targetMax} кПа
          </span>
        </div>

        <div className="relative h-9 bg-[#0a1019] border border-slate-700 rounded overflow-hidden">
          <div
            className="absolute inset-y-0 bg-emerald-500/30 border-x border-emerald-400"
            style={{ left: `${targetMin}%`, width: `${targetMax - targetMin}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-amber-400"
            style={{ left: `calc(${pressure}% - 3px)` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs font-mono-tabular mb-1">
          <span>Стабилизация</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded overflow-hidden">
          <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button
        type="button"
        onPointerDown={(event) => {
          if (event.button !== 0 || heldPointer.current !== null) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          heldPointer.current = event.pointerId;
          setPumping(true);
        }}
        onPointerUp={(event) => {
          if (event.pointerId === heldPointer.current) stopPumping();
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === heldPointer.current) stopPumping();
        }}
        onLostPointerCapture={(event) => {
          if (event.pointerId === heldPointer.current) stopPumping();
        }}
        onKeyDown={(event) => {
          if (event.code !== 'Space' && event.code !== 'Enter') return;
          event.preventDefault();
          if (event.repeat) return;
          heldKey.current = event.code;
          setPumping(true);
        }}
        onKeyUp={(event) => {
          if (event.code === heldKey.current) {
            event.preventDefault();
            stopPumping();
          }
        }}
        onBlur={stopPumping}
        className={`touch-none w-full py-3.5 rounded-md font-bold text-sm border transition-colors ${
          pumping
            ? 'bg-amber-400 border-amber-200 text-slate-950'
            : 'bg-[#1a2537] hover:bg-[#23324a] border-amber-400/70 text-amber-200'
        }`}
      >
        Удерживайте для подачи давления · Пробел / Enter
      </button>
    </div>
  );
}
