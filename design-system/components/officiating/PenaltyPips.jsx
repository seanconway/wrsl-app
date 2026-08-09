import React from 'react';

/* Counted infractions rendered as discrete pips. Never merged into the score. */
export function PenaltyPips({ count = 0, max = 3, kind = 'penalty', size = 14, label, style, ...rest }) {
  const on = kind === 'penalty' ? 'var(--signal-warn)' : 'var(--text-strong)';
  return (
    <div {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
      {label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>}
      <span style={{ display: 'inline-flex', gap: Math.max(4, size * 0.3) }}>
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} style={{
            width: size, height: size, borderRadius: kind === 'penalty' ? 'var(--r-1)' : 999,
            background: i < count ? on : 'transparent',
            border: `1px solid ${i < count ? 'transparent' : 'var(--border-strong)'}`,
            transition: 'background var(--dur-fast) var(--ease-out)',
          }} />
        ))}
      </span>
    </div>
  );
}
