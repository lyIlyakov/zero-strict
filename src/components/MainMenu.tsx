import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, Plus } from 'lucide-react';

interface MainMenuProps {
  initialRoomCode: string;
  initialName: string;
  busy: boolean;
  error: string | null;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (roomCode: string, name: string) => void;
}

export function MainMenu({
  initialRoomCode,
  initialName,
  busy,
  error,
  onCreateRoom,
  onJoinRoom,
}: MainMenuProps) {
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [joinExpanded, setJoinExpanded] = useState(Boolean(initialRoomCode));
  const [localError, setLocalError] = useState<string | null>(null);

  const displayedError = localError ?? error;

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (cleaned.length < 2) {
      setLocalError('Введите позывной (минимум 2 символа).');
      return;
    }
    setLocalError(null);
    onCreateRoom(cleaned);
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const cleanedName = name.trim();
    const cleanedCode = roomCode.trim().toUpperCase();
    if (cleanedName.length < 2) {
      setLocalError('Введите позывной (минимум 2 символа).');
      return;
    }
    if (cleanedCode.length < 4) {
      setLocalError('Введите 6-значный код комнаты.');
      return;
    }
    setLocalError(null);
    onJoinRoom(cleanedCode, cleanedName);
  };

  return (
    <main className="fixed inset-0 z-10 flex flex-col justify-between p-6 md:p-12 pointer-events-none">
      {/* Subtle dark atmospheric left scrim so typography stays high-contrast over the live 3D station */}
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 w-full md:w-[580px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,14,21,0.95) 0%, rgba(10,14,21,0.84) 68%, rgba(10,14,21,0) 100%)',
        }}
      />

      <div className="relative z-10 flex-1 flex items-center">
        <section className="w-full max-w-[440px] pointer-events-auto">
          {/* Custom Orbital Emblem & Title Lockup */}
          <div className="mb-8">
            <svg
              viewBox="0 0 360 72"
              className="w-full max-w-[360px] h-auto mb-3"
              role="img"
              aria-label="Нулевая смена — Станция Каскад"
            >
              <g fill="none">
                <rect x="2" y="10" width="48" height="48" rx="4" stroke="#f59e0b" strokeWidth="2.5" fill="#111827" />
                <circle cx="26" cy="34" r="14" stroke="#38bdf8" strokeWidth="2.2" />
                <path d="M26 16 V24 M26 44 V52 M8 34 H16 M36 34 H44" stroke="#f59e0b" strokeWidth="2.2" />
                <circle cx="26" cy="34" r="4" fill="#f59e0b" />
              </g>
              <text
                x="64"
                y="37"
                fill="#f8fafc"
                fontFamily="'Exo 2', sans-serif"
                fontWeight="800"
                fontSize="30"
                letterSpacing="1.2"
              >
                НУЛЕВАЯ СМЕНА
              </text>
              <text
                x="65"
                y="57"
                fill="#94a3b8"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                fontSize="12"
                letterSpacing="2.2"
              >
                ОРБИТАЛЬНАЯ СТАНЦИЯ «КАСКАД»
              </text>
            </svg>
            <p className="text-sm text-slate-300 leading-relaxed max-w-[40ch]">
              Экипаж из 4–8 человек чинит отсеки от первого лица. Один скрытый саботажник мешает ремонту и гасит свет.
            </p>
          </div>

          {/* Entry Panel */}
          <div className="bg-[#111824]/95 border border-slate-700/70 rounded-lg p-6 shadow-2xl space-y-5">
            <div>
              <label
                htmlFor="player-nickname"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Позывной игрока
              </label>
              <input
                id="player-nickname"
                type="text"
                maxLength={18}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Командор"
                autoComplete="nickname"
                className="w-full px-3.5 py-2.5 bg-[#0a0f18] border border-slate-600/80 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {displayedError && (
              <div
                role="alert"
                className="px-3.5 py-2.5 bg-red-950/90 border border-red-500/60 rounded-md text-xs text-red-200"
              >
                {displayedError}
              </div>
            )}

            {!joinExpanded ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  data-start="true"
                  disabled={busy}
                  onClick={handleCreate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-md transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Создать комнату
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setJoinExpanded(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1b2434] hover:bg-[#243045] border border-slate-600/70 text-slate-100 font-medium text-sm rounded-md transition-colors whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4 text-sky-400" />
                  Войти по коду
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoin} className="space-y-3">
                <div>
                  <label
                    htmlFor="room-code-input"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    Код комнаты
                  </label>
                  <input
                    id="room-code-input"
                    type="text"
                    maxLength={8}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    className="w-full px-3.5 py-2.5 bg-[#0a0f18] border border-slate-600/80 rounded-md text-base font-mono-tabular tracking-widest uppercase text-amber-300 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="submit"
                    data-start="true"
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold text-sm rounded-md transition-colors whitespace-nowrap"
                  >
                    Войти в отсек
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setJoinExpanded(false)}
                    className="px-3.5 py-2.5 bg-[#1b2434] hover:bg-[#243045] border border-slate-600/70 text-slate-200 text-sm rounded-md transition-colors whitespace-nowrap"
                  >
                    Назад
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreate}
                  className="w-full text-center text-xs text-slate-400 hover:text-amber-300 transition-colors pt-1"
                >
                  Или создать новую комнату
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* Flat borderless control hints in bottom safe margin */}
      <footer className="relative z-10 text-xs text-slate-400 font-mono-tabular tracking-wide">
        WASD Движение · Мышь Обзор · E Взаимодействие · Q Щит · R Сообщить · Tab Карта
      </footer>
    </main>
  );
}
