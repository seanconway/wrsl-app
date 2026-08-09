# Ref App kit

The referee's handset — the surface a referee holds or straps to a forearm during a match.
Everything on it is designed for one gloved hand and roughly three seconds of attention.

**Files**

- `Chrome.jsx` — `Phone`, `StatusBar`, `SheetTitle`, `TabBar`
- `ScoringScreen.jsx` — `CornerPad` and the live scoring view
- `QueueScreen.jsx` — the mat's match queue, synced from the Console
- `DeviceScreen.jsx` — paired devices, ruleset, buzzer and haptics
- `index.html` — click-through: score, stop time, end the match, confirm, next match loads

**Rules this screen encodes**

- Every control that fires during a match is `--touch-glove` (64px) or larger and **does not
  shrink on press** — a moving target is worse than no feedback under a glove.
- The scoring cluster and the destructive control (`End match`) are never adjacent: End sits
  in its own column, and ending a match always passes through a `Dialog`.
- Corner identity is a 5px left edge on the name, never a coloured panel.
- Status is glyph + word (`RUNNING`, `−52dBm`, `87%`), never colour alone.
