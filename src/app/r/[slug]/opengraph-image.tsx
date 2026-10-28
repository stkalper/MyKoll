import { ImageResponse } from "next/og";
import { sharedReceipt } from "@/lib/receipts";

export const alt = "A call and how it turned out";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = {
  win: { label: "✓ CALLED IT", color: "#9be3b4" },
  loss: { label: "✗ MISSED", color: "#f2a3a3" },
  open: { label: "◷ OPEN", color: "#8a8a8a" },
  void: { label: "— VOID", color: "#8a8a8a" },
} as const;

/** Manrope as TTF (ImageResponse can't read woff2); an old user agent makes Google serve TTF. */
async function font(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Manrope:wght@${weight}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
  }).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) throw new Error("font not found");
  return fetch(url).then((r) => r.arrayBuffer());
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const receipt = await sharedReceipt((await params).slug);
  const [light, bold] = await Promise.all([font(300), font(600)]);
  const m = receipt ? mark[receipt.outcome] : mark.open;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#f4f4f4",
          fontFamily: "Manrope",
          background: "radial-gradient(70% 60% at 50% -10%, #3a3a3a, #050505 70%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, letterSpacing: 6, color: "#8a8a8a" }}>
          <span>RECEIPT #{receipt?.id ?? ""}</span>
          <span style={{ color: m.color, fontWeight: 600, letterSpacing: 2 }}>{m.label}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 32, color: "#8a8a8a" }}>
            {receipt ? `${receipt.author} · ${receipt.madeAt}` : "Receipts"}
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.1, marginTop: 16 }}>“{receipt?.quote ?? "Your group chat finally keeps receipts."}”</span>
          {receipt?.note && <span style={{ fontSize: 32, color: "#8a8a8a", marginTop: 24 }}>{receipt.note}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8a8a8a" }}>
          <span style={{ fontWeight: 600, color: "#f4f4f4" }}>Receipts</span>
          <span>stored on Walrus · priced via Tatum</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: light, weight: 300, style: "normal" },
        { name: "Manrope", data: bold, weight: 600, style: "normal" },
      ],
    },
  );
}
