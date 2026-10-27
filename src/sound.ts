// Tiny synthesized UI sounds (no audio files). Only ever played after a user gesture.
import { useStore } from './store.ts';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gain = 0.06, type: OscillatorType = 'sine') {
  if (!ctx) ctx = new AudioContext();
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const on = () => useStore.getState().sound;

/** Two rising tones: a confident "locked on". */
export const chime = () => { if (on()) { tone(880, 0, 0.18); tone(1318.5, 0.09, 0.32); } };
/** Single soft tick for small confirmations. */
export const tick = () => { if (on()) tone(1760, 0, 0.05, 0.025, 'triangle'); };
/** Low falling tone for "nothing found". */
export const miss = () => { if (on()) { tone(440, 0, 0.16, 0.05); tone(330, 0.1, 0.22, 0.05); } };
