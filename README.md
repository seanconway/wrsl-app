# RefRemote — scoreboard application

The browser-based scoreboard for a **wireless single-operator officiating system**. A referee wearing a pair of wrist remotes runs a complete grappling match — clock, score, and the one or two ruleset-specific states that matter — with no table support. This application is the other end of that: it owns **all ruleset logic, all match state, the clocks of record, and the match event log**.

Firmware for the remotes and the USB dongle lives in [`refremote_nordic`](https://github.com/seanconway/refremote_nordic).

## Authoritative documents

Two documents in the firmware repo define the project and are the authority on direction — `SCOPE.md` and `SYSTEM_FUNC_SPEC.md`. Where any other document disagrees with them, they win. The requirements this application answers to are *Functional Specification* §8 (application requirements), §12 (ruleset configuration) and §2.2 (what the scoreboard owns).

[`PROTOCOL.md`](./PROTOCOL.md) in this repo is the dongle ↔ scoreboard wire protocol, kept **byte-identical** with the copy in the firmware repo.

## What this application is responsible for

The division is strict. The remote is stateless with respect to the match; this application holds everything. Its role in each case is to **compute, track and display — never to act**:

| Responsibility | What it does | What it does not do |
|---|---|---|
| Point values and totals | Maintains and displays each athlete's score | Never awards a point |
| Penalty, caution, warning and advantage counts | Maintains and displays counts and ladder position | Never applies the escalation consequence |
| Secondary clock | Tracks ownership, accrues time, resets at configured boundaries, commands the heartbeat | Never awards the resulting point |
| Activity clock | Runs the count-down, signals expiry | Never awards the passivity point |
| Phase and period structure | Advances phases with the clock, notifies at boundaries | Never gates or rejects input |
| Freestyle criteria | Groups scoring actions, evaluates and displays criteria | Never declares a winner |
| Pending-choice flag | Displays the referee-set state | Never sets or changes it |

**The system never scores automatically, never escalates a penalty automatically, and never rejects an input on ruleset grounds.** Clock behaviour is the one category of automatic action, because clocks are mechanisms rather than judgements — and no clock ever converts its own state into a score.

## Four requirements that shape the code

**Pure front-end, offline.** Served from a website and loaded once, then run entirely in the browser. **No data crosses the internet while a match is running**, and a match can be run start to finish with the venue's network absent. Tournament networks are unreliable; a scoring system that degrades with connectivity is unusable in exactly the conditions it exists for.

**Clock integrity.** The clock is derived from **monotonic elapsed-time measurement, never accumulated timer ticks** — displayed time is computed by subtraction from a recorded start reference on each render. It must be immune to wall-clock changes: NTP corrections, DST transitions, or a user adjusting the system clock must not affect a running match. An implausible gap in elapsed time halts the clock and requires explicit referee confirmation rather than being silently absorbed.

**Match state durability.** This application holds the only copy of match state. It is persisted locally as it changes, survives page reload and browser restart, and on load offers to restore an unfinished match with enough detail for the operator to confirm it is the right one.

**Self-reporting when wedged.** Link loss is well covered — the remote detects it locally and buzzes. The dangerous case is an application *running but wedged*, with the serial connection nominally alive, so the remotes see only an ambiguous silence. An internal watchdog detects a stall in match-state processing and **deliberately drops the serial connection**, converting that ambiguity into the same unmistakable link-loss signal a radio fault produces.

## Display

The display serves the referee, the athletes, coaches and spectators simultaneously, so it is tiered.

**Primary tier** — always visible, legible across a competition hall: athlete names and colours, score, period and match clock, the secondary clock when active, and link and battery status for both remotes.

**Secondary tier** — a collapsible detail panel: counts and ladder positions, pending-choice flag, phase, the scoring action log, criteria evaluation, set identity and diagnostics.

Collapsing the detail panel never reduces the primary tier's legibility, and no primary-tier element may be relegated to the panel. Link and battery sit in the primary tier despite not interesting spectators, because their *absence* is what the referee needs to notice immediately and unprompted.

## Design system

The interface is built on the **RefRemote Design System** (`design-system/`), which carries the tokens, type scale, component set and content rules. The matside surface — `.rr-mat`, near-black, no shadows, huge tabular numerals — is what the scoreboard uses.

Three rules from it that are easy to get wrong here:

- **Athlete red and green are functional, not brand.** They identify the two corners exactly as the ruleset requires, and are never re-used for UI meaning. Because green is spoken for, **UI "go" is lime**, never green.
- **Acid lime is the only brand colour** and means *live / valid / go*. One lime element per view is normal; three is a bug.
- **The live clock does not animate.** It ticks. No bounce, no spring, no count-up — an overshooting score animation looks like a mis-registered press.

## Architecture

```
src/
  protocol/protocol.js       line assembler + encode/parse for every message
                             in PROTOCOL.md. Zero I/O, zero DOM, runs under Node.
  transport/                 connect · disconnect · write · onLine · onStatusChange
    WebSerialTransport.js    the only module allowed to touch navigator.serial
    FakeDongleTransport.js   test double: records every line written, injects inbound
  dongle/DongleService.js    all protocol semantics — handshake, PING cadence,
                             supervision, ACK, dedupe, indicator assertion, haptics.
                             Transport-agnostic.
  match/                     ruleset config, match state, the clocks of record
  components/                UI, built from the design system
```

Match state lives in a plain reducer shared by the UI and the dongle service, so neither reimplements the other's logic. The serial transport sits behind a thin abstraction on purpose: a desktop-packaged build — which would remove the dependence on browser serial-access policy — should stay an inexpensive future option.

`grep -r "navigator.serial" src` should only ever match inside `src/transport/WebSerialTransport.js`.

## Host requirements

These are stated assumptions, not aspirations. The design does not attempt to function outside them, and deployment documentation must establish them before an event.

| Assumption | Consequence if violated |
|---|---|
| A **Chromium-based browser** on the host | The application will not run. Firefox and Safari do not support the serial access the dongle requires. |
| **Serial device permissions grantable** | The dongle cannot be reached. Granted once per machine, then persists. |
| The **scoreboard window stays in the foreground** for the duration of a match | Browser background throttling would delay timer-driven events including expiry notification. |
| The host is **configured not to sleep or suspend** mid-match | Suspension halts the application and the clock. |
| The application has been **loaded at least once with connectivity** | So it is cached and available offline at the venue. |

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
npm run preview
npm test
```

### Running without hardware

Two suites, one command, no hardware and no browser:

```bash
npm test
```

- `src/protocol/protocol.test.js` — parser and encoder tests, including every case in PROTOCOL.md §14 and round-trips for every message type.
- `src/dongle/DongleService.test.js` — integration tests against `FakeDongleTransport` with fake timers: handshake, version guard, event dispatch, acknowledgement, sequence gaps and duplicates, indicator assertion on `JOIN`, link supervision, malformed input, and reconnect.

### Rehearsing against real Web Serial

`tools/fake_dongle.js` plays the dongle side of the link over a real (virtual) serial port, so the application can be exercised against actual Web Serial before firmware exists. It is a manual tool, not part of the automated suite.

1. Create a virtual serial port pair:
   - **macOS/Linux:** `socat -d -d pty,raw,echo=0 pty,raw,echo=0`
   - **Windows:** [com0com](https://com0com.sourceforge.net/), e.g. `COM5` ↔ `COM6`
2. `node tools/fake_dongle.js /dev/ttys004`
3. Connect the app to the other end of the pair.

## Status

Protocol **v3.0** is a breaking revision of the interface, written against the functional specification. This application and the dongle firmware are both being brought up to it. See `PLAN.md` in the firmware repo for the milestone sequence and the validation ladder.

## Deployment

Static hosting over **real HTTPS** — a secure context is required for Web Serial, and plain `http://` on a LAN IP will not work. The production origin must be decided before deployment, not after: serial permission grants are per-origin and are lost when the origin changes.

## License

Not yet determined.
