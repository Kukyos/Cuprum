import * as THREE from 'three';

/** Values the director computes each frame and every 3D piece reads. Mutated in place, never via React. */
export const rig = {
  explode: 0, // board layers apart (metals section)
  shred: 0, // board → powder → reactor
  reactorIn: 0, // reactor rising into view
  tags: 0, // metal labels opacity
  glow: 1, // copper trace pulse brightness
  board: new THREE.Group(), // set by <Board>
  reactor: new THREE.Group(), // set by <Reactor>
};

export const uniforms = { uTime: { value: 0 }, uGlow: { value: 1 } };

/**
 * Adds flowing pulses along copper traces. The flow texture stores distance along each trace (R),
 * a per-trace offset (G) and the trace mask (B). `cutout` discards everything that isn't copper.
 */
export function withPulse(mat: THREE.MeshStandardMaterial, flow: THREE.Texture, cutout: boolean) {
  mat.emissive.set(0x000000);
  mat.emissiveMap = flow; // only so three provides vEmissiveMapUv; emissive is black, so it adds nothing itself
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uGlow = uniforms.uGlow;
    sh.uniforms.uFlow = { value: flow };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGlow; uniform sampler2D uFlow;')
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        vec4 fl = texture2D(uFlow, vEmissiveMapUv);
        ${cutout ? 'if (fl.b < 0.5) discard;' : ''}`)
      .replace('#include <emissivemap_fragment>', `
        float ph = fract(fl.r * 2.0 + fl.g * 9.0 - uTime * 0.32);
        float pulse = smoothstep(0.0, 0.025, ph) * (1.0 - smoothstep(0.025, 0.2, ph));
        totalEmissiveRadiance += vec3(1.0, 0.42, 0.16) * pulse * step(0.5, fl.b) * uGlow;`);
  };
  mat.customProgramCacheKey = () => `pulse-${cutout}`;
  return mat;
}

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
