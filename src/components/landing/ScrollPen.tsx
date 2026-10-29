"use client";

import { useEffect, useRef } from "react";

/**
 * A pen that signs its way down the page as you scroll.
 *
 * The route runs through the page's own blocks: anything marked data-pen, with optional
 * data-pen-points "x,y;x,y" as fractions of that block. Points are visited top to bottom,
 * so the route weaves between blocks on any screen size. Handwriting marked data-pen-write
 * (see PenTail) is a stop: the pen pauses there and writes in the last letters, then
 * hurries to catch up with the scroll.
 *
 * The ink sits under the paper (the line layer is behind the page content) while the pen
 * rides on top. Hidden on narrow screens, where it would cover text, and for reduced motion.
 */

type Point = { x: number; y: number };
type Stop = { start: Point; end: Point; letters: HTMLElement[]; lenStart: number; lenEnd: number };

/** Scroll distance the pen spends writing at a stop, and how long it takes to catch up after. */
const DWELL = 220;
const CATCH_UP = 360;
/**
 * How the nib follows the scroll: spring stiffness (per second) and top speed (px of line per
 * second), in the open and over letters, so the endings are written, not flicked on.
 */
const FOLLOW = { glide: 6, write: 2.4 };
const TOP_SPEED = { glide: 6000, write: 560 };
/** Seconds to ease into and out of writing, and to settle the pen's lean. */
const WRITE_EASE = 0.3;
const TILT_EASE = 0.15;

/**
 * A smooth curve through the points: centripetal Catmull-Rom turned into cubic Béziers. Unlike
 * the uniform kind it doesn't loop or kink where points are unevenly spaced, so the pen
 * doesn't jerk at those spots.
 */
function smoothPath(pts: Point[]): string {
  // Squared centripetal knot spacing, i.e. the plain distance between the points.
  const gap = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const control = (from: Point, at: Point, to: Point, before: number, after: number): Point => {
    if (before < 1e-6) return at;
    const a = Math.sqrt(before);
    const b = Math.sqrt(after);
    const k = 2 * before + 3 * a * b + after;
    const den = 3 * a * (a + b);
    return { x: (before * to.x - after * from.x + k * at.x) / den, y: (before * to.y - after * from.y + k * at.y) / den };
  };
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const mid = gap(p1, p2);
    const c1 = control(p0, p1, p2, gap(p0, p1), mid);
    const c2 = control(p3, p2, p1, gap(p2, p3), mid);
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** A closing flourish after the last point: a loop and a long underline, like the end of a signature. */
function flourish(width: number): string {
  const w = Math.min(320, width * 0.3);
  // Starts level, the way the signature ends, so there's no corner where they meet.
  return ` c 40 4, 26 66, -18 50 c -30 -15, 10 -40, 50 -10 c 40 30, ${(w * 0.6).toFixed(0)} 20, ${w.toFixed(0)} -6`;
}

/** The route's points, top to bottom, and the writing stops along it, relative to the overlay. */
function route(root: HTMLElement): { pts: Point[]; stops: Omit<Stop, "lenStart" | "lenEnd">[] } {
  const base = root.getBoundingClientRect();
  const rel = (x: number, y: number): Point => ({ x: x - base.left, y: y - base.top });
  const pts: (Point & { order: number; wrote?: boolean })[] = [];
  const stops: Omit<Stop, "lenStart" | "lenEnd">[] = [];

  document.querySelectorAll<HTMLElement>("[data-pen]").forEach((el) => {
    if (el.dataset.penWrite !== undefined) {
      // Write along the baseline of the last letters, left to right.
      const rects = el.getClientRects();
      if (!rects.length) return;
      const first = rects[0];
      const last = rects[rects.length - 1];
      const start = rel(first.left, first.top + first.height * 0.78);
      const end = rel(last.right, last.top + last.height * 0.78);
      pts.push({ ...start, order: pts.length }, { ...end, y: start.y + 0.01, order: pts.length + 1, wrote: true });
      stops.push({ start, end, letters: [...el.querySelectorAll<HTMLElement>("[data-pen-letter]")] });
      return;
    }
    const r = el.getBoundingClientRect();
    for (const [fx, fy] of (el.dataset.penPoints ?? "0.5,0.5").split(";").map((s) => s.split(",").map(Number))) {
      pts.push({ ...rel(r.left + r.width * fx, r.top + r.height * fy), order: pts.length });
    }
  });

  pts.sort((a, b) => a.y - b.y || a.order - b.order);
  stops.sort((a, b) => a.start.y - b.start.y);
  // After writing, the nib trails off down and to the right before heading on, so it turns in
  // a curve instead of snapping back over the letters it just wrote.
  const out: Point[] = [];
  pts.forEach((p, i) => {
    out.push(p);
    const next = pts[i + 1];
    if (p.wrote && next) out.push({ x: p.x + 14, y: p.y + Math.min(34, (next.y - p.y) / 2) });
  });
  return { pts: out, stops };
}

const PEN = (
  <svg width="34" height="120" viewBox="0 0 34 120" className="absolute -top-[118px] -left-[17px] drop-shadow-[3px_4px_0_rgba(0,0,0,0.45)]">
    {/* end cap */}
    <rect x="10" y="2" width="14" height="12" rx="4" fill="#1d2433" stroke="#151515" strokeWidth="2" />
    {/* barrel with a highlight, cap band and clip */}
    <rect x="8" y="10" width="18" height="72" rx="5" fill="#1d2433" stroke="#151515" strokeWidth="2" />
    <rect x="11" y="16" width="4" height="56" rx="2" fill="#ffffff" opacity="0.18" />
    <rect x="8" y="30" width="18" height="5" fill="#d9b25c" stroke="#151515" strokeWidth="1.5" />
    <path d="M25 14 Q29 14 29 18 L29 50 L25 50" fill="none" stroke="#d9b25c" strokeWidth="3" strokeLinecap="round" />
    {/* grip */}
    <rect x="9" y="80" width="16" height="16" rx="2" fill="#2b3550" stroke="#151515" strokeWidth="2" />
    {/* nib, tip at (17, 118) */}
    <path d="M10 96 L24 96 L17 118 Z" fill="#d9b25c" stroke="#151515" strokeWidth="2" strokeLinejoin="round" />
    <path d="M17 100 L17 112" stroke="#151515" strokeWidth="1.5" />
  </svg>
);

export function ScrollPen() {
  const inkRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const penLayerRef = useRef<HTMLDivElement>(null);
  const penRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ink = inkRef.current;
    const svg = svgRef.current;
    const el = pathRef.current;
    const penLayer = penLayerRef.current;
    const pen = penRef.current;
    if (!ink || !svg || !el || !penLayer || !pen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ink.style.display = penLayer.style.display = "none";
      return;
    }

    let length = 0;
    let stops: Stop[] = [];
    /**
     * Path length at sampled points, to find how much to draw for a given scroll depth. ym is the
     * lowest the path has reached so far, which only grows, so it can be searched and interpolated.
     */
    let table: { len: number; x: number; y: number; ym: number }[] = [];

    const layout = () => {
      if (getComputedStyle(ink).display === "none") return;
      const height = ink.parentElement?.scrollHeight ?? document.documentElement.scrollHeight;
      ink.style.height = penLayer.style.height = `${height}px`;
      svg.setAttribute("viewBox", `0 0 ${ink.clientWidth} ${height}`);
      const r = route(ink);
      if (r.pts.length < 2) return;
      el.setAttribute("d", smoothPath(r.pts) + flourish(ink.clientWidth));
      length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
      // About one sample every 4px of line, so the target moves in small steps.
      const samples = Math.max(1200, Math.ceil(length / 4));
      let ym = -Infinity;
      table = Array.from({ length: samples + 1 }, (_, i) => {
        const len = (length * i) / samples;
        const p = el.getPointAtLength(len);
        ym = Math.max(ym, p.y);
        return { len, x: p.x, y: p.y, ym };
      });
      // Where each stop's start and end fall on the path, walking forward along it.
      let from = 0;
      const nearest = (p: Point) => {
        let best = from;
        for (let i = from; i < table.length; i++) {
          const d = Math.hypot(table[i].x - p.x, table[i].y - p.y);
          if (d < Math.hypot(table[best].x - p.x, table[best].y - p.y)) best = i;
          if (table[i].y > p.y + 200) break;
        }
        from = best;
        return table[best].len;
      };
      stops = r.stops.map((s) => {
        const lenStart = nearest(s.start);
        const lenEnd = Math.max(lenStart + 1, nearest(s.end));
        return { ...s, lenStart, lenEnd };
      });
      for (const s of stops) for (const l of s.letters) l.style.opacity = "0";
    };
    layout();
    // Fonts, images and the Mini App iframe shift the layout after load, so re-measure when it changes.
    const resize = new ResizeObserver(layout);
    resize.observe(document.body);

    /** How much line to show for the current scroll position, with a pause at each stop. */
    const target = () => {
      const top = ink.getBoundingClientRect().top + window.scrollY;
      // The nib rides at 55% of the screen, sliding to the bottom edge over the last screen of
      // scroll, so the signature on the closing button is reachable.
      const left = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      const at = 0.55 + 0.45 * Math.max(0, 1 - left / window.innerHeight);
      const tipY = left <= 2 ? Infinity : window.scrollY + window.innerHeight * at - top;
      let lag = 0;
      let floor = 0;
      for (const s of stops) {
        if (tipY < s.start.y) break;
        const into = tipY - s.start.y;
        // Writing: the pen moves across the letters while the page scrolls past.
        if (into < DWELL) return s.lenStart + (s.lenEnd - s.lenStart) * (into / DWELL);
        // Done: it lags a little behind, then catches up.
        lag = DWELL * Math.max(0, 1 - (into - DWELL) / CATCH_UP);
        floor = s.lenEnd;
      }
      const y = tipY - lag;
      if (!Number.isFinite(y)) return length;
      // First sample past the floor whose depth reaches y, then interpolate between it and the one before.
      let hi = table.length - 1;
      let lo = Math.min(hi, Math.ceil((floor / length) * hi));
      if (table[hi].ym < y) return length;
      if (table[lo].ym >= y) return table[lo].len;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (table[mid].ym >= y) hi = mid;
        else lo = mid;
      }
      const a = table[lo];
      const b = table[hi];
      return a.len + (b.len - a.len) * ((y - a.ym) / (b.ym - a.ym));
    };

    let shown = 0;
    let vel = 0;
    let writing = 0;
    let tilt = 24;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      // Seconds since the last frame, so the motion is the same at 60 and 120 Hz; capped so a
      // tab coming back from the background doesn't fling the pen.
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (length) {
        // Slow down a little before a stop and speed up gently after it, instead of braking.
        const atStop = stops.some((s) => shown > s.lenStart - 40 && shown < s.lenEnd + 10);
        writing += (Number(atStop) - writing) * (1 - Math.exp(-dt / WRITE_EASE));
        const omega = FOLLOW.glide + (FOLLOW.write - FOLLOW.glide) * writing;
        const top = TOP_SPEED.glide + (TOP_SPEED.write - TOP_SPEED.glide) * writing;

        // A critically damped spring towards the scroll target: it starts and stops smoothly
        // and never overshoots, even when a wheel notch moves the target in one jump.
        const goal = target();
        const off = shown - goal;
        const decay = Math.exp(-omega * dt);
        const pull = vel + omega * off;
        let step = goal + (off + pull * dt) * decay - shown;
        vel = (vel - omega * pull * dt) * decay;
        if (Math.abs(step) > top * dt) {
          step = Math.sign(step) * top * dt;
          vel = step / dt;
        }
        shown = Math.min(length, Math.max(0, shown + step));

        el.style.strokeDashoffset = `${length - shown}`;
        const p = el.getPointAtLength(Math.max(shown, 0.01));
        const ahead = el.getPointAtLength(Math.min(shown + 24, length));
        // Lean with the stroke's sideways direction. Up and down strokes lean the same way, so
        // the pen never flips over on the loops, and the lean itself settles smoothly.
        const lean = Math.atan2(ahead.x - p.x, Math.abs(ahead.y - p.y)) * (180 / Math.PI);
        tilt += (24 - lean * 0.2 - tilt) * (1 - Math.exp(-dt / TILT_EASE));
        pen.style.opacity = shown > 2 ? "1" : "0";
        pen.style.transform = `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${tilt.toFixed(2)}deg)`;
        // Letters appear as the nib passes over them.
        for (const s of stops) {
          const w = Math.min(1, Math.max(0, (shown - s.lenStart) / (s.lenEnd - s.lenStart)));
          s.letters.forEach((l, i) => {
            l.style.opacity = String(Math.min(1, Math.max(0, w * s.letters.length - i)));
          });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      for (const s of stops) for (const l of s.letters) l.style.opacity = "";
    };
  }, []);

  return (
    <>
      {/* Ink: behind the page content, so it passes under the paper. */}
      <div ref={inkRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden md:block">
        <svg ref={svgRef} className="absolute inset-0 h-full w-full overflow-visible">
          <path ref={pathRef} fill="none" stroke="#7ea6ff" strokeOpacity="0.85" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 1" />
        </svg>
      </div>
      {/* Pen: on top of everything. Its nib sits at the moving element's origin. */}
      <div ref={penLayerRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden md:block">
        <div ref={penRef} className="absolute top-0 left-0 origin-top-left opacity-0 transition-opacity will-change-transform">
          {PEN}
        </div>
      </div>
    </>
  );
}
