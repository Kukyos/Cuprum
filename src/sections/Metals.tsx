import { useState } from 'react';
import { classById, streamName, useStore } from '../store.ts';
import { METALS, PRESETS, ROUTES, WHERE_ON_BOARD, type Metal } from '../data/science.ts';
import { mass, pct, share, useMoney } from '../ui/format.ts';
import { Segmented } from '../ui/controls.tsx';
import { FeedNotice } from '../ui/FeedNotice.tsx';

const BOARD_PRESETS = new Set(['pc_board', 'phone_board', 'tv_board']);

export function Metals() {
  const detection = useStore((s) => s.detection);
  const presetId = useStore((s) => s.presetId);
  const massG = useStore((s) => s.massG);
  const prices = useStore((s) => s.prices);
  const set = useStore((s) => s.set);
  const money = useMoney();
  const [by, setBy] = useState<'mass' | 'value'>('mass');
  const preset = PRESETS[presetId];

  const rows = (Object.entries(preset.comp) as [Metal, number][]).map(([m, w]) => ({
    m, w, g: massG * w, usd: ((massG * w) / 1000) * prices[m],
  }));
  const totalUsd = rows.reduce((s, r) => s + r.usd, 0);
  const key = by === 'mass' ? 'g' : 'usd';
  rows.sort((a, b) => b[key] - a[key]);
  const max = rows[0]?.[key] || 1;
  const topMass = [...rows].sort((a, b) => b.g - a.g)[0];
  const topValue = [...rows].sort((a, b) => b.usd - a.usd)[0];
  const route = detection ? ROUTES[detection.stream] : null;
  const sliceG = (massG * Object.values(preset.comp).reduce((a, b) => a + b, 0));

  return (
    <section id="metals" className="metals">
      <div className="metals-sticky">
        <div className="metals-panel">
          <header className="section-head">
            <p className="step">Step 2 of 4</p>
            <h2>What’s inside</h2>
          </header>

          <div className="specimen">
            {detection && detection.stream !== 'none'
              ? <img src={detection.snapshot} alt="Scanned item" />
              : <span className="specimen-blank" aria-hidden>Cu</span>}
            <div>
              <p className="specimen-title">
                {detection && detection.stream !== 'none' ? classById[detection.classId].name : 'No scan yet'}
              </p>
              <p className="specimen-sub">
                {detection && detection.stream !== 'none'
                  ? <>Predicted {streamName[detection.stream].toLowerCase()}, {pct(detection.score)} match. {route?.boardPreset && detection.stream !== 'pcb' ? 'Showing the board inside.' : ''}</>
                  : 'Showing typical PC board scrap. Scan something to change it.'}
              </p>
            </div>
          </div>

          <div className="feed-controls">
            <label className="field">
              <span>Composition</span>
              <select value={presetId} onChange={(e) => set({ presetId: e.target.value, simple: { ...useStore.getState().simple, cu: PRESETS[e.target.value].comp.Cu ?? 0 } })}>
                {Object.values(PRESETS).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="field field-num">
              <span>Sample mass</span>
              <span className="num-input">
                <input type="number" min={1} max={1000000} step={50} value={massG}
                  onChange={(e) => set({ massG: Math.max(1, +e.target.value || 1) })} />
                <span>g</span>
              </span>
            </label>
          </div>

          <div className="comp-head">
            <Segmented label="Rank metals by" value={by} onChange={setBy}
              options={[{ value: 'mass', label: 'By mass' }, { value: 'value', label: 'By value' }]} />
            <p className="comp-total">{by === 'mass' ? `${mass(sliceG)} of metal` : `${money(totalUsd)} of metal`} in {mass(massG)}</p>
          </div>

          <ol className="comp">
            {rows.map((r) => (
              <li key={r.m} tabIndex={0}>
                <span className="tile"><small>{METALS[r.m].z}</small>{r.m}</span>
                <span className="comp-name">
                  {METALS[r.m].name}
                  {BOARD_PRESETS.has(presetId) && WHERE_ON_BOARD[r.m] && <small>{WHERE_ON_BOARD[r.m]}</small>}
                </span>
                <span className="comp-bar"><i style={{ transform: `scaleX(${Math.max(0.004, r[key] / max)})` }} /></span>
                <span className="comp-val">{by === 'mass' ? mass(r.g) : money(r.usd)}<small>{by === 'mass' ? share(r.w) : pct(r.usd / (totalUsd || 1))}</small></span>
              </li>
            ))}
          </ol>

          {topMass && topValue && topMass.m !== topValue.m && (
            <p className="insight">
              By mass this is mostly {METALS[topMass.m].name.toLowerCase()}. By value, {METALS[topValue.m].name.toLowerCase()} is {pct(topValue.usd / (totalUsd || 1))} of it.
            </p>
          )}
          <FeedNotice where="metals" />
          <p className="fineprint">
            Typical published composition for this kind of item, not a measurement of yours.{preset.est ? ' Estimated values. ' : ' '}
            Source: {preset.source}. {preset.other}.
          </p>
        </div>
      </div>
    </section>
  );
}
