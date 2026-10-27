import { useStore } from '../store.ts';

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)} %`;

/** Mass in the most readable unit: kg, g, mg or µg. */
export function mass(g: number) {
  if (g >= 1000) return `${(g / 1000).toLocaleString('en', { maximumFractionDigits: 2 })} kg`;
  if (g >= 1) return `${g.toLocaleString('en', { maximumFractionDigits: g >= 100 ? 0 : 1 })} g`;
  if (g >= 0.001) return `${(g * 1000).toLocaleString('en', { maximumFractionDigits: g >= 0.1 ? 0 : 1 })} mg`;
  return g > 0 ? `${(g * 1e6).toFixed(0)} µg` : '0 g';
}

/** Mass fraction as %, or ppm (g/t) once it gets small. */
export function share(w: number) {
  if (w >= 0.001) return `${(w * 100).toLocaleString('en', { maximumFractionDigits: w >= 0.1 ? 1 : 2 })} %`;
  return `${(w * 1e6).toLocaleString('en', { maximumFractionDigits: 0 })} g/t`;
}

export function useMoney() {
  const { currency, fx } = useStore();
  return (usd: number) => {
    const v = currency === 'INR' ? usd * fx : usd;
    const sym = currency === 'INR' ? '₹' : '$';
    const digits = v < 1 ? 2 : v < 100 ? 2 : 0;
    return `${sym}${v.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };
}
