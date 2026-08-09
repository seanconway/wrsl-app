import React from 'react';

const badgeTones = {
  neutral: { bg: 'var(--surface-sunken)', fg: 'var(--text-body)', bd: 'var(--border-hairline)' },
  live:    { bg: 'var(--lime-500)', fg: 'var(--ink-950)', bd: 'transparent' },
  go:      { bg: 'var(--lime-100)', fg: 'var(--lime-800)', bd: 'transparent' },
  warn:    { bg: '#FFF1D1', fg: '#7A5200', bd: 'transparent' },
  stop:    { bg: 'var(--athlete-red-tint)', fg: 'var(--athlete-red-deep)', bd: 'transparent' },
  info:    { bg: '#E6EDFC', fg: '#12409A', bd: 'transparent' },
  red:     { bg: 'var(--athlete-red)', fg: '#fff', bd: 'transparent' },
  green:   { bg: 'var(--athlete-green)', fg: '#fff', bd: 'transparent' },
};

export function Badge({ tone = 'neutral', dot = false, children, style, ...rest }) {
  const t = badgeTones[tone] || badgeTones.neutral;
  return (
    <span {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
      letterSpacing: 'var(--ls-label)', textTransform: 'uppercase',
      padding: '3px 7px', borderRadius: 'var(--r-1)', whiteSpace: 'nowrap', ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />}
      {children}
    </span>
  );
}
