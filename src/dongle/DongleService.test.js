import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DongleService, PING_INTERVAL_MS, LINK_STALE_MS } from './DongleService.js';
import { FakeDongleTransport } from '../transport/FakeDongleTransport.js';
import { scoreboardReducer, createInitialScoreboardState } from '../scoreboard/scoreboardReducer.js';

function createHarness() {
  const transport = new FakeDongleTransport();
  let state = createInitialScoreboardState();
  const events = { logs: [], linkChanges: [], staleChanges: [], handshake: [] };

  let service;
  const dispatch = (action) => {
    state = scoreboardReducer(state, action);
    service.syncScoreboardState(state);
  };

  service = new DongleService(transport, {
    dispatch,
    onLog: (msg) => events.logs.push(msg),
    onLinkChange: (remote, status) => events.linkChanges.push({ remote, status }),
    onStaleChange: (stale) => events.staleChanges.push(stale),
    onHandshakeStateChange: (hs) => events.handshake.push(hs),
  });
  service.syncScoreboardState(state); // prime — first call never emits

  return { transport, service, events, getState: () => state, dispatch };
}

async function handshake(harness, proto = '2.0') {
  await harness.service.connect();
  harness.transport.simulateLine(`HELLO ${proto} 0.1.0 0`);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('connection lifecycle (§8)', () => {
  it('1. sends INFO on connect; on HELLO 2.0, sends CLOCK STOP and starts the PING cadence', async () => {
    const h = createHarness();
    await h.service.connect();
    expect(h.transport.outbox).toEqual(['INFO']);

    h.transport.simulateLine('HELLO 2.0 0.1.0 0');
    expect(h.transport.outbox).toEqual(['INFO', 'CLOCK STOP']);
    expect(h.service.handshakeState).toBe('ready');

    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(h.transport.outbox).toEqual(['INFO', 'CLOCK STOP', 'PING']);

    vi.advanceTimersByTime(PING_INTERVAL_MS);
    expect(h.transport.outbox).toEqual(['INFO', 'CLOCK STOP', 'PING', 'PING']);
  });

  it('2. a major version mismatch (HELLO 3.0) refuses to operate', async () => {
    const h = createHarness();
    await h.service.connect();
    h.transport.simulateLine('HELLO 3.0 0.1.0 0');

    expect(h.service.handshakeState).toBe('refused');
    expect(h.transport.outbox).toEqual(['INFO']); // no CLOCK STOP, no PING started
    vi.advanceTimersByTime(PING_INTERVAL_MS * 2);
    expect(h.transport.outbox).toEqual(['INFO']);
  });

  it('3. a minor version mismatch (HELLO 2.1) warns but continues operating', async () => {
    const h = createHarness();
    await h.service.connect();
    h.transport.simulateLine('HELLO 2.1 0.1.0 0');

    expect(h.service.handshakeState).toBe('ready');
    expect(h.transport.outbox).toEqual(['INFO', 'CLOCK STOP']);
    expect(h.events.logs.some((l) => l.includes('WARN'))).toBe(true);
  });

  it('17. disconnect then reconnect re-runs the full handshake and does not double-apply prior events', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.simulateLine('EVT ADD_POINT RED 17');
    expect(h.getState().redScore).toBe(1);

    await h.service.disconnect();
    expect(h.service.handshakeState).toBe('disconnected');

    h.transport.outbox.length = 0;
    await handshake(h);
    expect(h.transport.outbox).toEqual(['INFO', 'CLOCK STOP']);
    expect(h.getState().redScore).toBe(1); // not replayed / not doubled

    // seq counter reset on reconnect: seq 17 again is not a "gap"
    h.transport.simulateLine('EVT ADD_POINT RED 17');
    expect(h.getState().redScore).toBe(2);
    expect(h.events.logs.some((l) => l.includes('gap'))).toBe(false);
  });
});

describe('EVT -> scoreboard mapping (§3.1) and CONFIRM (§6)', () => {
  it('4. EVT ADD_POINT RED 17 increments red by exactly one and writes CONFIRM 17', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.transport.simulateLine('EVT ADD_POINT RED 17');
    expect(h.getState().redScore).toBe(1);
    expect(h.getState().greenScore).toBe(0);
    expect(h.transport.outbox).toEqual(['CONFIRM 17']);
  });

  it('5. EVT ADD_POINT GREEN 18 affects green, not red', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.transport.simulateLine('EVT ADD_POINT GREEN 18');
    expect(h.getState().greenScore).toBe(1);
    expect(h.getState().redScore).toBe(0);
    expect(h.transport.outbox).toEqual(['CONFIRM 18']);
  });

  it('6. EVT REMOVE_POINT RED decrements and confirms', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.simulateLine('EVT ADD_POINT RED 17');
    h.transport.outbox.length = 0;

    h.transport.simulateLine('EVT REMOVE_POINT RED 19');
    expect(h.getState().redScore).toBe(0);
    expect(h.transport.outbox).toEqual(['CONFIRM 19']);
  });

  it('7. EVT TOGGLE_TIMER GREEN starts the clock; a second toggle stops it; no CONFIRM either time', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.transport.simulateLine('EVT TOGGLE_TIMER GREEN 20');
    expect(h.getState().isRunning).toBe(true);
    expect(h.transport.outbox).toEqual(['CLOCK RUN']);

    h.transport.simulateLine('EVT TOGGLE_TIMER GREEN 21');
    expect(h.getState().isRunning).toBe(false);
    expect(h.transport.outbox).toEqual(['CLOCK RUN', 'CLOCK STOP']);
  });

  it('8. TIME_UP / TIME_DOWN / PERIOD_UP / PERIOD_DOWN adjust the correct value', async () => {
    const h = createHarness();
    await handshake(h);

    h.transport.simulateLine('EVT TIME_UP RED 22');
    expect(h.getState().periodTimes[0]).toBe(121);

    h.transport.simulateLine('EVT TIME_DOWN RED 23');
    expect(h.getState().periodTimes[0]).toBe(120);

    h.transport.simulateLine('EVT PERIOD_UP RED 24');
    expect(h.getState().currentPeriod).toBe(1);

    h.transport.simulateLine('EVT PERIOD_DOWN RED 25');
    expect(h.getState().currentPeriod).toBe(0);
  });
});

describe('outbound clock messages (§4, §5)', () => {
  it('9. starting the timer writes CLOCK RUN, stopping writes CLOCK STOP — exactly one line per transition, no per-second traffic', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.dispatch({ type: 'TOGGLE_TIMER' });
    expect(h.transport.outbox).toEqual(['CLOCK RUN']);

    // Simulate several clock ticks while running: no per-second wire traffic.
    h.dispatch({ type: 'TICK', deltaSeconds: 1 });
    h.dispatch({ type: 'TICK', deltaSeconds: 1 });
    h.dispatch({ type: 'TICK', deltaSeconds: 1 });
    expect(h.transport.outbox).toEqual(['CLOCK RUN']);

    h.dispatch({ type: 'TOGGLE_TIMER' });
    expect(h.transport.outbox).toEqual(['CLOCK RUN', 'CLOCK STOP']);
  });

  it('10. period reaching zero writes EXPIRE', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.dispatch({ type: 'TOGGLE_TIMER' }); // CLOCK RUN
    h.dispatch({ type: 'TICK', deltaSeconds: 120 }); // exhausts the 120s period
    expect(h.getState().periodTimes[0]).toBe(0);
    expect(h.transport.outbox).toEqual(['CLOCK RUN', 'CLOCK STOP', 'EXPIRE']);
  });
});

describe('sequence-gap detection (§3.1)', () => {
  it('11. a sequence gap logs a warning and the event is still applied', async () => {
    const h = createHarness();
    await handshake(h);

    h.transport.simulateLine('EVT ADD_POINT RED 17');
    h.transport.simulateLine('EVT ADD_POINT RED 19');

    expect(h.getState().redScore).toBe(2);
    expect(h.events.logs.some((l) => l.includes('gap') && l.includes('19'))).toBe(true);
  });

  it('12. sequence wrap 998 -> 999 -> 0 does not log a spurious gap warning', async () => {
    const h = createHarness();
    await handshake(h);

    h.transport.simulateLine('EVT ADD_POINT RED 998');
    h.transport.simulateLine('EVT ADD_POINT RED 999');
    h.transport.simulateLine('EVT ADD_POINT RED 0');

    expect(h.getState().redScore).toBe(3);
    expect(h.events.logs.some((l) => l.includes('gap'))).toBe(false);
  });
});

describe('LINK handling (§3.2)', () => {
  it('13. LINK RED CONNECTED updates state/rssi/batt; DISCONNECTED clears them', async () => {
    const h = createHarness();
    await handshake(h);

    h.transport.simulateLine('LINK RED CONNECTED -52 87');
    expect(h.service.linkStatus.RED).toEqual({ state: 'CONNECTED', rssi: -52, batt: 87 });

    h.transport.simulateLine('LINK RED DISCONNECTED');
    expect(h.service.linkStatus.RED).toEqual({ state: 'DISCONNECTED', rssi: null, batt: null });
  });
});

describe('link supervision (§5.1)', () => {
  it('14. 5s with no inbound line marks the link stale; a subsequent line clears it', async () => {
    const h = createHarness();
    await handshake(h);

    expect(h.service.isStale).toBe(false);
    vi.advanceTimersByTime(LINK_STALE_MS);
    expect(h.service.isStale).toBe(true);
    expect(h.events.staleChanges.at(-1)).toBe(true);

    h.transport.simulateLine('PONG');
    expect(h.service.isStale).toBe(false);
    expect(h.events.staleChanges.at(-1)).toBe(false);
  });

  it('15. PING is written every 2s while idle', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    vi.advanceTimersByTime(PING_INTERVAL_MS * 3);
    expect(h.transport.outbox).toEqual(['PING', 'PING', 'PING']);
  });
});

describe('raw command sending (§7.2, §7.3)', () => {
  it('sends a line verbatim once connected, and records it in the debug log', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    expect(h.service.sendRaw('TEST 1')).toBe(true);
    expect(h.transport.outbox).toEqual(['TEST 1']);
    expect(h.service.debugLog.at(-1)).toMatchObject({ dir: 'TX', line: 'TEST 1' });
  });

  it('trims surrounding whitespace and ignores an empty command', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    expect(h.service.sendRaw('  TEST 0  ')).toBe(true);
    expect(h.service.sendRaw('   ')).toBe(false);
    expect(h.transport.outbox).toEqual(['TEST 0']);
  });

  it('refuses to send while disconnected rather than throwing at the transport', () => {
    const h = createHarness();
    expect(h.service.sendRaw('TEST 1')).toBe(false);
    expect(h.transport.outbox).toEqual([]);
  });

  it('passes malformed lines through unaltered — that is how the firmware §2.2 path gets exercised', async () => {
    const h = createHarness();
    await handshake(h);
    h.transport.outbox.length = 0;

    h.service.sendRaw('BOGUS FOO BAR');
    expect(h.transport.outbox).toEqual(['BOGUS FOO BAR']);
  });
});

describe('malformed input (§2.2)', () => {
  it('16. malformed lines are ignored without crashing, and a valid line right after is still processed', async () => {
    const h = createHarness();
    await handshake(h);

    expect(() => h.transport.simulateLine('BOGUS FOO')).not.toThrow();
    expect(() => h.transport.simulateLine('EVT ADD_POINT')).not.toThrow();
    expect(() => h.transport.simulateLine('EVT ADD_POINT RED xyz')).not.toThrow();

    expect(h.getState().redScore).toBe(0);
    expect(h.events.logs.some((l) => l.includes('malformed'))).toBe(true);

    h.transport.simulateLine('EVT ADD_POINT RED 17');
    expect(h.getState().redScore).toBe(1);
  });
});
