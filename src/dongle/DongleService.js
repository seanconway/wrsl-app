import {
  parseLine,
  encodeInfo,
  encodePing,
  encodeAck,
  encodeState,
  encodeHap,
  encodeCfg,
  seqDistance,
  nextSeq,
  PROTOCOL_VERSION,
  SEQ_MODULUS,
} from '../protocol/protocol.js';
import { NOTIFY } from '../match/matchReducer.js';
import { monotonicNow } from '../match/clock.js';

export { PROTOCOL_VERSION };

export const PING_INTERVAL_MS = 1000;
export const LINK_STALE_MS = 2500;

/** Burst suppression (FS §11.1). The heartbeat is suppressed briefly after any
 *  press so a scoring burst delivers only acknowledgement taps — but bounded,
 *  because a held clock adjustment repeating at 150 ms must never be able to
 *  silence the beat indefinitely and falsely report that accrual has stopped. */
export const BEAT_SUPPRESSION_MS = 400;
export const BEAT_SUPPRESSION_MAX_MS = 1500;

export const HEARTBEAT_INTERVAL_MS = 1000;

const DEBUG_LOG_LIMIT = 500;
const SEQ_HISTORY = 64;

/** Notification kind -> haptic waveform. Transport policy, not officiating:
 *  waveforms name sensations, so adding a notification is a change here and
 *  nowhere else (PROTOCOL.md §9.2). */
const WAVEFORM_FOR = {
  [NOTIFY.MAIN_WARNING]: { target: 'BOTH', waveform: 'WARN' },
  [NOTIFY.PERIOD_EXPIRED]: { target: 'BOTH', waveform: 'LONG' },
  [NOTIFY.SECONDARY_EXPIRED]: { target: 'BOTH', waveform: 'BUZZ' },
  [NOTIFY.PHASE_ENTERED]: { target: 'BOTH', waveform: 'DOUBLE' },
};

const DISCONNECTED_LINK = { state: 'DISCONNECTED', rssi: null, batt: null };

function initialLinkStatus() {
  return { RED: { ...DISCONNECTED_LINK }, GREEN: { ...DISCONNECTED_LINK } };
}

function initialCounters() {
  return {
    evtReceived: 0,
    seqGaps: 0,
    duplicates: 0,
    beatsSent: 0,
    beatsSuppressed: 0,
    ackLatencyP99Ms: null,
    ackLatencyMaxMs: null,
    connectedAtWall: null,
  };
}

/**
 * All protocol semantics for the dongle link, transport-agnostic. Works
 * identically against a WebSerialTransport or a FakeDongleTransport.
 *
 * Owns: the connect handshake, the PING cadence, both supervision timeouts,
 * ACK emission and event deduplication, indicator assertion, haptic commands,
 * the heartbeat with its burst suppression, and the running counters a soak
 * test is unfalsifiable without.
 *
 * Owns NO officiating logic. Every referee press is handed to the match reducer
 * as an INPUT action — the same action the operator UI dispatches — so the two
 * paths cannot diverge.
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
    this.onIdentityChange = handlers.onIdentityChange ?? (() => {});
    this.onCountersChange = handlers.onCountersChange ?? (() => {});

    // The service reads match state through a getter rather than holding it, so
    // there is exactly one copy and it is the reducer's.
    this.getMatchState = handlers.getMatchState ?? (() => null);
    this.selectIndicators = handlers.selectIndicators ?? (() => null);
    this.isInertInput = handlers.isInertInput ?? (() => false);

    this.config = { haptic: 80, bright: 70, ...(handlers.config ?? {}) };

    // ONE time domain. Every timestamp this service produces — acknowledgement
    // latency, burst-suppression windows, the `now` on dispatched INPUT actions
    // — is monotonic, and comparable with the references the match reducer
    // holds. Wall time is read only where a human has to read it back.
    this._now = handlers.now ?? monotonicNow;
    this._setInterval = handlers.setInterval ?? ((fn, ms) => setInterval(fn, ms));
    this._clearInterval = handlers.clearInterval ?? ((id) => clearInterval(id));
    this._setTimeout = handlers.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
    this._clearTimeout = handlers.clearTimeout ?? ((id) => clearTimeout(id));

    this.handshakeState = 'disconnected'; // disconnected | handshaking | ready | refused
    this.isStale = false;
    this.linkStatus = initialLinkStatus();
    this.identity = null; // { proto, fw, set, caps }
    this.debugLog = [];
    this.counters = initialCounters();

    this._expectedNextSeq = null;
    this._recentSeq = [];
    this._ackLatencies = [];
    this._pingTimer = null;
    this._staleTimer = null;
    this._beatTimer = null;
    this._lastAssertedState = { RED: null, GREEN: null };
    this._suppressionStartedAt = null;

    this._unsubLine = transport.onLine((line) => this._handleLine(line));
    this._unsubStatus = transport.onStatusChange((status, detail) => this._handleStatus(status, detail));
  }

  async connect(options) {
    this._setHandshakeState('handshaking');
    await this.transport.connect(options);
  }

  async disconnect() {
    this._stopTimers();
    await this.transport.disconnect();
  }

  /** Unsubscribes from the transport. Does not close the transport itself. */
  destroy() {
    this._unsubLine();
    this._unsubStatus();
    this._stopTimers();
  }

  // -------------------------------------------------------------------------
  // Outbound: state, notifications, heartbeat
  // -------------------------------------------------------------------------

  /**
   * Asserts indicator state for both remotes, sending only what changed.
   *
   * `force` sends both lines unconditionally, and is what the handshake and
   * every JOIN use. Suppressing an unchanged line is a bandwidth optimisation
   * for the steady state ONLY — it must never be allowed to skip the assertion
   * a newly-arrived remote depends on, because that remote's idea of its own
   * indicators is "off" and the app's cached idea of it may be "solid".
   */
  assertIndicators({ force = false } = {}) {
    if (this.handshakeState !== 'ready') return;
    const indicators = this.selectIndicators();
    if (!indicators) return;

    for (const remote of ['RED', 'GREEN']) {
      const { f1, f2 } = indicators[remote];
      const line = encodeState(remote, { f1: f1.mode, f1rgb: f1.rgb, f2: f2.mode, f2rgb: f2.rgb });
      if (force || this._lastAssertedState[remote] !== line) {
        this._send(line);
        this._lastAssertedState[remote] = line;
      }
    }
  }

  /** Drains the reducer's notification outbox onto the wire. Returns the ids
   *  sent, for the caller to clear. */
  sendNotifications(outbox) {
    if (this.handshakeState !== 'ready' || !outbox?.length) return [];
    const sent = [];
    for (const item of outbox) {
      const mapping = WAVEFORM_FOR[item.kind];
      if (mapping) this._send(encodeHap(mapping.target, mapping.waveform));
      sent.push(item.id);
    }
    return sent;
  }

  /**
   * One beat, addressed to the owning athlete's remote (FS §6.2). Called once
   * per second by the heartbeat timer.
   *
   * Best-effort by design: never retried, never queued. A beat that arrives
   * late is worse than one that never arrives, and a sustained absence is
   * meaningful and correct — if the link drops, the beat stops.
   */
  _beat() {
    if (this.handshakeState !== 'ready') return;
    const state = this.getMatchState();
    if (!state) return;

    const owner = state.secondary?.owner;
    const accruing = owner && this._isAccruing(state);
    if (!accruing) {
      this._suppressionStartedAt = null;
      return;
    }

    const now = this._now();
    const sinceInput = state.lastInputMono != null ? now - state.lastInputMono : Infinity;

    if (sinceInput < BEAT_SUPPRESSION_MS) {
      if (this._suppressionStartedAt === null) this._suppressionStartedAt = now;
      // Bounded: past the ceiling the beat resumes even under sustained input,
      // because a missing beat reads as "accrual stopped" and that is a lie the
      // referee cannot detect.
      if (now - this._suppressionStartedAt < BEAT_SUPPRESSION_MAX_MS) {
        this.counters = { ...this.counters, beatsSuppressed: this.counters.beatsSuppressed + 1 };
        this.onCountersChange(this.counters);
        return;
      }
    }

    this._suppressionStartedAt = null;
    this._send(encodeHap(owner, 'BEAT'));
    this.counters = { ...this.counters, beatsSent: this.counters.beatsSent + 1 };
    this.onCountersChange(this.counters);
  }

  _isAccruing(state) {
    const { owner, down, up } = state.secondary ?? {};
    if (!owner) return false;
    return down ? down.running : up?.[owner]?.running === true;
  }

  /**
   * Sends a line exactly as given. The COM port is exclusive, so while the app
   * holds it a serial terminal cannot — this is the only way to drive the
   * firmware's TEST modes during an integration run, and it is the raw-line
   * panel PROTOCOL.md §10.3 asks for.
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

  setConfig(config) {
    this.config = { ...this.config, ...config };
    if (this.handshakeState === 'ready') {
      this._send(encodeCfg('BOTH', this.config.haptic, this.config.bright));
    }
  }

  // -------------------------------------------------------------------------
  // Inbound
  // -------------------------------------------------------------------------

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
      case 'JOIN':
        this._handleJoin(msg);
        break;
      case 'ERR':
        this.onLog(`DONGLE ERROR: ${msg.text}`);
        break;
      case 'LOG':
        this.onLog(`DONGLE: ${msg.text}`);
        break;
      // PONG / ECHO: liveness is already handled by the stale-timer reset above.
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

    const previousSet = this.identity?.set ?? null;
    this.identity = { proto: msg.proto, fw: msg.fw, set: msg.set, caps: msg.caps };
    this.onIdentityChange(this.identity);

    this._setHandshakeState('ready');

    // Steps 3 and 4 of the handshake. Config first so the indicator assertion
    // renders at the intended brightness, then full state for both remotes
    // unconditionally — this is what makes a mid-match set substitution a
    // physical swap and nothing more (PROTOCOL.md §4.2).
    this._send(encodeCfg('BOTH', this.config.haptic, this.config.bright));
    this._lastAssertedState = { RED: null, GREEN: null };
    this.assertIndicators({ force: true });

    if (previousSet && previousSet !== msg.set) {
      this.onLog(`Officiating set changed: ${previousSet} → ${msg.set}. Match state retained.`);
      this.dispatch({ type: 'SET_SUBSTITUTED', set: msg.set, now: this._now() });
    }

    this.counters = { ...this.counters, connectedAtWall: Date.now() };
    this.onCountersChange(this.counters);

    this._startPing();
    this._startHeartbeat();
  }

  _handleEvt(msg) {
    const { button, gesture, src, seq } = msg;
    this.counters = { ...this.counters, evtReceived: this.counters.evtReceived + 1 };

    // Deduplicate first. This is what makes the retry-free design of
    // PROTOCOL.md §5.3 safe: a duplicate seq is a press that already landed,
    // and applying it twice corrupts the score with no external indication.
    if (this._recentSeq.includes(seq)) {
      this.counters = { ...this.counters, duplicates: this.counters.duplicates + 1 };
      this.onCountersChange(this.counters);
      this.onLog(`WARN: duplicate EVT seq ${seq} dropped`);
      // Still acknowledged — the tap is the referee's proof of receipt, and
      // withholding it for a duplicate would make them press a third time.
      this._send(encodeAck(seq));
      return;
    }

    if (this._expectedNextSeq !== null && seq !== this._expectedNextSeq) {
      const missing = seqDistance(seq, this._expectedNextSeq);
      // A large forward distance is a wrapped counter after a reconnect, not a
      // gap of 65000 presses.
      if (missing > 0 && missing < SEQ_MODULUS / 2) {
        this.counters = { ...this.counters, seqGaps: this.counters.seqGaps + 1 };
        this.onLog(`WARN: EVT sequence gap: expected ${this._expectedNextSeq}, got ${seq} (${missing} missing)`);
      }
    }
    this._expectedNextSeq = nextSeq(seq);
    this._recentSeq.push(seq);
    if (this._recentSeq.length > SEQ_HISTORY) this._recentSeq.shift();

    const receivedAt = this._now();
    const state = this.getMatchState();
    const inert = state ? this.isInertInput(state, button) : false;

    if (!inert) {
      this.dispatch({ type: 'INPUT', button, gesture, src, now: receivedAt });
    }

    // Acknowledge in the same turn as the receive, never deferred to a timer:
    // the budget is 120 ms across six hops and this one owns 25 ms of it.
    this._send(encodeAck(seq, { silent: inert }));
    this._recordAckLatency(this._now() - receivedAt);
    this.onCountersChange(this.counters);
  }

  _handleLink(msg) {
    const status = { state: msg.state, rssi: msg.rssi, batt: msg.batt };
    this.linkStatus = { ...this.linkStatus, [msg.remote]: status };
    this.onLinkChange(msg.remote, status);
  }

  /** A remote has come onto the link holding no indicator state. Answer
   *  unconditionally — not "if something changed" (PROTOCOL.md §6.3). */
  _handleJoin(msg) {
    this._lastAssertedState[msg.remote] = null;
    this.assertIndicators({ force: true });
    this.onLog(`${msg.remote} remote joined — indicator state asserted.`);
  }

  _handleStatus(status, detail) {
    if (status === 'connected') {
      this._expectedNextSeq = null;
      this._recentSeq = [];
      this._ackLatencies = [];
      this._lastAssertedState = { RED: null, GREEN: null };
      this._armStaleTimer();
      this._send(encodeInfo());
      return;
    }

    if (status === 'disconnected') {
      this._stopTimers();
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

  // -------------------------------------------------------------------------
  // Timers and instrumentation
  // -------------------------------------------------------------------------

  _setHandshakeState(state) {
    this.handshakeState = state;
    this.onHandshakeStateChange(state);
  }

  _send(line) {
    this.transport.write(line);
    this._logDebug('TX', line);
  }

  _logDebug(dir, line) {
    // `ts` is monotonic, for measuring intervals between lines; `wallTs` is for
    // the human reading the panel. Never use wall time to measure anything.
    const entry = { ts: this._now(), wallTs: Date.now(), dir, line };
    this.debugLog.push(entry);
    if (this.debugLog.length > DEBUG_LOG_LIMIT) this.debugLog.shift();
    this.onDebugLine(entry);
  }

  /** p99 rather than the median: the median is comfortably inside budget in
   *  every design that ever fails this requirement (PROTOCOL.md §11). */
  _recordAckLatency(ms) {
    this._ackLatencies.push(ms);
    if (this._ackLatencies.length > 500) this._ackLatencies.shift();
    const sorted = [...this._ackLatencies].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99));
    this.counters = {
      ...this.counters,
      ackLatencyP99Ms: Math.round(sorted[index]),
      ackLatencyMaxMs: Math.round(sorted[sorted.length - 1]),
    };
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

  _startHeartbeat() {
    this._stopHeartbeat();
    this._beatTimer = this._setInterval(() => this._beat(), HEARTBEAT_INTERVAL_MS);
  }

  _stopHeartbeat() {
    if (this._beatTimer) {
      this._clearInterval(this._beatTimer);
      this._beatTimer = null;
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

  _stopTimers() {
    this._stopPing();
    this._stopHeartbeat();
    this._stopStaleTimer();
  }
}
