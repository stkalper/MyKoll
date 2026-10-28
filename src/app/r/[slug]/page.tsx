import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReceiptCard } from "@/components/ReceiptCard";
import { sharedReceipt } from "@/lib/receipts";

const verdict = { win: "called it", loss: "missed", open: "is still open", void: "was voided" } as const;

export async function generateMetadata({ params }: PageProps<"/r/[slug]">): Promise<Metadata> {
  const receipt = await sharedReceipt((await params).slug);
  if (!receipt) return { title: "Receipts" };
  return {
    title: `${receipt.author} ${verdict[receipt.outcome]} · Receipts`,
    description: `“${receipt.quote}” — ${receipt.claim}, judged ${receipt.deadline}.`,
  };
}

async function Receipt({ params }: { params: PageProps<"/r/[slug]">["params"] }) {
  const receipt = await sharedReceipt((await params).slug);
  if (!receipt) notFound();
  return <ReceiptCard call={receipt} />;
}

/** A single receipt anyone with the link can see, e.g. shared to X. */
export default function SharedReceipt({ params }: PageProps<"/r/[slug]">) {
  return (
    <main className="glow flex flex-1 flex-col items-center px-4 py-16">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Receipts
      </Link>
      <div className="mt-10 w-full max-w-sm">
        <Suspense fallback={<div className="glass h-80 w-full animate-pulse rounded-[28px]" />}>
          <Receipt params={params} />
        </Suspense>
      </div>
      <p className="mt-10 max-w-sm text-center text-sm text-muted">Your group chat keeps receipts too. Calls get logged, checked at the deadline, and remembered on Walrus.</p>
      <Link href="/" className="mt-6 rounded-full bg-text px-6 py-3 text-sm font-medium text-bg">
        Get Receipts for your chat
      </Link>
    </main>
  );
}
