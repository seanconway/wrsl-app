import {
  parseLine,
  encodeInfo,
  encodePing,
  encodeClockRun,
  encodeClockStop,
  encodeExpire,
  encodeConfirm,
  nextSeq,
} from '../protocol/protocol.js';

export const PROTOCOL_VERSION = { major: 2, minor: 0 };
export const PING_INTERVAL_MS = 2000;
export const LINK_STALE_MS = 5000;
const DEBUG_LOG_LIMIT = 500;

const DISCONNECTED_LINK = { state: 'DISCONNECTED', rssi: null, batt: null };

function initialLinkStatus() {
  return { RED: { ...DISCONNECTED_LINK }, GREEN: { ...DISCONNECTED_LINK } };
}

const EVT_DISPATCH = {
  ADD_POINT: (src) => ({ type: 'ADD_POINT', color: src }),
  REMOVE_POINT: (src) => ({ type: 'REMOVE_POINT', color: src }),
  TOGGLE_TIMER: () => ({ type: 'TOGGLE_TIMER' }),
  TIME_UP: () => ({ type: 'TIME_UP' }),
  TIME_DOWN: () => ({ type: 'TIME_DOWN' }),
  PERIOD_UP: () => ({ type: 'PERIOD_UP' }),
  PERIOD_DOWN: () => ({ type: 'PERIOD_DOWN' }),
};

const CONFIRMABLE_ACTIONS = new Set(['ADD_POINT', 'REMOVE_POINT']);

/**
 * All protocol semantics for the dongle link, transport-agnostic. Works
 * identically against a WebSerialTransport or a FakeDongleTransport.
 *
 * Owns: the connect handshake, the PING cadence, both supervision timeouts,
 * CONFIRM emission, sequence-gap detection, and translating EVT lines into
 * scoreboard state changes (by dispatching into the shared scoreboard
 * reducer — never reimplementing scoring logic itself).
 */
export class DongleService {
  constructor(transport, handlers = {}) {
    this.transport = transport;

    this.dispatch = handlers.dispatch ?? (() => {});
    this.onLog = handlers.onLog ?? (() => {});
    this.onLinkChange = handlers.onLinkChange ?? (() => {});
    this.onStaleChange = handlers.onStaleChange ?? (() => {});
    this.onHandshakeStateChange = handlers.onHandshakeStateChange ?? (() => {});
    this.onDebugLine = handlers.onDebugLine ?? (() => {});

    this._now = handlers.now ?? (() => Date.now());
    this._setInterval = handlers.setInterval ?? ((fn, ms) => setInterval(fn, ms));
    this._clearInterval = handlers.clearInterval ?? ((id) => clearInterval(id));
    this._setTimeout = handlers.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this._clearTimeout = handlers.clearTimeout ?? ((id) => clearTimeout(id));

    this.handshakeState = 'disconnected'; // disconnected | handshaking | ready | refused
    this.isStale = false;
    this.linkStatus = initialLinkStatus();
    this.debugLog = [];

    this._expectedNextSeq = null;
    this._pingTimer = null;
    this._staleTimer = null;
    this._lastScoreboardState = null;

    this._unsubLine = transport.onLine((line) => this._handleLine(line));
    this._unsubStatus = transport.onStatusChange((status, detail) => this._handleStatus(status, detail));
  }

  async connect(options) {
    this._setHandshakeState('handshaking');
    await this.transport.connect(options);
  }

  async disconnect() {
    this._stopPing();
    this._stopStaleTimer();
    await this.transport.disconnect();
  }

  /** Unsubscribes from the transport. Does not close the transport itself. */
  destroy() {
    this._unsubLine();
    this._unsubStatus();
    this._stopPing();
    this._stopStaleTimer();
  }

  /**
   * Call whenever scoreboard state changes (UI button or a dispatched EVT).
   * Diffs against the previously seen state and emits CLOCK RUN/STOP and
   * EXPIRE as needed. The first call after connect only primes the diff —
   * it never emits, since the handshake already forces CLOCK STOP.
   */
  syncScoreboardState(nextState) {
    const prev = this._lastScoreboardState;
    this._lastScoreboardState = nextState;
    if (!prev) return;

    if (prev.isRunning !== nextState.isRunning) {
      this._send(nextState.isRunning ? encodeClockRun() : encodeClockStop());
    }

    const prevTime = prev.periodTimes[prev.currentPeriod];
    const nextTime = nextState.periodTimes[nextState.currentPeriod];
    if (prevTime > 0 && nextTime === 0) {
      this._send(encodeExpire());
    }
  }

  /**
   * Sends a line exactly as given. The COM port is exclusive, so while the app
   * holds it a serial terminal cannot — this is the only way to drive the
   * firmware's TEST modes (§7.2) during an integration run, and it is the
   * "raw-line panel" §7.3 asks for.
   *
   * Deliberately unvalidated: sending malformed lines is precisely how you
   * exercise the firmware's §2.2 tolerance from the app side.
   */
  sendRaw(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    if (this.handshakeState === 'disconnected') return false;
    this._send(trimmed);
    return true;
  }

  _setHandshakeState(state) {
    this.handshakeState = state;
    this.onHandshakeStateChange(state);
  }

  _send(line) {
    this.transport.write(line);
    this._logDebug('TX', line);
  }

  _logDebug(dir, line) {
    const entry = { ts: this._now(), dir, line };
    this.debugLog.push(entry);
    if (this.debugLog.length > DEBUG_LOG_LIMIT) this.debugLog.shift();
    this.onDebugLine(entry);
  }

  _handleStatus(status, detail) {
    if (status === 'connected') {
      this._expectedNextSeq = null;
      this._armStaleTimer();
      this._send(encodeInfo());
      return;
    }

    if (status === 'disconnected') {
      this._stopPing();
      this._stopStaleTimer();
      this._setHandshakeState('disconnected');
      if (this.isStale) {
        this.isStale = false;
        this.onStaleChange(false);
      }
      this.linkStatus = initialLinkStatus();
      this.onLinkChange('RED', this.linkStatus.RED);
      this.onLinkChange('GREEN', this.linkStatus.GREEN);
      return;
    }

    if (status === 'error') {
      this.onLog(`ERROR: transport error: ${detail?.error?.message ?? detail?.error ?? 'unknown'}`);
    }
  }

  _handleLine(line) {
    this._logDebug('RX', line);
    this._armStaleTimer();

    const msg = parseLine(line);
    if (msg === null) return; // unknown keyword: ignore silently
    if (msg.type === 'INVALID') {
      this.onLog(`WARN: malformed line ignored: "${line}" (${msg.reason})`);
      return;
    }

    switch (msg.type) {
      case 'HELLO':
        this._handleHello(msg);
        break;
      case 'EVT':
        this._handleEvt(msg);
        break;
      case 'LINK':
        this._handleLink(msg);
        break;
      case 'ERR':
        this.onLog(`DONGLE ERROR: ${msg.text}`);
        break;
      case 'LOG':
        this.onLog(`DONGLE: ${msg.text}`);
        break;
      // PONG / ECHO: liveness already handled by the stale-timer reset above.
      default:
        break;
    }
  }

  _handleHello(msg) {
    const [majorToken, minorToken] = msg.proto.split('.');
    const major = Number(majorToken);
    const minor = Number(minorToken);

    if (major !== PROTOCOL_VERSION.major) {
      this._setHandshakeState('refused');
      this.onLog(
        `ERROR: dongle protocol v${msg.proto} is incompatible with app v${PROTOCOL_VERSION.major}.${PROTOCOL_VERSION.minor} — update the dongle firmware.`,
      );
      return;
    }

    if (minor !== PROTOCOL_VERSION.minor) {
      this.onLog(
        `WARN: dongle protocol v${msg.proto} differs from app v${PROTOCOL_VERSION.major}.${PROTOCOL_VERSION.minor} (minor version) — continuing.`,
      );
    }

    this._setHandshakeState('ready');
    this._send(encodeClockStop());
    this._startPing();
  }

  _handleEvt(msg) {
    const { action, src, seq } = msg;

    if (this._expectedNextSeq !== null && seq !== this._expectedNextSeq) {
      this.onLog(`WARN: EVT sequence gap: expected ${this._expectedNextSeq}, got ${seq}`);
    }
    this._expectedNextSeq = nextSeq(seq);

    const buildAction = EVT_DISPATCH[action];
    if (!buildAction) return;

    this.dispatch(buildAction(src));

    if (CONFIRMABLE_ACTIONS.has(action)) {
      this._send(encodeConfirm(seq));
    }
  }

  _handleLink(msg) {
    const status = { state: msg.state, rssi: msg.rssi, batt: msg.batt };
    this.linkStatus = { ...this.linkStatus, [msg.remote]: status };
    this.onLinkChange(msg.remote, status);
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = this._setInterval(() => this._send(encodePing()), PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingTimer) {
      this._clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _armStaleTimer() {
    if (this.isStale) {
      this.isStale = false;
      this.onStaleChange(false);
    }
    this._stopStaleTimer();
    this._staleTimer = this._setTimeout(() => {
      this.isStale = true;
      this.onStaleChange(true);
    }, LINK_STALE_MS);
  }

  _stopStaleTimer() {
    if (this._staleTimer) {
      this._clearTimeout(this._staleTimer);
      this._staleTimer = null;
    }
  }
}
