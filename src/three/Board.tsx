import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BD, BW, FINGERS, HOLES, PARTS, boardTextures, pins, type Part } from './boardLayout.ts';
import { rig, withPulse } from './rig.ts';
import { useStore } from '../store.ts';
import { METALS, PRESETS, type Metal } from '../data/science.ts';
import { mass } from '../ui/format.ts';

const T = 0.06; // board thickness
type Chip = Exclude<Extract<Part, { w: number }>, { kind: 'smd' }>;

export function Board() {
  const tex = useMemo(boardTextures, []);
  const group = useRef<THREE.Group>(null!);
  const layers = { bottom: useRef<THREE.Mesh>(null!), copper: useRef<THREE.Mesh>(null!), mask: useRef<THREE.Mesh>(null!), parts: useRef<THREE.Group>(null!) };
  const tagEls = useRef<HTMLDivElement[]>([]);

  const mats = useMemo(() => ({
    mask: withPulse(new THREE.MeshPhysicalMaterial({ map: tex.color, roughnessMap: tex.rough, metalnessMap: tex.rough, roughness: 1, metalness: 1, clearcoat: 0.5, clearcoatRoughness: 0.35 }), tex.flow, false),
    copper: withPulse(new THREE.MeshStandardMaterial({ color: '#d7864e', metalness: 1, roughness: 0.27, side: THREE.DoubleSide }), tex.flow, true),
    bottom: new THREE.MeshStandardMaterial({ color: '#b86a3a', metalness: 1, roughness: 0.35, alphaMap: tex.bottom, alphaTest: 0.5, side: THREE.DoubleSide }),
    core: new THREE.MeshStandardMaterial({ color: '#a89f6b', roughness: 0.75, transparent: true, opacity: 0.92 }),
    epoxy: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.55 }),
    tin: new THREE.MeshStandardMaterial({ color: '#d4d6da', metalness: 1, roughness: 0.22 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e5b24b', metalness: 1, roughness: 0.2 }),
    alu: new THREE.MeshStandardMaterial({ color: '#c4c8cd', metalness: 1, roughness: 0.38 }),
    sleeve: new THREE.MeshStandardMaterial({ color: '#1c2a3a', roughness: 0.4, metalness: 0.2 }),
    mlcc: new THREE.MeshStandardMaterial({ color: '#9b7b58', roughness: 0.6 }),
    ferrite: new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.7 }),
    substrate: new THREE.MeshStandardMaterial({ color: '#2d4a2f', roughness: 0.5 }),
  }), [tex]);

  useLayoutEffect(() => { rig.board = group.current; }, []);

  const chips = PARTS.filter((p): p is Chip => 'w' in p && p.kind !== 'smd');
  const caps = PARTS.filter((p): p is Extract<Part, { kind: 'cap' }> => p.kind === 'cap');
  const smds = PARTS.filter((p): p is Extract<Part, { kind: 'smd' }> => p.kind === 'smd');
  const allPins = chips.flatMap((c) => pins(c));

  // Instanced small things: chip legs, solder joints, SMD bodies and terminations, gold fingers.
  const inst = useMemo(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const set = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot = 0) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));
    };
    const box = new THREE.BoxGeometry(1, 1, 1);
    const legs = new THREE.InstancedMesh(box, mats.tin, allPins.length);
    const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.tin, allPins.length + smds.length * 2);
    allPins.forEach((q2, i) => {
      const side = q2.side % 2;
      set(legs, i, q2.x, 0.012, q2.z, side ? 0.05 : 0.012, 0.012, side ? 0.012 : 0.05);
      set(joints, i, q2.x, 0, q2.z, 0.014, 0.008, 0.014);
    });
    const bodies = { mlcc: smds.filter((d) => d.tone === 'mlcc'), res: smds.filter((d) => d.tone === 'res') };
    const mlcc = new THREE.InstancedMesh(box, mats.mlcc, bodies.mlcc.length);
    const res = new THREE.InstancedMesh(box, mats.epoxy, bodies.res.length);
    const ends = new THREE.InstancedMesh(box, mats.tin, smds.length * 2);
    bodies.mlcc.forEach((d, i) => set(mlcc, i, d.x, 0.012, d.z, d.w * 0.7, 0.024, d.d, d.rot));
    bodies.res.forEach((d, i) => set(res, i, d.x, 0.008, d.z, d.w * 0.7, 0.016, d.d, d.rot));
    smds.forEach((d, i) => {
      const ox = Math.cos(d.rot) * d.w * 0.42, oz = -Math.sin(d.rot) * d.w * 0.42;
      set(ends, i * 2, d.x - ox, 0.012, d.z - oz, d.w * 0.18, 0.026, d.d * 1.02, d.rot);
      set(ends, i * 2 + 1, d.x + ox, 0.012, d.z + oz, d.w * 0.18, 0.026, d.d * 1.02, d.rot);
      set(joints, allPins.length + i * 2, d.x - ox * 1.15, 0, d.z - oz * 1.15, 0.012, 0.007, 0.016);
      set(joints, allPins.length + i * 2 + 1, d.x + ox * 1.15, 0, d.z + oz * 1.15, 0.012, 0.007, 0.016);
    });
    const fingers = new THREE.InstancedMesh(box, mats.gold, FINGERS.length);
    FINGERS.forEach((f, i) => set(fingers, i, f.x, 0, f.z, f.w, 0.004, f.d));
    const soc = chips.find((c) => c.kind === 'soc')!;
    const fins = new THREE.InstancedMesh(box, mats.alu, 13);
    for (let i = 0; i < 13; i++) set(fins, i, soc.x - 0.3 + i * 0.05, 0.19, soc.z, 0.018, 0.22, 0.62);
    const header = chips.find((c) => c.kind === 'header')!;
    const hpins = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), mats.gold, 16);
    for (let i = 0; i < 16; i++) set(hpins, i, header.x - 0.22 + (i % 8) * 0.063, 0.15, header.z + (i < 8 ? -0.022 : 0.022), 0.008, 0.12, 0.008);
    return { legs, joints, mlcc, res, ends, fingers, fins, hpins };
  }, [mats]);

  const chipMat = (k: Chip['kind']) => (k === 'shield' || k === 'crystal' ? mats.tin : k === 'inductor' ? mats.ferrite : mats.epoxy);
  const chipH = { soc: 0.035, qfp: 0.05, soic: 0.045, mem: 0.04, shield: 0.09, crystal: 0.05, header: 0.09, inductor: 0.075 } as const;

  // Labels for where each metal lives on the board, spread so they don't collide on screen.
  const soc = chips.find((c) => c.kind === 'soc')!;
  const u3 = chips.find((c) => c.ref === 'U3')!;
  const sh = chips.find((c) => c.kind === 'shield')!;
  const hdr = chips.find((c) => c.kind === 'header')!;
  const near = (x: number, z: number) => smds.filter((d) => d.tone === 'mlcc').sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z))[0];
  const pd = near(0.15, -0.6);
  const tags: { metal: Metal; layer: 'copper' | 'parts'; pos: [number, number, number]; where: string }[] = [
    { metal: 'Cu', layer: 'copper', pos: [-1.05, 0.02, 0.2], where: 'traces and planes' },
    { metal: 'Au', layer: 'copper', pos: [-0.2, 0.02, BD / 2 - 0.08], where: 'edge connector' },
    { metal: 'Al', layer: 'parts', pos: [soc.x - 0.2, 0.34, soc.z], where: 'heatsink' },
    { metal: 'Pd', layer: 'parts', pos: [pd.x, 0.03, pd.z], where: 'ceramic capacitors' },
    { metal: 'Ni', layer: 'parts', pos: [hdr.x + 0.2, 0.2, hdr.z], where: 'connector plating' },
    { metal: 'Fe', layer: 'parts', pos: [sh.x + 0.15, 0.1, sh.z + 0.15], where: 'shield can' },
    { metal: 'Sn', layer: 'parts', pos: [u3.x, 0.02, u3.z + 0.17], where: 'solder joints' },
  ];
  const presetId = useStore((s) => s.presetId);
  const preset = PRESETS[presetId];
  const isBoard = ['pc_board', 'phone_board', 'tv_board'].includes(presetId);

  useFrame(() => {
    const e = rig.explode;
    layers.bottom.current.position.y = -T / 2 - 0.002 - e * 0.55;
    layers.copper.current.position.y = T / 2 + 0.001 + e * 0.5;
    layers.copper.current.visible = e > 0.01;
    layers.mask.current.position.y = T / 2 + 0.003 + e * 0.85;
    layers.parts.current.position.y = T / 2 + 0.003 + e * 1.3;
    layers.parts.current.children.forEach((c, i) => { if (c.userData.stagger) c.position.y = e * c.userData.stagger; });
    const op = isBoard ? rig.tags : 0;
    tagEls.current.forEach((el) => {
      if (!el) return;
      el.style.opacity = String(op);
      el.style.visibility = op < 0.02 ? 'hidden' : 'visible';
    });
  });

  return (
    <group ref={group}>
      <mesh ref={layers.bottom} rotation-x={-Math.PI / 2} material={mats.bottom}><planeGeometry args={[BW - 0.02, BD - 0.02]} /></mesh>
      <mesh material={mats.core}><boxGeometry args={[BW, T, BD]} /></mesh>
      <mesh ref={layers.copper} rotation-x={-Math.PI / 2} material={mats.copper}><planeGeometry args={[BW, BD]} /></mesh>
      <mesh ref={layers.mask} rotation-x={-Math.PI / 2} material={mats.mask}><planeGeometry args={[BW, BD]} /></mesh>
      <group position-y={T / 2 + 0.001}>
        <primitive object={inst.fingers} />
        {HOLES.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0, z]} rotation-x={-Math.PI / 2} material={mats.tin}><ringGeometry args={[0.026, 0.04, 24]} /></mesh>
        ))}
      </group>
      <group ref={layers.parts}>
        <primitive object={inst.legs} /><primitive object={inst.joints} /><primitive object={inst.mlcc} />
        <primitive object={inst.res} /><primitive object={inst.ends} />
        {chips.map((c, i) => (
          <group key={c.ref} position={[c.x, 0, c.z]} userData={{ stagger: 0.15 + (i % 5) * 0.07 }}>
            <mesh position-y={chipH[c.kind] / 2 + 0.004} material={c.kind === 'soc' ? mats.substrate : chipMat(c.kind)}>
              <boxGeometry args={[c.w, chipH[c.kind], c.d]} />
            </mesh>
            {c.kind === 'soc' && (
              <>
                <mesh position-y={0.06} material={mats.alu}><boxGeometry args={[0.66, 0.03, 0.66]} /></mesh>
                <primitive object={inst.fins} position={[-c.x, 0, -c.z]} />
              </>
            )}
            {c.kind === 'header' && <primitive object={inst.hpins} position={[-c.x, 0, -c.z]} />}
          </group>
        ))}
        {caps.map((c, i) => (
          <group key={c.ref} position={[c.x, 0, c.z]} userData={{ stagger: 0.3 + (i % 3) * 0.1 }}>
            <mesh position-y={0.13} material={mats.sleeve}><cylinderGeometry args={[c.r, c.r, 0.25, 32]} /></mesh>
            <mesh position-y={0.256} material={mats.alu}><cylinderGeometry args={[c.r * 0.97, c.r * 0.97, 0.006, 32]} /></mesh>
          </group>
        ))}
      </group>

      {tags.map((t, i) => (
        <TagAnchor key={t.metal} layer={t.layer} layers={layers} pos={t.pos}>
          <div className="tag" ref={(el) => { if (el) tagEls.current[i] = el; }}>
            <span className="tile"><small>{METALS[t.metal].z}</small>{t.metal}</span>
            <span className="tag-text">
              <b>{METALS[t.metal].name}</b>
              <span>{t.where}</span>
              <span className="tag-amt">{mass(1000 * (preset.comp[t.metal] ?? 0))} per kg</span>
            </span>
          </div>
        </TagAnchor>
      ))}
    </group>
  );
}

/** Keeps an Html label attached to a moving layer without re-rendering React. */
function TagAnchor({ layer, layers, pos, children }: {
  layer: 'copper' | 'parts'; pos: [number, number, number]; children: React.ReactNode;
  layers: { copper: React.RefObject<THREE.Mesh>; parts: React.RefObject<THREE.Group> };
}) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const src = layer === 'copper' ? layers.copper.current : layers.parts.current;
    g.current.position.set(pos[0], src.position.y + pos[1], pos[2]);
  });
  return (
    <group ref={g}>
      <Html center={false} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>{children}</Html>
    </group>
  );
}
