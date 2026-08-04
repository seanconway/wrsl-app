# 🏁 Scoreboard Web App

This is a modern React-based web app to serve as a Bluetooth-enabled wrestling scoreboard. The app supports timer control, scoring, and integration with ESP32-based wristbands via the Web Bluetooth API.

---

## 📦 Stack
- **Framework:** React
- **Styling:** Tailwind CSS
- **Bluetooth:** Web Bluetooth API
- **Build Tool:** Vite
- **Hosting:** Vercel
- **Version Control:** GitHub
- **Editor:** VS Code

---

## 🚀 Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/scoreboard-web.git
cd scoreboard-web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
- Open your browser to `http://localhost:5173`

---

## 🎨 Tailwind Setup
Already configured in:
- `tailwind.config.js`
- `src/index.css`

Edit styles using Tailwind utility classes.

---

## 🔌 Dongle wire protocol

The referee remotes talk BLE to an nRF52840 USB dongle, which bridges to this
app over USB CDC-ACM via the Web Serial API. The wire protocol is specified
in [`PROTOCOL.md`](./PROTOCOL.md). The firmware doesn't exist yet, so the
integration is built and tested in three layers that don't require hardware:

- **`src/protocol/protocol.js`** — pure line assembler + encode/parse
  functions for every message in the spec. Zero I/O, zero DOM, runs under
  plain Node.
- **`src/transport/`** — the transport interface (`connect`, `disconnect`,
  `write`, `onLine`, `onStatusChange`) with two implementations:
  `WebSerialTransport` (the only module allowed to touch `navigator.serial`)
  and `FakeDongleTransport`, a test double that records every line the app
  writes and can simulate inbound lines.
- **`src/dongle/DongleService.js`** — all protocol semantics (handshake,
  PING cadence, link supervision, CONFIRM, sequence-gap detection, EVT →
  scoreboard dispatch), transport-agnostic. Works identically against either
  transport.

Scoreboard state itself lives in a plain reducer
(`src/scoreboard/scoreboardReducer.js`) shared by the UI buttons and the
dongle service, so neither reimplements the other's scoring logic. The match
clock is driven by `performance.now()` deltas rather than counted
`setInterval` fires, per §11 of the protocol.

### Running the tests

Two suites, one command, no hardware and no browser required:

```bash
npm test
```

- `src/protocol/protocol.test.js` — parser/encoder tests, including every
  case in PROTOCOL.md §10 (chunk-boundary handling) and round-trips for
  every message type.
- `src/dongle/DongleService.test.js` — integration tests against
  `FakeDongleTransport` with fake timers: handshake, version checks, EVT →
  scoreboard mapping, CONFIRM, sequence gaps/wrap, LINK, link supervision,
  malformed input, and reconnect.

`grep -r "navigator.serial" src` should only ever match inside
`src/transport/WebSerialTransport.js`.

### Rehearsing against real Web Serial

`tools/fake_dongle.js` plays the dongle side of the link over a real
(virtual) serial port, for a one-time rehearsal of the app against actual
Web Serial before firmware exists. It's a manual tool, not part of the
automated suite.

1. Create a virtual serial port pair:
   - **macOS/Linux:** `socat -d -d pty,raw,echo=0 pty,raw,echo=0` — it
     prints two paths like `/dev/ttys004` and `/dev/ttys005`.
   - **Windows:** install [com0com](https://com0com.sourceforge.net/) and
     create a linked pair, e.g. `COM5` ↔ `COM6`.
2. Point the fake dongle at one end:
   ```bash
   node tools/fake_dongle.js /dev/ttys004
   ```
3. In the app's "Connect Dongle" button, pick the other end of the pair
   (`/dev/ttys005` / `COM6`). The fake dongle replies to `INFO`, `PING`, and
   `ECHO`, honours `CLOCK RUN`/`CLOCK STOP`, and can emit scripted `EVT`
   lines via `TEST 1` / `TEST 2` typed as raw protocol lines, or by editing
   the script.

---

## 🌍 Deployment (Later Step)
Will be deployed to:
- **Vercel** with automatic HTTPS
- Linked to a custom domain

---

## 🛠️ Scripts
```bash
npm run dev      # Start local server
npm run build    # Build for production
npm run preview  # Preview production build locally
```

---

## 🤝 Contributing
PRs welcome once BLE integration is stable!

---

## 📄 License
MIT (or your preferred license)
