import { ORGANISMS, REFERENCES } from '../data/science.ts';
import embeds from '../ai/embeds.json';
import labels from '../ai/labels.json';
import samples from '../data/samples.json';

const ewasteClasses = labels.classes.filter((c) => !c.neg).length;
const negClasses = labels.classes.length - ewasteClasses;
const prompts = labels.classes.reduce((n, c) => n + c.phrases.length * (c.neg ? labels.negTemplates : labels.templates).length, 0);

export function Science() {
  const { gpu, cpu } = embeds.models;
  return (
    <section id="science" className="science">
      <header className="section-head">
        <h2>How it works</h2>
        <p className="section-lede">The chemistry, the AI and the model behind every number on this page, plus where each one comes from.</p>
      </header>

      <div className="sci-block">
        <h3>The iron cycle that dissolves copper</h3>
        <div className="sci-cols">
          <IronCycle />
          <div className="equations">
            <p><span className="eq">4Fe²⁺ + O₂ + 4H⁺ → 4Fe³⁺ + 2H₂O</span>Iron-oxidising microbes such as <i>A. ferrooxidans</i> get their energy from this step.</p>
            <p><span className="eq">Cu⁰ + 2Fe³⁺ → Cu²⁺ + 2Fe²⁺</span>Ferric iron oxidises metallic copper into solution. The ferrous iron goes back to the microbes, so a little iron dissolves a lot of copper.</p>
            <p><span className="eq">2S⁰ + 3O₂ + 2H₂O → 2H₂SO₄</span>Sulfur oxidisers (<i>A. thiooxidans</i>) make the acid that keeps the pH low (acidolysis).</p>
            <p><span className="eq">4Au + 8CN⁻ + O₂ + 2H₂O → 4Au(CN)₂⁻ + 4OH⁻</span>Gold needs a different route: cyanide made by <i>C. violaceum</i> at alkaline pH.</p>
            <p>Fungi like <i>A. niger</i> work differently again: their citric, oxalic and gluconic acids pull metals into solution at mild pH (complexolysis).</p>
          </div>
        </div>
      </div>

      <div className="sci-block">
        <h3>How the scanner recognises things</h3>
        <div className="sci-cols">
          <ol className="steps-list">
            <li><b>A model that matches pictures to words.</b> MobileCLIP (Apple, CVPR 2024) learned from millions of captioned images to place a photo and its description close together in the same 512-number space. With a GPU the page runs {gpu.name}; without one it falls back to the lighter {cpu.name}.</li>
            <li><b>Categories written as sentences.</b> Each of {ewasteClasses} e-waste categories is described several ways (“a green printed circuit board”, “a game controller”). {negClasses} more describe things that aren’t e-waste (faces, hands, rooms, mugs), so the scanner can say no.</li>
            <li><b>People are ignored.</b> Faces, hands and bodies still compete for each frame, so they soak up the person holding the item, then drop out of the scores. Only a frame that is almost entirely person ({Math.round(embeds.personCutoff * 100)} % or more) reads as “just a person”.</li>
            <li><b>Text work done in advance.</b> Those {prompts} sentences were turned into vectors once, before the site shipped. Your browser only runs the image half of the model.</li>
            <li><b>One comparison per frame.</b> The aiming box is cropped to 256 × 256 pixels, turned into a vector, and compared with every category. Scores are smoothed across frames, and the scanner locks after 4 steady frames above 55 %. Images never leave your device.</li>
          </ol>
          <div className="eval">
            <p className="eval-num">{gpu.eval.held.acc}</p>
            <p>of {gpu.eval.held.n} test scenes of an item held up in front of a face, selfie, open hand or desk, sorted into the right category.</p>
            <p className="eval-num">{gpu.eval.clean.acc}</p>
            <p>of {gpu.eval.clean.n} labelled photos, and {gpu.eval.degraded.acc} of {gpu.eval.degraded.n} copies degraded to look like a webcam (dim, blurred, compressed, tilted).</p>
            <p className="fineprint">Figures for {gpu.name}; the CPU fallback {cpu.name} scores {cpu.eval.held.acc}, {cpu.eval.clean.acc} and {cpu.eval.degraded.acc}. Test photos are CC-licensed Wikimedia Commons images. The model is zero-shot (never trained on e-waste), and it can’t see inside an object, so metal content always comes from published averages for that kind of item.</p>
          </div>
        </div>
      </div>

      <div className="sci-block">
        <h3>How the process model works</h3>
        <div className="sci-cols">
          <div className="model-eqs">
            <p className="eq big">X(t) = E · (1 − e<sup>−k(t − λ)</sup>)</p>
            <p>The share of a metal dissolved by day <i>t</i> follows first-order kinetics after a lag phase λ, the usual shape of bioleaching curves.</p>
            <p className="eq">k = k<sub>max</sub> · a · √S · f<sub>size</sub>, a = CTMI(T) · CPM(pH)</p>
            <p>The rate depends on microbial activity <i>a</i>, from Rosso’s cardinal temperature and pH models (0 outside the growth range, 1 at the optimum), plus substrate supply and particle surface area.</p>
            <p className="eq">E = E<sub>lit</sub> · f<sub>pulp</sub> · f<sub>liberation</sub></p>
            <p>The final extent comes from a published study and is scaled for pulp-density toxicity and for metal still locked inside coarse particles. The model is anchored so that at each study’s own conditions it reproduces that study’s number exactly.</p>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Organism</th><th>Type</th><th>Optimum</th><th>Best at</th></tr></thead>
              <tbody>
                {ORGANISMS.map((o) => (
                  <tr key={o.id}>
                    <td><i>{o.name}</i></td><td>{o.kind}</td><td>{o.T[1]} °C, pH {o.pH[1]}</td>
                    <td>{Object.entries(o.extent).sort((a, b) => b[1]! - a[1]!).slice(0, 3).map(([m, v]) => `${m} ${Math.round(v! * 100)} %`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="sci-block">
        <h3>References</h3>
        <ol className="refs">
          {REFERENCES.map((r) => <li key={r.key}>{r.text} <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace('https://', '')}</a></li>)}
        </ol>
      </div>

      <footer className="footer">
        <p><i>Cuprum</i> is an educational simulator for an Environmental Biotechnology project. Every output is an estimate, not proof that any metal was recovered.</p>
        <details>
          <summary>Sample photo credits</summary>
          <ul className="credits">
            {Object.entries(samples).map(([slug, c]) => (
              <li key={slug}><a href={c.page} target="_blank" rel="noreferrer">{c.title.replace('File:', '')}</a>, {c.author || 'unknown author'}, {c.license}</li>
            ))}
          </ul>
        </details>
      </footer>
    </section>
  );
}

/** Fe²⁺ ⇄ Fe³⁺ loop: microbes push iron up to Fe³⁺, copper pulls it back down and dissolves. */
function IronCycle() {
  return (
    <svg viewBox="0 0 520 300" className="cycle" role="img" aria-label="Diagram: microbes oxidise ferrous to ferric iron; ferric iron oxidises copper metal to copper ions and returns to ferrous iron.">
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="strokeWidth" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#aaa49a" />
        </marker>
      </defs>
      <path d="M160,110 C200,40 320,40 358,108" className="cyc-arc" markerEnd="url(#ah)" />
      <path d="M360,190 C320,262 200,262 162,192" className="cyc-arc" markerEnd="url(#ah)" />
      <circle cx="120" cy="150" r="46" className="ion fe2" /><text x="120" y="157" className="ion-t">Fe²⁺</text>
      <circle cx="400" cy="150" r="46" className="ion fe3" /><text x="400" y="157" className="ion-t">Fe³⁺</text>
      <g transform="translate(260 64)">
        <rect x="-26" y="-9" width="52" height="18" rx="9" className="microbe" />
        <text y="-22" className="cyc-label">microbes + O₂</text>
      </g>
      <text x="260" y="122" className="cyc-small">oxidise</text>
      <g transform="translate(260 236)">
        <rect x="-20" y="-20" width="40" height="40" rx="3" className="cu0" />
        <text y="5" className="ion-t dark">Cu</text>
      </g>
      <text x="260" y="188" className="cyc-small">reduced by copper</text>
      <path d="M290,236 H420" className="cyc-out" markerEnd="url(#ah)" />
      <circle cx="452" cy="236" r="26" className="ion cu2" /><text x="452" y="242" className="ion-t dark">Cu²⁺</text>
      <text x="355" y="258" className="cyc-small">dissolves</text>
    </svg>
  );
}
