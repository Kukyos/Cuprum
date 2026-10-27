// Run: npm run check  (node strips the types). Fails loudly if the science logic breaks.
import assert from 'node:assert/strict';
import { simpleRecovery, ctmi, cpm, curve, factors, leachedAt, litInput, recoverAll, type ProcessInput } from './model.ts';
import { ORGANISMS, PRESETS } from '../data/science.ts';

// The proposal's worked example: 1,000 g × 0.15 × 0.60 = 90 g.
assert.equal(+simpleRecovery(1000, 0.15, 0.6).toFixed(6), 90);

// Cardinal models hit 1 at the optimum, 0 at and beyond the limits.
for (const o of ORGANISMS) {
  assert.ok(Math.abs(ctmi(o.T[1], o.T) - 1) < 1e-9, `${o.id} CTMI(Topt)=1`);
  assert.ok(Math.abs(cpm(o.pH[1], o.pH) - 1) < 1e-9, `${o.id} CPM(pHopt)=1`);
  assert.equal(ctmi(o.T[2] + 1, o.T), 0);
  assert.equal(cpm(o.pH[0], o.pH), 0);
}

// Anchoring: at each organism's literature conditions the model reproduces the reported extent exactly.
for (const o of ORGANISMS) {
  const inp = litInput(o);
  const { out } = leachedAt(inp, inp.days);
  for (const [m, rep] of Object.entries(o.extent)) {
    const got = out[m as keyof typeof out]!;
    assert.ok(Math.abs(got - Math.min(0.99, rep!)) < 1e-9, `${o.id} ${m}: model ${got.toFixed(3)} vs reported ${rep}`);
  }
}
const lit = (id: string) => litInput(ORGANISMS.find((x) => x.id === id)!);
const cuAt = (inp: ProcessInput) => leachedAt(inp, inp.days).out.Cu!;
assert.ok(Math.abs(leachedAt(lit('cv'), 8).out.Au! - 0.736) < 1e-9); // Kumar et al. 2021: 73.6 % Au

// Monotonic in time; pulp density inhibits; too hot kills growth and falls back to the sterile control.
const c = curve(lit('af'));
for (let i = 1; i < c.t.length; i++) assert.ok(c.series.Cu![i] >= c.series.Cu![i - 1] - 1e-12);
assert.ok(cuAt({ ...lit('af'), pd: 100 }) < cuAt(lit('af')));
const hot = { ...lit('af'), T: 60 };
assert.equal(factors(hot).growing, false);
assert.ok(Math.abs(cuAt(hot) - leachedAt(hot, hot.days).ctrl.Cu!) < 1e-12);

// Recovered mass and value add up.
const r = recoverAll(1000, PRESETS.pc_board.comp, { Cu: 0.6 });
assert.equal(+r.find((x) => x.metal === 'Cu')!.recoveredG.toFixed(6), 120);

console.log('model checks passed');
