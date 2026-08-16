// Match state durability (FS §8.2).
//
// This application holds the ONLY copy of match state. Persistence is therefore
// not a convenience feature — a browser crash at 4:12 of the third period with
// nothing on disk is a match that cannot be finished.
//
// Two rules shape what gets written:
//
//   1. Clocks are normalised to STOPPED at their true current value before
//      being written. A monotonic reference from a previous page lifetime means
//      nothing in the next one, and a clock that restored itself running would
//      resume against a reference that no longer exists.
//
//   2. Persistence never depends on the network. localStorage is synchronous,
//      local, and survives reload and browser restart, which is the whole of
//      the requirement.

import { remainingMs, accruedMs, monotonicNow } from './clock.js';
import { MATCH_STATE_VERSION } from './matchReducer.js';

const KEY = 'refremote.match.v3';

function storage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    // Storage can throw outright under some privacy configurations. A match
    // that cannot be persisted must still be runnable.
    return null;
  }
}

/** Collapses every live time reference to a plain value. */
export function freeze(state, now = monotonicNow()) {
  return {
    ...state,
    clock: { remainingMs: remainingMs(state.clock, now), running: false, refMono: null },
    secondary: {
      ...state.secondary,
      up: {
        RED: { accruedMs: accruedMs(state.secondary.up.RED, now), running: false, refMono: null },
        GREEN: { accruedMs: accruedMs(state.secondary.up.GREEN, now), running: false, refMono: null },
      },
      down: state.secondary.down
        ? { remainingMs: remainingMs(state.secondary.down, now), running: false, refMono: null }
        : null,
    },
    outbox: [],
    savedAtWall: Date.now(),
  };
}

export function saveMatch(state, now = monotonicNow()) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify(freeze(state, now)));
    return true;
  } catch {
    return false;
  }
}

export function loadMatch() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // No migration path exists yet. A state written by an older version is
    // discarded rather than half-understood: a wrong restored score is worse
    // than no restored score, because the operator would not know to check it.
    if (parsed?.version !== MATCH_STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearMatch() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

/**
 * Enough detail for the operator to confirm this is the right match before
 * restoring it (FS §8.2). Names, score and clock position are what identifies
 * a match on a mat; a bare "restore?" prompt is one wrong click from starting a
 * bout with someone else's score on the board.
 */
export function describeSaved(saved) {
  if (!saved) return null;
  return {
    rulesetId: saved.rulesetId,
    red: saved.athletes?.RED?.name ?? 'Red',
    green: saved.athletes?.GREEN?.name ?? 'Green',
    score: saved.score,
    periodIndex: saved.periodIndex,
    clockMs: saved.clock?.remainingMs ?? 0,
    savedAtWall: saved.savedAtWall ?? saved.updatedAtWall ?? null,
    actionCount: saved.log?.length ?? 0,
  };
}

/** True when the saved match looks like a bout in progress rather than a fresh
 *  board someone opened and walked away from. Also gates in-session match
 *  history capture (useMatchHistory.js) — a corner already renamed off its
 *  "Red"/"Green" default is real work-in-progress the same way a score or a
 *  log entry is, even before the first point (scoreboard-update). */
export function isUnfinished(saved) {
  if (!saved) return false;
  const scored = (saved.score?.RED ?? 0) !== 0 || (saved.score?.GREEN ?? 0) !== 0;
  const started = (saved.log?.length ?? 0) > 0;
  const named = (saved.athletes?.RED?.name ?? 'Red') !== 'Red' || (saved.athletes?.GREEN?.name ?? 'Green') !== 'Green';
  return scored || started || named;
}
