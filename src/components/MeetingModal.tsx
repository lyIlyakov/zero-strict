import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Send, SkipForward, Users } from 'lucide-react';
import { ROOM_BY_ID } from '../../shared/mapData';
import type { RoomSnapshot } from '../../shared/types';

interface MeetingModalProps {
  snapshot: RoomSnapshot;
  onVote: (targetId: string | 'skip') => void;
  onSendChat: (text: string) => void;
}

export function MeetingModal({ snapshot, onVote, onSendChat }: MeetingModalProps) {
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const meeting = snapshot.meeting;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meeting?.chat.length]);

  if (!meeting) return null;

  const me = snapshot.players.find((p) => p.id === snapshot.self.playerId);
  const canParticipate = me?.status === 'alive' && me.connected && !meeting.result;
  const hasVoted = meeting.myVote !== null;

  const remainingSec = meeting.result
    ? Math.max(0, Math.ceil(((meeting.resolveAt ?? now) - now) / 1000))
    : Math.max(0, Math.ceil((meeting.endsAt - now) / 1000));

  const victimRoom = meeting.victimRoomId ? ROOM_BY_ID[meeting.victimRoomId]?.name : 'коридоре';

  const handleSubmitChat = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !canParticipate) return;
    onSendChat(text);
    setDraft('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Собрание экипажа"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070b12]/92"
    >
      <div className="w-full max-w-[1040px] max-h-[90vh] flex flex-col bg-[#101723] border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-[#0b1019]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-lg font-display font-bold text-slate-100">
                {meeting.reason === 'body'
                  ? `Найден выбывший: ${meeting.victimName ?? 'Член экипажа'}`
                  : `Экстренное собрание — вызвал ${meeting.callerName}`}
              </h2>
              <p className="text-xs text-slate-400">
                {meeting.reason === 'body'
                  ? `Сообщил: ${meeting.callerName} · Место: ${victimRoom}`
                  : 'Обсудите наблюдения «Эха датчика» и проголосуйте за подозреваемого или пропустите.'}
              </p>
            </div>
          </div>

          <div className="text-right font-mono-tabular">
            <div className="text-xs text-slate-400">
              {meeting.result ? 'Возврат на станцию' : 'До конца голосования'}
            </div>
            <div className="text-2xl font-bold text-amber-400">{remainingSec} с</div>
          </div>
        </div>

        {/* Result banner if tallied */}
        {meeting.result && (
          <div className="px-6 py-3 bg-[#152033] border-b border-sky-500/40 text-sm font-semibold text-sky-100 flex items-center justify-between">
            <span>
              {meeting.result.outcome === 'ejected'
                ? `По итогам голосования исключён: ${meeting.result.ejectedPlayerName}`
                : meeting.result.outcome === 'tie'
                  ? 'Ничья при голосовании — никто не выбывает.'
                  : 'Большинство воздержалось — никто не выбывает.'}
            </span>
            <span className="text-xs font-mono-tabular text-slate-300">
              Пропустили: {meeting.result.skipVotes}
            </span>
          </div>
        )}

        {/* Body: Candidates Left + Live Chat Right */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Candidates & Voting */}
          <div className="lg:col-span-7 p-5 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Users className="w-4 h-4" />
                Кандидаты
              </span>
              <span className="font-mono-tabular">
                Проголосовало: {meeting.votedPlayerIds.length} / {snapshot.activePlayersCount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {snapshot.players.map((p) => {
                const isAlive = p.status === 'alive';
                const hasCast = meeting.votedPlayerIds.includes(p.id);
                const votesAgainst = meeting.result?.tallies[p.id] ?? 0;
                const isMyChoice = meeting.myVote === p.id;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 px-3.5 py-3 rounded-md border ${
                      !isAlive
                        ? 'bg-[#0a0e15] border-slate-800/70 opacity-50'
                        : isMyChoice
                          ? 'bg-sky-950/60 border-sky-400'
                          : 'bg-[#0d1420] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-sm shrink-0 border border-white/25"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {p.name}
                          {p.id === snapshot.self.playerId ? ' (вы)' : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {!isAlive
                            ? 'Выбыл (наблюдатель)'
                            : !p.connected
                              ? 'Нет связи'
                              : hasCast
                                ? 'Голос отдан'
                                : 'Думает'}
                        </div>
                      </div>
                    </div>

                    {meeting.result ? (
                      <span className="text-xs font-mono-tabular font-bold text-amber-300 shrink-0">
                        {votesAgainst > 0 ? `${votesAgainst} гол.` : ''}
                      </span>
                    ) : (
                      isAlive && (
                        <button
                          type="button"
                          disabled={!canParticipate || hasVoted}
                          onClick={() => onVote(p.id)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                            isMyChoice
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-[#1c2638] hover:bg-amber-500 hover:text-slate-950 disabled:opacity-40 text-slate-100'
                          }`}
                        >
                          {isMyChoice ? (
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Выбран
                            </span>
                          ) : (
                            'Голос'
                          )}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Skip Vote Action */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
              {!canParticipate && !meeting.result ? (
                <span className="text-xs text-slate-400">
                  Выбывшие наблюдатели не участвуют в голосовании.
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  {hasVoted ? 'Ваш голос учтён.' : 'Выберите подозреваемого или пропустите голосование.'}
                </span>
              )}

              <button
                type="button"
                disabled={!canParticipate || hasVoted}
                onClick={() => onVote('skip')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  meeting.myVote === 'skip'
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-[#1c2638] hover:bg-[#27354d] disabled:opacity-40 border border-slate-600/70 text-slate-100'
                }`}
              >
                <SkipForward className="w-3.5 h-3.5" />
                Пропустить
              </button>
            </div>
          </div>

          {/* Live Discussion Chat */}
          <div className="lg:col-span-5 flex flex-col min-h-[260px] max-h-[55vh] lg:max-h-none bg-[#0b1019]">
            <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-slate-300">
              Чат обсуждения
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {meeting.chat.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Сообщений пока нет. Поделитесь, в каком отсеке вы были.
                </p>
              ) : (
                meeting.chat.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-[#111927] border border-slate-800/90 rounded-md px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: msg.senderColor }}
                      />
                      <span className="font-semibold text-slate-200">{msg.senderName}</span>
                    </div>
                    <p className="text-slate-300 break-words leading-relaxed">{msg.text}</p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSubmitChat}
              className="p-3 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                maxLength={240}
                disabled={!canParticipate}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  me?.status !== 'alive'
                    ? 'Наблюдатели не могут писать в чат'
                    : 'Написать экипажу...'
                }
                aria-label="Сообщение в чат собрания"
                className="flex-1 px-3 py-2 bg-[#0a0f18] border border-slate-700 rounded text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-50 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!canParticipate || !draft.trim()}
                aria-label="Отправить сообщение"
                className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
