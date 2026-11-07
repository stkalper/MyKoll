/**
 * Keyframes for a pen writing along a path: where the nib is, and how much of the stroke is
 * drawn, at even steps in time. Both come from the same samples, so the nib stays on the end of
 * the ink. CSS animations start with the first paint; SVG's own animations wait for the page's
 * load event, which on a streamed page can come after the opening is over.
 */

type Pt = { x: number; y: number };

/** The points of an absolute path made of one M and any number of C segments. */
export function cubicsOf(d: string): Pt[][] {
  const nums = d.match(/-?\d*\.?\d+/g)!.map(Number);
  const start = { x: nums[0], y: nums[1] };
  const curves: Pt[][] = [];
  let at = start;
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const c = [at, { x: nums[i], y: nums[i + 1] }, { x: nums[i + 2], y: nums[i + 3] }, { x: nums[i + 4], y: nums[i + 5] }];
    curves.push(c);
    at = c[3];
  }
  return curves;
}

const bezier = ([a, b, c, d]: Pt[], t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/** Points along the path with the distance to each, finely enough to read positions from. */
function walk(d: string): { pts: Pt[]; dist: number[] } {
  const pts: Pt[] = [];
  const dist: number[] = [];
  let total = 0;
  for (const curve of cubicsOf(d))
    for (let i = pts.length ? 1 : 0; i <= 40; i++) {
      const p = bezier(curve, i / 40);
      if (pts.length) total += Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y);
      pts.push(p);
      dist.push(total);
    }
  return { pts, dist };
}

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of time. */
export function easing(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (p1: number, p2: number, s: number) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  return (t) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** Two @keyframes: `${name}-nib` moves along the path, `${name}-ink` draws it (on a pathLength of 1). */
export function writingKeyframes(d: string, name: string, ease: (t: number) => number, steps = 90): string {
  const { pts, dist } = walk(d);
  const total = dist[dist.length - 1];
  const nib: string[] = [];
  const ink: string[] = [];
  let j = 0;
  for (let i = 0; i <= steps; i++) {
    const want = ease(i / steps) * total;
    while (j < dist.length - 2 && dist[j + 1] < want) j++;
    const span = dist[j + 1] - dist[j] || 1;
    const f = Math.min(1, Math.max(0, (want - dist[j]) / span));
    const x = pts[j].x + (pts[j + 1].x - pts[j].x) * f;
    const y = pts[j].y + (pts[j + 1].y - pts[j].y) * f;
    const pct = `${+((i / steps) * 100).toFixed(2)}%`;
    nib.push(`${pct}{transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px)}`);
    ink.push(`${pct}{stroke-dashoffset:${(1 - want / total).toFixed(4)}}`);
  }
  return `@keyframes ${name}-nib{${nib.join("")}}@keyframes ${name}-ink{${ink.join("")}}`;
}
