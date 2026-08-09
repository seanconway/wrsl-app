import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Checkbox({ checked = false, onChange, label, description, disabled = false, style, ...rest }) {
  return (
    <label {...rest} style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 9, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.38 : 1, ...style }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange && onChange(e.target.checked, e)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: 18, height: 18, flex: '0 0 auto', marginTop: 1, display: 'grid', placeItems: 'center',
        borderRadius: 'var(--r-1)', transition: 'var(--t-control)',
        background: checked ? 'var(--accent)' : 'var(--surface-card)',
        border: `1px solid ${checked ? 'transparent' : 'var(--border-strong)'}`,
        color: 'var(--ink-950)',
      }}>{checked && <Icon name="check" size={16} />}</span>
      {(label || description) && (
        <span>
          {label && <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-strong)', lineHeight: 1.3 }}>{label}</span>}
          {description && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</span>}
        </span>
      )}
    </label>
  );
}
