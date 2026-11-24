import { X } from 'lucide-react';
import {
  CORRIDORS,
  ROOMS,
  STATION_BOUNDS,
  TERMINAL_BY_ID,
  WALL_SEGMENTS,
} from '../../shared/mapData';
import type { RoomSnapshot } from '../../shared/types';

interface StationMapModalProps {
  snapshot: RoomSnapshot;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  onClose: () => void;
}

/**
 * Unified Tab Map rendered directly from shared/mapData.ts.
 * Shows ONLY the player's own position and their own assigned task markers (never other players!).
 */
export function StationMapModal({
  snapshot,
  playerX,
  playerZ,
  playerYaw,
  onClose,
}: StationMapModalProps) {
  const pad = 2.5;
  const vbX = STATION_BOUNDS.x1 - pad;
  const vbZ = STATION_BOUNDS.z1 - pad;
  const vbW = STATION_BOUNDS.x2 - STATION_BOUNDS.x1 + pad * 2;
  const vbH = STATION_BOUNDS.z2 - STATION_BOUNDS.z1 + pad * 2;

  const activeTaskMarkers = snapshot.self.tasks
    .filter((t) => !t.completed)
    .map((t) => {
      const stage = t.stages[t.currentStageIndex];
      const term = stage ? TERMINAL_BY_ID[stage.terminalId] : undefined;
      return term ? { task: t, stage, term } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const lightsTerm = snapshot.lightsOut ? TERMINAL_BY_ID['ele_lights'] : null;

  // Convert Three.js yaw (0 = looking -Z) to SVG rotation degrees
  const headingDeg = (-playerYaw * 180) / Math.PI;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Схема станции Каскад"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b12]/88"
    >
      <div className="w-full max-w-[920px] bg-[#101723] border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#0b1019]">
          <div>
            <h2 className="text-base font-display font-bold text-slate-100">
              Схема «Станция Каскад»
            </h2>
            <p className="text-xs text-slate-400">
              Показаны ваше положение и ваши текущие задания. Позиции остальных скрыты.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть карту"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-[#0a0f18]">
          <svg
            viewBox={`${vbX} ${vbZ} ${vbW} ${vbH}`}
            className="w-full h-auto max-h-[65vh] rounded border border-slate-800 bg-[#070b12]"
          >
            {/* Corridors */}
            {CORRIDORS.map((c) => (
              <rect
                key={c.id}
                x={c.bounds.x1}
                y={c.bounds.z1}
                width={c.bounds.x2 - c.bounds.x1}
                height={c.bounds.z2 - c.bounds.z1}
                fill="#162030"
              />
            ))}

            {/* Rooms */}
            {ROOMS.map((r) => {
              const cx = (r.bounds.x1 + r.bounds.x2) / 2;
              const cz = (r.bounds.z1 + r.bounds.z2) / 2;
              return (
                <g key={r.id}>
                  <rect
                    x={r.bounds.x1}
                    y={r.bounds.z1}
                    width={r.bounds.x2 - r.bounds.x1}
                    height={r.bounds.z2 - r.bounds.z1}
                    fill={r.floorTint}
                    stroke={r.accentColor}
                    strokeOpacity="0.45"
                    strokeWidth="0.22"
                  />
                  <text
                    x={cx}
                    y={cz + 0.5}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="1.55"
                    fontWeight="700"
                    fontFamily="'Exo 2', sans-serif"
                  >
                    {r.shortName}
                  </text>
                </g>
              );
            })}

            {/* Exact unified perimeter walls */}
            {WALL_SEGMENTS.map((w, i) => (
              <line
                key={i}
                x1={w.x1}
                y1={w.z1}
                x2={w.x2}
                y2={w.z2}
                stroke="#64748b"
                strokeWidth="0.42"
                strokeLinecap="square"
              />
            ))}

            {/* Lights sabotage marker if lights are out */}
            {lightsTerm && (
              <g transform={`translate(${lightsTerm.x}, ${lightsTerm.z})`}>
                <circle r="1.4" fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="0.3" />
                <text y="0.55" textAnchor="middle" fill="#fecaca" fontSize="1.4" fontWeight="800">
                  !
                </text>
              </g>
            )}

            {/* Player's own active task locations */}
            {activeTaskMarkers.map(({ task, term }) => (
              <g key={task.taskId} transform={`translate(${term.x}, ${term.z})`}>
                <circle
                  r="1.15"
                  fill="#f59e0b"
                  fillOpacity="0.25"
                  stroke="#fbbf24"
                  strokeWidth="0.28"
                />
                <circle r="0.48" fill="#fbbf24" />
              </g>
            ))}

            {/* Player's own position & facing chevron */}
            <g transform={`translate(${playerX}, ${playerZ}) rotate(${headingDeg})`}>
              <circle r="1.25" fill="#38bdf8" fillOpacity="0.22" />
              <polygon
                points="0,-1.2 0.85,0.9 0,0.45 -0.85,0.9"
                fill="#38bdf8"
                stroke="#0a0f18"
                strokeWidth="0.2"
              />
            </g>
          </svg>

          {/* Compact Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3 text-xs text-slate-400">
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-400 inline-block rotate-45" />
                Вы
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                Ваши задания ({activeTaskMarkers.length})
              </span>
              {snapshot.lightsOut && (
                <span className="flex items-center gap-1.5 text-red-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  Восстановление света
                </span>
              )}
            </div>
            <span className="font-mono-tabular">Нажмите Tab или Esc для возврата</span>
          </div>
        </div>
      </div>
    </div>
  );
}
