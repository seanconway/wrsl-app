import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function NavRail({ items = [], value, onChange, brand = true, footer, style, ...rest }) {
  return (
    <nav {...rest} style={{
      width: 208, flex: '0 0 208px', display: 'flex', flexDirection: 'column',
      background: 'var(--ink-950)', color: 'var(--ink-200)', height: '100%', ...style,
    }}>
      {brand && (
        <div style={{ padding: '18px 16px 16px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, letterSpacing: '-0.035em', color: '#fff' }}>
          <span style={{ fontWeight: 400 }}>Ref</span>Remote
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px' }}>
        {items.map((it) => {
          const active = it.value === value;
          return (
            <button key={it.value} type="button" onClick={() => onChange && onChange(it.value)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              background: active ? 'var(--ink-800)' : 'transparent',
              boxShadow: active ? 'inset 3px 0 0 var(--lime-500)' : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: active ? 600 : 500,
              color: active ? '#fff' : 'var(--ink-300)',
              padding: '9px 10px', borderRadius: 'var(--r-1)', transition: 'var(--t-control)',
            }}>
              {it.icon && <Icon name={it.icon} size={20} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 'auto', padding: 12 }}>{footer}</div>
    </nav>
  );
}
