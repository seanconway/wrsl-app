# RefRemote Design System

RefRemote is a wearable, wireless officiating system for grappling sports. A referee wears a
small waterproof remote on the wrist or in the palm; every press — two points, advantage,
penalty, stop time — travels over a private radio link to a matside display and to the
tournament console. No table judge relaying scores by hand, no scoreboard operator, no
laptop tethered to the mat.

The system is used by BJJ, judo, wrestling, sambo and submission-grappling events, from
40-person local opens to multi-mat national championships.

## Sources

**None were supplied.** No codebase, Figma file, deck, screenshot or brand book was attached
to the brief that produced this system — the only input was the one-line company description
above. Everything here is authored from first principles for the officiating domain and should
be treated as a **proposal to be corrected**, not a record of an existing brand.

If you have real material, hand it over and this system should be re-derived from it:

| Source | Where it should be recorded | Status |
| --- | --- | --- |
| Product codebase | repo URL + `github.md` at project root | not provided |
| Figma library | full file URL, per-page | not provided |
| Decks / brand book | extracted into `assets/` | not provided |
| Font binaries | `assets/fonts/` + real `@font-face` | not provided (Google Fonts substitute) |
| Logo / wordmark | `assets/` | **not provided — no mark has been drawn** |

### On the logo

There is no RefRemote logo in this system. Nothing has been invented to fill the gap. Wherever
a mark belongs, the design system sets the brand name in plain type:

```
Ref Remote     →  Saira, "Ref" at 400, "Remote" at 900, -0.035em, no space between them
```

That lockup lives in `assets/wordmark.html` as a copyable reference. Replace it with the real
mark when one exists; do not ask a design tool to draw one.

## Products in this system

| Surface | Who touches it | Environment | Kit |
| --- | --- | --- | --- |
| **Ref App** — the handset and wrist remote UI | referee, mid-match | one gloved hand, 3 seconds of attention | `ui_kits/ref-app/` |
| **Mat Display** — matside scoreboard | athletes, coaches, spectators | read at 15 metres, gym lighting | `ui_kits/mat-display/` |
| **Console** — tournament operations web app | event staff, head table | desk, laptop, all day | `ui_kits/console/` |
| **Marketing** — refremote.com | organisers evaluating the system | browser, low intent | `ui_kits/marketing/` |

Two surface modes carry those four products:

- **Mat** — near-black, high contrast, huge numerals, no shadows. Every surface that is read
  from across a room or operated during a live match. Apply the `.rr-mat` class.
- **Paper** — warm off-white, ordinary UI density. Everything read at desk distance:
  the console, the website, printed brackets.

---

## CONTENT FUNDAMENTALS

RefRemote copy sounds like a good referee: brief, certain, and never in the way. A sentence
that would slow a match down does not ship.

### Voice

**Declarative, present tense, no hedging.** The product states what is true and what will
happen. It does not apologise, speculate or enthuse.

- ✅ "Mat 3 is offline. Scores are held locally."
- ❌ "Oops! It looks like we might be having trouble connecting to Mat 3."

**Second person for the operator, no first person for the product.** The system is equipment,
not a companion — it never says "I" or "we" inside a product surface. "We" is allowed on the
marketing site, where a company is speaking.

- ✅ "You have two matches queued on this mat."
- ❌ "I've queued two matches for you!"

**Verbs, not nouns.** Buttons say what the press does: `Start match`, `Add penalty`,
`Pair remote`, `Send to bracket`. Never `Submit`, `OK`, `Confirm`, `Continue`.

**The referee is always the authority.** The product never claims to have decided anything.
It records, transmits and displays. Copy reflects that: "Score sent", not "Score approved";
"Awaiting referee", not "Waiting for approval".

### Casing and punctuation

| Element | Rule | Example |
| --- | --- | --- |
| Buttons, menu items | Sentence case | `Add advantage` |
| Section headings | Sentence case | `Devices on this mat` |
| Eyebrows / column heads / status chips | ALL CAPS, mono, `--ls-eyebrow` | `MAT 3 · LIVE` |
| Athlete name plates | ALL CAPS, condensed | `SILVA, MARIA` |
| Scores, clocks, IDs | mono or tabular, never abbreviated | `04:32`, `R-1183` |
| Body copy | Sentence case, no terminal period on single-line UI strings | `Battery at 12%` |

No exclamation marks anywhere in product UI. Ellipses only for genuine in-progress states
(`Pairing…`). Em dashes are fine in prose, never in UI strings.

### Numbers and time

Time is always `M:SS` or `MM:SS`, zero-padded on the seconds and never on the minutes for
match clocks (`4:32`), fully padded on rest/medical clocks (`00:45`). Scores are bare integers
with no leading zeros. Advantages and penalties are counted, never scored: display them as
pips or small counts, never merged into the point total. Ruleset names are written as the
federation writes them: `IBJJF 2025`, `UWW Freestyle`, `IJF`, `ADCC`.

### Terminology (use these words, not synonyms)

`match` not game or bout · `mat` not ring or court · `bracket` not draw ·
`athlete` not player or fighter · `corner` (red/green) not side or team ·
`remote` not clicker or controller · `console` not dashboard or admin ·
`penalty` not foul · `advantage` not near-point · `division` not category.

### Emoji

**Never.** Not in product, not in marketing, not in release notes. Status is carried by
colour, a shape, or a word. The one decorative typographic character permitted is the middle
dot `·` as a separator in metadata rows (`MAT 3 · ADULT BLUE · -76KG`).

### Error and empty states

Errors say what happened, what the system did about it, and what the operator can do — in
that order, in at most two lines. Empty states name the thing that is missing and give the
one action that fixes it, with no illustration and no encouragement.

- Error: **"Remote 04 lost signal 8s ago. Scores are buffered on the remote. Move within 30m or switch to the backup remote."**
- Empty: **"No matches queued on Mat 3."** → `Assign from bracket`

### Marketing voice

Same restraint, more evidence. Lead with the operational fact, not the adjective: "One
referee, no table judge, no scoreboard operator." Numbers are specific and sourced
(`30 m range`, `9 h battery`, `<40 ms end to end`). No superlatives, no "revolutionary",
no "seamless", no promises about the future of the sport.

---

## VISUAL FOUNDATIONS

The system is designed for a hot, loud room with bad lighting where a decision has to be legible
in half a second. It is closer to broadcast timing graphics and industrial equipment than to
consumer software.

### Colour

**Acid lime `--lime-500 #C2F000` is the only brand colour.** It means *live, valid, go* — a
running clock, an active mat, a connected remote, the primary action. Because it carries that
meaning it is used sparingly: one lime element per view is normal, three is a bug. It never
appears as a large background field on paper surfaces, and never behind long-form text.

**Neutrals are the ink ramp `--ink-*`** — a near-black with a slight green shift so it sits
under lime without going muddy. Paper surfaces use `--paper #FAFAF7`, a warm off-white; pure
white is reserved for raised cards.

**Athlete red and green are functional, not brand.** `--athlete-red #E03127` and
`--athlete-green #12A150` identify the two corners, exactly as the ruleset requires. They are
never re-used for UI meaning (no red delete buttons in a scoreboard context), never tinted for
decoration, and never swapped for brand colours. `--athlete-white` exists for rulesets that
score a white gi corner.

Because green is spoken for, **UI "go" is lime, not green** — `--signal-go` resolves to
`--lime-500`. Blue survives only as `--signal-info`, a neutral informational colour with no
athlete meaning.

**Signals** are separate tokens even where the hex repeats: `--signal-go`, `--signal-warn`,
`--signal-stop`, `--signal-info`. Always paired with a shape or word — colour alone never
carries a state, because gym lighting and colour-blind coaches both exist.

Maximum two background fields per view. No gradients as decoration. The only gradient in the
system is a black protection scrim over photography (`linear-gradient(to top, var(--ink-950) 0%,
transparent 60%)`), used so a name plate stays legible over an action shot.

### Typography

**Saira** for everything visible: a slightly squared, athletic grotesque that holds up at
scoreboard size and stays plain at 13px. **Saira Condensed** for name plates, where long names
have to fit a fixed column. **JetBrains Mono** for clocks, device IDs, telemetry and any number
that changes in place — its tabular figures stop the clock from jittering.

Scale is a 1.26 ratio from 11px, extended upward with a jump into scoreboard sizes:
`11 · 12 · 13 · 14 · 16 · 18 · 21 · 25 · 31 · 39 · 49 · 62 · 78 · 104 · 148 · 220`.

- Display / scoreboard: 78–220px, weight 900, `--ls-mega`, `--lh-tight`.
- Headings: 21–49px, weight 700, `--ls-display`.
- Body: 16px / 1.45. UI labels 13–14px / 1.45, weight 500.
- Eyebrows and column heads: 11px mono, uppercase, `--ls-eyebrow`.
- **Floor: 13px on paper, 16px matside.** Nothing smaller ships on a surface used mid-match.

Numerals that update live always get `font-variant-numeric: tabular-nums` (`.rr-num`).

### Spacing and layout

4px base with a compressed low end (`2 4 6 8 12 16 20 24 32 40 56 72 96 128`). Console density
is deliberately tight — event staff work a full table on a 13" laptop — so cards sit at 16px
padding and rows at 8px vertical.

Touch targets: 44px minimum, **64px (`--touch-glove`) for anything pressed during a live
match**. Referee controls are large, widely separated, and placed where a thumb rests; the
destructive action is never adjacent to the scoring action.

Layout is grid-first with `gap`, never margins between siblings. Matside layouts are fixed
and full-bleed: the scoreboard fills the display, nothing scrolls, nothing reflows. The console
is a fixed left rail + fluid content region, max 1200px on marketing pages.

### Surfaces, borders, shadows

**Paper surfaces** use white cards on `--paper`, a 1px hairline `--alpha-hairline-light`, radius
`--r-3` (9px), and a low shadow `--shadow-1` or `--shadow-2`. Shadows are neutral-grey and
short — no coloured or spread-heavy shadows.

**Matside surfaces use no shadows at all.** Depth comes from a step in the ink ramp plus a 1px
`--alpha-hairline-dark` border. The only "glow" in the system is `--glow-live` — a lime ring
on the element that is currently live (the running clock, the armed remote). It is a state,
not a style.

Radii are small and deliberately off-grid: `3 · 5 · 9 · 14 · 22 · 999`. Buttons take 5px,
cards 9px, sheets and modals 14px, remote-hardware renderings 22px, chips and pips full round.
Score tiles and name plates take **no radius at all** — square corners read as instrumentation.

### Blur and transparency

Used in exactly two places: the scrim behind a modal (`--alpha-scrim`, no blur — blur costs
frames on cheap matside hardware) and the fixed console header, which sits on
`rgba` paper with a 12px backdrop blur when content scrolls under it. Nowhere else. No
frosted cards, no translucent panels on the scoreboard.

### Motion

Fast and mechanical. Officiating UI must feel like a switch, not an animation.

- Durations: 90ms (press feedback) / 140ms (hover, chips, toggles) / 220ms (sheets, tabs) /
  380ms (page-level only).
- Easing: `--ease-out cubic-bezier(.2,.8,.2,1)` for entrances, `--ease-snap` for anything
  that represents a hardware event.
- **No bounce, no spring, no overshoot** — an overshooting score animation looks like a
  mis-registered press.
- Score changes: the new value cross-fades in 90ms while the tile flashes `--lime-500` at 12%
  for 140ms. The number itself never slides or counts up.
- The live clock does not animate at all. It ticks.
- `prefers-reduced-motion` removes the flash and leaves the value change.

### Interaction states

| State | Paper | Mat |
| --- | --- | --- |
| Hover | 4% ink overlay, border darkens one step | 8% white overlay |
| Press | scale 0.98 + 6% ink overlay, 90ms | 12% white overlay, **no scale** (gloved presses need a fixed target) |
| Focus | `--glow-focus` — 3px lime ring at 45% | same ring, full opacity |
| Selected | lime left/top edge 3px + ink-900 text | lime fill, ink-950 text |
| Disabled | 38% opacity, no pointer events | 30% opacity |
| Live / armed | — | `--glow-live` ring |

Hover states never change layout. On the matside surface hover is effectively unused — those
screens are touch or display-only.

### Imagery

Photography is the only imagery: real mats, real gis, real referees. Cool-neutral grade,
high contrast, deep blacks, no warm filter and no grain overlay. Full-bleed with a bottom
protection scrim when type sits on top. Images are always cropped to action or hands on
equipment — never staged product-on-white beyond the single hardware shot.

**There is no illustration system, and no icon-plus-pastel-card pattern.** If a concept needs
explaining, it gets a diagram made of the same rectangles and rules the product uses.

---

## ICONOGRAPHY

**Substitution flagged:** no icon set was supplied. This system uses **Lucide**
(2px stroke, round caps, 24px grid) loaded from CDN, chosen because its stroke weight and
squared-off geometry match Saira. Replace it if RefRemote has its own set.

```
https://unpkg.com/lucide@0.462.0/dist/umd/lucide.js
```

Icons are used through the `Icon` component (`components/core/Icon.jsx`), which renders the
glyph as **inline SVG** with `stroke="currentColor"` — so it always takes the colour of its
context, survives export and screenshot pipelines, and never ships as a coloured PNG. The
component lazy-loads the Lucide UMD bundle itself; putting the `<script>` in a page's `<head>`
just makes glyphs present on first paint.

### Rules

- **Stroke only, 2px, never filled** — with one exception: the live/record dot, which is a
  filled circle because it must read at distance.
- Icons carry a label except in a rail or a toolbar where the position is learned. A bare
  icon button always has a tooltip and an `aria-label`.
- Nominal sizes: 16px (inline with 13–14px text), 20px (buttons, rows), 24px (rail, headers),
  32px+ (matside status only). Never scaled to arbitrary sizes.
- Icons inherit text colour. The only coloured icons in the system are `--signal-*` status
  glyphs and the athlete-corner markers.
- **No emoji, ever.** No unicode pictographs as icons. The middle dot `·` and the arrow `→`
  are the only unicode characters used typographically.

### The working set

`play` `pause` `square` (stop) `rotate-ccw` (reset) `plus` `minus` `flag` (penalty)
`chevrons-up` (advantage) `hand` (referee) `timer` `radio` (signal) `battery` `battery-low`
`wifi-off` `bluetooth` `users` (athletes) `grid-3x3` (mats) `git-fork` (bracket) `list`
`settings` `chevron-right` `chevron-down` `x` `check` `alert-triangle` `circle-dot` (live)
`monitor` (display) `printer` `download` `search` `filter` `more-horizontal`.

Anything outside that list should be added to it here before use.

---

## INDEX

### Root

| File | What it is |
| --- | --- |
| `styles.css` | The single entry point consumers link. `@import` lines only. |
| `thumbnail.html` | Homepage tile for this design system. |
| `readme.md` | This file — context, content fundamentals, visual foundations, iconography. |
| `SKILL.md` | Agent Skill front matter, for using this system in Claude Code. |
| `tokens/` | `fonts · colors · typography · spacing · radius · elevation · motion · semantic · base` |
| `guidelines/` | 22 foundation specimen cards (Colors, Type, Spacing, Brand). |
| `assets/` | `wordmark.html` only — no logo, no illustration, no photography was supplied. |
| `components/` | 23 reusable primitives, grouped below. |
| `ui_kits/` | Four product recreations, listed below. |

### Components

Import from the compiled bundle: `const { Button } = window.<Namespace>` — run `check_design_system` for the current namespace.

**`components/core/`** — `Icon` · `Button` · `IconButton` · `Card` · `Badge` · `Tag`

**`components/forms/`** — `Field` · `Input` · `Select` · `Checkbox` · `Radio` · `Switch`

**`components/feedback/`** — `Dialog` · `Toast` · `Tooltip`

**`components/navigation/`** — `Tabs` · `NavRail`

**`components/officiating/`** — `MatchClock` · `ScoreTile` · `NamePlate` · `PenaltyPips` · `DeviceStatus` · `MatTile`

Each component directory holds `<Name>.jsx`, `<Name>.d.ts` (props contract) and
`<Name>.prompt.md` (what & when, plus a usage example), with one `*.card.html` per directory
showing its states.

### Intentional additions

No source defined a component inventory, so the standard primitive set was authored from
scratch. Three additions are worth calling out, because they are not generic UI:

- **The `officiating/` group** (`MatchClock`, `ScoreTile`, `NamePlate`, `PenaltyPips`,
  `DeviceStatus`, `MatTile`) — the domain objects the product is actually made of. Every
  RefRemote surface is assembled from these; without them each kit would re-invent a
  scoreboard.
- **`Icon`** — a wrapper over the substituted Lucide set so a glyph swap is one file, not a
  find-and-replace across four kits.
- **`Field`** — a shared label/hint/error shell, so form controls stay single-purpose.

`Toast` and `Tooltip` are part of the standard set but are barely used in the kits: the
matside surfaces have no room for either.

### UI kits

| Kit | Entry | Screens |
| --- | --- | --- |
| `ui_kits/mat-display/` | `index.html` (1280×720) | Live board, result overlay, next-up strip, plus a demo remote strip that drives it |
| `ui_kits/ref-app/` | `index.html` (390×800 handset) | Scoring pad, match queue, device pairing, end-match confirmation |
| `ui_kits/console/` | `index.html` (1440×900) | Mats overview, brackets, athletes, devices, live-mat drawer |
| `ui_kits/marketing/` | `index.html` (1280 wide) | Landing page: hero, how it works, three surfaces, CTA, footer |

Each kit has its own `README.md` naming the files and the rules that screen encodes.

### Known gaps

- **No font binaries.** Saira and JetBrains Mono load from Google Fonts. Swap in licensed
  `.woff2` files under `assets/fonts/` and replace the `@import` in `tokens/fonts.css`.
- **No icon set.** Lucide is substituted from CDN.
- **No logo.** Plain type only, by design — see "On the logo" above.
- **No photography.** `Photo` in the marketing kit is an empty block with the protection
  scrim already applied.
- **No slide template.** None was supplied, so none was authored.
- `Console → Settings` is deliberately an empty state rather than an invented screen.
