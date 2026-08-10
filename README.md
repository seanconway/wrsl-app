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
  emulator/                  dev-only: the dongle half of the protocol, plus an
                             interactive mockup of both remotes. Excluded from
                             the production build
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

Four suites, one command, no hardware and no browser:

```bash
npm test
```

- `src/protocol/protocol.test.js` — parser and encoder tests, including every case in PROTOCOL.md §14 and round-trips for every message type.
- `src/dongle/DongleService.test.js` — integration tests against `FakeDongleTransport` with fake timers: handshake, version guard, event dispatch, acknowledgement, sequence gaps and duplicates, indicator assertion on `JOIN`, link supervision, malformed input, and reconnect.
- `src/match/matchReducer.test.js` — the officiating logic.
- `src/emulator/dongleModel.test.js` — the same §14 contract asserted from the **dongle's** side of the wire, so both ends of the protocol are tested against one specification.

### The dongle emulator

The emulator runs the dongle half of the protocol over a real serial link and adds an interactive mockup of **both remotes** — pressable buttons with the firmware's gesture timing, LEDs rendering `STATE`, and a haptic motor that shows waveform and amplitude. The scoreboard connects through its ordinary Web Serial path and cannot tell it from firmware.

This is how the application is validated before firmware exists. It makes observable the two things a real dongle's single LED never can: **which** remote a haptic landed on (acknowledgement routing, §10.4) and **how strong** it was relative to the others (the beat/tap separation of FS §11.1). What it cannot tell you is how a real ERM feels on a wrist — that stays a hardware question.

**Prerequisite: a virtual serial port pair.**

- **Windows:** [Free Virtual Serial Ports](https://freevirtualserialports.com/) (HHD Software) — create a *local bridge* pair, e.g. `COM1` ↔ `COM2`. User-mode and GlobalSign-signed, so it installs with Secure Boot on and needs no driver-signing workaround.

  **Not com0com.** Its driver is unmaintained since 2017 and its signature is no longer trusted: on current Windows it installs but the bus device fails with **Code 52** (`CM_PROB_UNSIGNED_DRIVER`) and no ports appear. The only way to make it load is to enable test signing mode and reboot, which is not worth it for a bench tool.

- **macOS/Linux:** `socat -d -d pty,raw,echo=0 pty,raw,echo=0`

**Pick port names clear of your real hardware.** A J-Link (the nRF52840 DK) takes two CDC UART ports of its own, and each dongle takes another — collisions here are confusing rather than loud, because the picker just shows the wrong device.

Then:

1. `npm run dev`
2. Open **`http://localhost:5173/emulator.html`**, click *Open serial port…*, pick one end of the pair.
3. Open **`http://localhost:5173/?anyport`** in a second window — the `?anyport` query param widens the scoreboard's own port picker to every serial port, not just the dongle's USB identity, which "Connect dongle" otherwise filters to exclusively. Connect to the other end of the pair.
4. Arrange both windows side by side and **keep them visible.** A hidden tab has its timers clamped to roughly 1 Hz, which stops the heartbeat and trips supervision — the same throttling risk the application itself carries (PLAN.md §7, R1).

**The two halves talk over the serial pair, not over HTTP**, so they need not share an origin. Pointing a deployed scoreboard (`https://…/?anyport`) at a locally-run emulator is the better test of a release, because it exercises the artefact that actually shipped — rungs D1 and D7. Expect to grant serial permission again: grants are per-origin (D6).

`tools/fake_dongle.js` is the headless equivalent for scripted runs and a scrolling wire log:

```bash
node tools/fake_dongle.js COM1 [--test 2]
```

Both front-ends drive the same `src/emulator/dongleModel.js`, so they cannot drift apart.

## Status

Protocol **v3.0** is a breaking revision of the interface, written against the functional specification. **This application is at v3.0** — 137 tests passing, lint and production build clean, browser-verified against the fake transport. The dongle firmware is still at v2.0, so the two ends do not interoperate yet: plugging in today's dongle is correctly refused at the app's major-version guard. Closing that is milestone M2. See `PLAN.md` in the firmware repo for full status, completed and planned work, and the validation ladder.

## Deployment

Static hosting over **real HTTPS** — a secure context is required for Web Serial, and plain `http://` on a LAN IP will not work. The production origin must be decided before deployment, not after: serial permission grants are per-origin and are lost when the origin changes.

## License

Not yet determined.

