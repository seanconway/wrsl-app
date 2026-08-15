// The preconfigured ruleset library (FS §12.1) expressed in the configuration
// schema of FS §12.2. This file is DATA. Adding or amending a ruleset must not
// require a change to the reducer, the protocol, the interface, or the
// firmware — if a ruleset needs code, the schema is wrong, not the ruleset.
//
// RULES-CYCLE WARNING. Durations, thresholds and carry-over rules below reflect
// NFHS 2025-26, NCAA 2025-27, UWW rules effective January 2026, IBJJF Rule Book
// v6.1 and published ADCC rules. NCAA riding-time and overtime provisions in
// particular have changed across recent cycles, which is exactly why they are
// expressed here as data. VERIFY AGAINST THE CURRENT RULEBOOK before an event.
//
// Nothing in this file is ever enforced. `threshold_s` and `threshold_note` are
// display aids; the system shows the referee what they are watching for and the
// referee applies the rule (SCOPE.md §7.2).

/** Function-button roles. Determines how F1/F2 presses are interpreted. */
export const ROLE = {
  SECONDARY_CLOCK: 'secondary_clock',
  COUNTER: 'counter',
  FLAG: 'flag',
  INERT: 'inert',
};

// Indicator colours per role, so a referee can tell a clock indicator from a
// counter or a flag without recalling which ruleset is loaded (FS §10.3).
// Values are names from the wire's fixed four-colour palette (PROTOCOL.md
// §6) — the remote renders exactly these, not a hex value picked without
// knowing what the hardware could show true. FLAG's value is never actually
// sent: FLAG (like SECONDARY_CLOCK) renders the holding athlete's colour
// instead of its role colour (see holderIndicator() in matchReducer.js), so
// this exists only so the field is never undefined, not because it's read.
const LED = {
  CLOCK: 'BLUE', // informational — a clock the athlete owns
  CREDIT: 'GREEN', // accrues to this athlete's benefit
  AGAINST: 'YELLOW', // counts against this athlete
  FLAG: 'GREEN', // unused on the wire — see comment above
};

const NO_SECONDARY = {
  enabled: false,
  polarity: null,
  duration_s: null,
  notify_on_expiry: false,
  display_anchor: null,
  clear_at_period_end: false,
  deassign_at_period_start: false,
};

const inert = () => ({ role: ROLE.INERT, label: null, led_colour: 'RED' }); // unused — never rendered or read

// ---------------------------------------------------------------------------
// Folkstyle
// ---------------------------------------------------------------------------

/** Riding time in every regulation period: accumulation carries between them,
 *  ownership deassigns at each boundary, one minute earns a point (FS §6.3). */
const ncaaRegulationClock = {
  active: true,
  reset_at_start: false,
  threshold_s: 60,
  threshold_note: '1 pt',
};

/** Accrues fresh from zero in overtime, where as little as one second can
 *  decide a tied round. The system applies neither consequence. */
const ncaaOvertimeClock = {
  active: true,
  reset_at_start: false,
  threshold_s: 1,
  threshold_note: 'decides bout',
};

const folkstyleOvertime = (secondary) => [
  { label: 'SV', duration_s: 60, type: 'sudden_victory', secondary_clock: { ...secondary, reset_at_start: true } },
  { label: 'TB1', duration_s: 30, type: 'tiebreaker', secondary_clock: secondary },
  { label: 'TB2', duration_s: 30, type: 'tiebreaker', secondary_clock: secondary },
  { label: 'UTB', duration_s: 30, type: 'ultimate_tiebreaker', secondary_clock: secondary },
];

const NCAA = {
  id: 'ncaa',
  name: 'NCAA Folkstyle',
  version: '2025-27',
  derived_from: null,
  periods: [
    { label: 'P1', duration_s: 180, secondary_clock: ncaaRegulationClock },
    { label: 'P2', duration_s: 120, secondary_clock: ncaaRegulationClock },
    { label: 'P3', duration_s: 120, secondary_clock: ncaaRegulationClock },
  ],
  overtime: folkstyleOvertime(ncaaOvertimeClock),
  phases: [],
  scoring: { min: 0, max: 99, allow_negative_total: false },
  main_clock: { warning_at_s: 5 },
  secondary_clock: {
    enabled: true,
    polarity: 'count_up',
    duration_s: null,
    notify_on_expiry: false,
    display_anchor: 'favoured_athlete',
    clear_at_period_end: false,
    deassign_at_period_start: true,
  },
  action_grouping: { enabled: false, window_ms: 0 },
  f1: { role: ROLE.SECONDARY_CLOCK, label: 'Riding time', led_colour: LED.CLOCK },
  f2: { role: ROLE.FLAG, label: 'Pending choice', led_colour: LED.FLAG },
  counters: [],
  tiebreak_criteria: [],
};

const NFHS = {
  ...NCAA,
  id: 'nfhs',
  name: 'NFHS Folkstyle',
  version: '2025-26',
  derived_from: 'ncaa',
  periods: [
    { label: 'P1', duration_s: 120, secondary_clock: { active: false } },
    { label: 'P2', duration_s: 120, secondary_clock: { active: false } },
    { label: 'P3', duration_s: 120, secondary_clock: { active: false } },
  ],
  overtime: folkstyleOvertime({ active: false }),
  secondary_clock: NO_SECONDARY,
  // Left inert deliberately rather than assigned to warning counts, so folkstyle
  // behaves identically across variants and the referee's mental model does not
  // change with the division (FS §5.6).
  f1: inert(),
  f2: { role: ROLE.FLAG, label: 'Pending choice', led_colour: LED.FLAG },
};

// ---------------------------------------------------------------------------
// Freestyle / Greco-Roman
// ---------------------------------------------------------------------------

const activityClock = {
  active: true,
  reset_at_start: true,
  threshold_s: 0,
  threshold_note: 'pt to opponent',
};

const FREESTYLE = {
  id: 'uww-freestyle',
  name: 'UWW Freestyle',
  version: '2026-01',
  derived_from: null,
  periods: [
    { label: 'P1', duration_s: 180, secondary_clock: activityClock },
    { label: 'P2', duration_s: 180, secondary_clock: activityClock },
  ],
  overtime: [],
  phases: [],
  scoring: { min: 0, max: 99, allow_negative_total: false },
  main_clock: { warning_at_s: 5 },
  secondary_clock: {
    enabled: true,
    polarity: 'count_down',
    duration_s: 30,
    notify_on_expiry: true,
    display_anchor: null,
    clear_at_period_end: true,
    deassign_at_period_start: false,
  },
  // Grouping exists for freestyle and only for freestyle: the tiebreak criteria
  // turn on the value of the single highest technical action, so a four-point
  // throw entered as four presses must not be indistinguishable from four
  // one-point actions (FS §4.3).
  action_grouping: { enabled: true, window_ms: 1200 },
  f1: { role: ROLE.SECONDARY_CLOCK, label: 'Activity clock', led_colour: LED.CLOCK },
  f2: { role: ROLE.COUNTER, label: 'Cautions', led_colour: LED.AGAINST },
  counters: [
    { id: 'f2', ladder_steps: ['1st caution', '2nd caution', '3rd caution — loss by cautions'], display_only: true },
  ],
  tiebreak_criteria: [
    'Highest-value single technical action',
    'Fewest cautions',
    'Last technical points scored',
  ],
};

const GRECO = {
  ...FREESTYLE,
  id: 'uww-greco',
  name: 'UWW Greco-Roman',
  derived_from: 'uww-freestyle',
};

// ---------------------------------------------------------------------------
// Brazilian jiu-jitsu — gi
// ---------------------------------------------------------------------------

const IBJJF = {
  id: 'ibjjf',
  name: 'IBJJF',
  version: 'v6.1',
  derived_from: null,
  // Match length varies by belt and age division; adjust at pre-match. 6:00 is
  // the adult blue-belt duration and is here as a default, not a rule.
  periods: [{ label: 'Match', duration_s: 360, secondary_clock: { active: false } }],
  overtime: [],
  phases: [],
  scoring: { min: 0, max: 99, allow_negative_total: false },
  main_clock: { warning_at_s: 5 },
  secondary_clock: NO_SECONDARY,
  action_grouping: { enabled: false, window_ms: 0 },
  f1: { role: ROLE.COUNTER, label: 'Advantages', led_colour: LED.CREDIT },
  f2: { role: ROLE.COUNTER, label: 'Penalties', led_colour: LED.AGAINST },
  counters: [
    { id: 'f1', ladder_steps: [], display_only: true },
    {
      id: 'f2',
      ladder_steps: ['Warning', 'Advantage to opponent', '2 pts to opponent', 'Disqualification'],
      display_only: true,
    },
  ],
  tiebreak_criteria: ['Points', 'Advantages', 'Penalties', 'Referee decision'],
};

const SJJIF = { ...IBJJF, id: 'sjjif', name: 'SJJIF', derived_from: 'ibjjf' };

// ---------------------------------------------------------------------------
// Submission grappling — no-gi
// ---------------------------------------------------------------------------

const ADCC = {
  id: 'adcc',
  name: 'ADCC',
  version: 'current',
  derived_from: null,
  // Two halves. Positive points do not count in the first; the phase boundary
  // is the only thing the system signals, and officials are expected to know
  // what it means (SCOPE.md §8.5). Duration varies by bracket — verify.
  periods: [{ label: 'Match', duration_s: 600, secondary_clock: { active: false } }],
  overtime: [],
  phases: [
    { label: 'No points', boundary_s: 0, notify_on_entry: false },
    { label: 'Full scoring', boundary_s: 300, notify_on_entry: true },
  ],
  scoring: { min: -99, max: 99, allow_negative_total: true },
  main_clock: { warning_at_s: 5 },
  secondary_clock: NO_SECONDARY,
  action_grouping: { enabled: false, window_ms: 0 },
  f1: { role: ROLE.COUNTER, label: 'Warnings', led_colour: LED.CREDIT },
  f2: { role: ROLE.COUNTER, label: 'Negative points', led_colour: LED.AGAINST },
  counters: [
    { id: 'f1', ladder_steps: ['1st warning', '2nd warning', '3rd warning'], display_only: true },
    { id: 'f2', ladder_steps: [], display_only: true },
  ],
  tiebreak_criteria: ['Points', 'Negative points', 'Referee decision'],
};

const NOGI = {
  id: 'nogi',
  name: 'No-gi (NAGA / JJWL)',
  version: 'current',
  derived_from: 'ibjjf',
  periods: [{ label: 'Match', duration_s: 300, secondary_clock: { active: false } }],
  overtime: [],
  phases: [],
  scoring: { min: 0, max: 99, allow_negative_total: false },
  main_clock: { warning_at_s: 5 },
  secondary_clock: NO_SECONDARY,
  action_grouping: { enabled: false, window_ms: 0 },
  f1: { role: ROLE.COUNTER, label: 'Advantages', led_colour: LED.CREDIT },
  f2: { role: ROLE.COUNTER, label: 'Penalties', led_colour: LED.AGAINST },
  counters: [
    { id: 'f1', ladder_steps: [], display_only: true },
    { id: 'f2', ladder_steps: [], display_only: true },
  ],
  tiebreak_criteria: ['Points', 'Advantages', 'Penalties'],
};

export const RULESETS = [NFHS, NCAA, FREESTYLE, GRECO, IBJJF, SJJIF, ADCC, NOGI];

export const DEFAULT_RULESET_ID = 'nfhs';

export function getRuleset(id) {
  return RULESETS.find((r) => r.id === id) ?? RULESETS.find((r) => r.id === DEFAULT_RULESET_ID);
}

// ---------------------------------------------------------------------------
// Derived views. Regulation and overtime are one ordered list to the reducer:
// FORWARD advances through it and nothing in the input model distinguishes a
// period from an overtime round.
// ---------------------------------------------------------------------------

export function allPeriods(ruleset) {
  return [
    ...ruleset.periods.map((p) => ({ ...p, overtime: false })),
    ...ruleset.overtime.map((p) => ({ ...p, overtime: true })),
  ];
}

export function periodAt(ruleset, index) {
  const periods = allPeriods(ruleset);
  return periods[Math.min(Math.max(index, 0), periods.length - 1)];
}

export function functionSlot(ruleset, slot) {
  return slot === 'f1' ? ruleset.f1 : ruleset.f2;
}

/** The slot a secondary clock is bound to, or null. Only ever one. */
export function secondaryClockSlot(ruleset) {
  if (!ruleset.secondary_clock.enabled) return null;
  if (ruleset.f1.role === ROLE.SECONDARY_CLOCK) return 'f1';
  if (ruleset.f2.role === ROLE.SECONDARY_CLOCK) return 'f2';
  return null;
}

export function counterLadder(ruleset, slot) {
  return ruleset.counters.find((c) => c.id === slot)?.ladder_steps ?? [];
}

/**
 * Where a counter sits on its ladder, for display. Returns null when the
 * counter has no ladder or is at zero. The system displays the position; the
 * referee applies the consequence (SCOPE.md §7.2).
 */
export function ladderPosition(ruleset, slot, count) {
  const steps = counterLadder(ruleset, slot);
  if (count <= 0 || steps.length === 0) return null;
  return steps[Math.min(count, steps.length) - 1];
}

/** The phase containing `elapsedSeconds`, or null where a ruleset has none. */
export function phaseAt(ruleset, elapsedSeconds) {
  if (ruleset.phases.length === 0) return null;
  let current = ruleset.phases[0];
  for (const phase of ruleset.phases) {
    if (elapsedSeconds >= phase.boundary_s) current = phase;
  }
  return current;
}

export function phaseIndexAt(ruleset, elapsedSeconds) {
  const phase = phaseAt(ruleset, elapsedSeconds);
  return phase ? ruleset.phases.indexOf(phase) : -1;
}
