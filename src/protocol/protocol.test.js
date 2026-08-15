import { describe, it, expect } from 'vitest';
import {
  createLineAssembler,
  parseLine,
  encodeAck,
  encodeState,
  encodeHap,
  encodeCfg,
  encodeHello,
  encodeEvt,
  encodeLink,
  encodeJoin,
  encodeTest,
  normaliseColour,
  nextSeq,
  seqDistance,
  SEQ_MODULUS,
  BUTTONS,
  GESTURES,
  WAVEFORMS,
} from './protocol.js';

// ---------------------------------------------------------------------------
// PROTOCOL.md §14 — the parser test cases, in order.
// ---------------------------------------------------------------------------

function pushAll(assembler, chunks) {
  return chunks.flatMap((chunk) => assembler.push(chunk));
}

describe('PROTOCOL.md §14 parser cases', () => {
  it('T1 parses a complete line', () => {
    const a = createLineAssembler();
    expect(a.push('EVT ADD_POINT PRESS RED 17\n')).toEqual(['EVT ADD_POINT PRESS RED 17']);
    expect(parseLine('EVT ADD_POINT PRESS RED 17')).toEqual({
      type: 'EVT',
      button: 'ADD_POINT',
      gesture: 'PRESS',
      src: 'RED',
      seq: 17,
    });
  });

  it('T2 strips a trailing carriage return', () => {
    const a = createLineAssembler();
    expect(a.push('EVT ADD_POINT PRESS RED 17\r\n')).toEqual(['EVT ADD_POINT PRESS RED 17']);
  });

  it('T3 parses identically one byte per read', () => {
    const a = createLineAssembler();
    const bytes = [...'EVT ADD_POINT PRESS RED 17\n'];
    expect(pushAll(a, bytes)).toEqual(['EVT ADD_POINT PRESS RED 17']);
  });

  it('T4 parses three lines from a single read, in order', () => {
    const a = createLineAssembler();
    expect(a.push('PONG\nEVT F1 PRESS GREEN 3\nLINK RED CONNECTED -50 90\n')).toEqual([
      'PONG',
      'EVT F1 PRESS GREEN 3',
      'LINK RED CONNECTED -50 90',
    ]);
  });

  it('T5 reassembles a line split mid-token across two reads', () => {
    const a = createLineAssembler();
    expect(pushAll(a, ['EVT ADD_PO', 'INT PRESS RED 17\n'])).toEqual(['EVT ADD_POINT PRESS RED 17']);
  });

  it('T6 ignores an unknown keyword without crashing', () => {
    expect(parseLine('BOGUS FOO BAR')).toBeNull();
  });

  it('T7 rejects the v2.0 gestureless EVT shape — it must fail closed', () => {
    const parsed = parseLine('EVT ADD_POINT RED 17');
    expect(parsed.type).toBe('INVALID');
    expect(parsed.keyword).toBe('EVT');
  });

  it('T8 rejects a non-numeric seq', () => {
    expect(parseLine('EVT ADD_POINT PRESS RED xyz').type).toBe('INVALID');
  });

  it('T9 discards an overlong run and parses the line after its terminator', () => {
    const a = createLineAssembler();
    const overlong = 'X'.repeat(200);
    const lines = pushAll(a, [`${overlong}\n`, 'PONG\n']);
    expect(lines).toEqual(['PONG']);
  });

  it('T9c keeps the discard state across a chunk boundary', () => {
    // A chunk boundary is an artifact of the transport and carries no
    // information about the stream. Resynchronisation happens at the next \n,
    // which may be several reads away.
    const a = createLineAssembler();
    const lines = pushAll(a, ['X'.repeat(80), 'Y'.repeat(80), 'Z'.repeat(80), '\n', 'PONG\n']);
    expect(lines).toEqual(['PONG']);
  });

  it('T10 ignores empty lines', () => {
    const a = createLineAssembler();
    expect(a.push('\n\n\nEVT ADD_POINT PRESS RED 17\n')).toEqual(['EVT ADD_POINT PRESS RED 17']);
  });

  it('T11 rejects a seq past the modulus', () => {
    expect(parseLine('EVT ADD_POINT PRESS RED 65536').type).toBe('INVALID');
    expect(parseLine('EVT ADD_POINT PRESS RED 65535')).toMatchObject({ seq: 65535 });
  });

  it('T12 parses STATE', () => {
    expect(parseLine('STATE RED SOLID BLUE OFF RED')).toEqual({
      type: 'STATE',
      remote: 'RED',
      f1: 'SOLID',
      f1colour: 'BLUE',
      f2: 'OFF',
      f2colour: 'RED',
    });
  });

  it('T13 rejects a colour outside the four-name palette', () => {
    expect(parseLine('STATE RED SOLID ORANGE OFF RED').type).toBe('INVALID');
  });

  it('T14 rejects LINK CONNECTED without rssi', () => {
    // §7 makes rssi mandatory when connected: the signal indicator has no other
    // source, so the short form would present as an indicator that silently
    // never updates.
    expect(parseLine('LINK RED CONNECTED').type).toBe('INVALID');
    expect(parseLine('LINK RED DISCONNECTED')).toMatchObject({ state: 'DISCONNECTED', rssi: null });
  });

  it('T15 rejects an unknown waveform', () => {
    expect(parseLine('HAP BOTH SPIN').type).toBe('INVALID');
    expect(parseLine('HAP BOTH LONG')).toEqual({ type: 'HAP', target: 'BOTH', waveform: 'LONG' });
  });
});

// ---------------------------------------------------------------------------
// Message coverage
// ---------------------------------------------------------------------------

describe('EVT', () => {
  it('accepts every button on every gesture from either remote', () => {
    for (const button of BUTTONS) {
      for (const gesture of GESTURES) {
        for (const src of ['RED', 'GREEN']) {
          expect(parseLine(encodeEvt(button, gesture, src, 1))).toEqual({
            type: 'EVT',
            button,
            gesture,
            src,
            seq: 1,
          });
        }
      }
    }
  });

  it('rejects a button the protocol does not define', () => {
    // TIME_UP and PERIOD_UP were v2.0 actions. They named officiating
    // operations, which is exactly what v3.0 removed.
    expect(parseLine('EVT TIME_UP PRESS RED 1').type).toBe('INVALID');
    expect(parseLine('EVT PERIOD_UP PRESS GREEN 1').type).toBe('INVALID');
  });

  it('rejects an undefined gesture', () => {
    expect(parseLine('EVT F1 DOUBLE_TAP RED 1').type).toBe('INVALID');
  });
});

describe('HELLO', () => {
  it('round-trips with the officiating set serial', () => {
    expect(parseLine(encodeHello('3.0', '0.2.0', 'RR-0147', 0))).toEqual({
      type: 'HELLO',
      proto: '3.0',
      fw: '0.2.0',
      set: 'RR-0147',
      caps: 0,
    });
  });

  it('rejects a v2.0-shaped HELLO with no set serial', () => {
    expect(parseLine('HELLO 2.0 0.1.0 0').type).toBe('INVALID');
  });

  it('rejects a malformed set serial', () => {
    expect(parseLine('HELLO 3.0 0.2.0 rr_0147! 0').type).toBe('INVALID');
  });
});

describe('ACK', () => {
  it('round-trips both forms', () => {
    expect(parseLine(encodeAck(17))).toEqual({ type: 'ACK', seq: 17, silent: false });
    expect(parseLine(encodeAck(17, { silent: true }))).toEqual({ type: 'ACK', seq: 17, silent: true });
  });

  it('rejects an unknown modifier', () => {
    expect(parseLine('ACK 17 LOUD').type).toBe('INVALID');
  });
});

describe('STATE', () => {
  it('always emits the complete state for one remote', () => {
    expect(encodeState('GREEN', { f1: 'SOLID', f1colour: 'green' })).toBe('STATE GREEN SOLID GREEN OFF RED');
  });

  it('is byte-identical for identical state, so it can be deduplicated safely', () => {
    const args = { f1: 'SOLID', f1colour: 'BLUE', f2: 'OFF', f2colour: 'RED' };
    expect(encodeState('RED', args)).toBe(encodeState('RED', { ...args }));
  });
});

describe('normaliseColour', () => {
  it('accepts any casing of a palette name', () => {
    expect(normaliseColour('green')).toBe('GREEN');
    expect(normaliseColour('GREEN')).toBe('GREEN');
  });

  it('falls back to RED for anything outside the palette, rather than a malformed line', () => {
    // Unlike v3.0's hex field there is no "off" value here to fail dark to —
    // visibility is <f1>/<f2>'s job, not this one's — so the fallback only
    // has to be syntactically valid, not meaningful.
    expect(normaliseColour('nope')).toBe('RED');
    expect(normaliseColour(undefined)).toBe('RED');
    expect(normaliseColour('#c2f000')).toBe('RED');
  });
});

describe('HAP and CFG', () => {
  it('round-trips every waveform to every target', () => {
    for (const waveform of WAVEFORMS) {
      for (const target of ['RED', 'GREEN', 'BOTH']) {
        expect(parseLine(encodeHap(target, waveform))).toEqual({ type: 'HAP', target, waveform });
      }
    }
  });

  it('rejects out-of-range CFG values', () => {
    expect(parseLine(encodeCfg('BOTH', 80, 60))).toEqual({ type: 'CFG', target: 'BOTH', haptic: 80, bright: 60 });
    expect(parseLine('CFG BOTH 101 60').type).toBe('INVALID');
    expect(parseLine('CFG BOTH 80 -1').type).toBe('INVALID');
  });
});

describe('LINK and JOIN', () => {
  it('round-trips the connected form with and without battery', () => {
    expect(parseLine(encodeLink('RED', 'CONNECTED', -52, 87))).toEqual({
      type: 'LINK',
      remote: 'RED',
      state: 'CONNECTED',
      rssi: -52,
      batt: 87,
    });
    expect(parseLine(encodeLink('RED', 'CONNECTED', -52, null))).toMatchObject({ rssi: -52, batt: null });
  });

  it('rejects rssi on a disconnected remote', () => {
    expect(parseLine('LINK RED DISCONNECTED -52').type).toBe('INVALID');
  });

  it('rejects an out-of-range battery', () => {
    expect(parseLine('LINK RED CONNECTED -52 101').type).toBe('INVALID');
  });

  it('round-trips JOIN', () => {
    expect(parseLine(encodeJoin('GREEN'))).toEqual({ type: 'JOIN', remote: 'GREEN' });
  });
});

describe('TEST', () => {
  it('round-trips a mode', () => {
    expect(parseLine(encodeTest(4))).toEqual({ type: 'TEST', mode: 4 });
  });
});

// ---------------------------------------------------------------------------
// Sequence helpers
// ---------------------------------------------------------------------------

describe('sequence numbers', () => {
  it('wraps at the modulus', () => {
    expect(nextSeq(SEQ_MODULUS - 1)).toBe(0);
    expect(nextSeq(17)).toBe(18);
  });

  it('measures forward distance across the wrap', () => {
    expect(seqDistance(20, 17)).toBe(3);
    expect(seqDistance(1, SEQ_MODULUS - 1)).toBe(2);
    expect(seqDistance(17, 17)).toBe(0);
  });

  it('gives a large distance for a backwards seq, which is how a wrap is told from a gap', () => {
    expect(seqDistance(17, 20)).toBeGreaterThan(SEQ_MODULUS / 2);
  });
});
