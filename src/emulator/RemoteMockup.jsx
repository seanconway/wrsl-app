import React, { useEffect, useRef, useState } from 'react';
import { useGestureHandlers } from '../components/useGesture.js';

/**
 * One wrist remote, drawn as the physical object.
 *
 * The point of this component is the two things a dongle's own LEDs can never
 * show: WHICH remote a haptic landed on, and HOW STRONG it was relative to the
 * others. Acknowledgement routing (§10.4) and the beat/tap amplitude
 * separation (FS §11.1) are the two assumptions the scoring interface rests on,
 * and both are invisible on a bench with one indicator.
 *
 * The haptic rendering is visual and proves nothing about what a real ERM
 * feels like on a wrist through a strap — that stays a hardware question
 * (PLAN.md §7, R3 and R4). What it does prove is that the right waveform was
 * commanded, to the right remote, at the right moment.
 */

// Relative amplitudes as FS §11 describes them. Expiry must be unmistakable;
// the heartbeat must be countable and clearly weaker than an acknowledgement,
// because a referee who cannot tell them apart miscounts a near fall.
const WAVEFORM_RENDER = {
  TAP: { amp: 0.7, ms: 70, pulses: 1, label: 'tap' },
  BEAT: { amp: 0.3, ms: 55, pulses: 1, label: 'beat' },
  WARN: { amp: 0.85, ms: 280, pulses: 1, label: 'warning' },
  BUZZ: { amp: 0.6, ms: 180, pulses: 1, label: 'buzz' },
  LONG: { amp: 1.0, ms: 700, pulses: 1, label: 'expiry' },
  DOUBLE: { amp: 0.7, ms: 110, pulses: 2, label: 'double' },
  TRIPLE: { amp: 0.7, ms: 110, pulses: 3, label: 'triple' },
};

const BUTTON_LAYOUT = [
  [null, { id: 'ADD_POINT', label: '+1' }, null],
  [
    { id: 'BACKWARD', label: '◀ back', repeats: true },
    { id: 'TOGGLE_CLOCK', label: 'CLOCK', datum: true },
    { id: 'FORWARD', label: 'fwd ▶', repeats: true },
  ],
  [{ id: 'F2', label: 'F2' }, { id: 'REMOVE_POINT', label: '−1' }, { id: 'F1', label: 'F1' }],
];

export default function RemoteMockup({ remote, link, indicators, haptic, counters, portOpen, onPress, onToggleLink }) {
  const edge = remote === 'RED' ? 'var(--athlete-red)' : 'var(--athlete-green)';
  // Two separate reasons a button can be dead, and they must not be conflated:
  // no serial port means there is nothing to talk to, while a downed link is
  // the radio being simulated as out. The second is a thing under test.
  const linkUp = link.state === 'CONNECTED';
  const connected = linkUp && portOpen;

  return (
    <section
      style={{
        border: `2px solid ${edge}`,
        borderRadius: 'var(--r-3)',
        background: 'var(--surface-card)',
        padding: 'var(--sp-5)',
        display: 'grid',
        gap: 'var(--sp-4)',
        opacity: connected ? 1 : 0.55,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span className="rr-eyebrow" style={{ color: edge, fontWeight: 700 }}>
          {remote} remote
        </span>
        <button
          type="button"
          onClick={onToggleLink}
          disabled={!portOpen}
          style={{
            font: 'inherit',
            fontSize: 'var(--fs-12)',
            padding: '4px 10px',
            borderRadius: 'var(--r-1)',
            border: '1px solid var(--border-strong)',
            background: 'transparent',
            color: 'var(--text-body)',
            cursor: portOpen ? 'pointer' : 'not-allowed',
            opacity: portOpen ? 1 : 0.4,
          }}
        >
          {linkUp ? 'simulate link loss' : 'reconnect'}
        </button>
      </header>

      <IndicatorRow link={link} indicators={indicators} portOpen={portOpen} />
      <HapticMotor haptic={haptic} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-2)' }}>
        {BUTTON_LAYOUT.flat().map((btn, i) =>
          btn === null ? (
            <span key={i} />
          ) : (
            <RemoteButton
              key={btn.id}
              {...btn}
              disabled={!connected}
              onPress={(gesture) => onPress(btn.id, gesture)}
            />
          ),
        )}
      </div>

      <Counters counters={counters} />
    </section>
  );
}

/** The four indicators of FS §10: power, link, and the two function LEDs. Only
 *  F1 and F2 come off the wire — power and link are device-local state, which
 *  is why a remote can render link loss with nothing to tell it to. */
function IndicatorRow({ link, indicators, portOpen }) {
  const connected = link.state === 'CONNECTED';
  const batteryLow = link.batt <= 20;

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
      <Led label="PWR" on={batteryLow ? true : link.batt > 0} colour={batteryLow ? '#ff9500' : '#38d430'} />
      <Led label="LINK" on={connected} colour="#00a0ff" blink={!connected} />
      <Led
        label="F1"
        on={indicators?.f1 === 'SOLID'}
        colour={indicators?.f1 === 'SOLID' ? `#${indicators.f1rgb}` : '#333'}
      />
      <Led
        label="F2"
        on={indicators?.f2 === 'SOLID'}
        colour={indicators?.f2 === 'SOLID' ? `#${indicators.f2rgb}` : '#333'}
      />
      <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
        {connected ? `${link.rssi} dBm · ${link.batt}%` : link.state.toLowerCase()}
      </span>
      {!indicators && connected && portOpen && (
        // A remote that has just joined holds nothing until the app asserts
        // STATE. Worth showing: the missing assertion is invisible otherwise.
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>awaiting STATE</span>
      )}
    </div>
  );
}

function Led({ label, on, colour, blink = false }) {
  return (
    <span style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on ? colour : '#1a1a1a',
          border: '1px solid var(--border-hairline)',
          boxShadow: on ? `0 0 10px 2px ${colour}` : 'none',
          transition: 'background 90ms linear, box-shadow 90ms linear',
          animation: blink ? 'rr-blink 1s steps(2, start) infinite' : 'none',
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
    </span>
  );
}

/**
 * The ERM, drawn. Amplitude is size and glow; the label names the waveform.
 * A beat next to a tap should read as obviously weaker at a glance — that is
 * the separation the whole repeated-press input model depends on.
 */
function HapticMotor({ haptic }) {
  const [pulse, setPulse] = useState(null);
  const timers = useRef([]);

  useEffect(() => {
    if (!haptic) return;
    const spec = WAVEFORM_RENDER[haptic.waveform] ?? WAVEFORM_RENDER.TAP;
    // CFG scales everything globally but cannot compress the separation
    // between waveforms — that is a firmware property (§6.4).
    const scale = (haptic.amplitude ?? 100) / 100;

    for (const t of timers.current) clearTimeout(t);
    timers.current = [];

    for (let i = 0; i < spec.pulses; i += 1) {
      timers.current.push(
        setTimeout(() => setPulse({ ...spec, amp: spec.amp * scale, id: `${haptic.id}-${i}` }), i * (spec.ms + 90)),
      );
      timers.current.push(setTimeout(() => setPulse(null), i * (spec.ms + 90) + spec.ms));
    }

    return () => {
      for (const t of timers.current) clearTimeout(t);
    };
  }, [haptic]);

  const amp = pulse?.amp ?? 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          flexShrink: 0,
          background: amp > 0 ? `rgba(200,255,60,${0.25 + amp * 0.75})` : 'var(--ink-700)',
          border: '1px solid var(--border-strong)',
          transform: `scale(${1 + amp * 0.35})`,
          boxShadow: amp > 0 ? `0 0 ${12 + amp * 28}px ${amp * 8}px rgba(200,255,60,${amp * 0.5})` : 'none',
          transition: 'transform 40ms ease-out, background 40ms linear, box-shadow 40ms linear',
        }}
      />
      <div style={{ display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>haptic</span>
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', minHeight: '1.2em' }}>
          {pulse ? pulse.label : '—'}
        </strong>
        {haptic && haptic.delivered === false && (
          <span style={{ fontSize: 11, color: '#ff9500' }}>not delivered — remote down</span>
        )}
      </div>
    </div>
  );
}

function RemoteButton({ id, label, repeats = false, datum = false, disabled, onPress }) {
  const gesture = useGestureHandlers({ onPress, repeats, disabled });

  return (
    <button
      type="button"
      disabled={disabled}
      {...gesture}
      title={`${id}${repeats ? ' (hold repeats)' : ''}`}
      style={{
        minHeight: datum ? 76 : 60,
        borderRadius: datum ? '50%' : 'var(--r-2)',
        background: datum ? 'var(--ink-700)' : 'var(--surface-page)',
        border: datum ? '2px solid var(--ink-400)' : '1px solid var(--border-strong)',
        color: 'var(--text-strong)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--fs-12)',
        fontWeight: datum ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

function Counters({ counters }) {
  const cells = [
    ['events', counters.evt],
    ['taps', counters.taps],
    ['beats', counters.beats],
    ['silent', counters.silent],
    ['no tap', counters.expired],
    ['last ack', counters.lastAckMs === null ? '—' : `${counters.lastAckMs} ms`],
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--sp-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-hairline)',
        paddingTop: 'var(--sp-3)',
      }}
    >
      {cells.map(([label, value]) => (
        <span key={label}>
          {label}: <strong style={{ color: counters.expired > 0 && label === 'no tap' ? '#ff5c5c' : 'var(--text-body)' }}>{value}</strong>
        </span>
      ))}
    </div>
  );
}
