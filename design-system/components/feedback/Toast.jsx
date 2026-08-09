import React from 'react';
import { Icon } from '../core/Icon.jsx';

const toastTones = {
  info: { icon: 'circle-dot', color: 'var(--ink-100)' },
  go:   { icon: 'check', color: 'var(--lime-500)' },
  warn: { icon: 'alert-triangle', color: 'var(--signal-warn)' },
  stop: { icon: 'x', color: 'var(--signal-stop)' },
};

export function Toast({ tone = 'info', title, detail, action, onDismiss, style, ...rest }) {
  const t = toastTones[tone] || toastTones.info;
  return (
    <div role="status" {...rest} style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: 'var(--ink-900)', color: 'var(--ink-50)',
      border: '1px solid var(--alpha-hairline-dark)', borderLeft: `3px solid ${t.color}`,
      borderRadius: 'var(--r-2)', padding: '11px 13px', minWidth: 300, maxWidth: 420,
      boxShadow: 'var(--shadow-3)', ...style,
    }}>
      <Icon name={t.icon} size={16} color={t.color} style={{ marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
        {detail && <div style={{ fontSize: 12.5, color: 'var(--ink-300)', marginTop: 3, lineHeight: 1.4 }}>{detail}</div>}
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" aria-label="Dismiss" onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--ink-400)', cursor: 'pointer', padding: 0, display: 'flex' }}>
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
