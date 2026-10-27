import { useEffect, useRef } from 'react';
import { useStore } from '../store.ts';
import { ORGANISMS, METALS } from '../data/science.ts';
import { litInput, organism } from '../sim/model.ts';
import { useResults } from '../sim/useResults.ts';
import { RecoveryChart, ScenarioChart } from '../ui/charts.tsx';
import { Segmented, Sim, Slider } from '../ui/controls.tsx';
import { mass, pct, useMoney } from '../ui/format.ts';
import { FeedNotice } from '../ui/FeedNotice.tsx';

const PLAY_SECONDS = 7;

export function Leach() {
  const s = useStore();
  const r = useResults();
  const money = useMoney();
  const o = organism(s.process.organismId);
  const section = useRef<HTMLElement>(null);
  const played = useRef(false);

  // Time-lapse playback of the reactor: day runs 0 → duration.
  useEffect(() => {
    if (!s.playing) return;
    let raf = 0;
    const start = performance.now() - (s.day / s.process.days) * PLAY_SECONDS * 1000;
    const step = (now: number) => {
      const d = Math.min(s.process.days, ((now - start) / (PLAY_SECONDS * 1000)) * s.process.days);
      useStore.setState({ day: d, playing: d < s.process.days });
      if (d < s.process.days) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, s.process.days]);

  // Run the time-lapse once, the first time the reactor comes into view.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !played.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        played.current = true;
        useStore.setState({ day: 0, playing: true });
      }
    }, { threshold: 0.45 });
    io.observe(section.current!);
    return () => io.disconnect();
  }, []);

  const play = () => useStore.setState({ day: s.day >= s.process.days ? 0 : s.day, playing: !s.playing });
  const setP = (p: Parameters<typeof s.setProcess>[0]) => { s.setProcess(p); useStore.setState({ playing: false, day: p.days ?? s.process.days }); };
  const rgb = r.rgb;

  return (
    <section id="leach" className="leach" ref={section}>
      <header className="section-head">
        <p className="step">Step 3 of 4</p>
        <h2>Let microbes do the mining</h2>
        <p className="section-lede">
          Board powder goes into acidic water with iron-oxidising microbes. They keep regenerating ferric iron, which
          dissolves the copper as blue Cu²⁺ ions. Use the proposal’s simple formula, or model the process itself.
        </p>
        <Segmented label="Simulation mode" value={s.mode} onChange={(mode) => s.set({ mode })}
          options={[{ value: 'simple', label: 'Simple formula' }, { value: 'process', label: 'Process model' }]} />
      </header>

      <div className="lab">
        <div className="lab-controls">
          <FeedNotice where="leach" />
          {s.mode === 'simple' ? (
            <>
              <Slider label="Waste mass" value={s.massG} min={100} max={10000} step={50} onChange={(massG) => s.set({ massG })} format={mass} />
              <Slider label="Copper content" value={s.simple.cu} min={0.01} max={0.4} step={0.005}
                onChange={(cu) => s.set({ simple: { ...s.simple, cu } })} format={(v) => pct(v, 1)}
                marks={[{ at: r.preset.comp.Cu ?? 0.2, label: `${r.preset.name}: ${pct(r.preset.comp.Cu ?? 0, 1)}` }]} />
              <Slider label="Recovery efficiency" value={s.simple.eff} min={0} max={1} step={0.01}
                onChange={(eff) => s.set({ simple: { ...s.simple, eff } })} format={(v) => pct(v)} />
              <button type="button" className="link" onClick={s.proposalExample}>Reset to the proposal’s example (1 kg, 15 %, 60 %)</button>
            </>
          ) : (
            <>
              <fieldset className="organisms">
                <legend>Microorganism</legend>
                {ORGANISMS.map((x) => (
                  <label key={x.id} className={x.id === o.id ? 'on' : ''}>
                    <input type="radio" name="org" checked={x.id === o.id} onChange={() => setP(litInput(x))} />
                    <span className="org-name">{x.short}</span>
                    <span className="org-kind">{x.kind}</span>
                  </label>
                ))}
              </fieldset>
              <p className="org-mech">{o.mechanism}</p>
              <Slider label="Temperature" value={s.process.T} min={5} max={65} step={0.5} onChange={(T) => setP({ T })}
                format={(v) => `${v.toFixed(1)} °C`} marks={[{ at: o.T[1], label: `Optimum ${o.T[1]} °C` }]} />
              <Slider label="pH" value={s.process.pH} min={0.5} max={12} step={0.05} onChange={(pH) => setP({ pH })}
                format={(v) => v.toFixed(2)} marks={[{ at: o.pH[1], label: `Optimum pH ${o.pH[1]}` }]} />
              <Slider label="Pulp density" value={s.process.pd} min={1} max={150} step={0.5} onChange={(pd) => setP({ pd })}
                format={(v) => `${v.toFixed(1)} g/L`} hint="Grams of board powder per litre. More powder means more toxic stress on the microbes." />
              <Slider label="Particle size" value={Math.log10(s.process.sizeUm)} min={Math.log10(37)} max={Math.log10(2000)} step={0.01}
                onChange={(v) => setP({ sizeUm: Math.round(10 ** v) })} format={() => `${s.process.sizeUm} µm`} />
              <Slider label={<>{o.substrate.name} <span className="formula">({o.substrate.formula})</span></>} value={s.process.sub}
                min={0} max={o.substrate.max} step={o.substrate.max / 100} onChange={(sub) => setP({ sub })}
                format={(v) => `${v.toFixed(1)} g/L`} marks={[{ at: o.substrate.ref, label: `Published: ${o.substrate.ref} g/L` }]} />
              <Slider label="Duration" value={s.process.days} min={1} max={30} step={1} onChange={(days) => setP({ days })} format={(v) => `${v} days`} />
              <Segmented label="Culture setup" value={s.process.twoStep ? 'two' : 'one'} onChange={(v) => setP({ twoStep: v === 'two' })}
                options={[{ value: 'one', label: 'One-step' }, { value: 'two', label: 'Two-step (pre-grown)' }]} />
              <button type="button" className="link" onClick={() => setP(litInput(o))}>Use the published conditions for {o.short}</button>

              <dl className="meters">
                <Meter label="Microbial activity" v={r.f.activity} />
                <Meter label="Temperature fit" v={r.f.fT} />
                <Meter label="pH fit" v={r.f.fpH} />
                <Meter label="Toxicity headroom" v={r.f.fPD} />
                <Meter label="Substrate supply" v={Math.min(1, r.f.fSub)} />
              </dl>
              <p className="fineprint">{r.f.growing ? `Lag phase about ${r.f.lag.toFixed(1)} days.` : 'These conditions are outside the organism’s growth range, so only plain acid leaching happens.'} Source: {o.source}.</p>
            </>
          )}
        </div>

        <div className="lab-stage" aria-label="Simulated bioreactor">
          <div className="reactor-hud">
            {s.mode === 'process' && (
              <div className="playback">
                <button type="button" className="icon-btn" onClick={play} aria-label={s.playing ? 'Pause time-lapse' : 'Play time-lapse'}>
                  {s.playing
                    ? <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /></svg>
                    : <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M4 2.5 13 8l-9 5.5z" fill="currentColor" /></svg>}
                </button>
                <input type="range" min={0} max={s.process.days} step={0.01} value={s.day} aria-label="Day"
                  onChange={(e) => useStore.setState({ day: +e.target.value, playing: false })} />
                <output className="day-out">Day {s.day.toFixed(1)}</output>
              </div>
            )}
            <dl className="sensor">
              <div><dt>Dissolved copper</dt><dd>{r.cuGL.toFixed(2)} g/L</dd></div>
              <div><dt>Solution colour <Sim /></dt><dd><i className="swatch" style={{ background: `rgb(${rgb.join(',')})` }} />R {rgb[0]} G {rgb[1]} B {rgb[2]}</dd></div>
            </dl>
          </div>
        </div>

        <div className="lab-results">
          {s.mode === 'process'
            ? <RecoveryChart curve={r.curve} day={s.day} />
            : <ScenarioChart massG={s.massG} cu={s.simple.cu} current={s.simple.eff} />}
          <div className="formula-box" aria-label="Recovery formula">
            <p className="formula-label">Copper recovered = waste mass × copper fraction × recovery efficiency</p>
            <p className="formula-line">
              {s.massG.toLocaleString('en')} g × {r.cuFraction.toFixed(3)} × {r.efficiency.toFixed(3)} = <b>{mass(r.cuG)}</b> <Sim />
            </p>
          </div>
          <dl className="result-list">
            <div><dt>Copper recovered</dt><dd>{mass(r.cuG)}</dd></div>
            <div><dt>Copper efficiency</dt><dd>{pct(r.efficiency, 1)}</dd></div>
            {s.mode === 'process' && r.metals.filter((m) => m.metal !== 'Cu' && m.recoveredG > 0).slice(0, 4).map((m) => (
              <div key={m.metal}><dt>{METALS[m.metal].name}</dt><dd>{mass(m.recoveredG)} <small>({pct(m.fraction)})</small></dd></div>
            ))}
            <div><dt>Value of recovered metal</dt><dd>{money(r.valueUsd)}</dd></div>
          </dl>
          <a className="btn primary" href="#report">See the full report</a>
        </div>
      </div>
    </section>
  );
}

function Meter({ label, v }: { label: string; v: number }) {
  return (
    <div className="meter">
      <dt>{label}</dt>
      <dd><span className="meter-track"><i style={{ transform: `scaleX(${v})` }} /></span>{pct(v)}</dd>
    </div>
  );
}
