import { Radio, RefreshCw, X, ZapOff } from 'lucide-react';
import type { SensorEchoSnapshot } from '../../shared/types';

interface SensorEchoModalProps {
  snapshot: SensorEchoSnapshot;
  onRefresh: () => void;
  onClose: () => void;
}

export function SensorEchoModal({ snapshot, onRefresh, onClose }: SensorEchoModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Терминал Эхо датчика"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b12]/88"
    >
      <div className="w-full max-w-[620px] bg-[#101723] border border-sky-500/45 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0b1019]">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100">
                Терминал «Эхо датчика»
              </h2>
              <p className="text-xs text-slate-400">
                Время с последнего срабатывания датчика движения по отсекам (без имён и ролей)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть терминал Эхо датчика"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {snapshot.pausedByBlackout && (
            <div className="px-3.5 py-2.5 bg-red-950/85 border border-red-500/60 rounded-md text-xs text-red-100 flex items-center gap-2">
              <ZapOff className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                Питание датчиков приостановлено из-за отключения света. Новые события не фиксируются до восстановления.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {snapshot.entries.map((entry) => (
              <div
                key={entry.roomId}
                className="flex items-center justify-between px-3.5 py-2.5 bg-[#0b111b] border border-slate-800 rounded-md"
              >
                <span className="text-sm font-medium text-slate-200">{entry.roomName}</span>
                <span
                  className={`text-xs font-mono-tabular font-semibold ${
                    entry.secondsAgo === null
                      ? 'text-slate-500'
                      : entry.secondsAgo <= 10
                        ? 'text-amber-300'
                        : 'text-sky-300'
                  }`}
                >
                  {entry.secondsAgo === null ? 'Нет данных' : `${entry.secondsAgo} с назад`}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              Подсказка для обсуждения — не доказывает виновность.
            </span>
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1a2434] hover:bg-[#233248] border border-slate-600/80 text-xs font-semibold text-slate-100 rounded-md"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              Обновить журнал
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
