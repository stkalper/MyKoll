import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F, s } from "../theme";
import { Backdrop, Chat, ChatHeader, Kinetic, Label, Paper, Phone, Push, Rise, Stamp, Tape, useIn } from "../ui";

/** 0 · Cold open: the fight every group chat has. */
export function ColdOpen() {
  const frame = useCurrentFrame();
  const later = interpolate(frame, [s(2.1), s(2.4), s(3.1), s(3.4)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const crack = frame > s(5.6) ? Math.sin(frame * 2.3) * interpolate(frame, [s(5.6), s(6.3)], [6, 0], { extrapolateRight: "clamp" }) : 0;
  const phoneOut = interpolate(frame, [s(6.2), s(6.8)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop glow={C.hlPink} glowAt="50% 45%">
      <Push>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: phoneOut, transform: `translateX(${crack}px)` }}>
          <Phone width={500} height={760}>
            <ChatHeader />
            <Chat
              messages={[
                { at: s(0.3), from: "Ivan", color: "#e0a96d", text: "SOL to 300 by Friday 🚀" },
                { at: s(3.4), from: "Max", color: "#7cc4f5", text: "so… SOL?" },
                { at: s(4.6), from: "Ivan", color: "#e0a96d", text: "I never said that." },
              ]}
            />
          </Phone>
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: later }}>
          <div style={{ fontFamily: F.hand, fontWeight: 700, fontSize: 96, color: C.text, transform: "rotate(-4deg)" }}>three days later…</div>
        </AbsoluteFill>
        {frame > s(6.4) && (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <Kinetic text="Every group chat has this fight." delay={s(6.4)} size={118} style={{ maxWidth: 1500 }} />
          </AbsoluteFill>
        )}
      </Push>
    </Backdrop>
  );
}

const NOISE = [
  { t: "ETH 5k EOM, trust me", x: 12, y: 18, r: -4 },
  { t: "+1,000% THIS MONTH 🔥", x: 64, y: 14, r: 3, brag: true },
  { t: "NaVi easy tonight", x: 70, y: 64, r: -2 },
  { t: "TP3 HIT ✅ (+64%)", x: 8, y: 66, r: 2, brag: true },
  { t: "sui 2x incoming", x: 40, y: 82, r: 4 },
  { t: "who said btc would dump??", x: 38, y: 8, r: -1 },
  { t: "SNIPED THE BOTTOM AGAIN 🐺", x: 72, y: 40, r: -3, brag: true },
  { t: "btc 70k by sunday", x: 4, y: 42, r: 2 },
];

/** 1 · Calls everywhere, nobody keeps score. */
export function Problem() {
  const frame = useCurrentFrame();
  const blur = interpolate(frame, [s(5.2), s(6.2)], [0, 14], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fade = interpolate(frame, [s(5.2), s(6.2)], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = (at: number) => (frame >= at ? 1 : 0);
  return (
    <Backdrop glow="#7cc4f5">
      <AbsoluteFill style={{ filter: `blur(${blur}px)`, opacity: fade }}>
        {NOISE.map((n, i) => {
          const p = useIn(i * 7);
          const drift = (frame - i * 7) * (i % 2 ? 0.35 : -0.3);
          return (
            <div
              key={n.t}
              style={{
                position: "absolute",
                left: `${n.x}%`,
                top: `${n.y}%`,
                transform: `translate(${drift}px, ${(1 - p) * 60}px) rotate(${n.r}deg) scale(${0.8 + 0.2 * p})`,
                opacity: p,
                background: n.brag ? C.paper : C.tgIn,
                color: n.brag ? C.ink : C.tgText,
                border: n.brag ? `3px solid ${C.outline}` : "none",
                borderRadius: n.brag ? 4 : 22,
                padding: "16px 26px",
                fontFamily: n.brag ? F.form : F.sans,
                fontWeight: n.brag ? 800 : 500,
                fontSize: 34,
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              {n.t}
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18, flexDirection: "column" }}>
        <div style={{ opacity: line(s(6.3)) }}>
          <Kinetic text="Deleted. Edited. Forgotten." delay={s(6.3)} size={64} color={C.muted} stagger={6} />
        </div>
        <div style={{ opacity: line(s(8.4)) }}>
          <Kinetic text="Nobody keeps score." delay={s(8.4)} size={128} highlight={["score"]} />
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
}

/** 2 · Title card: the receipt, the name, the promise. */
export function Title() {
  const frame = useCurrentFrame();
  const card = useIn(4, { damping: 14 });
  const sign = interpolate(frame, [s(1.0), s(2.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
        <div style={{ position: "relative", transform: `translateY(${(1 - card) * 120}px) rotate(${(1 - card) * -8 - 2}deg)`, opacity: card }}>
          <Tape style={{ top: -20, left: "50%", marginLeft: -75, transform: "rotate(3deg)", zIndex: 2 }} />
          <Paper style={{ padding: "40px 90px 46px", textAlign: "center" }}>
            <Label color={C.inkMuted} size={20}>Department of Receipts</Label>
            <svg width="620" height="170" viewBox="0 0 620 170" style={{ display: "block", margin: "8px auto 0" }}>
              <defs>
                <clipPath id="ink">
                  <rect x="0" y="0" width={620 * sign} height="170" />
                </clipPath>
              </defs>
              <text x="310" y="128" textAnchor="middle" clipPath="url(#ink)" style={{ fontFamily: F.hand, fontWeight: 700, fontSize: 150, fill: C.ink }}>
                MyKoll
              </text>
            </svg>
            <div style={{ marginTop: 6 }}>
              <Stamp text="Filed" color={C.win} at={s(2.6)} size={38} rotate={-6} />
            </div>
          </Paper>
        </div>
        <Rise delay={s(2.2)}>
          <Kinetic text="Your group chat finally keeps receipts." delay={s(2.2)} size={64} highlight={["receipts"]} />
        </Rise>
        <Rise delay={s(3.4)}>
          <Label size={24}>Telegram bot · Walrus Memory · Tatum</Label>
        </Rise>
      </AbsoluteFill>
    </Backdrop>
  );
}
