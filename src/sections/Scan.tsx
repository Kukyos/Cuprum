import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { bestIn, classify, cropSquare, toDataURL, topClasses, verdict, CLASSES, PERSON_CUTOFF, type Result } from '../ai/classifier.ts';
import { classById, streamName, useStore } from '../store.ts';
import { ROUTES } from '../data/science.ts';
import samples from '../data/samples.json';
import { chime, miss, tick } from '../sound.ts';
import { pct } from '../ui/format.ts';

const AIM = 0.78; // aiming box: share of the shorter video side that is sent to the model
const LOCK_SCORE = 0.55; // stream-level match score needed to count a frame as stable
const LOCK_FRAMES = 4; // consecutive stable frames before locking on
const FRAME_GAP_MS = 140; // ≈ 7 classifications per second at most

const SAMPLE_ORDER: [keyof typeof samples, string][] = [
  ['motherboard', 'Motherboard'], ['phone-board', 'Phone board'], ['ram', 'RAM stick'], ['graphics-card', 'Graphics card'],
  ['phones', 'Phones'], ['li-ion-cell', 'Li-ion cells'], ['aa-battery', 'AA battery'], ['cable', 'Cable'],
  ['hard-drive', 'Hard drive'], ['charger', 'Charger'], ['cfl-bulb', 'CFL bulb'], ['mug', 'A mug'],
];

type Phase = 'off' | 'starting' | 'searching' | 'steady' | 'analysing' | 'locked' | 'denied' | 'nocam';

export function Scan() {
  const video = useRef<HTMLVideoElement>(null);
  const section = useRef<HTMLElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const loop = useRef({ token: 0, visible: true, smooth: null as number[] | null, human: 0, stable: 0, last: '' });
  const [phase, setPhase] = useState<Phase>('off');
  const [frame, setFrame] = useState<{ probs: number[]; human: number } | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [lockedSrc, setLockedSrc] = useState<string | null>(null);
  const ai = useStore((s) => s.ai);
  const detection = useStore((s) => s.detection);
  const detect = useStore((s) => s.detect);

  // Pause inference while the scanner is off-screen so the 3D scene gets the GPU.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => (loop.current.visible = e.isIntersecting), { threshold: 0.15 });
    io.observe(section.current!);
    return () => { io.disconnect(); stopCamera(); };
  }, []);

  function stopCamera() {
    loop.current.token++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function startCamera(mode = facing) {
    if (!navigator.mediaDevices?.getUserMedia) return setPhase('nocam');
    stopCamera();
    setPhase('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
      });
      stream.current = s;
      const settings = s.getVideoTracks()[0].getSettings();
      // Laptops report no facingMode for their webcam; treat that as a front camera and mirror it.
      setMirrored(settings.facingMode !== 'environment');
      video.current!.srcObject = s;
      await video.current!.play();
      setLockedSrc(null);
      run();
    } catch (err) {
      setPhase((err as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'nocam');
    }
  }

  function lock(snapshot: ImageData, p: number[], human: number, source: 'camera' | 'upload' | 'sample') {
    const [st, score] = verdict(p, human);
    const best = bestIn(st, p);
    const url = toDataURL(snapshot);
    detect({ classId: best.id, stream: st, score, top: topClasses(p), snapshot: url, source });
    setLockedSrc(url);
    setFrame({ probs: p, human });
    setPhase('locked');
    if (st === 'none') miss(); else chime();
  }

  async function run() {
    const token = ++loop.current.token;
    Object.assign(loop.current, { smooth: null, human: 0, stable: 0, last: '' });
    setPhase('searching');
    while (token === loop.current.token) {
      const v = video.current!;
      if (!loop.current.visible || useStore.getState().ai.status !== 'ready' || v.readyState < 2) {
        await wait(250);
        continue;
      }
      const t0 = performance.now();
      const crop = cropSquare(v, v.videoWidth, v.videoHeight, AIM);
      const snap = new ImageData(new Uint8ClampedArray(crop.data), crop.width, crop.height);
      let r: Result;
      try { r = await classify(crop); } catch { await wait(500); continue; }
      if (token !== loop.current.token) return;
      const L = loop.current;
      L.smooth = L.smooth ? L.smooth.map((s, i) => s * 0.55 + r.probs[i] * 0.45) : r.probs;
      L.human = L.smooth === r.probs ? r.human : L.human * 0.55 + r.human * 0.45;
      setFrame({ probs: L.smooth, human: L.human });
      const [top, score] = verdict(L.smooth, L.human);
      const good = top !== 'none' && score >= LOCK_SCORE;
      L.stable = good ? (top === L.last ? L.stable + 1 : 1) : 0;
      L.last = top;
      if (L.stable >= LOCK_FRAMES) return lock(snap, L.smooth, L.human, 'camera');
      setPhase(L.stable >= 2 ? 'steady' : 'searching');
      if (L.stable === 2) tick();
      await wait(Math.max(0, FRAME_GAP_MS - (performance.now() - t0)));
    }
  }

  async function analyseBlob(blob: Blob, source: 'upload' | 'sample') {
    loop.current.token++;
    setPhase('analysing');
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const crop = cropSquare(bmp, bmp.width, bmp.height, 1);
    const snap = new ImageData(new Uint8ClampedArray(crop.data), crop.width, crop.height);
    setLockedSrc(toDataURL(snap));
    const r = await classify(crop);
    lock(snap, r.probs, r.human, source);
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) analyseBlob(f, 'upload');
    e.target.value = '';
  };
  const onSample = async (slug: string) => analyseBlob(await (await fetch(`/samples/${slug}.jpg`)).blob(), 'sample');
  const rescan = () => (stream.current ? run() : setPhase('off'));
  const flip = () => { const m = facing === 'environment' ? 'user' : 'environment'; setFacing(m); startCamera(m); };

  const probs = frame?.probs ?? null;
  const [topStream, topScore] = frame ? verdict(frame.probs, frame.human) : ['none', 0];
  const personOnly = !!frame && frame.human >= PERSON_CUTOFF;
  const fine = probs ? bestIn(topStream, probs) : null;
  const cameraOn = !!stream.current && phase !== 'denied' && phase !== 'nocam';
  const live = phase === 'searching' || phase === 'steady';

  const stateText: Record<Phase, string> = {
    off: 'Camera off',
    starting: 'Starting camera…',
    searching: ai.status !== 'ready' ? `Waiting for the AI model (${Math.round(ai.progress * 100)} %)…`
      : personOnly ? 'Only a person in frame. Hold an item up to the camera.'
      : 'Looking for e-waste. Hold the item inside the frame.',
    steady: 'Hold still…',
    analysing: ai.status === 'ready' ? 'Analysing photo…' : `Waiting for the AI model (${Math.round(ai.progress * 100)} %)…`,
    locked: detection?.stream === 'none' ? 'No e-waste found in this image' : 'Locked on',
    denied: 'Camera access was blocked. Allow it in the address bar, or use a photo instead.',
    nocam: 'No camera available here. Camera needs https or localhost; photos still work.',
  };

  return (
    <section id="scan" className="scan" ref={section}>
      <header className="section-head">
        <p className="step">Step 1 of 4</p>
        <h2>Show it an object</h2>
        <p className="section-lede">Point the camera at a circuit board, battery, cable, phone or any other gadget. The model compares each frame against {CLASSES.length} categories, entirely on this device; nothing is uploaded. It ignores your face and hands.</p>
      </header>

      <div className="scan-grid">
        <div className="viewport-wrap">
          <div className={`viewport is-${phase}`}>
            <video ref={video} playsInline muted className={mirrored ? 'mirror' : ''} aria-label="Camera preview" />
            {lockedSrc && (phase === 'locked' || phase === 'analysing') && <img className="freeze" src={lockedSrc} alt="Analysed frame" />}
            <div className="aim" aria-hidden><i /><i /><i /><i />{live && <span className="sweep" />}</div>
            {!cameraOn && phase !== 'locked' && phase !== 'analysing' && (
              <div className="vp-empty">
                <button type="button" className="btn primary" onClick={() => startCamera()}>Start camera</button>
                <p>{phase === 'denied' || phase === 'nocam' ? stateText[phase] : 'or pick a sample photo below'}</p>
              </div>
            )}
            <div className="vp-bar">
              <span className={`state ${live ? 'is-live' : ''}`}><i className="live-dot" />{stateText[phase]}</span>
            </div>
          </div>
          <div className="vp-actions">
            {phase === 'locked' && <button type="button" className="btn primary" onClick={rescan}>{stream.current ? 'Scan again' : 'Clear'}</button>}
            {cameraOn && <button type="button" className="btn" onClick={() => { stopCamera(); setPhase('off'); }}>Stop camera</button>}
            {cameraOn && <button type="button" className="btn" onClick={flip}>Switch camera</button>}
            <label className="btn">
              Upload a photo
              <input type="file" accept="image/*" onChange={onFile} hidden />
            </label>
          </div>
          <div className="samples" role="list" aria-label="Sample photos">
            {SAMPLE_ORDER.map(([slug, name]) => (
              <button key={slug} type="button" role="listitem" onClick={() => onSample(slug)} title={`Analyse: ${name}`}>
                <img src={`/samples/${slug}.jpg`} alt="" loading="lazy" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="readout" aria-live="polite">
          <div className="pred">
            <p className="pred-kicker">{phase === 'locked' ? 'Prediction' : probs ? 'Best match right now' : 'Prediction'}</p>
            <h3>{personOnly ? 'Just a person' : probs ? streamName[topStream] : 'Nothing yet'}</h3>
            {probs && fine && topStream !== 'none' && (
              <p className="pred-sub">Most like: {fine.name}. Match score <b>{pct(topScore)}</b></p>
            )}
            {frame && frame.human > 0.05 && !personOnly && (
              <p className="pred-note">Ignoring faces and hands ({pct(frame.human)} of this frame).</p>
            )}
          </div>

          <ol className="scores">
            {personOnly && <li className="empty">Faces and hands are ignored, so there’s nothing to score yet. Hold an item up.</li>}
            {(probs && !personOnly ? topClasses(probs, 6) : []).map(({ id, p }) => (
              <li key={id} className={classById[id].stream === topStream ? 'is-top' : ''}>
                <span className="sc-name">{classById[id].name}</span>
                <span className="sc-bar"><i style={{ transform: `scaleX(${p})` }} /></span>
                <span className="sc-val">{pct(p)}</span>
              </li>
            ))}
            {!probs && <li className="empty">Scores for the closest categories appear here.</li>}
          </ol>

          {phase === 'locked' && detection && <RouteCard stream={detection.stream} />}

          <p className="fineprint">
            Match scores are the model’s confidence relative to these {CLASSES.length} categories, not a guarantee.
            Model: {ai.model || 'MobileCLIP'}{ai.device && <>, running on {ai.device}</>}{ai.ms > 0 && <>, {Math.round(ai.ms)} ms per frame</>}.
          </p>
        </div>
      </div>
    </section>
  );
}

function RouteCard({ stream }: { stream: string }) {
  const r = ROUTES[stream] ?? ROUTES.none;
  return (
    <div className={`route is-${r.verdict}`}>
      <p className="route-head">
        {r.verdict === 'hazard' && <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 6v4M8 11.6v.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
        {r.headline}
      </p>
      <ol>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {r.verdict !== 'none' && (
        <div className="route-actions">
          <a className="btn primary" href={`/pickup.html?item=${stream}`}>Schedule a pickup</a>
          <a className="btn" href="#metals">See the metals inside</a>
          {(r.verdict === 'bioleach' || r.boardPreset) && <a className="btn" href="#leach">{r.verdict === 'bioleach' ? 'Bioleach it' : 'Bioleach the board inside'}</a>}
        </div>
      )}
    </div>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
