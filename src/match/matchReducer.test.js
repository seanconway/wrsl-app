import { describe, it, expect } from 'vitest';
import {
  matchReducer,
  createInitialMatchState,
  selectClockMs,
  selectDifferential,
  selectSecondaryRemainingMs,
  selectIndicators,
  selectPeriodDuration,
  selectMatchPeriods,
  isInertInput,
  NOTIFY,
} from './matchReducer.js';
import { accruedMs } from './clock.js';

let t = 0;
const at = (ms) => (t = ms);

function press(state, button, src = 'RED', gesture = 'PRESS', now = t) {
  return matchReducer(state, { type: 'INPUT', button, gesture, src, now });
}

function tick(state, now) {
  return matchReducer(state, { type: 'TICK', now });
}

function fresh(rulesetId) {
  t = 1000;
  return createInitialMatchState(rulesetId, { now: t });
}

// ---------------------------------------------------------------------------

describe('scoring', () => {
  it('adds and removes a point on the pressing remote only', () => {
    let s = fresh('ncaa');
    s = press(s, 'ADD_POINT', 'RED');
    s = press(s, 'ADD_POINT', 'RED');
    s = press(s, 'ADD_POINT', 'GREEN');
    expect(s.score).toEqual({ RED: 2, GREEN: 1 });

    s = press(s, 'REMOVE_POINT', 'RED');
    expect(s.score.RED).toBe(1);
  });

  it('clamps at the ruleset floor', () => {
    let s = fresh('ncaa');
    s = press(s, 'REMOVE_POINT', 'RED');
    s = press(s, 'REMOVE_POINT', 'RED');
    expect(s.score.RED).toBe(0);
  });

  it('allows a negative total where the ruleset does', () => {
    let s = fresh('adcc');
    s = press(s, 'REMOVE_POINT', 'GREEN');
    expect(s.score.GREEN).toBe(-1);
  });

  it('does nothing on a gesture the button does not use', () => {
    const s = fresh('ncaa');
    const after = press(s, 'ADD_POINT', 'RED', 'HOLD');
    expect(after.score).toEqual(s.score);
    expect(after.log).toEqual(s.log);
  });

  it('stamps the input time even when the press changed nothing', () => {
    // A press onto the score floor is acknowledged with a full-amplitude tap
    // and has no effect. It is the tap the heartbeat has to stay out of the way
    // of, so suppression keys on the press, not on the state change.
    let s = fresh('ncaa');
    s = press(s, 'REMOVE_POINT', 'RED', 'PRESS', 4000);
    expect(s.score.RED).toBe(0);
    expect(s.lastInputMono).toBe(4000);
  });
});

describe('the main clock', () => {
  it('is computed by subtraction, never by accumulation', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    expect(selectClockMs(s, 1000)).toBe(180_000);
    expect(selectClockMs(s, 31_000)).toBe(150_000);
    // The same state object read at a later instant gives a later value: the
    // clock is a function of time, not of how often anything ticked.
    expect(selectClockMs(s, 61_000)).toBe(120_000);
  });

  it('holds its value while stopped, however much time passes', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 11_000);
    expect(selectClockMs(s, 11_000)).toBe(170_000);
    expect(selectClockMs(s, 900_000)).toBe(170_000);
  });

  it('adjusts by one second and clamps at the period duration', () => {
    // The clock counts down, so FORWARD (advancing through match time)
    // subtracts and BACKWARD (rewinding) adds (FS §5.1).
    let s = fresh('ncaa');
    s = press(s, 'FORWARD', 'RED', 'PRESS', 1000);
    expect(selectClockMs(s, 1000)).toBe(179_000);
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 1000);
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 1000);
    expect(selectClockMs(s, 1000)).toBe(180_000);
  });

  it('winding the clock back also winds back riding time accrued by the current owner', () => {
    // The scenario this exists for: the referee is late stopping the clock
    // and needs to wind it back, which should also un-accrue the riding time
    // that accumulated during the interval being corrected (FS §5.1).
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'GREEN', 'PRESS', 1000);
    expect(accruedMs(s.secondary.up.GREEN, 6000)).toBe(5000);

    // BACKWARD rewinds the match clock — and should un-accrue from GREEN,
    // the current owner, regardless of which corner pressed BACKWARD.
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 6000);
    expect(accruedMs(s.secondary.up.GREEN, 6000)).toBe(4000);
    expect(selectClockMs(s, 6000)).toBe(176_000); // +1s from the rewind, on top of the 5s already elapsed

    // FORWARD re-accrues the correction back onto the owner.
    s = press(s, 'FORWARD', 'RED', 'PRESS', 6000);
    expect(accruedMs(s.secondary.up.GREEN, 6000)).toBe(5000);
  });

  it('does not touch riding time while the secondary clock is unowned', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 6000);
    expect(accruedMs(s.secondary.up.RED, 6000)).toBe(0);
    expect(accruedMs(s.secondary.up.GREEN, 6000)).toBe(0);
  });

  it('winding the clock back also winds back the freestyle activity clock', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    expect(selectSecondaryRemainingMs(s, 6000)).toBe(25_000);

    // BACKWARD rewinds — the activity clock gains back the same amount as
    // the main clock, since it moves with the main clock's own sign here.
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 6000);
    expect(selectSecondaryRemainingMs(s, 6000)).toBe(26_000);

    s = press(s, 'FORWARD', 'RED', 'PRESS', 6000);
    expect(selectSecondaryRemainingMs(s, 6000)).toBe(25_000);
  });

  it('resets the period clock on a hold', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'HOLD', 61_000);
    expect(selectClockMs(s, 61_000)).toBe(180_000);
    expect(s.clock.running).toBe(false);
  });

  it('stops at zero and notifies, once', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = tick(s, 181_000);
    expect(s.clock.running).toBe(false);
    expect(selectClockMs(s, 200_000)).toBe(0);
    expect(s.outbox.filter((n) => n.kind === NOTIFY.PERIOD_EXPIRED)).toHaveLength(1);

    s = tick(s, 182_000);
    expect(s.outbox.filter((n) => n.kind === NOTIFY.PERIOD_EXPIRED)).toHaveLength(1);
  });

  it('fires the configured warning once', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = tick(s, 177_000); // 4 s remaining
    s = tick(s, 177_500);
    expect(s.outbox.filter((n) => n.kind === NOTIFY.MAIN_WARNING)).toHaveLength(1);
  });

  it('returns the same object from a tick that changed nothing', () => {
    const s = fresh('ncaa');
    expect(tick(s, 5000)).toBe(s);
  });
});

describe('period navigation', () => {
  it('steps forward and back on the green remote, stopping the clock', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED');
    s = press(s, 'FORWARD', 'GREEN');
    expect(s.periodIndex).toBe(1);
    expect(s.clock.running).toBe(false);
    expect(selectClockMs(s, t)).toBe(120_000);

    s = press(s, 'BACKWARD', 'GREEN');
    expect(s.periodIndex).toBe(0);
  });

  it('jumps to the last and first period on a hold', () => {
    let s = fresh('ncaa');
    s = press(s, 'FORWARD', 'GREEN', 'HOLD', 1000);
    expect(s.periodIndex).toBe(6); // three regulation + four overtime
    // A separate hold well after the first releases — not the combo-hold
    // reset gesture, which needs both concurrently (matchReducer.js's
    // isHeldNow/HOLD_RECENCY_MS).
    s = press(s, 'BACKWARD', 'GREEN', 'HOLD', 2000);
    expect(s.periodIndex).toBe(0);
  });

  it('clamps rather than wrapping', () => {
    let s = fresh('ncaa');
    s = press(s, 'BACKWARD', 'GREEN');
    expect(s.periodIndex).toBe(0);
  });

  it('honours a pre-match duration override', () => {
    let s = fresh('ibjjf');
    s = matchReducer(s, { type: 'SET_PERIOD_DURATION', index: 0, seconds: 600, now: t });
    expect(selectPeriodDuration(s, 0)).toBe(600);
    expect(selectClockMs(s, t)).toBe(600_000);
  });
});

describe('riding time — count-up polarity', () => {
  it('accrues only while owned and the main clock is running', () => {
    let s = fresh('ncaa');
    at(1000);
    s = press(s, 'F1', 'RED'); // assigned, but the clock is stopped
    s = tick(s, 11_000);
    expect(accruedMs(s.secondary.up.RED, 11_000)).toBe(0);

    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 11_000);
    expect(accruedMs(s.secondary.up.RED, 41_000)).toBe(30_000);
  });

  it('transfers directly to the other athlete with no deassign first', () => {
    // The most important interaction in folkstyle riding time: control changes
    // hands repeatedly and rapidly.
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'GREEN', 'PRESS', 21_000);

    expect(s.secondary.owner).toBe('GREEN');
    expect(accruedMs(s.secondary.up.RED, 21_000)).toBe(20_000);
    expect(accruedMs(s.secondary.up.GREEN, 41_000)).toBe(20_000);
  });

  it('deassigns on a second press by the owner, retaining the accumulated value', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 11_000);

    expect(s.secondary.owner).toBeNull();
    expect(accruedMs(s.secondary.up.RED, 60_000)).toBe(10_000);
  });

  it('pauses automatically when the main clock stops, retaining ownership', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 11_000);

    expect(s.secondary.owner).toBe('RED');
    expect(accruedMs(s.secondary.up.RED, 99_000)).toBe(10_000);
  });

  it('resets everything on a hold', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'HOLD', 21_000);

    expect(s.secondary.owner).toBeNull();
    expect(accruedMs(s.secondary.up.RED, 21_000)).toBe(0);
  });

  it('carries accumulation between regulation periods but deassigns ownership', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 31_000);

    expect(s.periodIndex).toBe(1);
    expect(s.secondary.owner).toBeNull();
    expect(accruedMs(s.secondary.up.RED, 31_000)).toBe(30_000);
  });

  it('resets accumulation on entry to overtime', () => {
    // Current NCAA rules: riding time accrued in regulation does not carry into
    // overtime, although everything else does. Expressed as per-period config
    // because it has moved across rules cycles.
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    // Spaced out well beyond HOLD_RECENCY_MS: five separate, sequential
    // presses, not the concurrent hold the combo-reset suppression looks for.
    s = press(s, 'FORWARD', 'GREEN', 'HOLD', 61_000); // jump to the last OT period
    s = press(s, 'BACKWARD', 'GREEN', 'HOLD', 62_000); // back to the first
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 63_000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 64_000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 65_000); // index 3 = SV

    expect(s.periodIndex).toBe(3);
    expect(accruedMs(s.secondary.up.RED, 61_000)).toBe(0);
  });

  it('reports the differential against the athlete it favours', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'GREEN', 'PRESS', 1000);
    const d = selectDifferential(s, 46_000);
    expect(d).toEqual({ favoured: 'GREEN', ms: 45_000 });
  });
});

describe('activity clock — count-down polarity', () => {
  it('counts down while owned and running, and resets on deassign', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    expect(selectSecondaryRemainingMs(s, 11_000)).toBe(20_000);

    s = press(s, 'F1', 'RED', 'PRESS', 11_000);
    expect(s.secondary.owner).toBeNull();
    expect(selectSecondaryRemainingMs(s, 11_000)).toBe(30_000);
  });

  it('notifies on expiry, then deassigns and resets', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'GREEN', 'PRESS', 1000);
    s = tick(s, 32_000);

    expect(s.outbox.filter((n) => n.kind === NOTIFY.SECONDARY_EXPIRED)).toHaveLength(1);
    expect(s.secondary.owner).toBeNull();
    expect(selectSecondaryRemainingMs(s, 32_000)).toBe(30_000);
    // The system never awards the resulting point.
    expect(s.score).toEqual({ RED: 0, GREEN: 0 });
  });

  it('does not carry the obligation across a period boundary', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 11_000);

    expect(s.secondary.owner).toBeNull();
    expect(selectSecondaryRemainingMs(s, 11_000)).toBe(30_000);
  });
});

describe('counters and flags', () => {
  it('counts up on press and corrects down on hold, never below zero', () => {
    let s = fresh('ibjjf');
    s = press(s, 'F2', 'RED');
    s = press(s, 'F2', 'RED');
    expect(s.counters.RED.f2).toBe(2);
    s = press(s, 'F2', 'RED', 'HOLD');
    expect(s.counters.RED.f2).toBe(1);
    s = press(s, 'F2', 'RED', 'HOLD');
    s = press(s, 'F2', 'RED', 'HOLD');
    expect(s.counters.RED.f2).toBe(0);
  });

  it('moves a tri-state flag between athletes and clears it', () => {
    let s = fresh('ncaa');
    s = press(s, 'F2', 'RED');
    expect(s.flags.f2).toBe('RED');
    s = press(s, 'F2', 'GREEN');
    expect(s.flags.f2).toBe('GREEN');
    s = press(s, 'F2', 'GREEN');
    expect(s.flags.f2).toBeNull();
  });

  it('never infers the flag from anything', () => {
    // No state machine, no period-transition logic, no overtime derivation.
    let s = fresh('ncaa');
    s = press(s, 'ADD_POINT', 'RED');
    s = press(s, 'FORWARD', 'GREEN');
    s = press(s, 'FORWARD', 'GREEN');
    expect(s.flags.f2).toBeNull();
  });

  it('treats an unbound function button as fully inert', () => {
    const s = fresh('nfhs');
    expect(isInertInput(s, 'F1')).toBe(true);
    expect(press(s, 'F1', 'RED')).toBe(s);
    expect(press(s, 'F1', 'RED', 'HOLD')).toBe(s);
  });
});

describe('action grouping', () => {
  it('groups rapid presses on the same remote in freestyle', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1000);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1300);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1600);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1900);

    const scores = s.log.filter((e) => e.type === 'SCORE');
    expect(scores).toHaveLength(1);
    expect(scores[0].value).toBe(4);
    expect(s.score.RED).toBe(4);
  });

  it('does not group across the window, or across remotes', () => {
    let s = fresh('uww-freestyle');
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1000);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 5000);
    s = press(s, 'ADD_POINT', 'GREEN', 'PRESS', 5200);
    expect(s.log.filter((e) => e.type === 'SCORE')).toHaveLength(3);
  });

  it('is off in folkstyle — nothing is ever inferred from scoring input', () => {
    let s = fresh('ncaa');
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1000);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1100);
    expect(s.log.filter((e) => e.type === 'SCORE')).toHaveLength(2);
  });

  it('never alters the score', () => {
    let s = fresh('uww-freestyle');
    for (let i = 0; i < 5; i += 1) s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1000 + i * 100);
    expect(s.score.RED).toBe(5);
  });
});

describe('phases', () => {
  it('notifies on entry to a phase that asks for it', () => {
    let s = fresh('adcc');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = tick(s, 301_000);
    expect(s.phaseIndex).toBe(1);
    expect(s.outbox.filter((n) => n.kind === NOTIFY.PHASE_ENTERED)).toHaveLength(1);
  });

  it('does not gate or reject input before the boundary', () => {
    // Positive-point input remains live beforehand; officials are expected to
    // know positive points do not count in the first half.
    let s = fresh('adcc');
    s = press(s, 'ADD_POINT', 'RED');
    expect(s.score.RED).toBe(1);
  });
});

describe('indicators', () => {
  it('lights the clock indicator on both remotes, in the owner\'s colour, whether accruing or paused', () => {
    let s = fresh('ncaa');
    s = press(s, 'F1', 'RED', 'PRESS', 1000);
    // Holder-colour rendering (FS §10.3): both wrists show the same thing,
    // in RED's own colour — not the ruleset's per-role led_colour.
    expect(selectIndicators(s).RED.f1).toEqual({ mode: 'SOLID', colour: 'RED' });
    expect(selectIndicators(s).GREEN.f1).toEqual({ mode: 'SOLID', colour: 'RED' });

    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    expect(selectIndicators(s).RED.f1.mode).toBe('SOLID');
    expect(selectIndicators(s).GREEN.f1.mode).toBe('SOLID');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 5000);
    expect(selectIndicators(s).RED.f1.mode).toBe('SOLID');
    expect(selectIndicators(s).GREEN.f1.mode).toBe('SOLID');
  });

  it('leaves an inert slot off', () => {
    const s = fresh('nfhs');
    expect(selectIndicators(s).RED.f1).toEqual({ mode: 'OFF', colour: 'RED' });
  });
});

describe('halt and resume', () => {
  it('takes no input while halted', () => {
    let s = fresh('ncaa');
    s = matchReducer(s, { type: 'HALT', reason: 'time_discontinuity', divergenceMs: 40_000, now: 1000 });
    const halted = s;
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 2000);
    expect(s).toBe(halted);
    expect(s.score.RED).toBe(0);
  });

  it('stops the clock on halt and discards the gap on resume', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = matchReducer(s, { type: 'HALT', reason: 'time_discontinuity', divergenceMs: 40_000, now: 11_000 });
    expect(s.clock.running).toBe(false);
    expect(selectClockMs(s, 11_000)).toBe(170_000);

    s = matchReducer(s, { type: 'RESUME_AFTER_HALT', now: 400_000 });
    expect(selectClockMs(s, 400_000)).toBe(170_000);
  });
});

describe('rehydration', () => {
  it('restores stopped, at the value the match held', () => {
    let s = fresh('ncaa');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'ADD_POINT', 'RED', 'PRESS', 1000);
    s = press(s, 'F1', 'RED', 'PRESS', 1000);

    const frozen = JSON.parse(
      JSON.stringify({
        ...s,
        clock: { remainingMs: selectClockMs(s, 61_000), running: false, refMono: null },
        secondary: {
          ...s.secondary,
          up: {
            RED: { accruedMs: accruedMs(s.secondary.up.RED, 61_000), running: false, refMono: null },
            GREEN: { accruedMs: 0, running: false, refMono: null },
          },
        },
      }),
    );

    // A restored match resumes under the referee's hand, never on its own, and
    // never with time that passed while the tab was closed.
    const restored = matchReducer(s, { type: 'REHYDRATE', state: frozen, now: 9_000_000 });
    expect(restored.clock.running).toBe(false);
    expect(selectClockMs(restored, 9_000_000)).toBe(120_000);
    expect(restored.score.RED).toBe(1);
    expect(restored.secondary.owner).toBe('RED');
    expect(accruedMs(restored.secondary.up.RED, 9_000_000)).toBe(60_000);
  });
});

describe('period structure (pre-match)', () => {
  it('adds, renames and removes a regulation period', () => {
    let s = fresh('ibjjf'); // single 'Match' period — easiest to reason about
    expect(s.periods.length).toBe(1);

    s = matchReducer(s, { type: 'ADD_PERIOD', afterIndex: 0, now: t });
    expect(s.periods.length).toBe(2);
    expect(s.periods[1].duration_s).toBe(s.periods[0].duration_s); // cloned from source

    s = matchReducer(s, { type: 'RENAME_PERIOD', index: 1, label: 'Overtime period', now: t });
    expect(s.periods[1].label).toBe('Overtime period');

    s = matchReducer(s, { type: 'REMOVE_PERIOD', index: 0, now: t });
    expect(s.periods.length).toBe(1);
    expect(s.periods[0].label).toBe('Overtime period');
  });

  it('refuses to remove the last remaining period', () => {
    const s = fresh('ibjjf');
    const removed = matchReducer(s, { type: 'REMOVE_PERIOD', index: 0, now: t });
    expect(removed).toBe(s);
  });

  it('ignores a blank rename', () => {
    const s = fresh('ibjjf');
    const renamed = matchReducer(s, { type: 'RENAME_PERIOD', index: 0, label: '   ', now: t });
    expect(renamed).toBe(s);
  });

  it('refuses structural edits once the match has stepped, scored, or is running', () => {
    const s = fresh('ncaa');

    const stepped = press(s, 'FORWARD', 'GREEN');
    expect(matchReducer(stepped, { type: 'ADD_PERIOD', afterIndex: 0, now: t })).toBe(stepped);

    const scored = press(s, 'ADD_POINT', 'RED');
    expect(matchReducer(scored, { type: 'REMOVE_PERIOD', index: 0, now: t })).toBe(scored);

    const running = press(s, 'TOGGLE_CLOCK', 'RED');
    expect(matchReducer(running, { type: 'RENAME_PERIOD', index: 0, label: 'x', now: t })).toBe(running);
  });

  it('sets an overtime-positioned period duration without disturbing others', () => {
    let s = fresh('ncaa'); // 3 regulation + 4 overtime (folkstyleOvertime), one flat list
    s = matchReducer(s, { type: 'SET_PERIOD_DURATION', index: 3, seconds: 90, now: t }); // index 3 = first overtime round (SV)
    expect(selectPeriodDuration(s, 3)).toBe(90);
    expect(s.periods[3].overtime).toBe(true);
    expect(s.periods[0].duration_s).toBe(180); // unaffected regulation P1
  });

  it('treats overtime periods identically to regulation ones — renamable, removable, and a valid insertion point', () => {
    let s = fresh('ncaa'); // periods: P1,P2,P3,SV,TB1,TB2,UTB
    const overtimeCountBefore = s.periods.length - 3;

    s = matchReducer(s, { type: 'RENAME_PERIOD', index: 3, label: 'Sudden Victory', now: t });
    expect(s.periods[3].label).toBe('Sudden Victory');

    s = matchReducer(s, { type: 'REMOVE_PERIOD', index: 6, now: t }); // removes UTB
    expect(s.periods.length).toBe(3 + overtimeCountBefore - 1);
    expect(s.periods.some((p) => p.label === 'UTB')).toBe(false);

    s = matchReducer(s, { type: 'ADD_PERIOD', afterIndex: 3, now: t }); // insert after Sudden Victory
    expect(s.periods.length).toBe(3 + overtimeCountBefore);
    expect(s.periods[4].overtime).toBe(true); // cloned the overtime flag from its source
    expect(s.periods[4].duration_s).toBe(s.periods[3].duration_s);
  });

  it('an added period is reachable via navigation with its own duration and secondary-clock cascade', () => {
    let s = fresh('uww-freestyle'); // two periods, activityClock, reset_at_start: true
    s = matchReducer(s, { type: 'ADD_PERIOD', afterIndex: 1, now: t });
    s = matchReducer(s, { type: 'SET_PERIOD_DURATION', index: 2, seconds: 60, now: t });
    expect(selectMatchPeriods(s)[2].secondary_clock.reset_at_start).toBe(true);

    s = press(s, 'FORWARD', 'GREEN');
    s = press(s, 'FORWARD', 'GREEN');
    expect(s.periodIndex).toBe(2);
    expect(selectClockMs(s, t)).toBe(60_000);
  });
});

describe('halted-only direct edits', () => {
  it('refuses SET_SCORE, SET_CLOCK and SET_ATHLETE while the clock runs', () => {
    const running = press(fresh('ncaa'), 'TOGGLE_CLOCK', 'RED');
    expect(matchReducer(running, { type: 'SET_SCORE', corner: 'RED', value: 5, now: t })).toBe(running);
    expect(matchReducer(running, { type: 'SET_CLOCK', ms: 1000, now: t })).toBe(running);
    expect(
      matchReducer(running, { type: 'SET_ATHLETE', corner: 'RED', value: { name: 'Alex' }, now: t }),
    ).toBe(running);
  });

  it('SET_ATHLETE renames a corner while halted', () => {
    let s = fresh('ncaa');
    s = matchReducer(s, { type: 'SET_ATHLETE', corner: 'RED', value: { name: 'Alex' }, now: t });
    expect(s.athletes.RED.name).toBe('Alex');
  });

  it('SET_SCORE clamps to ruleset bounds and logs a distinct SCORE_SET entry', () => {
    let s = fresh('ncaa'); // scoring 0..99
    s = matchReducer(s, { type: 'SET_SCORE', corner: 'RED', value: 150, now: t });
    expect(s.score.RED).toBe(99);
    const entry = s.log[s.log.length - 1];
    expect(entry.type).toBe('SCORE_SET');
    expect(entry.from).toBe(0);
    expect(entry.to).toBe(99);
  });

  it('SET_SCORE is a no-op when the value does not change', () => {
    const s = fresh('ncaa');
    expect(matchReducer(s, { type: 'SET_SCORE', corner: 'RED', value: 0, now: t })).toBe(s);
  });

  it('SET_CLOCK clamps to [0, period duration]', () => {
    let s = fresh('ncaa');
    let over = matchReducer(s, { type: 'SET_CLOCK', ms: 999_999, now: t });
    expect(selectClockMs(over, t)).toBe(180_000);
    let under = matchReducer(s, { type: 'SET_CLOCK', ms: -500, now: t });
    expect(selectClockMs(under, t)).toBe(0);
  });

  it('SET_CLOCK does not cascade to the secondary clock, unlike the gesture path', () => {
    let s = fresh('ncaa');
    s = press(s, 'F1', 'RED', 'PRESS', 1000); // assigns riding time to RED
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 31_000); // stop after 30s accrued
    expect(accruedMs(s.secondary.up.RED, 31_000)).toBe(30_000);

    s = matchReducer(s, { type: 'SET_CLOCK', ms: 100_000, now: 31_000 });
    expect(accruedMs(s.secondary.up.RED, 31_000)).toBe(30_000);
  });
});

describe('remote combo-hold reset', () => {
  function withHold(state, src, forward, backward) {
    return {
      ...state,
      holdTracking: {
        ...state.holdTracking,
        [src]: {
          FORWARD: forward ? { since: forward[0], lastSeen: forward[1] } : null,
          BACKWARD: backward ? { since: backward[0], lastSeen: backward[1] } : null,
        },
      },
    };
  }

  it('arms comboReset once both buttons have overlapped for 5000ms while halted', () => {
    let s = fresh('ncaa'); // clock not running
    s = withHold(s, 'RED', [1000, 5900], [1200, 5900]);
    s = tick(s, 6200); // overlap start = max(1000, 1200) = 1200; 6200 - 1200 = 5000
    expect(s.comboReset).toEqual({ src: 'RED', armedAtMono: 6200 });
  });

  it('does not arm before the threshold', () => {
    let s = fresh('ncaa');
    s = withHold(s, 'RED', [1000, 5300], [1000, 5300]);
    s = tick(s, 5300); // overlap only 4300ms
    expect(s.comboReset).toBe(null);
  });

  it('does not arm while the clock is running', () => {
    let s = press(fresh('ncaa'), 'TOGGLE_CLOCK', 'RED', 'PRESS', 500);
    s = withHold(s, 'RED', [1000, 5900], [1000, 5900]);
    s = tick(s, 6200);
    expect(s.comboReset).toBe(null);
  });

  it('clears a stale hold entry beyond HOLD_RECENCY_MS', () => {
    let s = fresh('ncaa');
    s = withHold(s, 'RED', [1000, 1000], [1000, 1000]);
    s = tick(s, 2000); // 1000ms since last seen — presumed released
    expect(s.holdTracking.RED.FORWARD).toBe(null);
    expect(s.holdTracking.RED.BACKWARD).toBe(null);
  });

  it('is a one-shot latch — armedAtMono does not creep forward while the hold continues', () => {
    let s = fresh('ncaa');
    s = withHold(s, 'RED', [1000, 5900], [1000, 5900]);
    s = tick(s, 6200);
    expect(s.comboReset.armedAtMono).toBe(6200);

    s = withHold(s, 'RED', [1000, 6300], [1000, 6300]);
    s = tick(s, 6400);
    expect(s.comboReset.armedAtMono).toBe(6200);
  });

  it('suppresses the red remote clock nudge while both buttons are concurrently held', () => {
    let s = fresh('ncaa'); // P1 duration 180s
    s = press(s, 'FORWARD', 'RED', 'HOLD', 1000); // lone hold — still acts
    expect(selectClockMs(s, 1000)).toBe(179_000);

    s = press(s, 'BACKWARD', 'RED', 'HOLD', 1100); // FORWARD still recently held — suppressed
    expect(selectClockMs(s, 1100)).toBe(179_000); // not nudged back to 180_000

    s = press(s, 'FORWARD', 'RED', 'HOLD_REP', 1250); // still concurrent — suppressed
    expect(selectClockMs(s, 1250)).toBe(179_000);
  });

  it('suppresses green-remote period navigation the same way', () => {
    let s = fresh('ncaa');
    s = press(s, 'FORWARD', 'GREEN', 'HOLD', 1000); // lone hold — jumps to the last period
    expect(s.periodIndex).toBe(6);

    s = press(s, 'BACKWARD', 'GREEN', 'HOLD', 1100); // FORWARD still recently held — suppressed
    expect(s.periodIndex).toBe(6); // not pulled back to the first period
  });

  it('RESET_MATCH reverts athletes to default but preserves the customised period list', () => {
    let s = fresh('ncaa');
    s = matchReducer(s, { type: 'SET_ATHLETE', corner: 'RED', value: { name: 'Alex' }, now: t });
    s = matchReducer(s, { type: 'SET_PERIOD_DURATION', index: 0, seconds: 200, now: t });
    s = withHold(s, 'RED', [1000, 5900], [1000, 5900]);
    s = tick(s, 6200);
    expect(s.comboReset).not.toBe(null);

    // Long after the hold's last-seen — not concurrent with the reset.
    s = matchReducer(s, { type: 'RESET_MATCH', now: 20_000 });
    // Names are per-bout, unlike ruleset/period structure — a reset starts
    // the next bout with default names; the just-replaced match's custom
    // names live on only in the history snapshot App.jsx captures first.
    expect(s.athletes.RED.name).toBe('Red');
    expect(s.periods[0].duration_s).toBe(200);
    expect(selectClockMs(s, 20_000)).toBe(200_000);
    expect(s.comboReset).toBe(null);
    expect(s.holdTracking.RED.FORWARD).toBe(null); // stale by reset time — not carried
  });

  it('carries a still-held button across the reset, re-anchored, so suppression has no gap', () => {
    let s = fresh('ncaa'); // P1 duration 180s
    s = withHold(s, 'RED', [1000, 6150], [1000, 6150]); // both still held right up to the reset
    s = tick(s, 6200);
    expect(s.comboReset).not.toBe(null);

    s = matchReducer(s, { type: 'RESET_MATCH', now: 6210 }); // fires moments later, hold still fresh
    expect(s.holdTracking.RED.FORWARD).toEqual({ since: 6210, lastSeen: 6150 });
    expect(s.holdTracking.RED.BACKWARD).toEqual({ since: 6210, lastSeen: 6150 });

    // No gap: the very next event for one button is still suppressed by the
    // other's carried-over entry, rather than slipping an unsuppressed nudge
    // through — the bug this carry-over exists to close.
    const nudged = press(s, 'FORWARD', 'RED', 'HOLD_REP', 6220);
    expect(selectClockMs(nudged, 6220)).toBe(180_000);

    // But continuing to hold both must not loop into an immediate second
    // reset — it needs a full fresh COMBO_HOLD_MS from the re-anchored
    // `since`, not the original hold's.
    let after = withHold(s, 'RED', [6210, 6300], [6210, 6300]);
    after = tick(after, 6400); // only 190ms past the re-anchor
    expect(after.comboReset).toBe(null);
  });
});
