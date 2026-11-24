import { Wrench, X } from 'lucide-react';
import type { TaskTypeId } from '../../shared/types';
import {
  BalancePressureTask,
  CleanFilterTask,
  ReplaceFusesTask,
  RewireLineTask,
  SyncPassTask,
  TuneAntennaTask,
} from './tasks/CommonAndTechTasks';
import {
  CalibrateGyroTask,
  CalibrateShieldTask,
  CheckBatteriesTask,
  FindLeakTask,
  ReroutePowerTask,
  UnloadContainerTask,
} from './tasks/SystemAndCargoTasks';
import {
  AnalyzeSampleTask,
  InspectSuitTask,
  RestoreIrrigationTask,
  StartBackupLoopTask,
  TransmitTelemetryTask,
  UpdateStationRouteTask,
} from './tasks/LongAndBioTasks';

export interface ActiveTaskChallenge {
  taskId: TaskTypeId;
  stageIndex: number;
  title: string;
  instruction: string;
  payload: Record<string, unknown>;
}

interface TaskModalProps {
  challenge: ActiveTaskChallenge;
  error: string | null;
  onSubmit: (answer: Record<string, unknown>) => void;
  onClose: () => void;
}

export function TaskModal({ challenge, error, onSubmit, onClose }: TaskModalProps) {
  const renderTask = () => {
    const { taskId, stageIndex, payload } = challenge;
    switch (taskId) {
      case 'sync_pass':
        return <SyncPassTask payload={payload} onSubmit={onSubmit} />;
      case 'rewire_line':
        return <RewireLineTask payload={payload} onSubmit={onSubmit} />;
      case 'tune_antenna':
        return <TuneAntennaTask payload={payload} onSubmit={onSubmit} />;
      case 'replace_fuses':
        return <ReplaceFusesTask payload={payload} onSubmit={onSubmit} />;
      case 'clean_filter':
        return <CleanFilterTask payload={payload} onSubmit={onSubmit} />;
      case 'balance_pressure':
        return <BalancePressureTask payload={payload} onSubmit={onSubmit} />;
      case 'check_batteries':
        return <CheckBatteriesTask payload={payload} onSubmit={onSubmit} />;
      case 'reroute_power':
        return <ReroutePowerTask payload={payload} onSubmit={onSubmit} />;
      case 'calibrate_gyro':
        return <CalibrateGyroTask payload={payload} onSubmit={onSubmit} />;
      case 'unload_container':
        return <UnloadContainerTask payload={payload} onSubmit={onSubmit} />;
      case 'calibrate_shield':
        return <CalibrateShieldTask payload={payload} onSubmit={onSubmit} />;
      case 'find_leak':
        return <FindLeakTask payload={payload} onSubmit={onSubmit} />;
      case 'transmit_telemetry':
        return <TransmitTelemetryTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
      case 'analyze_sample':
        return <AnalyzeSampleTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
      case 'start_backup_loop':
        return <StartBackupLoopTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
      case 'inspect_suit':
        return <InspectSuitTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
      case 'restore_irrigation':
        return <RestoreIrrigationTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
      case 'update_station_route':
        return <UpdateStationRouteTask stageIndex={stageIndex} payload={payload} onSubmit={onSubmit} />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={challenge.title}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#070b12]/88"
    >
      <div className="w-full max-w-[540px] bg-[#101723] border border-amber-500/50 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0b1019]">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100">
                {challenge.title}
              </h2>
              <p className="text-xs text-slate-400">{challenge.instruction}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть терминал задания"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="px-3 py-2 bg-red-950/90 border border-red-500/60 rounded text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {renderTask()}
        </div>
      </div>
    </div>
  );
}
