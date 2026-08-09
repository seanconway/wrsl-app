// Pure wire-protocol module for the dongle <-> app link (see PROTOCOL.md v3.0).
// No DOM, no Web Serial, no imports from the app. Runs under plain Node.

export const PROTOCOL_VERSION = { major: 3, minor: 0 };

export const MAX_LINE_LENGTH = 120;
const MAX_CONTENT_LENGTH = MAX_LINE_LENGTH - 1; // 1 byte reserved for the \n terminator

/** The seven physical buttons of FS §3.1, named by position rather than function. */
export const BUTTONS = [
  'ADD_POINT',
  'TOGGLE_CLOCK',
  'REMOVE_POINT',
  'FORWARD',
  'BACKWARD',
  'F1',
  'F2',
];
const BUTTON_SET = new Set(BUTTONS);

/** Gestures, classified in remote firmware (FS §4.2). Never re-derived here. */
export const GESTURES = ['PRESS', 'HOLD', 'HOLD_REP'];
const GESTURE_SET = new Set(GESTURES);

export const REMOTES = ['RED', 'GREEN'];
const REMOTE_SET = new Set(REMOTES);
const TARGET_SET = new Set([...REMOTES, 'BOTH']);

export const LINK_STATES = ['CONNECTED', 'CONNECTING', 'DISCONNECTED'];
const LINK_STATE_SET = new Set(LINK_STATES);

export const LED_MODES = ['OFF', 'SOLID'];
const LED_MODE_SET = new Set(LED_MODES);

/** Waveforms name sensations, not events (PROTOCOL.md §9). */
export const WAVEFORMS = ['TAP', 'BEAT', 'WARN', 'BUZZ', 'LONG', 'DOUBLE', 'TRIPLE'];
const WAVEFORM_SET = new Set(WAVEFORMS);

export const SEQ_MODULUS = 65536;

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
  // Persists across chunks: once an unterminated run crosses the length
  // budget, drop everything until its terminator shows up so a garbage run
  // can't be stitched onto whatever line follows it. That terminator may not
  // arrive until a later read, so this cannot be scoped to a single push() —
  // §2.2 resynchronises at the next \n, not at the next chunk boundary.
  let discarding = false;

  function push(chunk) {
    const lines = [];

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
    discarding = false;
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

function isRgb(token) {
  return /^[0-9A-Fa-f]{6}$/.test(token);
}

function parseBounded(token, min, max) {
  if (!isDecimalInt(token)) return null;
  const n = parseInt(token, 10);
  return n >= min && n <= max ? n : null;
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
    // Dongle -> App
    case 'HELLO':
      return parseHello(args);
    case 'EVT':
      return parseEvt(args);
    case 'LINK':
      return parseLink(args);
    case 'JOIN':
      return parseJoin(args);
    case 'PONG':
      return args.length === 0 ? { type: 'PONG' } : invalid('PONG', 'unexpected args');
    case 'ECHO':
      return args.length >= 1
        ? { type: 'ECHO', text: args.join(' ') }
        : invalid('ECHO', 'missing text');
    case 'LOG':
      return args.length >= 1 ? { type: 'LOG', text: args.join(' ') } : invalid('LOG', 'missing text');
    case 'ERR':
      return args.length >= 1 ? { type: 'ERR', text: args.join(' ') } : invalid('ERR', 'missing text');

    // App -> Dongle. Parsed as well as encoded so the fake dongle tool and the
    // firmware's counterpart tests share one definition of every message.
    case 'ACK':
      return parseAck(args);
    case 'STATE':
      return parseState(args);
    case 'HAP':
      return parseHap(args);
    case 'CFG':
      return parseCfg(args);
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
  if (args.length !== 4) return invalid('HELLO', 'wrong arg count');
  const [proto, fw, set, capsToken] = args;
  if (!/^\d+\.\d+$/.test(proto)) return invalid('HELLO', 'bad proto version');
  if (!/^[A-Z0-9-]{1,16}$/.test(set)) return invalid('HELLO', 'bad set serial');
  if (!isDecimalInt(capsToken)) return invalid('HELLO', 'bad caps');
  return { type: 'HELLO', proto, fw, set, caps: parseInt(capsToken, 10) };
}

function parseEvt(args) {
  // Four arguments, not three. A v2.0-shaped `EVT ADD_POINT RED 17` must fail
  // closed (PROTOCOL.md T7) rather than be read as a gestureless press.
  if (args.length !== 4) return invalid('EVT', 'wrong arg count');
  const [button, gesture, src, seqToken] = args;
  if (!BUTTON_SET.has(button)) return invalid('EVT', 'bad button');
  if (!GESTURE_SET.has(gesture)) return invalid('EVT', 'bad gesture');
  if (!REMOTE_SET.has(src)) return invalid('EVT', 'bad src');
  const seq = parseBounded(seqToken, 0, SEQ_MODULUS - 1);
  if (seq === null) return invalid('EVT', 'bad seq');
  return { type: 'EVT', button, gesture, src, seq };
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

  // RSSI is mandatory when CONNECTED (PROTOCOL.md §7). The signal indicator has
  // no other source, so a short form would present as an indicator that
  // silently never updates.
  if (args.length < 3) return invalid('LINK', 'missing rssi for CONNECTED');
  if (!/^-?\d+$/.test(rssiToken)) return invalid('LINK', 'bad rssi');
  const rssi = parseInt(rssiToken, 10);

  let batt = null;
  if (args.length === 4) {
    batt = parseBounded(battToken, 0, 100);
    if (batt === null) return invalid('LINK', 'bad batt');
  }

  return { type: 'LINK', remote, state, rssi, batt };
}

function parseJoin(args) {
  if (args.length !== 1) return invalid('JOIN', 'wrong arg count');
  if (!REMOTE_SET.has(args[0])) return invalid('JOIN', 'bad remote');
  return { type: 'JOIN', remote: args[0] };
}

function parseAck(args) {
  if (args.length < 1 || args.length > 2) return invalid('ACK', 'wrong arg count');
  const seq = parseBounded(args[0], 0, SEQ_MODULUS - 1);
  if (seq === null) return invalid('ACK', 'bad seq');
  if (args.length === 2 && args[1] !== 'SILENT') return invalid('ACK', 'bad modifier');
  return { type: 'ACK', seq, silent: args.length === 2 };
}

function parseState(args) {
  if (args.length !== 5) return invalid('STATE', 'wrong arg count');
  const [remote, f1, f1rgb, f2, f2rgb] = args;
  if (!REMOTE_SET.has(remote)) return invalid('STATE', 'bad remote');
  if (!LED_MODE_SET.has(f1) || !LED_MODE_SET.has(f2)) return invalid('STATE', 'bad mode');
  if (!isRgb(f1rgb) || !isRgb(f2rgb)) return invalid('STATE', 'bad rgb');
  return { type: 'STATE', remote, f1, f1rgb, f2, f2rgb };
}

function parseHap(args) {
  if (args.length !== 2) return invalid('HAP', 'wrong arg count');
  const [target, waveform] = args;
  if (!TARGET_SET.has(target)) return invalid('HAP', 'bad target');
  if (!WAVEFORM_SET.has(waveform)) return invalid('HAP', 'bad waveform');
  return { type: 'HAP', target, waveform };
}

function parseCfg(args) {
  if (args.length !== 3) return invalid('CFG', 'wrong arg count');
  const [target, hapticToken, brightToken] = args;
  if (!TARGET_SET.has(target)) return invalid('CFG', 'bad target');
  const haptic = parseBounded(hapticToken, 0, 100);
  const bright = parseBounded(brightToken, 0, 100);
  if (haptic === null || bright === null) return invalid('CFG', 'value out of range');
  return { type: 'CFG', target, haptic, bright };
}

function parseTest(args) {
  if (args.length !== 1) return invalid('TEST', 'wrong arg count');
  const mode = parseBounded(args[0], 0, 9);
  if (mode === null) return invalid('TEST', 'bad mode');
  return { type: 'TEST', mode };
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

export function encodeAck(seq, { silent = false } = {}) {
  return silent ? `ACK ${seq} SILENT` : `ACK ${seq}`;
}

/** Always the complete app-owned indicator state for one remote. There is no
 *  partial form, because there is no version of this message that can leave a
 *  remote holding a stale half of its state (PROTOCOL.md §6). */
export function encodeState(remote, { f1 = 'OFF', f1rgb = '000000', f2 = 'OFF', f2rgb = '000000' } = {}) {
  return `STATE ${remote} ${f1} ${normaliseRgb(f1rgb)} ${f2} ${normaliseRgb(f2rgb)}`;
}

export function encodeHap(target, waveform) {
  return `HAP ${target} ${waveform}`;
}

export function encodeCfg(target, haptic, bright) {
  return `CFG ${target} ${haptic} ${bright}`;
}

export function encodeTest(mode) {
  return `TEST ${mode}`;
}

/** Accepts `#C2F000`, `c2f000` or `C2F000`; emits the six bare uppercase hex
 *  digits the wire format requires. Anything else becomes black rather than a
 *  malformed line — an indicator that fails dark is recoverable, a line the
 *  dongle discards is not. */
export function normaliseRgb(value) {
  const hex = String(value ?? '').replace(/^#/, '');
  return isRgb(hex) ? hex.toUpperCase() : '000000';
}

// ---------------------------------------------------------------------------
// Encoding (Dongle -> App). Provided for round-trip testing and for the fake
// dongle tool, which plays the dongle side of the link.
// ---------------------------------------------------------------------------

export function encodeHello(proto, fw, set, caps) {
  return `HELLO ${proto} ${fw} ${set} ${caps}`;
}

export function encodeEvt(button, gesture, src, seq) {
  return `EVT ${button} ${gesture} ${src} ${seq}`;
}

export function encodeLink(remote, state, rssi, batt) {
  if (state !== 'CONNECTED') return `LINK ${remote} ${state}`;
  if (batt === null || batt === undefined) return `LINK ${remote} ${state} ${rssi}`;
  return `LINK ${remote} ${state} ${rssi} ${batt}`;
}

export function encodeJoin(remote) {
  return `JOIN ${remote}`;
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

/** Sequence numbers wrap 0-65535. Returns the expected next value after `seq`. */
export function nextSeq(seq) {
  return (seq + 1) % SEQ_MODULUS;
}

/**
 * Forward distance from `expected` to `seq` across the wrap, so a gap of 3 is
 * distinguishable from a duplicate that arrives 65533 apart. Returns 0 when
 * `seq` is exactly what was expected.
 */
export function seqDistance(seq, expected) {
  return (seq - expected + SEQ_MODULUS) % SEQ_MODULUS;
}
