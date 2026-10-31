import { Fragment, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "./theme";

/* ---------- Motion ---------- */

/** 0 → 1 on a spring from `delay` frames into the scene. */
export function useIn(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140, mass: 0.9, ...config } });
}

/** 0 → 1 between two frames, eased. */
export function useRamp(from: number, to: number, ease = Easing.inOut(Easing.cubic)) {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

/** A slow push-in for the whole scene, the way product films keep a still frame alive. */
export function Push({ children, from = 1, to = 1.06, style }: { children: ReactNode; from?: number; to?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = interpolate(frame, [0, durationInFrames], [from, to]);
  return <AbsoluteFill style={{ transform: `scale(${k})`, ...style }}>{children}</AbsoluteFill>;
}

/* ---------- Backdrop ---------- */

/** Near-black canvas with a dot grid that drifts, a soft glow and a vignette. */
export function Backdrop({ glow = C.hl, glowAt = "50% 40%", children }: { glow?: string; glowAt?: string; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const drift = frame * 0.25;
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 55% at ${glowAt}, ${glow}1f, transparent 70%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.2px, transparent 1.4px)",
          backgroundSize: "34px 34px",
          backgroundPosition: `${drift}px ${drift * 0.6}px`,
          maskImage: "radial-gradient(75% 70% at 50% 50%, #000 30%, transparent 85%)",
        }}
      />
      {children}
      <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.65))", pointerEvents: "none" }} />
      <Grain />
    </AbsoluteFill>
  );
}

function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/* ---------- Type ---------- */

/** Kinetic headline: words rise out of a blur one after another. */
export function Kinetic({
  text,
  delay = 0,
  size = 96,
  color = C.text,
  stagger = 3,
  weight = 800,
  align = "center",
  highlight = [] as string[],
  style,
}: {
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  stagger?: number;
  weight?: number;
  align?: CSSProperties["textAlign"];
  highlight?: string[];
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: F.form, fontWeight: weight, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.02em", textTransform: "uppercase", color, textAlign: align, ...style }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 16, stiffness: 160 } });
        const lit = highlight.includes(w.replace(/[.,!?]/g, ""));
        return (
          <Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 0.55}em)`,
                opacity: p,
                filter: `blur(${(1 - p) * 10}px)`,
                ...(lit ? { color: C.ink, background: `linear-gradient(transparent 8%, ${C.hl} 8% 92%, transparent 92%)`, padding: "0 0.12em" } : null),
              }}
            >
              {w}
            </span>
            {i < words.length - 1 ? " " : ""}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Small mono label, like the site's form captions. */
export function Label({ children, color = C.muted, size = 22, style }: { children: ReactNode; color?: string; size?: number; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: F.mono, fontSize: size, letterSpacing: "0.18em", textTransform: "uppercase", color, ...style }}>{children}</div>
  );
}

/** Fades and lifts its children in at `delay`. */
export function Rise({ delay = 0, y = 30, children, style }: { delay?: number; y?: number; children: ReactNode; style?: CSSProperties }) {
  const p = useIn(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
}

/* ---------- Paper ---------- */

export function Paper({ children, style, tilt = 0 }: { children: ReactNode; style?: CSSProperties; tilt?: number }) {
  return (
    <div
      style={{
        background: `radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.5), transparent 60%), ${C.paper}`,
        color: C.ink,
        border: `3px solid ${C.outline}`,
        boxShadow: "8px 10px 0 rgba(0,0,0,0.45), 0 30px 80px rgba(0,0,0,0.5)",
        borderRadius: 4,
        transform: `rotate(${tilt}deg)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Masking tape across a corner. */
export function Tape({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 150,
        height: 40,
        background: "rgba(232,222,196,0.7)",
        borderLeft: "3px dashed rgba(0,0,0,0.08)",
        borderRight: "3px dashed rgba(0,0,0,0.08)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        ...style,
      }}
    />
  );
}

/** Highlighter stroke that sweeps across its text. */
export function Hl({ children, at, color = C.hl }: { children: ReactNode; at: number; color?: string }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 12], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundSize: `${p}% 84%`,
        backgroundPosition: "0 55%",
        backgroundRepeat: "no-repeat",
        padding: "0 0.1em",
      }}
    >
      {children}
    </span>
  );
}

/** A rubber stamp that slams down at `at`. */
export function Stamp({ text, color, at, size = 64, rotate = -8, style }: { text: string; color: string; at: number; size?: number; rotate?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 260, mass: 0.6 } });
  if (frame < at) return null;
  return (
    <div
      style={{
        display: "inline-block",
        border: `6px double ${color}`,
        borderRadius: 8,
        padding: "0.12em 0.5em",
        fontFamily: F.form,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "0.06em",
        color,
        textTransform: "uppercase",
        transform: `rotate(${rotate}deg) scale(${interpolate(p, [0, 1], [2.4, 1])})`,
        opacity: interpolate(p, [0, 0.3], [0, 0.92], { extrapolateRight: "clamp" }),
        mixBlendMode: "multiply",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/* ---------- Telegram ---------- */

/** A phone with a screen, floating in the scene. */
export function Phone({ children, width = 520, height = 1060, style }: { children: ReactNode; width?: number; height?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 64,
        padding: 14,
        background: "linear-gradient(145deg, #2a2f3a, #0c0e13)",
        boxShadow: "0 50px 120px rgba(0,0,0,0.7), inset 0 0 0 2px rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 52, overflow: "hidden", background: C.tgBg }}>
        {children}
        <div style={{ position: "absolute", top: 14, left: "50%", width: 130, height: 34, marginLeft: -65, borderRadius: 20, background: "#000" }} />
      </div>
    </div>
  );
}

export function ChatHeader({ title = "Degen Club", sub = "12 members" }: { title?: string; sub?: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 128, paddingTop: 62, background: "#17212b", display: "flex", alignItems: "center", gap: 16, paddingLeft: 26, zIndex: 2 }}>
      <div style={{ color: C.tgLink, fontSize: 34, fontFamily: F.sans }}>‹</div>
      <div style={{ width: 52, height: 52, borderRadius: 26, background: "linear-gradient(135deg,#8fe3a6,#3d8b5d)", display: "grid", placeItems: "center", fontFamily: F.form, fontWeight: 800, color: C.ink, fontSize: 22 }}>DC</div>
      <div>
        <div style={{ color: C.tgText, fontFamily: F.sans, fontWeight: 700, fontSize: 24 }}>{title}</div>
        <div style={{ color: C.tgMeta, fontFamily: F.sans, fontSize: 18 }}>{sub}</div>
      </div>
    </div>
  );
}

export type Msg = {
  at: number;
  from: string;
  color?: string;
  text: ReactNode;
  bot?: boolean;
  out?: boolean;
  buttons?: string[][];
  /** Frame a button is tapped, and which one ("row,col"). */
  tap?: { at: number; button: string };
  forwarded?: string;
};

/** The chat's message list, bottom-aligned; each message grows in so older ones slide up. */
export function Chat({ messages, bottom = 30 }: { messages: Msg[]; bottom?: number }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 128, bottom, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 18px", gap: 0, overflow: "hidden" }}>
      {messages.map((m, i) => (
        <Bubble key={i} {...m} />
      ))}
    </div>
  );
}

function Bubble({ at, from, color = "#e0a96d", text, bot, out, buttons, tap, forwarded }: Msg) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 170 } });
  if (frame < at) return null;
  return (
    <div style={{ display: "grid", gridTemplateRows: `${Math.min(1, p * 1.15)}fr` }}>
      <div style={{ minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", padding: "7px 0", transform: `scale(${0.9 + 0.1 * p})`, transformOrigin: out ? "right bottom" : "left bottom", opacity: p }}>
          {!out && (
            <div style={{ width: 44, height: 44, borderRadius: 22, background: bot ? C.hl : color, alignSelf: "flex-end", marginRight: 10, display: "grid", placeItems: "center", fontFamily: F.form, fontWeight: 800, fontSize: 18, color: C.ink, flexShrink: 0 }}>
              {bot ? "🧾" : from.replace("@", "")[0].toUpperCase()}
            </div>
          )}
          <div style={{ maxWidth: "82%" }}>
            <div style={{ background: out ? C.tgOut : C.tgIn, borderRadius: 20, borderBottomLeftRadius: out ? 20 : 6, borderBottomRightRadius: out ? 6 : 20, padding: "12px 18px 14px", color: C.tgText, fontFamily: F.sans, fontSize: 25, lineHeight: 1.36 }}>
              {!out && <div style={{ color: bot ? C.hl : color, fontWeight: 700, fontSize: 21, marginBottom: 3 }}>{from}</div>}
              {forwarded && <div style={{ color: C.tgLink, fontSize: 19, marginBottom: 4, borderLeft: `3px solid ${C.tgLink}`, paddingLeft: 10 }}>Forwarded from {forwarded}</div>}
              <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
            </div>
            {buttons?.map((row, r) => (
              <div key={r} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {row.map((b) => {
                  const tapped = tap && tap.button === b && frame >= tap.at;
                  const pulse = tap && tap.button === b ? interpolate(frame, [tap.at, tap.at + 8, tap.at + 16], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
                  return (
                    <div
                      key={b}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        background: tapped ? "rgba(143,227,166,0.28)" : C.tgButton,
                        borderRadius: 12,
                        padding: "12px 10px",
                        color: C.tgText,
                        fontFamily: F.sans,
                        fontWeight: 600,
                        fontSize: 21,
                        transform: `scale(${pulse})`,
                      }}
                    >
                      {b}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A finger tap: a ring that blooms where the screen is touched. */
export function Tap({ at, x, y }: { at: number; x: number; y: number }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -8 || t > 22) return null;
  const approach = interpolate(t, [-8, 0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bloom = interpolate(t, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 20 }}>
      <div style={{ position: "absolute", width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: 35, background: "rgba(255,255,255,0.35)", opacity: approach * (1 - bloom), transform: `scale(${0.6 + 0.4 * approach})` }} />
      <div style={{ position: "absolute", width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: 35, border: "3px solid rgba(255,255,255,0.8)", opacity: 1 - bloom, transform: `scale(${1 + bloom * 1.4})` }} />
    </div>
  );
}

/* ---------- Annotation ---------- */

/** A pill label with a line drawn to a point, like a spec callout. */
export function Callout({
  at,
  until = Infinity,
  text,
  from,
  to,
  anchor = "center",
  color = C.hl,
}: {
  at: number;
  until?: number;
  text: string;
  from: [number, number];
  to: [number, number];
  /** "left": the pill starts at `from` and grows rightward, for labels in a margin. */
  anchor?: "center" | "left";
  color?: string;
}) {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const pill = useIn(at + 8);
  const gone = Number.isFinite(until) ? interpolate(frame, [until, until + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  if (frame < at || gone === 0) return null;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", opacity: gone }} width="100%" height="100%">
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeWidth={3} strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
        <circle cx={to[0]} cy={to[1]} r={9 * draw} fill={color} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: from[0],
          top: from[1],
          transform: `translate(${anchor === "left" ? "0" : "-50%"}, -50%) scale(${0.85 + 0.15 * pill})`,
          transformOrigin: anchor === "left" ? "left center" : "center",
          opacity: pill * gone,
          background: C.bg,
          border: `2px solid ${color}`,
          color: C.text,
          borderRadius: 999,
          padding: "12px 24px",
          fontFamily: F.form,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        {text}
      </div>
    </>
  );
}

/** A number that counts up to `to` between two frames. */
export function Count({ to, from = 0, start, end, decimals = 0 }: { to: number; from?: number; start: number; end: number; decimals?: number }) {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [start, end], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return <>{v.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</>;
}
