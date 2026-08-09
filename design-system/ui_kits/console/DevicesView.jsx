const { Card, DeviceStatus, Button, Badge, Toast, Field, Input, Switch, Tabs, Icon } = window.RefRemoteDesignSystem_6d7f39;

const DEVICES = [
  { state: 'connected', name: 'Remote 01', id: 'R-01', battery: 91, rssi: -48, mat: 'Mat 1' },
  { state: 'connected', name: 'Remote 02', id: 'R-02', battery: 76, rssi: -55, mat: 'Mat 2' },
  { state: 'connected', name: 'Remote 04', id: 'R-04', battery: 87, rssi: -52, mat: 'Mat 3' },
  { state: 'weak', name: 'Remote 07', id: 'R-07', battery: 12, rssi: -84, mat: 'Mat 4' },
  { state: 'connected', name: 'Mat 1 display', id: 'D-01', battery: 100, rssi: -41, mat: 'Mat 1' },
  { state: 'offline', name: 'Mat 6 display', id: 'D-06', rssi: null, mat: 'Mat 6' },
];

function DeviceRow({ d }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
      <div style={{ flex: 1 }}><DeviceStatus {...d} style={{ background: 'transparent', border: 'none', padding: 0 }} /></div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', width: 70 }}>{d.mat}</span>
      <Button variant="ghost" size="sm" iconRight="chevron-right">Manage</Button>
    </div>
  );
}

function DevicesView() {
  const [alert, setAlert] = React.useState(true);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
      <Card padding={0} title={null}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text-strong)' }}>Paired devices</span>
          <Badge tone="warn" dot>1 weak</Badge><Badge tone="stop" dot>1 offline</Badge>
          <span style={{ marginLeft: 'auto' }}><Button size="sm" iconLeft="bluetooth">Pair a remote</Button></span>
        </div>
        {DEVICES.map((d) => <DeviceRow key={d.id} d={d} />)}
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {alert && <Toast tone="warn" title="Remote 07 lost signal 8s ago" detail="Scores are buffered on the remote. Move within 30 m or switch to the backup remote." onDismiss={() => setAlert(false)} style={{ minWidth: 0 }} />}
        <Card eyebrow="Radio" title="Link settings" padding={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Venue channel" hint="Change only if another event shares the building."><Input mono size="sm" value="CH-07" onChange={() => {}} /></Field>
            <Switch checked label="Buffer scores when a remote drops" />
            <Switch checked={false} label="Audible alert at the head table" />
          </div>
        </Card>
        <Card eyebrow="Coverage" title="Mat 6" padding={16}>
          <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.45 }}>Display offline since 11:52. The mat's remote is still buffering. Scores replay automatically when the display reconnects.</div>
          <div style={{ marginTop: 12 }}><Button variant="secondary" size="sm" iconLeft="monitor">Reassign display</Button></div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { DevicesView, DeviceRow });
