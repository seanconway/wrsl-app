const { ScoreTile, MatchClock, NamePlate, Icon, Badge } = window.RefRemoteDesignSystem_6d7f39;

function DisplayHeader({ mat, division, ruleset, round }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 40px', height: 84, borderBottom: '1px solid var(--alpha-hairline-dark)', flex: '0 0 auto' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1 }}>MAT {mat}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--ink-300)' }}>{division}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 22 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 'var(--ls-label)', color: 'var(--ink-400)' }}>{ruleset} · {round}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--lime-500)' }}>
          <Icon name="circle-dot" size={16} />LIVE
        </span>
      </span>
    </div>
  );
}

function CornerColumn({ corner, athlete, flash }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <NamePlate corner={corner} name={athlete.name} team={athlete.team} size="lg" style={{ background: 'var(--ink-850)' }} />
      <ScoreTile corner={corner} points={athlete.points} advantages={athlete.adv} penalties={athlete.pen} size="lg" flash={flash}
        style={{ background: 'var(--ink-850)', flex: 1, justifyContent: 'center' }} />
    </div>
  );
}

function CenterColumn({ seconds, running, matchId, state }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '0 8px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>{matchId}</span>
      <MatchClock seconds={seconds} running={running} size="xl" style={{ alignItems: 'center' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase',
        color: running ? 'var(--lime-500)' : 'var(--signal-warn)',
        border: `1px solid ${running ? 'var(--lime-500)' : 'var(--signal-warn)'}`, padding: '5px 12px',
      }}>{state}</span>
    </div>
  );
}

function ResultOverlay({ winner, method, score }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,9,8,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--lime-500)' }}>MATCH OVER</span>
      <span style={{ fontFamily: 'var(--font-plate)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 96, lineHeight: 1, color: '#fff' }}>{winner}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, letterSpacing: 'var(--ls-label)', textTransform: 'uppercase', color: 'var(--ink-300)' }}>{method} · {score}</span>
    </div>
  );
}

function NextUp({ next }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 40px', height: 68, borderTop: '1px solid var(--alpha-hairline-dark)', background: 'var(--ink-900)', flex: '0 0 auto' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>NEXT UP</span>
      <span style={{ fontFamily: 'var(--font-plate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 26, color: 'var(--ink-100)' }}>{next}</span>
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 'var(--ls-label)', color: 'var(--ink-500)' }}>
        <span style={{ fontWeight: 400, color: 'var(--ink-300)' }}>Ref</span><span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--ink-300)', letterSpacing: '-0.03em' }}>Remote</span>
      </span>
    </div>
  );
}

function MatDisplay({ m }) {
  return (
    <div className="rr-mat" style={{ position: 'relative', width: 1280, height: 720, background: 'var(--ink-950)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <DisplayHeader mat={m.mat} division={m.division} ruleset={m.ruleset} round={m.round} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px 1fr', gap: 22, padding: 28, minHeight: 0 }}>
        <CornerColumn corner="red" athlete={m.red} flash={m.flash === 'red'} />
        <CenterColumn seconds={m.seconds} running={m.running} matchId={m.matchId} state={m.running ? 'Running' : 'Stopped'} />
        <CornerColumn corner="green" athlete={m.green} flash={m.flash === 'green'} />
      </div>
      <NextUp next={m.next} />
      {m.result && <ResultOverlay {...m.result} />}
    </div>
  );
}

Object.assign(window, { MatDisplay, DisplayHeader, CornerColumn, CenterColumn, NextUp, ResultOverlay });
