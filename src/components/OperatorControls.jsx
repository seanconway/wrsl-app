import React, { useRef } from 'react';
import { Icon } from '../../design-system/components/core/Icon.jsx';
import { selectRuleset, isInertInput } from '../match/matchReducer.js';
import { monotonicNow } from '../match/clock.js';

const HOLD_MS = 600;
const HOLD_REPEAT_MS = 150;

/**
 * A software stand-in for the two remotes.
 *
 * Every control here dispatches the identical INPUT action a real press
 * produces — same button, same gesture, same reducer path. There is no operator
 * shortcut that bypasses what a referee can do, because a second path into
 * match state is a second thing that can be wrong.
 *
 * It also reproduces the gesture timing, which lives in remote firmware
 * (FS §4.2) and is a firmware constant there. The values below are that
 * firmware's defaults, restated so the operator surface feels the same. They
 * are NOT configuration and must not become configuration.
 */
export default function OperatorControls({ state, dispatch, disabled }) {
  const ruleset = selectRuleset(state);

  const send = (button, gesture, src) => {
    if (disabled) return;
    dispatch({ type: 'INPUT', button, gesture, src, now: monotonicNow() });
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--sp-7)',
        padding: 'var(--sp-6) var(--sp-7)',
        borderTop: '1px solid var(--border-hairline)',
        background: 'var(--surface-page)',
      }}
    >
      {['RED', 'GREEN'].map((corner) => (
        <RemotePad key={corner} corner={corner} ruleset={ruleset} state={state} send={send} disabled={disabled} />
      ))}
    </div>
  );
}

function RemotePad({ corner, ruleset, state, send, disabled }) {
  const edge = corner === 'RED' ? 'var(--athlete-red)' : 'var(--athlete-green)';

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <span className="rr-eyebrow" style={{ color: edge }}>
        {corner} remote
      </span>

      {/* The physical layout of FS §3.1: a vertical centre column flanked by two
          lateral pairs, F1 inner and F2 outer, mirrored across the remotes. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)' }}>
        <span />
        <PadButton label="+1" icon="plus" onPress={(g) => send('ADD_POINT', g, corner)} disabled={disabled} />
        <span />

        <PadButton
          label={corner === 'RED' ? '−1 sec' : 'Prev period'}
          icon="chevron-down"
          repeats
          onPress={(g) => send('BACKWARD', g, corner)}
          disabled={disabled}
        />
        {/* The tactile datum. On the hardware this is the oversized circular
            centre button every other control is found by feel from (FS §3.1),
            so here it is the visually dominant control — by weight, not by
            colour. Lime means live/valid/go, and a lime button on a stopped
            clock would say "running" when it is not. */}
        <PadButton
          label="Clock"
          icon={state.clock.running ? 'pause' : 'play'}
          datum
          onPress={(g) => send('TOGGLE_CLOCK', g, corner)}
          disabled={disabled}
        />
        <PadButton
          label={corner === 'RED' ? '+1 sec' : 'Next period'}
          icon="chevron-right"
          repeats
          onPress={(g) => send('FORWARD', g, corner)}
          disabled={disabled}
        />

        <FunctionButton slot="f2" ruleset={ruleset} state={state} corner={corner} send={send} disabled={disabled} />
        <PadButton label="−1" icon="minus" onPress={(g) => send('REMOVE_POINT', g, corner)} disabled={disabled} />
        <FunctionButton slot="f1" ruleset={ruleset} state={state} corner={corner} send={send} disabled={disabled} />
      </div>
    </div>
  );
}

function FunctionButton({ slot, ruleset, state, corner, send, disabled }) {
  const config = ruleset[slot];
  const button = slot.toUpperCase();
  const inert = isInertInput(state, button);

  return (
    <PadButton
      label={config.label ?? '—'}
      icon={slot === 'f1' ? 'chevrons-up' : 'flag'}
      // Fully inert: no action, no haptic, no indicator. A rejection signal
      // would be more confusing than silence, so the control is simply dead.
      disabled={disabled || inert}
      onPress={(g) => send(button, g, corner)}
    />
  );
}

/**
 * Press / hold / hold-repeat, discriminated on pointer events. A hold fires
 * once at the threshold — while the finger is still down, not on release —
 * because the referee's feedback has to arrive during the press.
 */
function PadButton({ label, icon, onPress, disabled, repeats = false, datum = false }) {
  const holdTimer = useRef(null);
  const repeatTimer = useRef(null);
  const held = useRef(false);

  const clear = () => {
    clearTimeout(holdTimer.current);
    clearInterval(repeatTimer.current);
    holdTimer.current = null;
    repeatTimer.current = null;
  };

  const down = () => {
    if (disabled) return;
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onPress('HOLD');
      if (repeats) repeatTimer.current = setInterval(() => onPress('HOLD_REP'), HOLD_REPEAT_MS);
    }, HOLD_MS);
  };

  const up = () => {
    if (disabled) return;
    clear();
    if (!held.current) onPress('PRESS');
    held.current = false;
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={clear}
      onPointerCancel={clear}
      style={{
        // 64px minimum for anything pressed during a live match.
        minHeight: 'var(--touch-glove)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 'var(--sp-3)',
        background: datum ? 'var(--ink-700)' : 'var(--surface-card)',
        color: 'var(--text-strong)',
        border: datum ? '2px solid var(--ink-400)' : '1px solid var(--border-strong)',
        fontWeight: datum ? 700 : 600,
        borderRadius: 'var(--r-2)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--fs-13)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        touchAction: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <Icon name={icon} size={20} />
      <span style={{ textAlign: 'center', lineHeight: 1.15 }}>{label}</span>
    </button>
  );
}
