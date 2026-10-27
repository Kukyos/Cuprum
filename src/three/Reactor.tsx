import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { rig } from './rig.ts';
import { useStore } from '../store.ts';
import { computeResults } from '../sim/useResults.ts';
import { mass } from '../ui/format.ts';

export const R = 0.92; // vessel radius
export const H = 2.3; // vessel height
export const FILL = 1.5; // liquid height
export const BOTTOM = -H / 2;
const MICROBES = 650;
const BUBBLES = 70;

export function Reactor() {
  const group = useRef<THREE.Group>(null!);
  const impeller = useRef<THREE.Group>(null!);
  const liquid = useRef<THREE.MeshPhysicalMaterial>(null!);
  const cube = useRef<THREE.Mesh>(null!);
  const label = useRef<HTMLDivElement>(null);
  const surface = useRef<THREE.Mesh>(null!);
  useLayoutEffect(() => { rig.reactor = group.current; }, []);

  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * R, BOTTOM + 0.22 - Math.cos(a) * 0.22)); }
    pts.push(new THREE.Vector2(R, H / 2));
    return pts;
  }, []);
  const liquidProfile = useMemo(() => {
    const r = R - 0.03, pts: THREE.Vector2[] = [new THREE.Vector2(0, BOTTOM + 0.02)];
    for (let i = 1; i <= 12; i++) { const a = (i / 12) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.sin(a) * r, BOTTOM + 0.22 - Math.cos(a) * 0.2)); }
    pts.push(new THREE.Vector2(r, BOTTOM + FILL), new THREE.Vector2(0, BOTTOM + FILL));
    return pts;
  }, []);

  const microbes = useMemo(() => {
    const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0075, 0.026, 2, 6), new THREE.MeshStandardMaterial({ color: '#b4ff4a', emissive: '#b4ff4a', emissiveIntensity: 1.15, roughness: 0.4 }), MICROBES);
    const seed = Array.from({ length: MICROBES }, (_, i) => ({ r: 0.12 + Math.sqrt(Math.random()) * (R - 0.2), a: Math.random() * Math.PI * 2, y: BOTTOM + 0.15 + Math.random() * (FILL - 0.3), w: 0.4 + Math.random() * 0.8, ph: Math.random() * 10, i }));
    return { mesh, seed };
  }, []);
  const bubbles = useMemo(() => {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0, clearcoat: 1, transparent: true, opacity: 0.4 }), BUBBLES);
    const seed = Array.from({ length: BUBBLES }, () => ({ a: Math.random() * Math.PI * 2, r: 0.3 + Math.random() * 0.08, y: Math.random(), s: 0.015 + Math.random() * 0.025, v: 0.25 + Math.random() * 0.3 }));
    return { mesh, seed };
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color() }), []);
  const surfBase = useRef<Float32Array | null>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const st = useStore.getState();
    const r = computeResults(st);
    const visible = rig.reactorIn > 0.001;
    group.current.visible = visible;
    if (!visible) return;

    // Liquid colour from the simulated solution chemistry.
    tmp.c.setRGB(r.rgb[0] / 255, r.rgb[1] / 255, r.rgb[2] / 255, THREE.SRGBColorSpace);
    liquid.current.color.copy(tmp.c);
    liquid.current.emissive.copy(tmp.c).multiplyScalar(0.45);

    const rpm = r.f.growing ? 1.6 : 0.6;
    impeller.current.rotation.y += dt * rpm * 3;

    // Vortex dip and ripples on the surface.
    const g = surface.current.geometry as THREE.BufferGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    if (!surfBase.current) surfBase.current = Float32Array.from(pos.array as Float32Array);
    for (let i = 0; i < pos.count; i++) {
      const x = surfBase.current[i * 3], y = surfBase.current[i * 3 + 1];
      const d = Math.hypot(x, y);
      pos.setZ(i, -0.09 * Math.exp(-d * d * 6) + 0.012 * Math.sin(d * 14 - t * 3 + Math.atan2(y, x) * 2));
    }
    pos.needsUpdate = true;

    // Microbes: count follows growth, they ride the stirring flow.
    const o = r.o;
    const growth = r.f.growing ? Math.min(1, 0.12 + 0.88 / (1 + Math.exp(-(r.progress * st.process.days - r.f.lag - 1) * 1.1))) * (0.35 + 0.65 * r.f.activity) : 0.05;
    const shown = Math.round(MICROBES * (st.mode === 'simple' ? 0.7 : growth));
    const mat = microbes.mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(o.tint); mat.emissive.set(o.tint);
    const len = o.shape === 'hypha' ? 3.2 : o.shape === 'vibrio' ? 0.75 : 1;
    for (const b of microbes.seed) {
      const k = b.i < shown ? 1 : 0;
      const mixedLen = o.shape === 'mixed' ? (b.i % 3 === 0 ? 0.75 : 1) : len;
      const a = b.a + t * b.w * (0.6 / (b.r + 0.3)) * (rpm / 1.6);
      tmp.p.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.7 + b.ph) * 0.06, Math.sin(a) * b.r);
      tmp.e.set(Math.sin(t * 2 + b.ph) * 1.2, a + b.ph, Math.cos(t * 1.7 + b.ph));
      tmp.q.setFromEuler(tmp.e);
      tmp.s.set(k, k * mixedLen, k);
      microbes.mesh.setMatrixAt(b.i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
    }
    microbes.mesh.instanceMatrix.needsUpdate = true;

    // Air sparger bubbles.
    bubbles.seed.forEach((b, i) => {
      b.y = (b.y + dt * b.v * 0.6) % 1;
      const y = BOTTOM + 0.12 + b.y * (FILL - 0.15);
      const wob = Math.sin(t * 5 + i) * 0.03;
      tmp.p.set(Math.cos(b.a + b.y * 2) * (b.r + b.y * 0.25) + wob, y, Math.sin(b.a + b.y * 2) * (b.r + b.y * 0.25));
      const s = b.s * (b.y > 0.96 ? (1 - b.y) * 25 : 1);
      bubbles.mesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q.identity(), tmp.s.set(s, s, s)));
    });
    bubbles.mesh.instanceMatrix.needsUpdate = true;

    // A true-scale cube of the copper recovered so far (density 8.96 g/cm³; 1 unit = 10 cm).
    const cuSoFar = st.mode === 'simple' ? r.cuG : st.massG * (r.preset.comp.Cu ?? 0) * (r.atDay.out.Cu ?? 0);
    const side = Math.cbrt(Math.max(cuSoFar, 0.01) / 8.96) / 10;
    cube.current.scale.setScalar(Math.max(side, 0.001));
    cube.current.position.y = -0.62 + side / 2 + 0.04;
    cube.current.rotation.y = t * 0.4;
    if (label.current) label.current.textContent = `${mass(cuSoFar)} Cu, to scale`;
  });

  return (
    <group ref={group} visible={false}>
      {/* Glass vessel */}
      <mesh renderOrder={2}>
        <latheGeometry args={[profile, 72]} />
        {/* Clear-coated glass without transmission, so the broth and microbes inside stay visible. */}
        <meshPhysicalMaterial color="#d8e8ee" roughness={0.02} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.6}
          transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Culture broth */}
      <mesh renderOrder={1}>
        <latheGeometry args={[liquidProfile, 72]} />
                <meshPhysicalMaterial ref={liquid} color="#9fc6d6" roughness={0.2} transparent opacity={0.62} clearcoat={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={surface} position-y={BOTTOM + FILL + 0.001} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[R - 0.03, 64, 0, Math.PI * 2]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.05} metalness={0} transparent opacity={0.18} />
      </mesh>
      <primitive object={microbes.mesh} />
      <primitive object={bubbles.mesh} />
      {/* Stainless head plate, motor, shaft and Rushton impeller */}
      <group position-y={H / 2}>
        <mesh material={STEEL}><cylinderGeometry args={[R + 0.06, R + 0.06, 0.09, 64]} /></mesh>
        <mesh position-y={0.3} material={DARK}><cylinderGeometry args={[0.22, 0.22, 0.48, 32]} /></mesh>
        <mesh position-y={0.56} material={STEEL}><cylinderGeometry args={[0.16, 0.22, 0.06, 32]} /></mesh>
        {[[-0.5, 0.25], [0.55, -0.2], [0.1, 0.6], [-0.35, -0.55]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.12, z]} material={STEEL}><cylinderGeometry args={[0.04, 0.04, 0.18 + i * 0.04, 16]} /></mesh>
        ))}
      </group>
      <group ref={impeller}>
        <mesh position-y={0.1} material={STEEL}><cylinderGeometry args={[0.025, 0.025, H - 0.3, 12]} /></mesh>
        <group position-y={BOTTOM + 0.42}>
          <mesh material={STEEL}><cylinderGeometry args={[0.24, 0.24, 0.012, 32]} /></mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 0.24, 0, Math.sin((i / 6) * Math.PI * 2) * 0.24]} rotation-y={-(i / 6) * Math.PI * 2} material={STEEL}>
              <boxGeometry args={[0.012, 0.12, 0.1]} />
            </mesh>
          ))}
        </group>
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 2 + 0.4) * (R - 0.08), 0.15, Math.sin(i * Math.PI / 2 + 0.4) * (R - 0.08)]} rotation-y={-(i * Math.PI / 2 + 0.4)} material={STEEL}>
          <boxGeometry args={[0.1, H - 0.6, 0.012]} />
        </mesh>
      ))}
      <mesh position-y={BOTTOM + 0.12} rotation-x={Math.PI / 2} material={STEEL}><torusGeometry args={[0.32, 0.018, 8, 48]} /></mesh>

      {/* Recovered copper on a plinth */}
      <group position={[R + 0.15, BOTTOM + 0.6, 1.15]}>
        <mesh position-y={-0.66} material={DARK}><cylinderGeometry args={[0.3, 0.34, 0.08, 48]} /></mesh>
        <mesh ref={cube} material={COPPER}><boxGeometry args={[1, 1, 1]} /></mesh>
        <Html position={[0, -0.86, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="cube-label" ref={label} />
        </Html>
      </group>
    </group>
  );
}

const STEEL = new THREE.MeshStandardMaterial({ color: '#b9bec4', metalness: 1, roughness: 0.28 });
const DARK = new THREE.MeshStandardMaterial({ color: '#23262b', metalness: 0.6, roughness: 0.45 });
const COPPER = new THREE.MeshStandardMaterial({ color: '#f0a070', metalness: 0.85, roughness: 0.32, emissive: '#b8541c', emissiveIntensity: 0.55, envMapIntensity: 2.2 });
