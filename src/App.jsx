import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMatch } from './match/useMatch.js';
import { useMatchHistory } from './match/useMatchHistory.js';
import { useWatchdog } from './match/useWatchdog.js';
import { useDongleConnection } from './dongle/useDongleConnection.js';
import { monotonicNow, formatClock } from './match/clock.js';
import { clearMatch } from './match/persistence.js';
import Scoreboard from './components/Scoreboard.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import OperatorControls from './components/OperatorControls.jsx';
import PreMatch from './components/PreMatch.jsx';
import Banner from './components/Banner.jsx';
import { Icon } from '../design-system/components/core/Icon.jsx';
import { Button } from '../design-system/components/core/Button.jsx';

export default function App() {
  const [stage, setStage] = useState('prematch'); // prematch | match
  const [detailOpen, setDetailOpen] = useState(false);
  // Collapsed by default: the on-screen remotes are a debugging and
  // bench-testing aid, not part of normal operation, and they otherwise
  // claim nearly half the display that the mat-visible scoreboard needs.
  const [controlsOpen, setControlsOpen] = useState(false);
  const [fault, setFault] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== 'undefined' && document.fullscreenElement != null,
  );

  // Tracked via the event rather than the toggle's own onClick, because
  // fullscreen can also end without it — the operator's Esc key, the browser
  // chrome, the OS. Either path needs the button's icon and label to catch up.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    // Denial (no user-gesture context, or the platform refuses) is not an
    // application fault — same rationale as the dongle port picker below.
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // The match tick stamps the watchdog, and the watchdog is constructed after
  // the match hook, so the two are joined through a ref rather than by
  // reordering them — the tick must not be restarted when the watchdog
  // re-renders, because a clock that restarts is a clock that can skip.
  const stampRef = useRef(() => {});
  const { state, dispatch, restorable, restoreMatch, discardRestorable, isForeground } = useMatch({
    onTick: () => stampRef.current(),
  });

  const history = useMatchHistory();

  // Held in a ref so the combo-hold effect below can read the match state at
  // the moment it fires without listing the whole (every-tick-changing)
  // `state` object as a dependency — same reasoning as useMatch.js's own
  // stateRef.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Remote combo-hold reset (scoreboard-update): the reducer only detects and
  // flags `comboReset` (matchReducer.js's evaluateComboHold) — this effect is
  // what actually performs the reset, snapshotting the replaced match into
  // session history first so it stays recoverable, same as the manual "New
  // match" button below.
  useEffect(() => {
    if (!state.comboReset) return;
    history.capture(stateRef.current, { reason: 'combo', src: state.comboReset.src });
    dispatch({ type: 'RESET_MATCH', now: monotonicNow() });
  }, [state.comboReset, dispatch, history]);

  const dongle = useDongleConnection(state, dispatch);

  // The watchdog's hand on the plug: on a stall it drops the serial connection
  // deliberately, so the remotes get the same unmistakable link-loss signal a
  // radio fault produces rather than an ambiguous silence (FS §8.3).
  const onStall = useCallback(() => dongle.dropForFault(), [dongle]);
  const watchdog = useWatchdog({ enabled: stage === 'match', onStall, onFault: setFault });
  stampRef.current = watchdog.stamp;

  const now = monotonicNow();
  const linkDown = dongle.handshakeState !== 'ready' || dongle.isStale;

  // Shown along the bottom bar rather than a top banner (below) — the connect
  // control that resolves this already lives down there, and a click and its
  // error belong next to each other.
  const dongleLinkError = !state.halted && linkDown;
  const dongleErrorTitle =
    dongle.handshakeState === 'refused' ? 'Dongle firmware is incompatible.' : 'No link to the dongle.';
  const dongleErrorDetail =
    dongle.handshakeState === 'refused'
      ? 'The dongle speaks a different major protocol version. Update the dongle firmware before using it.'
      : dongle.error ?? 'The referee remotes cannot reach this scoreboard. The board can still be operated from the controls below.';

  if (stage === 'prematch') {
    return (
      <div className="rr-mat" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {restorable && (
          <Banner
            tone="info"
            icon="rotate-ccw"
            title={`Unfinished match found: ${restorable.red} ${restorable.score.RED} — ${restorable.score.GREEN} ${restorable.green}`}
            detail={`Period ${restorable.periodIndex + 1}, clock at ${formatClock(restorable.clockMs)}, ${restorable.actionCount} ${restorable.actionCount === 1 ? 'action' : 'actions'} recorded.`}
            actions={[
              {
                label: 'Restore',
                onClick: () => {
                  restoreMatch();
                  setStage('match');
                },
              },
              { label: 'Discard', variant: 'secondary', onClick: discardRestorable },
            ]}
          />
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <PreMatch state={state} dispatch={dispatch} dongle={dongle} onConfirm={() => setStage('match')} />
        </div>
      </div>
    );
  }

  return (
    <div className="rr-mat" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {fault && (
        <Banner
          tone="stop"
          title="Application fault. The dongle link was dropped deliberately."
          detail={`${fault}. The remotes are showing link-lost. Reload the page, then reconnect the dongle — match state is saved.`}
          actions={[{ label: 'Reload', onClick: () => window.location.reload() }]}
        />
      )}

      {state.halted && (
        <Banner
          tone="stop"
          icon="timer"
          title="Clock halted: the elapsed-time sources disagree."
          detail={`The system clock moved ${Math.round((state.halted.divergenceMs ?? 0) / 1000)}s relative to elapsed time, which usually means the machine suspended. The match clock is stopped and holds its value. Confirm to resume from where it stands.`}
          actions={[
            { label: 'Resume', onClick: () => dispatch({ type: 'RESUME_AFTER_HALT', now: monotonicNow() }) },
          ]}
        />
      )}

      {!isForeground && (
        <Banner
          tone="warn"
          icon="monitor"
          title="Scoreboard is not in the foreground."
          detail="Browser throttling delays the heartbeat and the link supervision. Bring this window to the front for the duration of the match."
        />
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Scoreboard
              state={state}
              now={now}
              linkStatus={dongle.linkStatus}
              isStale={dongle.isStale}
              handshakeState={dongle.handshakeState}
              dispatch={dispatch}
            />
          </div>
          {controlsOpen && (
            <OperatorControls state={state} dispatch={dispatch} disabled={Boolean(state.halted)} />
          )}
        </div>

        {detailOpen && (
          <DetailPanel
            state={state}
            now={now}
            dongle={dongle}
            dispatch={dispatch}
            history={history}
            onClose={() => setDetailOpen(false)}
            onSendRaw={dongle.sendRaw}
          />
        )}
      </div>

      <footer
        style={{
          borderTop: '1px solid var(--border-hairline)',
          // Mirrors the top banner's accent trim (Banner.jsx), moved to the
          // edge facing away from the content — the bottom of the screen —
          // and in orange rather than the banner's red, so a link-lost strip
          // down here is never read as belonging to the red corner.
          borderBottom: dongleLinkError ? '3px solid var(--signal-warn)' : 'none',
        }}
      >
        {dongleLinkError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-4)',
              padding: 'var(--sp-3) var(--sp-7) 0',
            }}
          >
            <Icon name="wifi-off" size={18} color="var(--signal-warn)" />
            <span style={{ fontSize: 'var(--fs-14)', fontWeight: 600, color: 'var(--text-strong)' }}>
              {dongleErrorTitle}
            </span>
            <span style={{ fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>{dongleErrorDetail}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-5)',
            padding: 'var(--sp-4) var(--sp-7)',
          }}
        >
          <span className="rr-eyebrow">
            {dongle.identity?.set ? `SET ${dongle.identity.set}` : 'NO SET'} ·{' '}
            {state.athletes.RED.name || 'RED'} v {state.athletes.GREEN.name || 'GREEN'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            <Button
              size="md"
              variant={linkDown ? 'primary' : 'secondary'}
              iconLeft="plug-zap"
              disabled={!linkDown || !dongle.isSupported}
              style={{ height: 'var(--touch-min)' }}
              // Identical to the pre-match "Connect dongle" control — always
              // opens the port picker. Deliberately not `reconnect()`, which
              // silently reuses the last authorized port and is a different
              // operation. Swallowed for the same reason as pre-match: a
              // cancelled picker is the operator changing their mind, not a
              // fault, and the error is already surfaced above.
              onClick={() => dongle.connect().catch(() => {})}
            >
              Connect dongle
            </Button>
            <FooterButton
              icon={isFullscreen ? 'minimize' : 'maximize'}
              label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={toggleFullscreen}
            />
            <FooterButton
              icon="hand"
              label={controlsOpen ? 'Hide controls' : 'Controls'}
              onClick={() => setControlsOpen((o) => !o)}
            />
            <FooterButton icon="list" label={detailOpen ? 'Hide detail' : 'Detail'} onClick={() => setDetailOpen((o) => !o)} />
            <FooterButton
              icon="rotate-ccw"
              label="New match"
              onClick={() => {
                // The replaced match stays recoverable for the rest of the
                // session (scoreboard-update) — same retention the combo-hold
                // reset gets, above.
                history.capture(state, { reason: 'manual' });
                clearMatch();
                dispatch({ type: 'RESET_MATCH', now: monotonicNow() });
                setStage('prematch');
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rr-eyebrow"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 'var(--touch-min)',
        padding: '0 12px',
        background: 'transparent',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--r-2)',
        color: 'var(--text-body)',
        cursor: 'pointer',
        fontSize: 'var(--fs-13)',
      }}
    >
      <Icon name={icon} size={18} />
      {label}
    </button>
  );
}
