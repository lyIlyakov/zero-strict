import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Copy, LogOut, Play, Shield, SlidersHorizontal, Users, X } from 'lucide-react';
import { CrewPortrait } from './CrewPortrait';
import { PLAYER_COLORS, ROOM_SETTINGS_LIMITS, SKIN_IDS, type RoomSettings, type RoomSnapshot, type SkinId } from '../../shared/types';
import './LobbyView.css';

export interface LobbyViewProps {
  snapshot: RoomSnapshot;
  sensitivity: number;
  error: string | null;
  onSensitivityChange: (val: number) => void;
  onSelectColor: (colorHex: string) => void;
  onSelectSkin: (skin: SkinId) => void;
  onSettings: (patch: Partial<RoomSettings>) => void;
  onPanelChange: (open: boolean) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

const SUITS = {
  standard: { name: 'Штатный', detail: 'Рабочая кепка' },
  survey: { name: 'Разведчик', detail: 'Лётные очки' },
  salvage: { name: 'Техник', detail: 'Каска с гребнем' },
  medic: { name: 'Медик', detail: 'Шапочка медика' },
} as const;

const PANELS = {
  crew: { title: 'Состав экипажа', label: 'Экипаж', Icon: Users },
  suit: { title: 'Скафандр', label: 'Скафандр', Icon: Shield },
  rules: { title: 'Правила смены', label: 'Правила', Icon: SlidersHorizontal },
} as const;

type Panel = keyof typeof PANELS;
type NumericSetting = keyof typeof ROOM_SETTINGS_LIMITS;
const NUMBER_RULES: { key: NumericSetting; label: string; unit: string }[] = [
  { key: 'maxPlayers', label: 'Лимит игроков', unit: 'мест' },
  { key: 'meetingSeconds', label: 'Время голосования', unit: 'с' },
  { key: 'killCooldownSeconds', label: 'Перезарядка после атаки', unit: 'с' },
];

function RulesPanel({ settings, occupied, isHost, onSettings }: {
  settings: RoomSettings;
  occupied: number;
  isHost: boolean;
  onSettings: LobbyViewProps['onSettings'];
}) {
  const [draft, setDraft] = useState<Partial<Record<NumericSetting, string>> & { emergencyEnabled?: boolean }>({});
  const { maxPlayers, meetingSeconds, killCooldownSeconds, emergencyEnabled } = settings;
  useEffect(() => {
    setDraft((previous) => {
      const next = { ...previous };
      if (next.maxPlayers === String(maxPlayers)) delete next.maxPlayers;
      if (next.meetingSeconds === String(meetingSeconds)) delete next.meetingSeconds;
      if (next.killCooldownSeconds === String(killCooldownSeconds)) delete next.killCooldownSeconds;
      if (next.emergencyEnabled === emergencyEnabled) delete next.emergencyEnabled;
      return next;
    });
  }, [maxPlayers, meetingSeconds, killCooldownSeconds, emergencyEnabled]);

  const hasChanges = NUMBER_RULES.some(({ key }) => draft[key] !== undefined && Number(draft[key]) !== settings[key]) ||
    (draft.emergencyEnabled !== undefined && draft.emergencyEnabled !== emergencyEnabled);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const patch: Partial<RoomSettings> = {};
    for (const { key } of NUMBER_RULES) {
      if (draft[key] !== undefined && Number(draft[key]) !== settings[key]) patch[key] = Number(draft[key]);
    }
    if (draft.emergencyEnabled !== undefined && draft.emergencyEnabled !== emergencyEnabled) patch.emergencyEnabled = draft.emergencyEnabled;
    if (Object.keys(patch).length) onSettings(patch);
  };

  return (
    <>
      <p className="lobby-description">В экипаже один случайно выбранный саботажник. Для старта нужны минимум два игрока на связи.</p>
      {isHost ? (
        <form onSubmit={submit}>
          {NUMBER_RULES.map(({ key, label, unit }) => {
            const { min, max } = ROOM_SETTINGS_LIMITS[key];
            const allowedMin = key === 'maxPlayers' ? Math.max(min, occupied) : min;
            return (
              <div className="lobby-rule" key={key}>
                <div>
                  <label htmlFor={`lobby-rule-${key}`}>{label}</label>
                  <p id={`lobby-limit-${key}`} className="lobby-muted">
                    {min}–{max} {unit}{key === 'maxPlayers' && occupied > min ? ` · занято ${occupied}` : ''}
                  </p>
                </div>
                <input
                  id={`lobby-rule-${key}`}
                  aria-describedby={`lobby-limit-${key}`}
                  type="number"
                  inputMode="numeric"
                  min={allowedMin}
                  max={max}
                  step={1}
                  required
                  value={draft[key] ?? settings[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </div>
            );
          })}
          <label className="lobby-rule lobby-rule-toggle">
            <span>Экстренный созыв<span className="lobby-muted">Сообщить о выбывшем можно всегда.</span></span>
            <input type="checkbox" checked={draft.emergencyEnabled ?? emergencyEnabled} onChange={(event) => setDraft({ ...draft, emergencyEnabled: event.target.checked })} />
          </label>
          <button className="lobby-button lobby-primary lobby-rules-save" type="submit" disabled={!hasChanges}>Сохранить правила</button>
        </form>
      ) : (
        <>
          <dl className="lobby-rule-list">
            {NUMBER_RULES.map(({ key, label, unit }) => (
              <div className="lobby-rule" key={key}><dt>{label}</dt><dd>{settings[key]} {unit}</dd></div>
            ))}
            <div className="lobby-rule"><dt>Экстренный созыв</dt><dd>{emergencyEnabled ? 'Разрешён' : 'Отключён'}</dd></div>
          </dl>
          <p className="lobby-muted">Правила меняет хозяин комнаты.</p>
        </>
      )}
    </>
  );
}

export function LobbyView({
  snapshot, sensitivity, error, onSensitivityChange, onSelectColor, onSelectSkin, onSettings, onPanelChange, onStartMatch, onLeaveRoom,
}: LobbyViewProps) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelChangeRef = useRef(onPanelChange);
  const openerRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  const me = snapshot.players.find((player) => player.id === snapshot.self.playerId);
  const connectedCount = snapshot.players.filter((player) => player.connected).length;
  const occupied = snapshot.players.length;
  const free = snapshot.settings.maxPlayers - occupied;
  const minPlayers = ROOM_SETTINGS_LIMITS.maxPlayers.min;
  const canStart = connectedCount >= minPlayers && connectedCount <= snapshot.settings.maxPlayers;
  const takenColors = new Set(snapshot.players.filter((player) => player.id !== me?.id).map((player) => player.color));
  const myColor = PLAYER_COLORS.find((color) => color.hex === me?.color);
  const inviteUrl = new URL(`?room=${snapshot.roomCode}`, window.location.href).href;

  useLayoutEffect(() => {
    panelChangeRef.current = onPanelChange;
  }, [onPanelChange]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (panel && !dialog.open) dialog.showModal();
    if (!panel && dialog.open) {
      dialog.close();
      openerRef.current?.focus({ preventScroll: true });
    }
  }, [panel]);

  useLayoutEffect(() => () => {
    if (openRef.current) panelChangeRef.current(false);
  }, []);

  useEffect(() => {
    if (inviteState !== 'copied') return;
    const timer = window.setTimeout(() => setInviteState('idle'), 2400);
    return () => window.clearTimeout(timer);
  }, [inviteState]);

  const openPanel = (next: Panel, opener: HTMLElement) => {
    openerRef.current = opener;
    openRef.current = true;
    onPanelChange(true);
    setPanel(next);
  };
  const closePanel = () => {
    openRef.current = false;
    onPanelChange(false);
    setPanel(null);
  };
  const copyInvite = async (opener: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteState('copied');
    } catch {
      if (!opener.isConnected) return;
      setInviteState('manual');
      openPanel('crew', opener);
    }
  };

  return (
    <main className="cascade-lobby" aria-label="Лобби станции Каскад">
      <p className="lobby-key-hint"><kbd>W A S D</kbd> ходьба <span aria-hidden="true">·</span> <kbd>Tab</kbd> к панелям</p>
      <header className="lobby-header">
        <div className="lobby-identity">
          <h1>Станция Каскад</h1>
          <p>Шлюз экипажа <span className="lobby-code">{snapshot.roomCode}</span></p>
        </div>
        <div className="lobby-header-actions">
          <button className="lobby-button" type="button" aria-label="Скопировать приглашение" title="Скопировать приглашение" onClick={(event) => void copyInvite(event.currentTarget)}>
            {inviteState === 'copied' ? <Check /> : <Copy />}
            <span>{inviteState === 'copied' ? 'Скопировано' : 'Пригласить'}</span>
          </button>
          <button className="lobby-button" type="button" aria-label="Выйти из комнаты" title="Выйти из комнаты" onClick={onLeaveRoom}><LogOut /><span>Выйти</span></button>
          <span className="lobby-sr-only" role="status">{inviteState === 'copied' && 'Ссылка скопирована в буфер обмена'}</span>
        </div>
      </header>

      {!panel && error && <p className="lobby-error lobby-hud-error" role="alert">{error}</p>}

      <div className="lobby-console">
        <nav className="lobby-dock" aria-label="Панели лобби">
          {(Object.keys(PANELS) as Panel[]).map((key) => {
            const { label, Icon } = PANELS[key];
            return (
              <button key={key} className="lobby-button" type="button" aria-haspopup="dialog" aria-controls="lobby-panel" aria-expanded={panel === key} onClick={(event) => openPanel(key, event.currentTarget)}>
                <Icon /><span>{label}{key === 'crew' && <span className="lobby-count"> {connectedCount}/{snapshot.settings.maxPlayers}</span>}</span>
              </button>
            );
          })}
        </nav>
        <div className="lobby-launch">
          <p className="lobby-launch-status" id="lobby-launch-status" role="status">
            {canStart ? (me?.isHost ? 'Экипаж готов к запуску' : 'Ожидаем запуска от хозяина') : `Для старта: ${connectedCount} из ${minPlayers} на связи`}
          </p>
          {me?.isHost && (
            <button className="lobby-button lobby-primary" type="button" disabled={!canStart} aria-describedby="lobby-launch-status" onClick={onStartMatch}><Play />Начать смену</button>
          )}
        </div>
      </div>

      <dialog
        id="lobby-panel"
        ref={dialogRef}
        className="lobby-panel"
        aria-labelledby="lobby-panel-title"
        onCancel={(event) => { event.preventDefault(); closePanel(); }}
      >
        {panel && (
          <>
            <header className="lobby-panel-header">
              <h2 id="lobby-panel-title">{PANELS[panel].title}</h2>
              <button className="lobby-button lobby-close" type="button" aria-label="Закрыть панель" title="Закрыть панель (Esc)" onClick={closePanel}><X /></button>
            </header>
            <div className="lobby-panel-content">
              {error && <p className="lobby-error" role="alert">{error}</p>}
              {panel === 'crew' && (
                <>
                  <p className="lobby-description">На связи: {connectedCount}/{snapshot.settings.maxPlayers}. Свободных мест: {free}.</p>
                  {inviteState === 'manual' && (
                    <label className="lobby-invite-input">Не удалось скопировать автоматически. Скопируйте ссылку вручную.
                      <input type="url" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} />
                    </label>
                  )}
                  <ul className="lobby-roster">
                    {snapshot.players.map((player) => (
                      <li key={player.id}>
                        <CrewPortrait color={player.color} skin={player.skin} />
                        <div className="lobby-player-info">
                          <span>{player.name}{player.id === me?.id && <small>Вы</small>}</span>
                          <span className="lobby-muted">{SUITS[player.skin].name}</span>
                        </div>
                        <div className="lobby-player-state">
                          {player.isHost && <span>Хозяин</span>}
                          {!player.connected && <span className="lobby-muted">Переподключается</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="lobby-muted">{free > 0 ? 'Пригласите друзей по коду комнаты или по ссылке.' : 'Все места заняты, включая места отключившихся игроков.'}</p>
                </>
              )}
              {panel === 'suit' && (
                <>
                  <p className="lobby-description">Модель и цвет видит весь экипаж. На роль они не влияют.</p>
                  <div className="lobby-suits" role="group" aria-label="Модель скафандра">
                    {SKIN_IDS.map((skin) => {
                      const { name, detail } = SUITS[skin];
                      return (
                        <button key={skin} className="lobby-button lobby-suit" type="button" aria-pressed={me?.skin === skin} onClick={() => onSelectSkin(skin)}>
                          <CrewPortrait color={myColor?.hex ?? PLAYER_COLORS[0].hex} skin={skin} /><span>{name}<small>{detail}</small></span>{me?.skin === skin && <Check className="lobby-suit-check" />}
                        </button>
                      );
                    })}
                  </div>
                  <section className="lobby-color-section" aria-labelledby="lobby-color-label">
                    <h3 id="lobby-color-label">Цвет <span className="lobby-muted">{myColor?.name}</span></h3>
                    <div className="lobby-colors" role="group" aria-labelledby="lobby-color-label">
                      {PLAYER_COLORS.map((color) => {
                        const selected = me?.color === color.hex;
                        const taken = takenColors.has(color.hex);
                        const label = `${color.name}${taken ? ' — занят' : ''}`;
                        return (
                          <button key={color.id} className="lobby-button lobby-color" type="button" title={label} aria-label={label} aria-pressed={selected} disabled={taken} onClick={() => onSelectColor(color.hex)}>
                            <span className="lobby-color-chip" style={{ backgroundColor: color.hex }}>{selected ? <Check /> : taken ? <X /> : null}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  <div className="lobby-sensitivity">
                    <label htmlFor="lobby-sensitivity">Чувствительность обзора</label>
                    <output htmlFor="lobby-sensitivity">{sensitivity.toFixed(1)}×</output>
                    <input id="lobby-sensitivity" type="range" min={0.4} max={2.4} step={0.1} value={sensitivity} onChange={(event) => onSensitivityChange(Number(event.target.value))} />
                  </div>
                </>
              )}
              {panel === 'rules' && <RulesPanel settings={snapshot.settings} occupied={occupied} isHost={Boolean(me?.isHost)} onSettings={onSettings} />}
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
