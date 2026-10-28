"use client";

import { useEffect, useRef } from "react";

/**
 * A pen that signs its way down the page as you scroll. The ink line runs through the
 * page's own blocks (anything marked data-pen="<order>", with optional data-pen-points
 * "x,y;x,y" as fractions of that block), so the route weaves between them on any screen.
 * The pen stays near the middle of the viewport and draws up to there, easing as it goes.
 * Hidden on narrow screens (it would cover text) and for reduced motion.
 */

type Point = { x: number; y: number };

/** A smooth curve through the points (Catmull-Rom turned into cubic Béziers). */
function smoothPath(pts: Point[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/** The route: the marked blocks in order, measured relative to the overlay. */
function waypoints(root: HTMLElement): Point[] {
  const base = root.getBoundingClientRect();
  const blocks = [...document.querySelectorAll<HTMLElement>("[data-pen]")].sort((a, b) => Number(a.dataset.pen) - Number(b.dataset.pen));
  const pts: Point[] = [];
  for (const el of blocks) {
    const r = el.getBoundingClientRect();
    const spots = (el.dataset.penPoints ?? "0.5,0.5").split(";").map((s) => s.split(",").map(Number));
    for (const [fx, fy] of spots) pts.push({ x: r.left - base.left + r.width * fx, y: r.top - base.top + r.height * fy });
  }
  return pts;
}

/** A closing flourish after the last point: a loop and a long underline, like the end of a signature. */
function flourish(width: number): string {
  const w = Math.min(320, width * 0.3);
  return ` c 40 30, 20 70, -20 50 c -30 -15, 10 -40, 50 -10 c 40 30, ${(w * 0.6).toFixed(0)} 20, ${w.toFixed(0)} -6`;
}

export function ScrollPen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const penRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const el = pathRef.current;
    const pen = penRef.current;
    if (!root || !svg || !el || !pen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.style.display = "none";
      return;
    }

    let length = 0;
    /** Path length at sampled heights, to find how much to draw for a given scroll depth. */
    let table: { len: number; y: number }[] = [];

    const layout = () => {
      if (getComputedStyle(root).display === "none") return;
      const height = root.parentElement?.scrollHeight ?? document.documentElement.scrollHeight;
      root.style.height = `${height}px`;
      svg.setAttribute("viewBox", `0 0 ${root.clientWidth} ${height}`);
      const pts = waypoints(root);
      if (pts.length < 2) return;
      el.setAttribute("d", smoothPath(pts) + flourish(root.clientWidth));
      length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
      table = Array.from({ length: 401 }, (_, i) => {
        const len = (length * i) / 400;
        return { len, y: el.getPointAtLength(len).y };
      });
    };
    layout();
    // Fonts, images and the Mini App iframe shift the layout after load, so re-measure when it changes.
    const resize = new ResizeObserver(layout);
    resize.observe(document.body);

    /** How much line to show: up to the first point on the route below the middle of the screen. */
    const target = () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const tipY = window.scrollY + window.innerHeight * 0.55 - top;
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) return length;
      const hit = table.find((t) => t.y >= tipY);
      return hit ? hit.len : length;
    };

    let shown = 0;
    let frame = 0;
    const tick = () => {
      if (length) {
        // Ease after the scroll position so the pen glides instead of jumping.
        shown += (target() - shown) * 0.1;
        el.style.strokeDashoffset = `${length - shown}`;
        const p = el.getPointAtLength(Math.max(shown, 0.01));
        const ahead = el.getPointAtLength(Math.min(shown + 8, length));
        const lean = Math.atan2(ahead.x - p.x, ahead.y - p.y) * (180 / Math.PI);
        pen.style.opacity = shown > 2 ? "1" : "0";
        pen.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${24 - lean * 0.2}deg)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden md:block">
      <svg ref={svgRef} className="absolute inset-0 h-full w-full overflow-visible">
        <path ref={pathRef} fill="none" stroke="#7ea6ff" strokeOpacity="0.85" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 1" />
      </svg>
      {/* The nib sits at this element's origin, so it writes exactly where the line ends. */}
      <div ref={penRef} className="absolute top-0 left-0 origin-top-left opacity-0 transition-opacity will-change-transform">
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
      </div>
    </div>
  );
}
