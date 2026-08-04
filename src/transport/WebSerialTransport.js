import { createLineAssembler } from '../protocol/protocol.js';

// The transport interface every dongle transport implements:
//
//   connect({ port } = {})        -> Promise<void>   establishes the link
//   disconnect()                  -> Promise<void>   tears it down
//   write(line: string)           -> void             sends one line (adds \n)
//   onLine(cb: (line) => void)    -> unsubscribe()    fires per received line
//   onStatusChange(cb)            -> unsubscribe()    fires 'connected' | 'disconnected' | 'error'
//
// This is the ONLY module allowed to touch navigator.serial — all dongle
// protocol semantics live in DongleService and never see the transport's
// internals, so a FakeDongleTransport can stand in during tests.
export class WebSerialTransport {
  constructor({ baudRate = 115200 } = {}) {
    this.baudRate = baudRate;
    this.port = null;

    this._lineHandlers = new Set();
    this._statusHandlers = new Set();
    this._assembler = createLineAssembler();
    this._encoder = new TextEncoder();

    this._writer = null;
    this._writeChain = Promise.resolve();

    this._reader = null;
    this._readLoopActive = false;
    this._readLoopDone = null;

    this._handleHardwareDisconnect = this._handleHardwareDisconnect.bind(this);
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Previously-authorised ports, so reconnect needs no new user gesture (§8). */
  static async getAuthorizedPorts() {
    if (!WebSerialTransport.isSupported()) return [];
    return navigator.serial.getPorts();
  }

  /** Prompts the user to pick a port (first-time grant only). */
  static async requestPort() {
    return navigator.serial.requestPort();
  }

  async connect({ port } = {}) {
    if (!WebSerialTransport.isSupported()) {
      throw new Error('Web Serial API is not available in this browser.');
    }

    this.port = port ?? (await navigator.serial.requestPort());
    await this.port.open({ baudRate: this.baudRate, dataBits: 8, parity: 'none', stopBits: 1 });
    this.port.addEventListener('disconnect', this._handleHardwareDisconnect);

    this._writer = this.port.writable.getWriter();
    this._assembler.reset();
    this._startReadLoop();

    this._emitStatus('connected');
  }

  async disconnect() {
    await this._stopReadLoop();

    if (this._writer) {
      try {
        await this._writer.close();
      } catch {
        // Port may already be gone (unplugged) — nothing to clean up.
      }
      this._writer = null;
    }

    if (this.port) {
      this.port.removeEventListener('disconnect', this._handleHardwareDisconnect);
      try {
        await this.port.close();
      } catch {
        // Already closed.
      }
      this.port = null;
    }

    this._emitStatus('disconnected');
  }

  write(line) {
    if (!this._writer) {
      throw new Error('WebSerialTransport: write() called while not connected');
    }
    const bytes = this._encoder.encode(`${line}\n`);
    this._writeChain = this._writeChain
      .then(() => this._writer.write(bytes))
      .catch((err) => {
        this._emitStatus('error', { error: err });
      });
  }

  onLine(callback) {
    this._lineHandlers.add(callback);
    return () => this._lineHandlers.delete(callback);
  }

  onStatusChange(callback) {
    this._statusHandlers.add(callback);
    return () => this._statusHandlers.delete(callback);
  }

  _emitStatus(status, detail) {
    for (const handler of this._statusHandlers) handler(status, detail);
  }

  _emitLine(line) {
    for (const handler of this._lineHandlers) handler(line);
  }

  _startReadLoop() {
    const decoder = new TextDecoder();
    this._readLoopActive = true;

    this._readLoopDone = (async () => {
      // Acquire the lock for this loop's lifetime only — not the app's —
      // so the port can be cleanly closed and reopened on reconnect (§11).
      const reader = this.port.readable.getReader();
      this._reader = reader;

      try {
        while (this._readLoopActive) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            const lines = this._assembler.push(text);
            for (const line of lines) this._emitLine(line);
          }
        }
      } catch (err) {
        if (this._readLoopActive) {
          this._emitStatus('error', { error: err });
          this._handleHardwareDisconnect();
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // already released
        }
        this._reader = null;
      }
    })();
  }

  async _stopReadLoop() {
    this._readLoopActive = false;
    if (this._reader) {
      try {
        await this._reader.cancel();
      } catch {
        // ignore — loop may already be exiting
      }
    }
    if (this._readLoopDone) {
      await this._readLoopDone;
      this._readLoopDone = null;
    }
  }

  _handleHardwareDisconnect() {
    if (!this.port) return; // already torn down via an explicit disconnect()
    this._readLoopActive = false;
    this.port = null;
    this._writer = null;
    this._emitStatus('disconnected', { unexpected: true });
  }
}
