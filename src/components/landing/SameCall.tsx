/**
 * One message, answered twice: by a bot that forgets and by MyKoll. Everything under the receipt on
 * the right comes from the chat's Walrus Memory, so the difference is exactly what memory adds.
 */

const receipt = "🧾 Receipt #151 · logged ⚡\nSUI above $5.00 · by Fri 23:59\nSUI $3.42 · on-chain via Tatum Sui RPC";

const recalled = [
  { line: "📊 Jake: Sui tokens 1/4 · ⚠️ a weak spot", from: "TRACK RECORD" },
  { line: "🎯 Memory's chance: 30% (1/4 on Sui tokens)", from: "TRACK RECORD · worked out" },
  { line: "↩ Last time: “WAL to 5 cents by Friday” — ❌ missed", from: "RESULT #142" },
  { line: "🧭 Also on SUI: Max ↓ down (3/3 on SUI calls)\nWeighted by record the chat leans ↓ down (64%)", from: "TRACK RECORD @max" },
];

function Scrap({ label, tilt, children }: { label: string; tilt: number; children: React.ReactNode }) {
  return (
    <div className="drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="ripped bg-paper px-4 text-ink">
        <p className="field-label">{label}</p>
        {children}
      </div>
    </div>
  );
}

export function SameCall() {
  return (
    <div className="mb-14">
      <div className="mx-auto max-w-md drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]" style={{ transform: "rotate(-0.8deg)" }}>
        <div className="ripped bg-[#efe3b8] px-4 text-ink">
          <p className="field-label">Jake · 14:02</p>
          <p className="font-hand text-2xl leading-tight">SUI to $5 by Friday</p>
        </div>
      </div>
      <div className="mt-8 grid items-start gap-8 md:grid-cols-2">
        <Scrap label="A bot that forgets" tilt={-0.6}>
          <p className="whitespace-pre-line font-mono text-xs leading-relaxed">{receipt}</p>
          <p className="mt-3 font-hand text-xl leading-tight text-ink-muted">That&apos;s all it knows.</p>
        </Scrap>
        <Scrap label="MyKoll, with Walrus Memory" tilt={0.6}>
          <p className="whitespace-pre-line font-mono text-xs leading-relaxed">{receipt}</p>
          <ul className="mt-3 space-y-2 border-t-2 border-dashed border-rule pt-3">
            {recalled.map((r) => (
              <li key={r.from}>
                <p className="whitespace-pre-line font-mono text-xs leading-relaxed">
                  <span className="hl">{r.line}</span>
                </p>
                <p className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-ink-muted">recalled · {r.from}</p>
              </li>
            ))}
          </ul>
        </Scrap>
      </div>
      <p className="mt-6 text-center font-hand text-2xl text-muted">Same message. Everything highlighted came back from memory.</p>
    </div>
  );
}
