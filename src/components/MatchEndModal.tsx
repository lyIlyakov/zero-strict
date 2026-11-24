import { RotateCcw, ShieldCheck, Skull } from 'lucide-react';
import type { RoomSnapshot } from '../../shared/types';

interface MatchEndModalProps {
  snapshot: RoomSnapshot;
  onReturnToLobby: () => void;
}

export function MatchEndModal({ snapshot, onReturnToLobby }: MatchEndModalProps) {
  const end = snapshot.matchEnd;
  if (!end) return null;

  const crewWon = end.winner === 'crew';
  const myRole = snapshot.self.role;
  const iWon = myRole === end.winner;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Итоги смены"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070b12]/90"
    >
      <div className="w-full max-w-[560px] bg-[#101723] border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        <div
          className={`px-6 py-5 border-b border-slate-800 ${
            crewWon ? 'bg-emerald-950/50' : 'bg-red-950/50'
          }`}
        >
          <div className="flex items-center gap-3">
            {crewWon ? (
              <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
            ) : (
              <Skull className="w-7 h-7 text-red-400 shrink-0" />
            )}
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-100">
                {crewWon ? 'Победа экипажа' : 'Победа саботажника'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                {iWon ? 'Ваша сторона выиграла этот раунд.' : 'Ваша сторона уступила в этом раунде.'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-200 leading-relaxed">{end.reasonText}</p>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono-tabular">
            <div className="bg-[#0b1019] border border-slate-800 rounded-md p-3">
              <div className="text-slate-400 mb-1">Саботажник</div>
              <div className="text-base font-bold text-red-400">{end.saboteurName}</div>
            </div>
            <div className="bg-[#0b1019] border border-slate-800 rounded-md p-3">
              <div className="text-slate-400 mb-1">Выполнено заданий</div>
              <div className="text-base font-bold text-emerald-400">
                {end.completedTasks} / {end.totalRequiredTasks}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">Состав смены</div>
            <ul className="divide-y divide-slate-800 border border-slate-800 rounded-md bg-[#0b1019]">
              {snapshot.players.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3.5 py-2 text-xs">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </span>
                  <span
                    className={
                      p.revealedRole === 'saboteur'
                        ? 'text-red-400 font-semibold'
                        : 'text-sky-300'
                    }
                  >
                    {p.revealedRole === 'saboteur' ? 'Саботажник' : 'Экипаж'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onReturnToLobby}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Вернуться в лобби комнаты
          </button>
        </div>
      </div>
    </div>
  );
}
