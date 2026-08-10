# Working notes for the RefRemote scoreboard

Working knowledge for anyone — human or agent — working in this repo. It holds what is **not** written down elsewhere: conventions, traps, and the reasoning behind choices that look arbitrary from the code.

**The specifications live in the sibling `refremote_nordic` repo** — `SCOPE.md` (what the system is), `SYSTEM_FUNC_SPEC.md` (how it behaves, cited as "FS §n"), `PLAN.md` (the living status document — completed work, planned work, binding decisions, the validation ladder, version history), and a fuller `CLAUDE.md` covering both repos and the firmware. Those two specifications are authoritative on direction and behaviour. A change that contradicts them is a conversation, not an implementation detail.

`PROTOCOL.md` is here too, and **must stay byte-identical to the copy in `refremote_nordic`.** Copy it explicitly and compare hashes — the two were once joined by a hard link, which broke silently when an editor wrote a new file instead of modifying in place, leaving the repos on different versions with no indication.

---

## Commands

```bash
npm run dev      # http://localhost:5173/  · emulator at /emulator.html
npm test         # vitest, 137 tests across 4 files
npm run lint     # eslint; `design-system` and `dist` are ignored
npm run build    # run before claiming done
```

No hardware is needed for any of it. `FakeDongleTransport` exercises the full protocol surface in tests, and the emulator does it over a real serial link.

---

## Layout

| Path | Holds |
|---|---|
| `src/protocol/protocol.js` | The wire contract: line assembly, parsing, encoders. Pure, no I/O |
| `src/dongle/DongleService.js` | Protocol semantics — handshake, `PING`, supervision, `ACK`, dedupe, indicators, heartbeat, counters. Transport-agnostic |
| `src/transport/` | `WebSerialTransport` and `FakeDongleTransport` behind one interface |
| `src/match/matchReducer.js` | **All officiating logic.** Every input lands here |
| `src/match/rulesets.js` | The ruleset library as pure data, in the FS §12.2 schema |
| `src/match/clock.js` | The monotonic clock of record |
| `src/components/` | Display only. Primary tier, secondary tier, pre-match, banners, the software remotes |
| `src/components/useGesture.js` | Press / hold / hold-repeat timing. Shared by the operator controls and the emulator, so a gesture has one definition |
| `src/emulator/` | Dev-only. `dongleModel.js` is the dongle half of the protocol with no transport; the page adds a mockup of both remotes. Not in the production build |
| `design-system/` | Vendored. Imported whole via `src/index.css` |

---

## Conventions that are load-bearing

**Comments say why, not what.** The density is deliberate — most comments record a decision, a constraint discovered the hard way, or something that will look wrong to the next reader. Match it. When deleting code, check whether its comment recorded something still true.

**One path into match state.** A referee's press and an operator's click on the software remotes dispatch the identical `INPUT` action through the identical reducer path, with the same gesture timing (600 ms hold, 150 ms repeat — those are firmware constants restated, not configuration). There is deliberately no operator shortcut that bypasses what a referee can do. A second path into scoring state is a second thing that can be wrong, and it diverges silently.

**Two time domains, never mixed.** `performance.now()` via `monotonicNow()` is the clock of record, and elapsed time is always a *subtraction of two readings* — never an accumulation of ticks, which drifts and turns a skipped frame into lost match time. `Date.now()` is read only as a corroborating witness for suspend detection, and for wall-clock stamps. Anything named `*Mono` is monotonic; anything named `*Wall` is not. Comparing across the domains throws nothing and means nothing — it was a real bug during M1.

**Fail closed on the wire.** A malformed line is discarded, not guessed at. A v2.0-shaped `EVT ADD_POINT RED 17` has three arguments where v3.0 needs four and must be rejected, not read as a gestureless press (`PROTOCOL.md` §14 T7, and there is a test). Resynchronisation happens at the next `\n`, never at a chunk boundary.

**Late is worse than never.** An acknowledgement outside its ~120 ms window degrades to silence rather than arriving late. The referee's rule is "no tap means the press did not land, press again" — a late tap makes them score twice, and it looks like referee error.

**Inert and no-op are different.** An *inert* button — a ruleset leaving F1 unassigned — produces no action, no haptic, no indicator, no trace, and `ACK … SILENT`; the control is simply dead, because a rejection signal confuses more than silence does. A *no-op* — `REMOVE_POINT` at the score floor — still earns a full acknowledgement tap, because the referee needs to know the press registered. They look alike in the reducer and are not alike. Both have tests.

---

## Design system

| Rule | Why |
|---|---|
| **Acid lime `--lime-500` means live / valid / go, and nothing else.** One in view is normal; three is a bug | Its entire value is scarcity. A lime "Clock" button on a stopped clock says "running" when it is not |
| Athlete red and green are **functional, not brand** | Fixed by the ruleset; they identify the corners. Never restyle, never theme, never let a browser adjust them |
| `--touch-glove` (64px) minimum for anything pressed during a live match | Gloved hands, glanced at, under time pressure |
| Nothing scrolls, nothing reflows | A scoreboard that moves under a referee glancing up costs them a second they do not have |
| Emphasis by **weight and size** before colour | The oversized tactile datum of FS §3.1 is dominant by mass, not hue |
| **No network fetches** | SCOPE.md §7.3 requires a complete match with the venue's network absent |

Do not edit `design-system/` to fix an application problem. The one deliberate exception is `Icon.jsx` — upstream fetched Lucide from a CDN, and it was replaced with a local inline-SVG glyph map; the reason is in a comment at the top of the file. The remaining known fetch is the Google Fonts import in `tokens/fonts.css`, logged in `PLAN.md` §8.

---

## Traps already hit

| Trap | Symptom | Fix |
|---|---|---|
| **Chrome auto-dark-mode** | Every surface flattens to `rgb(24,26,27)` and every colour to one off-white — on a stock profile, not the developer's | `<meta name="color-scheme" content="dark">` **and** `:root { color-scheme: dark; }`. `.rr-mat` sits inside `#root` and the browser decides before it gets there |
| **JSX comment inside a `&&`** | Parse error — `{/* … */}` directly inside a parenthesised `&&` is read as an object literal | Use a `//` comment inside the attribute list |
| **Cancelled Web Serial picker** | The rejection trips the watchdog and drops the link, so an operator dismissing a dialog looks like an application fault | `.catch(() => {})` at every `connect`/`reconnect` call site |
| **Reading a running accumulator's stored base** | A readout frozen at `00:00` beside a primary tier counting up | Evaluate at a `now`. Thread `now` down rather than reading state directly |
| **com0com on current Windows** | Installs cleanly, service stays `Stopped`, no ports ever appear. The bus device reports **Code 52** — its 2017 driver signature is no longer trusted | Use [Free Virtual Serial Ports](https://freevirtualserialports.com/) instead: user-mode, GlobalSign-signed, no reboot and no test-signing mode |
| **Virtual port names colliding with real hardware** | The picker lists a port that looks right and opens the wrong device | A J-Link takes two CDC UART ports and each dongle another. Enumerate what is already claimed before naming a pair |
| **`filters: []` to mean "show every port"** | Reads equally as "match nothing", and browsers have not been consistent | `pickerOptions()` in `WebSerialTransport` turns an empty list into `requestPort()` with no argument, which is the spec-guaranteed form |

---

## Verify in a browser, not just in the suite

Two M1 defects passed the tests, the linter and the build, and were found only by driving the app in Chrome — the frozen readout and the repainted palette above. The generalisation: **anything derived from a running clock must be watched for several seconds**, and **the developer's browser is not a representative browser.**

---

## The emulator is the executable spec

`src/emulator/dongleModel.js` is the dongle half of `PROTOCOL.md` in JavaScript, and it is what the application is validated against before firmware exists. Two consequences:

- **A change to the wire contract lands in three places** — `PROTOCOL.md`, `DongleService`, and the model — and the model is the one that is easy to forget. `dongleModel.test.js` asserts the §14 cases from the dongle's side; if it and `protocol.test.js` ever disagree, one of them is wrong about the spec.
- **The model must not be made convenient.** Its value is that it is unforgiving in the same places the firmware has to be: the 120 ms window really expires, a malformed line is really discarded, an acknowledgement really routes by `src`. Softening any of those makes the application pass against a contract the firmware will not honour.

Run it with `npm run dev` and open `/emulator.html`; it needs a virtual serial pair. See the README for which tool and why.

**`?anyport`** widens the scoreboard's port picker to every serial port instead of the dongle's USB identity, which is how it reaches a virtual pair. It ships to production deliberately — it is what lets a deployed build be tested against the emulator (D1, D7) — and requires typing a query param, so no operator reaches it by accident. The narrow filter remains the default on every ordinary load, and that default is the thing stopping an operator opening the wrong device.

## Current state

The app is at protocol v3.0 and complete for milestone M1. **The dongle firmware is still at v2.0**, so real hardware is currently refused at the major-version guard — correct behaviour, and what milestone M2 closes. Develop against `FakeDongleTransport` in tests and the emulator for anything you need to watch.
