import React from 'react';
import { Icon } from '../core/Icon.jsx';

const deviceStates = {
  connected: { color: 'var(--signal-go)', icon: 'radio', text: 'Connected' },
  weak:      { color: 'var(--signal-warn)', icon: 'radio', text: 'Weak signal' },
  offline:   { color: 'var(--signal-stop)', icon: 'wifi-off', text: 'Offline' },
  pairing:   { color: 'var(--signal-info)', icon: 'bluetooth', text: 'Pairing…' },
};

export function DeviceStatus({ state = 'connected', name, id, battery, rssi, compact = false, style, ...rest }) {
  const s = deviceStates[state] || deviceStates.connected;
  const lowBatt = battery != null && battery <= 20;
  return (
    <div {...rest} style={{
      display: 'flex', alignItems: 'center', gap: compact ? 8 : 12,
      padding: compact ? 0 : '10px 12px',
      background: compact ? 'transparent' : 'var(--surface-card)',
      border: compact ? 'none' : '1px solid var(--border-hairline)',
      borderRadius: compact ? 0 : 'var(--r-2)', ...style,
    }}>
      <Icon name={s.icon} size={compact ? 16 : 20} color={s.color} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: compact ? 13 : 14, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.2 }}>
          {name || s.text}
        </div>
        {!compact && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginTop: 2 }}>
            {[id, s.text.toUpperCase(), rssi != null ? `${rssi}dBm` : null].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {battery != null && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: lowBatt ? 'var(--signal-warn)' : 'var(--text-muted)' }}>
          <Icon name={lowBatt ? 'battery-low' : 'battery'} size={16} />{battery}%
        </span>
      )}
    </div>
  );
}
