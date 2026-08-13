import React, { useState } from 'react';
import { Icon } from '../../design-system/components/core/Icon.jsx';
import { Button } from '../../design-system/components/core/Button.jsx';
import { selectRuleset, selectPeriod } from '../match/matchReducer.js';
import { ROLE, ladderPosition } from '../match/rulesets.js';
import { formatPadded, accruedMs } from '../match/clock.js';

/**
 * The secondary tier (FS §8.4): everything the referee needs at specific
 * moments rather than continuously. Summoned on demand, and collapsing it never
 * reduces the primary tier's legibility — which is why it is an overlay panel
 * on one edge rather than a region the scoreboard shares space with.
 */
export default function DetailPanel({ state, now, dongle, onClose, onSendRaw }) {
  const [tab, setTab] = useState('match');
  const ruleset = selectRuleset(state);

  return (
    <aside
      style={{
        width: 'min(460px, 40vw)',
        height: '100%',
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-5) var(--sp-6)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        {[
          ['match', 'Match'],
          ['log', 'Action log'],
          ['system', 'System'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="rr-eyebrow"
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === id ? '3px solid var(--lime-500)' : '3px solid transparent',
              color: tab === id ? 'var(--text-strong)' : 'var(--text-muted)',
              padding: '4px 2px',
              cursor: 'pointer',
              fontSize: 'var(--fs-13)',
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Icon name="x" size={20} />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)', minHeight: 0 }}>
        {tab === 'match' && <MatchDetail state={state} ruleset={ruleset} now={now} />}
        {tab === 'log' && <ActionLog state={state} ruleset={ruleset} />}
        {tab === 'system' && <SystemDetail state={state} dongle={dongle} onSendRaw={onSendRaw} />}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 'var(--sp-8)' }}>
      <h3 className="rr-eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, value, tone }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--sp-5)',
        padding: '6px 0',
        borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-14)', color: 'var(--text-body)' }}>{label}</span>
      <span
        className="rr-num"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-14)', color: tone ?? 'var(--text-strong)' }}
      >
        {value}
      </span>
    </div>
  );
}

function MatchDetail({ state, ruleset, now }) {
  const period = selectPeriod(state);
  const counterSlots = ['f1', 'f2'].filter((slot) => ruleset[slot].role === ROLE.COUNTER);

  return (
    <>
      {counterSlots.length > 0 && (
        <Section title="Counts and ladder position">
          {counterSlots.map((slot) => {
            const config = ruleset[slot];
            return ['RED', 'GREEN'].map((corner) => {
              const count = state.counters[corner][slot];
              const step = ladderPosition(ruleset, slot, count);
              return (
                <Row
                  key={`${slot}-${corner}`}
                  label={`${corner === 'RED' ? 'Red' : 'Green'} · ${config.label}`}
                  value={step ? `${count} — ${step}` : String(count)}
                  tone={count > 0 ? 'var(--signal-warn)' : undefined}
                />
              );
            });
          })}
          {/* The counter is a tally. Awarding what a penalty step calls for is a
              separate manual entry — the system never applies the consequence. */}
          <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>
            Ladder position is shown for reference. Applying the consequence is the referee's action.
          </p>
        </Section>
      )}

      {['f1', 'f2'].some((s) => ruleset[s].role === ROLE.FLAG) && (
        <Section title="Flags">
          {['f1', 'f2'].map((slot) =>
            ruleset[slot].role === ROLE.FLAG ? (
              <Row
                key={slot}
                label={ruleset[slot].label}
                value={state.flags[slot] ?? 'Unset'}
                tone={state.flags[slot] ? 'var(--text-strong)' : 'var(--text-muted)'}
              />
            ) : null,
          )}
        </Section>
      )}

      {ruleset.secondary_clock.enabled && (
        <Section title={ruleset.f1.role === ROLE.SECONDARY_CLOCK ? ruleset.f1.label : ruleset.f2.label}>
          <Row label="Owner" value={state.secondary.owner ?? 'Unassigned'} />
          {ruleset.secondary_clock.polarity === 'count_up' && (
            <>
              {/* Read through the accumulator at `now` rather than off the
                  stored base: while accrual is running the stored value is the
                  figure at the last transition, and rendering it directly shows
                  a frozen 00:00 next to a primary tier that is counting up. */}
              <Row label="Red accrued" value={formatPadded(accruedMs(state.secondary.up.RED, now))} />
              <Row label="Green accrued" value={formatPadded(accruedMs(state.secondary.up.GREEN, now))} />
            </>
          )}
          {period.secondary_clock?.threshold_note && (
            <Row label={`Threshold ${period.secondary_clock.threshold_s}s`} value={period.secondary_clock.threshold_note} />
          )}
        </Section>
      )}

      {ruleset.phases.length > 0 && (
        <Section title="Phase">
          <Row label="Current" value={ruleset.phases[Math.max(0, state.phaseIndex)]?.label ?? '—'} />
        </Section>
      )}

      {ruleset.tiebreak_criteria.length > 0 && (
        <Section title="Criteria">
          {ruleset.tiebreak_criteria.map((c, i) => (
            <Row key={c} label={`${i + 1}`} value={c} />
          ))}
          <p style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>
            Evaluated for reference. Declaring the winner is the referee's decision.
          </p>
        </Section>
      )}
    </>
  );
}

/**
 * The action log. Grouping is best-effort and will sometimes be wrong — a
 * referee who pauses mid-sequence produces two actions where one was intended.
 * There is no way to correct it from the wrist, so this is where it is checked,
 * at match end, when criteria decisions are made and there is time (FS §4.3).
 */
function ActionLog({ state, ruleset }) {
  const entries = [...state.log].reverse();

  if (entries.length === 0) {
    return <p style={{ fontSize: 'var(--fs-14)', color: 'var(--text-muted)' }}>No actions recorded.</p>;
  }

  return (
    <>
      {ruleset.action_grouping.enabled && (
        <p style={{ marginBottom: 'var(--sp-5)', fontSize: 'var(--fs-13)', color: 'var(--text-muted)' }}>
          Presses within {ruleset.action_grouping.window_ms} ms on the same remote are grouped into one action. Review
          before a criteria decision.
        </p>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {entries.map((entry, i) => (
          <li
            key={`${entry.at}-${i}`}
            style={{
              display: 'flex',
              gap: 'var(--sp-5)',
              padding: '6px 0',
              borderBottom: '1px solid var(--border-hairline)',
              fontSize: 'var(--fs-14)',
            }}
          >
            <span className="rr-num" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 34 }}>
              {(ruleset.periods[entry.periodIndex] ?? ruleset.overtime[entry.periodIndex - ruleset.periods.length])?.label ??
                '—'}
            </span>
            <span style={{ color: 'var(--text-body)', flex: 1 }}>{describeEntry(entry, ruleset)}</span>
            {entry.grouped && (
              <span className="rr-eyebrow" style={{ color: 'var(--signal-info)' }}>
                GROUPED
              </span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function describeEntry(entry, ruleset) {
  switch (entry.type) {
    case 'SCORE':
      return `${entry.corner} ${entry.value > 0 ? '+' : ''}${entry.value}`;
    case 'COUNTER':
      return `${entry.corner} ${ruleset[entry.slot].label} → ${entry.value}`;
    case 'FLAG':
      return `${ruleset[entry.slot].label} → ${entry.corner ?? 'unset'}`;
    case 'SECONDARY_OWNER':
      return `Secondary clock → ${entry.corner ?? 'unassigned'}`;
    case 'SECONDARY_RESET':
      return 'Secondary clock reset';
    case 'SECONDARY_EXPIRED':
      return 'Secondary clock expired';
    case 'PERIOD_EXPIRED':
      return 'Period expired';
    case 'CLOCK_RESET':
      return 'Period clock reset';
    case 'PHASE':
      return `Phase → ${entry.label}`;
    case 'SET_SUBSTITUTION':
      return `Officiating set substituted → ${entry.set}`;
    default:
      return entry.type;
  }
}

function SystemDetail({ state, dongle, onSendRaw }) {
  const [command, setCommand] = useState('');
  const counters = dongle.counters ?? {};

  return (
    <>
      <Section title="Officiating set">
        <Row label="Set serial" value={dongle.identity?.set ?? '—'} />
        <Row label="Dongle firmware" value={dongle.identity?.fw ?? '—'} />
        <Row label="Protocol" value={dongle.identity?.proto ?? '—'} />
        <Row label="Link" value={dongle.handshakeState} />
      </Section>

      <Section title="Instrumentation">
        {/* Running counters, not one-off warnings into a ring buffer that will
            have rolled over long before anyone reads it. A soak test without
            these is unfalsifiable (PLAN.md §5, V8). */}
        <Row label="Events received" value={counters.evtReceived ?? 0} />
        <Row
          label="Sequence gaps"
          value={counters.seqGaps ?? 0}
          tone={counters.seqGaps > 0 ? 'var(--signal-stop)' : undefined}
        />
        <Row
          label="Duplicates dropped"
          value={counters.duplicates ?? 0}
          tone={counters.duplicates > 0 ? 'var(--signal-warn)' : undefined}
        />
        <Row label="Beats sent" value={counters.beatsSent ?? 0} />
        <Row label="Beats suppressed" value={counters.beatsSuppressed ?? 0} />
        <Row
          label="Ack latency p99"
          value={counters.ackLatencyP99Ms != null ? `${counters.ackLatencyP99Ms} ms` : '—'}
          tone={counters.ackLatencyP99Ms > 25 ? 'var(--signal-warn)' : undefined}
        />
        <Row label="Ack latency max" value={counters.ackLatencyMaxMs != null ? `${counters.ackLatencyMaxMs} ms` : '—'} />
        <Row label="Log entries" value={state.log.length} />
      </Section>

      <Section title="Diagnostics">
        <Button variant="secondary" size="sm" iconLeft="download" onClick={() => exportDiagnostics(state, dongle)}>
          Export log
        </Button>
        <div style={{ marginTop: 'var(--sp-5)', display: 'flex', gap: 'var(--sp-3)' }}>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || command.trim() === '') return;
              onSendRaw(command);
              setCommand('');
            }}
            placeholder="Raw protocol line, e.g. TEST 1"
            style={{
              flex: 1,
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-13)',
              padding: '8px 10px',
              borderRadius: 'var(--r-2)',
            }}
          />
        </div>
        {/* The COM port is exclusive: with the app connected, a serial terminal
            cannot also attach, so TEST modes have to be reachable from here. */}
        <div style={{ marginTop: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {['INFO', 'TEST 1', 'TEST 4', 'TEST 0'].map((c) => (
            <Button key={c} variant="ghost" size="sm" onClick={() => onSendRaw(c)}>
              {c}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Wire log">
        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-hairline)',
            padding: 'var(--sp-4)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-12)',
            lineHeight: 1.5,
          }}
        >
          {dongle.debugLog.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No traffic.</span>
          ) : (
            [...dongle.debugLog].reverse().map((entry, i) => (
              <div key={i} style={{ color: entry.dir === 'TX' ? 'var(--lime-400)' : 'var(--text-body)' }}>
                {new Date(entry.wallTs ?? Date.now()).toLocaleTimeString()} {entry.dir} {entry.line}
              </div>
            ))
          )}
        </div>
      </Section>
    </>
  );
}

function exportDiagnostics(state, dongle) {
  const payload = {
    exportedAt: new Date().toISOString(),
    set: dongle.identity ?? null,
    counters: dongle.counters ?? {},
    match: { rulesetId: state.rulesetId, score: state.score, log: state.log },
    wire: dongle.debugLog,
    messages: dongle.logMessages,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `refremote-diagnostics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
