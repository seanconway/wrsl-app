const { Badge, Icon, Button } = window.RefRemoteDesignSystem_6d7f39;

function QueueRow({ q, onStart }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--alpha-hairline-dark)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-400)', width: 52 }}>{q.id}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-plate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 16, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.red} vs {q.green}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--ink-400)', marginTop: 3 }}>{q.division}</div>
      </div>
      {q.state === 'next' ? <Button size="sm" onClick={onStart}>Load</Button> : <Icon name="chevron-right" size={18} style={{ color: 'var(--ink-500)' }} />}
    </div>
  );
}

function QueueScreen({ queue, onStart }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <SheetTitle eyebrow="Mat 3 · 5 queued" title="Up next" />
      {queue.map((q) => <QueueRow key={q.id} q={q} onStart={onStart} />)}
      <div style={{ padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--ink-500)' }}>
        QUEUE SYNCED FROM CONSOLE · 12:04:18
      </div>
    </div>
  );
}

Object.assign(window, { QueueScreen, QueueRow });
