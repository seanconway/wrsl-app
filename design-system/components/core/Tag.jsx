import React from 'react';
import { Icon } from './Icon.jsx';

export function Tag({ children, onRemove, selected = false, onClick, style, ...rest }) {
  return (
    <span onClick={onClick} {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: selected ? 'var(--ink-900)' : 'var(--surface-card)',
      color: selected ? 'var(--ink-50)' : 'var(--text-body)',
      border: `1px solid ${selected ? 'transparent' : 'var(--border-strong)'}`,
      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500,
      height: 26, padding: '0 10px', borderRadius: 'var(--r-full)',
      cursor: onClick ? 'pointer' : 'default', transition: 'var(--t-control)', ...style,
    }}>
      {children}
      {onRemove && (
        <span role="button" aria-label="Remove" onClick={(e) => { e.stopPropagation(); onRemove(e); }} style={{ display: 'inline-flex', cursor: 'pointer', opacity: 0.6 }}>
          <Icon name="x" size={16} />
        </span>
      )}
    </span>
  );
}
