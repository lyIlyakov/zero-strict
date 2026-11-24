import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Send } from 'lucide-react';
import { ROOM_BY_ID } from '../../shared/mapData';
import type { MeetingState, RoomSnapshot } from '../../shared/types';
import { CrewPortrait } from './CrewPortrait';
import './dock.css';

interface MeetingModalProps {
  snapshot: RoomSnapshot;
  onVote: (targetId: string | 'skip') => void;
  onSendChat: (text: string) => void;
}

export function MeetingModal(props: MeetingModalProps) {
  const meeting = props.snapshot.meeting;
  return meeting ? <MeetingSession key={meeting.id} {...props} meeting={meeting} /> : null;
}

function MeetingSession({ snapshot, meeting, onVote, onSendChat }: MeetingModalProps & { meeting: MeetingState }) {
  const [draft, setDraft] = useState('');
  const [selection, setSelection] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [clockOffset] = useState(() => snapshot.serverTime - Date.now());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const followChat = useRef(true);
  const ballotStatusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    headingRef.current?.focus();
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(id);
      dialog?.close();
    };
  }, []);

  const lastMessageId = meeting.chat.at(-1)?.id;
  useEffect(() => {
    if (followChat.current && chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [lastMessageId]);

  const me = snapshot.players.find((player) => player.id === snapshot.self.playerId);
  const result = meeting.result;
  const seconds = Math.max(0, Math.ceil(((result ? meeting.resolveAt ?? now + clockOffset : meeting.endsAt) - (now + clockOffset)) / 1000));
  const canChat = Boolean(me?.status === 'alive' && me.connected && !result && seconds > 0);
  const voters = snapshot.players.filter((player) => player.connected && player.status === 'alive');
  const votedCount = voters.filter((player) => meeting.votedPlayerIds.includes(player.id)).length;
  const hasVoted = meeting.myVote !== null;
  const submitting = sentAt !== null && now - sentAt < 3500;
  const canPick = canChat && !hasVoted && !submitting;
  const picked = meeting.myVote ?? selection;
  const selectedPlayer = snapshot.players.find(({ id }) => id === picked && id !== 'skip');
  const validSelection = selection === 'skip' || selectedPlayer?.status === 'alive';
  const choiceLabel = picked === 'skip' ? 'Пропустить голосование' : selectedPlayer?.name;
  const victimRoom = meeting.victimRoomId ? ROOM_BY_ID[meeting.victimRoomId].name : 'Коридор';
  const resultText = result?.outcome === 'ejected' ? `Исключён игрок ${result.ejectedPlayerName ?? 'без позывного'}.`
    : result?.outcome === 'tie' ? 'Ничья. Никто не выбывает.' : 'Голосование пропущено. Никто не выбывает.';

  const handleConfirm = (event: FormEvent) => {
    event.preventDefault();
    if (!canPick || !validSelection || !selection || Date.now() + clockOffset >= meeting.endsAt) return;
    setSentAt(Date.now());
    ballotStatusRef.current?.focus({ preventScroll: true });
    onVote(selection);
  };

  const handleChat = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !canChat) return;
    onSendChat(text);
    setDraft('');
  };

  const ballotStatus = result ? null : hasVoted ? `Голос учтён${choiceLabel ? `: ${choiceLabel}` : ''}.`
    : !seconds ? 'Время вышло. Подводим итоги…'
      : me?.status !== 'alive' ? 'Вы наблюдаете за собранием.'
        : !me.connected ? 'Нет связи со станцией.'
          : submitting ? 'Отправляем голос…'
            : sentAt !== null ? 'Нет подтверждения. Попробуйте ещё раз.'
              : choiceLabel && validSelection ? `Ваш выбор: ${choiceLabel}.` : 'Выберите игрока или пропуск.';

  return (
    <dialog ref={dialogRef} className="dock-ui dock-dialog dock-meeting" aria-labelledby="dock-meeting-title"
      onCancel={(event) => event.preventDefault()}>
      <header className="dock-dialog__header">
        <div>
          <h2 id="dock-meeting-title" ref={headingRef} tabIndex={-1}>Собрание экипажа</h2>
          <p className="dock-muted">{meeting.reason === 'body'
            ? `Найден выбывший: ${meeting.victimName ?? 'член экипажа'} · ${victimRoom}. Сообщил: ${meeting.callerName}.`
            : `Экстренный созыв: ${meeting.callerName}.`}</p>
        </div>
        <div className="dock-meeting__clock">
          <span>{result ? 'Возврат через' : 'До конца'}</span>
          <strong role="timer" aria-label={result ? 'До возврата на станцию' : 'До конца голосования'}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </strong>
        </div>
      </header>
      <div className="dock-meeting__body">
        <form onSubmit={handleConfirm} className="dock-ballot">
          <fieldset disabled={!canPick} className="dock-ballot__choices">
            <legend>{result ? 'Итоги голосования' : 'Голосование'}</legend>
            {result ? <p className="dock-ballot__result" role="status">{resultText}</p>
              : <p className="dock-muted dock-ballot__count">На связи проголосовали: {votedCount} из {voters.length}</p>}
            <ul className="dock-ballot__list">
              {snapshot.players.map((player) => {
                const isPicked = (result || validSelection || hasVoted) && picked === player.id;
                const details = !player.connected ? 'Нет связи' : player.status !== 'alive' ? 'Выбыл'
                  : meeting.votedPlayerIds.includes(player.id) ? 'Голос отдан' : 'Не голосовал';
                return (
                  <li key={player.id}>
                    <label className="dock-ballot__row" data-selected={Boolean(isPicked)} data-disabled={player.status !== 'alive'}>
                      {!result && <input type="radio" name="dock-vote" value={player.id}
                        disabled={player.status !== 'alive'} checked={Boolean(isPicked)}
                        onChange={() => { setSelection(player.id); setSentAt(null); }} />}
                      <CrewPortrait color={player.color} skin={player.skin} />
                      <span className="dock-ballot__name">{player.name}{player.id === snapshot.self.playerId ? ' (вы)' : ''}</span>
                      {result ? <strong className="dock-ballot__tally" aria-label={`Голосов: ${result.tallies[player.id] ?? 0}`}>{result.tallies[player.id] ?? 0}</strong>
                        : <span className="dock-ballot__state dock-muted">{details}</span>}
                    </label>
                  </li>
                );
              })}
              <li>
                <label className="dock-ballot__row dock-ballot__skip" data-selected={picked === 'skip'}>
                  {!result && <input type="radio" name="dock-vote" value="skip" checked={picked === 'skip'}
                    onChange={() => { setSelection('skip'); setSentAt(null); }} />}
                  <span className="dock-ballot__name">Пропустить голосование</span>
                  {result && <strong className="dock-ballot__tally" aria-label={`Пропусков: ${result.skipVotes}`}>{result.skipVotes}</strong>}
                </label>
              </li>
            </ul>
          </fieldset>
          {!result && (
            <div className="dock-ballot__confirm">
              <p className="dock-muted" ref={ballotStatusRef} tabIndex={-1} role="status">{ballotStatus}</p>
              <button type="submit" className="dock-button dock-button--primary" disabled={!canPick || !validSelection}>
                <Check size={18} aria-hidden="true" /> Подтвердить голос
              </button>
            </div>
          )}
        </form>
        <section className="dock-chat" aria-labelledby="dock-chat-title">
          <h3 id="dock-chat-title">Обсуждение</h3>
          <div className="dock-chat__log" ref={chatRef} role="log" aria-label="Чат экипажа" tabIndex={0}
            onScroll={(event) => {
              const log = event.currentTarget;
              followChat.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
            }}>
            {!meeting.chat.length && <p className="dock-muted">Сообщений пока нет. Расскажите, что заметили на станции.</p>}
            {meeting.chat.map((message) => (
              <div key={message.id} className="dock-chat__message">
                <span className="dock-ballot__swatch" style={{ backgroundColor: message.senderColor }} aria-hidden="true" />
                <div><strong>{message.senderName}</strong><p>{message.text}</p></div>
              </div>
            ))}
          </div>
          <form className="dock-chat__compose" onSubmit={handleChat}>
            <input aria-label="Сообщение экипажу" placeholder={canChat ? 'Написать экипажу…' : 'Чат только для чтения'}
              maxLength={240} disabled={!canChat} value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button type="submit" className="dock-button" aria-label="Отправить сообщение" disabled={!canChat || !draft.trim()}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      </div>
    </dialog>
  );
}
