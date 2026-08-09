import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function MatTile({ mat, status = 'live', division, clock, red, green, queued, onClick, style, ...rest }) {
  const tones = {
    live:  { label: 'LIVE', color: 'var(--signal-live)' },
    idle:  { label: 'IDLE', color: 'var(--text-muted)' },
    paused:{ label: 'PAUSED', color: 'var(--signal-warn)' },
    down:  { label: 'OFFLINE', color: 'var(--signal-stop)' },
  };
  const t = tones[status] || tones.idle;
  return (
    <div onClick={onClick} {...rest} style={{
      background: 'var(--surface-card)', border: '1px solid var(--border-hairline)',
      boxShadow: status === 'live' ? 'inset 0 3px 0 var(--signal-live)' : 'none',
      borderRadius: 'var(--r-3)', padding: 14, cursor: onClick ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', gap: 10, transition: 'var(--t-control)', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: 'var(--ls-display)' }}>Mat {mat}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: t.color }}>
          {status === 'live' && <Icon name="circle-dot" size={12} />}{t.label}
        </span>
      </div>
      {division && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{division}</div>}
      {(red || green) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['red', red], ['green', green]].map(([c, a]) => a && (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 4, height: 16, background: c === 'red' ? 'var(--athlete-red)' : 'var(--athlete-green)' }} />
              <span style={{ fontFamily: 'var(--font-plate)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 15, color: 'var(--text-body)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{a.points}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-hairline)', paddingTop: 9 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: status === 'live' ? 'var(--text-strong)' : 'var(--text-muted)' }}>{clock || '—'}</span>
        {queued != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{queued} QUEUED</span>}
      </div>
    </div>
  );
}
