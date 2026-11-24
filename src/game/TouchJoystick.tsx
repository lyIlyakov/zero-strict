import { useEffect, useState } from 'react';
import { JOYSTICK_TRAVEL } from './touchControls';

// Track real touch as well as media queries, so a touchscreen can follow a mouse on hybrid devices.
export function useTouchAvailable() {
  const [touch, setTouch] = useState(() => window.matchMedia('(any-pointer: coarse)').matches);
  useEffect(() => {
    const onTouch = (event: PointerEvent) => {
      if (event.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, true);
    return () => window.removeEventListener('pointerdown', onTouch, true);
  }, []);
  return touch;
}

export function TouchJoystick({ knobRef }: { knobRef: React.Ref<HTMLSpanElement> }) {
  return (
    <div className="station-joystick" data-joystick aria-hidden="true" style={{ '--joystick-travel': `${JOYSTICK_TRAVEL}px` } as React.CSSProperties}>
      <span ref={knobRef} />
    </div>
  );
}
