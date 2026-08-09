Section switch inside a console view.

```jsx
<Tabs value={tab} onChange={setTab} items={[
  { value: 'mats', label: 'Mats', icon: 'grid-3x3', count: 6 },
  { value: 'brackets', label: 'Brackets', icon: 'git-fork' },
]} />
```

Active tab is marked by a 2px lime underline (or a raised white pill in `segmented`).
