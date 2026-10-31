import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, F, s } from "../theme";
import { Backdrop, Chat, ChatHeader, Kinetic, Label, Paper, Phone, Rise, Stamp, Tap, useIn } from "../ui";

/** 6 · Channels too: a forwarded signal is tracked under the channel; a brag isn't. */
export function Channels() {
  const frame = useCurrentFrame();
  const phoneOut = interpolate(frame, [s(8.6), s(9.2)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const brag = useIn(s(6.2));
  const board = useIn(s(9.1));
  return (
    <Backdrop glow="#7cc4f5">
      <AbsoluteFill style={{ opacity: phoneOut }}>
        <div style={{ position: "absolute", left: 230, top: 40 }}>
          <Phone width={540} height={1000}>
            <ChatHeader />
            <Chat
              messages={[
                {
                  at: s(0.4),
                  from: "Max",
                  color: "#7cc4f5",
                  forwarded: "VIP Signals",
                  text: "$SOL/USDT SHORT\nEntry: 186–188\nTargets: 180 / 175 / 168\nSL: 192 · Leverage 10x",
                },
                {
                  at: s(2.2),
                  from: "MyKoll",
                  bot: true,
                  text: (
                    <>
                      📎 <b>VIP Signals on Telegram</b> called it Thu 30 Oct, 17:00:{"\n"}
                      <b>SOL below $180 by Thu 6 Nov</b>. Keep score on it?
                    </>
                  ),
                  buttons: [["🧾 Track it", "No"]],
                  tap: { at: s(4.2), button: "🧾 Track it" },
                },
              ]}
            />
            <Tap at={s(4.2)} x={180} y={905} />
          </Phone>
        </div>

        <div style={{ position: "absolute", left: 1020, top: 260, opacity: brag, transform: `translateY(${(1 - brag) * 60}px) rotate(2deg)` }}>
          <div style={{ background: C.tgIn, borderRadius: 24, padding: "26px 32px", width: 680, color: C.tgText, fontFamily: F.sans, fontSize: 32, lineHeight: 1.45 }}>
            <div style={{ color: C.tgLink, fontSize: 22, borderLeft: `3px solid ${C.tgLink}`, paddingLeft: 10, marginBottom: 8 }}>Forwarded from VIP Signals</div>
            🚀 <b>+1,000% THIS MONTH</b> 📈🔥{"\n"}Our VIPs know exactly what to do. Book your seat now!
          </div>
          <div style={{ position: "absolute", left: 170, top: 90 }}>
            <Stamp text="Not a call" color={C.loss} at={s(7.1)} size={64} rotate={-10} style={{ mixBlendMode: "normal", background: "rgba(241,237,227,0.92)" }} />
          </div>
        </div>
        {frame > s(7.3) && (
          <div style={{ position: "absolute", left: 1020, top: 640, width: 700 }}>
            <Kinetic text="Brags don’t count. Calls do." delay={s(7.3)} size={54} align="left" highlight={["Calls"]} />
          </div>
        )}
      </AbsoluteFill>

      {frame > s(8.9) && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
          <div style={{ opacity: board, transform: `translateY(${(1 - board) * 60}px)` }}>
            <Paper style={{ width: 1100, padding: "36px 46px" }}>
              <Label color={C.inkMuted} size={20}>Board · who calls it right</Label>
              {[
                ["@jake", "13 of 18", "72%", C.win, false],
                ["@max", "14 of 23", "61%", C.win, false],
                ["VIP Signals on Telegram", "3 of 11", "27%", C.loss, true],
              ].map(([who, n, pct, color, source], i) => (
                <BoardRow key={who as string} at={s(9.5) + i * 6} who={who as string} n={n as string} pct={pct as string} color={color as string} source={source as boolean} />
              ))}
            </Paper>
          </div>
          <Rise delay={s(9.8)}>
            <Kinetic text="Now you know who’s worth listening to." delay={s(9.8)} size={58} highlight={["worth"]} />
          </Rise>
        </AbsoluteFill>
      )}
    </Backdrop>
  );
}

function BoardRow({ at, who, n, pct, color, source }: { at: number; who: string; n: string; pct: string; color: string; source: boolean }) {
  const frame = useCurrentFrame();
  const p = useIn(at);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: `2px dashed ${C.rule}`,
        padding: "18px 0",
        opacity: p,
        transform: `translateX(${(1 - p) * -40}px)`,
        background: source && frame > s(10.4) ? `linear-gradient(90deg, ${C.hlPink}66, transparent)` : undefined,
      }}
    >
      <span style={{ fontFamily: F.mono, fontSize: 36, fontWeight: 600 }}>
        {source ? "📎 " : ""}
        {who}
      </span>
      <span style={{ fontFamily: F.form, fontWeight: 800, fontSize: 22, letterSpacing: "0.1em", color: C.inkMuted }}>{n} right</span>
      <span style={{ fontFamily: F.form, fontWeight: 800, fontSize: 56, color }}>{pct}</span>
    </div>
  );
}

/** 7 · Ask it anything: answers come back with people's own words. */
export function Ask() {
  const frame = useCurrentFrame();
  const q = "@mykoll_bot who's good on SUI?";
  const typed = Math.floor(interpolate(frame, [s(0.4), s(2.2)], [0, q.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const answer = useIn(s(2.8));
  const link = interpolate(frame, [s(5.6), s(6.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const chip = useIn(s(6.2));
  return (
    <Backdrop>
      <div style={{ position: "absolute", left: 200, top: 300, width: 960 }}>
        <div style={{ background: C.tgOut, color: C.tgText, fontFamily: F.sans, fontSize: 40, borderRadius: 28, borderBottomRightRadius: 8, padding: "22px 34px", marginLeft: 220 }}>
          {q.slice(0, typed)}
          <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>▍</span>
        </div>
        <div style={{ marginTop: 34, opacity: answer, transform: `translateY(${(1 - answer) * 40}px)`, background: C.tgIn, color: C.tgText, fontFamily: F.sans, fontSize: 34, lineHeight: 1.5, borderRadius: 28, borderBottomLeftRadius: 8, padding: "26px 34px" }}>
          <div style={{ color: C.hl, fontWeight: 700, fontSize: 26 }}>MyKoll</div>
          <b>Max</b> · 4/4 on SUI calls. On 28 Oct he said{" "}
          <span style={{ background: frame > s(4.6) ? `${C.hl}55` : "transparent", borderRadius: 4, padding: "0 4px" }}>“nah, SUI bleeds”</span> and SUI ended the week at $0.84.
          {"\n"}
          <div>
            <b>Jake</b> · 1/4 on Sui tokens. His last one, “SUI to $5 by Friday”, missed.
          </div>
        </div>
      </div>
      <svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
        <path d="M 1160 540 C 1250 540, 1240 410, 1330 410" stroke={C.hl} strokeWidth="3" fill="none" strokeDasharray="400" strokeDashoffset={400 * (1 - link)} />
      </svg>
      <div style={{ position: "absolute", left: 1330, top: 350, opacity: chip, transform: `scale(${0.9 + 0.1 * chip})` }}>
        <Paper style={{ padding: "16px 22px", width: 420 }}>
          <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 18, border: `2px solid ${C.win}`, color: C.win, padding: "2px 8px" }}>RESULT #141</span>
          <div style={{ fontFamily: F.mono, fontSize: 20, marginTop: 10, lineHeight: 1.4 }}>@max’s call “nah, SUI bleeds” was RIGHT: SUI was $0.84 at the deadline.</div>
        </Paper>
        <Label size={18} style={{ marginTop: 14 }}>recalled from Walrus Memory</Label>
      </div>
    </Backdrop>
  );
}

const TATUM = ["Price API · majors", "Sui gRPC · Cetus pools", "Robinhood Chain RPC · Uniswap v3", "Prediction Market API · Polymarket"];

/** 8 · Under the hood: Tatum for every price and result, Walrus for memory. */
export function Hood() {
  const frame = useCurrentFrame();
  const line = (at: number) => interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const packet = (at: number) => ((frame - at) % 40) / 40;
  const Node = ({ x, y, w, title, sub, at, accent = C.text }: { x: number; y: number; w: number; title: string; sub?: string; at: number; accent?: string }) => {
    const p = useIn(at);
    return (
      <div style={{ position: "absolute", left: x, top: y, width: w, opacity: p, transform: `scale(${0.9 + 0.1 * p})`, border: `2px solid ${accent}`, borderRadius: 18, background: "rgba(11,14,21,0.92)", padding: "18px 24px" }}>
        <div style={{ fontFamily: F.form, fontWeight: 800, fontSize: 30, color: accent, textTransform: "uppercase" }}>{title}</div>
        {sub && <div style={{ fontFamily: F.mono, fontSize: 19, color: C.muted, marginTop: 4 }}>{sub}</div>}
      </div>
    );
  };
  const wires: [number, number, number, number, number][] = [
    [450, 520, 690, 520, s(1)],
    [1010, 470, 1210, 260, s(2)],
    [1010, 570, 1210, 800, s(5.4)],
  ];
  return (
    <Backdrop glow="#7cc4f5">
      <div style={{ position: "absolute", top: 60, left: 0, right: 0 }}>
        <Kinetic text="Under the hood" delay={s(0.1)} size={70} />
      </div>
      <svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
        {wires.map(([x1, y1, x2, y2, at], i) => {
          const p = line(at);
          const t = packet(at + 14);
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
              {p === 1 && <circle cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="7" fill={i === 2 ? C.hl : "#7cc4f5"} />}
            </g>
          );
        })}
      </svg>
      <Node x={130} y={460} w={320} title="Telegram" sub="your group chat" at={s(0.4)} />
      <Node x={670} y={440} w={360} title="MyKoll" sub="spots · files · settles · learns" at={s(0.8)} accent={C.hl} />
      <div style={{ position: "absolute", left: 1210, top: 150 }}>
        <Node x={0} y={0} w={560} title="Tatum" sub="every price, pool and match result" at={s(2)} accent="#7cc4f5" />
        {TATUM.map((t, i) => (
          <Rise key={t} delay={s(2.6) + i * 6} style={{ position: "absolute", left: 30, top: 130 + i * 58, fontFamily: F.mono, fontSize: 24, color: C.text, whiteSpace: "nowrap" }}>
            → {t}
          </Rise>
        ))}
      </div>
      <Node x={1210} y={720} w={560} title="Walrus Memory" sub="a namespace per chat · Sui mainnet" at={s(5.6)} accent={C.hl} />
      <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center" }}>
        <Rise delay={s(7.6)}>
          <Label size={24}>Every price links to where it was read · every memory is the chat’s own</Label>
        </Rise>
      </div>
    </Backdrop>
  );
}

/** 9 · End card: the pen signs the bot's name, and the line. */
export function End() {
  const frame = useCurrentFrame();
  const sign = interpolate(frame, [s(0.6), s(2.6)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const btn = useIn(s(0.2));
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 46 }}>
        <Kinetic text="Settle it. Remember it." delay={s(2.4)} size={120} highlight={["Remember"]} />
        <div
          style={{
            opacity: btn,
            transform: `scale(${0.9 + 0.1 * btn})`,
            background: C.hl,
            color: C.ink,
            border: `3px solid ${C.outline}`,
            borderRadius: 12,
            padding: "18px 44px",
            boxShadow: "6px 6px 0 rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontFamily: F.form,
            fontWeight: 800,
            fontSize: 34,
            textTransform: "uppercase",
          }}
        >
          Add
          <svg width="236" height="70" viewBox="0 0 236 70">
            <defs>
              <clipPath id="sign">
                <rect x="0" y="0" width={236 * sign} height="70" />
              </clipPath>
            </defs>
            <text x="0" y="52" clipPath="url(#sign)" style={{ fontFamily: F.hand, fontWeight: 700, fontSize: 56, fill: C.ink, textTransform: "none" }}>
              @mykoll_bot
            </text>
            {sign > 0 && sign < 1 && <circle cx={236 * sign} cy={40 + Math.sin(sign * 40) * 10} r="5" fill={C.ink} />}
          </svg>
          to your group
        </div>
        <Rise delay={s(3.4)}>
          <div style={{ fontFamily: F.mono, fontSize: 28, color: C.text, textAlign: "center", lineHeight: 1.7 }}>
            t.me/mykoll_bot · mykoll.vercel.app · github.com/stkalper/MyKoll
          </div>
        </Rise>
        <Rise delay={s(4)}>
          <Label size={22}>Built for Total Recall · Walrus × Tatum</Label>
        </Rise>
      </AbsoluteFill>
    </Backdrop>
  );
}
