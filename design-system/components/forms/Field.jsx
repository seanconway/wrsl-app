import React from 'react';

/* Shared label + hint + error shell for form controls. */
export function Field({ label, hint, error, htmlFor, required = false, children, style, ...rest }) {
  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={htmlFor} style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-strong)' }}>
          {label}{required && <span style={{ color: 'var(--signal-stop)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {(error || hint) && (
        <div style={{ fontSize: 12, lineHeight: 1.4, color: error ? 'var(--signal-stop)' : 'var(--text-muted)' }}>{error || hint}</div>
      )}
    </div>
  );
}
