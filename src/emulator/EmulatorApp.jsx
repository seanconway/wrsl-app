import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WebSerialTransport } from '../transport/WebSerialTransport.js';
import { DongleModel, REMOTES } from './dongleModel.js';
import RemoteMockup from './RemoteMockup.jsx';

const WIRE_LOG_LIMIT = 400;

const EMPTY_COUNTERS = { evt: 0, taps: 0, beats: 0, silent: 0, expired: 0, lastAckMs: null };

function initialRemoteState() {
  return {
    RED: { link: { state: 'CONNECTED', rssi: -50, batt: 92 }, indicators: null, haptic: null, counters: { ...EMPTY_COUNTERS } },
    GREEN: { link: { state: 'CONNECTED', rssi: -58, batt: 77 }, indicators: null, haptic: null, counters: { ...EMPTY_COUNTERS } },
  };
}

/**
 * The dongle emulator.
 *
 * Runs the real wire protocol over a real serial link to the scoreboard, which
 * connects through its ordinary Web Serial path and cannot tell this from
 * firmware. That is the whole point: the scoreboard is validated against an
 * executable copy of PROTOCOL.md before any firmware exists, so when the
 * firmware arrives the only open question is whether the firmware matches the
 * spec — not whether the spec and the application agree.
 *
 * Wiring: create a virtual serial pair (com0com on Windows, socat elsewhere).
 * The scoreboard opens one end, this page opens the other.
 */
export default function EmulatorApp() {
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [remotes, setRemotes] = useState(initialRemoteState);
  const [wire, setWire] = useState([]);
  const [notes, setNotes] = useState([]);
  const [testMode, setTestMode] = useState(0);
  const [appDown, setAppDown] = useState(false);
  const [config, setConfig] = useState({ haptic: 100, bright: 100 });

  const transportRef = useRef(null);
  const modelRef = useRef(null);
  const hapticId = useRef(0);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'wire':
        setWire((prev) => {
          const next = [...prev, { ...event, at: new Date() }];
          return next.length > WIRE_LOG_LIMIT ? next.slice(-WIRE_LOG_LIMIT) : next;
        });
        break;

      case 'note':
        setNotes((prev) => [{ text: event.text, at: new Date() }, ...prev].slice(0, 60));
        break;

      case 'indicator':
        setRemotes((prev) => ({
          ...prev,
          [event.remote]: {
            ...prev[event.remote],
            indicators: event.cleared ? null : { f1: event.f1, f1rgb: event.f1rgb, f2: event.f2, f2rgb: event.f2rgb },
          },
        }));
        break;

      case 'haptic': {
        hapticId.current += 1;
        const id = hapticId.current;
        setRemotes((prev) => {
          const r = prev[event.remote];
          const counters = { ...r.counters };
          if (event.waveform === 'BEAT') counters.beats += 1;
          if (event.waveform === 'TAP') counters.taps += 1;
          if (event.cause === 'ack' && typeof event.elapsedMs === 'number') counters.lastAckMs = event.elapsedMs;
          return {
            ...prev,
            [event.remote]: { ...r, counters, haptic: { ...event, id } },
          };
        });
        break;
      }

      case 'evt':
        setRemotes((prev) => ({
          ...prev,
          [event.src]: { ...prev[event.src], counters: { ...prev[event.src].counters, evt: prev[event.src].counters.evt + 1 } },
        }));
        break;

      case 'ack':
        if (event.silent) {
          setRemotes((prev) => ({
            ...prev,
            [event.src]: { ...prev[event.src], counters: { ...prev[event.src].counters, silent: prev[event.src].counters.silent + 1 } },
          }));
        }
        break;

      case 'ackExpired':
        setRemotes((prev) => ({
          ...prev,
          [event.src]: { ...prev[event.src], counters: { ...prev[event.src].counters, expired: prev[event.src].counters.expired + 1 } },
        }));
        break;

      case 'link':
        setRemotes((prev) => ({
          ...prev,
          [event.remote]: { ...prev[event.remote], link: { state: event.state, rssi: event.rssi, batt: event.batt } },
        }));
        break;

      case 'config':
        setConfig({ haptic: event.haptic, bright: event.bright });
        break;

      case 'appTimeout':
        setAppDown(true);
        break;
      case 'appBack':
        setAppDown(false);
        break;
      case 'testMode':
        setTestMode(event.mode);
        break;
      default:
        break;
    }
  }, []);

  const connect = async () => {
    setError(null);
    try {
      const transport = new WebSerialTransport();
      // No identity filter: the far end of a virtual pair is not a dongle and
      // matches no dongle VID/PID. The application must never do this.
      const port = await WebSerialTransport.requestPort({ filters: [] });

      const model = new DongleModel({
        write: (line) => transport.write(line),
        emit: handleEvent,
      });

      transport.onLine((line) => model.receiveLine(line));
      transport.onStatusChange((s) => {
        setStatus(s);
        if (s === 'disconnected') model.stop();
      });

      await transport.connect({ port });
      transportRef.current = transport;
      modelRef.current = model;
      model.start();
      setStatus('connected');
    } catch (err) {
      // A cancelled picker is an operator dismissing a dialog, not a fault.
      if (err?.name !== 'NotFoundError') setError(err?.message ?? String(err));
    }
  };

  const disconnect = async () => {
    modelRef.current?.stop();
    await transportRef.current?.disconnect().catch(() => {});
    transportRef.current = null;
    modelRef.current = null;
    setStatus('disconnected');
  };

  useEffect(() => () => {
    modelRef.current?.stop();
    transportRef.current?.disconnect().catch(() => {});
  }, []);

  const press = (remote, button, gesture) => modelRef.current?.sendEvt(button, gesture, remote);

  const toggleLink = (remote) => {
    const model = modelRef.current;
    if (!model) return;
    const down = model.link[remote].state !== 'CONNECTED';
    model.setLink(remote, down ? { state: 'CONNECTED' } : { state: 'DISCONNECTED' });
  };

  const runTest = (mode) => {
    modelRef.current?.setTestMode(mode);
    setTestMode(mode === 5 ? 0 : mode);
  };

  const connected = status === 'connected';

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)', padding: 'var(--sp-6)', maxWidth: 1280, margin: '0 auto' }}>
      <Header
        connected={connected}
        appDown={appDown}
        testMode={testMode}
        config={config}
        error={error}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
        {REMOTES.map((remote) => (
          <RemoteMockup
            key={remote}
            remote={remote}
            link={remotes[remote].link}
            indicators={remotes[remote].indicators}
            haptic={remotes[remote].haptic}
            counters={remotes[remote].counters}
            portOpen={connected}
            onPress={(button, gesture) => press(remote, button, gesture)}
            onToggleLink={() => toggleLink(remote)}
          />
        ))}
      </div>

      <TestPanel disabled={!connected} testMode={testMode} onRun={runTest} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--sp-5)', minHeight: 0 }}>
        <WireLog wire={wire} onClear={() => setWire([])} />
        <NoteLog notes={notes} />
      </div>
    </div>
  );
}

function Header({ connected, appDown, testMode, config, error, onConnect, onDisconnect }) {
  return (
    <header style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-24)', margin: 0 }}>Dongle emulator</h1>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-12)',
            padding: '3px 10px',
            borderRadius: 999,
            border: '1px solid var(--border-strong)',
            color: connected ? 'var(--lime-400)' : 'var(--text-muted)',
          }}
        >
          {connected ? 'serial open' : 'not connected'}
        </span>
        <button type="button" onClick={connected ? onDisconnect : onConnect} style={primaryButton}>
          {connected ? 'Close port' : 'Open serial port…'}
        </button>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          haptic {config.haptic}% · bright {config.bright}%
        </span>
      </div>

      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--fs-13)', maxWidth: '72ch' }}>
        Open the far end of a virtual serial pair here, and point the scoreboard at the other end. Keep both
        windows visible — a hidden tab is throttled, which stops the heartbeat and trips supervision.
      </p>

      {error && <Banner tone="error">{error}</Banner>}
      {appDown && <Banner tone="error">App supervision timed out — ERR APP_TIMEOUT sent. Remotes would render link-lost.</Banner>}
      {testMode === 3 && (
        <Banner tone="warn">
          TEST 3 is active: link supervision is suspended. Every supervision check will pass for the wrong reason
          until TEST 0.
        </Banner>
      )}
    </header>
  );
}

function Banner({ tone, children }) {
  const colour = tone === 'error' ? '#ff5c5c' : '#ff9500';
  return (
    <div
      style={{
        border: `1px solid ${colour}`,
        borderRadius: 'var(--r-2)',
        padding: 'var(--sp-3) var(--sp-4)',
        color: colour,
        fontSize: 'var(--fs-13)',
      }}
    >
      {children}
    </div>
  );
}

function TestPanel({ disabled, testMode, onRun }) {
  const modes = [
    [0, 'Stop / supervision on'],
    [1, 'One press per button'],
    [2, 'Random ~5 Hz soak'],
    [3, 'Suspend supervision'],
    [4, 'Every gesture, every button'],
    [5, 'Both remotes rejoin'],
  ];

  return (
    <section style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="rr-eyebrow" style={{ color: 'var(--text-muted)' }}>
        TEST modes
      </span>
      {modes.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onRun(mode)}
          style={{
            ...secondaryButton,
            borderColor: testMode === mode && mode !== 0 ? 'var(--lime-500)' : 'var(--border-strong)',
            opacity: disabled ? 0.4 : 1,
          }}
        >
          {mode} · {label}
        </button>
      ))}
    </section>
  );
}

function WireLog({ wire, onClear }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [wire]);

  return (
    <section style={panel}>
      <div style={panelHeader}>
        <span className="rr-eyebrow">Wire ({wire.length})</span>
        <button type="button" onClick={onClear} style={linkButton}>
          clear
        </button>
      </div>
      <div ref={boxRef} style={{ ...scrollBox, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {wire.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>nothing yet</span>
        ) : (
          wire.map((entry, i) => (
            <div key={i} style={{ color: entry.dir === 'TX' ? 'var(--lime-400)' : 'var(--text-body)' }}>
              {entry.at.toISOString().slice(11, 23)} {entry.dir} {entry.line}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function NoteLog({ notes }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>
        <span className="rr-eyebrow">What the dongle did</span>
      </div>
      <div style={{ ...scrollBox, fontSize: 'var(--fs-12)' }}>
        {notes.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>nothing yet</span>
        ) : (
          notes.map((n, i) => (
            <div key={i} style={{ color: 'var(--text-body)', marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {n.at.toISOString().slice(11, 19)}{' '}
              </span>
              {n.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

const panel = {
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--r-2)',
  background: 'var(--surface-card)',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  minHeight: 0,
};

const panelHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--sp-3) var(--sp-4)',
  borderBottom: '1px solid var(--border-hairline)',
};

const scrollBox = {
  overflowY: 'auto',
  maxHeight: 260,
  padding: 'var(--sp-3) var(--sp-4)',
};

const primaryButton = {
  font: 'inherit',
  fontSize: 'var(--fs-13)',
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: 'var(--r-2)',
  border: '1px solid var(--border-strong)',
  background: 'var(--ink-700)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
};

const secondaryButton = {
  font: 'inherit',
  fontSize: 'var(--fs-12)',
  padding: '6px 12px',
  borderRadius: 'var(--r-1)',
  border: '1px solid var(--border-strong)',
  background: 'transparent',
  color: 'var(--text-body)',
  cursor: 'pointer',
};

const linkButton = {
  font: 'inherit',
  fontSize: 11,
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  textDecoration: 'underline',
};
