const { DeviceStatus, Switch, Button, Field, Select, Badge } = window.RefRemoteDesignSystem_6d7f39;

function DeviceScreen() {
  const [buzzer, setBuzzer] = React.useState(true);
  const [haptic, setHaptic] = React.useState(true);
  const [rs, setRs] = React.useState('IBJJF 2025');
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <SheetTitle eyebrow="Paired to Mat 3" title="Device" />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <DeviceStatus state="connected" name="Remote 04" id="R-04" battery={87} rssi={-52} style={{ background: 'var(--ink-850)' }} />
        <DeviceStatus state="connected" name="Mat 3 display" id="D-03" battery={94} rssi={-58} style={{ background: 'var(--ink-850)' }} />
        <DeviceStatus state="weak" name="Backup remote" id="R-11" battery={12} rssi={-84} style={{ background: 'var(--ink-850)' }} />
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--alpha-hairline-dark)', marginTop: 20 }}>
        <Field label="Ruleset"><Select value={rs} onChange={setRs} options={['IBJJF 2025', 'UWW Freestyle', 'IJF', 'ADCC', 'Sub-only']} style={{ background: 'var(--ink-850)', borderColor: 'var(--ink-600)', color: '#fff' }} /></Field>
        <Switch checked={buzzer} onChange={setBuzzer} label="Buzzer on this mat" />
        <Switch checked={haptic} onChange={setHaptic} label="Haptic confirm on press" />
        <Button variant="secondary" size="lg" block iconLeft="bluetooth">Pair a remote</Button>
      </div>
    </div>
  );
}

Object.assign(window, { DeviceScreen });
