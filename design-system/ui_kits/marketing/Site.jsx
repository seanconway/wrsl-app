const { Button, Badge, Icon, Card, MatTile, ScoreTile, MatchClock, NamePlate, DeviceStatus } = window.RefRemoteDesignSystem_6d7f39;

function Wordmark({ color = '#fff', size = 20 }) {
  return (
    <span style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 900, letterSpacing: '-0.035em', color, lineHeight: 1 }}>
      <span style={{ fontWeight: 400 }}>Ref</span>Remote
    </span>
  );
}

function Nav() {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '0 40px', height: 68, borderBottom: '1px solid var(--alpha-hairline-dark)' }}>
      <Wordmark />
      <span style={{ display: 'flex', gap: 24, marginLeft: 16 }}>
        {['System', 'How it works', 'Rulesets', 'Pricing'].map((l) => (
          <a key={l} href="#" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-300)', borderBottom: 'none' }}>{l}</a>
        ))}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
        <a href="#" style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-300)', borderBottom: 'none' }}>Sign in</a>
        <Button size="sm">Request a demo</Button>
      </span>
    </nav>
  );
}

function Photo({ height, caption }) {
  return (
    <div style={{ position: 'relative', height, background: 'var(--ink-800)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--ink-950) 0%, transparent 60%)' }} />
      <span style={{ position: 'absolute', left: 16, top: 14, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-500)' }}>{caption}</span>
    </div>
  );
}

function Hero() {
  return (
    <section style={{ position: 'relative', padding: '0 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 48, alignItems: 'center', padding: '72px 0 64px' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--lime-500)' }}>Wearable officiating · Grappling</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 62, fontWeight: 900, letterSpacing: 'var(--ls-mega)', lineHeight: 1.02, color: '#fff', margin: '18px 0 0' }}>
            One referee, no table judge, no scoreboard operator.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--ink-300)', margin: '20px 0 0', maxWidth: '46ch' }}>
            RefRemote puts scoring in the referee's hand. Every press reaches the matside display and the tournament console in under 40 milliseconds, over a private radio link that does not depend on venue wi-fi.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
            <Button size="lg" iconRight="chevron-right">Request a demo</Button>
            <Button size="lg" variant="secondary" style={{ background: 'transparent', color: '#fff', borderColor: 'var(--ink-600)' }}>See the system</Button>
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 34, paddingTop: 22, borderTop: '1px solid var(--alpha-hairline-dark)' }}>
            {[['30 m', 'Range, line of sight'], ['9 h', 'Battery, one event day'], ['<40 ms', 'Press to display']].map(([n, l]) => (
              <div key={n}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 31, fontWeight: 900, letterSpacing: 'var(--ls-display)', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', textTransform: 'uppercase', color: 'var(--ink-400)', marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ border: '1px solid var(--alpha-hairline-dark)' }}>
          <Photo height={200} caption="PHOTOGRAPHY — REFEREE'S HAND ON THE REMOTE, MATSIDE" />
          <div style={{ background: 'var(--ink-900)', padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
            <ScoreTile corner="red" points={4} advantages={1} penalties={1} size="sm" style={{ background: 'var(--ink-850)' }} />
            <MatchClock seconds={151} running size="md" style={{ margin: '0 auto', alignItems: 'center' }} />
            <ScoreTile corner="green" points={7} size="sm" style={{ background: 'var(--ink-850)' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    ['radio', 'Pair once, at the door', 'Each remote binds to one mat and one display. Pairing takes a press and holds for the whole event.'],
    ['hand', 'Score without looking down', 'Points, advantages and penalties sit under fixed fingers. Haptic confirms every press so the referee keeps their eyes on the match.'],
    ['git-fork', 'Results post themselves', 'Ending a match writes the result to the bracket and loads the next pair on the mat. Nobody carries paper to the head table.'],
  ];
  return (
    <section style={{ padding: '64px 40px', borderTop: '1px solid var(--alpha-hairline-dark)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 39, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: '#fff', margin: 0 }}>How an event runs</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 32 }}>
        {steps.map(([icon, t, b], i) => (
          <div key={t} style={{ borderTop: '2px solid var(--lime-500)', paddingTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name={icon} size={20} color="var(--lime-500)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', color: 'var(--ink-400)' }}>0{i + 1}</span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, color: '#fff', margin: '12px 0 8px' }}>{t}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-300)', margin: 0 }}>{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Surfaces() {
  return (
    <section style={{ padding: '64px 40px', background: 'var(--paper)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 39, fontWeight: 700, letterSpacing: 'var(--ls-display)', color: 'var(--ink-900)', margin: 0, maxWidth: '18ch' }}>Three surfaces, one match state</h2>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-500)', margin: '0 0 4px', maxWidth: '42ch' }}>The remote, the matside display and the console all read from the same source. If the link drops, the remote buffers and replays.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginTop: 32 }}>
        <Card eyebrow="Referee" title="The remote" padding={16}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DeviceStatus state="connected" name="Remote 04" id="R-04" battery={87} rssi={-52} />
            <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.45 }}>Waterproof, glove-operable, 64px targets. Nine hours on a charge.</div>
          </div>
        </Card>
        <Card eyebrow="Matside" title="The display" padding={16}>
          <div className="rr-mat" style={{ background: 'var(--ink-950)', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScoreTile corner="red" points={4} size="sm" style={{ background: 'var(--ink-850)' }} />
            <MatchClock seconds={151} running size="md" style={{ margin: '0 auto', alignItems: 'center' }} />
            <ScoreTile corner="green" points={7} size="sm" style={{ background: 'var(--ink-850)' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.45, marginTop: 10 }}>Legible at 15 metres in gym lighting. Nothing on it can be pressed.</div>
        </Card>
        <Card eyebrow="Head table" title="The console" padding={16}>
          <MatTile mat={3} status="live" division="Adult blue · −76kg" clock="2:31" queued={5} red={{ name: 'Silva, M.', points: 4 }} green={{ name: 'Vandenberghe, J.', points: 7 }} style={{ boxShadow: 'inset 0 3px 0 var(--signal-live)' }} />
        </Card>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section style={{ background: 'var(--lime-500)', padding: '56px 40px', display: 'flex', alignItems: 'center', gap: 40 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 900, letterSpacing: 'var(--ls-mega)', color: 'var(--ink-950)', margin: 0, maxWidth: '20ch', lineHeight: 1.05 }}>Run your next event with one referee per mat.</h2>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
        <Button size="lg" style={{ background: 'var(--ink-950)', color: '#fff' }}>Request a demo</Button>
        <Button size="lg" variant="secondary" style={{ background: 'transparent', borderColor: 'var(--ink-950)', color: 'var(--ink-950)' }}>Talk to us</Button>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [['System', ['Remote', 'Mat display', 'Console', 'Rulesets']], ['Events', ['Pricing', 'Rental', 'Support', 'Status']], ['Company', ['About', 'Contact', 'Privacy']]];
  return (
    <footer style={{ padding: '48px 40px 40px', display: 'grid', gridTemplateColumns: '1.4fr repeat(3,1fr)', gap: 32, borderTop: '1px solid var(--alpha-hairline-dark)' }}>
      <div>
        <Wordmark size={22} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-label)', color: 'var(--ink-500)', marginTop: 12 }}>WEARABLE OFFICIATING FOR GRAPPLING SPORTS</div>
      </div>
      {cols.map(([h, links]) => (
        <div key={h}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 'var(--ls-eyebrow)', textTransform: 'uppercase', color: 'var(--ink-400)' }}>{h}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {links.map((l) => <a key={l} href="#" style={{ fontSize: 14, color: 'var(--ink-300)', borderBottom: 'none' }}>{l}</a>)}
          </div>
        </div>
      ))}
    </footer>
  );
}

function Site() {
  return (
    <div className="rr-mat" style={{ width: 1280, background: 'var(--ink-950)' }}>
      <Nav /><Hero /><Steps /><Surfaces /><CTA /><Footer />
    </div>
  );
}

Object.assign(window, { Site, Nav, Hero, Steps, Surfaces, CTA, Footer, Wordmark, Photo });
