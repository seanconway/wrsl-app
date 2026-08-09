import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  matchReducer,
  createInitialMatchState,
  MATCH_STATE_VERSION,
} from './matchReducer.js';
import { monotonicNow, detectDiscontinuity, captureWitness } from './clock.js';
import { saveMatch, loadMatch, clearMatch, describeSaved, isUnfinished } from './persistence.js';
import { DEFAULT_RULESET_ID } from './rulesets.js';

const TICK_MS = 100;
const RENDER_MS = 100;
const SAVE_MS = 1000;

/** Divergence between the monotonic and wall clocks that is too large to be
 *  scheduling jitter. A suspended laptop or a corrected system clock both land
 *  here; both must halt the match rather than be absorbed (FS §8.1). */
const DISCONTINUITY_TOLERANCE_MS = 2000;

/**
 * Owns match state, the tick that advances clocks, discontinuity detection,
 * persistence, and the wake lock.
 *
 * Two clocks are deliberately separate here. The TICK advances state and fires
 * only when state actually moves. The render tick re-reads derived values and
 * is what makes the displayed clock count down. Merging them would push a new
 * state object through every consumer ten times a second to redraw a digit.
 */
export function useMatch({ onTick } = {}) {
  const [state, dispatch] = useReducer(matchReducer, DEFAULT_RULESET_ID, (id) =>
    createInitialMatchState(id, { now: monotonicNow() }),
  );

  // Held in a ref so changing the callback never restarts the tick — a clock
  // that restarts on re-render is a clock that can be made to skip.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const [, forceRender] = useState(0);
  const [restorable, setRestorable] = useState(null);
  const witnessRef = useRef(null);
  const wakeLockRef = useRef(null);
  const [isForeground, setIsForeground] = useState(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  // --- restore prompt ------------------------------------------------------

  useEffect(() => {
    const saved = loadMatch();
    if (saved && isUnfinished(saved)) setRestorable(describeSaved(saved));
  }, []);

  const restoreMatch = useCallback(() => {
    const saved = loadMatch();
    if (saved) dispatch({ type: 'REHYDRATE', state: saved, now: monotonicNow() });
    setRestorable(null);
  }, []);

  const discardRestorable = useCallback(() => {
    clearMatch();
    setRestorable(null);
  }, []);

  // --- the tick ------------------------------------------------------------

  useEffect(() => {
    witnessRef.current = captureWitness(monotonicNow(), Date.now());

    const id = setInterval(() => {
      const now = monotonicNow();
      const wallNow = Date.now();

      // The watchdog's liveness stamp. Absence of this is the stall signal, so
      // it is taken at the top of the tick, before anything that can throw.
      onTickRef.current?.();

      const divergence = detectDiscontinuity(
        witnessRef.current,
        now,
        wallNow,
        DISCONTINUITY_TOLERANCE_MS,
      );
      witnessRef.current = captureWitness(now, wallNow);

      if (divergence !== null) {
        // Halt and ask. A match that quietly loses forty seconds to a suspend
        // is worse than one that stops and says what happened.
        dispatch({ type: 'HALT', reason: 'time_discontinuity', divergenceMs: divergence, now });
        return;
      }

      dispatch({ type: 'TICK', now });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  // Render tick. Cheap, and independent of whether state moved.
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => (n + 1) % 1_000_000), RENDER_MS);
    return () => clearInterval(id);
  }, []);

  // --- persistence ---------------------------------------------------------

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const id = setInterval(() => saveMatch(stateRef.current), SAVE_MS);
    const flush = () => saveMatch(stateRef.current);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, []);

  // --- foreground and wake lock (mitigations for PLAN.md R1) ---------------

  useEffect(() => {
    const onVisibility = () => setIsForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    // The heartbeat and the PING cadence are browser timers, and a hidden tab
    // throttles them to roughly one callback a minute. SCOPE.md §5 makes a
    // foregrounded scoreboard a stated operating assumption — but an assumption
    // is not a mechanism, so hold a screen wake lock, which is appropriate
    // anyway for an application driving a public display.
    let cancelled = false;

    async function acquire() {
      if (!('wakeLock' in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        // Denied or unsupported. The operational rule still applies.
      }
    }

    if (isForeground) acquire();

    return () => {
      cancelled = true;
      wakeLockRef.current?.release?.().catch?.(() => {});
      wakeLockRef.current = null;
    };
  }, [isForeground]);

  return {
    state,
    dispatch,
    restorable,
    restoreMatch,
    discardRestorable,
    isForeground,
    stateVersion: MATCH_STATE_VERSION,
  };
}
