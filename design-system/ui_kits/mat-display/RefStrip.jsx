const { Button, IconButton, Badge, DeviceStatus } = window.RefRemoteDesignSystem_6d7f39;

/* Demo-only strip standing in for the referee's remote, so the display can be driven. */
function RefStrip({ m, act }) {
  const col = (corner) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 5, height: 40, background: corner === 'red' ? 'var(--athlete-red)' : 'var(--athlete-green)' }} />
      {[2, 3, 4].map((n) => (
        <Button key={n} variant="secondary" size="lg" onClick={() => act('point', corner, n)} style={{ minWidth: 54, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+{n}</Button>
      ))}
      <IconButton icon="chevrons-up" label={`Advantage ${corner}`} variant="outline" size="lg" onClick={() => act('adv', corner)} />
      <IconButton icon="flag" label={`Penalty ${corner}`} variant="outline" size="lg" onClick={() => act('pen', corner)} />
      <IconButton icon="minus" label={`Correct ${corner}`} variant="ghost" size="lg" onClick={() => act('undo', corner)} />
    </div>
  );
  return (
    <div style={{ width: 1280, background: 'var(--paper-raised)', borderTop: '1px solid var(--border-hairline)', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>REMOTE 04</span>
      {col('red')}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <Button variant={m.running ? 'secondary' : 'primary'} size="lg" iconLeft={m.running ? 'pause' : 'play'} onClick={() => act('toggle')}>{m.running ? 'Stop time' : 'Start match'}</Button>
        <Button variant="secondary" size="lg" iconLeft="rotate-ccw" onClick={() => act('reset')}>Reset</Button>
        <Button variant="danger" size="lg" onClick={() => act('finish')}>End match</Button>
      </div>
      <div style={{ width: '100%', display: 'flex', gap: 24, alignItems: 'center' }}>
        {col('green')}
        <div style={{ marginLeft: 'auto' }}><DeviceStatus state="connected" name="Remote 04" id="R-04" battery={87} rssi={-52} compact /></div>
      </div>
    </div>
  );
}

Object.assign(window, { RefStrip });
