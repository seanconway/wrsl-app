import { useCallback, useState } from 'react';
import { freeze, isUnfinished } from './persistence.js';

let historySeq = 0;

/**
 * In-session match history (scoreboard-update): every match a reset (the
 * manual "New match" button or the remote combo-hold gesture) replaces is
 * kept here, recoverable until explicitly discarded. Deliberately React
 * state only, not localStorage — this does not need to survive a reload,
 * per the requirement, and persistence.js already owns the one match that
 * does.
 */
export function useMatchHistory() {
  const [entries, setEntries] = useState([]);

  const capture = useCallback((state, meta) => {
    // A still-blank match (never scored, nothing logged) isn't worth
    // cluttering the list with — mirrors persistence.js's own restore-prompt
    // gate for the same reason.
    if (!isUnfinished(state)) return;
    historySeq += 1;
    setEntries((prev) => [...prev, { id: historySeq, snapshot: freeze(state), capturedAtWall: Date.now(), ...meta }]);
  }, []);

  const discard = useCallback((id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, capture, discard };
}
