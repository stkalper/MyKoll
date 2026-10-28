"use client";

import { useEffect, useRef } from "react";

/**
 * A pen in the page margin that signs its way down as you scroll: it eases after the
 * scroll position and leaves an ink line behind, finishing with a flourish at the bottom.
 * Wide screens only (it lives in the side gutter); hidden for reduced motion.
 */

const W = 120;

/** A signature-like stroke down a margin of height h: a wandering line with a few loops. */
function signaturePath(h: number): string {
  const pts: string[] = [`M 60 0`];
  for (let y = 25; y <= h - 80; y += 25) {
    const x = 60 + Math.sin(y / 70) * 26 + Math.sin(y / 23) * 7;
    pts.push(`L ${x.toFixed(1)} ${y}`);
    // A small loop every so often, like letters in a signature.
    if (y % 225 === 0) pts.push(`q 18 -14 6 -26 q -14 8 0 24`);
  }
  // Final flourish: a long underline swoosh.
  pts.push(`C 40 ${h - 40}, 110 ${h - 30}, 20 ${h - 8}`);
  return pts.join(" ");
}

export function ScrollPen() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const penRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const el = pathRef.current;
    const pen = penRef.current;
    const wrap = wrapRef.current;
    if (!svg || !el || !pen || !wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wrap.style.display = "none";
      return;
    }

    // The path is drawn at the margin's real pixel height, so dash lengths match what's on screen.
    let length = 0;
    const layout = () => {
      const h = wrap.clientHeight || 600;
      svg.setAttribute("viewBox", `0 0 ${W} ${h}`);
      el.setAttribute("d", signaturePath(h));
      length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
    };
    layout();
    window.addEventListener("resize", layout);

    let shown = 0;
    let frame = 0;
    const target = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const tick = () => {
      // Ease towards the scroll position so the pen glides instead of jumping.
      shown += (target() - shown) * 0.12;
      const drawn = length * shown;
      el.style.strokeDashoffset = `${length - drawn}`;

      const p = el.getPointAtLength(Math.max(drawn, 0.01));
      const ahead = el.getPointAtLength(Math.min(drawn + 6, length));
      const lean = Math.atan2(ahead.x - p.x, ahead.y - p.y) * (180 / Math.PI);
      pen.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${28 - lean * 0.25}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", layout);
    };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none fixed top-[8vh] right-6 z-20 hidden h-[84vh] w-[120px] xl:block">
      <svg ref={svgRef} className="absolute inset-0 h-full w-full overflow-visible">
        <path ref={pathRef} fill="none" stroke="#8fb4ff" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 1" />
      </svg>
      {/* The pen's nib sits at the element's origin, so it writes exactly where the line ends. */}
      <div ref={penRef} className="absolute top-0 left-0 origin-top-left will-change-transform">
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
