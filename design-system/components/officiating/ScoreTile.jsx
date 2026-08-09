import React from 'react';

const cornerColors = {
  red:   { edge: 'var(--athlete-red)', tint: 'var(--athlete-red-tint)' },
  green: { edge: 'var(--athlete-green)', tint: 'var(--athlete-green-tint)' },
  white: { edge: 'var(--athlete-white-line)', tint: '#fff' },
};

/* Big score readout for one corner. Square corners — no radius, ever. */
export function ScoreTile({ corner = 'red', points = 0, advantages = 0, penalties = 0, size = 'lg', flash = false, style, ...rest }) {
  const sizes = { sm: 39, md: 78, lg: 148, mat: 220 };
  const fs = sizes[size] || sizes.lg;
  const c = cornerColors[corner] || cornerColors.red;
  const sub = Math.max(11, Math.round(fs * 0.11));
  return (
    <div {...rest} style={{
      position: 'relative', background: 'var(--surface-card)',
      borderTop: `${fs > 60 ? 8 : 4}px solid ${c.edge}`,
      borderRadius: 0, padding: fs > 60 ? '18px 22px 14px' : '10px 12px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: fs * 0.9,
      transition: 'background var(--dur-fast) var(--ease-out)',
      backgroundColor: flash ? 'color-mix(in oklab, var(--lime-500) 12%, var(--surface-card))' : undefined,
      ...style,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: fs,
        letterSpacing: 'var(--ls-mega)', lineHeight: 0.92, fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-strong)',
      }}>{points}</span>
      <div style={{ display: 'flex', gap: fs > 60 ? 18 : 10, marginTop: fs > 60 ? 12 : 6 }}>
        {[['ADV', advantages], ['PEN', penalties]].map(([k, v]) => (
          <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: sub, letterSpacing: 'var(--ls-label)', color: k === 'PEN' && v > 0 ? 'var(--signal-warn)' : 'var(--text-muted)' }}>
            {k} <span style={{ color: 'var(--text-body)', fontWeight: 700 }}>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
