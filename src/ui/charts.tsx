import { useState, useRef, type PointerEvent } from 'react';
import { METALS, type Metal } from '../data/science.ts';
import type { Curve } from '../sim/model.ts';
import { mass, pct } from './format.ts';

// ── Recovery over time ───────────────────────────────────────────────────────
// Copper is the story, so it is the one coloured series; every other metal is context in one
// recessive ink with a legend entry. The sterile control is dashed because it *is* a control.
const W = 460, H = 260, M = { l: 40, r: 56, t: 14, b: 30 };

export function RecoveryChart({ curve, day, hero = 'Cu' }: { curve: Curve; day: number; hero?: Metal }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const days = curve.t[curve.t.length - 1] || 1;
  const x = (t: number) => M.l + (t / days) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - v * (H - M.t - M.b);
  const metals = (Object.keys(curve.series) as Metal[]).filter((m) => curve.series[m]!.some((v) => v > 0.005));
  const others = metals.filter((m) => m !== hero);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(curve.t[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const at = (vals: number[], t: number) => vals[Math.round((t / days) * (vals.length - 1))] ?? 0;
  const ticks = niceTicks(days);

  const move = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const t = Math.max(0, Math.min(days, ((px - M.l) / (W - M.l - M.r)) * days));
    setHover(Math.round((t / days) * (curve.t.length - 1)));
  };

  const heroVals = curve.series[hero] ?? [];
  const hi = hover ?? null;
  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span>Metal leached over time</span>
        <button type="button" className="link" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
      </figcaption>
      <div className="legend" aria-hidden>
        <span><i className="key key-hero" />{METALS[hero].name}</span>
        {others.length > 0 && <span><i className="key key-other" />Other metals</span>}
        <span><i className="key key-ctrl" />Sterile control ({hero})</span>
      </div>
      {table ? (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Day</th>{metals.map((m) => <th key={m}>{m}</th>)}<th>Control</th></tr></thead>
            <tbody>
              {Array.from({ length: Math.floor(days) + 1 }, (_, d) => {
                const i = Math.round((d / days) * (curve.t.length - 1));
                return <tr key={d}><td>{d}</td>{metals.map((m) => <td key={m}>{pct(curve.series[m]![i], 1)}</td>)}<td>{pct(curve.control[i], 1)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="plot" role="img"
          aria-label={`${METALS[hero].name} reaches ${pct(at(heroVals, days))} after ${days} days`}
          onPointerMove={move} onPointerLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line className="grid" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
              <text className="tick" x={M.l - 8} y={y(v) + 4} textAnchor="end">{v * 100}%</text>
            </g>
          ))}
          {ticks.map((t) => <text key={t} className="tick" x={x(t)} y={H - 8} textAnchor="middle">{t}</text>)}
          <text className="tick" x={W - M.r} y={H - 8} dx={14}>days</text>
          <path className="ctrl" d={path(curve.control)} />
          {others.map((m) => <path key={m} className="other" d={path(curve.series[m]!)} />)}
          <path className="hero" d={path(heroVals)} />
          {/* Only copper gets a direct label; the others converge, so the legend and tooltip carry them. */}
          <text className="end-label strong" x={W - M.r + 6} y={y(heroVals.at(-1) ?? 0) + 4}>{hero} {pct(heroVals.at(-1) ?? 0)}</text>
          <line className="day" x1={x(day)} x2={x(day)} y1={M.t} y2={H - M.b} />
          <circle className="dot" cx={x(day)} cy={y(at(heroVals, day))} r={4.5} />
          {hi !== null && (
            <g className="crosshair">
              <line x1={x(curve.t[hi])} x2={x(curve.t[hi])} y1={M.t} y2={H - M.b} />
              <circle className="dot" cx={x(curve.t[hi])} cy={y(heroVals[hi])} r={4.5} />
            </g>
          )}
        </svg>
      )}
      {hi !== null && !table && (
        <div className="tooltip" style={{ left: `${(x(curve.t[hi]) / W) * 100}%` }}>
          <div className="tt-title">Day {curve.t[hi].toFixed(1)}</div>
          {[hero, ...others].map((m) => (
            <div key={m} className="tt-row"><i className={m === hero ? 'key key-hero' : 'key key-other'} /><b>{pct(curve.series[m]![hi], 1)}</b><span>{METALS[m].name}</span></div>
          ))}
          <div className="tt-row"><i className="key key-ctrl" /><b>{pct(curve.control[hi], 1)}</b><span>Sterile control</span></div>
        </div>
      )}
    </figure>
  );
}

function niceTicks(max: number) {
  const step = max <= 10 ? 2 : max <= 20 ? 5 : 10;
  const out: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) out.push(t);
  return out;
}

// ── Efficiency scenarios (the proposal's 20 / 40 / 60 / 80 % comparison) ────────
export function ScenarioChart({ massG, cu, current }: { massG: number; cu: number; current: number }) {
  const effs = [...new Set([0.2, 0.4, 0.6, 0.8, +current.toFixed(3)])].sort((a, b) => a - b);
  const max = massG * cu * 0.8 > massG * cu * current ? massG * cu * 0.8 : massG * cu * current;
  const [hover, setHover] = useState<number | null>(null);
  const w = 420, h = 220, b = 34, t = 26, bw = 24, slot = (w - 20) / effs.length;
  return (
    <figure className="chart">
      <figcaption className="chart-head"><span>Copper recovered at different efficiencies</span></figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="plot" role="img" aria-label="Copper recovered at 20, 40, 60 and 80 % efficiency">
        <line className="axis" x1={10} x2={w - 10} y1={h - b} y2={h - b} />
        {effs.map((e, i) => {
          const g = massG * cu * e;
          const bh = (g / max) * (h - b - t);
          const cx = 10 + slot * (i + 0.5);
          const isCur = Math.abs(e - current) < 0.0005;
          return (
            <g key={e} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} tabIndex={0}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="bar-hit">
              <rect x={cx - slot / 2} y={t} width={slot} height={h - b - t} fill="transparent" />
              <path className={isCur ? 'bar hero' : 'bar'} d={roundTop(cx - bw / 2, h - b - bh, bw, bh)} opacity={hover !== null && hover !== i ? 0.6 : 1} />
              <text className={isCur ? 'cap strong' : 'cap'} x={cx} y={h - b - bh - 8} textAnchor="middle">{mass(g)}</text>
              <text className="tick" x={cx} y={h - 12} textAnchor="middle">{isCur ? `${pct(e, e * 100 % 1 ? 1 : 0)} (yours)` : pct(e)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Bar path with a 4 px rounded data-end and a square baseline. */
function roundTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
