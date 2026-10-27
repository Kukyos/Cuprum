import { useId, type ReactNode } from 'react';

type SliderProps = {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  /** Marks on the track, e.g. the organism's optimum. */
  marks?: { at: number; label: string }[];
  disabled?: boolean;
  hint?: ReactNode;
};

export function Slider({ label, value, min, max, step, onChange, format, marks, disabled, hint }: SliderProps) {
  const id = useId();
  const pos = (v: number) => `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`;
  return (
    <div className={`slider${disabled ? ' is-disabled' : ''}`}>
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <div className="slider-track" style={{ ['--p' as string]: pos(value) }}>
        {marks?.map((m) => (
          <span key={m.label} className="slider-mark" style={{ left: pos(m.at) }} title={m.label} aria-hidden />
        ))}
        <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
          onChange={(e) => onChange(+e.target.value)} />
      </div>
      {hint && <p className="slider-hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small "simulated" badge: every simulated number on the page wears one. */
export const Sim = () => <abbr className="sim" title="Simulated estimate, not a measurement">sim</abbr>;
