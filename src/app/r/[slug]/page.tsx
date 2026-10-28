import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { sharedReceipt } from "@/lib/receipts";

const verdict = { win: "called it", loss: "missed", open: "is still open", void: "was voided" } as const;

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const receipt = await sharedReceipt((await params).slug);
  if (!receipt) return { title: "MyKoll" };
  return {
    title: `${receipt.author} ${verdict[receipt.outcome]} · MyKoll`,
    description: `“${receipt.quote}” — ${receipt.claim}, judged ${receipt.deadline}.`,
  };
}

async function Receipt({ params }: { params: PageProps<"/r/[slug]">["params"] }) {
  const receipt = await sharedReceipt((await params).slug);
  if (!receipt) notFound();
  return <ReceiptCard call={receipt} tilt={-0.8} />;
}

/** A single receipt anyone with the link can see, e.g. shared to X. */
export default function SharedReceipt({ params }: PageProps<"/r/[slug]">) {
  return (
    <main className="glow flex flex-1 flex-col items-center px-4 py-16">
      <Link href="/" className="font-form text-lg font-extrabold uppercase tracking-[0.06em]">
        MyKoll
      </Link>
      <div className="mt-10 w-full max-w-md">
        <Suspense fallback={<div className="paper h-96 w-full animate-pulse rounded-sm" />}>
          <Receipt params={params} />
        </Suspense>
      </div>
      <p className="mt-10 max-w-sm text-center text-sm text-muted">Your group chat keeps receipts too. Calls get filed, judged at the deadline, and remembered on Walrus.</p>
      <Link
        href="/"
        className="mt-6 rounded-md border-2 border-outline px-6 py-3 font-form text-sm font-extrabold uppercase tracking-wider text-ink shadow-[4px_4px_0_rgba(0,0,0,0.55)]"
        style={{ background: "var(--hl)" }}
      >
        Get MyKoll for your chat
      </Link>
    </main>
  );
}
