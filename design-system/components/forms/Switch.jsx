import React from 'react';

export function Switch({ checked = false, onChange, label, disabled = false, size = 'md', style, ...rest }) {
  const w = size === 'sm' ? 34 : 44, h = size === 'sm' ? 20 : 26, k = h - 6;
  return (
    <label {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.38 : 1, ...style }}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked, e)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{
        width: w, height: h, flex: '0 0 auto', borderRadius: 999, position: 'relative',
        background: checked ? 'var(--accent)' : 'var(--ink-200)',
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? w - k - 3 : 3, width: k, height: k, borderRadius: 999,
          background: checked ? 'var(--ink-950)' : 'var(--paper-raised)',
          boxShadow: '0 1px 2px rgba(11,13,12,.25)',
          transition: 'left var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
        }} />
      </span>
      {label && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-strong)' }}>{label}</span>}
    </label>
  );
}
