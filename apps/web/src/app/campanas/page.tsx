import { db } from "@88/db";
import Link from "next/link";
import { createCampaign } from "@/app/actions/campaigns";
import { Empty, PageHeader, Pill, Section } from "@/components/ui";
import { fmt, relative, today } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { CAMPAIGN_STATUS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const now = today();
  const [campaigns, tracks] = await Promise.all([
    db.campaign.findMany({
      orderBy: { releaseDate: "asc" },
      include: { tasks: { select: { doneAt: true, dueDate: true } }, track: { include: { artist: true } } },
    }),
    db.track.findMany({ include: { artist: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader tag="Campañas" title="Lanzamientos" />

      <Section title="Nueva campaña">
        <form action={createCampaign} className="box grid gap-3 p-4 md:grid-cols-4 md:items-end">
          <label className="field md:col-span-2">
            Track
            <select name="trackId" className="input" defaultValue="">
              <option value="">Sin track (poné un nombre)</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.artist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Nombre
            <input name="name" className="input" placeholder="Opcional si elegís track" />
          </label>
          <label className="field">
            Fecha de release
            <input name="releaseDate" type="date" required className="input" />
          </label>
          <p className="text-xs text-mute md:col-span-3">
            Se crean 15 tareas con fechas reales, de D−28 (subir a la distribuidora) a D+30 (retro).
          </p>
          <SubmitButton className="btn btn-primary" pendingText="Agregando…">Crear campaña</SubmitButton>
        </form>
      </Section>

      <Section title="Todas">
        {campaigns.length === 0 ? (
          <Empty>Todavía no hay campañas.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((c) => {
              const done = c.tasks.filter((t) => t.doneAt).length;
              const late = c.tasks.filter((t) => !t.doneAt && t.dueDate < now).length;
              const progress = c.tasks.length ? done / c.tasks.length : 0;
              return (
                <Link key={c.id} href={`/campanas/${c.id}`} className="box block p-4 hover:border-orange">
                  <div className="flex items-start justify-between gap-2">
                    <p className="tag text-mute">{CAMPAIGN_STATUS[c.status]}</p>
                    {late > 0 && c.status !== "DONE" && <Pill tone="orange">{late} {late === 1 ? "vencida" : "vencidas"}</Pill>}
                  </div>
                  <p className="mt-2 text-xl font-bold uppercase leading-tight">{c.name}</p>
                  <p className="mt-1 text-sm text-mute">
                    Release {fmt.long(c.releaseDate)} · {relative(c.releaseDate, now)}
                  </p>
                  <div className="mt-4 h-1.5 w-full bg-line">
                    <div className="h-full bg-ultra" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-mute">
                    {done}/{c.tasks.length} tareas
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
