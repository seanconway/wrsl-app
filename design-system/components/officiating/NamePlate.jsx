import React from 'react';

const plateEdge = { red: 'var(--athlete-red)', green: 'var(--athlete-green)', white: 'var(--athlete-white-line)' };

export function NamePlate({ corner = 'red', name, team, seed, size = 'md', style, ...rest }) {
  const fs = { sm: 16, md: 25, lg: 39, mat: 62 }[size] || 25;
  return (
    <div {...rest} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      borderLeft: `${fs > 30 ? 8 : 5}px solid ${plateEdge[corner] || plateEdge.red}`,
      background: 'var(--surface-sunken)', padding: `${Math.round(fs * 0.3)}px ${Math.round(fs * 0.5)}px`,
      borderRadius: 0, ...style,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-plate)', fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.06em', fontSize: fs, lineHeight: 1.05, color: 'var(--text-strong)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</div>
        {team && <div style={{ fontFamily: 'var(--font-mono)', fontSize: Math.max(11, Math.round(fs * 0.36)), letterSpacing: 'var(--ls-label)', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3 }}>{team}</div>}
      </div>
      {seed != null && (
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: Math.max(11, Math.round(fs * 0.4)), color: 'var(--text-muted)' }}>#{seed}</span>
      )}
    </div>
  );
}
