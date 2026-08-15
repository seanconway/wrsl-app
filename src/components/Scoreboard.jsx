import React from 'react';
import { Icon } from '../../design-system/components/core/Icon.jsx';
import { formatClock, formatPadded, formatPaddedCeil, remainingMs } from '../match/clock.js';
import {
  selectRuleset,
  selectPeriod,
  selectPeriodCount,
  selectDifferential,
  selectSecondaryRemainingMs,
  selectSecondaryAccruing,
} from '../match/matchReducer.js';
import { ROLE, secondaryClockSlot } from '../match/rulesets.js';

/**
 * The primary tier (FS §8.4): everything that must be legible from across a
 * competition hall, always visible, never relegated to the detail panel.
 *
 *   athlete names and colours · score · period and match clock ·
 *   the secondary clock when active · link and battery for both remotes
 *
 * Link and battery sit here despite not interesting spectators, because their
 * ABSENCE is what the referee needs to notice immediately and unprompted.
 */
export default function Scoreboard({ state, now, linkStatus, isStale, handshakeState }) {
  const ruleset = selectRuleset(state);
  const period = selectPeriod(state);
  const clockMs = remainingMs(state.clock, now);
  const warnAt = ruleset.main_clock.warning_at_s * 1000;
  const differential = selectDifferential(state, now);
  const clockSlot = secondaryClockSlot(ruleset);
  const countingDown = ruleset.secondary_clock.polarity === 'count_down';
  const secondaryOwner = state.secondary.owner;
  const accruing = selectSecondaryAccruing(state);
  // The folkstyle riding-time differential (count-up) is centred under the
  // main clock with its own holder arrow (FS §6.3); the freestyle/Greco
  // activity clock (count-down) is unaffected and stays beside its owner's
  // score, per Corner below.
  const showsCentralSecondary = clockSlot !== null && !countingDown;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        height: '100%',
        gap: 'var(--sp-5)',
        padding: 'var(--sp-6) var(--sp-7)',
        minHeight: 0,
      }}
    >
      <TopStrip
        ruleset={ruleset}
        period={period}
        linkStatus={linkStatus}
        isStale={isStale}
        handshakeState={handshakeState}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr minmax(320px, 26%) 1fr',
          gap: 'var(--sp-6)',
          alignItems: 'stretch',
          minHeight: 0,
        }}
      >
        <Corner
          corner="RED"
          state={state}
          ruleset={ruleset}
          countingDown={countingDown}
          clockSlot={clockSlot}
          secondaryOwner={secondaryOwner}
          accruing={accruing}
          secondaryMs={selectSecondaryRemainingMs(state, now)}
          now={now}
        />

        <ClockColumn
          state={state}
          clockMs={clockMs}
          warnAt={warnAt}
          period={period}
          showsCentralSecondary={showsCentralSecondary}
          label={clockSlot ? ruleset[clockSlot].label : null}
          differential={differential}
          secondaryOwner={secondaryOwner}
          accruing={accruing}
        />

        <Corner
          corner="GREEN"
          state={state}
          ruleset={ruleset}
          countingDown={countingDown}
          clockSlot={clockSlot}
          secondaryOwner={secondaryOwner}
          accruing={accruing}
          secondaryMs={selectSecondaryRemainingMs(state, now)}
          now={now}
        />
      </div>

      <PeriodStrip state={state} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopStrip({ ruleset, period, linkStatus, isStale, handshakeState }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-6)' }}>
      <span className="rr-eyebrow" style={{ fontSize: 'var(--fs-14)' }}>
        {ruleset.name} · {period.label}
        {period.overtime ? ' · OVERTIME' : ''}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--sp-6)' }}>
        <RemoteStatus corner="RED" status={linkStatus.RED} isStale={isStale} handshakeState={handshakeState} />
        <RemoteStatus corner="GREEN" status={linkStatus.GREEN} isStale={isStale} handshakeState={handshakeState} />
      </div>
    </div>
  );
}

/**
 * Colour alone never carries a state — gym lighting and colour-blind coaches
 * both exist — so every status here is a glyph plus a word plus a colour.
 */
function RemoteStatus({ corner, status, isStale, handshakeState }) {
  const offline = handshakeState !== 'ready' || isStale || status.state !== 'CONNECTED';
  const lowBattery = status.batt != null && status.batt <= 20;

  const colour = offline ? 'var(--signal-stop)' : lowBattery ? 'var(--signal-warn)' : 'var(--signal-go)';
  const word = handshakeState !== 'ready' ? 'NO DONGLE' : isStale ? 'STALE' : status.state;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: corner === 'RED' ? 'var(--athlete-red)' : 'var(--athlete-green)',
          flex: '0 0 auto',
        }}
      />
      <Icon name={offline ? 'wifi-off' : 'radio'} size={20} color={colour} />
      <span
        className="rr-eyebrow rr-num"
        style={{ fontSize: 'var(--fs-13)', color: colour, letterSpacing: 'var(--ls-label)' }}
      >
        {word}
      </span>
      {status.batt != null && (
        <span
          className="rr-num"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-13)',
            color: lowBattery ? 'var(--signal-warn)' : 'var(--text-muted)',
          }}
        >
          <Icon name={lowBattery ? 'battery-low' : 'battery'} size={18} />
          {status.batt}%
        </span>
      )}
    </div>
  );
}

function Corner({
  corner,
  state,
  ruleset,
  countingDown,
  clockSlot,
  secondaryOwner,
  accruing,
  secondaryMs,
}) {
  const isRed = corner === 'RED';
  const edge = isRed ? 'var(--athlete-red)' : 'var(--athlete-green)';
  const athlete = state.athletes[corner];

  // count_down (freestyle/Greco activity clock) only: shown beside the
  // obligated athlete's score, unchanged (FS §6.4). The count_up case
  // (folkstyle riding time) renders centrally now — see ClockColumn.
  const showsCountdown = countingDown && secondaryOwner === corner;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', minWidth: 0, minHeight: 0 }}>
      {/* Name plates: all caps, condensed, square corners. Square reads as
          instrumentation, which is what this is. */}
      <div
        style={{
          borderLeft: `8px solid ${edge}`,
          background: 'var(--surface-sunken)',
          padding: 'var(--sp-4) var(--sp-6)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-plate)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: 'var(--fs-31)',
            lineHeight: 1.05,
            color: 'var(--text-strong)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {athlete.name || corner}
        </div>
        {athlete.team && <div className="rr-eyebrow" style={{ marginTop: 3 }}>{athlete.team}</div>}
      </div>

      <div
        style={{
          flex: 1,
          background: 'var(--surface-card)',
          borderTop: `8px solid ${edge}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-5)',
          minHeight: 0,
        }}
      >
        {/* Mono rather than the display face: at scoreboard size a proportional
            black weight reads as heavy and rounded from a distance, exactly
            where legibility matters most. JetBrains Mono's open counters and
            distinct strokes are the "mono or tabular" the design system's own
            content rules call for on scores. */}
        <span
          className="rr-num"
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: 'clamp(var(--fs-104), 18vw, var(--fs-220))',
            letterSpacing: 'var(--ls-normal)',
            lineHeight: 0.9,
            color: 'var(--text-strong)',
          }}
        >
          {state.score[corner]}
        </span>

        {showsCountdown && (
          <SecondaryReadout
            label={ruleset[clockSlot ?? 'f1'].label}
            value={formatClock(secondaryMs)}
            accruing={accruing}
          />
        )}
      </div>

      <CornerCounters state={state} ruleset={ruleset} corner={corner} />
    </div>
  );
}

/** Shown only when active (FS §8.4). A lime ring marks it live — the one glow
 *  in the system, and it is a state rather than a style. */
function SecondaryReadout({ label, value, accruing }) {
  return (
    <div
      style={{
        marginTop: 'var(--sp-5)',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: 'var(--sp-3) var(--sp-6)',
        border: '1px solid var(--border-hairline)',
        boxShadow: accruing ? 'var(--glow-live)' : 'none',
      }}
    >
      <span className="rr-eyebrow">{label}</span>
      <span
        className="rr-num"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 'var(--fs-39)',
          lineHeight: 1,
          color: accruing ? 'var(--lime-400)' : 'var(--text-body)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Counters are counted, never scored — pips and a count, never merged into the
 * point total. The ladder position sits in the detail panel; what belongs at
 * distance is only whether the athlete holds the state and how many.
 */
function CornerCounters({ state, ruleset, corner }) {
  const slots = ['f1', 'f2'].filter((slot) => {
    const role = ruleset[slot].role;
    return role === ROLE.COUNTER || (role === ROLE.FLAG && state.flags[slot] === corner);
  });

  if (slots.length === 0) return <div style={{ height: 28 }} />;

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap', minHeight: 28 }}>
      {slots.map((slot) => {
        const config = ruleset[slot];
        if (config.role === ROLE.FLAG) {
          return (
            <span key={slot} className="rr-eyebrow" style={{ color: 'var(--text-strong)' }}>
              <Icon name="flag" size={16} style={{ marginRight: 6, verticalAlign: '-3px' }} />
              {config.label}
            </span>
          );
        }
        const count = state.counters[corner][slot];
        return (
          <span
            key={slot}
            className="rr-eyebrow"
            style={{ color: count > 0 ? 'var(--text-body)' : 'var(--text-muted)' }}
          >
            {config.label}{' '}
            <span className="rr-num" style={{ color: 'var(--text-strong)', fontWeight: 700, fontSize: 'var(--fs-16)' }}>
              {count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ClockColumn({ state, clockMs, warnAt, period, showsCentralSecondary, label, differential, secondaryOwner, accruing }) {
  const running = state.clock.running;
  const warning = clockMs <= warnAt && clockMs > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-5)',
        background: 'var(--surface-sunken)',
        padding: 'var(--sp-6)',
        border: '1px solid var(--border-hairline)',
        boxShadow: running ? 'var(--glow-live)' : 'none',
      }}
    >
      <span className="rr-eyebrow" style={{ fontSize: 'var(--fs-14)' }}>
        {period.label}
      </span>
      {/* The live clock does not animate. It ticks. */}
      <span
        className="rr-num"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 'clamp(var(--fs-62), 9vw, var(--fs-148))',
          letterSpacing: '-0.04em',
          lineHeight: 0.92,
          color: warning ? 'var(--signal-stop)' : running ? 'var(--text-strong)' : 'var(--text-muted)',
        }}
      >
        {formatClock(clockMs)}
      </span>
      <span
        className="rr-eyebrow"
        style={{ color: running ? 'var(--signal-live)' : 'var(--text-muted)', fontSize: 'var(--fs-13)' }}
      >
        <Icon
          name={running ? 'circle-dot' : 'pause'}
          size={16}
          style={{ marginRight: 6, verticalAlign: '-3px' }}
        />
        {running ? 'RUNNING' : 'STOPPED'}
      </span>

      {showsCentralSecondary && (
        <RidingTimeReadout label={label} differential={differential} owner={secondaryOwner} accruing={accruing} />
      )}
    </div>
  );
}

/**
 * The folkstyle riding-time differential (FS §6.3). Favour and holder are
 * different facts and are shown separately: the readout's colour answers
 * "who does this favour", an independent arrow answers "who is accruing it
 * right now" — the two can disagree (favoured athlete ahead on the clock
 * while the other currently holds control), and both must read correctly
 * with the main clock stopped, when there is no motion to infer direction
 * from.
 */
function RidingTimeReadout({ label, differential, owner, accruing }) {
  const favourColour =
    differential.favoured === 'RED'
      ? 'var(--athlete-red)'
      : differential.favoured === 'GREEN'
        ? 'var(--athlete-green)'
        : 'var(--text-muted)';
  const holderColour = owner === 'RED' ? 'var(--athlete-red)' : owner === 'GREEN' ? 'var(--athlete-green)' : null;

  // Two different quantities share this one readout, and they round opposite
  // ways. While the holder is closing a deficit (owner !== favoured), the
  // number is a countdown to the crossing and must never touch 00:00 early —
  // ceil, same convention as the main clock. The instant it crosses, owner
  // catches up to favoured and this becomes a fresh count-up from zero — floor,
  // ordinary elapsed-time display. Without this split, the countdown's last
  // second and the count-up's first second both render 00:00, in opposite
  // colours, and the crossing appears to take two seconds instead of one.
  const closing = owner !== null && differential.favoured !== null && owner !== differential.favoured;
  const value = closing ? formatPaddedCeil(differential.ms) : formatPadded(differential.ms);

  const arrow = (direction) => (
    <span
      aria-hidden="true"
      style={{
        width: 0,
        height: 0,
        borderTop: '7px solid transparent',
        borderBottom: '7px solid transparent',
        ...(direction === 'left'
          ? { borderRight: `11px solid ${holderColour}` }
          : { borderLeft: `11px solid ${holderColour}` }),
      }}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-3) var(--sp-6)',
        border: '1px solid var(--border-hairline)',
        boxShadow: accruing ? 'var(--glow-live)' : 'none',
      }}
    >
      {/* Reserve the width whether or not the arrow is rendered, so the
          readout does not shift sideways when ownership deassigns. */}
      <span style={{ width: 11, display: 'flex', justifyContent: 'flex-end' }}>
        {owner === 'RED' && arrow('left')}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span className="rr-eyebrow">{label}</span>
        <span
          className="rr-num"
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 'var(--fs-39)',
            lineHeight: 1,
            color: favourColour,
          }}
        >
          {value}
        </span>
      </div>

      <span style={{ width: 11, display: 'flex', justifyContent: 'flex-start' }}>
        {owner === 'GREEN' && arrow('right')}
      </span>
    </div>
  );
}

function PeriodStrip({ state }) {
  const count = selectPeriodCount(state);
  const ruleset = selectRuleset(state);
  const periods = [...ruleset.periods, ...ruleset.overtime];

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
      {periods.slice(0, count).map((p, i) => (
        <span
          key={`${p.label}-${i}`}
          className="rr-eyebrow"
          style={{
            padding: '4px 10px',
            border: '1px solid var(--border-hairline)',
            background: i === state.periodIndex ? 'var(--lime-500)' : 'transparent',
            color: i === state.periodIndex ? 'var(--ink-950)' : 'var(--text-muted)',
            fontWeight: i === state.periodIndex ? 700 : 400,
          }}
        >
          {p.label}
        </span>
      ))}
      {state.phaseIndex >= 0 && ruleset.phases[state.phaseIndex] && (
        <span className="rr-eyebrow" style={{ marginLeft: 'auto', color: 'var(--text-body)' }}>
          PHASE · {ruleset.phases[state.phaseIndex].label}
        </span>
      )}
    </div>
  );
}
