import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import './dock.css';

interface MainMenuProps {
  initialRoomCode: string;
  initialName: string;
  busy: boolean;
  error: string | null;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (roomCode: string, name: string) => void;
}

export function MainMenu({ initialRoomCode, initialName, busy, error, onCreateRoom, onJoinRoom }: MainMenuProps) {
  const [name, setName] = useState(initialName);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [issue, setIssue] = useState<'name' | 'code' | null>(null);
  const [pendingAction, setPendingAction] = useState<'join' | 'create' | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const displayedError = issue === 'name' ? 'Введите позывной: не меньше двух символов.'
    : issue === 'code' ? 'Введите шесть букв или цифр из кода приглашения.' : error;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === 'create' ? 'create' : 'join';
    const cleanName = name.trim();
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanName.length < 2) {
      setIssue('name');
      nameRef.current?.focus();
      return;
    }
    if (action === 'join' && !/^[A-Z0-9]{6}$/.test(cleanCode)) {
      setIssue('code');
      codeRef.current?.focus();
      return;
    }
    setIssue(null);
    setPendingAction(action);
    if (action === 'create') onCreateRoom(cleanName);
    else onJoinRoom(cleanCode, cleanName);
  };

  return (
    <main className="dock-ui dock-menu">
      <img className="dock-menu__art" src="/art/crew-lobby-concept.png"
        alt="" fetchPriority="high" />
      <div className="dock-menu__content">
        <header className="dock-menu__title">
          <h1>Нулевая<br />смена</h1>
          <p className="dock-menu__station">Орбитальная станция «Каскад»</p>
          <p className="dock-muted">Экипаж из 4–8 человек восстанавливает станцию. Один из вас — саботажник.</p>
        </header>
        <form className="dock-menu__form" onSubmit={handleSubmit} aria-busy={busy}>
          <div className="dock-field">
            <label htmlFor="player-nickname">Ваш позывной</label>
            <input ref={nameRef} id="player-nickname" maxLength={18} value={name} disabled={busy}
              autoComplete="nickname" placeholder="Например, Вега"
              aria-invalid={issue === 'name' || undefined} aria-describedby={issue === 'name' ? 'dock-menu-error' : undefined}
              onChange={(event) => { setName(event.target.value); if (issue === 'name') setIssue(null); }} />
          </div>
          <div className="dock-menu__join">
            <div className="dock-field">
              <label htmlFor="room-code-input">Код комнаты</label>
              <input ref={codeRef} id="room-code-input" className="dock-menu__code" maxLength={6} disabled={busy}
                value={roomCode} placeholder="ABC123" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                aria-invalid={issue === 'code' || undefined} aria-describedby={issue === 'code' ? 'dock-menu-error' : undefined}
                onChange={(event) => { setRoomCode(event.target.value.toUpperCase()); if (issue === 'code') setIssue(null); }} />
            </div>
            <button type="submit" value="join" data-start="true" className="dock-button dock-button--primary" disabled={busy}>
              {busy && pendingAction === 'join' ? 'Входим…' : 'Войти по коду'} <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <p role="alert" id="dock-menu-error" className={displayedError ? 'dock-error' : undefined}>{displayedError}</p>
          <div className="dock-menu__create">
            <p className="dock-muted">Собираете свой экипаж?</p>
            <button type="submit" value="create" data-start="true" className="dock-button" disabled={busy}>
              <Plus size={18} aria-hidden="true" /> {busy && pendingAction === 'create' ? 'Создаём…' : 'Создать комнату'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
