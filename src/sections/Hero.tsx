import { useStore } from '../store.ts';

const LINKS = [
  ['scan', 'Scan'],
  ['metals', 'Metals'],
  ['leach', 'Bioleach'],
  ['report', 'Report'],
  ['science', 'Science'],
] as const;

export function Nav() {
  const ai = useStore((s) => s.ai);
  const sound = useStore((s) => s.sound);
  const set = useStore((s) => s.set);
  const label =
    ai.status === 'ready' ? 'AI ready'
      : ai.status === 'error' ? 'AI failed to load'
      : `Loading AI ${Math.round(ai.progress * 100)} %`;
  return (
    <header className="nav">
      <a href="#hero" className="wordmark" aria-label="Cuprum, back to top">Cuprum</a>
      <nav aria-label="Sections">
        {LINKS.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
      </nav>
      <div className="nav-right">
        <a className="btn" href="/pickup.html">Request pickup</a>
        <span className={`ai-chip is-${ai.status}`} title={ai.device || ai.error || 'Downloading the image model to this browser'}>
          <i className="live-dot" />{label}
        </span>
        <button type="button" className="icon-btn" aria-pressed={sound} onClick={() => set({ sound: !sound })}
          aria-label={sound ? 'Mute sounds' : 'Turn sounds on'}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
            <path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />
            {sound ? <path d="M13 7c1.3 1.6 1.3 4.4 0 6M15.5 5c2.5 2.8 2.5 7.2 0 10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              : <path d="M13 7l5 6M18 7l-5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      <span className="nav-progress" style={{ transform: `scaleX(${ai.status === 'ready' ? 0 : ai.progress})` }} aria-hidden />
    </header>
  );
}

export function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-copy">
        <h1 className="display">There’s copper in your junk drawer.</h1>
        <p className="lede">
          Hold an old gadget up to your camera. An AI model running on this device identifies it,
          estimates the metals inside, then simulates microbes dissolving the copper back out.
        </p>
        <div className="actions">
          <a className="btn primary" href="/pickup.html">Request a pickup</a>
          <a className="btn" href="#scan">Start scanning</a>
          <a className="btn" href="#leach">Open the simulator</a>
        </div>
      </div>
      <dl className="hero-fact">
        <div><dt>Gold in a tonne of old phones</dt><dd>≈ 350 g</dd></div>
        <div><dt>Gold in a tonne of mined ore</dt><dd>≈ 2.5 g</dd></div>
      </dl>
      <p className="scroll-cue" aria-hidden>Scroll</p>
    </section>
  );
}
