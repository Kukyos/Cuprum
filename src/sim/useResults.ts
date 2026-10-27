import { useMemo } from 'react';
import { useStore } from '../store.ts';
import { PRESETS, CONTEXT, type Metal } from '../data/science.ts';
import { curve, factors, leachedAt, organism, recoverAll, simpleRecovery, solutionRGB } from './model.ts';

type Inputs = Pick<ReturnType<typeof useStore.getState>, 'presetId' | 'massG' | 'mode' | 'simple' | 'process' | 'day' | 'prices'>;

let last: { key: unknown[]; out: ReturnType<typeof compute> } | null = null;
/** Pure results for a store snapshot; cached on its inputs so the 3D scene can call it every frame. */
export function computeResults(st: Inputs) {
  const key = [st.presetId, st.massG, st.mode, st.simple, st.process, st.day, st.prices];
  if (last && key.every((k, i) => k === last!.key[i])) return last.out;
  last = { key, out: compute(st) };
  return last.out;
}

export function useResults() {
  const { presetId, massG, mode, simple, process, day, prices } = useStore();
  return useMemo(() => computeResults({ presetId, massG, mode, simple, process, day, prices }), [presetId, massG, mode, simple, process, day, prices]);
}

function compute({ presetId, massG, mode, simple, process, day, prices }: Inputs) {
  {
    const preset = PRESETS[presetId];
    const o = organism(process.organismId);
    const f = factors(process);
    const cv = curve(process);
    const atDay = leachedAt(process, day, f);
    const atEnd = leachedAt(process, process.days, f);
    // Simple mode is the proposal's formula: copper only, user-set content and efficiency.
    const cuFraction = mode === 'simple' ? simple.cu : (preset.comp.Cu ?? 0);
    const efficiency = mode === 'simple' ? simple.eff : (atEnd.out.Cu ?? 0);
    const cuG = simpleRecovery(massG, cuFraction, efficiency);
    const comp = mode === 'simple' ? { ...preset.comp, Cu: simple.cu } : preset.comp;
    const fractions: Partial<Record<Metal, number>> = mode === 'simple' ? { Cu: simple.eff } : atEnd.out;
    const metals = recoverAll(massG, comp, fractions, prices);
    const valueUsd = metals.reduce((s, m) => s + m.valueUsd, 0);
    const contentValueUsd = metals.reduce((s, m) => s + (m.contentG / 1000) * prices[m.metal], 0);
    // Reactor chemistry at the playback day (pulp density sets the liquid volume). Simple mode has
    // no time axis, so the reactor shows its end state.
    const progress = mode === 'simple' ? 1 : day / process.days;
    const cuGL = mode === 'simple' ? process.pd * simple.cu * simple.eff : process.pd * (preset.comp.Cu ?? 0) * (atDay.out.Cu ?? 0);
    const fe3GL = (o.substrate.formula === 'Fe²⁺' ? process.sub : 0) * f.activity * Math.min(1, (progress * process.days) / Math.max(0.5, f.lag + 1.5))
      + process.pd * (preset.comp.Fe ?? 0) * 0.5 * progress;
    const rgb = solutionRGB(o, cuGL, fe3GL, progress);
    return {
      preset, o, f, curve: cv, atDay, atEnd, cuFraction, efficiency, cuG, metals, valueUsd, contentValueUsd,
      cuGL, fe3GL, rgb, progress, volumeL: massG / process.pd,
      oreAvoidedKg: cuG / 1000 / CONTEXT.oreGradeCu,
      co2AvoidedKg: (cuG / 1000) * CONTEXT.co2PerKgCu,
    };
  }
}

export type Results = ReturnType<typeof compute>;
