// The board disintegrates into milled powder that falls into the reactor and swirls in the culture.
// Each particle takes its colour from the board texture at its own spot, so the cloud starts out
// looking exactly like the board. Copper-coloured grains dull as the copper dissolves.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BD, BW } from './boardLayout.ts';
import { rig, smooth } from './rig.ts';
import { BOTTOM, R } from './Reactor.tsx';
import { useStore } from '../store.ts';
import { computeResults } from '../sim/useResults.ts';

export function Powder({ count, colorCanvas }: { count: number; colorCanvas: HTMLCanvasElement | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => {
    const g = colorCanvas?.getContext('2d');
    const img = g?.getImageData(0, 0, colorCanvas!.width, colorCanvas!.height);
    const copperish = new THREE.Color('#c8773a');
    return Array.from({ length: count }, (_, i) => {
      const lx = (Math.random() - 0.5) * BW, lz = (Math.random() - 0.5) * BD;
      let col = new THREE.Color('#0d3a28');
      if (img) {
        const px = Math.floor(((lx + BW / 2) / BW) * (img.width - 1)), pz = Math.floor(((lz + BD / 2) / BD) * (img.height - 1));
        const k = (pz * img.width + px) * 4;
        col = new THREE.Color().setRGB(img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255, THREE.SRGBColorSpace);
      }
      const isCu = i % 5 === 0; // ≈ 20 % of the grains are copper, like the board
      if (isCu) col = copperish.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      return {
        local: new THREE.Vector3(lx, 0.03 + Math.random() * 0.02, lz),
        delay: Math.random() * 0.45,
        r: Math.sqrt(Math.random()) * (R - 0.12), a: Math.random() * Math.PI * 2,
        h: Math.pow(Math.random(), 1.6), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()),
        col, isCu, w: 0.4 + Math.random() * 0.7,
      };
    });
  }, [count, colorCanvas]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), a: new THREE.Vector3(), b: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), dull: new THREE.Color('#4a4d48') }), []);
  const painted = useRef(-1);

  useFrame((state) => {
    const s = rig.shred;
    mesh.current.visible = s > 0.001;
    if (!mesh.current.visible) return;
    const t = state.clock.elapsedTime;
    const st = useStore.getState();
    const leached = st.mode === 'simple' ? st.simple.eff : (computeResults(st).atDay.out.Cu ?? 0);
    rig.board.updateMatrixWorld();
    rig.reactor.updateMatrixWorld();
    const settle = smooth(0.85, 1, s);
    data.forEach((d, i) => {
      const u = smooth(d.delay, d.delay + 0.55, s);
      tmp.a.copy(d.local).applyMatrix4(rig.board.matrixWorld);
      // Inside the reactor: suspended by the impeller, swirling with the flow.
      const ang = d.a + t * d.w * (0.5 / (d.r + 0.3)) * settle;
      tmp.b.set(Math.cos(ang) * d.r, BOTTOM + 0.06 + d.h * 0.9 * settle + Math.sin(t + i) * 0.02 * settle, Math.sin(ang) * d.r).applyMatrix4(rig.reactor.matrixWorld);
      tmp.a.lerp(tmp.b, u);
      tmp.a.y += Math.sin(u * Math.PI) * 0.9; // arc up, then drop in
      tmp.e.set(d.spin.x * u * 9 + t * 0.3 * settle, d.spin.y * u * 9, d.spin.z * u * 9);
      const size = 0.034 * (1 - u * 0.55) * (rig.reactor.scale.x || 1);
      mesh.current.setMatrixAt(i, tmp.m.compose(tmp.a, tmp.q.setFromEuler(tmp.e), tmp.s.setScalar(size)));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    const key = Math.round(leached * 50);
    if (key !== painted.current) {
      painted.current = key;
      data.forEach((d, i) => mesh.current.setColorAt(i, d.isCu ? tmp.c.copy(d.col).lerp(tmp.dull, leached * 0.9) : d.col));
      mesh.current.instanceColor!.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 0.5, 1]} />
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}
