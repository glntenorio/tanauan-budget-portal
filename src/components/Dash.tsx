/**
 * Dashboard pieces for the overview: cards, count-up figures, and small
 * hand-drawn SVG charts. No chart library: the shapes are simple and the
 * portal keeps its three runtime dependencies.
 *
 * Motion is decoration only. Every figure is in the DOM from the first
 * render; with prefers-reduced-motion the counts and bars start at their
 * final values.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { php } from '../lib/format';
import { reduceMotion, useGrown } from '../lib/motion';

/** A number that counts up to `value` once, then follows it. */
export function CountUp({ value, format, duration = 1100 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0));
  const from = useRef(shown);
  const still = reduceMotion();
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 4);
      const v = a + (value - a) * eased;
      setShown(v);
      if (k < 1) id = requestAnimationFrame(tick);
      else from.current = value;
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value, duration, still]);
  // Whole numbers while counting, the exact value at the end.
  return <>{format(still || shown === value ? value : Math.round(shown))}</>;
}

export function Card({ title, kicker, action, className = '', index = 0, children, id }: {
  title?: ReactNode;
  kicker?: ReactNode;
  action?: ReactNode;
  className?: string;
  index?: number;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className={`dcard ${className}`} style={{ '--i': index } as CSSProperties} id={id}>
      {(title || action) && (
        <header className="dcard-head">
          <div>
            {kicker && <p className="dcard-kicker">{kicker}</p>}
            {title && <h2 className="dcard-title">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ---------- Donut ---------- */

export interface Slice { key: string; label: string; value: number; sub?: string; className: string }

/** A donut of counts. Hover or focus a slice to read it; click to act on it. */
export function Donut({ slices, total, centerLabel, active, onPick }: {
  slices: Slice[];
  total: number;
  centerLabel: string;
  active?: string;
  onPick?: (key: string) => void;
}) {
  const grown = useGrown();
  const [hover, setHover] = useState<string | null>(null);
  const r = 70;
  const C = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 4 : 0;
  const lens = slices.map((s) => (total ? (s.value / total) * C : 0));
  const arcs = slices.map((s, i) => ({
    ...s,
    len: Math.max(0, lens[i] - gap),
    offset: lens.slice(0, i).reduce((a, b) => a + b, 0),
  }));
  const focus = slices.find((s) => s.key === (hover ?? active)) ?? null;
  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" className="donut-svg" role="img" aria-label={slices.map((s) => `${s.label}: ${s.value}`).join('; ')}>
        <circle cx="90" cy="90" r={r} className="donut-track" />
        {arcs.map((a, i) => (
          <circle
            key={a.key}
            cx="90"
            cy="90"
            r={r}
            className={`donut-arc ${a.className}${focus && focus.key !== a.key ? ' is-dim' : ''}`}
            strokeDasharray={`${grown ? a.len : 0} ${C}`}
            strokeDashoffset={-a.offset}
            style={{ transitionDelay: `${120 + i * 90}ms` }}
            onMouseEnter={() => setHover(a.key)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onPick?.(a.key)}
          />
        ))}
      </svg>
      <div className="donut-center" aria-hidden="true">
        <span className="donut-value num">{focus ? focus.value : total}</span>
        <span className="donut-label">{focus ? focus.label : centerLabel}</span>
        {focus?.sub && <span className="donut-sub">{focus.sub}</span>}
      </div>
      <ul className="donut-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              className={`legend-item${active === s.key ? ' is-active' : ''}`}
              aria-pressed={active === s.key}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.key)}
              onBlur={() => setHover(null)}
              onClick={() => onPick?.(s.key)}
            >
              <span className={`legend-sw ${s.className}`} aria-hidden="true" />
              <span className="legend-label">{s.label}</span>
              <span className="legend-value num">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Ring (a single share) ---------- */

export function Ring({ share, className = '' }: { share: number; className?: string }) {
  const grown = useGrown();
  const r = 22;
  const C = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className={`ring ${className}`} aria-hidden="true">
      <circle cx="28" cy="28" r={r} className="ring-track" />
      <circle cx="28" cy="28" r={r} className="ring-fill" strokeDasharray={`${grown ? Math.min(1, share) * C : 0} ${C}`} />
      <text x="28" y="28" className="ring-text">{Math.round(share * 100)}%</text>
    </svg>
  );
}

/* ---------- Horizontal bar list ---------- */

export interface BarItem { key: string; label: string; value: number; to?: string; className?: string; meta?: string }

export function BarList({ items, format = php }: { items: BarItem[]; format?: (n: number) => string }) {
  const grown = useGrown();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="barlist">
      {items.map((it, i) => {
        const body = (
          <>
            <span className="barlist-label">{it.label}</span>
            <span className="barlist-value num">{format(it.value)}</span>
            <span className="barlist-track" aria-hidden="true">
              <span className={`barlist-fill ${it.className ?? ''}`} style={{ width: grown ? `${(it.value / max) * 100}%` : 0, transitionDelay: `${i * 60}ms` }} />
            </span>
            {it.meta && <span className="barlist-meta">{it.meta}</span>}
          </>
        );
        return <li key={it.key}>{it.to ? <Link to={it.to} className="barlist-row">{body}</Link> : <div className="barlist-row">{body}</div>}</li>;
      })}
    </ol>
  );
}

/* ---------- Area chart (years) ---------- */

export interface Point { x: string; y: number; sub?: string }

export function AreaChart({ points, format = php, height = 170 }: { points: Point[]; format?: (n: number) => string; height?: number }) {
  const grown = useGrown();
  const [hover, setHover] = useState<number | null>(null);
  const W = 520;
  const H = height;
  const pad = { t: 18, r: 14, b: 26, l: 14 };
  const max = Math.max(1, ...points.map((p) => p.y)) * 1.12;
  const xs = (i: number) => pad.l + (points.length > 1 ? (i / (points.length - 1)) * (W - pad.l - pad.r) : (W - pad.l - pad.r) / 2);
  const ys = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const { line, area } = useMemo(() => {
    if (!points.length) return { line: '', area: '' };
    // A gentle monotone-ish curve through the points.
    let d = `M ${xs(0)} ${ys(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      const x0 = xs(i - 1), y0 = ys(points[i - 1].y), x1 = xs(i), y1 = ys(points[i].y);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    const base = H - pad.b;
    return { line: d, area: `${d} L ${xs(points.length - 1)} ${base} L ${xs(0)} ${base} Z` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, max, H]);
  const h = hover != null ? points[hover] : null;
  return (
    <div className="area">
      <svg viewBox={`0 0 ${W} ${H}`} className={`area-svg${grown ? ' is-grown' : ''}`} role="img" aria-label={points.map((p) => `${p.x}: ${format(p.y)}`).join('; ')}>
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6a8d5f" stopOpacity="0.38" />
            <stop offset="1" stopColor="#6a8d5f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="area-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8fb383" />
            <stop offset="0.7" stopColor="#54734e" />
            <stop offset="1" stopColor="#e8962a" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + g * (H - pad.t - pad.b)} y2={pad.t + g * (H - pad.t - pad.b)} className="area-grid" />
        ))}
        <path d={area} fill="url(#area-fill)" className="area-fill" />
        <path d={line} fill="none" stroke="url(#area-line)" className="area-line" pathLength={1} />
        {points.map((p, i) => (
          <g key={p.x}>
            <text x={xs(i)} y={H - 6} className="area-x">{p.x}</text>
            {hover === i && <line x1={xs(i)} x2={xs(i)} y1={pad.t} y2={H - pad.b} className="area-guide" />}
            <circle cx={xs(i)} cy={ys(p.y)} r={hover === i ? 6 : 4} className={`area-dot${hover === i ? ' is-on' : ''}`} />
            <rect
              x={xs(i) - (W - pad.l - pad.r) / Math.max(1, points.length - 1) / 2}
              y={0}
              width={(W - pad.l - pad.r) / Math.max(1, points.length - 1)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      <div className="area-readout" aria-live="polite">
        {h ? (
          <><span className="num">{format(h.y)}</span> in {h.x}{h.sub && <span className="muted"> · {h.sub}</span>}</>
        ) : (
          <span className="muted">Hover a year to read it</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Icons for the sidebar ---------- */

const paths: Record<string, ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  projects: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  offices: <><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></>,
  history: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  about: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  external: <><path d="M7 17 17 7M8 7h9v9" /></>,
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
