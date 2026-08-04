import { describe, it, expect } from 'vitest';
import {
  createLineAssembler,
  parseLine,
  encodeInfo,
  encodePing,
  encodeEcho,
  encodeClockRun,
  encodeClockStop,
  encodeExpire,
  encodeConfirm,
  encodeTest,
  encodeHello,
  encodeEvt,
  encodeLink,
  encodePong,
  encodeLog,
  encodeErr,
  nextSeq,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Suite 1: line assembler — PROTOCOL.md §10 (T1-T10)
// ---------------------------------------------------------------------------

describe('line assembler — §10 parser test cases', () => {
  it('T1: a single terminated line is parsed', () => {
    const a = createLineAssembler();
    expect(a.push('EVT ADD_POINT RED 17\n')).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T2: trailing \\r is stripped', () => {
    const a = createLineAssembler();
    expect(a.push('EVT ADD_POINT RED 17\r\n')).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T3: delivered one byte per read() is parsed identically', () => {
    const a = createLineAssembler();
    const input = 'EVT ADD_POINT RED 17\n';
    let lines = [];
    for (const ch of input) {
      lines = lines.concat(a.push(ch));
    }
    expect(lines).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T4: three lines in a single read() are all parsed, in order', () => {
    const a = createLineAssembler();
    const lines = a.push('EVT ADD_POINT RED 17\nEVT ADD_POINT GREEN 18\nPING\n');
    expect(lines).toEqual(['EVT ADD_POINT RED 17', 'EVT ADD_POINT GREEN 18', 'PING']);
  });

  it('T5: a line split mid-token across two reads is parsed', () => {
    const a = createLineAssembler();
    expect(a.push('EVT ADD_POI')).toEqual([]);
    expect(a.push('NT RED 17\n')).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T6: an unknown keyword is ignored without crashing', () => {
    const a = createLineAssembler();
    const [line] = a.push('BOGUS FOO BAR\n');
    expect(parseLine(line)).toBeNull();
  });

  it('T7: missing args are ignored and logged (INVALID)', () => {
    const a = createLineAssembler();
    const [line] = a.push('EVT ADD_POINT\n');
    const result = parseLine(line);
    expect(result).toEqual({ type: 'INVALID', keyword: 'EVT', reason: 'wrong arg count' });
  });

  it('T8: a bad seq is ignored and logged (INVALID)', () => {
    const a = createLineAssembler();
    const [line] = a.push('EVT ADD_POINT RED xyz\n');
    const result = parseLine(line);
    expect(result).toEqual({ type: 'INVALID', keyword: 'EVT', reason: 'bad seq' });
  });

  it('T9: an overlong buffer with no \\n is discarded, and the next line still parses', () => {
    const a = createLineAssembler();
    const overlong = 'X'.repeat(200);
    expect(a.push(overlong)).toEqual([]);
    expect(a.push('EVT ADD_POINT RED 17\n')).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T9b: an overlong line that arrives with its own terminator in the same read() also resyncs correctly', () => {
    const a = createLineAssembler();
    const overlong = 'X'.repeat(200) + '\n';
    expect(a.push(overlong + 'EVT ADD_POINT RED 17\n')).toEqual(['EVT ADD_POINT RED 17']);
  });

  it('T10: empty lines are ignored and the event is parsed', () => {
    const a = createLineAssembler();
    expect(a.push('\n\n\nEVT ADD_POINT RED 17\n')).toEqual(['EVT ADD_POINT RED 17']);
  });
});

// ---------------------------------------------------------------------------
// Round-trip encode -> parse for every message type in §3 and §4
// ---------------------------------------------------------------------------

describe('round-trip encode -> parse', () => {
  it('INFO', () => {
    expect(parseLine(encodeInfo())).toEqual({ type: 'INFO' });
  });

  it('PING', () => {
    expect(parseLine(encodePing())).toEqual({ type: 'PING' });
  });

  it('ECHO', () => {
    expect(parseLine(encodeEcho('hello'))).toEqual({ type: 'ECHO', text: 'hello' });
  });

  it('CLOCK RUN', () => {
    expect(parseLine(encodeClockRun())).toEqual({ type: 'CLOCK', mode: 'RUN' });
  });

  it('CLOCK STOP', () => {
    expect(parseLine(encodeClockStop())).toEqual({ type: 'CLOCK', mode: 'STOP' });
  });

  it('EXPIRE', () => {
    expect(parseLine(encodeExpire())).toEqual({ type: 'EXPIRE' });
  });

  it('CONFIRM', () => {
    expect(parseLine(encodeConfirm(17))).toEqual({ type: 'CONFIRM', seq: 17 });
  });

  it('TEST', () => {
    expect(parseLine(encodeTest(1))).toEqual({ type: 'TEST', mode: 1 });
  });

  it('HELLO', () => {
    expect(parseLine(encodeHello('2.0', '0.1.0', 0))).toEqual({
      type: 'HELLO',
      proto: '2.0',
      fw: '0.1.0',
      caps: 0,
    });
  });

  it('EVT', () => {
    expect(parseLine(encodeEvt('ADD_POINT', 'RED', 17))).toEqual({
      type: 'EVT',
      action: 'ADD_POINT',
      src: 'RED',
      seq: 17,
    });
  });

  it('PONG', () => {
    expect(parseLine(encodePong())).toEqual({ type: 'PONG' });
  });

  it('LOG', () => {
    expect(parseLine(encodeLog('some diagnostic text'))).toEqual({
      type: 'LOG',
      text: 'some diagnostic text',
    });
  });

  it('ERR', () => {
    expect(parseLine(encodeErr('BLE_INIT_FAILED'))).toEqual({
      type: 'ERR',
      text: 'BLE_INIT_FAILED',
    });
  });
});

describe('LINK optional trailing arguments', () => {
  it('CONNECTED carries rssi and batt', () => {
    expect(parseLine('LINK RED CONNECTED -52 87')).toEqual({
      type: 'LINK',
      remote: 'RED',
      state: 'CONNECTED',
      rssi: -52,
      batt: 87,
    });
  });

  it('CONNECTED with rssi but unknown batt', () => {
    expect(parseLine('LINK RED CONNECTED -52')).toEqual({
      type: 'LINK',
      remote: 'RED',
      state: 'CONNECTED',
      rssi: -52,
      batt: null,
    });
  });

  it('DISCONNECTED carries no rssi/batt', () => {
    expect(parseLine('LINK GREEN DISCONNECTED')).toEqual({
      type: 'LINK',
      remote: 'GREEN',
      state: 'DISCONNECTED',
      rssi: null,
      batt: null,
    });
  });

  it('CONNECTING carries no rssi/batt', () => {
    expect(parseLine('LINK GREEN CONNECTING')).toEqual({
      type: 'LINK',
      remote: 'GREEN',
      state: 'CONNECTING',
      rssi: null,
      batt: null,
    });
  });

  it('rejects rssi/batt on a non-CONNECTED state', () => {
    const result = parseLine('LINK RED DISCONNECTED -52 87');
    expect(result.type).toBe('INVALID');
  });

  it('round-trips encodeLink for all three states', () => {
    expect(parseLine(encodeLink('RED', 'CONNECTED', -52, 87))).toEqual({
      type: 'LINK',
      remote: 'RED',
      state: 'CONNECTED',
      rssi: -52,
      batt: 87,
    });
    expect(parseLine(encodeLink('RED', 'CONNECTED', -52, null))).toEqual({
      type: 'LINK',
      remote: 'RED',
      state: 'CONNECTED',
      rssi: -52,
      batt: null,
    });
    expect(parseLine(encodeLink('GREEN', 'DISCONNECTED'))).toEqual({
      type: 'LINK',
      remote: 'GREEN',
      state: 'DISCONNECTED',
      rssi: null,
      batt: null,
    });
  });
});

describe('sequence wrap helper', () => {
  it('wraps 999 -> 0', () => {
    expect(nextSeq(999)).toBe(0);
  });
  it('increments normally', () => {
    expect(nextSeq(17)).toBe(18);
  });
});

describe('unknown keywords', () => {
  it('are ignored silently (returns null)', () => {
    expect(parseLine('BOGUS FOO BAR')).toBeNull();
  });
  it('empty line returns null', () => {
    expect(parseLine('')).toBeNull();
  });
});
