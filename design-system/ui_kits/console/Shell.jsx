const { NavRail, Badge, Icon, Input, Button, IconButton, Tooltip, DeviceStatus } = window.RefRemoteDesignSystem_6d7f39;

function TopBar({ title, eyebrow, actions, search, onSearch }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', height: 64, flex: '0 0 auto',
      background: 'rgba(250,250,247,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-hairline)', position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div>
        {eyebrow && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{eyebrow}</div>}
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: 'var(--text-strong)', margin: 0, lineHeight: 1.2 }}>{title}</h1>
      </div>
      <div style={{ width: 260, marginLeft: 24 }}>
        <Input icon="search" size="sm" placeholder="Search athletes, matches, mats" value={search} onChange={onSearch} />
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>
    </header>
  );
}

function ConsoleShell({ view, onView, children, title, eyebrow, actions, search, onSearch }) {
  return (
    <div style={{ display: 'flex', width: 1440, height: 900, background: 'var(--surface-page)', overflow: 'hidden' }}>
      <NavRail value={view} onChange={onView} items={[
        { value: 'mats', label: 'Mats', icon: 'grid-3x3' },
        { value: 'brackets', label: 'Brackets', icon: 'git-fork' },
        { value: 'athletes', label: 'Athletes', icon: 'users' },
        { value: 'devices', label: 'Devices', icon: 'radio', badge: <Badge tone="warn">1</Badge> },
        { value: 'settings', label: 'Settings', icon: 'settings' },
      ]} footer={
        <div style={{ borderTop: '1px solid var(--alpha-hairline-dark)', paddingTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--ink-500)' }}>NORDIC OPEN 2026</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--ink-400)', marginTop: 3 }}>DAY 2 · 6 MATS</div>
        </div>
      } />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
        <TopBar title={title} eyebrow={eyebrow} actions={actions} search={search} onSearch={onSearch} />
        <div style={{ padding: 24, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

Object.assign(window, { ConsoleShell, TopBar });
