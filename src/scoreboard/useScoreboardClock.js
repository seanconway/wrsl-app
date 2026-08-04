import { useEffect, useRef } from 'react';

// Drives TICK dispatches from performance.now() deltas rather than counting
// setInterval fires (PROTOCOL.md §11) — a backgrounded/throttled tab loses
// timer resolution but not accuracy, since each tick carries however much
// wall-clock time actually elapsed.
export function useScoreboardClock(isRunning, dispatch) {
  const lastTickRef = useRef(null);

  useEffect(() => {
    if (!isRunning) {
      lastTickRef.current = null;
      return undefined;
    }

    lastTickRef.current = performance.now();

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      dispatch({ type: 'TICK', deltaSeconds });
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, dispatch]);
}
