const { MatTile, Tabs, Button, Card, Badge, Icon } = window.RefRemoteDesignSystem_6d7f39;

const MATS = [
  { mat: 1, status: 'live', division: 'Adult black · −88kg', clock: '3:57', queued: 4, red: { name: 'Aoki, K.', points: 2 }, green: { name: 'Ferreira, L.', points: 2 } },
  { mat: 2, status: 'live', division: 'Master 1 purple · −82kg', clock: '1:12', queued: 7, red: { name: 'Haddad, N.', points: 0 }, green: { name: 'Lindqvist, E.', points: 6 } },
  { mat: 3, status: 'live', division: 'Adult blue · −76kg', clock: '2:31', queued: 5, red: { name: 'Silva, M.', points: 4 }, green: { name: 'Vandenberghe, J.', points: 7 } },
  { mat: 4, status: 'paused', division: 'Juvenile blue · −64kg', clock: '4:02', queued: 3, red: { name: 'Okafor, D.', points: 1 }, green: { name: 'Nowak, P.', points: 1 } },
  { mat: 5, status: 'idle', division: 'Adult white · −70kg', clock: '—', queued: 9 },
  { mat: 6, status: 'down', division: 'Master 2 brown · +100kg', clock: '—', queued: 2 },
];

function StatBar() {
  const stats = [['Matches run', '412'], ['Remaining', '188'], ['Avg. match', '4:41'], ['Behind schedule', '12 min'], ['Devices online', '11 / 12']];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: 'var(--border-hairline)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--r-3)', overflow: 'hidden', marginBottom: 20 }}>
      {stats.map(([k, v]) => (
        <div key={k} style={{ background: 'var(--surface-card)', padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{k}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 31, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: 'var(--text-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function MatsView({ onOpen }) {
  const [filter, setFilter] = React.useState('all');
  const shown = MATS.filter((m) => filter === 'all' || (filter === 'live' ? m.status === 'live' : m.status !== 'live'));
  return (
    <div>
      <StatBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Tabs variant="segmented" value={filter} onChange={setFilter} style={{ display: 'inline-flex' }} items={[
          { value: 'all', label: 'All mats' }, { value: 'live', label: 'Live' }, { value: 'idle', label: 'Not running' },
        ]} />
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)' }}>UPDATED 12:04:18</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {shown.map((m) => <MatTile key={m.mat} {...m} onClick={() => onOpen(m)} />)}
      </div>
    </div>
  );
}

Object.assign(window, { MatsView, StatBar });
