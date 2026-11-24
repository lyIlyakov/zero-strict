export const JOYSTICK_TRAVEL = 42;
const DEAD_ZONE = 5;

type Gesture = { id: number; x: number; y: number };

export function createTouchControls() {
  let joystick: Gesture | null = null;
  let look: Gesture | null = null;
  let movement = { x: 0, z: 0 };
  let lookDelta = { x: 0, y: 0 };

  return {
    get movement() { return movement; },
    start(kind: 'move' | 'look', id: number, x: number, y: number) {
      if (joystick?.id === id || look?.id === id) return false;
      const gesture = { id, x, y };
      if (kind === 'move' && !joystick) joystick = gesture;
      else if (kind === 'look' && !look) look = gesture;
      else return false;
      return true;
    },
    move(id: number, x: number, y: number) {
      if (joystick?.id === id) {
        const dx = x - joystick.x;
        const dz = joystick.y - y;
        const distance = Math.hypot(dx, dz);
        const scale = distance <= DEAD_ZONE ? 0 :
          Math.min(1, (distance - DEAD_ZONE) / (JOYSTICK_TRAVEL - DEAD_ZONE)) / distance;
        movement = { x: dx * scale || 0, z: dz * scale || 0 };
      } else if (look?.id === id) {
        lookDelta.x += x - look.x;
        lookDelta.y += y - look.y;
        look.x = x;
        look.y = y;
      }
    },
    end(id: number) {
      if (joystick?.id === id) {
        joystick = null;
        movement = { x: 0, z: 0 };
      }
      if (look?.id === id) look = null;
    },
    reset() {
      joystick = null;
      look = null;
      movement = { x: 0, z: 0 };
      lookDelta = { x: 0, y: 0 };
    },
    takeLook() {
      const delta = lookDelta;
      lookDelta = { x: 0, y: 0 };
      return delta;
    },
  };
}
