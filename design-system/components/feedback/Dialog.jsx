import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Dialog({ open = true, title, eyebrow, onClose, footer, width = 460, danger = false, children, style, ...rest }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--alpha-scrim)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 24 }}>
      <div role="dialog" aria-modal="true" {...rest} style={{
        width, maxWidth: '100%', background: 'var(--surface-card)',
        border: '1px solid var(--border-hairline)',
        borderTop: danger ? '3px solid var(--signal-stop)' : '1px solid var(--border-hairline)',
        borderRadius: 'var(--r-4)', boxShadow: 'var(--shadow-3)', overflow: 'hidden',
        animation: 'none', ...style,
      }}>
        <div style={{ padding: '18px 20px 0' }}>
          {eyebrow && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{eyebrow}</div>}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginTop: eyebrow ? 4 : 0 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: 'var(--text-strong)', margin: 0 }}>{title}</h3>
            {onClose && (
              <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 20px 18px', fontSize: 14, lineHeight: 1.45, color: 'var(--text-body)' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-hairline)', background: 'var(--surface-sunken)' }}>{footer}</div>}
      </div>
    </div>
  );
}
