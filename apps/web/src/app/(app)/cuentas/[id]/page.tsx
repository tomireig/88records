import { db } from "@88/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_LABEL } from "@/lib/status";
import { requireSession } from "@/lib/auth";
import { when } from "@/lib/when";

const DOT: Record<string, string> = {
  scheduled: "bg-fg",
  publishing: "bg-busy animate-pulse-soft",
  processing: "bg-busy animate-pulse-soft",
  in_drafts: "bg-warn",
  published: "bg-ok",
  failed: "bg-bad",
  canceled: "bg-fg-3",
};

export default async function AccountHistory({ params }: { params: Promise<{ id: string }> }) {
  const { org } = await requireSession();
  const { id } = await params;
  const account = await db.tikTokAccount.findFirst({ where: { id, organizationId: org.id } });
  if (!account) notFound();
  const posts = await db.tikTokPost.findMany({
    where: { accountId: id },
    include: { video: { select: { title: true } } },
    orderBy: { scheduledFor: "desc" },
    take: 200,
  });

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <Link href="/cuentas" className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Volver a cuentas">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Historial de {account.displayName}</h1>
      </header>
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        {posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-3">Esta cuenta todavía no tiene publicaciones.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-fg-3">
              <tr className="border-b border-line">
                <th className="py-2 pr-4 font-normal">Fecha</th>
                <th className="py-2 pr-4 font-normal">Video</th>
                <th className="py-2 pr-4 font-normal">Estado</th>
                <th className="hidden py-2 font-normal md:table-cell">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {posts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-4 font-mono whitespace-nowrap tabular">{when(p.scheduledFor, org.timezone)}</td>
                  <td className="max-w-[240px] truncate py-2.5 pr-4">{p.video.title}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${DOT[p.status]}`} />
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="hidden py-2.5 text-fg-3 md:table-cell">
                    {p.failReason ?? (p.publicPostId ? <span className="font-mono tabular">ID {p.publicPostId}</span> : p.mode === "draft" ? "Borrador" : "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
