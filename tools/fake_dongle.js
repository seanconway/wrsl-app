#!/usr/bin/env node
// Plays the dongle side of PROTOCOL.md v3.0 over a real (virtual) serial port,
// so the application can be rehearsed against actual Web Serial before any
// firmware exists. NOT part of the automated test suite — see the README for
// how to wire up a virtual port with socat / com0com.
//
// It answers INFO, PING and ECHO; logs every STATE, HAP, CFG and ACK it
// receives; enforces the app-supervision timeout of §8; and drives all five
// TEST modes of §10.2.
//
// Usage:
//   node tools/fake_dongle.js <serial-path>
//
// Examples:
//   node tools/fake_dongle.js /dev/ttys004
//   node tools/fake_dongle.js COM5

import { SerialPort } from 'serialport';
import {
  createLineAssembler,
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
} from '../src/protocol/protocol.js';

const APP_TIMEOUT_MS = 2500;
const LINK_REEMIT_MS = 10000;
const ACK_WINDOW_MS = 120;
const SET_SERIAL = 'RR-0147';
const FW_VERSION = '0.2.0-fake';

const REMOTES = ['RED', 'GREEN'];
// Hold-repeat exists only for clock adjustment (§5.1).
const REPEATING = new Set(['FORWARD', 'BACKWARD']);

function parseArgs(argv) {
  const [path] = argv;
  if (!path) {
    console.error('Usage: node tools/fake_dongle.js <serial-path>');
    process.exit(1);
  }
  return { path };
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 23), ...args);
}

class FakeDongle {
  constructor(port) {
    this.port = port;
    this.assembler = createLineAssembler();
    this.seq = 0;
    this.appTimeoutTimer = null;
    this.linkReemitTimer = null;
    this.testModeTimer = null;
    this.supervisionSuspended = false;
    this.appDown = false;

    // The pending table of §5.3: seq -> { src, timer }. Eight entries is ample.
    this.pending = new Map();

    this.config = { haptic: 100, bright: 100 };
    this.linkStatus = {
      RED: { state: 'CONNECTED', rssi: -50, batt: 92 },
      GREEN: { state: 'CONNECTED', rssi: -58, batt: 77 },
    };
    this.indicators = { RED: null, GREEN: null };

    port.on('data', (chunk) => this._onData(chunk));
    port.on('close', () => log('port closed'));
    port.on('error', (err) => log('port error:', err.message));
  }

  start() {
    this._armAppTimeout();
    this.linkReemitTimer = setInterval(() => this._reemitLinks(), LINK_REEMIT_MS);
    // Boot-time HELLO is best-effort and never gated on DTR (§4.2).
    this.send(encodeHello(`${PROTOCOL_VERSION.major}.${PROTOCOL_VERSION.minor}`, FW_VERSION, SET_SERIAL, 0));
    log('fake dongle running. Waiting for INFO from the app...');
  }

  send(line) {
    this.port.write(`${line}\n`);
    log('TX', line);
  }

  nextSeq() {
    const s = this.seq;
    this.seq = (this.seq + 1) % SEQ_MODULUS;
    return s;
  }

  /** Emits an EVT and registers it for acknowledgement, exactly as the firmware
   *  must — so the app is rehearsed against the real timing, not a stub. */
  sendEvt(button, gesture, src) {
    const seq = this.nextSeq();
    this.send(encodeEvt(button, gesture, src, seq));

    const timer = setTimeout(() => {
      this.pending.delete(seq);
      // No failure haptic, by design. Absence of confirmation is the signal:
      // no tap means the press did not land, press again.
      log(`!!! seq ${seq} expired without ACK after ${ACK_WINDOW_MS} ms — no tap fired`);
    }, ACK_WINDOW_MS);

    this.pending.set(seq, { src, timer, sentAt: Date.now() });
    if (this.pending.size > 8) {
      const oldest = this.pending.keys().next().value;
      clearTimeout(this.pending.get(oldest).timer);
      this.pending.delete(oldest);
    }
    return seq;
  }

  _onData(chunk) {
    const lines = this.assembler.push(chunk.toString('utf8'));
    for (const line of lines) this._handleLine(line);
  }

  _handleLine(line) {
    log('RX', line);
    this._armAppTimeout();
    if (this.appDown) {
      this.appDown = false;
      log('app is back');
    }

    const msg = parseLine(line);
    if (msg === null) return; // unknown keyword: ignore silently (§2.2)
    if (msg.type === 'INVALID') {
      log(`ignored malformed line: "${line}" (${msg.reason})`);
      return;
    }

    switch (msg.type) {
      case 'INFO':
        this._replyInfo();
        break;
      case 'PING':
        this.send(encodePong());
        break;
      case 'ECHO':
        this.send(encodeEcho(msg.text));
        break;
      case 'ACK':
        this._handleAck(msg);
        break;
      case 'STATE':
        this.indicators[msg.remote] = msg;
        log(
          `    ${msg.remote} indicators: F1 ${msg.f1}${msg.f1 === 'SOLID' ? ` #${msg.f1rgb}` : ''} · ` +
            `F2 ${msg.f2}${msg.f2 === 'SOLID' ? ` #${msg.f2rgb}` : ''}`,
        );
        break;
      case 'HAP':
        log(`    *** haptic ${msg.waveform} on ${msg.target} ***`);
        break;
      case 'CFG':
        this.config = { haptic: msg.haptic, bright: msg.bright };
        log(`    config: haptic ${msg.haptic}%, brightness ${msg.bright}%`);
        break;
      case 'TEST':
        this._handleTest(msg.mode);
        break;
      default:
        break;
    }
  }

  _handleAck(msg) {
    const entry = this.pending.get(msg.seq);
    if (!entry) {
      // Unknown or already-acknowledged seq: ignore silently.
      log(`    ACK ${msg.seq} for an unknown or expired entry — ignored`);
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(msg.seq);
    const elapsed = Date.now() - entry.sentAt;
    log(
      msg.silent
        ? `    seq ${msg.seq} consumed silently (inert) in ${elapsed} ms`
        : `    *** acknowledgement TAP on ${entry.src} *** (${elapsed} ms)`,
    );
  }

  _replyInfo() {
    this.send(encodeHello(`${PROTOCOL_VERSION.major}.${PROTOCOL_VERSION.minor}`, FW_VERSION, SET_SERIAL, 0));
    this._reemitLinks();
  }

  _reemitLinks() {
    for (const remote of REMOTES) {
      const status = this.linkStatus[remote];
      if (status.state === 'CONNECTED') {
        this.send(encodeLink(remote, status.state, status.rssi, status.batt));
      } else {
        this.send(encodeLink(remote, status.state));
      }
    }
  }

  _armAppTimeout() {
    if (this.supervisionSuspended) return;
    clearTimeout(this.appTimeoutTimer);
    this.appTimeoutTimer = setTimeout(() => {
      this.appDown = true;
      this.send(encodeErr('APP_TIMEOUT'));
      log('app timed out — remotes would now render link-lost');
    }, APP_TIMEOUT_MS);
  }

  _handleTest(mode) {
    clearInterval(this.testModeTimer);
    this.testModeTimer = null;

    if (mode === 0) {
      this.supervisionSuspended = false;
      this._armAppTimeout();
      this.send(encodeLog('TEST 0: stopped, supervision active'));
      return;
    }

    if (mode === 1) {
      log('TEST 1: one EVT per button, PRESS, alternating RED/GREEN');
      let i = 0;
      this.testModeTimer = setInterval(() => {
        if (i >= BUTTONS.length) {
          clearInterval(this.testModeTimer);
          this.testModeTimer = null;
          return;
        }
        this.sendEvt(BUTTONS[i], 'PRESS', REMOTES[i % 2]);
        i += 1;
      }, 500);
      return;
    }

    if (mode === 2) {
      log('TEST 2: random EVT lines at ~5 Hz until TEST 0');
      this.testModeTimer = setInterval(() => {
        const button = BUTTONS[Math.floor(Math.random() * BUTTONS.length)];
        const pool = REPEATING.has(button) ? GESTURES : GESTURES.slice(0, 2);
        const gesture = pool[Math.floor(Math.random() * pool.length)];
        this.sendEvt(button, gesture, REMOTES[Math.floor(Math.random() * REMOTES.length)]);
      }, 200);
      return;
    }

    if (mode === 3) {
      this.supervisionSuspended = true;
      clearTimeout(this.appTimeoutTimer);
      this.appTimeoutTimer = null;
      this.send(encodeLog('TEST 3: supervision suspended until TEST 0'));
      return;
    }

    if (mode === 4) {
      // The gesture axis is new at v3.0 and no hardware exists that can produce
      // it, so this is the only way to exercise the app's HOLD and HOLD_REP
      // handling before remotes are built.
      log('TEST 4: every gesture on every button, both remotes');
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
      this.testModeTimer = setInterval(() => {
        if (i >= script.length) {
          clearInterval(this.testModeTimer);
          this.testModeTimer = null;
          this.send(encodeLog(`TEST 4: complete, ${script.length} events`));
          return;
        }
        this.sendEvt(...script[i]);
        i += 1;
      }, 250);
      return;
    }

    if (mode === 5) {
      // Not in the spec — a rehearsal convenience for the JOIN -> STATE path,
      // which is otherwise unreachable without real remotes.
      log('TEST 5: simulating both remotes rejoining');
      for (const remote of REMOTES) this.send(encodeJoin(remote));
      return;
    }

    log(`unsupported TEST mode ${mode}`);
  }
}

async function main() {
  const { path } = parseArgs(process.argv.slice(2));
  const port = new SerialPort({ path, baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1 });

  await new Promise((resolve, reject) => {
    port.on('open', resolve);
    port.on('error', reject);
  });

  log(`opened ${path} at 115200 baud`);
  new FakeDongle(port).start();
}

main().catch((err) => {
  console.error('fake_dongle failed:', err);
  process.exit(1);
});
