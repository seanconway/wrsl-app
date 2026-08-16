// Match state and every transition over it. Pure: `now` (a monotonic reading)
// arrives on the action, so the same reducer serves the UI, the dongle, the
// tests and a rehydrated match.
//
// This is the whole of the system's officiating logic, and it is here rather
// than in the firmware because a ruleset change must be a scoreboard change
// only (SCOPE.md §7.4). Everything it does falls into three categories —
// compute, track, display. It never awards, never escalates, never rejects.
//
// One entry point matters: INPUT. A referee press from a remote and a click in
// the operator UI take the identical path, so the two can never disagree.

import {
  createClock,
  createAccumulator,
  remainingMs,
  accruedMs,
  startClock,
  stopClock,
  startAccrual,
  stopAccrual,
  adjustClock,
  adjustAccrual,
  reanchor,
} from './clock.js';
import { ROLE, getRuleset, functionSlot, secondaryClockSlot, phaseIndexAt } from './rulesets.js';

export const MATCH_STATE_VERSION = 4;

const CORNERS = ['RED', 'GREEN'];
const CLOCK_ADJUST_MS = 1000;

// Remote combo-hold reset (FS/PLAN scoreboard-update). The user's specified
// hold duration, and the one explicit, bounded guess this app-level-only
// detection requires: the wire has no "released" event, only a HOLD_REP
// stream that stops arriving, so "still held" is inferred from recency.
const COMBO_HOLD_MS = 5000;
// ~2.5x useGesture.js's 150ms HOLD_REP interval — survives one dropped
// repeat without mistaking a live hold for a release. Restated, not
// imported: match/ does not depend on components/.
const HOLD_RECENCY_MS = 400;


/** Notification kinds. The mapping to haptic waveforms lives in the dongle
 *  layer (PROTOCOL.md §9.2), because it is transport policy, not officiating. */
export const NOTIFY = {
  MAIN_WARNING: 'MAIN_WARNING',
  PERIOD_EXPIRED: 'PERIOD_EXPIRED',
  SECONDARY_EXPIRED: 'SECONDARY_EXPIRED',
  PHASE_ENTERED: 'PHASE_ENTERED',
};

let outboxSeq = 0;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createInitialMatchState(rulesetId, { now = 0, wallNow = Date.now() } = {}) {
  const ruleset = getRuleset(rulesetId);
  const secondary = ruleset.secondary_clock;

  return {
    version: MATCH_STATE_VERSION,
    rulesetId: ruleset.id,
    athletes: {
      RED: { name: 'Red', team: '' },
      GREEN: { name: 'Green', team: '' },
    },
    periodIndex: 0,
    // Regulation periods are copied out of the ruleset rather than read
    // through it, so state, league and rules-cycle variation is a pre-match
    // settings edit rather than a fork of the ruleset (FS §12.1). Each entry
    // carries its own secondary_clock rather than being re-derived from the
    // ruleset by index, so a structural edit (add/remove/rename) never causes
    // a surviving period to inherit another one's cascade rule by index
    // shift. Overtime is not structurally editable — only its duration is,
    // via overtimeDurations — so it stays a plain array of overrides.
    periods: ruleset.periods.map((p) => ({ label: p.label, duration_s: p.duration_s, secondary_clock: p.secondary_clock })),
    overtimeDurations: ruleset.overtime.map((p) => p.duration_s),
    clock: createClock(ruleset.periods[0].duration_s * 1000),
    score: { RED: 0, GREEN: 0 },
    counters: { RED: { f1: 0, f2: 0 }, GREEN: { f1: 0, f2: 0 } },
    flags: { f1: null, f2: null },
    // Per-remote FORWARD/BACKWARD hold tracking for the combo-hold reset
    // gesture (handleInput/TICK below) — null when the button isn't
    // currently believed held.
    holdTracking: {
      RED: { FORWARD: null, BACKWARD: null },
      GREEN: { FORWARD: null, BACKWARD: null },
    },
    comboReset: null,
    secondary: {
      owner: null,
      // count_up: one accumulator per athlete, and the differential is what is
      // displayed. count_down: one clock, reset on deassign and at period end.
      up: { RED: createAccumulator(), GREEN: createAccumulator() },
      down: secondary.polarity === 'count_down' ? createClock((secondary.duration_s ?? 30) * 1000) : null,
    },
    phaseIndex: ruleset.phases.length > 0 ? 0 : -1,
    warningFired: false,
    log: [],
    outbox: [],
    halted: null,
    lastInputMono: null,
    startedAtWall: wallNow,
    updatedAtWall: wallNow,
    lastNow: now,
  };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectRuleset(state) {
  return getRuleset(state.rulesetId);
}

/** The match's own ordered period list: the (possibly user-customised, FS
 *  §12.1) regulation periods followed by the ruleset's fixed-structure
 *  overtime rounds with their duration overrides applied. The one list the
 *  reducer and UI treat a period and an overtime round identically through —
 *  nothing in the input model distinguishes them. */
export function selectMatchPeriods(state) {
  const ruleset = selectRuleset(state);
  return [
    ...state.periods.map((p) => ({ ...p, overtime: false })),
    ...ruleset.overtime.map((p, i) => ({
      label: p.label,
      duration_s: state.overtimeDurations[i] ?? p.duration_s,
      secondary_clock: p.secondary_clock,
      type: p.type,
      overtime: true,
    })),
  ];
}

export function selectPeriod(state) {
  const periods = selectMatchPeriods(state);
  return periods[Math.min(Math.max(state.periodIndex, 0), periods.length - 1)];
}

export function selectPeriodCount(state) {
  return selectMatchPeriods(state).length;
}

/** Configured duration of a period in seconds, honouring pre-match overrides. */
export function selectPeriodDuration(state, index = state.periodIndex) {
  const periods = selectMatchPeriods(state);
  const clamped = Math.min(Math.max(index, 0), periods.length - 1);
  return periods[clamped].duration_s;
}

export function selectClockMs(state, now) {
  return remainingMs(state.clock, now);
}

export function selectElapsedSeconds(state, now) {
  return selectPeriodDuration(state) - remainingMs(state.clock, now) / 1000;
}

/** The count-up differential and the athlete it currently favours (FS §6.3).
 *  Displayed adjacent to that athlete's score so the advantage and its owner
 *  are read in one look, with no sign to interpret. */
export function selectDifferential(state, now) {
  const red = accruedMs(state.secondary.up.RED, now);
  const green = accruedMs(state.secondary.up.GREEN, now);
  if (red === green) return { favoured: null, ms: 0 };
  return red > green ? { favoured: 'RED', ms: red - green } : { favoured: 'GREEN', ms: green - red };
}

export function selectSecondaryRemainingMs(state, now) {
  return state.secondary.down ? remainingMs(state.secondary.down, now) : 0;
}

/** True while the secondary clock is actually accruing — which is what the
 *  heartbeat reports, and the only thing it reports (FS §6.1). */
export function selectSecondaryAccruing(state) {
  const { owner } = state.secondary;
  if (!owner) return false;
  return state.secondary.down ? state.secondary.down.running : state.secondary.up[owner].running;
}

/** Fully inert buttons produce no action, no haptic and no indicator change.
 *  A rejection signal would be more confusing than silence (FS §5.6). */
export function isInertInput(state, button) {
  if (button !== 'F1' && button !== 'F2') return false;
  const slot = button === 'F1' ? 'f1' : 'f2';
  return functionSlot(selectRuleset(state), slot).role === ROLE.INERT;
}

/** Secondary clock and tri-state flag render identically on both remotes, in
 *  the holding athlete's colour — not the ruleset's per-role `led_colour`
 *  (FS §10.3). Whichever wrist a referee glances at answers "who holds
 *  this," by the same red/green they already use to identify corners
 *  everywhere else — the corner name doubles as the wire palette name
 *  (PROTOCOL.md §6) with no lookup needed. `null` owner (unowned) renders
 *  off on both. */
const holderIndicator = (owner) =>
  owner === null ? { mode: 'OFF', colour: 'RED' } : { mode: 'SOLID', colour: owner };

/** What each remote's F1/F2 indicators should render right now. The single
 *  source for every STATE line (PROTOCOL.md §6). */
export function selectIndicators(state) {
  const ruleset = selectRuleset(state);
  const clockSlot = secondaryClockSlot(ruleset);

  const forSlot = (corner, slot) => {
    const config = functionSlot(ruleset, slot);
    switch (config.role) {
      case ROLE.SECONDARY_CLOCK:
        // Ownership is the question the LED answers; the running/paused
        // distinction is carried by the heartbeat, not by the LED. Same
        // rendering sent to both remotes — see holderIndicator().
        return clockSlot === slot
          ? holderIndicator(state.secondary.owner)
          : { mode: 'OFF', colour: 'RED' };
      case ROLE.COUNTER:
        // Unlike clock/flag, a counter has no cross-remote holder — each
        // remote tracks its own athlete's count independently — so the
        // ruleset's role colour (distinguishing e.g. a caution counter
        // from an advantage counter) is still what's rendered here.
        return state.counters[corner][slot] > 0
          ? { mode: 'SOLID', colour: config.led_colour }
          : { mode: 'OFF', colour: 'RED' };
      case ROLE.FLAG:
        return holderIndicator(state.flags[slot]);
      default:
        return { mode: 'OFF', colour: 'RED' };
    }
  };

  return {
    RED: { f1: forSlot('RED', 'f1'), f2: forSlot('RED', 'f2') },
    GREEN: { f1: forSlot('GREEN', 'f1'), f2: forSlot('GREEN', 'f2') },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function opponent(corner) {
  return corner === 'RED' ? 'GREEN' : 'RED';
}

function notify(state, kind, detail = {}) {
  outboxSeq += 1;
  return { ...state, outbox: [...state.outbox, { id: outboxSeq, kind, ...detail }] };
}

function logEntry(state, entry, now) {
  return { ...state, log: [...state.log, { at: now, periodIndex: state.periodIndex, ...entry }] };
}

/** Accrual runs only while the clock is BOTH owned and the main clock running.
 *  Called after every transition that could change either, so the accumulators
 *  never have to be reasoned about at the call site. */
function syncAccrual(state, now) {
  const shouldRun = state.clock.running && state.secondary.owner !== null;
  const { owner } = state.secondary;

  if (state.secondary.down) {
    const down = shouldRun ? startClock(state.secondary.down, now) : stopClock(state.secondary.down, now);
    return { ...state, secondary: { ...state.secondary, down } };
  }

  const up = { ...state.secondary.up };
  for (const corner of CORNERS) {
    const run = shouldRun && owner === corner;
    up[corner] = run ? startAccrual(up[corner], now) : stopAccrual(up[corner], now);
  }
  return { ...state, secondary: { ...state.secondary, up } };
}

/** Loads a period: clock to full, stopped, plus whatever the ruleset says the
 *  secondary clock does at that boundary. */
function enterPeriod(state, index, now) {
  const ruleset = selectRuleset(state);
  const periods = selectMatchPeriods(state);
  const clamped = Math.min(Math.max(index, 0), periods.length - 1);
  const period = periods[clamped];

  let next = {
    ...state,
    periodIndex: clamped,
    clock: createClock(period.duration_s * 1000),
    warningFired: false,
    phaseIndex: ruleset.phases.length > 0 ? 0 : -1,
  };

  const secondary = ruleset.secondary_clock;
  if (secondary.enabled) {
    let up = next.secondary.up;
    let down = next.secondary.down;
    let owner = next.secondary.owner;

    // Ownership deassigns at every period boundary: periods restart from a
    // chosen position, and which athlete has control at the restart is a fresh
    // determination the referee makes and enters. Carrying it across would risk
    // accruing silently to the wrong wrestler (FS §6.3).
    if (secondary.deassign_at_period_start || secondary.clear_at_period_end) owner = null;

    // Accumulation carries between regulation periods and resets on entry to
    // overtime — expressed per period, because these rules have moved across
    // NCAA rules cycles (FS §12.2).
    if (period.secondary_clock?.reset_at_start) {
      up = { RED: createAccumulator(), GREEN: createAccumulator() };
    }
    if (down) down = createClock((secondary.duration_s ?? 30) * 1000);

    next = { ...next, secondary: { owner, up, down } };
  }

  return syncAccrual(next, now);
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function toggleMainClock(state, now) {
  const clock = state.clock.running ? stopClock(state.clock, now) : startClock(state.clock, now);
  const next = { ...state, clock, warningFired: clock.running ? state.warningFired : false };
  return syncAccrual(next, now);
}

function resetPeriodClock(state, now) {
  const next = { ...state, clock: createClock(selectPeriodDuration(state) * 1000), warningFired: false };
  return syncAccrual(logEntry(next, { type: 'CLOCK_RESET' }, now), now);
}

/**
 * Adjusts the main clock by `deltaMs` and, if the secondary clock is
 * currently owned, applies the same correction to it — the interval being
 * corrected is one the secondary clock was also live for (FS §5.1).
 *
 * A count-down secondary clock (the activity clock) moves with the main
 * clock's own sign: winding the match clock back hands time back to the
 * activity clock too. A count-up accumulator (riding time) moves the
 * opposite way — winding the match clock back un-happens elapsed time, so it
 * subtracts from whichever athlete currently owns it, floored at zero.
 * Unowned is untouched: nothing was accruing during the interval.
 */
function adjustMainClock(state, deltaMs, now) {
  const clock = adjustClock(state.clock, deltaMs, now, selectPeriodDuration(state) * 1000);
  let next = { ...state, clock };

  const { owner, down } = state.secondary;
  if (owner !== null) {
    if (down) {
      const duration = (selectRuleset(state).secondary_clock.duration_s ?? 30) * 1000;
      next = { ...next, secondary: { ...next.secondary, down: adjustClock(down, deltaMs, now, duration) } };
    } else {
      const adjusted = adjustAccrual(next.secondary.up[owner], -deltaMs, now);
      next = { ...next, secondary: { ...next.secondary, up: { ...next.secondary.up, [owner]: adjusted } } };
    }
  }

  return syncAccrual(next, now);
}

function changeScore(state, corner, delta, now) {
  const { min, max } = selectRuleset(state).scoring;
  const current = state.score[corner];
  const next = Math.min(Math.max(current + delta, min), max);
  // Presses beyond the floor are acknowledged but have no effect (FS §5.1) —
  // the acknowledgement is not conditional on the score having moved, because
  // the tap confirms receipt, not outcome.
  if (next === current) return state;

  const withScore = { ...state, score: { ...state.score, [corner]: next } };
  return appendScoringAction(withScore, corner, delta, now);
}

/**
 * Scoring action grouping (FS §4.3). Consecutive presses on the same remote in
 * close succession become one action, because freestyle tiebreak criteria turn
 * on the value of the single highest technical action rather than the total.
 *
 * Best-effort and referee-verified: a referee who pauses mid-sequence produces
 * two actions where one was intended. There is deliberately no way to correct
 * grouping from the wrist — the referee reviews the log at match end, when
 * criteria decisions are made and there is time to check.
 *
 * It may inform display, logging and criteria. It may never actuate a tracked
 * state or alter a score.
 */
function appendScoringAction(state, corner, delta, now) {
  const grouping = selectRuleset(state).action_grouping;
  const last = state.log[state.log.length - 1];

  if (
    grouping.enabled &&
    last &&
    last.type === 'SCORE' &&
    last.corner === corner &&
    Math.sign(last.value) === Math.sign(delta) &&
    now - last.at <= grouping.window_ms
  ) {
    const merged = { ...last, value: last.value + delta, at: now, grouped: true };
    return { ...state, log: [...state.log.slice(0, -1), merged] };
  }

  return logEntry(state, { type: 'SCORE', corner, value: delta }, now);
}

function stepPeriod(state, delta, now) {
  return enterPeriod(state, state.periodIndex + delta, now);
}

/**
 * The secondary clock (FS §6.1, §6.5). Pressing on the opposite remote
 * transfers ownership directly with no need to deassign first — the most
 * important interaction in folkstyle riding time, where control changes hands
 * repeatedly and rapidly.
 *
 * Deassign is a referee action meaning no athlete holds the state. Pause is
 * automatic and happens whenever the main clock stops with ownership retained.
 */
function pressSecondaryClock(state, corner, now) {
  const owner = state.secondary.owner === corner ? null : corner;
  let next = { ...state, secondary: { ...state.secondary, owner } };

  // Deassigning a count-down clock resets it to its full configured duration.
  if (owner === null && next.secondary.down) {
    const duration = (selectRuleset(state).secondary_clock.duration_s ?? 30) * 1000;
    next = { ...next, secondary: { ...next.secondary, down: createClock(duration) } };
  }

  next = logEntry(next, { type: 'SECONDARY_OWNER', corner: owner }, now);
  return syncAccrual(next, now);
}

function holdSecondaryClock(state, now) {
  const ruleset = selectRuleset(state);
  const duration = (ruleset.secondary_clock.duration_s ?? 30) * 1000;
  const next = {
    ...state,
    secondary: {
      owner: null,
      up: { RED: createAccumulator(), GREEN: createAccumulator() },
      down: state.secondary.down ? createClock(duration) : null,
    },
  };
  return syncAccrual(logEntry(next, { type: 'SECONDARY_RESET' }, now), now);
}

function changeCounter(state, corner, slot, delta, now) {
  const current = state.counters[corner][slot];
  const next = Math.max(0, current + delta);
  if (next === current) return state;
  const withCounter = {
    ...state,
    counters: { ...state.counters, [corner]: { ...state.counters[corner], [slot]: next } },
  };
  return logEntry(withCounter, { type: 'COUNTER', corner, slot, value: next }, now);
}

/** Tri-state flag: this athlete, the other, or neither. Set only by the
 *  referee. The system never sets, moves, clears or infers it (FS §9.3). */
function pressFlag(state, corner, slot, now) {
  const owner = state.flags[slot] === corner ? null : corner;
  const next = { ...state, flags: { ...state.flags, [slot]: owner } };
  return logEntry(next, { type: 'FLAG', slot, corner: owner }, now);
}

function handleFunctionButton(state, slot, corner, gesture, now) {
  const config = functionSlot(selectRuleset(state), slot);

  switch (config.role) {
    case ROLE.SECONDARY_CLOCK:
      if (gesture === 'PRESS') return pressSecondaryClock(state, corner, now);
      if (gesture === 'HOLD') return holdSecondaryClock(state, now);
      return state;
    case ROLE.COUNTER:
      if (gesture === 'PRESS') return changeCounter(state, corner, slot, +1, now);
      if (gesture === 'HOLD') return changeCounter(state, corner, slot, -1, now);
      return state;
    case ROLE.FLAG:
      if (gesture === 'PRESS') return pressFlag(state, corner, slot, now);
      return state;
    default:
      return state; // inert
  }
}

/**
 * Records FORWARD/BACKWARD hold state per remote, for the combo-hold reset
 * gesture (TICK's evaluateComboHold, below). A no-op — returns `state`
 * unchanged — for every other button/gesture, so folding this into the front
 * of handleInput is free for the paths that don't care about it.
 */
function trackHold(state, src, button, gesture, now) {
  if (button !== 'FORWARD' && button !== 'BACKWARD') return state;
  if (gesture !== 'HOLD' && gesture !== 'HOLD_REP') return state;
  const current = state.holdTracking[src][button];
  const since = gesture === 'HOLD' ? now : (current?.since ?? now);
  return {
    ...state,
    holdTracking: {
      ...state.holdTracking,
      [src]: { ...state.holdTracking[src], [button]: { since, lastSeen: now } },
    },
  };
}

function handleInput(state, { button, gesture, src }, now) {
  const tracked = trackHold(state, src, button, gesture, now);

  switch (button) {
    case 'TOGGLE_CLOCK':
      if (gesture === 'PRESS') return toggleMainClock(tracked, now);
      if (gesture === 'HOLD') return resetPeriodClock(tracked, now);
      return tracked;

    case 'ADD_POINT':
      return gesture === 'PRESS' ? changeScore(tracked, src, +1, now) : tracked;

    case 'REMOVE_POINT':
      return gesture === 'PRESS' ? changeScore(tracked, src, -1, now) : tracked;

    // Clock adjustment on the red remote, period navigation on the green, so
    // two similar navigation functions do not compete for the same finger
    // positions. Both are defaults marked for post-MVP remapping (FS §5.2) —
    // and because the wire carries buttons, remapping is a change here alone.
    //
    // The match clock counts down, so FORWARD — advancing through match time
    // — subtracts from it, and BACKWARD — rewinding — adds to it (FS §5.1).
    // Period navigation is unaffected: FORWARD/BACKWARD still step later/
    // earlier through the period list regardless of clock direction.
    case 'FORWARD':
      if (src === 'RED') return adjustMainClock(tracked, -CLOCK_ADJUST_MS, now);
      if (gesture === 'PRESS' || gesture === 'HOLD_REP') return stepPeriod(tracked, +1, now);
      if (gesture === 'HOLD') return enterPeriod(tracked, selectPeriodCount(tracked) - 1, now);
      return tracked;

    case 'BACKWARD':
      if (src === 'RED') return adjustMainClock(tracked, +CLOCK_ADJUST_MS, now);
      if (gesture === 'PRESS' || gesture === 'HOLD_REP') return stepPeriod(tracked, -1, now);
      if (gesture === 'HOLD') return enterPeriod(tracked, 0, now);
      return tracked;

    case 'F1':
      return handleFunctionButton(tracked, 'f1', src, gesture, now);

    case 'F2':
      return handleFunctionButton(tracked, 'f2', src, gesture, now);

    default:
      return tracked;
  }
}

// ---------------------------------------------------------------------------
// Clock-driven transitions
// ---------------------------------------------------------------------------

/**
 * Clocks are the one category of automatic action, because clocks are
 * mechanisms rather than judgements (SCOPE.md §7.2). They run, they expire,
 * they reset at configured boundaries — and no clock ever converts its own
 * state into a score.
 */
function advanceClocks(state, now) {
  const ruleset = selectRuleset(state);
  let next = state;

  // Main clock warning, then expiry.
  if (next.clock.running) {
    const left = remainingMs(next.clock, now);
    const warnAt = ruleset.main_clock.warning_at_s * 1000;

    if (!next.warningFired && warnAt > 0 && left <= warnAt && left > 0) {
      next = notify({ ...next, warningFired: true }, NOTIFY.MAIN_WARNING);
    }

    if (left <= 0) {
      next = { ...next, clock: { remainingMs: 0, running: false, refMono: null } };
      next = notify(next, NOTIFY.PERIOD_EXPIRED);
      next = logEntry(next, { type: 'PERIOD_EXPIRED' }, now);
      next = syncAccrual(next, now);
    }
  }

  // Count-down secondary clock expiry. On expiry without a score the referee
  // awards the point to the opponent manually; the clock deassigns and resets.
  if (next.secondary.down && next.secondary.down.running && remainingMs(next.secondary.down, now) <= 0) {
    const duration = (ruleset.secondary_clock.duration_s ?? 30) * 1000;
    next = { ...next, secondary: { ...next.secondary, owner: null, down: createClock(duration) } };
    if (ruleset.secondary_clock.notify_on_expiry) next = notify(next, NOTIFY.SECONDARY_EXPIRED);
    next = logEntry(next, { type: 'SECONDARY_EXPIRED' }, now);
    next = syncAccrual(next, now);
  }

  // Phase boundaries.
  if (ruleset.phases.length > 0) {
    const elapsed = selectElapsedSeconds(next, now);
    const index = phaseIndexAt(ruleset, elapsed);
    if (index > next.phaseIndex) {
      const phase = ruleset.phases[index];
      next = { ...next, phaseIndex: index };
      if (phase.notify_on_entry) next = notify(next, NOTIFY.PHASE_ENTERED, { label: phase.label });
      next = logEntry(next, { type: 'PHASE', label: phase.label }, now);
    }
  }

  return next;
}

/**
 * Clears stale FORWARD/BACKWARD hold entries (nothing arrived within
 * HOLD_RECENCY_MS, so the button is presumed released) and arms `comboReset`
 * once both have been continuously held on one remote for COMBO_HOLD_MS.
 *
 * Evaluated only while the match is not being timed live — arming never
 * fires with `state.clock.running`, mirroring the halted-only guard on
 * SET_SCORE/SET_CLOCK, so an accidental dual-hold mid-match does nothing.
 * Hold tracking itself still updates regardless (harmless bookkeeping),
 * so a hold that started live and continues into a stoppage is honoured.
 *
 * One-shot: only sets `comboReset` while it is currently null, so it does
 * not creep forward while the referee keeps holding past the threshold.
 * Preserves TICK's "same object when nothing changed" contract.
 */
function evaluateComboHold(state, now) {
  const holdTracking = {};
  let changed = false;
  for (const src of CORNERS) {
    const entry = state.holdTracking[src];
    const forward = entry.FORWARD && now - entry.FORWARD.lastSeen <= HOLD_RECENCY_MS ? entry.FORWARD : null;
    const backward = entry.BACKWARD && now - entry.BACKWARD.lastSeen <= HOLD_RECENCY_MS ? entry.BACKWARD : null;
    if (forward !== entry.FORWARD || backward !== entry.BACKWARD) changed = true;
    holdTracking[src] = { FORWARD: forward, BACKWARD: backward };
  }

  let comboReset = state.comboReset;
  if (comboReset === null && !state.clock.running) {
    for (const src of CORNERS) {
      const { FORWARD, BACKWARD } = holdTracking[src];
      if (FORWARD && BACKWARD && now - Math.max(FORWARD.since, BACKWARD.since) >= COMBO_HOLD_MS) {
        comboReset = { src, armedAtMono: now };
        break;
      }
    }
  }

  if (!changed && comboReset === state.comboReset) return state;
  return { ...state, holdTracking, comboReset };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function matchReducer(state, action) {
  const now = action.now ?? state.lastNow;

  switch (action.type) {
    case 'INPUT': {
      // A halted match takes no input until the operator resolves the halt.
      // This is the one place the system does refuse — and it refuses because
      // its own clock is untrustworthy, never on ruleset grounds.
      if (state.halted) return state;

      // Fully inert: no action, no haptic, no indicator, and no trace. An inert
      // press must not stamp `lastInputMono` either, because that would
      // suppress the heartbeat for a press that produced no tap to protect.
      if (isInertInput(state, action.button)) return state;

      const next = handleInput(state, action, now);

      // Stamped even when nothing moved. A press onto the score floor is
      // acknowledged with a full tap and has no effect (FS §5.1), and it is the
      // TAP, not the state change, that the heartbeat has to stay out of the
      // way of (FS §11.1).
      return { ...next, lastInputMono: now, lastNow: now, updatedAtWall: Date.now() };
    }

    case 'TICK': {
      // Returns the SAME object when nothing changed. The displayed clock is
      // computed by subtraction on render (clock.js), so a tick that advances
      // no state has no business producing a new state — rendering is driven
      // separately, and conflating the two would put a fresh object through
      // every consumer ten times a second for nothing.
      if (state.halted) return state;
      return evaluateComboHold(advanceClocks(state, now), now);
    }

    case 'SELECT_RULESET': {
      const fresh = createInitialMatchState(action.rulesetId, { now });
      return { ...fresh, athletes: state.athletes };
    }

    case 'SET_ATHLETE':
      return {
        ...state,
        athletes: {
          ...state.athletes,
          [action.corner]: { ...state.athletes[action.corner], ...action.value },
        },
        updatedAtWall: Date.now(),
      };

    case 'SET_PERIOD_DURATION': {
      // Pre-match customisation only — a running clock is never resized under
      // the referee. Same flat 0..N-1 index the UI has always dispatched;
      // routed to regulation or overtime beneath it.
      if (state.clock.running) return state;
      const seconds = Math.max(1, Math.round(action.seconds));
      let next;
      if (action.index < state.periods.length) {
        const periods = [...state.periods];
        periods[action.index] = { ...periods[action.index], duration_s: seconds };
        next = { ...state, periods };
      } else {
        const overtimeDurations = [...state.overtimeDurations];
        overtimeDurations[action.index - state.periods.length] = seconds;
        next = { ...state, overtimeDurations };
      }
      return action.index === state.periodIndex ? enterPeriod(next, state.periodIndex, now) : next;
    }

    // Structural period-list edits (FS §12.1 / scoreboard-update). Pre-match
    // only, and stricter than SET_PERIOD_DURATION's clock-running-only guard:
    // adding, removing or reordering periods the match has already stepped
    // through is semantically incoherent in a way resizing a duration isn't,
    // so nothing may have happened yet. Overtime is excluded — its fixed
    // count/order carries real meaning (folkstyle SV/TB1/TB2/UTB) that
    // add/remove would break; only its duration is editable, above.
    case 'ADD_PERIOD': {
      if (state.clock.running || state.log.length > 0 || state.periodIndex !== 0) return state;
      const source = state.periods[action.afterIndex] ?? state.periods[state.periods.length - 1];
      const period = { label: `Period ${state.periods.length + 1}`, duration_s: source.duration_s, secondary_clock: source.secondary_clock };
      const periods = [...state.periods];
      periods.splice(action.afterIndex + 1, 0, period);
      return enterPeriod({ ...state, periods }, 0, now);
    }

    case 'REMOVE_PERIOD': {
      if (state.clock.running || state.log.length > 0 || state.periodIndex !== 0) return state;
      if (state.periods.length <= 1) return state;
      const periods = state.periods.filter((_, i) => i !== action.index);
      return enterPeriod({ ...state, periods }, 0, now);
    }

    case 'RENAME_PERIOD': {
      if (state.clock.running || state.log.length > 0 || state.periodIndex !== 0) return state;
      const label = action.label.trim();
      if (!label) return state;
      const periods = [...state.periods];
      periods[action.index] = { ...periods[action.index], label };
      return { ...state, periods };
    }

    // Direct score/clock entry (scoreboard-update). Halted only — same guard
    // as SET_PERIOD_DURATION — so this is never a second path into live
    // match state (CLAUDE.md §4.2): while the clock runs, INPUT gestures
    // remain the only way to change either.
    case 'SET_SCORE': {
      if (state.clock.running) return state;
      const { min, max } = selectRuleset(state).scoring;
      const from = state.score[action.corner];
      const to = Math.min(Math.max(Math.round(action.value), min), max);
      if (to === from) return state;
      const next = { ...state, score: { ...state.score, [action.corner]: to } };
      // A distinct log entry, not 'SCORE' — appendScoringAction's grouping
      // (FS §4.3) is specific to gesture-driven presses, and freestyle
      // tiebreak criteria turn on the value of a single technical action. A
      // typed correction must never be conflatable with one.
      return logEntry(next, { type: 'SCORE_SET', corner: action.corner, from, to }, now);
    }

    case 'SET_CLOCK': {
      if (state.clock.running) return state;
      const maxMs = selectPeriodDuration(state) * 1000;
      const ms = Math.min(Math.max(Math.round(action.ms), 0), maxMs);
      const next = { ...state, clock: { remainingMs: ms, running: false, refMono: null } };
      // Unlike adjustMainClock's FORWARD/BACKWARD path, this does not cascade
      // to the secondary clock: that cascade is delta-based (the interval
      // being corrected was one the secondary clock was also live for), and a
      // typed absolute value has no delta to propagate. Accepted asymmetry.
      return logEntry(next, { type: 'CLOCK_SET', ms }, now);
    }

    case 'HALT':
      return {
        ...state,
        clock: stopClock(state.clock, now),
        halted: { reason: action.reason, divergenceMs: action.divergenceMs ?? null },
        lastNow: now,
      };

    case 'RESUME_AFTER_HALT': {
      // The operator has confirmed. Re-anchor every running reference to `now`
      // so the gap is discarded rather than applied.
      const next = {
        ...state,
        halted: null,
        clock: reanchor(state.clock, now),
        lastNow: now,
      };
      return syncAccrual(next, now);
    }

    case 'SET_SUBSTITUTED':
      return logEntry({ ...state, updatedAtWall: Date.now() }, { type: 'SET_SUBSTITUTION', set: action.set }, now);

    case 'OUTBOX_SENT':
      return { ...state, outbox: state.outbox.filter((n) => !action.ids.includes(n.id)) };

    case 'RESET_MATCH': {
      // Serves both the manual "New match" button and the combo-hold path
      // (App.jsx) — exactly one reset transition, consistent with "one path"
      // applied to INPUT. Preserves athletes and the (possibly customised)
      // period list, unlike SELECT_RULESET, which deliberately does not: a
      // structure built for one ruleset generally doesn't transfer to another.
      const fresh = createInitialMatchState(state.rulesetId, { now });
      const periods = state.periods;
      const overtimeDurations = state.overtimeDurations;
      return {
        ...fresh,
        athletes: state.athletes,
        periods,
        overtimeDurations,
        // fresh's clock was built from the ruleset's own period-0 duration;
        // recompute it from the preserved (possibly resized) period 0.
        clock: createClock(periods[0].duration_s * 1000),
      };
    }

    case 'REHYDRATE': {
      // A restored match arrives with monotonic references from a previous page
      // lifetime, which mean nothing now. Every clock is restored STOPPED at
      // the value it held: a match resumes under the referee's hand, never on
      // its own, and never with time that passed while the tab was closed.
      const restored = action.state;
      return {
        ...restored,
        clock: { remainingMs: restored.clock.remainingMs, running: false, refMono: null },
        secondary: {
          ...restored.secondary,
          up: {
            RED: { ...restored.secondary.up.RED, running: false, refMono: null },
            GREEN: { ...restored.secondary.up.GREEN, running: false, refMono: null },
          },
          down: restored.secondary.down
            ? { ...restored.secondary.down, running: false, refMono: null }
            : null,
        },
        outbox: [],
        halted: null,
        lastInputMono: null,
        lastNow: now,
        // Hold timestamps from a previous page lifetime's monotonic origin
        // mean nothing against a fresh `now` — same reasoning as the clocks
        // above, just for the combo-hold gesture rather than match time.
        holdTracking: {
          RED: { FORWARD: null, BACKWARD: null },
          GREEN: { FORWARD: null, BACKWARD: null },
        },
        comboReset: null,
      };
    }

    default:
      return state;
  }
}

export { opponent };
