import { db } from "@88/db";
import Link from "next/link";
import { toggleTask } from "@/app/actions/campaigns";
import { clearDemo, loadDemo } from "@/app/actions/demo";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { Empty, PageHeader, Pill, Section, Stat } from "@/components/ui";
import { addDays, dLabel, fmt, relative, today } from "@/lib/dates";
import { num } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const now = today();
  const weekEnd = addDays(now, 7);

  const [tracks, activeCampaigns, views, adds, lastSnapshot, due, followUps, demoArtists, campaignCount] = await Promise.all([
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
    db.artist.count({ where: { demo: true } }),
    db.campaign.count(),
  ]);
  const isEmpty = tracks === 0 && campaignCount === 0;

  const overdue = due.filter((t) => t.dueDate < now).length;

  return (
    <>
      <PageHeader tag="Panel" title="Esta semana">
        <Link href="/campanas" className="btn btn-primary">
          Nueva campaña
        </Link>
      </PageHeader>

      {demoArtists > 0 && (
        <div className="mb-8 flex flex-col gap-3 border border-ink bg-ink px-4 py-3 text-paper md:flex-row md:items-center md:justify-between">
          <p className="text-sm">
            <span className="tag mr-2 text-orange">Ejemplo</span>
            Estás viendo datos de ejemplo: artistas, playlists y números inventados.
          </p>
          <form action={clearDemo}>
            <ConfirmButton message="¿Borrar todos los datos de ejemplo? Lo que cargaste vos queda." className="btn btn-sm border-paper text-paper hover:bg-paper hover:text-ink">
              Borrar ejemplo
            </ConfirmButton>
          </form>
        </div>
      )}

      {isEmpty && (
        <section className="mb-10 grid gap-6 border border-ink p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <p className="tag text-orange">Arranque</p>
            <h2 className="mt-2 text-2xl font-bold uppercase tracking-tight md:text-3xl">Todavía no hay nada cargado</h2>
            <p className="mt-2 max-w-xl text-sm text-mute">
              Cargá tu primer track en el Catálogo y creá una campaña. O cargá un ejemplo completo para ver cómo funciona
              todo: campañas, contenido, pitching y métricas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/catalogo" className="btn">
              Cargar un track
            </Link>
            <form action={loadDemo}>
              <SubmitButton className="btn btn-primary" pendingText="Cargando…">
                Ver ejemplo
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

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
        aside={overdue > 0 ? <Pill tone="orange">{overdue} {overdue === 1 ? "vencida" : "vencidas"}</Pill> : undefined}
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
