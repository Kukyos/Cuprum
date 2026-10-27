import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Board } from './Board.tsx';
import { Reactor } from './Reactor.tsx';
import { Powder } from './Powder.tsx';
import { boardTextures } from './boardLayout.ts';
import { rig, smooth, uniforms } from './rig.ts';
import { live, useStore } from '../store.ts';

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4);

export function Stage() {
  const active = useStore((s) => s.stageActive);
  const [slow, setSlow] = useState(lite); // drops resolution and MSAA if the GPU can't keep up
  return (
    <div className="stage" aria-hidden>
      <Canvas
        frameloop={active ? 'always' : 'never'}
        dpr={slow ? 1 : [1, 1.75]}
        gl={{ antialias: !lite, powerPreference: 'high-performance', alpha: false }}
        camera={{ position: [0, 0.35, 8], fov: 32, near: 0.1, far: 40 }}
      >
        <color attach="background" args={['#0e0f11']} />
        <fog attach="fog" args={['#0e0f11', 9, 17]} />
        <PerformanceMonitor onDecline={() => setSlow(true)} />
        <Director />
        <ambientLight intensity={0.25} />
        <directionalLight position={[-3, 5, 4]} intensity={1.4} color="#ffe2c8" />
        <directionalLight position={[4, 2, -3]} intensity={0.8} color="#9fd2ff" />
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.2} position={[0, 5, -4]} scale={[10, 2, 1]} />
          <Lightformer intensity={1.4} color="#ffcfa6" position={[-5, 1.5, 1]} rotation-y={Math.PI / 2} scale={[6, 2.5, 1]} />
          <Lightformer intensity={1.2} color="#a8d8ff" position={[5, 1, -1]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer form="ring" intensity={2.5} position={[1, 4, 4]} scale={2.2} />
        </Environment>
        <Board />
        <Reactor />
        <PowderLoader />
        <EffectComposer multisampling={slow ? 0 : 4}>
          <Bloom mipmapBlur luminanceThreshold={0.72} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} />
          <Vignette offset={0.28} darkness={0.72} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function PowderLoader() {
  const canvas = useMemo(() => boardTextures().color.image as HTMLCanvasElement, []);
  return <Powder count={lite ? 2400 : 5000} colorCanvas={canvas} />;
}

type Pose = { x: number; y: number; s: number };
const mix = (a: Pose, b: Pose, t: number): Pose => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, s: a.s + (b.s - a.s) * t });

/** Turns scroll position into poses: hero board → exploded board → powder → reactor. */
function Director() {
  const { size } = useThree();
  const cur = useRef({ x: 1.5, y: 0, s: 0.95, rx: 0.95, ry: -0.35, ex: 0, sh: 0, rin: 0, rpos: 0 });
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = reduced ? 0.6 : t;
    const m = live.metals, L = live.toLeach;
    const wide = size.width / size.height > 1.05;
    const hero: Pose = wide ? { x: 1.55, y: -0.05, s: 0.95 } : { x: 0, y: -1.2, s: 0.5 };
    const metals: Pose = wide ? { x: 1.45, y: -0.55, s: 0.74 } : { x: 0, y: 0.95, s: 0.4 };
    const above: Pose = wide ? { x: -0.25, y: 2.2, s: 0.55 } : { x: -0.2, y: 2.7, s: 0.42 };
    const reactor: Pose = wide ? { x: -0.15, y: -0.62, s: 0.74 } : { x: -0.2, y: 0.95, s: 0.5 };

    const toMetals = smooth(0.15, 0.85, live.toMetals);
    const toShred = smooth(0.05, 0.4, L);
    const pose = mix(mix(hero, metals, toMetals), above, toShred);
    const explode = Math.max(smooth(0.06, 0.45, m), smooth(0, 0.2, L));
    const shred = smooth(0.25, 0.8, L);
    const rin = smooth(0.1, 0.6, L);

    const px = reduced ? 0 : live.pointer.x, py = reduced ? 0 : live.pointer.y;
    const heroRy = -0.35 + (reduced ? 0 : Math.sin(t * 0.22) * 0.28) + px * 0.25;
    const ry = heroRy + (-0.55 + m * 0.6 - heroRy) * toMetals;
    // Tilt toward the camera: 0 is edge-on, π/2 is face-on.
    const rx = 0.95 + py * 0.12 + (-0.42 - py * 0.12) * toMetals + 0.4 * toShred;

    const c = cur.current, d = THREE.MathUtils.damp;
    c.x = d(c.x, pose.x, 4, dt); c.y = d(c.y, pose.y, 4, dt); c.s = d(c.s, pose.s, 4, dt);
    c.rx = d(c.rx, rx, 4, dt); c.ry = d(c.ry, ry, 4, dt);
    c.ex = d(c.ex, explode, 6, dt); c.sh = d(c.sh, shred, 6, dt); c.rin = d(c.rin, rin, 5, dt);

    rig.explode = c.ex;
    rig.shred = c.sh;
    rig.reactorIn = c.rin;
    // On narrow screens the panel's list already says where each metal lives; labels would pile up.
    rig.tags = wide ? smooth(0.3, 0.55, m) * (1 - smooth(0, 0.2, L)) : 0;
    uniforms.uGlow.value = 2.4 - toMetals * 0.9;

    const b = rig.board;
    b.position.set(c.x, c.y, 0);
    b.scale.setScalar(c.s);
    b.rotation.set(c.rx, c.ry, 0);
    b.visible = c.sh < 0.04;

    const r = rig.reactor;
    r.position.set(reactor.x, reactor.y - (1 - c.rin) * 4, 0);
    r.scale.setScalar(reactor.s);
    r.rotation.y = -0.25 + (reduced ? 0 : px * 0.08);
  });
  return null;
}
