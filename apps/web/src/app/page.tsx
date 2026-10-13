import { db } from "@88/db";
import Link from "next/link";
import { toggleTask } from "@/app/actions/campaigns";
import { Empty, PageHeader, Pill, Section, Stat } from "@/components/ui";
import { addDays, dLabel, fmt, relative, today } from "@/lib/dates";
import { num } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const now = today();
  const weekEnd = addDays(now, 7);

  const [tracks, activeCampaigns, views, adds, lastSnapshot, due, followUps] = await Promise.all([
    db.track.count(),
    db.campaign.count({ where: { status: { not: "DONE" } } }),
    db.contentPiece.aggregate({ _sum: { views: true } }),
    db.pitch.aggregate({ _sum: { adds: true } }),
    db.fanSnapshot.findFirst({ orderBy: { month: "desc" } }),
    db.campaignTask.findMany({
      where: { doneAt: null, dueDate: { lte: weekEnd }, campaign: { status: { not: "DONE" } } },
      include: { campaign: true },
      orderBy: { dueDate: "asc" },
    }),
    db.pitch.count({ where: { stage: { in: ["SENT", "FOLLOW_UP"] }, followUpAt: { lte: now } } }),
  ]);

  const overdue = due.filter((t) => t.dueDate < now).length;

  return (
    <>
      <PageHeader tag="Panel" title="Esta semana">
        <Link href="/campanas" className="btn btn-primary">
          Nueva campaña
        </Link>
      </PageHeader>

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Tracks" value={num(tracks)} href="/catalogo" />
        <Stat label="Campañas activas" value={num(activeCampaigns)} href="/campanas" />
        <Stat label="Views" value={num(views._sum.views ?? 0)} href="/analisis" />
        <Stat label="Adds" value={num(adds._sum.adds ?? 0)} href="/pitching" />
        <Stat label="Mails" value={lastSnapshot ? num(lastSnapshot.emailSubs) : "—"} href="/fan-funnel" />
        <Stat label="Superfans" value={lastSnapshot ? num(lastSnapshot.superfans) : "—"} href="/fan-funnel" accent />
      </div>

      {followUps > 0 && (
        <Link href="/pitching" className="mb-8 block border border-ultra bg-ultra px-4 py-3 text-sm font-bold text-paper">
          Tenés {followUps} {followUps === 1 ? "pitch" : "pitches"} para hacer follow-up. Ir a Pitching →
        </Link>
      )}

      <Section
        title="Vencimientos"
        aside={overdue > 0 ? <Pill tone="orange">{overdue} vencidas</Pill> : undefined}
      >
        {due.length === 0 ? (
          <Empty>No hay tareas para los próximos 7 días.</Empty>
        ) : (
          <ul className="divide-y divide-line border border-ink">
            {due.map((t) => {
              const late = t.dueDate < now;
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      aria-label="Marcar como hecha"
                      className="h-5 w-5 shrink-0 border border-ink hover:bg-orange"
                    />
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{t.title}</p>
                    <Link href={`/campanas/${t.campaignId}`} className="text-xs text-mute hover:underline">
                      {t.campaign.name} · {dLabel(t.offsetDays)}
                    </Link>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-bold tabular-nums">{fmt.short(t.dueDate)}</p>
                    <p className={late ? "font-bold text-orange" : "text-mute"}>{relative(t.dueDate, now)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
