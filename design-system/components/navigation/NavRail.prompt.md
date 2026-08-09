The Console's fixed 208px left rail — always ink-950, regardless of the page surface.

```jsx
<NavRail value={view} onChange={setView} items={[
  { value: 'mats', label: 'Mats', icon: 'grid-3x3' },
  { value: 'brackets', label: 'Brackets', icon: 'git-fork' },
  { value: 'devices', label: 'Devices', icon: 'radio', badge: <Badge tone="warn">1</Badge> },
]} />
```

Active item: ink-800 fill plus a 3px lime inset edge.
