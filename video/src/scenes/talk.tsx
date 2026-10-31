import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ProofButton, Receipt } from "../receipt";
import { C, F, s } from "../theme";
import { Backdrop, Callout, Chat, ChatHeader, Kinetic, Label, Paper, Phone, Rise, Stamp, Tap, useIn } from "../ui";

/** 3 · Just talk: a call in Ukrainian becomes a receipt with an on-chain price. */
export function JustTalk() {
  const frame = useCurrentFrame();
  // The phone slides left as the receipt comes out of it; then both clear for the format montage.
  const slide = interpolate(frame, [s(4.4), s(5.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const out = interpolate(frame, [s(13.2), s(14)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const receipt = useIn(s(4.6), { damping: 15 });
  return (
    <Backdrop glowAt="60% 45%">
      <AbsoluteFill style={{ opacity: out }}>
        <div style={{ position: "absolute", left: interpolate(slide, [0, 1], [700, 150]), top: 40 }}>
          <Phone width={520} height={1000}>
            <ChatHeader />
            <Chat
              messages={[
                { at: s(0.2), from: "Max", color: "#7cc4f5", text: "sui looks heavy today" },
                { at: s(0.9), from: "Jake", color: "#e0a96d", text: "sui over a dollar in 5 hours" },
                {
                  at: s(2.1),
                  from: "MyKoll",
                  bot: true,
                  text: (
                    <>
                      📌 Sounds like a call: <b>SUI above $1.00 by today, 20:14</b>. Log it?
                    </>
                  ),
                  buttons: [["🧾 Log it", "No"]],
                  tap: { at: s(3.6), button: "🧾 Log it" },
                },
              ]}
            />
            <Tap at={s(3.6)} x={170} y={905} />
          </Phone>
        </div>

        <div
          style={{
            position: "absolute",
            left: 715,
            top: 120,
            opacity: receipt,
            transform: `translate(${(1 - receipt) * -380}px, ${(1 - receipt) * 260}px) scale(${0.55 + 0.45 * receipt}) rotate(${(1 - receipt) * 10 - 1.5}deg)`,
            transformOrigin: "left center",
          }}
        >
          <Receipt
            id={142}
            author="@jake"
            when="Fri 31 Oct, 15:14"
            quote="sui over a dollar in 5 hours"
            hlAt={s(5.6)}
            rows={[
              ["Claim", "SUI above $1.00"],
              ["Price when called", "$0.9029"],
              ["Read from", "Cetus pool · Sui mainnet · Tatum"],
              ["Cross-check", "✓ Tatum Price API $0.9035 (0.07%)"],
              ["Judged", "Fri 31 Oct, 20:14"],
            ]}
            footer={<ProofButton>🔎 Check the price on Sui</ProofButton>}
          />
        </div>

        {/* On the phone while it's alone, then on the receipt, from the margins so no line crosses the text. */}
        <Callout at={s(1.4)} until={s(4.2)} anchor="left" text="Plain talk" from={[1300, 690]} to={[1190, 690]} />
        <Callout at={s(2.7)} until={s(4.2)} anchor="left" text="No commands" from={[1300, 860]} to={[1190, 860]} />
        <Callout at={s(8.4)} anchor="left" text="On-chain via Tatum" from={[1565, 456]} to={[1510, 456]} />
        <Callout at={s(9.6)} anchor="left" text="Cross-checked" from={[1565, 530]} to={[1510, 520]} />
        <Callout at={s(10.8)} anchor="left" text="Anyone can check it" from={[1565, 660]} to={[1075, 660]} />
      </AbsoluteFill>

      {frame > s(13.6) && <Formats start={s(13.8)} />}
    </Backdrop>
  );
}

const FORMATS = [
  { says: "easy for Vitality", files: "Vitality vs MOUZ", note: "finds the next match · Polymarket 56%" },
  { says: "TRX long, TP 0.37. Broke resistance on volume", files: "TRX above $0.37", note: "the reasons are filed as the why" },
  { says: "NaVi, Vitality, FURIA", files: "3 picks", note: "one tap · results when the last match ends" },
];

/** Three more shapes a call comes in, in quick succession. */
function Formats({ start }: { start: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", gap: 34 }}>
      <Rise delay={start}>
        <Label size={24} style={{ marginBottom: 10 }}>Said the way people say it</Label>
      </Rise>
      {FORMATS.map((f, i) => {
        const at = start + s(0.4) + i * s(2.6);
        const p = useIn(at);
        const arrow = interpolate(frame, [at + 8, at + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const chip = useIn(at + 16);
        return (
          <div key={f.says} style={{ display: "flex", alignItems: "center", gap: 36, opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
            <div style={{ background: C.tgIn, color: C.tgText, fontFamily: F.sans, fontSize: 36, padding: "20px 30px", borderRadius: 26, borderBottomLeftRadius: 8, width: 760 }}>{f.says}</div>
            <svg width="120" height="40">
              <line x1="0" y1="20" x2={110 * arrow} y2="20" stroke={C.hl} strokeWidth="4" />
              <polygon points="104,10 120,20 104,30" fill={C.hl} opacity={arrow} />
            </svg>
            <div style={{ opacity: chip, transform: `scale(${0.9 + 0.1 * chip})` }}>
              <Paper style={{ padding: "14px 26px" }}>
                <div style={{ fontFamily: F.form, fontWeight: 800, fontSize: 34, textTransform: "uppercase" }}>{f.files}</div>
                <div style={{ fontFamily: F.mono, fontSize: 20, color: C.inkMuted }}>{f.note}</div>
              </Paper>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** 4 · The deadline comes and the bot posts the verdict first. */
export function Settles() {
  const frame = useCurrentFrame();
  const hours = interpolate(frame, [s(0.3), s(2.6)], [0, 5], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) });
  const clockOut = interpolate(frame, [s(2.9), s(3.4)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const h = 15 + Math.floor(hours);
  const m = Math.floor((hours % 1) * 60) + 14;
  const time = `${String(h + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const a = useIn(s(3.2));
  const b = useIn(s(4.6));
  const cs = useIn(s(8.2));
  const slate = useIn(s(11.6));
  const firstOut = interpolate(frame, [s(7.6), s(8.2)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop glow={C.hl}>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0 }}>
        <Kinetic text="It settles itself." delay={s(0.2)} size={76} />
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: clockOut }}>
        <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 220, color: C.text, letterSpacing: "0.04em" }}>{frame >= s(2.6) ? "20:14" : time}</div>
        <Label size={26}>Friday · deadline</Label>
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: firstOut }}>
        <div style={{ position: "absolute", left: 170, top: 230, opacity: a, transform: `translateY(${(1 - a) * 80}px) rotate(-2deg)` }}>
          <Receipt
            id={142}
            author="@jake"
            when="Fri 31 Oct, 15:14"
            quote="sui over a dollar in 5 hours"
            width={740}
            rows={[
              ["Claim", "SUI above $1.00"],
              ["At the deadline", "$1.0142"],
            ]}
            stamp={{ text: "Called it", color: C.win, at: s(4.0) }}
          />
        </div>
        <div style={{ position: "absolute", left: 1010, top: 300, opacity: b, transform: `translateY(${(1 - b) * 80}px) rotate(2deg)` }}>
          <Receipt
            id={139}
            author="@ryan"
            when="Mon 27 Oct, 11:40"
            quote="WAL to 5 cents by Friday"
            width={740}
            rows={[
              ["Claim", "WAL above $0.0500"],
              ["At the deadline", "$0.0308"],
            ]}
            stamp={{ text: "Missed", color: C.loss, at: s(5.4) }}
          />
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 160, top: 300, opacity: cs * interpolate(frame, [s(15), s(15.6)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: `translateX(${(1 - cs) * -120}px)` }}>
        <Paper style={{ padding: "34px 40px", width: 720 }}>
          <Label color={C.inkMuted} size={18}>Counter-Strike 2 · PGL Masters Bucharest</Label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0" }}>
            <span style={{ fontFamily: F.form, fontWeight: 800, fontSize: 50 }}>VITALITY</span>
            <span style={{ fontFamily: F.mono, fontSize: 30, color: C.inkMuted }}>2 : 1</span>
            <span style={{ fontFamily: F.form, fontWeight: 800, fontSize: 50, color: C.inkMuted }}>MOUZ</span>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 22, borderTop: `2px dashed ${C.rule}`, paddingTop: 14 }}>
            Resolved by Polymarket from HLTV
            <br />
            read through Tatum’s Prediction Market API
          </div>
        </Paper>
      </div>

      <div style={{ position: "absolute", right: 150, top: 260, opacity: slate * interpolate(frame, [s(15), s(15.6)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: `translateX(${(1 - slate) * 120}px)` }}>
        <div style={{ background: C.tgIn, borderRadius: 24, padding: "28px 34px", width: 780, color: C.tgText, fontFamily: F.sans, fontSize: 30, lineHeight: 1.5 }}>
          <div style={{ color: C.hl, fontWeight: 700, fontSize: 24 }}>MyKoll</div>
          🏁 <b>All matches are over</b> · @jake went <b>2/3</b>
          <div style={{ color: C.tgMeta }}>“NaVi, Vitality, FURIA”</div>
          <div style={{ marginTop: 8 }}>✅ #31 <b>Vitality</b> beat MOUZ</div>
          <div>❌ #32 <b>FaZe</b> beat NaVi</div>
          <div>
            ✅ #33 <b>FURIA</b> beat Nemiga <span style={{ color: C.hl }}>🎯 upset, Polymarket had 38%</span>
          </div>
        </div>
      </div>

      {frame > s(15.2) && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Stamp text="Nobody argues the score" color={C.hl} at={s(15.3)} size={80} rotate={-4} style={{ mixBlendMode: "normal" }} />
        </AbsoluteFill>
      )}
    </Backdrop>
  );
}
