#!/usr/bin/env node
// Plays the dongle side of the wire protocol over a real (virtual) serial
// port, for a one-time rehearsal of the app against real Web Serial before
// firmware exists. NOT part of the automated test suite — see the README
// for how to wire up a virtual port with socat / com0com.
//
// Usage:
//   node tools/fake_dongle.js <serial-path> [--script <name>]
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
  encodePong,
  encodeEcho,
  encodeEvt,
  encodeErr,
} from '../src/protocol/protocol.js';

const APP_TIMEOUT_MS = 5000;
const LINK_REEMIT_MS = 10000;
const EVT_ACTIONS = [
  'TOGGLE_TIMER',
  'ADD_POINT',
  'REMOVE_POINT',
  'TIME_UP',
  'TIME_DOWN',
  'PERIOD_UP',
  'PERIOD_DOWN',
];

function parseArgs(argv) {
  const [path, ...rest] = argv;
  if (!path) {
    console.error('Usage: node tools/fake_dongle.js <serial-path>');
    process.exit(1);
  }
  return { path, rest };
}

function log(...args) {
  console.log(new Date().toISOString().slice(11, 23), ...args);
}

class FakeDongle {
  constructor(port) {
    this.port = port;
    this.assembler = createLineAssembler();
    this.clockState = 'STOPPED';
    this.seq = 0;
    this.appTimeoutTimer = null;
    this.linkReemitTimer = null;
    this.testModeTimer = null;
    this.linkStatus = {
      RED: { state: 'CONNECTED', rssi: -50, batt: 92 },
      GREEN: { state: 'CONNECTED', rssi: -58, batt: 77 },
    };

    port.on('data', (chunk) => this._onData(chunk));
    port.on('close', () => log('port closed'));
    port.on('error', (err) => log('port error:', err.message));
  }

  start() {
    this._armAppTimeout();
    this._armLinkReemit();
    log('fake dongle running — type is not supported here, this is a scripted peer.');
    log('Waiting for INFO from the app...');
  }

  send(line) {
    this.port.write(`${line}\n`);
    log('TX', line);
  }

  nextSeq() {
    const s = this.seq;
    this.seq = (this.seq + 1) % 1000;
    return s;
  }

  _onData(chunk) {
    const lines = this.assembler.push(chunk.toString('utf8'));
    for (const line of lines) this._handleLine(line);
  }

  _handleLine(line) {
    log('RX', line);
    this._armAppTimeout();

    const msg = parseLine(line);
    if (msg === null) return; // unknown keyword: ignore silently
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
      case 'CLOCK':
        this.clockState = msg.mode === 'RUN' ? 'RUNNING' : 'STOPPED';
        log(`clock state -> ${this.clockState}`);
        break;
      case 'EXPIRE':
        log('*** expiration haptic (long pulse) ***');
        break;
      case 'CONFIRM':
        log(`*** confirmation haptic for seq ${msg.seq} ***`);
        break;
      case 'TEST':
        this._handleTest(msg.mode);
        break;
      default:
        break;
    }
  }

  _replyInfo() {
    this.send(encodeHello('2.0', '0.1.0', 0));
    for (const remote of ['RED', 'GREEN']) {
      const status = this.linkStatus[remote];
      this.send(encodeLink(remote, status.state, status.rssi, status.batt));
    }
  }

  _armAppTimeout() {
    clearTimeout(this.appTimeoutTimer);
    this.appTimeoutTimer = setTimeout(() => {
      if (this.clockState === 'RUNNING') {
        this.clockState = 'STOPPED';
        this.send(encodeErr('APP_TIMEOUT'));
        log('app timed out — heartbeat stopped');
      }
    }, APP_TIMEOUT_MS);
  }

  _armLinkReemit() {
    this.linkReemitTimer = setInterval(() => {
      for (const remote of ['RED', 'GREEN']) {
        const status = this.linkStatus[remote];
        if (status.state === 'CONNECTED') {
          this.send(encodeLink(remote, status.state, status.rssi, status.batt));
        }
      }
    }, LINK_REEMIT_MS);
  }

  _handleTest(mode) {
    clearInterval(this.testModeTimer);
    this.testModeTimer = null;

    if (mode === 0) {
      log('TEST 0: stopped');
      return;
    }

    if (mode === 1) {
      log('TEST 1: emitting each EVT action once, alternating RED/GREEN');
      let i = 0;
      const remotes = ['RED', 'GREEN'];
      this.testModeTimer = setInterval(() => {
        if (i >= EVT_ACTIONS.length) {
          clearInterval(this.testModeTimer);
          this.testModeTimer = null;
          return;
        }
        const action = EVT_ACTIONS[i];
        const src = remotes[i % 2];
        this.send(encodeEvt(action, src, this.nextSeq()));
        i += 1;
      }, 500);
      return;
    }

    if (mode === 2) {
      log('TEST 2: emitting random EVT lines at ~5Hz until TEST 0');
      const remotes = ['RED', 'GREEN'];
      this.testModeTimer = setInterval(() => {
        const action = EVT_ACTIONS[Math.floor(Math.random() * EVT_ACTIONS.length)];
        const src = remotes[Math.floor(Math.random() * remotes.length)];
        this.send(encodeEvt(action, src, this.nextSeq()));
      }, 200);
      return;
    }

    if (mode === 3) {
      log('TEST 3: link supervision suspended (bench mode) — app timeout will not fire');
      clearTimeout(this.appTimeoutTimer);
      this.appTimeoutTimer = null;
      this._armAppTimeout = () => {}; // no-op until process restart
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
  const dongle = new FakeDongle(port);
  dongle.start();
}

main().catch((err) => {
  console.error('fake_dongle failed:', err);
  process.exit(1);
});
