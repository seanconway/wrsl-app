// The clock of record (FS §8.1).
//
// Three requirements, none negotiable:
//
//   1. Derived from monotonic elapsed-time measurement, NEVER from accumulated
//      timer ticks. A running clock is stored as a remaining value plus the
//      monotonic reading it was true at; the displayed value is computed by
//      subtraction on every render. Rendering may stutter; the value cannot
//      drift, because nothing accumulates.
//
//   2. Immune to wall-clock changes. `performance.now()` is monotonic and is
//      unaffected by NTP corrections, DST transitions, or an operator setting
//      the system clock mid-match. Date.now() is read ONLY as the corroborating
//      witness in `detectDiscontinuity` — never to compute a clock value.
//
//   3. Discontinuities detected and surfaced, not absorbed. If the two time
//      sources disagree by more than the tolerance, the match halts and asks.
//
// Everything here is pure. `now` is passed in so tests do not need fake timers
// and so a persisted match can be rehydrated against a fresh monotonic origin.

export function monotonicNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** A stopped clock holding `durationMs`. */
export function createClock(durationMs) {
  return { remainingMs: durationMs, running: false, refMono: null };
}

/** Remaining milliseconds at `now`, clamped at zero. The only read path. */
export function remainingMs(clock, now) {
  if (!clock.running) return Math.max(0, clock.remainingMs);
  return Math.max(0, clock.remainingMs - (now - clock.refMono));
}

export function hasExpired(clock, now) {
  return remainingMs(clock, now) <= 0;
}

export function startClock(clock, now) {
  if (clock.running) return clock;
  if (remainingMs(clock, now) <= 0) return clock; // an expired clock does not restart itself
  return { ...clock, running: true, refMono: now };
}

export function stopClock(clock, now) {
  if (!clock.running) return clock;
  return { remainingMs: remainingMs(clock, now), running: false, refMono: null };
}

/** Re-anchors a running clock at `now` without changing its value. Used after
 *  any edit to a running clock, so the reference and the value stay coherent. */
export function reanchor(clock, now) {
  if (!clock.running) return clock;
  return { ...clock, remainingMs: remainingMs(clock, now), refMono: now };
}

/**
 * Adjusts the remaining time by `deltaMs`, keeping the clock's run state.
 * Clamped at zero and at `maxMs` — a referee holding FORWARD should stop at the
 * period's full duration rather than running the clock past it.
 */
export function adjustClock(clock, deltaMs, now, maxMs = Infinity) {
  const current = remainingMs(clock, now);
  const next = Math.min(Math.max(0, current + deltaMs), maxMs);
  return clock.running
    ? { remainingMs: next, running: next > 0, refMono: now }
    : { remainingMs: next, running: false, refMono: null };
}

/** Resets to `durationMs`, stopped. Reset is always a deliberate hold. */
export function resetClock(durationMs) {
  return createClock(durationMs);
}

// ---------------------------------------------------------------------------
// A count-up accumulator, for riding time. Same monotonic discipline, opposite
// direction, and it accrues only while it is BOTH owned and running.
// ---------------------------------------------------------------------------

export function createAccumulator() {
  return { accruedMs: 0, running: false, refMono: null };
}

export function accruedMs(acc, now) {
  if (!acc.running) return acc.accruedMs;
  return acc.accruedMs + (now - acc.refMono);
}

export function startAccrual(acc, now) {
  if (acc.running) return acc;
  return { ...acc, running: true, refMono: now };
}

export function stopAccrual(acc, now) {
  if (!acc.running) return acc;
  return { accruedMs: accruedMs(acc, now), running: false, refMono: null };
}

/**
 * Adjusts accrued time by `deltaMs`, keeping the accumulator's run state.
 * Clamped at zero — mirrors adjustClock() for the opposite (count-up)
 * direction, used to correct riding time when the main clock is wound back
 * or forward over an interval the accumulator was also live for.
 */
export function adjustAccrual(acc, deltaMs, now, maxMs = Infinity) {
  const current = accruedMs(acc, now);
  const next = Math.min(Math.max(0, current + deltaMs), maxMs);
  return acc.running
    ? { accruedMs: next, running: true, refMono: now }
    : { accruedMs: next, running: false, refMono: null };
}

// ---------------------------------------------------------------------------
// Discontinuity detection
// ---------------------------------------------------------------------------

/**
 * A machine that suspends mid-match stops `performance.now()` on some
 * platforms and not on others, and a wall-clock correction moves `Date.now()`
 * under a running match. Either way the two sources diverge, and the divergence
 * is the signal.
 *
 * `witness` is `{ mono, wall }` captured at the previous observation. Returns
 * the divergence in milliseconds when it exceeds `toleranceMs`, otherwise null.
 *
 * FS §8.1 requires the clock to HALT on detection and require explicit referee
 * confirmation, rather than silently absorbing the gap. A match that quietly
 * loses forty seconds is worse than one that stops and says so.
 */
export function detectDiscontinuity(witness, now, wallNow, toleranceMs = 2000) {
  if (!witness) return null;
  const monoDelta = now - witness.mono;
  const wallDelta = wallNow - witness.wall;
  const divergence = wallDelta - monoDelta;
  return Math.abs(divergence) > toleranceMs ? Math.round(divergence) : null;
}

export function captureWitness(now, wallNow) {
  return { mono: now, wall: wallNow };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** `M:SS` — seconds zero-padded, minutes never (design system content rules). */
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** `MM:SS` — fully padded, for secondary clocks and differentials. */
export function formatPadded(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
