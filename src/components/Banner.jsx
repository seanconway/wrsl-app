import React from 'react';
import { Icon } from '../../design-system/components/core/Icon.jsx';
import { Button } from '../../design-system/components/core/Button.jsx';

const TONES = {
  stop: 'var(--signal-stop)',
  warn: 'var(--signal-warn)',
  info: 'var(--signal-info)',
};

/**
 * Errors say what happened, what the system did about it, and what the operator
 * can do — in that order, in at most two lines. No apology, no speculation, no
 * exclamation marks.
 */
export default function Banner({ tone = 'warn', icon = 'alert-triangle', title, detail, actions = [] }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-5)',
        padding: 'var(--sp-5) var(--sp-7)',
        background: 'var(--surface-card)',
        borderTop: `3px solid ${TONES[tone]}`,
        borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <Icon name={icon} size={24} color={TONES[tone]} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-16)', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</div>
        {detail && (
          <div style={{ fontSize: 'var(--fs-14)', color: 'var(--text-body)', marginTop: 2 }}>{detail}</div>
        )}
      </div>
      {actions.map((action) => (
        <Button key={action.label} size="md" variant={action.variant ?? 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}
