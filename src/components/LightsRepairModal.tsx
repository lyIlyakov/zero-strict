import { X, Zap } from 'lucide-react';
import type { LightsSabotageState } from '../../shared/types';

interface LightsRepairModalProps {
  state: LightsSabotageState;
  onToggleSwitch: (index: number) => void;
  onClose: () => void;
}

export function LightsRepairModal({
  state,
  onToggleSwitch,
  onClose,
}: LightsRepairModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Восстановление освещения"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b12]/88"
    >
      <div className="w-full max-w-[500px] bg-[#101723] border border-amber-500/60 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0b1019]">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100">
                Щит освещения — Электрощитовая
              </h2>
              <p className="text-xs text-slate-400">
                Включите все 5 автоматов питания, чтобы восстановить свет на станции
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть щит освещения"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-5 gap-3">
            {state.switches.map((isOn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onToggleSwitch(idx)}
                className={`flex flex-col items-center justify-between py-4 px-2 rounded-md border transition-colors ${
                  isOn
                    ? 'bg-emerald-950/60 border-emerald-400/80 text-emerald-200'
                    : 'bg-[#0b1019] border-slate-700 hover:border-amber-400 text-slate-400'
                }`}
              >
                <span className="text-[11px] font-mono-tabular">L-{idx + 1}</span>
                <div
                  className={`my-3 w-8 h-14 rounded border flex flex-col justify-between p-1 ${
                    isOn ? 'border-emerald-400/70 bg-emerald-900/40' : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  <div
                    className={`h-5 rounded-sm ${
                      isOn ? 'bg-emerald-400' : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-5 rounded-sm ${
                      !isOn ? 'bg-red-500' : 'bg-transparent'
                    }`}
                  />
                </div>
                <span className="text-xs font-bold">{isOn ? 'ВКЛ' : 'ВЫКЛ'}</span>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center mt-5">
            Восстановление света не засчитывается как ремонтное задание.
          </p>
        </div>
      </div>
    </div>
  );
}
