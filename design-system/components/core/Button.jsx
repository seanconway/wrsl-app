import React from 'react';
import { Icon } from './Icon.jsx';

const btnSizes = {
  sm:    { h: 30, px: 10, fs: 13, gap: 6,  icon: 16 },
  md:    { h: 38, px: 14, fs: 14, gap: 7,  icon: 20 },
  lg:    { h: 48, px: 20, fs: 16, gap: 9,  icon: 20 },
  glove: { h: 64, px: 26, fs: 18, gap: 10, icon: 24 },
};

const btnVariants = {
  primary:   { background: 'var(--accent)', color: 'var(--accent-ink)', border: '1px solid transparent' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)' },
  ghost:     { background: 'transparent', color: 'var(--text-body)', border: '1px solid transparent' },
  danger:    { background: 'var(--signal-stop)', color: '#fff', border: '1px solid transparent' },
};

export function Button({
  variant = 'primary', size = 'md', iconLeft, iconRight, block = false,
  disabled = false, children, style, onClick, type = 'button', ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = btnSizes[size] || btnSizes.md;
  const v = btnVariants[variant] || btnVariants.primary;
  const glove = size === 'glove';
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      {...rest}
      style={{
        ...v,
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontFamily: 'var(--font-ui)',
        fontSize: s.fs,
        fontWeight: 600,
        letterSpacing: glove ? '0.02em' : '0',
        lineHeight: 1,
        borderRadius: 'var(--r-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        filter: !disabled && press ? 'brightness(0.88)' : !disabled && hover ? 'brightness(0.93)' : 'none',
        transform: !disabled && press && !glove ? 'scale(0.98)' : 'none',
        transition: 'filter var(--dur-instant) var(--ease-out), transform var(--dur-instant) var(--ease-out)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {iconLeft && <Icon name={iconLeft} size={s.icon} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.icon} />}
    </button>
  );
}
