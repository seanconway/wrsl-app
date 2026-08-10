#!/usr/bin/env node
// Plays the dongle side of PROTOCOL.md v3.0 over a real (virtual) serial port,
// so the application can be rehearsed against actual Web Serial before any
// firmware exists. NOT part of the automated test suite — see the README for
// how to wire up a virtual port with socat / com0com.
//
// This is the headless front-end. The behaviour lives in
// src/emulator/dongleModel.js and is shared with the emulator page, which adds
// an interactive mockup of both remotes; the two cannot drift apart because
// there is only one model. Use this one when you want a scriptable dongle and
// a scrolling wire log; use the page when you want to press buttons and watch
// LEDs and haptics.
//
// Usage:
//   node tools/fake_dongle.js <serial-path> [--test <mode>]
//
// Examples:
//   node tools/fake_dongle.js /dev/ttys004
//   node tools/fake_dongle.js COM5 --test 2

import { SerialPort } from 'serialport';
import { createLineAssembler } from '../src/protocol/protocol.js';
import { DongleModel } from '../src/emulator/dongleModel.js';

function parseArgs(argv) {
  const [path, ...rest] = argv;
  if (!path) {
    console.error('Usage: node tools/fake_dongle.js <serial-path> [--test <mode>]');
    process.exit(1);
  }
  const testFlag = rest.indexOf('--test');
  const testMode = testFlag === -1 ? null : Number(rest[testFlag + 1]);
  return { path, testMode };
}

function stamp() {
  return new Date().toISOString().slice(11, 23);
}

function log(...args) {
  console.log(stamp(), ...args);
}

/** Renders the model's observation events as the log this tool has always
 *  printed. Everything the page draws as an LED or a pulse arrives here too. */
function render(event) {
  switch (event.type) {
    case 'wire':
      log(event.dir, event.line);
      break;
    case 'haptic':
      log(
        `    *** ${event.waveform} on ${event.remote} ***` +
          (event.delivered ? '' : ' [NOT DELIVERED — remote is down]'),
      );
      break;
    case 'note':
      log('   ', event.text);
      break;
    case 'ackExpired':
      log(`!!! seq ${event.seq} expired without ACK — no tap fired`);
      break;
    default:
      // indicator / config / evt / ack / link are all narrated by the model's
      // own notes; the page consumes the structured form instead.
      break;
  }
}

async function main() {
  const { path, testMode } = parseArgs(process.argv.slice(2));
  const port = new SerialPort({ path, baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1 });

  await new Promise((resolve, reject) => {
    port.on('open', resolve);
    port.on('error', reject);
  });
  log(`opened ${path} at 115200 baud`);

  const dongle = new DongleModel({
    write: (line) => port.write(`${line}\n`),
    emit: render,
  });

  // Framing is the caller's job: this end owns the assembler over raw chunks,
  // where the browser gets whole lines from WebSerialTransport.
  const assembler = createLineAssembler();
  port.on('data', (chunk) => {
    for (const line of assembler.push(chunk.toString('utf8'))) dongle.receiveLine(line);
  });
  port.on('close', () => {
    log('port closed');
    dongle.stop();
  });
  port.on('error', (err) => log('port error:', err.message));

  dongle.start();
  if (testMode !== null && Number.isFinite(testMode)) dongle.setTestMode(testMode);

  process.on('SIGINT', () => {
    dongle.stop();
    port.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error('fake_dongle failed:', err);
  process.exit(1);
});
