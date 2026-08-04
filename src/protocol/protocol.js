// Pure wire-protocol module for the dongle <-> app link (see PROTOCOL.md).
// No DOM, no Web Serial, no imports from the app. Runs under plain Node.

export const MAX_LINE_LENGTH = 120;
const MAX_CONTENT_LENGTH = MAX_LINE_LENGTH - 1; // 1 byte reserved for the \n terminator

export const EVT_ACTIONS = [
  'TOGGLE_TIMER',
  'ADD_POINT',
  'REMOVE_POINT',
  'TIME_UP',
  'TIME_DOWN',
  'PERIOD_UP',
  'PERIOD_DOWN',
];
const EVT_ACTION_SET = new Set(EVT_ACTIONS);

export const REMOTES = ['RED', 'GREEN'];
const REMOTE_SET = new Set(REMOTES);

export const LINK_STATES = ['CONNECTED', 'CONNECTING', 'DISCONNECTED'];
const LINK_STATE_SET = new Set(LINK_STATES);

// ---------------------------------------------------------------------------
// Line assembler
// ---------------------------------------------------------------------------

/**
 * Feeds arbitrary string chunks in (as they arrive from a byte stream) and
 * emits complete, newline-delimited lines out. A line may span several
 * chunks, and one chunk may contain several lines plus a partial line.
 *
 * Per PROTOCOL.md §2.2:
 *  - trailing \r is stripped
 *  - empty lines are ignored
 *  - a buffer that exceeds MAX_LINE_LENGTH without a terminator is discarded,
 *    and bytes are dropped until the next \n resynchronises the stream.
 */
export function createLineAssembler() {
  let buffer = '';

  function push(chunk) {
    const lines = [];
    // Scoped to this call: once an unterminated run crosses the length
    // budget, drop everything until its terminator shows up so a garbage
    // run can't be stitched onto whatever line follows it.
    let discarding = false;

    for (const ch of chunk) {
      if (discarding) {
        if (ch === '\n') {
          discarding = false;
          buffer = '';
        }
        continue;
      }

      if (ch === '\n') {
        let line = buffer;
        buffer = '';
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.length > 0 && line.length <= MAX_CONTENT_LENGTH) {
          lines.push(line);
        }
        continue;
      }

      buffer += ch;
      if (buffer.length > MAX_CONTENT_LENGTH) {
        buffer = '';
        discarding = true;
      }
    }

    return lines;
  }

  function reset() {
    buffer = '';
  }

  return { push, reset };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function splitTokens(line) {
  return line.split(' ').filter((t) => t.length > 0);
}

function isDecimalInt(token) {
  return /^\d+$/.test(token);
}

function invalid(keyword, reason) {
  return { type: 'INVALID', keyword, reason };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parses one already-assembled line (no trailing \n or \r).
 * Returns:
 *   - null                          for an unknown keyword (ignore silently)
 *   - { type: 'INVALID', ... }      for a known keyword with bad args (ignore, log locally)
 *   - { type: <KEYWORD>, ... }      for a successfully parsed message
 */
export function parseLine(line) {
  const tokens = splitTokens(line);
  if (tokens.length === 0) return null;
  const [keyword, ...args] = tokens;

  switch (keyword) {
    case 'HELLO':
      return parseHello(args);
    case 'EVT':
      return parseEvt(args);
    case 'LINK':
      return parseLink(args);
    case 'PONG':
      return args.length === 0 ? { type: 'PONG' } : invalid('PONG', 'unexpected args');
    case 'ECHO':
      return args.length >= 1
        ? { type: 'ECHO', text: args.join(' ') }
        : invalid('ECHO', 'missing text');
    case 'LOG':
      return args.length >= 1
        ? { type: 'LOG', text: args.join(' ') }
        : invalid('LOG', 'missing text');
    case 'ERR':
      return args.length >= 1
        ? { type: 'ERR', text: args.join(' ') }
        : invalid('ERR', 'missing text');
    case 'CLOCK':
      return parseClock(args);
    case 'EXPIRE':
      return args.length === 0 ? { type: 'EXPIRE' } : invalid('EXPIRE', 'unexpected args');
    case 'CONFIRM':
      return parseConfirm(args);
    case 'PING':
      return args.length === 0 ? { type: 'PING' } : invalid('PING', 'unexpected args');
    case 'INFO':
      return args.length === 0 ? { type: 'INFO' } : invalid('INFO', 'unexpected args');
    case 'TEST':
      return parseTest(args);
    default:
      return null;
  }
}

function parseHello(args) {
  if (args.length !== 3) return invalid('HELLO', 'wrong arg count');
  const [proto, fw, capsToken] = args;
  if (!isDecimalInt(capsToken)) return invalid('HELLO', 'bad caps');
  return { type: 'HELLO', proto, fw, caps: parseInt(capsToken, 10) };
}

function parseEvt(args) {
  if (args.length !== 3) return invalid('EVT', 'wrong arg count');
  const [action, src, seqToken] = args;
  if (!EVT_ACTION_SET.has(action)) return invalid('EVT', 'bad action');
  if (!REMOTE_SET.has(src)) return invalid('EVT', 'bad src');
  if (!isDecimalInt(seqToken)) return invalid('EVT', 'bad seq');
  const seq = parseInt(seqToken, 10);
  if (seq < 0 || seq > 999) return invalid('EVT', 'seq out of range');
  return { type: 'EVT', action, src, seq };
}

function parseLink(args) {
  if (args.length < 2 || args.length > 4) return invalid('LINK', 'wrong arg count');
  const [remote, state, rssiToken, battToken] = args;
  if (!REMOTE_SET.has(remote)) return invalid('LINK', 'bad remote');
  if (!LINK_STATE_SET.has(state)) return invalid('LINK', 'bad state');

  if (state !== 'CONNECTED') {
    if (args.length !== 2) return invalid('LINK', 'rssi/batt only valid when CONNECTED');
    return { type: 'LINK', remote, state, rssi: null, batt: null };
  }

  if (args.length < 3) return invalid('LINK', 'missing rssi for CONNECTED');
  if (!/^-?\d+$/.test(rssiToken)) return invalid('LINK', 'bad rssi');
  const rssi = parseInt(rssiToken, 10);

  let batt = null;
  if (args.length === 4) {
    if (!isDecimalInt(battToken)) return invalid('LINK', 'bad batt');
    batt = parseInt(battToken, 10);
    if (batt < 0 || batt > 100) return invalid('LINK', 'batt out of range');
  }

  return { type: 'LINK', remote, state, rssi, batt };
}

function parseClock(args) {
  if (args.length !== 1) return invalid('CLOCK', 'wrong arg count');
  const [mode] = args;
  if (mode !== 'RUN' && mode !== 'STOP') return invalid('CLOCK', 'bad mode');
  return { type: 'CLOCK', mode };
}

function parseConfirm(args) {
  if (args.length !== 1) return invalid('CONFIRM', 'wrong arg count');
  const [seqToken] = args;
  if (!isDecimalInt(seqToken)) return invalid('CONFIRM', 'bad seq');
  const seq = parseInt(seqToken, 10);
  if (seq < 0 || seq > 999) return invalid('CONFIRM', 'seq out of range');
  return { type: 'CONFIRM', seq };
}

function parseTest(args) {
  if (args.length !== 1) return invalid('TEST', 'wrong arg count');
  const [modeToken] = args;
  if (!isDecimalInt(modeToken)) return invalid('TEST', 'bad mode');
  return { type: 'TEST', mode: parseInt(modeToken, 10) };
}

// ---------------------------------------------------------------------------
// Encoding (App -> Dongle). Returns the line content with no trailing \n;
// the transport's write() is responsible for the terminator.
// ---------------------------------------------------------------------------

export function encodeInfo() {
  return 'INFO';
}

export function encodePing() {
  return 'PING';
}

export function encodeEcho(text) {
  return `ECHO ${text}`;
}

export function encodeClockRun() {
  return 'CLOCK RUN';
}

export function encodeClockStop() {
  return 'CLOCK STOP';
}

export function encodeExpire() {
  return 'EXPIRE';
}

export function encodeConfirm(seq) {
  return `CONFIRM ${seq}`;
}

export function encodeTest(mode) {
  return `TEST ${mode}`;
}

// ---------------------------------------------------------------------------
// Encoding (Dongle -> App). Provided for round-trip testing / the fake dongle
// tool, which plays the dongle side of the link.
// ---------------------------------------------------------------------------

export function encodeHello(proto, fw, caps) {
  return `HELLO ${proto} ${fw} ${caps}`;
}

export function encodeEvt(action, src, seq) {
  return `EVT ${action} ${src} ${seq}`;
}

export function encodeLink(remote, state, rssi, batt) {
  if (state !== 'CONNECTED') return `LINK ${remote} ${state}`;
  if (batt === null || batt === undefined) return `LINK ${remote} ${state} ${rssi}`;
  return `LINK ${remote} ${state} ${rssi} ${batt}`;
}

export function encodePong() {
  return 'PONG';
}

export function encodeLog(text) {
  return `LOG ${text}`;
}

export function encodeErr(text) {
  return `ERR ${text}`;
}

// ---------------------------------------------------------------------------
// Sequence-number helpers
// ---------------------------------------------------------------------------

/** Sequence numbers wrap 0-999. Returns the expected next value after `seq`. */
export function nextSeq(seq) {
  return (seq + 1) % 1000;
}

/** True if `seq` is exactly the successor of `expected` (accounting for wrap). */
export function isExpectedSeq(seq, expected) {
  return seq === expected;
}
