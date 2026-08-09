import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Select({ value, onChange, options = [], size = 'md', disabled = false, invalid = false, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'sm' ? 30 : size === 'lg' ? 48 : 38;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <select
        value={value} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value, e)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        {...rest}
        style={{
          width: '100%', height: h, padding: '0 34px 0 12px',
          fontFamily: 'var(--font-ui)', fontSize: size === 'sm' ? 13 : 14, fontWeight: 500,
          color: 'var(--text-strong)', background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          border: `1px solid ${invalid ? 'var(--signal-stop)' : focus ? 'var(--ink-500)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-2)', boxShadow: focus ? 'var(--glow-focus)' : 'none',
          appearance: 'none', outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--t-control)', opacity: disabled ? 0.55 : 1, ...style,
        }}
      >
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value}>{opt.label}</option>;
        })}
      </select>
      <span style={{ position: 'absolute', right: 11, display: 'flex', color: 'var(--text-muted)', pointerEvents: 'none' }}><Icon name="chevron-down" size={16} /></span>
    </div>
  );
}
