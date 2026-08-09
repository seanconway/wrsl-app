import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeDongleTransport } from '../transport/FakeDongleTransport.js';
import {
  DongleService,
  PING_INTERVAL_MS,
  LINK_STALE_MS,
  HEARTBEAT_INTERVAL_MS,
  BEAT_SUPPRESSION_MS,
  BEAT_SUPPRESSION_MAX_MS,
} from './DongleService.js';
import {
  matchReducer,
  createInitialMatchState,
  selectIndicators,
  isInertInput,
  NOTIFY,
} from '../match/matchReducer.js';

const HELLO = 'HELLO 3.0 0.2.0 RR-0147 0';

/**
 * A harness that wires a real match reducer to the service, because the two
 * are only correct together: the service's acknowledgement decision depends on
 * the ruleset's inert bindings, and its indicator assertion depends on match
 * state. Testing the service against a stub reducer would test a shape the
 * application does not have.
 */
function harness({ rulesetId = 'ncaa' } = {}) {
  const transport = new FakeDongleTransport();
  const logs = [];
  let clock = 1000;
  let state = createInitialMatchState(rulesetId, { now: clock });

  const dispatch = (action) => {
    state = matchReducer(state, action);
  };

  const service = new DongleService(transport, {
    dispatch,
    getMatchState: () => state,
    selectIndicators: () => selectIndicators(state),
    isInertInput,
    onLog: (msg) => logs.push(msg),
    now: () => clock,
  });

  return {
    transport,
    service,
    logs,
    get state() {
      return state;
    },
    dispatch,
    advance(ms) {
      clock += ms;
      vi.advanceTimersByTime(ms);
    },
    setClock(ms) {
      clock = ms;
    },
    async connectAndHandshake() {
      await service.connect();
      transport.simulateLine(HELLO);
      transport.outbox.length = 0;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

// ---------------------------------------------------------------------------

describe('handshake', () => {
  it('sends INFO on connect', async () => {
    const h = harness();
    await h.service.connect();
    expect(h.transport.outbox).toEqual(['INFO']);
  });

  it('sends CFG then a STATE line per remote, unprompted', async () => {
    // Steps 3 and 4 of PROTOCOL.md §4.2. Asserting state unprompted is what
    // makes a mid-match set substitution a physical swap and nothing more.
    const h = harness();
    await h.service.connect();
    h.transport.outbox.length = 0;
    h.transport.simulateLine(HELLO);

    expect(h.transport.outbox).toEqual([
      'CFG BOTH 80 70',
      'STATE RED OFF 000000 OFF 000000',
      'STATE GREEN OFF 000000 OFF 000000',
    ]);
    expect(h.service.handshakeState).toBe('ready');
  });

  it('records the officiating set identity', async () => {
    const h = harness();
    await h.connectAndHandshake();
    expect(h.service.identity).toEqual({ proto: '3.0', fw: '0.2.0', set: 'RR-0147', caps: 0 });
  });

  it('refuses a different major protocol version', async () => {
    const h = harness();
    await h.service.connect();
    h.transport.simulateLine('HELLO 2.0 0.1.0 RR-0147 0');
    expect(h.service.handshakeState).toBe('refused');
    expect(h.logs.join()).toMatch(/update the dongle firmware/i);
  });

  it('warns and continues on a differing minor version', async () => {
    const h = harness();
    await h.service.connect();
    h.transport.simulateLine('HELLO 3.1 0.3.0 RR-0147 0');
    expect(h.service.handshakeState).toBe('ready');
    expect(h.logs.join()).toMatch(/minor version/i);
  });

  it('starts the PING cadence at 1 s', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.advance(PING_INTERVAL_MS * 3);
    expect(h.transport.outbox.filter((l) => l === 'PING')).toHaveLength(3);
  });
});

describe('set substitution', () => {
  it('records a substitution and re-asserts state when the set serial changes', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.dispatch({ type: 'INPUT', button: 'ADD_POINT', gesture: 'PRESS', src: 'RED', now: 1000 });
    h.transport.outbox.length = 0;

    h.transport.simulateLine('HELLO 3.0 0.2.0 RR-0203 0');

    // Match state is fully retained across a change of connected dongle; the
    // referee re-enters nothing (FS §8.6).
    expect(h.state.score.RED).toBe(1);
    expect(h.state.log.some((e) => e.type === 'SET_SUBSTITUTION')).toBe(true);
    expect(h.transport.outbox).toContain('STATE RED OFF 000000 OFF 000000');
    expect(h.logs.join()).toMatch(/RR-0147 → RR-0203/);
  });
});

describe('EVT handling', () => {
  it('applies a press through the match reducer and acknowledges it', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 17');

    expect(h.state.score.RED).toBe(1);
    expect(h.transport.outbox).toContain('ACK 17');
  });

  it('acknowledges an inert button SILENT and changes nothing', async () => {
    // NFHS leaves F1 inert. Fully inert: no action, no haptic, no indicator.
    const h = harness({ rulesetId: 'nfhs' });
    await h.connectAndHandshake();
    const before = h.state;
    h.transport.simulateLine('EVT F1 PRESS RED 5');

    expect(h.state).toBe(before);
    expect(h.transport.outbox).toContain('ACK 5 SILENT');
  });

  it('drops a duplicate seq but still acknowledges it', async () => {
    // Applying a duplicate corrupts the score with no external indication.
    // Withholding the tap would make the referee press a third time.
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 17');
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 17');

    expect(h.state.score.RED).toBe(1);
    expect(h.transport.outbox.filter((l) => l === 'ACK 17')).toHaveLength(2);
    expect(h.service.counters.duplicates).toBe(1);
  });

  it('counts a sequence gap', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 10');
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 13');

    // 11 and 12 never arrived: two missing, not three.
    expect(h.service.counters.seqGaps).toBe(1);
    expect(h.logs.join()).toMatch(/expected 11, got 13 \(2 missing\)/);
  });

  it('treats a wrapped counter as a wrap, not a gap of 65000 presses', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 65535');
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 0');
    expect(h.service.counters.seqGaps).toBe(0);
  });

  it('carries the gesture through to the reducer', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT TOGGLE_CLOCK PRESS RED 1');
    expect(h.state.clock.running).toBe(true);
    h.transport.simulateLine('EVT TOGGLE_CLOCK HOLD RED 2');
    expect(h.state.clock.running).toBe(false);
  });

  it('records acknowledgement latency', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT PRESS RED 1');
    expect(h.service.counters.ackLatencyP99Ms).not.toBeNull();
  });
});

describe('indicator assertion', () => {
  it('asserts state when a remote JOINs, unconditionally', async () => {
    // Not "if something changed" — a newly-arrived remote's idea of its own
    // indicators is "off", and the app's cached idea of it may be "solid".
    const h = harness();
    await h.connectAndHandshake();
    h.transport.outbox.length = 0;

    h.transport.simulateLine('JOIN RED');
    expect(h.transport.outbox).toContain('STATE RED OFF 000000 OFF 000000');
  });

  it('reflects secondary-clock ownership', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1');
    h.transport.outbox.length = 0;
    h.service.assertIndicators({ force: true });

    expect(h.transport.outbox).toContain('STATE RED SOLID 00A0FF OFF 000000');
    expect(h.transport.outbox).toContain('STATE GREEN OFF 000000 OFF 000000');
  });

  it('sends nothing when nothing changed', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.service.assertIndicators();
    h.transport.outbox.length = 0;
    h.service.assertIndicators();
    expect(h.transport.outbox).toEqual([]);
  });

  it('renders a counter binary — off at zero, solid when non-zero', async () => {
    const h = harness({ rulesetId: 'ibjjf' });
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F2 PRESS GREEN 1');
    h.transport.outbox.length = 0;
    h.service.assertIndicators({ force: true });
    expect(h.transport.outbox).toContain('STATE GREEN OFF 000000 SOLID F5A300');
  });
});

describe('heartbeat', () => {
  it('beats on the owning remote only, once per second, while accruing', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1'); // assign riding time to red
    h.transport.simulateLine('EVT TOGGLE_CLOCK PRESS RED 2'); // start the main clock
    h.transport.outbox.length = 0;

    // Past the burst-suppression window, then three beats.
    h.advance(BEAT_SUPPRESSION_MS + HEARTBEAT_INTERVAL_MS * 3);
    const beats = h.transport.outbox.filter((l) => l.startsWith('HAP'));
    expect(beats.every((l) => l === 'HAP RED BEAT')).toBe(true);
    expect(beats.length).toBeGreaterThanOrEqual(2);
  });

  it('does not beat while the main clock is stopped, even with an owner', async () => {
    // Ownership is retained across the pause; the beat is what carries the
    // running/paused distinction, not the LED.
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1');
    h.transport.outbox.length = 0;

    h.advance(HEARTBEAT_INTERVAL_MS * 3);
    expect(h.transport.outbox.filter((l) => l.includes('BEAT'))).toEqual([]);
  });

  it('suppresses the beat during an input burst', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1');
    h.transport.simulateLine('EVT TOGGLE_CLOCK PRESS RED 2');
    h.advance(HEARTBEAT_INTERVAL_MS * 2);
    h.transport.outbox.length = 0;

    // A scoring burst spanning a beat tick. The referee counts acknowledgement
    // taps by feel, and a heartbeat inside the burst is what would be
    // miscounted into a wrong near fall.
    for (let i = 0; i < 8; i += 1) {
      h.transport.simulateLine(`EVT ADD_POINT PRESS RED ${10 + i}`);
      h.advance(150);
    }

    expect(h.transport.outbox.filter((l) => l.includes('BEAT'))).toEqual([]);
    expect(h.service.counters.beatsSuppressed).toBeGreaterThan(0);
  });

  it('resumes the beat under sustained input rather than going silent forever', async () => {
    // A hold-repeat at 150 ms must not be able to silence the beat: a missing
    // beat reads as "accrual stopped", and that is a lie the referee cannot
    // detect.
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1');
    h.transport.simulateLine('EVT TOGGLE_CLOCK PRESS RED 2');
    h.advance(HEARTBEAT_INTERVAL_MS * 2);
    h.transport.outbox.length = 0;

    let seq = 100;
    for (let elapsed = 0; elapsed < BEAT_SUPPRESSION_MAX_MS + HEARTBEAT_INTERVAL_MS * 2; elapsed += 150) {
      h.transport.simulateLine(`EVT FORWARD HOLD_REP RED ${(seq += 1)}`);
      h.advance(150);
    }

    expect(h.transport.outbox.filter((l) => l.includes('BEAT')).length).toBeGreaterThan(0);
  });
});

describe('notifications', () => {
  it('maps reducer notifications to waveforms and reports what it sent', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.outbox.length = 0;

    const sent = h.service.sendNotifications([
      { id: 1, kind: NOTIFY.MAIN_WARNING },
      { id: 2, kind: NOTIFY.PERIOD_EXPIRED },
      { id: 3, kind: NOTIFY.SECONDARY_EXPIRED },
      { id: 4, kind: NOTIFY.PHASE_ENTERED },
    ]);

    expect(h.transport.outbox).toEqual(['HAP BOTH WARN', 'HAP BOTH LONG', 'HAP BOTH BUZZ', 'HAP BOTH DOUBLE']);
    expect(sent).toEqual([1, 2, 3, 4]);
  });
});

describe('supervision', () => {
  it('marks the link stale after 2.5 s of silence', async () => {
    const h = harness();
    await h.connectAndHandshake();
    expect(h.service.isStale).toBe(false);
    h.advance(LINK_STALE_MS + 50);
    expect(h.service.isStale).toBe(true);
  });

  it('clears staleness on any received line', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.advance(LINK_STALE_MS + 50);
    h.transport.simulateLine('PONG');
    expect(h.service.isStale).toBe(false);
  });

  it('stops every timer on disconnect', async () => {
    const h = harness();
    await h.connectAndHandshake();
    await h.service.disconnect();
    h.transport.outbox.length = 0;
    h.advance(PING_INTERVAL_MS * 5);
    expect(h.transport.outbox).toEqual([]);
  });

  it('reports both remotes disconnected on transport loss', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('LINK RED CONNECTED -50 90');
    expect(h.service.linkStatus.RED.state).toBe('CONNECTED');

    h.transport.simulateDisconnect();
    expect(h.service.linkStatus.RED.state).toBe('DISCONNECTED');
    expect(h.service.linkStatus.GREEN.state).toBe('DISCONNECTED');
    expect(h.service.handshakeState).toBe('disconnected');
  });
});

describe('reconnect', () => {
  it('re-runs the handshake from scratch and re-asserts indicator state', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT F1 PRESS RED 1');

    h.transport.simulateDisconnect();
    await h.service.connect();
    h.transport.outbox.length = 0;
    h.transport.simulateLine(HELLO);

    // "From scratch" on the wire is not "from scratch" for the match: the
    // indicator lines carry the state the reducer still holds.
    expect(h.transport.outbox).toContain('STATE RED SOLID 00A0FF OFF 000000');
  });

  it('does not leak a second PING cadence across ten reconnects', async () => {
    const h = harness();
    for (let i = 0; i < 10; i += 1) {
      await h.service.connect();
      h.transport.simulateLine(HELLO);
      h.transport.simulateDisconnect();
    }
    await h.service.connect();
    h.transport.simulateLine(HELLO);
    h.transport.outbox.length = 0;

    h.advance(PING_INTERVAL_MS);
    expect(h.transport.outbox.filter((l) => l === 'PING')).toHaveLength(1);
  });
});

describe('malformed input', () => {
  it('ignores an unknown keyword silently', async () => {
    const h = harness();
    await h.connectAndHandshake();
    const before = h.logs.length;
    h.transport.simulateLine('BOGUS THING');
    expect(h.logs).toHaveLength(before);
  });

  it('logs a known keyword with bad arguments and applies nothing', async () => {
    const h = harness();
    await h.connectAndHandshake();
    h.transport.simulateLine('EVT ADD_POINT RED 17');
    expect(h.state.score.RED).toBe(0);
    expect(h.logs.join()).toMatch(/malformed line ignored/);
  });
});

describe('raw send', () => {
  it('refuses to send while disconnected', () => {
    const h = harness();
    expect(h.service.sendRaw('TEST 1')).toBe(false);
  });

  it('sends verbatim once ready', async () => {
    const h = harness();
    await h.connectAndHandshake();
    expect(h.service.sendRaw('  TEST 4  ')).toBe(true);
    expect(h.transport.outbox).toContain('TEST 4');
  });
});
