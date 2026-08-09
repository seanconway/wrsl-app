const { Card, Badge, Tag, Button, Icon, NamePlate } = window.RefRemoteDesignSystem_6d7f39;

function BracketSlot({ a, b, winner, mat }) {
  const row = (n, name, score, isWin) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: n === 0 ? '1px solid var(--border-hairline)' : 'none', background: isWin ? 'var(--lime-100)' : 'transparent' }}>
      <span style={{ width: 3, height: 14, background: n === 0 ? 'var(--athlete-red)' : 'var(--athlete-green)' }} />
      <span style={{ fontFamily: 'var(--font-plate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 14, color: name ? 'var(--text-strong)' : 'var(--text-muted)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name || '—'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-body)', fontVariantNumeric: 'tabular-nums' }}>{score != null ? score : ''}</span>
    </div>
  );
  return (
    <div style={{ border: '1px solid var(--border-hairline)', borderRadius: 'var(--r-2)', background: 'var(--surface-card)', boxShadow: 'var(--shadow-1)', overflow: 'hidden', width: 210 }}>
      {row(0, a.name, a.score, winner === 'red')}
      {row(1, b.name, b.score, winner === 'green')}
      {mat && <div style={{ padding: '4px 10px', background: 'var(--surface-sunken)', borderTop: '1px solid var(--border-hairline)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)' }}>{mat}</div>}
    </div>
  );
}

const R16 = [
  [{ name: 'Silva, M.', score: 4 }, { name: 'Vandenberghe, J.', score: 7 }, 'green', 'MAT 3 · LIVE'],
  [{ name: 'Aoki, K.', score: 6 }, { name: 'Ferreira, L.', score: 2 }, 'red', 'MAT 1 · 11:42'],
  [{ name: 'Okafor, D.', score: 0 }, { name: 'Nowak, P.', score: 11 }, 'green', 'MAT 4 · 11:28'],
  [{ name: 'Haddad, N.', score: 2 }, { name: 'Lindqvist, E.', score: 2 }, 'green', 'MAT 2 · 11:15'],
];
const QF = [
  [{ name: 'Vandenberghe, J.', score: null }, { name: 'Aoki, K.', score: null }, null, 'MAT 3 · QUEUED'],
  [{ name: 'Nowak, P.', score: null }, { name: 'Lindqvist, E.', score: null }, null, 'MAT 2 · QUEUED'],
];

function Column({ label, rows, gap }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, justifyContent: 'space-around' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {rows.map((r, i) => <BracketSlot key={i} a={r[0]} b={r[1]} winner={r[2]} mat={r[3]} />)}
    </div>
  );
}

function BracketsView() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tag selected>Adult</Tag><Tag selected>Blue belt</Tag><Tag selected>−76kg</Tag><Tag>Gi</Tag>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" iconLeft="printer">Print bracket</Button>
          <Button variant="secondary" size="sm" iconLeft="download">Export CSV</Button>
        </span>
      </div>
      <Card padding={20}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'stretch' }}>
          <Column label="Round of 16" rows={R16} gap={14} />
          <Column label="Quarter-finals" rows={QF} gap={92} />
          <Column label="Semi-final" rows={[[{ name: '', score: null }, { name: '', score: null }, null, null]]} gap={0} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid var(--border-hairline)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--text-muted)' }}>DIVISION STATUS</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 39, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: 'var(--text-strong)' }}>4 / 15</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 180 }}>matches complete. Results post to the bracket the moment a referee ends a match.</div>
            <Badge tone="live" dot style={{ alignSelf: 'flex-start' }}>1 live now</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { BracketsView, BracketSlot });
