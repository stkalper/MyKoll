import { ImageResponse } from "next/og";
import { sharedReceipt } from "@/lib/receipts";

export const alt = "A call and how it turned out";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The fonts have no check/cross glyphs, so the stamp says it in words.
const stamp = {
  win: { label: "CALLED IT", color: "#1f7a45" },
  loss: { label: "MISSED", color: "#b8352a" },
  open: { label: "PENDING", color: "#3d4a63" },
  void: { label: "VOID", color: "#3d4a63" },
} as const;

const INK = "#1d2433";
const MUTED = "#5d6475";

/** A Google font as TTF (ImageResponse can't read woff2); an old user agent makes Google serve TTF. */
async function font(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
  }).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error(`font ${family} not found`);
  return fetch(url).then((r) => r.arrayBuffer());
}

/** The share preview: the call filed as a form on a dark desk, verdict stamped in the corner. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const receipt = await sharedReceipt((await params).slug);
  const [form, mono] = await Promise.all([font("Montserrat", 800), font("IBM Plex Mono", 500)]);
  const s = receipt ? stamp[receipt.outcome] : stamp.open;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e15" }}>
        <div
          style={{
            width: 1040,
            height: 500,
            display: "flex",
            flexDirection: "column",
            padding: "36px 44px",
            background: "#f1ede3",
            border: "4px solid #151515",
            boxShadow: "12px 14px 0 rgba(0,0,0,0.5)",
            transform: "rotate(-1.2deg)",
            color: INK,
            fontFamily: "Mono",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `4px solid ${INK}`, paddingBottom: 14 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "Form", fontSize: 30, letterSpacing: 2 }}>DEPARTMENT OF RECEIPTS</span>
              <span style={{ fontFamily: "Form", fontSize: 16, color: MUTED, letterSpacing: 3 }}>FORM RC-1 · CALL RECORD</span>
            </div>
            <span style={{ border: `3px solid ${INK}`, padding: "4px 12px", fontSize: 24 }}>CASE #{receipt?.id ?? ""}</span>
          </div>

          <span style={{ fontFamily: "Form", fontSize: 16, color: MUTED, letterSpacing: 3, marginTop: 22 }}>
            STATEMENT · {receipt ? `${receipt.author} · ${receipt.madeAt}` : ""}
          </span>
          <div style={{ display: "flex", marginTop: 10 }}>
            <span style={{ fontSize: 50, lineHeight: 1.25, background: "#8fe3a6", padding: "2px 14px" }}>
              {receipt?.quote ?? "Your group chat finally keeps receipts."}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 22, color: MUTED }}>
              {receipt && <span>{receipt.claim} · judged {receipt.deadline}</span>}
              {receipt?.note && <span style={{ marginTop: 6 }}>{receipt.note}</span>}
              <span style={{ marginTop: 14, fontFamily: "Form", fontSize: 16, letterSpacing: 3 }}>FILED ON WALRUS · PRICED VIA TATUM</span>
            </div>
            <span
              style={{
                fontFamily: "Form",
                fontSize: 50,
                color: s.color,
                border: `7px double ${s.color}`,
                borderRadius: 8,
                padding: "6px 22px",
                letterSpacing: 4,
                transform: "rotate(-8deg)",
              }}
            >
              {s.label}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Form", data: form, weight: 800, style: "normal" },
        { name: "Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
