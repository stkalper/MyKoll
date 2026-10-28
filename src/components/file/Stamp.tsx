import type { Outcome } from "@/lib/view";

const verdicts: Record<Outcome, { label: string; className: string }> = {
  win: { label: "Called it", className: "text-stamp-win" },
  loss: { label: "Missed", className: "text-stamp-loss" },
  open: { label: "Pending", className: "text-stamp-open" },
  void: { label: "Void", className: "text-stamp-open" },
};

/** The verdict, stamped onto the form. */
export function Stamp({ outcome, date, className = "" }: { outcome: Outcome; date?: string; className?: string }) {
  const v = verdicts[outcome];
  return (
    <span className={`stamp text-center ${v.className} ${className}`}>
      <span className="block text-lg leading-tight">{v.label}</span>
      {date && <span className="block text-[0.6rem] tracking-[0.15em]">{date}</span>}
    </span>
  );
}
