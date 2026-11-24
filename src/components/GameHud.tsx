import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Map as MapIcon,
  Settings,
  Shield,
  Volume2,
  VolumeX,
  ZapOff,
} from 'lucide-react';
import { ROOM_BY_ID } from '../../shared/mapData';
import type { RoomSnapshot, ShieldEventNotice } from '../../shared/types';
import type { NearbyInteraction, ViewportHudTelemetry } from '../game/FirstPersonViewport';

interface GameHudProps {
  snapshot: RoomSnapshot;
  telemetry: ViewportHudTelemetry;
  muted: boolean;
  notice: ShieldEventNotice | null;
  actionError: string | null;
  onToggleMap: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onInteract: (interaction: NearbyInteraction) => void;
  onReportBody: (bodyId: string) => void;
  onActivateShield: () => void;
  onAttackTarget: (targetId: string) => void;
  onSabotageLights: () => void;
}

export function GameHud({
  snapshot,
  telemetry,
  muted,
  notice,
  actionError,
  onToggleMap,
  onTogglePause,
  onToggleMute,
  onInteract,
  onReportBody,
  onActivateShield,
  onAttackTarget,
  onSabotageLights,
}: GameHudProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const me = snapshot.players.find((p) => p.id === snapshot.self.playerId);
  const isAlive = me?.status === 'alive';
  const isCrew = snapshot.self.role === 'crew';
  const isSaboteur = snapshot.self.role === 'saboteur';

  const roomName = telemetry.roomId ? ROOM_BY_ID[telemetry.roomId]?.name : 'Коридор';

  const repairRatio =
    snapshot.requiredCrewTasks > 0
      ? Math.min(1, snapshot.completedCrewTasks / snapshot.requiredCrewTasks)
      : 0;

  const shieldActiveRemaining = Math.max(0, (snapshot.self.shieldActiveUntil - now) / 1000);
  const shieldIsActive = shieldActiveRemaining > 0;
  const killCd = Math.max(0, Math.ceil((snapshot.self.killCooldownUntil - now) / 1000));
  const sabCd = Math.max(0, Math.ceil((snapshot.self.sabotageCooldownUntil - now) / 1000));
  const slowedSec = Math.max(0, (snapshot.self.slowedUntil - now) / 1000);

  let shieldLabel = 'Щит заблокирован';
  if (shieldIsActive) {
    shieldLabel = `Щит активен (${shieldActiveRemaining.toFixed(1)} с)`;
  } else if (snapshot.shieldUnlocked) {
    shieldLabel = snapshot.self.shieldCharge > 0 ? 'Щит готов — Q' : 'Заряд потрачен';
  }

  const shieldReasonText =
    snapshot.shieldUnlockReason === 'tasks_50'
      ? 'Условие А: выполнено 50% начальных заданий'
      : snapshot.shieldUnlockReason === 'players_3'
        ? 'Условие Б: осталось ≤ 3 активных игроков'
        : `Откроется при 50% ремонта (${snapshot.completedCrewTasks}/${snapshot.initialTotalCrewTasks}) или ≤ 3 активных`;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Subtle cyan screen-edge glow while personal shield is active */}
      {shieldIsActive && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 70px rgba(56, 189, 248, 0.45)',
          }}
        />
      )}

      {/* Top-Left: Role, Current Room, Global Repair Progress, Active Players */}
      <div className="fixed top-4 left-4 flex flex-col gap-2.5 max-w-[330px]">
        <div className="bg-[#0c111b]/90 border border-slate-700/75 rounded-md px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-display font-bold tracking-wide text-slate-100">
              {roomName}
            </span>
            <span
              className={`font-semibold ${
                isSaboteur ? 'text-red-400' : 'text-sky-400'
              }`}
            >
              {isSaboteur ? 'Саботажник' : 'Экипаж'}
            </span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono-tabular mb-1">
              <span>Ремонт станции</span>
              <span>
                {snapshot.completedCrewTasks} / {snapshot.requiredCrewTasks}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-transform duration-300 origin-left"
                style={{ transform: `scaleX(${repairRatio})` }}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
            <span>Активных игроков: {snapshot.activePlayersCount}</span>
            <span>Раунд {snapshot.roundNumber}</span>
          </div>
        </div>

        {/* Assigned Tasks Checklist */}
        <div className="bg-[#0c111b]/88 border border-slate-800/90 rounded-md px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
            {isSaboteur ? 'Задания для прикрытия (прогресс не дают)' : 'Ваши задания'}
          </div>
          <ul className="space-y-1.5 text-xs">
            {snapshot.self.tasks.map((t) => {
              const curStage = t.stages[t.currentStageIndex];
              const stageRoom = curStage ? ROOM_BY_ID[curStage.roomId]?.shortName : '';
              const waitSec =
                curStage?.readyAt && curStage.readyAt > now
                  ? Math.ceil((curStage.readyAt - now) / 1000)
                  : 0;
              return (
                <li
                  key={t.taskId}
                  className={`flex items-start justify-between gap-2 ${
                    t.completed ? 'text-emerald-400/80 line-through' : 'text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 leading-snug">
                    {t.completed && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>
                      {t.title}
                      {!t.completed && t.stages.length > 1
                        ? ` (${t.currentStageIndex + 1}/${t.stages.length})`
                        : ''}
                    </span>
                  </span>
                  {!t.completed && (
                    <span className="text-[10px] font-mono-tabular text-amber-300/90 shrink-0">
                      {waitSec > 0 ? `${waitSec} с` : stageRoom}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Top-Center Alerts: Blackout, Observer Mode, Shield Notices */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-[460px] w-full px-4">
        {!isAlive && (
          <div className="bg-[#151c29]/95 border border-sky-500/60 rounded-md px-4 py-2 text-xs text-sky-200 text-center">
            Режим наблюдения · Вы выбыли, но можете завершать оставшиеся задания через терминалы
          </div>
        )}

        {snapshot.lightsOut && (
          <div className="bg-red-950/92 border border-red-500/75 rounded-md px-4 py-2 text-xs text-red-100 flex items-center gap-2">
            <ZapOff className="w-4 h-4 text-red-400 shrink-0" />
            <span>Освещение отключено! Восстановите щит в Электрощитовой.</span>
          </div>
        )}

        {notice && (
          <div className="bg-[#0e1b2c]/95 border border-sky-400/75 rounded-md px-4 py-2 text-xs text-sky-100 text-center">
            {notice.message}
          </div>
        )}

        {actionError && (
          <div className="bg-amber-950/95 border border-amber-500/75 rounded-md px-4 py-2 text-xs text-amber-100 text-center">
            {actionError}
          </div>
        )}
      </div>

      {/* Top-Right Compact Utility Controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMap();
          }}
          aria-label="Открыть карту станции (Tab)"
          title="Карта [Tab]"
          className="h-9 px-3 bg-[#0c111b]/90 hover:bg-[#192334] border border-slate-700/80 rounded-md text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
        >
          <MapIcon className="w-4 h-4 text-sky-400" />
          Карта [Tab]
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          title={muted ? 'Включить звук' : 'Выключить звук'}
          className="w-9 h-9 bg-[#0c111b]/90 hover:bg-[#192334] border border-slate-700/80 rounded-md flex items-center justify-center text-slate-200"
        >
          {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-slate-200" />}
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePause();
          }}
          aria-label="Настройки и пауза (Esc)"
          title="Настройки [Esc]"
          className="w-9 h-9 bg-[#0c111b]/90 hover:bg-[#192334] border border-slate-700/80 rounded-md flex items-center justify-center text-slate-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Center Crosshair */}
      <div
        aria-hidden="true"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="2" fill="#eef2f7" fillOpacity="0.88" />
          <path
            d="M11 2 V6 M11 16 V20 M2 11 H6 M16 11 H20"
            stroke="#eef2f7"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* PointerLock hint when unlocked in active game */}
      {!telemetry.pointerLocked && (
        <div className="fixed top-[56%] left-1/2 -translate-x-1/2 text-xs text-slate-300 bg-[#0c111b]/88 border border-slate-700/70 rounded px-3 py-1.5">
          Кликните по экрану для обзора мышью · Стрелки ← → тоже вращают камеру
        </div>
      )}

      {/* Center-Bottom Contextual Interaction Prompts */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto">
        {telemetry.nearbyInteraction && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onInteract(telemetry.nearbyInteraction!);
            }}
            className="px-4 py-2 bg-[#0e1624]/95 hover:bg-[#19263c] border border-amber-400/80 rounded-md text-sm font-semibold text-amber-200 flex items-center gap-2.5 shadow-lg"
          >
            <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-mono-tabular text-xs font-bold rounded">
              E
            </span>
            <span>{telemetry.nearbyInteraction.label}</span>
          </button>
        )}

        {telemetry.nearbyBodyId && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onReportBody(telemetry.nearbyBodyId!);
            }}
            className="px-4 py-2 bg-red-950/95 hover:bg-red-900 border border-red-400/80 rounded-md text-sm font-semibold text-red-100 flex items-center gap-2.5 shadow-lg"
          >
            <span className="px-1.5 py-0.5 bg-red-400 text-slate-950 font-mono-tabular text-xs font-bold rounded">
              R
            </span>
            <AlertTriangle className="w-4 h-4 text-red-300" />
            <span>Сообщить о найденном выбывшем</span>
          </button>
        )}

        {isSaboteur && isAlive && telemetry.nearbyAttackTarget && (
          <button
            type="button"
            tabIndex={-1}
            disabled={killCd > 0}
            onClick={(e) => {
              e.currentTarget.blur();
              onAttackTarget(telemetry.nearbyAttackTarget!.id);
            }}
            className="px-4 py-2 bg-red-950/95 hover:bg-red-900 disabled:opacity-50 border border-red-500/80 rounded-md text-sm font-semibold text-red-100 flex items-center gap-2.5 shadow-lg"
          >
            <span className="px-1.5 py-0.5 bg-red-500 text-white font-mono-tabular text-xs font-bold rounded">
              F
            </span>
            <span>
              {killCd > 0
                ? `Атака перезаряжается (${killCd} с)`
                : `Вывести из строя: ${telemetry.nearbyAttackTarget.name}`}
            </span>
          </button>
        )}
      </div>

      {/* Bottom-Left: Crew Self-Defense Shield OR Saboteur Ability Dock */}
      <div className="fixed bottom-4 left-4 pointer-events-auto">
        {isCrew && isAlive && (
          <div className="bg-[#0c111b]/92 border border-slate-700/80 rounded-md px-3.5 py-2.5 max-w-[340px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Shield
                  className={`w-4 h-4 ${
                    shieldIsActive
                      ? 'text-sky-300'
                      : snapshot.shieldUnlocked && snapshot.self.shieldCharge > 0
                        ? 'text-sky-400'
                        : 'text-slate-500'
                  }`}
                />
                <span
                  data-testid="shield-status-label"
                  className={`text-sm font-display font-bold ${
                    shieldIsActive
                      ? 'text-sky-300'
                      : snapshot.shieldUnlocked && snapshot.self.shieldCharge > 0
                        ? 'text-sky-400'
                        : 'text-slate-300'
                  }`}
                >
                  {shieldLabel}
                </span>
              </div>

              {snapshot.shieldUnlocked && snapshot.self.shieldCharge > 0 && !shieldIsActive && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onActivateShield();
                  }}
                  className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold rounded whitespace-nowrap"
                >
                  Включить [Q]
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
              {shieldReasonText}
            </p>
          </div>
        )}

        {isSaboteur && isAlive && (
          <div className="bg-[#0c111b]/92 border border-red-900/80 rounded-md px-3.5 py-2.5 flex items-center gap-3">
            <div className="text-xs font-mono-tabular">
              <div className="text-red-300 font-semibold">
                Атака [F]: {killCd > 0 ? `${killCd} с` : 'Готова'}
              </div>
              {slowedSec > 0 && (
                <div className="text-sky-300 mt-0.5">
                  Замедление щитом: {slowedSec.toFixed(1)} с
                </div>
              )}
            </div>
            <button
              type="button"
              tabIndex={-1}
              disabled={snapshot.lightsOut || sabCd > 0}
              onClick={(e) => {
                e.currentTarget.blur();
                onSabotageLights();
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded whitespace-nowrap flex items-center gap-1.5"
            >
              <ZapOff className="w-3.5 h-3.5" />
              {snapshot.lightsOut
                ? 'Свет отключён'
                : sabCd > 0
                  ? `Свет (${sabCd} с)`
                  : 'Отключить свет'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
