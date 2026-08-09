import React from 'react';
import { Icon } from './Icon.jsx';

const ibSizes = { sm: { box: 30, icon: 16 }, md: { box: 38, icon: 20 }, lg: { box: 48, icon: 24 }, glove: { box: 64, icon: 32 } };

export function IconButton({ icon, label, variant = 'ghost', size = 'md', active = false, disabled = false, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const s = ibSizes[size] || ibSizes.md;
  const fills = {
    ghost: { background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-body)', border: '1px solid transparent' },
    outline: { background: 'var(--surface-card)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)' },
    solid: { background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid transparent' },
  };
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}
      style={{
        ...(fills[variant] || fills.ghost),
        width: s.box, height: s.box, display: 'inline-grid', placeItems: 'center',
        borderRadius: 'var(--r-2)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        boxShadow: hover && !active && !disabled ? 'inset 0 0 0 999px var(--alpha-press-light)' : 'none',
        transition: 'var(--t-control)', ...style,
      }}
    >
      <Icon name={icon} size={s.icon} />
    </button>
  );
}
