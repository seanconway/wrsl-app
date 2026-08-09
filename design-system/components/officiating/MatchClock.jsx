import React from 'react';

/* Ticking match clock. Deliberately never animated — the value swaps, nothing moves. */
export function MatchClock({ seconds = 300, running = false, size = 'lg', label, warnUnder = 10, style, ...rest }) {
  const sizes = { sm: 21, md: 39, lg: 78, xl: 148, mat: 220 };
  const fs = sizes[size] || sizes.lg;
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  const warn = seconds <= warnUnder;
  return (
    <div {...rest} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: fs > 60 ? 8 : 3, ...style }}>
      {label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: fs > 60 ? 14 : 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: fs, fontWeight: 700,
        letterSpacing: fs > 60 ? '-0.04em' : '-0.02em', lineHeight: 0.92,
        fontVariantNumeric: 'tabular-nums',
        color: warn ? 'var(--signal-stop)' : running ? 'var(--text-strong)' : 'var(--text-muted)',
      }}>
        {m}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}
