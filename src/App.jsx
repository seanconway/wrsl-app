import React, { useCallback, useRef, useState } from 'react';
import { useMatch } from './match/useMatch.js';
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

export default function App() {
  const [stage, setStage] = useState('prematch'); // prematch | match
  const [detailOpen, setDetailOpen] = useState(false);
  // Collapsed by default: the on-screen remotes are a debugging and
  // bench-testing aid, not part of normal operation, and they otherwise
  // claim nearly half the display that the mat-visible scoreboard needs.
  const [controlsOpen, setControlsOpen] = useState(false);
  const [fault, setFault] = useState(null);

  // The match tick stamps the watchdog, and the watchdog is constructed after
  // the match hook, so the two are joined through a ref rather than by
  // reordering them — the tick must not be restarted when the watchdog
  // re-renders, because a clock that restarts is a clock that can skip.
  const stampRef = useRef(() => {});
  const { state, dispatch, restorable, restoreMatch, discardRestorable, isForeground } = useMatch({
    onTick: () => stampRef.current(),
  });

  const dongle = useDongleConnection(state, dispatch);

  // The watchdog's hand on the plug: on a stall it drops the serial connection
  // deliberately, so the remotes get the same unmistakable link-loss signal a
  // radio fault produces rather than an ambiguous silence (FS §8.3).
  const onStall = useCallback(() => dongle.dropForFault(), [dongle]);
  const watchdog = useWatchdog({ enabled: stage === 'match', onStall, onFault: setFault });
  stampRef.current = watchdog.stamp;

  const now = monotonicNow();
  const linkDown = dongle.handshakeState !== 'ready' || dongle.isStale;

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

      {!state.halted && linkDown && (
        <Banner
          tone="stop"
          icon="wifi-off"
          title={dongle.handshakeState === 'refused' ? 'Dongle firmware is incompatible.' : 'No link to the dongle.'}
          detail={
            dongle.handshakeState === 'refused'
              ? 'The dongle speaks a different major protocol version. Update the dongle firmware before using it.'
              : dongle.error ?? 'The referee remotes cannot reach this scoreboard. The board can still be operated from the controls below.'
          }
          actions={
            dongle.isSupported && dongle.handshakeState !== 'refused'
              ? [
                  {
                    label: dongle.hasAuthorizedPort ? 'Reconnect' : 'Connect dongle',
                    // Swallowed deliberately: a cancelled port picker rejects,
                    // and an unhandled rejection would trip the watchdog and
                    // drop the link. The operator declining a dialog is not an
                    // application fault, and the error is already surfaced.
                    onClick: () => dongle.reconnect().catch(() => {}),
                  },
                ]
              : []
          }
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
            onClose={() => setDetailOpen(false)}
            onSendRaw={dongle.sendRaw}
          />
        )}
      </div>

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-5)',
          padding: 'var(--sp-4) var(--sp-7)',
          borderTop: '1px solid var(--border-hairline)',
        }}
      >
        <span className="rr-eyebrow">
          {dongle.identity?.set ? `SET ${dongle.identity.set}` : 'NO SET'} ·{' '}
          {state.athletes.RED.name || 'RED'} v {state.athletes.GREEN.name || 'GREEN'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-4)' }}>
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
              // Reset is a scoreboard action, never a wrist one. The remotes are
              // used only during match operation (FS §12.4).
              clearMatch();
              dispatch({ type: 'RESET_MATCH', now: monotonicNow() });
              setStage('prematch');
            }}
          />
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
