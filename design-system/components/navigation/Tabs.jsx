import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Tabs({ items = [], value, onChange, variant = 'underline', style, ...rest }) {
  const underline = variant === 'underline';
  return (
    <div role="tablist" {...rest} style={{
      display: 'flex', gap: underline ? 20 : 4,
      borderBottom: underline ? '1px solid var(--border-hairline)' : 'none',
      background: underline ? 'transparent' : 'var(--surface-sunken)',
      padding: underline ? 0 : 3, borderRadius: underline ? 0 : 'var(--r-2)',
      ...style,
    }}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active} type="button" onClick={() => onChange && onChange(it.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: underline ? 'transparent' : active ? 'var(--surface-card)' : 'transparent',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: active ? 600 : 500,
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              padding: underline ? '0 0 9px' : '6px 12px',
              borderRadius: underline ? 0 : 'var(--r-1)',
              boxShadow: underline ? `inset 0 -2px 0 ${active ? 'var(--accent)' : 'transparent'}` : active ? 'var(--shadow-1)' : 'none',
              transition: 'var(--t-control)',
            }}>
            {it.icon && <Icon name={it.icon} size={16} />}
            {it.label}
            {it.count != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
