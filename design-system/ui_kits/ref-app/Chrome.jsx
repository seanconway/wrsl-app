const { Icon, DeviceStatus } = window.RefRemoteDesignSystem_6d7f39;

function Phone({ children }) {
  return (
    <div style={{ width: 390, height: 800, background: 'var(--ink-950)', borderRadius: 'var(--r-5)', border: '1px solid var(--ink-700)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}

function StatusBar({ mat, battery, link }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px', flex: '0 0 auto' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>MAT {mat}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: link === 'weak' ? 'var(--signal-warn)' : 'var(--ink-400)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name={link === 'weak' ? 'wifi-off' : 'radio'} size={14} />{link === 'weak' ? 'WEAK' : '−52dBm'}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="battery" size={14} />{battery}%</span>
      </span>
    </div>
  );
}

function SheetTitle({ eyebrow, title }) {
  return (
    <div style={{ padding: '4px 20px 12px' }}>
      {eyebrow && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--ink-400)' }}>{eyebrow}</div>}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: '#fff', margin: '4px 0 0' }}>{title}</h2>
    </div>
  );
}

function TabBar({ value, onChange }) {
  const items = [{ v: 'match', i: 'timer', l: 'Match' }, { v: 'queue', i: 'list', l: 'Queue' }, { v: 'device', i: 'radio', l: 'Device' }];
  return (
    <div style={{ display: 'flex', borderTop: '1px solid var(--alpha-hairline-dark)', flex: '0 0 auto', background: 'var(--ink-900)' }}>
      {items.map((it) => {
        const on = it.v === value;
        return (
          <button key={it.v} type="button" onClick={() => onChange(it.v)} style={{
            flex: 1, height: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: 'pointer',
            boxShadow: on ? 'inset 0 2px 0 var(--lime-500)' : 'none',
            color: on ? '#fff' : 'var(--ink-400)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: on ? 600 : 500,
          }}><Icon name={it.i} size={22} />{it.l}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, { Phone, StatusBar, SheetTitle, TabBar });
