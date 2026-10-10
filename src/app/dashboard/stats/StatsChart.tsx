import { bn } from "@/i18n/bn";
import { bucketLabel, type Point, type StatsBucket } from "@/lib/stats";

const W = 600;
const H = 140;
const GAP = 2;

/** দিন/মাসভিত্তিক বার-চার্ট — সরল inline SVG (নতুন লাইব্রেরি নেই); বার-রং `--accent` token (সব থিমে); প্রতিটা বারে aria-label */
export function StatsChart({ points, bucket }: { points: readonly Point[]; bucket: StatsBucket }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.n));
  const bw = W / points.length;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const mid = points[Math.floor(points.length / 2)]!;
  const label = (p: Point) => bucketLabel(p.k, bucket);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={bn.stats.chartLabel} className="h-40 w-full" preserveAspectRatio="none">
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} className="stroke-line" strokeWidth="1" />
        {points.map((p, i) => {
          const h = p.n === 0 ? 0 : Math.max(2, (p.n / max) * (H - 6));
          return (
            <rect key={p.k} x={i * bw + GAP / 2} y={H - h} width={Math.max(1, bw - GAP)} height={h} rx={Math.min(3, bw / 4)} className="fill-accent" role="img" aria-label={bn.stats.barLabel(label(p), p.n)}>
              <title>{bn.stats.barLabel(label(p), p.n)}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{label(first)}</span>
        {points.length > 2 && <span>{label(mid)}</span>}
        {points.length > 1 && <span>{label(last)}</span>}
      </figcaption>
    </figure>
  );
}
