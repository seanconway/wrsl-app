// The dongle half of PROTOCOL.md v3.0, with no transport and no I/O of its own.
//
// This is the executable reference for the wire contract: the firmware has to
// behave like this, and the scoreboard is validated against it before any
// firmware exists. Two front-ends drive the same model, so they cannot drift —
// tools/fake_dongle.js over a real serial port from Node, and the emulator page
// over Web Serial with an interactive mockup of both remotes.
//
// Deliberately faithful in the places that matter and honest about the rest:
// the 120 ms acknowledgement window, the pending table keyed by seq, the 2.5 s
// app supervision timeout and the TEST modes are real. Radio behaviour is not
// modelled at all — link state is whatever the operator sets.

import {
  parseLine,
  encodeHello,
  encodeLink,
  encodeJoin,
  encodePong,
  encodeEcho,
  encodeEvt,
  encodeErr,
  encodeLog,
  BUTTONS,
  GESTURES,
  SEQ_MODULUS,
  PROTOCOL_VERSION,
} from '../protocol/protocol.js';

export const APP_TIMEOUT_MS = 2500;
export const LINK_REEMIT_MS = 10000;
export const ACK_WINDOW_MS = 120;
export const REMOTES = ['RED', 'GREEN'];

// Hold-repeat exists only for clock adjustment (PROTOCOL.md §5.1).
export const REPEATING = new Set(['FORWARD', 'BACKWARD']);

const DEFAULT_SET_SERIAL = 'RR-0147';
const DEFAULT_FW_VERSION = '0.2.0-emulated';

/** Monotonic where available. Latency is a subtraction of two readings and must
 *  not be measured against a clock the OS can adjust underneath it. */
function nowMono() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * @param {object}   opts
 * @param {(line: string) => void} opts.write  sends one line; the caller adds
 *        nothing — the model emits complete lines without the terminator.
 * @param {(event: object) => void} [opts.emit] observation seam. Every event
 *        carries a `type`; see the emissions below. A front-end renders these,
 *        it does not need to re-parse the wire.
 */
export class DongleModel {
  constructor({ write, emit = () => {}, setSerial = DEFAULT_SET_SERIAL, fwVersion = DEFAULT_FW_VERSION } = {}) {
    this._write = write;
    this._emit = emit;
    this.setSerial = setSerial;
    this.fwVersion = fwVersion;

    this.seq = 0;
    this.running = false;
    this.supervisionSuspended = false;
    this.appDown = false;
    this.testMode = 0;

    this._appTimeoutTimer = null;
    this._linkReemitTimer = null;
    this._testModeTimer = null;

    // The pending table of §5.3: seq -> { src, timer, sentAtMono }. The real
    // firmware's is eight entries deep, so this one is too — a bounded table
    // that drops its oldest entry is a behaviour worth reproducing.
    this.pending = new Map();

    this.config = { haptic: 100, bright: 100 };
    this.link = {
      RED: { state: 'CONNECTED', rssi: -50, batt: 92 },
      GREEN: { state: 'CONNECTED', rssi: -58, batt: 77 },
    };
    // Last indicator state asserted by the app, per remote. Null until the
    // handshake asserts one, which is exactly what a real remote holds.
    this.indicators = { RED: null, GREEN: null };
  }

  // -- lifecycle ------------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this._armAppTimeout();
    this._linkReemitTimer = setInterval(() => this._reemitLinks(), LINK_REEMIT_MS);
    // Boot-time HELLO is best-effort and never gated on DTR (PROTOCOL.md §4.2).
    this._send(this._hello());
    this._note('emulated dongle running — waiting for INFO from the app');
  }

  stop() {
    this.running = false;
    clearTimeout(this._appTimeoutTimer);
    clearInterval(this._linkReemitTimer);
    clearInterval(this._testModeTimer);
    this._appTimeoutTimer = null;
    this._linkReemitTimer = null;
    this._testModeTimer = null;
    this.testMode = 0;
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
  }

  // -- inbound --------------------------------------------------------------

  /** Feed one assembled line, without its newline. The caller owns framing:
   *  the CLI runs its own line assembler over the serial chunks, and
   *  WebSerialTransport has already done it in the browser. */
  receiveLine(line) {
    this._emit({ type: 'wire', dir: 'RX', line });
    this._armAppTimeout();
    if (this.appDown) {
      this.appDown = false;
      this._emit({ type: 'appBack' });
      this._note('app is back');
    }

    const msg = parseLine(line);
    if (msg === null) return; // unknown keyword: ignore silently (§2.2)
    if (msg.type === 'INVALID') {
      // Fail closed. A malformed line is discarded, never guessed at — the
      // clearest case being a v2.0-shaped gestureless EVT (§14 T7).
      this._note(`ignored malformed line: "${line}" (${msg.reason})`);
      this._emit({ type: 'malformed', line, reason: msg.reason });
      return;
    }

    switch (msg.type) {
      case 'INFO':
        this._send(this._hello());
        this._reemitLinks();
        break;
      case 'PING':
        this._send(encodePong());
        break;
      case 'ECHO':
        this._send(encodeEcho(msg.text));
        break;
      case 'ACK':
        this._handleAck(msg);
        break;
      case 'STATE':
        this._handleState(msg);
        break;
      case 'HAP':
        this._handleHap(msg);
        break;
      case 'CFG':
        this.config = { haptic: msg.haptic, bright: msg.bright };
        this._emit({ type: 'config', ...this.config });
        this._note(`config: haptic ${msg.haptic}%, brightness ${msg.bright}%`);
        break;
      case 'TEST':
        this.setTestMode(msg.mode);
        break;
      default:
        break;
    }
  }

  _handleState(msg) {
    // Always the complete indicator state for one remote — there is no partial
    // form, so a remote can never hold a stale half (§6). Idempotent by
    // construction: asserting the same state twice changes nothing.
    const next = { f1: msg.f1, f1rgb: msg.f1rgb, f2: msg.f2, f2rgb: msg.f2rgb };
    this.indicators[msg.remote] = next;
    this._emit({ type: 'indicator', remote: msg.remote, ...next });
    this._note(
      `${msg.remote} indicators: F1 ${msg.f1}${msg.f1 === 'SOLID' ? ` #${msg.f1rgb}` : ''} · ` +
        `F2 ${msg.f2}${msg.f2 === 'SOLID' ? ` #${msg.f2rgb}` : ''}`,
    );
  }

  _handleHap(msg) {
    const targets = msg.target === 'BOTH' ? REMOTES : [msg.target];
    for (const remote of targets) {
      // A haptic aimed at a remote the radio cannot reach is simply lost. The
      // app is never told: absence of confirmation is the signal (§5.3).
      const delivered = this.link[remote].state === 'CONNECTED';
      this._emit({
        type: 'haptic',
        remote,
        waveform: msg.waveform,
        amplitude: this.config.haptic,
        delivered,
        cause: 'command',
      });
    }
    this._note(`haptic ${msg.waveform} on ${msg.target}`);
  }

  _handleAck(msg) {
    const entry = this.pending.get(msg.seq);
    if (!entry) {
      // Unknown, duplicate or already-expired seq. Silently ignored: acting on
      // it would fire a tap the referee cannot account for.
      this._note(`ACK ${msg.seq} for an unknown or expired entry — ignored`);
      this._emit({ type: 'ackOrphan', seq: msg.seq });
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(msg.seq);
    const elapsedMs = Math.round(nowMono() - entry.sentAtMono);

    this._emit({ type: 'ack', seq: msg.seq, src: entry.src, silent: msg.silent, elapsedMs });

    if (msg.silent) {
      // Inert: the ruleset leaves this button unassigned, so the control is
      // dead. No haptic, no indicator, no trace — a rejection signal would be
      // more confusing than silence.
      this._note(`seq ${msg.seq} consumed silently (inert) in ${elapsedMs} ms`);
      return;
    }

    // Routed to the originating remote by the src recorded against this seq,
    // never broadcast (§10.4). A broadcast tap is indistinguishable from a
    // correct one when only one remote is being watched, and wrong in every
    // real match — which is why the emulator shows two wrists.
    this._emit({
      type: 'haptic',
      remote: entry.src,
      waveform: 'TAP',
      amplitude: this.config.haptic,
      delivered: this.link[entry.src].state === 'CONNECTED',
      cause: 'ack',
      seq: msg.seq,
      elapsedMs,
    });
    this._note(`acknowledgement TAP on ${entry.src} (${elapsedMs} ms)`);
  }

  // -- outbound -------------------------------------------------------------

  /** Emits an EVT and registers it for acknowledgement exactly as the firmware
   *  must, so the app is rehearsed against the real timing rather than a stub. */
  sendEvt(button, gesture, src) {
    if (this.link[src].state !== 'CONNECTED') {
      // A remote that is not connected cannot originate anything. Worth
      // surfacing rather than swallowing: it is the state an operator will
      // reach by accident and then wonder why presses do nothing.
      this._note(`press on ${src} dropped — remote is ${this.link[src].state}`);
      return null;
    }

    const seq = this._nextSeq();
    this._send(encodeEvt(button, gesture, src, seq));
    this._emit({ type: 'evt', button, gesture, src, seq });

    const timer = setTimeout(() => {
      this.pending.delete(seq);
      // No failure haptic, by design. Late is worse than never: a tap arriving
      // after the window makes the referee score twice, and the failure looks
      // like referee error. Absence of confirmation is the signal.
      this._emit({ type: 'ackExpired', seq, src });
      this._note(`seq ${seq} expired without ACK after ${ACK_WINDOW_MS} ms — no tap fired`);
    }, ACK_WINDOW_MS);

    this.pending.set(seq, { src, timer, sentAtMono: nowMono() });
    if (this.pending.size > 8) {
      const oldest = this.pending.keys().next().value;
      clearTimeout(this.pending.get(oldest).timer);
      this.pending.delete(oldest);
    }
    return seq;
  }

  /** Operator control over link state — the one thing this model fabricates,
   *  standing in for a radio that does not exist yet. Emits JOIN on a
   *  transition into CONNECTED, which is what drives the app's forced STATE. */
  setLink(remote, patch) {
    const before = this.link[remote].state;
    this.link[remote] = { ...this.link[remote], ...patch };
    const after = this.link[remote].state;

    this._emitLink(remote);
    this._emit({ type: 'link', remote, ...this.link[remote] });

    if (before !== 'CONNECTED' && after === 'CONNECTED') {
      // A remote that has just joined holds no indicator state. The app answers
      // JOIN with a forced STATE — the step that makes set substitution work,
      // and the easiest one to omit because nothing visibly breaks without it
      // until a remote is swapped mid-match (§6.3).
      this.indicators[remote] = null;
      this._emit({ type: 'indicator', remote, f1: 'OFF', f1rgb: '000000', f2: 'OFF', f2rgb: '000000', cleared: true });
      this._send(encodeJoin(remote));
    }
  }

  setTestMode(mode) {
    clearInterval(this._testModeTimer);
    this._testModeTimer = null;
    this.testMode = mode;

    switch (mode) {
      case 0:
        this.supervisionSuspended = false;
        this._armAppTimeout();
        this._send(encodeLog('TEST 0: stopped, supervision active'));
        return;

      case 1: {
        this._note('TEST 1: one EVT per button, PRESS, alternating RED/GREEN');
        let i = 0;
        this._testModeTimer = setInterval(() => {
          if (i >= BUTTONS.length) return this._endTestMode();
          this.sendEvt(BUTTONS[i], 'PRESS', REMOTES[i % 2]);
          i += 1;
        }, 500);
        return;
      }

      case 2:
        this._note('TEST 2: random EVT lines at ~5 Hz until TEST 0');
        this._testModeTimer = setInterval(() => {
          const button = BUTTONS[Math.floor(Math.random() * BUTTONS.length)];
          const pool = REPEATING.has(button) ? GESTURES : GESTURES.slice(0, 2);
          const gesture = pool[Math.floor(Math.random() * pool.length)];
          this.sendEvt(button, gesture, REMOTES[Math.floor(Math.random() * REMOTES.length)]);
        }, 200);
        return;

      case 3:
        // A standing trap: left on, every supervision test passes for the wrong
        // reason. The front-ends show it prominently for that reason.
        this.supervisionSuspended = true;
        clearTimeout(this._appTimeoutTimer);
        this._appTimeoutTimer = null;
        this._send(encodeLog('TEST 3: supervision suspended until TEST 0'));
        return;

      case 4: {
        // The gesture axis is new at v3.0 and no hardware produces it yet, so
        // this is the only way to exercise HOLD and HOLD_REP handling
        // exhaustively before remotes exist.
        this._note('TEST 4: every gesture on every button, both remotes');
        const script = [];
        for (const remote of REMOTES) {
          for (const button of BUTTONS) {
            for (const gesture of GESTURES) {
              if (gesture === 'HOLD_REP' && !REPEATING.has(button)) continue;
              script.push([button, gesture, remote]);
            }
          }
        }
        let i = 0;
        this._testModeTimer = setInterval(() => {
          if (i >= script.length) {
            this._send(encodeLog(`TEST 4: complete, ${script.length} events`));
            return this._endTestMode();
          }
          this.sendEvt(...script[i]);
          i += 1;
        }, 250);
        return;
      }

      case 5:
        // Not in the spec — a rehearsal convenience for the JOIN -> STATE path,
        // which is otherwise unreachable without real remotes.
        this._note('TEST 5: simulating both remotes rejoining');
        for (const remote of REMOTES) this._send(encodeJoin(remote));
        this.testMode = 0;
        return;

      default:
        this._note(`unsupported TEST mode ${mode}`);
        this.testMode = 0;
    }
  }

  // -- internals ------------------------------------------------------------

  _endTestMode() {
    clearInterval(this._testModeTimer);
    this._testModeTimer = null;
    this.testMode = 0;
    this._emit({ type: 'testMode', mode: 0 });
  }

  _hello() {
    return encodeHello(
      `${PROTOCOL_VERSION.major}.${PROTOCOL_VERSION.minor}`,
      this.fwVersion,
      this.setSerial,
      0,
    );
  }

  _nextSeq() {
    const s = this.seq;
    this.seq = (this.seq + 1) % SEQ_MODULUS;
    return s;
  }

  _send(line) {
    this._write(line);
    this._emit({ type: 'wire', dir: 'TX', line });
  }

  _emitLink(remote) {
    const s = this.link[remote];
    // RSSI is mandatory when CONNECTED — omitting it makes the app drop the
    // line silently and the signal indicator never updates (§7).
    this._send(
      s.state === 'CONNECTED' ? encodeLink(remote, s.state, s.rssi, s.batt) : encodeLink(remote, s.state),
    );
  }

  _reemitLinks() {
    for (const remote of REMOTES) this._emitLink(remote);
  }

  _armAppTimeout() {
    if (this.supervisionSuspended || !this.running) return;
    clearTimeout(this._appTimeoutTimer);
    this._appTimeoutTimer = setTimeout(() => {
      this.appDown = true;
      this._send(encodeErr('APP_TIMEOUT'));
      this._emit({ type: 'appTimeout' });
      this._note('app timed out — remotes would now render link-lost');
    }, APP_TIMEOUT_MS);
  }

  _note(text) {
    this._emit({ type: 'note', text });
  }
}
