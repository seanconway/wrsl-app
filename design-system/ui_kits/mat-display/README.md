# Mat Display kit

The matside scoreboard — a 16:9 screen mounted at the edge of the mat, read by athletes,
coaches and spectators from up to 15 metres away. It is passive: it shows what the referee's
remote sends and nothing else. No controls appear on it.

**Files**

- `MatDisplay.jsx` — `DisplayHeader`, `CornerColumn`, `CenterColumn`, `NextUp`, `ResultOverlay`, `MatDisplay`
- `RefStrip.jsx` — demo-only stand-in for the referee's remote so the board can be driven in the browser
- `index.html` — running board: press the point buttons, stop time, end the match

**Rules this screen encodes**

- `.rr-mat` throughout — ink-950 field, no shadows anywhere, hairline dividers only.
- Score numerals at `--fs-148`, weight 900, tabular; corner colour is an 8px top edge on the
  tile and a left edge on the name plate — never a fill behind the number.
- Advantages and penalties are counted beneath the score, never added to it.
- The clock does not animate. A registered score flashes the tile lime at 12% for 140 ms; the
  numeral itself swaps with no motion.
- Nothing scrolls and nothing reflows — the layout is fixed at the display's native size.
