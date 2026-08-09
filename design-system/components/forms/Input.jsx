import React from 'react';
import { Icon } from '../core/Icon.jsx';

const inputSizes = { sm: 30, md: 38, lg: 48 };

export function Input({ value, onChange, placeholder, size = 'md', icon, invalid = false, disabled = false, mono = false, type = 'text', style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const h = inputSizes[size] || inputSizes.md;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      {icon && <span style={{ position: 'absolute', left: 10, display: 'flex', color: 'var(--text-muted)', pointerEvents: 'none' }}><Icon name={icon} size={16} /></span>}
      <input
        type={type} value={value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value, e)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        {...rest}
        style={{
          width: '100%', height: h,
          padding: `0 12px 0 ${icon ? 32 : 12}px`,
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
          fontSize: size === 'sm' ? 13 : 14,
          color: 'var(--text-strong)',
          background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          border: `1px solid ${invalid ? 'var(--signal-stop)' : focus ? 'var(--ink-500)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--r-2)',
          boxShadow: focus ? 'var(--glow-focus)' : 'none',
          outline: 'none', transition: 'var(--t-control)',
          opacity: disabled ? 0.55 : 1,
          ...style,
        }}
      />
    </div>
  );
}
