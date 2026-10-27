import { useEffect } from 'react';
import Lenis from 'lenis';
import { Nav, Hero } from './sections/Hero.tsx';
import { Scan } from './sections/Scan.tsx';
import { Metals } from './sections/Metals.tsx';
import { Leach } from './sections/Leach.tsx';
import { Report } from './sections/Report.tsx';
import { Science } from './sections/Science.tsx';
import { PrintReport } from './sections/PrintReport.tsx';
import { Stage } from './three/Stage.tsx';
import { live, useStore } from './store.ts';

const SEE_THROUGH = ['hero', 'metals', 'leach']; // sections where the 3D stage shows

export function App() {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = reduced ? null : new Lenis({ lerp: 0.11, anchors: { offset: -64 } });
    let raf = 0;
    const metals = document.getElementById('metals')!;
    const leach = document.getElementById('leach')!;
    const clamp = (x: number) => Math.min(1, Math.max(0, x));

    // Scroll → how far the metals and leach sections have entered, and progress through the pinned metals section.
    const frame = (time: number) => {
      lenis?.raf(time);
      const vh = innerHeight;
      const mr = metals.getBoundingClientRect();
      live.toMetals = clamp((vh - mr.top) / vh);
      live.toLeach = clamp((vh - leach.getBoundingClientRect().top) / vh);
      live.metals = Math.min(1, Math.max(0, -mr.top / Math.max(1, mr.height - vh)));
      const visible = SEE_THROUGH.some((id) => {
        const r = document.getElementById(id)!.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh;
      });
      if (visible !== useStore.getState().stageActive) useStore.setState({ stageActive: visible });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const move = (e: PointerEvent) => { live.pointer.x = (e.clientX / innerWidth) * 2 - 1; live.pointer.y = (e.clientY / innerHeight) * 2 - 1; };
    addEventListener('pointermove', move);
    return () => { cancelAnimationFrame(raf); lenis?.destroy(); removeEventListener('pointermove', move); };
  }, []);

  return (
    <>
      {!new URLSearchParams(location.search).has('no3d') && <Stage />}
      <Nav />
      <main>
        <Hero />
        <Scan />
        <Metals />
        <Leach />
        <Report />
        <Science />
      </main>
      <PrintReport />
    </>
  );
}
