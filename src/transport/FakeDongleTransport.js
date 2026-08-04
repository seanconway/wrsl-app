// Test double implementing the transport interface (see WebSerialTransport.js
// for the interface documentation). Records every line the app writes and
// lets tests simulate the dongle side of the link.

export class FakeDongleTransport {
  constructor() {
    this.outbox = [];
    this.connected = false;
    this._lineHandlers = new Set();
    this._statusHandlers = new Set();
  }

  async connect() {
    this.connected = true;
    this._emitStatus('connected');
  }

  async disconnect() {
    if (!this.connected) return;
    this.connected = false;
    this._emitStatus('disconnected');
  }

  write(line) {
    if (!this.connected) throw new Error('FakeDongleTransport: write() while disconnected');
    this.outbox.push(line);
  }

  onLine(callback) {
    this._lineHandlers.add(callback);
    return () => this._lineHandlers.delete(callback);
  }

  onStatusChange(callback) {
    this._statusHandlers.add(callback);
    return () => this._statusHandlers.delete(callback);
  }

  // --- test-only helpers -----------------------------------------------

  /** Simulate the dongle emitting one line to the app. */
  simulateLine(line) {
    for (const handler of this._lineHandlers) handler(line);
  }

  /** Simulate an unexpected disconnect (unplug, port closed underneath us). */
  simulateDisconnect() {
    if (!this.connected) return;
    this.connected = false;
    this._emitStatus('disconnected', { unexpected: true });
  }

  _emitStatus(status, detail) {
    for (const handler of this._statusHandlers) handler(status, detail);
  }
}
