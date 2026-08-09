const { Card, Tag, Badge, Button, Input, Checkbox, Icon } = window.RefRemoteDesignSystem_6d7f39;

const ATHLETES = [
  ['Silva, Maria', 'Alliance São Paulo', 'Adult · Blue · −76kg', 'R-1183', 'Competing'],
  ['Vandenberghe, Joachim', 'Gracie Barra Antwerp', 'Adult · Blue · −76kg', 'R-1183', 'Competing'],
  ['Aoki, Kenji', 'Carpe Diem Tokyo', 'Adult · Blue · −76kg', 'R-1184', 'Checked in'],
  ['Ferreira, Lucas', 'Atos HQ', 'Adult · Blue · −76kg', 'R-1184', 'Checked in'],
  ['Okafor, Daniel', 'Renzo Gracie Lagos', 'Juvenile · Blue · −64kg', 'R-1185', 'Weighed in'],
  ['Nowak, Piotr', 'Copacabana Kraków', 'Juvenile · Blue · −64kg', 'R-1185', 'Weighed in'],
  ['Haddad, Nour', 'Checkmat Beirut', 'Master 1 · Purple · −82kg', 'R-1186', 'Registered'],
  ['Lindqvist, Ebba', 'Vasa BJJ', 'Master 1 · Purple · −82kg', 'R-1186', 'Registered'],
];
const TONE = { Competing: 'live', 'Checked in': 'go', 'Weighed in': 'info', Registered: 'neutral' };

function AthletesView() {
  const [q, setQ] = React.useState('');
  const rows = ATHLETES.filter((a) => a[0].toLowerCase().includes(q.toLowerCase()));
  return (
    <Card padding={0}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ width: 240 }}><Input icon="search" size="sm" placeholder="Filter by surname" value={q} onChange={setQ} /></div>
        <Tag selected>Day 2</Tag><Tag>Gi</Tag>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" iconLeft="printer">Print check-in sheet</Button>
          <Button size="sm" iconLeft="download">Export</Button>
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>
          {['', 'Athlete', 'Team', 'Division', 'Next match', 'Status'].map((h) => (
            <th key={h} style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500, padding: '10px 16px', borderBottom: '1px solid var(--border-hairline)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a[0]}>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)', width: 34 }}><Checkbox checked={false} onChange={() => {}} /></td>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)', fontFamily: 'var(--font-plate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 15, color: 'var(--text-strong)' }}>{a[0]}</td>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)', fontSize: 13, color: 'var(--text-body)' }}>{a[1]}</td>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)', fontSize: 13, color: 'var(--text-body)' }}>{a[2]}</td>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{a[3]}</td>
              <td style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-hairline)' }}><Badge tone={TONE[a[4]]} dot={a[4] === 'Competing'}>{a[4]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

Object.assign(window, { AthletesView });
