import { useState } from 'react';
import { Check, Copy, LogOut, Play, SlidersHorizontal } from 'lucide-react';
import { PLAYER_COLORS, type RoomSnapshot } from '../../shared/types';

interface LobbyViewProps {
  snapshot: RoomSnapshot;
  sensitivity: number;
  error: string | null;
  onSensitivityChange: (val: number) => void;
  onSelectColor: (colorHex: string) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export function LobbyView({
  snapshot,
  sensitivity,
  error,
  onSensitivityChange,
  onSelectColor,
  onStartMatch,
  onLeaveRoom,
}: LobbyViewProps) {
  const [copied, setCopied] = useState(false);

  const me = snapshot.players.find((p) => p.id === snapshot.self.playerId);
  const isHost = Boolean(me?.isHost);
  const connectedCount = snapshot.players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= 4 && connectedCount <= 8;

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${snapshot.roomCode}`
      : `?room=${snapshot.roomCode}`;

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via temporary input
      const el = document.createElement('input');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const takenColors = new Set(
    snapshot.players.filter((p) => p.id !== snapshot.self.playerId).map((p) => p.color),
  );

  return (
    <main className="fixed inset-0 z-10 flex items-center justify-center p-4 md:p-8 pointer-events-none">
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundColor: 'rgba(10, 14, 21, 0.72)' }}
      />

      <section className="relative z-10 w-full max-w-[880px] bg-[#111824]/95 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden pointer-events-auto">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-[#0d131d]">
          <div>
            <p className="text-xs text-slate-400">Комната орбитальной смены</p>
            <div className="flex items-baseline gap-3 mt-0.5">
              <h1 className="text-2xl font-display font-bold tracking-wider text-amber-400 font-mono-tabular">
                {snapshot.roomCode}
              </h1>
              <span className="text-xs text-slate-400 font-mono-tabular">
                Игроков: {connectedCount} / 8 (нужно 4–8)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyInvite}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1a2434] hover:bg-[#233146] border border-slate-600/80 text-slate-100 text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
              {copied ? 'Ссылка скопирована' : 'Копировать приглашение'}
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
          {/* Left: Roster */}
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Состав экипажа</h2>
              <span className="text-xs text-slate-400">
                1 саботажник назначается случайно
              </span>
            </div>

            <ul className="divide-y divide-slate-800/90 border border-slate-800 rounded-md bg-[#0b1019]">
              {snapshot.players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-4 h-4 rounded-sm shrink-0 border border-white/25"
                      style={{ backgroundColor: p.color }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-100 truncate">
                      {p.name}
                      {p.id === snapshot.self.playerId ? ' (вы)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                    {p.isHost && <span className="text-amber-400 font-semibold">Хозяин</span>}
                    {!p.connected && <span className="text-red-400">Переподключение...</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Suit Color + Controls + Start */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 mb-2.5">
                  Цвет скафандра
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {PLAYER_COLORS.map((c) => {
                    const isMine = me?.color === c.hex;
                    const isTaken = takenColors.has(c.hex);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={isTaken}
                        onClick={() => onSelectColor(c.hex)}
                        title={isTaken ? `${c.name} (занят)` : c.name}
                        aria-label={`Выбрать цвет ${c.name}`}
                        className={`h-9 rounded-md border flex items-center justify-center transition-all ${
                          isMine
                            ? 'border-white ring-2 ring-amber-400/80'
                            : isTaken
                              ? 'border-slate-800 opacity-30 cursor-not-allowed'
                              : 'border-slate-700 hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      >
                        {isMine && <Check className="w-4 h-4 text-slate-950 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="lobby-sensitivity"
                    className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    Чувствительность мыши
                  </label>
                  <span className="text-xs font-mono-tabular text-amber-300">
                    {sensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  id="lobby-sensitivity"
                  type="range"
                  min={0.4}
                  max={2.4}
                  step={0.1}
                  value={sensitivity}
                  onChange={(e) => onSensitivityChange(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-3">
                Отправьте ссылку друзьям или откройте её в 4 вкладках браузера, чтобы начать смену.
              </div>
            </div>

            <div className="space-y-2.5">
              {error && (
                <div
                  role="alert"
                  className="px-3 py-2 bg-red-950/90 border border-red-500/60 rounded text-xs text-red-200"
                >
                  {error}
                </div>
              )}

              {isHost ? (
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={onStartMatch}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm rounded-md transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {canStart
                    ? 'Начать смену'
                    : `Нужно ещё ${Math.max(0, 4 - connectedCount)} игрок(а)`}
                </button>
              ) : (
                <div className="px-4 py-3 bg-[#0b1019] border border-slate-800 rounded-md text-xs text-slate-300 text-center">
                  Ожидание запуска от хозяина комнаты
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
