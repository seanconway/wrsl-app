import React, { useState } from 'react';
import { Button } from '../../design-system/components/core/Button.jsx';
import { Icon } from '../../design-system/components/core/Icon.jsx';
import { RULESETS, ROLE } from '../match/rulesets.js';
import { selectRuleset, selectMatchPeriods } from '../match/matchReducer.js';
import { formatClock } from '../match/clock.js';

/** Screen-only swatch for the legend below — `led_colour` is now a wire
 *  palette name (RED/GREEN/BLUE/YELLOW), not a hex value, and matching the
 *  remote's actual rendering isn't the point here (that's calibrated per
 *  RADIO_PROTOCOL.md, not by this screen). These are simply distinct,
 *  legible swatches for a referee reading the legend before a match. */
const LEGEND_SWATCH = {
  RED: '#E03127',
  GREEN: '#12A150',
  BLUE: '#00A0FF',
  YELLOW: '#F5A300',
};

/**
 * Pre-match confirmation (FS §12.3).
 *
 * This is the only point at which the referee learns the function-button
 * bindings, because the remotes carry no labelling and the bindings differ
 * across rulesets. It is not a settings screen with a confirmation attached —
 * the legend is the reason the screen exists.
 */
export default function PreMatch({ state, dispatch, dongle, onConfirm }) {
  const ruleset = selectRuleset(state);
  const periods = selectMatchPeriods(state);
  // Structural period editing (add/remove/rename) is a distinct mode from
  // this screen's default view, toggled by one button in the panel header —
  // duration stays editable either way, unaffected by this toggle.
  const [editingPeriods, setEditingPeriods] = useState(false);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 'var(--sp-9) var(--sp-10)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 'var(--sp-9)' }}>
        <header>
          <span className="rr-eyebrow">Pre-match</span>
          <h1 style={{ fontSize: 'var(--fs-39)', marginTop: 'var(--sp-3)' }}>Confirm before the bout</h1>
        </header>

        <Panel title="Ruleset">
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            {RULESETS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => dispatch({ type: 'SELECT_RULESET', rulesetId: r.id })}
                style={{
                  padding: '10px 14px',
                  background: r.id === ruleset.id ? 'var(--lime-500)' : 'transparent',
                  color: r.id === ruleset.id ? 'var(--ink-950)' : 'var(--text-body)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-2)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--fs-14)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 'var(--touch-min)',
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>
            {ruleset.name} {ruleset.version}. Durations below are the shipped defaults — verify against the rulebook in
            force.
          </p>
        </Panel>

        <Panel
          title="Period structure"
          action={
            <button
              type="button"
              onClick={() => setEditingPeriods((e) => !e)}
              style={editToggleStyle}
            >
              {editingPeriods ? 'Done' : 'Edit'}
            </button>
          }
        >
          <div style={{ display: 'flex', gap: 'var(--sp-5)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {periods.map((p, i) => (
              // Keyed on index alone, not label: the label is user-typed
              // (RENAME_PERIOD below), and keying on it would remount this
              // input — dropping focus — on every keystroke.
              <div key={i} style={{ display: 'grid', gap: 4, position: 'relative' }}>
                {/* A competition's overtime structure is exactly as editable
                    as its regulation one — nothing here distinguishes a
                    period by where it came from (`p.overtime` is a display
                    flag elsewhere, not a UI-editing distinction). */}
                {editingPeriods ? (
                  <input
                    value={p.label}
                    onChange={(e) => dispatch({ type: 'RENAME_PERIOD', index: i, label: e.target.value })}
                    style={nameInputStyle}
                  />
                ) : (
                  <span className="rr-eyebrow" style={nameLabelStyle}>
                    {p.label}
                  </span>
                )}
                <input
                  type="number"
                  min={1}
                  value={p.duration_s}
                  onChange={(e) =>
                    dispatch({ type: 'SET_PERIOD_DURATION', index: i, seconds: Number(e.target.value) })
                  }
                  style={inputStyle}
                />
                <span className="rr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--text-muted)' }}>
                  {formatClock(p.duration_s * 1000)}
                </span>
                {editingPeriods && (
                  <button
                    type="button"
                    aria-label={`Remove ${p.label}`}
                    disabled={periods.length <= 1}
                    onClick={() => dispatch({ type: 'REMOVE_PERIOD', index: i })}
                    style={{
                      position: 'absolute',
                      top: -10,
                      right: -10,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '50%',
                      color: 'var(--text-muted)',
                      cursor: periods.length <= 1 ? 'not-allowed' : 'pointer',
                      opacity: periods.length <= 1 ? 0.35 : 1,
                    }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            ))}
            {editingPeriods && (
              // A spacer matching the name field's row, so the button below
              // lines up with the duration-input row of every other column
              // rather than floating at the flex line's baseline.
              <div style={{ display: 'grid', gap: 4 }}>
                <span aria-hidden="true" style={{ ...nameInputStyle, visibility: 'hidden' }}>
                  &nbsp;
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'ADD_PERIOD', afterIndex: periods.length - 1 })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 'var(--touch-min)',
                    padding: '0 12px',
                    background: 'transparent',
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 'var(--r-2)',
                    color: 'var(--text-body)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'var(--fs-13)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="plus" size={16} />
                  Add period
                </button>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Function buttons">
          {/* The legend. F1 carries what accrues to an athlete's benefit; F2
              what counts against them, or what they are owed (FS §5.6). */}
          <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
            {['f1', 'f2'].map((slot) => {
              const config = ruleset[slot];
              return (
                <div
                  key={slot}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-5)',
                    padding: 'var(--sp-4) var(--sp-5)',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <span
                    className="rr-eyebrow"
                    style={{
                      width: 34,
                      height: 34,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px solid ${config.role === ROLE.INERT ? 'var(--border-strong)' : LEGEND_SWATCH[config.led_colour]}`,
                      color: 'var(--text-strong)',
                    }}
                  >
                    {slot.toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontSize: 'var(--fs-16)', color: 'var(--text-strong)', fontWeight: 600 }}>
                      {config.label ?? 'Inert — no action, no haptic, no indicator'}
                    </div>
                    <div className="rr-eyebrow" style={{ marginTop: 2 }}>
                      {describeRole(config.role)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Athletes">
          <p style={{ marginBottom: 'var(--sp-5)', fontSize: 'var(--fs-14)', color: 'var(--text-body)' }}>
            Confirm the athlete entered as red is the athlete wearing red. Every subsequent input depends on it.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
            {['RED', 'GREEN'].map((corner) => (
              <div
                key={corner}
                style={{
                  borderLeft: `6px solid ${corner === 'RED' ? 'var(--athlete-red)' : 'var(--athlete-green)'}`,
                  paddingLeft: 'var(--sp-5)',
                  display: 'grid',
                  gap: 'var(--sp-3)',
                }}
              >
                <span className="rr-eyebrow">{corner}</span>
                <input
                  value={state.athletes[corner].name}
                  onChange={(e) => dispatch({ type: 'SET_ATHLETE', corner, value: { name: e.target.value } })}
                  placeholder="Name"
                  style={inputStyle}
                />
                <input
                  value={state.athletes[corner].team}
                  onChange={(e) => dispatch({ type: 'SET_ATHLETE', corner, value: { team: e.target.value } })}
                  placeholder="Club or team"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Officiating set">
          {/* Cross-system association is a scoring-integrity failure, not an
              inconvenience: a remote delivering input to a neighbouring mat
              corrupts two matches at once (FS §2.3). The serial shown here is
              what the referee checks against the label on the hardware. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
            <span
              className="rr-num"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-31)', color: 'var(--text-strong)' }}
            >
              {dongle.identity?.set ?? '— — —'}
            </span>
            {['RED', 'GREEN'].map((corner) => {
              const status = dongle.linkStatus[corner];
              const ok = status.state === 'CONNECTED' && dongle.handshakeState === 'ready';
              return (
                <span
                  key={corner}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-14)' }}
                >
                  <Icon
                    name={ok ? 'radio' : 'wifi-off'}
                    size={20}
                    color={ok ? 'var(--signal-go)' : 'var(--signal-stop)'}
                  />
                  {corner} {status.state}
                  {status.batt != null ? ` · ${status.batt}%` : ''}
                  {status.rssi != null ? ` · ${status.rssi} dBm` : ''}
                </span>
              );
            })}
          </div>
          {!dongle.identity && (
            <p style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--fs-14)', color: 'var(--signal-warn)' }}>
              No dongle connected. The board can be operated from this screen, but no remote will reach it.
            </p>
          )}
        </Panel>

        <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
          <Button size="glove" onClick={onConfirm}>
            Start match
          </Button>
          {dongle.handshakeState !== 'ready' && dongle.isSupported && (
            <Button
              size="glove"
              variant="secondary"
              iconLeft="plug-zap"
              // A cancelled port picker rejects; that is the operator changing
              // their mind, not a fault, and the error is already surfaced.
              onClick={() => dongle.connect().catch(() => {})}
            >
              Connect dongle
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Fixed so the name field's row is the same height whether it's showing the
// read-only label or the rename input — that identical height is also what
// the "Add period" control's hidden spacer (below) matches against, which is
// what keeps every column's duration-input row aligned in edit mode.
const PERIOD_NAME_ROW_HEIGHT = 24;

const nameInputStyle = {
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-strong)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-13)',
  padding: '2px 6px',
  borderRadius: 'var(--r-2)',
  height: PERIOD_NAME_ROW_HEIGHT,
  boxSizing: 'border-box',
};

const nameLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  height: PERIOD_NAME_ROW_HEIGHT,
};

const editToggleStyle = {
  minHeight: 'var(--touch-min)',
  padding: '0 14px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-2)',
  color: 'var(--text-body)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-13)',
  fontWeight: 600,
  cursor: 'pointer',
};

const inputStyle = {
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-strong)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--fs-16)',
  padding: '10px 12px',
  borderRadius: 'var(--r-2)',
  minHeight: 'var(--touch-min)',
};

function Panel({ title, action, children }) {
  return (
    <section
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        padding: 'var(--sp-6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-5)' }}>
        <h2 className="rr-eyebrow" style={{ fontSize: 'var(--fs-13)' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function describeRole(role) {
  switch (role) {
    case ROLE.SECONDARY_CLOCK:
      return 'Press to assign or transfer · press again on the owner to deassign · hold to reset';
    case ROLE.COUNTER:
      return 'Press to add one · hold to correct down one';
    case ROLE.FLAG:
      return 'Press to set or move · press again on the holder to clear';
    default:
      return 'Not used in this ruleset';
  }
}
