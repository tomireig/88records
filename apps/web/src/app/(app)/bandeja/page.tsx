import { db } from "@88/db";
import type { Metadata } from "next";
import { InboxView } from "@/components/inbox/inbox-view";
import { requireSession } from "@/lib/auth";
import { listAccounts, listProposals } from "@/lib/data";

export const metadata: Metadata = { title: "Bandeja" };

export default async function InboxPage() {
  const { org } = await requireSession();
  const [proposals, accounts, recent] = await Promise.all([
    listProposals(org.id),
    listAccounts(org.id, org.timezone),
    db.action.findMany({
      where: { organizationId: org.id, status: { not: "proposed" } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, status: true, reason: true, updatedAt: true, preview: true, scheduledFor: true },
    }),
  ]);
  return (
    <InboxView
      tz={org.timezone}
      proposals={proposals}
      accounts={accounts}
      recent={recent.map((r) => ({
        id: r.id,
        status: r.status,
        updatedAt: r.updatedAt.toISOString(),
        scheduledFor: r.scheduledFor?.toISOString() ?? null,
        title: (r.preview as { videoTitle?: string } | null)?.videoTitle ?? "Acción",
        account: (r.preview as { accountName?: string } | null)?.accountName ?? "",
      }))}
    />
  );
}
