import type { CSSProperties, ReactNode } from "react";
import { C, F } from "./theme";
import { Hl, Paper, Stamp, Tape } from "./ui";

/** A receipt as the site draws it: a form with the quote highlighted and a stamp box. */
export function Receipt({
  id,
  author,
  when,
  quote,
  rows,
  hlAt = 0,
  stamp,
  footer,
  width = 820,
  tilt = 0,
  style,
}: {
  id: number;
  author: string;
  when: string;
  quote: string;
  rows: [string, ReactNode][];
  hlAt?: number;
  stamp?: { text: string; color: string; at: number };
  footer?: ReactNode;
  width?: number;
  tilt?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: "relative", width, ...style }}>
      <Tape style={{ top: -18, left: 60, transform: "rotate(-6deg)", zIndex: 2 }} />
      <Paper tilt={tilt} style={{ padding: "34px 40px 30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `3px solid ${C.ink}`, paddingBottom: 12 }}>
          <div>
            <div style={{ fontFamily: F.form, fontWeight: 800, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase" }}>Department of Receipts</div>
            <div style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: "0.16em", color: C.inkMuted, textTransform: "uppercase" }}>Form RC-1 · filed by @mykoll_bot</div>
          </div>
          <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 22, border: `2px solid ${C.ink}`, padding: "2px 10px" }}>CASE #{id}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontFamily: F.mono, fontSize: 20, color: C.inkMuted }}>
          <span style={{ color: C.ink, fontWeight: 600 }}>{author}</span>
          <span>{when}</span>
        </div>
        <div style={{ fontFamily: F.hand, fontWeight: 700, fontSize: quote.length > 24 ? 46 : 58, lineHeight: 1.15, margin: "8px 0 18px" }}>
          “<Hl at={hlAt}>{quote}</Hl>”
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", rowGap: 10 }}>
          {rows.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
        </div>

        {footer && <div style={{ marginTop: 18 }}>{footer}</div>}

        <div style={{ marginTop: 20, borderTop: `2px dashed ${C.rule}`, paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 96 }}>
          <span style={{ fontFamily: F.mono, fontSize: 16, letterSpacing: "0.18em", color: C.inkMuted, textTransform: "uppercase" }}>For office use only</span>
          {stamp ? <Stamp text={stamp.text} color={stamp.color} at={stamp.at} size={46} /> : <span style={{ fontFamily: F.form, fontWeight: 800, fontSize: 22, color: C.open, letterSpacing: "0.1em" }}>PENDING</span>}
        </div>
      </Paper>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <span style={{ fontFamily: F.mono, fontSize: 17, letterSpacing: "0.14em", color: C.inkMuted, textTransform: "uppercase", paddingTop: 4 }}>{k}</span>
      <span style={{ fontFamily: F.mono, fontSize: 25, fontWeight: 500, borderBottom: `1px solid ${C.rule}`, paddingBottom: 4 }}>{v}</span>
    </>
  );
}

/** A button under a receipt, like the bot's inline buttons but on paper. */
export function ProofButton({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-block", fontFamily: F.form, fontWeight: 700, fontSize: 20, border: `2px solid ${C.ink}`, borderRadius: 6, padding: "8px 16px", background: C.paperShade, boxShadow: `3px 3px 0 ${C.ink}` }}>
      {children}
    </span>
  );
}
