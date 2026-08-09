import React from 'react';

export function Tooltip({ label, side = 'top', children, style, ...rest }) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top:    { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 },
    left:   { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 },
    right:  { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 6 },
  }[side];
  return (
    <span {...rest} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-flex', ...style }}>
      {children}
      {show && (
        <span role="tooltip" style={{
          position: 'absolute', ...pos, zIndex: 80, whiteSpace: 'nowrap',
          background: 'var(--ink-900)', color: 'var(--ink-50)',
          fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500,
          padding: '5px 8px', borderRadius: 'var(--r-1)', pointerEvents: 'none',
          boxShadow: 'var(--shadow-2)',
        }}>{label}</span>
      )}
    </span>
  );
}
