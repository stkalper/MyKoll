import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, F, s } from "../theme";
import { Backdrop, Chat, Count, Kinetic, Label, Paper, Phone, Rise, useIn, type Msg } from "../ui";

const ENTRIES = [
  { tag: "CALL", color: C.open, text: "@jake called “SUI to $5 by Friday”. SUI was $0.9029 (Cetus pool via Tatum)." },
  { tag: "REASON", color: C.inkMuted, text: "@jake: storage usage keeps climbing, chart is coiling." },
  { tag: "RESULT", color: C.loss, text: "@ryan’s call “WAL to 5 cents” was WRONG: $0.0308 at the deadline." },
  { tag: "TRACK RECORD", color: C.win, text: "@jake is 13/18 right; strong on majors 9/10; weak on Sui tokens 1/4." },
  { tag: "HABIT", color: C.inkMuted, text: "@max confirmed his last 3 calls, so I log his without asking." },
];

/** 5 · Every verdict becomes memory, and memory changes what the bot does. */
export function Memory() {
  const frame = useCurrentFrame();
  const partA = interpolate(frame, [s(6.2), s(6.8)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const partB = interpolate(frame, [s(6.6), s(7.2), s(20.4), s(21)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Backdrop glow={C.hl} glowAt="50% 50%">
      {partA > 0 && (
        <AbsoluteFill style={{ opacity: partA }}>
          <Vault />
        </AbsoluteFill>
      )}
      {partB > 0 && (
        <AbsoluteFill style={{ opacity: partB }}>
          <SideBySide />
        </AbsoluteFill>
      )}
      {frame > s(20.6) && <MemoryCheck start={s(20.8)} />}
    </Backdrop>
  );
}

/** Memory cards fly into the chat's namespace on Walrus. */
function Vault() {
  const frame = useCurrentFrame();
  const box = useIn(s(0.8), { damping: 20 });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0 }}>
        <Kinetic text="Every verdict becomes memory." delay={s(0.2)} size={76} highlight={["memory"]} />
      </div>
      {ENTRIES.map((e, i) => {
        // The entries stack up where they can be read, then fly into the vault one by one.
        const appear = s(0.5) + i * s(0.35);
        const at = s(2.8) + i * s(0.45);
        const fly = interpolate(frame, [at, at + s(1.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
        const show = interpolate(frame, [appear, appear + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = interpolate(fly, [0, 1], [180, 1080]);
        const y = interpolate(fly, [0, 1], [260 + i * 130, 470 + i * 6]) - Math.sin(fly * Math.PI) * 120;
        return (
          <div key={e.tag} style={{ position: "absolute", left: x, top: y, opacity: show * (1 - fly * 0.85), transform: `scale(${1 - fly * 0.45}) rotate(${(1 - fly) * (i % 2 ? 2 : -2)}deg)`, transformOrigin: "left center" }}>
            <Paper style={{ padding: "14px 22px", width: 760, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 18, border: `2px solid ${e.color}`, color: e.color, padding: "2px 8px", whiteSpace: "nowrap" }}>{e.tag}</span>
              <span style={{ fontFamily: F.mono, fontSize: 20, lineHeight: 1.4 }}>{e.text}</span>
            </Paper>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 1180,
          top: 330,
          width: 560,
          height: 440,
          opacity: box,
          transform: `scale(${0.9 + 0.1 * box})`,
          borderRadius: 32,
          border: `3px solid ${C.hl}`,
          background: "linear-gradient(160deg, rgba(143,227,166,0.14), rgba(143,227,166,0.02))",
          boxShadow: `0 0 120px ${C.hl}33, inset 0 0 60px ${C.hl}22`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <Label color={C.hl} size={22}>Walrus Memory · Sui mainnet</Label>
        <div style={{ fontFamily: F.mono, fontSize: 30, color: C.text }}>receipts:chat:-1001…</div>
        <div style={{ fontFamily: F.form, fontWeight: 800, fontSize: 130, color: C.text, lineHeight: 1 }}>
          <Count from={128} to={133} start={s(3.2)} end={s(5.8)} />
        </div>
        <Label size={20}>memories in this chat</Label>
      </div>
    </AbsoluteFill>
  );
}

const SUI: Msg = { at: s(7.4), from: "Jake", color: "#e0a96d", text: "SUI to $5 by Friday" };
const MAX: Msg = { at: s(11.4), from: "Max", color: "#7cc4f5", text: "nah, SUI bleeds 🩸" };
const OLA: Msg = { at: s(15.6), from: "Emma", color: "#f4a7c8", text: "imagine SUI at 10 lol" };

/** The same three messages to a bot that forgets and to MyKoll. */
function SideBySide() {
  const frame = useCurrentFrame();
  const forgets: Msg[] = [
    SUI,
    { at: s(8.6), from: "Bot", bot: true, text: "🧾 Logged: SUI above $5.00 by Fri 23:59." },
    MAX,
    { at: s(12.6), from: "Bot", bot: true, text: "🧾 Logged: SUI down by Fri 23:59." },
    OLA,
    { at: s(16.6), from: "Bot", bot: true, text: "📌 Sounds like a call: SUI above $10. Log it?", buttons: [["🧾 Log it", "No"]] },
  ];
  const remembers: Msg[] = [
    SUI,
    {
      at: s(8.6),
      from: "MyKoll",
      bot: true,
      text: (
        <>
          🧾 Receipt #148 · SUI above $5.00{"\n"}
          <span style={{ color: "#f2c46d" }}>📊 @jake: 1/4 on Sui tokens · ⚠️ a weak spot</span>
          {"\n"}↩ Last time: “WAL to 5 cents” · ❌ missed
        </>
      ),
    },
    MAX,
    {
      at: s(12.6),
      from: "MyKoll",
      bot: true,
      text: (
        <>
          🧭 2 of 3 say ↑ up, but weighted by track record{"\n"}the chat leans <b style={{ color: C.hl }}>↓ down (53%)</b>
        </>
      ),
    },
    OLA,
  ];
  const quiet = interpolate(frame, [s(17.2), s(17.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 120, paddingTop: 20 }}>
      <Column title="A bot that forgets" dim>
        <Phone width={560} height={820} style={{ filter: "saturate(0.2) brightness(0.8)" }}>
          <Header name="Bot" />
          <Chat messages={forgets} />
        </Phone>
      </Column>
      <Column
        title="MyKoll · with Walrus Memory"
        note={
          <div style={{ opacity: quiet, transform: `translateY(${(1 - quiet) * 14}px)`, background: C.paper, color: C.ink, border: `3px solid ${C.outline}`, borderRadius: 6, padding: "8px 16px", fontFamily: F.mono, fontSize: 20 }}>
            stays quiet: Emma said “not a call” twice
          </div>
        }
      >
        <Phone width={560} height={820} style={{ boxShadow: `0 50px 120px rgba(0,0,0,0.7), 0 0 0 3px ${C.hl}55` }}>
          <Header name="MyKoll" />
          <Chat messages={remembers} />
        </Phone>
      </Column>
    </AbsoluteFill>
  );
}

function Column({ title, dim, note, children }: { title: string; dim?: boolean; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <Label color={dim ? C.muted : C.hl} size={24}>
        {title}
      </Label>
      {/* A slot for what the bot learned, kept on both sides so the phones line up. */}
      <div style={{ height: 50, display: "flex", alignItems: "center" }}>{note}</div>
      {children}
    </div>
  );
}

function Header({ name }: { name: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110, paddingTop: 56, background: "#17212b", textAlign: "center", color: C.tgText, fontFamily: F.sans, fontWeight: 700, fontSize: 22, zIndex: 2 }}>
      Degen Club · {name}
    </div>
  );
}

/** The measured check: how well trust predicted outcomes, with memory and without. */
function MemoryCheck({ start }: { start: number }) {
  const frame = useCurrentFrame();
  const grow = (to: number) => interpolate(frame, [start + s(1), start + s(2.6)], [0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Rise delay={start}>
        <Paper style={{ width: 1100, padding: "40px 54px" }}>
          <Label color={C.inkMuted} size={20}>Memory check · settled calls in a demo chat</Label>
          <div style={{ fontFamily: F.hand, fontWeight: 700, fontSize: 54, margin: "6px 0 26px" }}>How well its trust predicted the outcome. Lower is better.</div>
          {[
            ["With memory", 0.207, C.win],
            ["A bot that forgets", 0.25, C.open],
          ].map(([label, v, color]) => (
            <div key={label as string} style={{ display: "grid", gridTemplateColumns: "360px 1fr 120px", alignItems: "center", gap: 24, margin: "14px 0" }}>
              <span style={{ fontFamily: F.mono, fontSize: 28 }}>{label as string}</span>
              <div style={{ height: 34, border: `3px solid ${C.ink}`, background: C.paperShade }}>
                <div style={{ height: "100%", width: `${grow((v as number) / 0.3) * 100}%`, background: color as string }} />
              </div>
              <span style={{ fontFamily: F.mono, fontSize: 30, textAlign: "right" }}>
                <Count to={v as number} start={start + s(1)} end={start + s(2.6)} decimals={3} />
              </span>
            </div>
          ))}
          <div style={{ fontFamily: F.mono, fontSize: 20, color: C.inkMuted, marginTop: 18 }}>Brier score · each call judged only by what was known before it was made</div>
        </Paper>
      </Rise>
    </AbsoluteFill>
  );
}
