import { useStore } from '../store.ts';
import { METALS, PRESETS, PRICE_DATE, type Metal } from '../data/science.ts';
import { useResults } from '../sim/useResults.ts';
import { ScenarioChart } from '../ui/charts.tsx';
import { Segmented, Sim } from '../ui/controls.tsx';
import { mass, pct, useMoney } from '../ui/format.ts';

export const LIMITATIONS = [
  'The image model can be wrong, especially when a photo is unclear, unusual, or shows something outside its 32 categories.',
  'Copper content and recovery efficiency are assumptions taken from published averages, not measurements of your item.',
  'This simulates potential recovery. No bioleaching actually takes place.',
  'The process model is semi-empirical: it reproduces each cited study at that study’s conditions and extrapolates elsewhere. Adapted cultures can tolerate far more pulp than it assumes.',
  `Prices are a snapshot from ${PRICE_DATE}. Leached metal still has to be refined (for example by electrowinning) before anyone pays for it.`,
  'Real e-waste contains hazardous materials. Do not dismantle batteries or circuit boards, or attempt chemical extraction, without supervision, proper facilities and safety procedures.',
];

export function Report() {
  const s = useStore();
  const r = useResults();
  const money = useMoney();
  const method = s.mode === 'simple' ? 'simple formula' : `${r.o.short}, ${s.process.days} days`;

  const save = () => s.set({
    scenarios: [...s.scenarios, {
      id: Date.now(), label: `Run ${s.scenarios.length + 1}`, presetId: s.presetId, massG: s.massG, mode: s.mode,
      efficiency: r.efficiency, organism: s.mode === 'process' ? r.o.short : undefined, cuG: r.cuG, valueUsd: r.valueUsd,
    }],
  });

  return (
    <section id="report" className="report">
      <header className="section-head">
        <p className="step">Step 4 of 4</p>
        <h2>Recovery report</h2>
      </header>

      <div className="report-grid">
        <div className="report-main">
          <p className="figure-label">Copper recovered <Sim /></p>
          <p className="figure">{mass(r.cuG)}</p>
          <p className="figure-sub">
            From {mass(s.massG)} of {r.preset.name.replace(/^Whole /, "whole ")} at {pct(r.cuFraction, 1)} copper, with {pct(r.efficiency, 1)} recovery efficiency ({method}).
          </p>
          <dl className="facts">
            <div><dt>Value of all recovered metal</dt><dd>{money(r.valueUsd)}</dd></div>
            <div><dt>Metal value locked in the sample</dt><dd>{money(r.contentValueUsd)}</dd></div>
            <div><dt>Copper ore that didn’t need mining</dt><dd>{mass(r.oreAvoidedKg * 1000)}</dd></div>
            <div><dt>CO₂ avoided compared with mined copper</dt><dd>{mass(r.co2AvoidedKg * 1000)}</dd></div>
          </dl>
          <p className="fineprint">Ore assumes a 0.6 % copper grade. CO₂ uses about 4.1 kg CO₂e per kg of primary copper cathode and ignores the bioreactor’s own footprint.</p>
          <div className="report-actions">
            <button type="button" className="btn primary" onClick={() => window.print()}>Download PDF report</button>
            <button type="button" className="btn" onClick={save}>Save run for comparison</button>
          </div>
          <p className="fineprint">The PDF opens in your browser’s print dialog: choose “Save as PDF”.</p>
        </div>
        <ScenarioChart massG={s.massG} cu={r.cuFraction} current={r.efficiency} />
      </div>

      {s.scenarios.length > 0 && (
        <div className="table-wrap">
          <table className="data scenarios">
            <caption>Saved runs</caption>
            <thead><tr><th>Run</th><th>Feed</th><th>Mass</th><th>Method</th><th>Cu efficiency</th><th>Cu recovered</th><th>Value</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {s.scenarios.map((x) => (
                <tr key={x.id}>
                  <td>{x.label}</td><td>{PRESETS[x.presetId].name}</td><td>{mass(x.massG)}</td>
                  <td>{x.mode === 'simple' ? 'Simple formula' : x.organism}</td><td>{pct(x.efficiency, 1)}</td>
                  <td>{mass(x.cuG)}</td><td>{money(x.valueUsd)}</td>
                  <td><button type="button" className="link" onClick={() => s.set({ scenarios: s.scenarios.filter((y) => y.id !== x.id) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="prices">
        <summary>Metal prices and currency</summary>
        <div className="prices-body">
          <div className="prices-top">
            <Segmented label="Currency" value={s.currency} onChange={(currency) => s.set({ currency })}
              options={[{ value: 'USD', label: 'US$' }, { value: 'INR', label: '₹ INR' }]} />
            <label className="field field-num"><span>₹ per US$</span>
              <span className="num-input"><input type="number" step={0.5} value={s.fx} onChange={(e) => s.set({ fx: +e.target.value || 1 })} /></span>
            </label>
          </div>
          <p className="fineprint">US$ per kg, snapshot of {PRICE_DATE} (LME settlement for base metals, spot for precious metals). Edit any value.</p>
          <div className="price-grid">
            {(Object.keys(s.prices) as Metal[]).filter((m) => m !== 'Hg').map((m) => (
              <label key={m} className="field field-num">
                <span>{METALS[m].name}</span>
                <span className="num-input"><input type="number" min={0} step="any" value={+s.prices[m].toFixed(2)}
                  onChange={(e) => s.set({ prices: { ...s.prices, [m]: Math.max(0, +e.target.value) } })} /></span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <div className="limits">
        <h3>Read these numbers carefully</h3>
        <ul>{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
    </section>
  );
}
