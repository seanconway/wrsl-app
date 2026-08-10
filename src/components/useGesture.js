import { useEffect, useRef } from 'react';

/**
 * Gesture timing. These live in remote firmware (FS §4.2) and are firmware
 * constants there. The values below are that firmware's defaults, restated so
 * every software surface feels the same as the hardware will. They are NOT
 * configuration and must not become configuration — a remote whose hold
 * threshold differs from the operator's stand-in is a remote that trains the
 * referee wrong.
 */
export const HOLD_MS = 600;
export const HOLD_REPEAT_MS = 150;

/**
 * Press / hold / hold-repeat, discriminated on pointer events.
 *
 * A hold fires once at the threshold — while the finger is still down, not on
 * release — because the referee's feedback has to arrive during the press.
 * Hold-repeat then runs until release, and only for the buttons that repeat.
 *
 * Returns the pointer handlers to spread onto a button. Both the operator
 * controls and the emulator's remote mockups use this, so there is one
 * definition of what a gesture is.
 *
 * @param {object} opts
 * @param {(gesture: 'PRESS'|'HOLD'|'HOLD_REP') => void} opts.onPress
 * @param {boolean} [opts.repeats]  hold-repeat after the hold threshold
 * @param {boolean} [opts.disabled]
 */
export function useGestureHandlers({ onPress, repeats = false, disabled = false }) {
  const holdTimer = useRef(null);
  const repeatTimer = useRef(null);
  const held = useRef(false);

  // onPress is usually a fresh closure each render; keep the timers pointed at
  // the current one rather than the one captured when the press started.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const clear = () => {
    clearTimeout(holdTimer.current);
    clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  };

  // A button unmounted mid-press — a ruleset change swapping a function
  // button, say — would otherwise leave its repeat interval running.
  useEffect(() => clear, []);

  const down = () => {
    if (disabled) return;
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onPressRef.current('HOLD');
      if (repeats) repeatTimer.current = setInterval(() => onPressRef.current('HOLD_REP'), HOLD_REPEAT_MS);
    }, HOLD_MS);
  };

  const up = () => {
    if (disabled) return;
    clear();
    if (!held.current) onPressRef.current('PRESS');
    held.current = false;
  };

  return {
    onPointerDown: down,
    onPointerUp: up,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
