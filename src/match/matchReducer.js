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
  reanchor,
} from './clock.js';
import { ROLE, getRuleset, allPeriods, periodAt, functionSlot, secondaryClockSlot, phaseIndexAt } from './rulesets.js';

export const MATCH_STATE_VERSION = 3;

const CORNERS = ['RED', 'GREEN'];
const CLOCK_ADJUST_MS = 1000;

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
  const periods = allPeriods(ruleset);
  const secondary = ruleset.secondary_clock;

  return {
    version: MATCH_STATE_VERSION,
    rulesetId: ruleset.id,
    athletes: {
      RED: { name: 'Red', team: '' },
      GREEN: { name: 'Green', team: '' },
    },
    periodIndex: 0,
    // Durations are copied out of the ruleset rather than read through it, so
    // state, league and rules-cycle variation is a pre-match settings edit
    // rather than a fork of the ruleset (FS §12.1).
    periodDurations: periods.map((p) => p.duration_s),
    clock: createClock(periods[0].duration_s * 1000),
    score: { RED: 0, GREEN: 0 },
    counters: { RED: { f1: 0, f2: 0 }, GREEN: { f1: 0, f2: 0 } },
    flags: { f1: null, f2: null },
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

export function selectPeriod(state) {
  return periodAt(selectRuleset(state), state.periodIndex);
}

export function selectPeriodCount(state) {
  return allPeriods(selectRuleset(state)).length;
}

/** Configured duration of a period in seconds, honouring pre-match overrides. */
export function selectPeriodDuration(state, index = state.periodIndex) {
  const fallback = periodAt(selectRuleset(state), index).duration_s;
  return state.periodDurations?.[index] ?? fallback;
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

/** What each remote's F1/F2 indicators should render right now. The single
 *  source for every STATE line (PROTOCOL.md §6). */
export function selectIndicators(state) {
  const ruleset = selectRuleset(state);
  const clockSlot = secondaryClockSlot(ruleset);

  const forSlot = (corner, slot) => {
    const config = functionSlot(ruleset, slot);
    switch (config.role) {
      case ROLE.SECONDARY_CLOCK:
        // Lit whenever this athlete owns the clock, accruing or paused.
        // Ownership is the question the LED answers; the running/paused
        // distinction is carried by the heartbeat, not by the LED.
        return state.secondary.owner === corner && clockSlot === slot
          ? { mode: 'SOLID', rgb: config.led_colour }
          : { mode: 'OFF', rgb: '000000' };
      case ROLE.COUNTER:
        return state.counters[corner][slot] > 0
          ? { mode: 'SOLID', rgb: config.led_colour }
          : { mode: 'OFF', rgb: '000000' };
      case ROLE.FLAG:
        return state.flags[slot] === corner
          ? { mode: 'SOLID', rgb: config.led_colour }
          : { mode: 'OFF', rgb: '000000' };
      default:
        return { mode: 'OFF', rgb: '000000' };
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
  const periods = allPeriods(ruleset);
  const clamped = Math.min(Math.max(index, 0), periods.length - 1);
  const period = periods[clamped];

  let next = {
    ...state,
    periodIndex: clamped,
    clock: createClock(selectPeriodDuration(state, clamped) * 1000),
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

function adjustMainClock(state, deltaMs, now) {
  const clock = adjustClock(state.clock, deltaMs, now, selectPeriodDuration(state) * 1000);
  return syncAccrual({ ...state, clock }, now);
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

function handleInput(state, { button, gesture, src }, now) {
  switch (button) {
    case 'TOGGLE_CLOCK':
      if (gesture === 'PRESS') return toggleMainClock(state, now);
      if (gesture === 'HOLD') return resetPeriodClock(state, now);
      return state;

    case 'ADD_POINT':
      return gesture === 'PRESS' ? changeScore(state, src, +1, now) : state;

    case 'REMOVE_POINT':
      return gesture === 'PRESS' ? changeScore(state, src, -1, now) : state;

    // Clock adjustment on the red remote, period navigation on the green, so
    // two similar navigation functions do not compete for the same finger
    // positions. Both are defaults marked for post-MVP remapping (FS §5.2) —
    // and because the wire carries buttons, remapping is a change here alone.
    case 'FORWARD':
      if (src === 'RED') return adjustMainClock(state, +CLOCK_ADJUST_MS, now);
      if (gesture === 'PRESS' || gesture === 'HOLD_REP') return stepPeriod(state, +1, now);
      if (gesture === 'HOLD') return enterPeriod(state, selectPeriodCount(state) - 1, now);
      return state;

    case 'BACKWARD':
      if (src === 'RED') return adjustMainClock(state, -CLOCK_ADJUST_MS, now);
      if (gesture === 'PRESS' || gesture === 'HOLD_REP') return stepPeriod(state, -1, now);
      if (gesture === 'HOLD') return enterPeriod(state, 0, now);
      return state;

    case 'F1':
      return handleFunctionButton(state, 'f1', src, gesture, now);

    case 'F2':
      return handleFunctionButton(state, 'f2', src, gesture, now);

    default:
      return state;
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
      return advanceClocks(state, now);
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
      // the referee.
      if (state.clock.running) return state;
      const periodDurations = [...state.periodDurations];
      periodDurations[action.index] = Math.max(1, Math.round(action.seconds));
      const next = { ...state, periodDurations };
      return action.index === state.periodIndex ? enterPeriod(next, state.periodIndex, now) : next;
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

    case 'RESET_MATCH':
      return createInitialMatchState(state.rulesetId, { now });

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
      };
    }

    default:
      return state;
  }
}

export { opponent };
