import React from 'react';

export function Card({ title, eyebrow, actions, footer, padding = 16, interactive = false, selected = false, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderLeft: selected ? '3px solid var(--accent)' : '1px solid var(--border-hairline)',
        borderRadius: 'var(--r-3)',
        boxShadow: interactive && hover ? 'var(--shadow-2)' : 'var(--shadow-1)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'var(--t-control)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || eyebrow || actions) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: `${padding}px ${padding}px ${title ? 0 : padding}px` }}>
          <div>
            {eyebrow && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{eyebrow}</div>}
            {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: 'var(--ls-display)', color: 'var(--text-strong)', marginTop: eyebrow ? 3 : 0 }}>{title}</div>}
          </div>
          {actions}
        </div>
      )}
      {children != null && <div style={{ padding }}>{children}</div>}
      {footer && <div style={{ padding: `10px ${padding}px`, borderTop: '1px solid var(--border-hairline)', background: 'var(--surface-sunken)' }}>{footer}</div>}
    </div>
  );
}
