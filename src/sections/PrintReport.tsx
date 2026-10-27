// Only visible when printing ("Download PDF report" opens the browser's Save as PDF dialog).
import { classById, streamName, useStore } from '../store.ts';
import { METALS, PRESETS, PRICE_DATE, REFERENCES, ROUTES } from '../data/science.ts';
import { useResults } from '../sim/useResults.ts';
import { RecoveryChart, ScenarioChart } from '../ui/charts.tsx';
import { mass, pct, share, useMoney } from '../ui/format.ts';
import { LIMITATIONS } from './Report.tsx';

export function PrintReport() {
  const s = useStore();
  const r = useResults();
  const money = useMoney();
  const d = s.detection;
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  return (
    <article className="print-report" aria-hidden>
      <header>
        <h1><i>Cuprum</i> recovery report</h1>
        <p>{now}. All results are simulated estimates for educational use, not measurements.</p>
      </header>

      <section className="pr-row">
        <div>
          <h2>1. Item and AI prediction</h2>
          {d ? (
            <div className="pr-specimen">
              <img src={d.snapshot} alt="" />
              <div>
                <p><b>{streamName[d.stream]}</b>, most like “{classById[d.classId].name}”</p>
                <p>Match score {pct(d.score)} ({s.ai.model || 'MobileCLIP'}, zero-shot, on-device). A prediction, not a guaranteed identification.</p>
                <p>Other candidates: {d.top.slice(1, 4).map((t) => `${classById[t.id].name} ${pct(t.p)}`).join('; ')}</p>
                <p>Recommended route: {ROUTES[d.stream]?.headline}</p>
              </div>
            </div>
          ) : <p>No item was scanned; a typical feed composition was used.</p>}
        </div>
      </section>

      <section>
        <h2>2. Input assumptions</h2>
        <table className="data">
          <tbody>
            <tr><th>Feed</th><td>{r.preset.name} ({mass(s.massG)})</td></tr>
            <tr><th>Copper content</th><td>{pct(r.cuFraction, 1)} by mass</td></tr>
            {s.mode === 'simple'
              ? <tr><th>Recovery efficiency</th><td>{pct(s.simple.eff)} (assumed)</td></tr>
              : <>
                  <tr><th>Organism</th><td>{r.o.name} ({r.o.kind})</td></tr>
                  <tr><th>Conditions</th><td>{s.process.T} °C, pH {s.process.pH}, {s.process.pd} g/L pulp, {s.process.sizeUm} µm particles, {s.process.sub} g/L {r.o.substrate.formula}, {s.process.days} days, {s.process.twoStep ? 'two-step' : 'one-step'}</td></tr>
                  <tr><th>Derived copper efficiency</th><td>{pct(r.efficiency, 1)}</td></tr>
                </>}
            <tr><th>Composition source</th><td>{r.preset.source}</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Estimated recovery</h2>
        <p className="pr-formula">{s.massG.toLocaleString('en')} g × {r.cuFraction.toFixed(3)} × {r.efficiency.toFixed(3)} = <b>{mass(r.cuG)} copper</b></p>
        <table className="data">
          <thead><tr><th>Metal</th><th>Content</th><th>In sample</th><th>Leached</th><th>Recovered</th><th>Value</th></tr></thead>
          <tbody>
            {r.metals.map((m) => (
              <tr key={m.metal}><td>{METALS[m.metal].name}</td><td>{share(m.contentG / s.massG)}</td><td>{mass(m.contentG)}</td><td>{pct(m.fraction, 1)}</td><td>{mass(m.recoveredG)}</td><td>{money(m.valueUsd)}</td></tr>
            ))}
            <tr className="total"><td>Total</td><td /><td /><td /><td /><td>{money(r.valueUsd)}</td></tr>
          </tbody>
        </table>
        <p>Prices: snapshot of {PRICE_DATE}. Ore avoided ≈ {mass(r.oreAvoidedKg * 1000)}; CO₂ avoided ≈ {mass(r.co2AvoidedKg * 1000)}.</p>
      </section>

      <section className="pr-charts">
        <ScenarioChart massG={s.massG} cu={r.cuFraction} current={r.efficiency} />
        {s.mode === 'process' && <RecoveryChart curve={r.curve} day={s.process.days} />}
      </section>

      {s.scenarios.length > 0 && (
        <section>
          <h2>4. Saved runs</h2>
          <table className="data">
            <thead><tr><th>Run</th><th>Feed</th><th>Mass</th><th>Method</th><th>Cu efficiency</th><th>Cu recovered</th><th>Value</th></tr></thead>
            <tbody>{s.scenarios.map((x) => <tr key={x.id}><td>{x.label}</td><td>{PRESETS[x.presetId].name}</td><td>{mass(x.massG)}</td><td>{x.mode === 'simple' ? 'Simple formula' : x.organism}</td><td>{pct(x.efficiency, 1)}</td><td>{mass(x.cuG)}</td><td>{money(x.valueUsd)}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <section>
        <h2>Limitations and precautions</h2>
        <ul>{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      <section className="pr-refs">
        <h2>References</h2>
        <ol>{REFERENCES.map((x) => <li key={x.key}>{x.text}</li>)}</ol>
      </section>
    </article>
  );
}
