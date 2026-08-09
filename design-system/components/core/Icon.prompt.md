Masked Lucide glyph that always inherits `currentColor` — use it for every icon in RefRemote.

```jsx
<Icon name="timer" size={20} />
<Icon name="circle-dot" size={24} color="var(--signal-live)" label="Live" />
```

Stroke-only at 2px; never fill an icon. Sizes are fixed to 16/20/24/32+ — do not scale to arbitrary values. A bare icon control needs `label` plus a Tooltip.
