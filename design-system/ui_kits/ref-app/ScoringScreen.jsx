const { MatchClock, PenaltyPips, Button, Icon } = window.RefRemoteDesignSystem_6d7f39;

function CornerPad({ corner, a, act }) {
  const edge = corner === 'red' ? 'var(--athlete-red)' : 'var(--athlete-green)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: `5px solid ${edge}`, paddingLeft: 8 }}>
        <span style={{ fontFamily: 'var(--font-plate)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 16, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 39, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{a.points}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[2, 3, 4].map((n) => (
          <button key={n} type="button" onClick={() => act('point', corner, n)} style={{
            height: 64, background: 'var(--ink-800)', border: '1px solid var(--ink-600)', borderRadius: 'var(--r-2)',
            color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, cursor: 'pointer',
          }}>+{n}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <button type="button" onClick={() => act('adv', corner)} style={padBtn}><Icon name="chevrons-up" size={20} />ADV</button>
        <button type="button" onClick={() => act('pen', corner)} style={{ ...padBtn, color: 'var(--signal-warn)' }}><Icon name="flag" size={20} />PEN</button>
        <button type="button" onClick={() => act('undo', corner)} style={{ ...padBtn, color: 'var(--ink-400)' }}><Icon name="minus" size={20} />UNDO</button>
      </div>
      <div style={{ display: 'flex', gap: 14, paddingLeft: 2 }}>
        <PenaltyPips label="Adv" count={a.adv} kind="advantage" size={11} />
        <PenaltyPips label="Pen" count={a.pen} size={11} />
      </div>
    </div>
  );
}

const padBtn = {
  height: 52, background: 'transparent', border: '1px solid var(--ink-700)', borderRadius: 'var(--r-2)',
  color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', fontWeight: 500,
  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
};

function ScoringScreen({ m, act }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 14px', borderBottom: '1px solid var(--alpha-hairline-dark)' }}>
        <MatchClock seconds={m.seconds} running={m.running} size="lg" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>{m.matchId} · {m.round}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: m.running ? 'var(--lime-500)' : 'var(--signal-warn)', border: `1px solid currentColor`, padding: '3px 8px' }}>{m.running ? 'RUNNING' : 'STOPPED'}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: 16, overflow: 'hidden' }}>
        <CornerPad corner="red" a={m.red} act={act} />
        <CornerPad corner="green" a={m.green} act={act} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '0 16px 16px' }}>
        <Button variant={m.running ? 'secondary' : 'primary'} size="glove" block iconLeft={m.running ? 'pause' : 'play'} onClick={() => act('toggle')}>
          {m.running ? 'Stop time' : 'Start match'}
        </Button>
        <Button variant="danger" size="glove" onClick={() => act('end')} style={{ minWidth: 108 }}>End match</Button>
      </div>
    </div>
  );
}

Object.assign(window, { ScoringScreen, CornerPad });
