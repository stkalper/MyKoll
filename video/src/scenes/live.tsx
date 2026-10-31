import type { ReactNode } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile } from "remotion";
import { C, F, FPS, s } from "../theme";
import { Backdrop, Kinetic, Label, Phone, Rise, useIn } from "../ui";

/**
 * The real thing: screen recordings from a test group (public/footage), cut and sped up where
 * someone is typing, slowed back down where the bot answers, inside the same phone frame as the
 * motion-graphics scenes.
 */

/** A stretch of a recording: from and to, in seconds of the clip, and how fast to play it. */
type Cut = [from: number, to: number, rate: number];

const framesOf = ([from, to, rate]: Cut) => Math.round(((to - from) / rate) * FPS);
const lengthOf = (cuts: Cut[]) => cuts.reduce((sum, c) => sum + framesOf(c), 0);

/** One still frame of a clip at `at` seconds. */
function Still({ src, at }: { src: string; at: number }) {
  return (
    <Freeze frame={0}>
      <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(at * FPS)} muted style={FIT} />
    </Freeze>
  );
}

const FIT = { width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" } as const;

/** The cuts played back to back from `delay`; the first frame waits before, the last one holds after. */
function Clip({ src, cuts, delay = 0 }: { src: string; cuts: Cut[]; delay?: number }) {
  const starts = cuts.map((_, i) => delay + lengthOf(cuts.slice(0, i)));
  const end = delay + lengthOf(cuts);
  const last = cuts[cuts.length - 1];
  return (
    <AbsoluteFill>
      {delay > 0 && (
        <Sequence durationInFrames={delay} layout="none">
          <Still src={src} at={cuts[0][0]} />
        </Sequence>
      )}
      {cuts.map((cut, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={framesOf(cut)} layout="none">
          <OffthreadVideo src={staticFile(src)} trimBefore={Math.round(cut[0] * FPS)} playbackRate={cut[2]} muted style={FIT} />
        </Sequence>
      ))}
      <Sequence from={end} layout="none">
        <Still src={src} at={last[1] - 0.1} />
      </Sequence>
    </AbsoluteFill>
  );
}

/** A clean status bar over the recording's own (the recording dot, a low battery, a late hour). */
function StatusBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 74,
        background: "linear-gradient(#0a0a0d 84%, rgba(10,10,13,0))",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 42px 8px 52px",
        color: "#fff",
        fontFamily: F.sans,
        fontWeight: 700,
        fontSize: 23,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[6, 9, 12, 15].map((h) => (
            <span key={h} style={{ width: 4, height: h, borderRadius: 1, background: "#fff" }} />
          ))}
        </span>
        <span style={{ fontSize: 16 }}>5G</span>
        <span style={{ width: 30, height: 14, borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.5)", padding: 1.5, display: "flex" }}>
          <span style={{ flex: 1, borderRadius: 2, background: "#fff" }} />
        </span>
      </span>
    </div>
  );
}

// Taller than the frame: the keyboard runs off the bottom edge and the chat gets the room.
const PHONE = { width: 560, height: 1150 };

/** A recording in a phone, with a numbered caption above it. */
function Shot({ x, n, caption, src, cuts, delay = 0 }: { x: number; n: string; caption: string; src: string; cuts: Cut[]; delay?: number }) {
  const p = useIn(delay > s(0.6) ? delay - s(0.6) : 0);
  return (
    <div style={{ position: "absolute", left: x, top: 30, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      <Label size={20} color={C.text} style={{ marginBottom: 16, marginLeft: 24, letterSpacing: "0.14em" }}>
        <span style={{ color: C.hl }}>{n}</span> · {caption}
      </Label>
      <Phone {...PHONE}>
        <Clip src={src} cuts={cuts} delay={delay} />
        <StatusBar />
      </Phone>
    </div>
  );
}

/** The text column on the right: what this part shows, in a headline and a line under it. */
function Side({ title, highlight, children, x = 1350 }: { title: string; highlight: string[]; children: ReactNode; x?: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: 290, width: 500 }}>
      <Rise delay={s(0.2)}>
        <Label size={18} style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: 6, background: C.loss, boxShadow: `0 0 14px ${C.loss}` }} />
          Live in Telegram
        </Label>
      </Rise>
      <Kinetic text={title} size={64} align="left" delay={s(0.3)} highlight={highlight} />
      <Rise delay={s(1.1)}>
        <div style={{ fontFamily: F.sans, fontSize: 26, lineHeight: 1.45, color: C.muted, marginTop: 28 }}>{children}</div>
      </Rise>
      <Rise delay={s(1.6)}>
        <Label size={15} style={{ marginTop: 34 }}>
          Real screen recording · sped up while typing
        </Label>
      </Rise>
    </div>
  );
}

const BTC: Cut[] = [
  [3, 16, 3],
  [16, 24.5, 1.3],
];
const FURIA: Cut[] = [
  [40, 47.5, 2.4],
  [47.5, 56.5, 1.3],
];
const SLATE: Cut[] = [
  [1, 7.5, 2.2],
  [7.5, 14.5, 1.6],
  [14.5, 21, 1.3],
];
const BOARD: Cut[] = [
  [0.5, 3, 1.5],
  [3, 4.6, 1],
  [4.6, 7, 2],
  [7, 10.5, 1],
];
const ASK: Cut[] = [
  [0, 8.3, 2.2],
  [8.3, 13.2, 1.4],
  [13.2, 18.5, 1],
];

const PAIR_LEFT = 90;
const PAIR_RIGHT = 700;
const LATER = s(1.2);

/** 3b · A crypto call and a CS2 pick, typed in a real group. */
export function LiveCalls() {
  return (
    <Backdrop glowAt="40% 50%">
      <Shot x={PAIR_LEFT} n="01" caption="Crypto, as you'd say it" src="footage/IMG_6678.MP4" cuts={BTC} />
      <Shot x={PAIR_RIGHT} n="02" caption="CS2, with live odds" src="footage/IMG_6678.MP4" cuts={FURIA} delay={LATER} />
      <Side title="Real group. Real receipts." highlight={["Real", "receipts"]}>
        “Btc 102k tomorrow” gets the BTC price from Tatum. “Easy for furia” finds FURIA's next match and what Polymarket gave them.
      </Side>
    </Backdrop>
  );
}
export const LIVE_CALLS_LENGTH = Math.max(lengthOf(BTC), LATER + lengthOf(FURIA)) + s(1);

/** 3c · Four picks in one message, then the board in the Mini App. */
export function LiveSlate() {
  return (
    <Backdrop glowAt="40% 50%">
      <Shot x={PAIR_LEFT} n="03" caption="Four matches, one message" src="footage/IMG_6685.MP4" cuts={SLATE} />
      <Shot x={PAIR_RIGHT} n="04" caption="The board, in a Mini App" src="footage/IMG_6686.MP4" cuts={BOARD} delay={LATER} />
      <Side title="Picks become receipts." highlight={["receipts"]}>
        One tap logs all four, each with its Polymarket price. When the last match ends, the bot posts who went 4/4.
      </Side>
    </Backdrop>
  );
}
export const LIVE_SLATE_LENGTH = Math.max(lengthOf(SLATE), LATER + lengthOf(BOARD)) + s(1);

/** 7b · A question in the real chat, answered from Walrus Memory. */
export function LiveAsk() {
  return (
    <Backdrop glowAt="35% 50%">
      <Shot x={400} n="05" caption="Ask the memory" src="footage/IMG_6691.MP4" cuts={ASK} />
      <Side title="Who called Nemiga?" highlight={["Nemiga"]} x={1100}>
        Recalled from Walrus Memory: who said it, when, and how it ended. Above it, a call shared from a post on X.
      </Side>
    </Backdrop>
  );
}
export const LIVE_ASK_LENGTH = lengthOf(ASK) + s(1);
