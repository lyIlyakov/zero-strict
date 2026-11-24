import type { RoomId } from '../../shared/types';

/** These names appear on both the station's physical signs and the deck plan. */
export const ROOM_LANDMARK_NAMES: Record<RoomId, string> = {
  command: 'Стол собраний',
  medbay: 'Диагностическая капсула',
  storage: 'Грузовые контейнеры',
  comms: 'Стойка связи',
  navigation: 'Пульт курса',
  reactor: 'Корпус реактора',
  airlock: 'Баллоны давления',
  electrical: 'Трансформатор',
  hydroponics: 'Грядка',
};
