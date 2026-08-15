import { describe, it, expect } from 'vitest';
import {
  matchReducer,
  createInitialMatchState,
  selectClockMs,
  selectDifferential,
  selectSecondaryRemainingMs,
  selectIndicators,
  selectPeriodDuration,
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
    let s = fresh('ncaa');
    s = press(s, 'BACKWARD', 'RED', 'PRESS', 1000);
    expect(selectClockMs(s, 1000)).toBe(179_000);
    s = press(s, 'FORWARD', 'RED', 'PRESS', 1000);
    s = press(s, 'FORWARD', 'RED', 'PRESS', 1000);
    expect(selectClockMs(s, 1000)).toBe(180_000);
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
    s = press(s, 'FORWARD', 'GREEN', 'HOLD');
    expect(s.periodIndex).toBe(6); // three regulation + four overtime
    s = press(s, 'BACKWARD', 'GREEN', 'HOLD');
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
    s = press(s, 'FORWARD', 'GREEN', 'HOLD', 61_000); // jump to the last OT period
    s = press(s, 'BACKWARD', 'GREEN', 'HOLD', 61_000); // back to the first
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 61_000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 61_000);
    s = press(s, 'FORWARD', 'GREEN', 'PRESS', 61_000); // index 3 = SV

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
    // in RED's athlete colour — not the ruleset's per-role led_colour.
    expect(selectIndicators(s).RED.f1).toEqual({ mode: 'SOLID', rgb: 'E03127' });
    expect(selectIndicators(s).GREEN.f1).toEqual({ mode: 'SOLID', rgb: 'E03127' });

    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 1000);
    expect(selectIndicators(s).RED.f1.mode).toBe('SOLID');
    expect(selectIndicators(s).GREEN.f1.mode).toBe('SOLID');
    s = press(s, 'TOGGLE_CLOCK', 'RED', 'PRESS', 5000);
    expect(selectIndicators(s).RED.f1.mode).toBe('SOLID');
    expect(selectIndicators(s).GREEN.f1.mode).toBe('SOLID');
  });

  it('leaves an inert slot off', () => {
    const s = fresh('nfhs');
    expect(selectIndicators(s).RED.f1).toEqual({ mode: 'OFF', rgb: '000000' });
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
