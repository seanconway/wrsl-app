import { useEffect, useRef } from 'react';
import { monotonicNow } from './clock.js';

const CHECK_MS = 500;
const STALL_MS = 2000;

/**
 * The application watchdog (FS §8.3).
 *
 * Link loss is well covered: the remote detects it locally and buzzes. The
 * dangerous case is an application RUNNING BUT WEDGED — the serial connection
 * nominally alive, PINGs still going out, so the remotes see only an ambiguous
 * silence while nothing the referee presses reaches the score.
 *
 * On detecting that its own match-state processing has stalled, this
 * deliberately drops the serial connection, converting that ambiguity into the
 * same unmistakable link-loss indication a radio fault produces: LED_LINK off
 * and the repeating link-lost buzz. The referee gets one signal for both.
 *
 * WHAT THIS CAN AND CANNOT CATCH, stated plainly because the difference
 * matters:
 *
 *   CAN — the tick loop dying (an effect torn down by a thrown reducer, a
 *   cancelled interval), an unhandled error or rejection in match processing,
 *   and any stall long enough to starve a 500 ms interval.
 *
 *   CANNOT — a fully frozen main thread, because this watchdog is on it. That
 *   case is already covered, and better: a frozen thread stops the PING
 *   cadence, the dongle's supervision timeout fires within 2.5 s, and the
 *   remotes render link-lost without the app's participation. The two
 *   mechanisms are complementary and neither is redundant.
 */
export function useWatchdog({ enabled, onStall, onFault }) {
  const lastHealthyRef = useRef(monotonicNow());
  const trippedRef = useRef(false);
  const onStallRef = useRef(onStall);
  const onFaultRef = useRef(onFault);
  onStallRef.current = onStall;
  onFaultRef.current = onFault;

  /** Called from the tick loop. Absence of this is the stall signal. */
  const stamp = useRef(() => {
    lastHealthyRef.current = monotonicNow();
  }).current;

  useEffect(() => {
    if (!enabled) {
      trippedRef.current = false;
      lastHealthyRef.current = monotonicNow();
      return undefined;
    }

    const trip = (reason) => {
      if (trippedRef.current) return;
      trippedRef.current = true;
      onFaultRef.current?.(reason);
      onStallRef.current?.(reason);
    };

    const onError = (event) => trip(event?.message ?? 'unhandled error');
    const onRejection = (event) => trip(String(event?.reason ?? 'unhandled rejection'));

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const id = setInterval(() => {
      if (monotonicNow() - lastHealthyRef.current > STALL_MS) {
        trip('match-state processing stalled');
      }
    }, CHECK_MS);

    return () => {
      clearInterval(id);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [enabled]);

  return { stamp };
}
