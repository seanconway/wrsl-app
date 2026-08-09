# Console kit

The head table's operations app: six mats, a few hundred matches, one laptop, all day.
Paper surface, tight density, keyboard-friendly.

**Files**

- `Shell.jsx` — `ConsoleShell` (fixed `NavRail` + scrolling content) and `TopBar`
- `MatsView.jsx` — event stat bar + the `MatTile` grid (the default landing view)
- `BracketsView.jsx` — single-elimination bracket with live results posting in
- `AthletesView.jsx` — registration table with check-in status
- `DevicesView.jsx` — paired remotes and displays, link health, radio settings
- `index.html` — click-through across all five views; click a mat to open its live drawer

**Rules this screen encodes**

- The rail is always `--ink-950` even though the page is paper — it is the one fixed element.
- The sticky top bar is the only place in the system that uses backdrop blur (12px).
- Density: cards at 16px padding, table rows at 9px vertical, 13px body.
- A live mat is marked by a lime inset top edge **and** the `circle-dot` glyph **and** the word.
- `Settings` is intentionally an empty state — the brief described no settings screen, so
  none was invented.
