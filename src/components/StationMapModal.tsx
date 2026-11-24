import { useEffect, useRef } from 'react';
import { LocateFixed, TriangleAlert, X } from 'lucide-react';
import { CORRIDORS, getRoomAt, ROOMS, ROOM_BY_ID, SOLID_OBSTACLES, TERMINAL_BY_ID, WALL_SEGMENTS } from '../../shared/mapData';
import type { RoomId, RoomSnapshot } from '../../shared/types';
import { ROOM_LANDMARK_NAMES } from '../game/dockLandmarks';
import './dock.css';

interface StationMapModalProps {
  snapshot: RoomSnapshot;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  onClose: () => void;
}

// Position labels in the negative space so neither routes nor task markers cover them.
const mapLabels: Record<RoomId, { name: string; y: number; color: string }> = {
  command: { name: 'Командный', y: -7.0, color: '#7d694e' },
  medbay: { name: 'Медотсек', y: -22.9, color: '#4e706c' },
  storage: { name: 'Склад', y: 24.1, color: '#765838' },
  comms: { name: 'Связь', y: -22.9, color: '#4c647a' },
  navigation: { name: 'Навигация', y: -22.9, color: '#675c7c' },
  reactor: { name: 'Реакторная', y: -8.8, color: '#845848' },
  airlock: { name: 'Шлюз', y: -8.8, color: '#5b6570' },
  electrical: { name: 'Электро', y: 24.1, color: '#75633c' },
  hydroponics: { name: 'Гидропоника', y: 24.1, color: '#4d6b53' },
};

function LandmarkMark({ room }: { room: RoomId }) {
  switch (room) {
    case 'command': return <path d="M-1.8-.9H1.8L2.3 0 1.8.9h-3.6L-2.3 0Z" />;
    case 'medbay': return <path d="M-1.6-.9h3.2v1.8h-3.2zM0-.55v1.1m-.55-.55h1.1" />;
    case 'storage': return <path d="M-2-.85h4v1.7h-4zM0-.85v1.7" />;
    case 'comms': return <path d="M-1.5-1.15h3v2.3h-3zM-1.5 0h3" />;
    case 'navigation': return <path d="M-1.1-1.05h2.2l.8 2.1h-3.8zM-.63.25H.63" />;
    case 'reactor': return <circle r="1.5" />;
    case 'airlock': return <path d="M-1.5-1.1h1.15v2.2H-1.5zM.35-1.1H1.5v2.2H.35z" />;
    case 'electrical': return <path d="M-1.9-.8h3.8v1.6h-3.8zM-.65-.8V.8M.65-.8V.8" />;
    case 'hydroponics': return <path d="M-2.45-.8h4.9v1.6h-4.9zM-1.2 0h2.4" />;
  }
}

export function StationMapModal({ snapshot, playerX, playerZ, playerYaw, onClose }: StationMapModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => { dialog?.close(); };
  }, []);

  const activeTasks = snapshot.self.tasks.flatMap((task) => {
    const stage = !task.completed && task.stages[task.currentStageIndex];
    const terminal = stage ? TERMINAL_BY_ID[stage.terminalId] : undefined;
    return terminal ? [{ id: task.taskId, title: task.title, step: task.currentStageIndex + 1, steps: task.stages.length, terminal }] : [];
  });
  const lightsTerminal = snapshot.lightsOut ? TERMINAL_BY_ID.ele_lights : null;
  const heading = (-playerYaw * 180) / Math.PI;
  const currentRoom = getRoomAt(playerX, playerZ);
  const location = currentRoom ? ROOM_BY_ID[currentRoom].name : 'Коридор';
  const currentLandmark = currentRoom ? ROOM_LANDMARK_NAMES[currentRoom] : null;

  return (
    <dialog ref={dialogRef} className="dock-ui dock-dialog dock-map" aria-labelledby="dock-map-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      }}>
      <header className="dock-dialog__header">
        <div>
          <h2 id="dock-map-title">Схема станции</h2>
          <p className="dock-muted">«Каскад» · основной ярус</p>
        </div>
        <button type="button" ref={closeRef} onClick={onClose} aria-label="Закрыть карту" className="dock-button dock-map__close">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="dock-map__body">
        <p className="dock-map__location"><LocateFixed size={17} aria-hidden="true" />
          <span><strong>{location}</strong>{currentLandmark && <span className="dock-muted"> · {currentLandmark}</span>}</span>
        </p>
        <svg viewBox="-39 -27 78 54" role="img" aria-labelledby="dock-map-diagram-title dock-map-diagram-desc" className="dock-map__plan">
          <title id="dock-map-diagram-title">План девяти отсеков станции</title>
          <desc id="dock-map-diagram-desc">
            {`Ваше положение: ${location}. ${activeTasks.length ? `Задания: ${activeTasks.map(({ terminal }) => `${ROOM_BY_ID[terminal.roomId].name} — ${terminal.label}`).join('; ')}.` : 'Активных заданий нет.'}${lightsTerminal ? ' Восстановление света: электрощитовая.' : ''}`}
          </desc>
          {CORRIDORS.map(({ id, bounds }) => <rect key={id} x={bounds.x1} y={bounds.z1}
            width={bounds.x2 - bounds.x1} height={bounds.z2 - bounds.z1} fill="#3b403d" />)}
          {ROOMS.map(({ id, bounds }) => <rect key={id} x={bounds.x1} y={bounds.z1}
            width={bounds.x2 - bounds.x1} height={bounds.z2 - bounds.z1} fill={mapLabels[id].color} />)}
          <g stroke="#a6a491" strokeWidth=".29" strokeLinecap="round">
            {WALL_SEGMENTS.map((wall, index) => <line key={index} x1={wall.x1} y1={wall.z1} x2={wall.x2} y2={wall.z2} />)}
          </g>
          <g className="dock-map__room-labels">
            {ROOMS.map(({ id, bounds }) => <text key={id} x={(bounds.x1 + bounds.x2) / 2}
              y={mapLabels[id].y} textAnchor="middle">{mapLabels[id].name}</text>)}
          </g>
          <g fill="#302f29" stroke="#ddd0b0" strokeWidth=".29" strokeLinejoin="round">
            {SOLID_OBSTACLES.map(({ id, roomId, bounds }) => roomId === 'corridor' ? null : (
              <g key={id} transform={`translate(${(bounds.x1 + bounds.x2) / 2} ${(bounds.z1 + bounds.z2) / 2})`}>
                <title>{ROOM_LANDMARK_NAMES[roomId]}</title>
                <LandmarkMark room={roomId} />
              </g>
            ))}
          </g>
          {activeTasks.map(({ id, terminal }) => <circle key={id} cx={terminal.x} cy={terminal.z} r=".98" fill="#f1c678" stroke="#24241e" strokeWidth=".33" />)}
          {lightsTerminal && <g transform={`translate(${lightsTerminal.x} ${lightsTerminal.z})`}>
            <path d="M0-1.55 1.5 1.1h-3Z" fill="#ffa590" stroke="#22231f" strokeWidth=".35" strokeLinejoin="round" />
          </g>}
          <g transform={`translate(${playerX} ${playerZ}) rotate(${heading})`}>
            <path d="M0-1.85 1.28 1.2 0 .68-1.28 1.2Z" fill="#bfe1dd" stroke="#172625" strokeWidth=".32" strokeLinejoin="round" />
          </g>
        </svg>
        <ul className="dock-map__key" aria-label="Условные обозначения">
          <li><span className="dock-map__player" aria-hidden="true" /> Вы и ваш обзор</li>
          <li><span className="dock-map__task" aria-hidden="true" /> Задания: {activeTasks.length}</li>
          <li><span className="dock-map__landmark" aria-hidden="true" /> Ориентир</li>
          {lightsTerminal && <li className="dock-map__alarm"><TriangleAlert size={16} aria-hidden="true" /> Восстановить свет</li>}
        </ul>
        <section className="dock-map__assignments" aria-labelledby="dock-map-tasks">
          <h3 id="dock-map-tasks">{snapshot.self.role === 'saboteur' ? 'Задания для прикрытия' : 'Ваши задания'}</h3>
          {activeTasks.length ? <ul>{activeTasks.map(({ id, title, step, steps, terminal }) => (
            <li key={id}>
              <div><strong>{title}</strong>{steps > 1 && <span className="dock-muted"> · этап {step} из {steps}</span>}</div>
              <span className="dock-muted">{ROOM_BY_ID[terminal.roomId].name} · {terminal.label}</span>
            </li>
          ))}</ul> : <p className="dock-muted">Незавершённых заданий нет.</p>}
        </section>
      </div>
    </dialog>
  );
}
