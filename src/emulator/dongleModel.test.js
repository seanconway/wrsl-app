import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DongleModel, ACK_WINDOW_MS, APP_TIMEOUT_MS } from './dongleModel.js';

/**
 * The model is the executable reference for the dongle half of PROTOCOL.md, so
 * these are the cases the firmware will have to satisfy too — the same §14
 * cases the app's own suite covers, asserted from the other side of the wire.
 *
 * They matter for a second reason: the model is what the scoreboard is
 * validated against before firmware exists. A model that drifts from the spec
 * would validate the application against the wrong contract, and nothing would
 * indicate it.
 */

function harness() {
  const wire = [];
  const events = [];
  const model = new DongleModel({
    write: (line) => wire.push(line),
    emit: (event) => events.push(event),
  });

  return {
    model,
    wire,
    events,
    of: (type) => events.filter((e) => e.type === type),
    clear() {
      wire.length = 0;
      events.length = 0;
    },
  };
}

describe('DongleModel', () => {
  let h;

  beforeEach(() => {
    vi.useFakeTimers();
    h = harness();
    h.model.start();
  });

  afterEach(() => {
    h.model.stop();
    vi.useRealTimers();
  });

  describe('handshake', () => {
    it('announces v4.0 at boot without waiting to be asked', () => {
      // Best-effort and never gated on DTR — a dongle that waits for the
      // signal enumerates and then never answers.
      expect(h.wire[0]).toMatch(/^HELLO 4\.0 /);
    });

    it('answers INFO with HELLO and one LINK line per remote', () => {
      h.clear();
      h.model.receiveLine('INFO');

      expect(h.wire.filter((l) => l.startsWith('HELLO'))).toHaveLength(1);
      // RSSI is mandatory when CONNECTED: without it the app drops the line
      // and the signal indicator silently never updates (§7).
      expect(h.wire.filter((l) => /^LINK (RED|GREEN) CONNECTED -\d+ \d+$/.test(l))).toHaveLength(2);
    });

    it('answers PING and ECHO', () => {
      h.clear();
      h.model.receiveLine('PING');
      h.model.receiveLine('ECHO hello');
      expect(h.wire).toEqual(['PONG', 'ECHO hello']);
    });
  });

  describe('fails closed', () => {
    it('discards a malformed line rather than guessing at it', () => {
      h.clear();
      h.model.receiveLine('ACK');
      expect(h.of('malformed')).toHaveLength(1);
      expect(h.wire).toHaveLength(0);
    });

    it('ignores an unknown keyword silently (§2.2 forward compatibility)', () => {
      h.clear();
      h.model.receiveLine('FUTURE THING 1 2 3');
      expect(h.of('malformed')).toHaveLength(0);
      expect(h.wire).toHaveLength(0);
    });
  });

  describe('acknowledgement', () => {
    it('routes the tap to the originating remote, never broadcast', () => {
      // A broadcast tap is indistinguishable from a correct one when only one
      // remote is being watched, and wrong in every real match (§10.4).
      h.clear();
      const seq = h.model.sendEvt('ADD_POINT', 'PRESS', 'GREEN');
      expect(h.wire[0]).toBe(`EVT ADD_POINT PRESS GREEN ${seq}`);

      h.model.receiveLine(`ACK ${seq}`);
      const taps = h.of('haptic').filter((e) => e.cause === 'ack');
      expect(taps).toHaveLength(1);
      expect(taps[0]).toMatchObject({ remote: 'GREEN', waveform: 'TAP' });
    });

    it('fires nothing at all for a SILENT ack', () => {
      // Inert: the ruleset leaves the button unassigned, so the control is
      // dead. A rejection signal would be more confusing than silence.
      h.clear();
      const seq = h.model.sendEvt('F1', 'PRESS', 'RED');
      h.model.receiveLine(`ACK ${seq} SILENT`);

      expect(h.of('haptic')).toHaveLength(0);
      expect(h.of('ack')[0]).toMatchObject({ silent: true });
    });

    it('degrades to silence when the window expires, and ignores a late ack', () => {
      // Late is worse than never: a tap arriving after the window makes the
      // referee score twice, and the failure looks like referee error.
      h.clear();
      const seq = h.model.sendEvt('ADD_POINT', 'PRESS', 'RED');
      vi.advanceTimersByTime(ACK_WINDOW_MS + 10);

      expect(h.of('ackExpired')).toHaveLength(1);
      expect(h.of('haptic')).toHaveLength(0);

      h.model.receiveLine(`ACK ${seq}`);
      expect(h.of('haptic')).toHaveLength(0);
      expect(h.of('ackOrphan')).toHaveLength(1);
    });

    it('allocates a fresh seq per event and wraps at the 16-bit modulus', () => {
      h.model.seq = 65535;
      expect(h.model.sendEvt('ADD_POINT', 'PRESS', 'RED')).toBe(65535);
      expect(h.model.sendEvt('ADD_POINT', 'PRESS', 'RED')).toBe(0);
    });
  });

  describe('downlink', () => {
    it('holds the full indicator state asserted by STATE', () => {
      h.model.receiveLine('STATE RED SOLID BLUE OFF RED');
      expect(h.model.indicators.RED).toEqual({ f1: 'SOLID', f1colour: 'BLUE', f2: 'OFF', f2colour: 'RED' });
    });

    it('is idempotent — the same STATE twice changes nothing', () => {
      h.model.receiveLine('STATE RED SOLID BLUE OFF RED');
      const first = h.model.indicators.RED;
      h.clear();
      h.model.receiveLine('STATE RED SOLID BLUE OFF RED');
      expect(h.model.indicators.RED).toEqual(first);
      expect(h.wire).toHaveLength(0);
    });

    it('delivers a targeted haptic to one remote and BOTH to two', () => {
      h.clear();
      h.model.receiveLine('HAP RED BEAT');
      expect(h.of('haptic')).toHaveLength(1);
      expect(h.of('haptic')[0]).toMatchObject({ remote: 'RED', waveform: 'BEAT' });

      h.clear();
      h.model.receiveLine('HAP BOTH LONG');
      expect(h.of('haptic').map((e) => e.remote)).toEqual(['RED', 'GREEN']);
    });

    it('scales haptics by CFG without collapsing waveform identity', () => {
      // CFG is a global scale factor. It cannot compress the amplitude
      // separation between a beat and a tap, which is a firmware property of
      // the waveforms themselves (§6.4) and load-bearing for scoring.
      h.model.receiveLine('CFG BOTH 50 50');
      h.clear();
      h.model.receiveLine('HAP RED BEAT');
      expect(h.of('haptic')[0]).toMatchObject({ waveform: 'BEAT', amplitude: 50 });
    });
  });

  describe('link state', () => {
    it('emits DISCONNECTED without an RSSI value', () => {
      h.clear();
      h.model.setLink('RED', { state: 'DISCONNECTED' });
      expect(h.wire).toContain('LINK RED DISCONNECTED');
    });

    it('drops a press from a remote that is not connected', () => {
      h.model.setLink('RED', { state: 'DISCONNECTED' });
      h.clear();
      expect(h.model.sendEvt('ADD_POINT', 'PRESS', 'RED')).toBeNull();
      expect(h.wire).toHaveLength(0);
    });

    it('emits JOIN on reconnect and clears the stale indicator state', () => {
      // The app answers JOIN with a forced STATE. That step is what makes set
      // substitution work and is the easiest to omit, because nothing visibly
      // breaks without it until a remote is swapped mid-match (§6.3).
      h.model.setLink('RED', { state: 'DISCONNECTED' });
      h.model.receiveLine('STATE RED SOLID BLUE OFF RED');
      h.clear();

      h.model.setLink('RED', { state: 'CONNECTED' });
      expect(h.wire).toContain('JOIN RED');
      expect(h.model.indicators.RED).toBeNull();
    });

    it('does not fire a haptic into a remote the radio cannot reach', () => {
      h.model.setLink('GREEN', { state: 'DISCONNECTED' });
      h.clear();
      h.model.receiveLine('HAP GREEN TAP');
      expect(h.of('haptic')[0]).toMatchObject({ remote: 'GREEN', delivered: false });
    });
  });

  describe('supervision', () => {
    it('reports APP_TIMEOUT when the app stops talking', () => {
      h.clear();
      vi.advanceTimersByTime(APP_TIMEOUT_MS + 100);
      expect(h.wire).toContain('ERR APP_TIMEOUT');
      expect(h.of('appTimeout')).toHaveLength(1);
    });

    it('is held open by any inbound line', () => {
      vi.advanceTimersByTime(APP_TIMEOUT_MS - 200);
      h.model.receiveLine('PING');
      h.clear();
      vi.advanceTimersByTime(APP_TIMEOUT_MS - 200);
      expect(h.wire).not.toContain('ERR APP_TIMEOUT');
    });

    it('recovers without a reboot when the app returns', () => {
      vi.advanceTimersByTime(APP_TIMEOUT_MS + 100);
      h.clear();
      h.model.receiveLine('PING');
      expect(h.of('appBack')).toHaveLength(1);
    });

    it('TEST 3 suspends supervision — the trap that makes tests pass wrongly', () => {
      h.model.setTestMode(3);
      h.clear();
      vi.advanceTimersByTime(APP_TIMEOUT_MS * 2);
      expect(h.wire).not.toContain('ERR APP_TIMEOUT');

      h.model.setTestMode(0);
      vi.advanceTimersByTime(APP_TIMEOUT_MS + 100);
      expect(h.wire).toContain('ERR APP_TIMEOUT');
    });
  });

  describe('TEST modes', () => {
    it('TEST 1 emits exactly one press per button with contiguous seq', () => {
      h.clear();
      h.model.setTestMode(1);
      vi.advanceTimersByTime(500 * 8);

      const evts = h.wire.filter((l) => l.startsWith('EVT '));
      expect(evts).toHaveLength(7);
      const seqs = evts.map((l) => Number(l.split(' ').pop()));
      expect(seqs).toEqual([0, 1, 2, 3, 4, 5, 6]);
      // Alternating remotes, so ack routing is exercised rather than assumed.
      expect(evts.map((l) => l.split(' ')[3])).toEqual(['RED', 'GREEN', 'RED', 'GREEN', 'RED', 'GREEN', 'RED']);
    });

    it('TEST 4 sweeps every gesture, repeating only the clock adjustments', () => {
      h.clear();
      h.model.setTestMode(4);
      vi.advanceTimersByTime(250 * 40);

      const evts = h.wire.filter((l) => l.startsWith('EVT ')).map((l) => l.split(' '));
      const repeats = evts.filter(([, , gesture]) => gesture === 'HOLD_REP');
      expect(new Set(repeats.map(([, button]) => button))).toEqual(new Set(['FORWARD', 'BACKWARD']));
      // Seven buttons x two gestures, plus hold-repeat on the two that repeat.
      expect(evts).toHaveLength((7 * 2 + 2) * 2);
    });

    it('TEST 5 rejoins both remotes', () => {
      h.clear();
      h.model.setTestMode(5);
      expect(h.wire).toEqual(['JOIN RED', 'JOIN GREEN']);
    });
  });
});
