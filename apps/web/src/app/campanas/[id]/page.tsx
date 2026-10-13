import { db } from "@88/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteCampaign, moveRelease, setCampaignStatus, toggleTask } from "@/app/actions/campaigns";
import { generateBatch } from "@/app/actions/content";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, Pill, Section } from "@/components/ui";
import { dLabel, fmt, relative, toDateInput, today } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { CAMPAIGN_STATUS, FORMATS, PLATFORMS, STAGES, num } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = today();
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: [{ offsetDays: "asc" }, { title: "asc" }] },
      pieces: { orderBy: { scheduledFor: "asc" } },
      track: { include: { artist: true } },
    },
  });
  if (!campaign) notFound();

  const done = campaign.tasks.filter((t) => t.doneAt).length;

  return (
    <>
      <PageHeader tag="Campaña" title={campaign.name}>
        <form action={setCampaignStatus} className="flex gap-2">
          <input type="hidden" name="id" value={campaign.id} />
          <select name="status" defaultValue={campaign.status} className="input w-auto">
            {Object.entries(CAMPAIGN_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <SubmitButton className="btn" pendingText="Guardando…">Guardar</SubmitButton>
        </form>
      </PageHeader>

      <div className="mb-8 flex flex-wrap items-end gap-6 text-sm">
        <div>
          <p className="tag text-mute">Release</p>
          <p className="text-2xl font-bold">{fmt.long(campaign.releaseDate)}</p>
          <p className="text-mute">{relative(campaign.releaseDate, now)}</p>
        </div>
        {campaign.track && (
          <div>
            <p className="tag text-mute">Track</p>
            <p className="text-2xl font-bold">{campaign.track.title}</p>
            <p className="text-mute">{campaign.track.artist.name}</p>
          </div>
        )}
        <div>
          <p className="tag text-mute">Avance</p>
          <p className="text-2xl font-bold tabular-nums">
            {done}/{campaign.tasks.length}
          </p>
        </div>
        <form action={moveRelease} className="flex items-end gap-2">
          <input type="hidden" name="id" value={campaign.id} />
          <label className="field">
            Mover release
            <input type="date" name="releaseDate" defaultValue={toDateInput(campaign.releaseDate)} className="input" />
          </label>
          <SubmitButton className="btn" pendingText="Guardando…">Mover</SubmitButton>
        </form>
      </div>

      <Section title="Tareas">
        <ol className="border border-ink">
          {campaign.tasks.map((t) => {
            const late = !t.doneAt && t.dueDate < now;
            const isRelease = t.offsetDays === 0;
            return (
              <li
                key={t.id}
                className={`flex items-start gap-3 border-b border-line px-3 py-3 last:border-b-0 ${
                  isRelease ? "bg-orange/10" : ""
                }`}
              >
                <form action={toggleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    aria-label={t.doneAt ? "Desmarcar" : "Marcar como hecha"}
                    className={`mt-0.5 h-5 w-5 shrink-0 border border-ink ${t.doneAt ? "bg-ink" : "hover:bg-orange"}`}
                  />
                </form>
                <span className="w-12 shrink-0 text-xs font-bold tabular-nums">{dLabel(t.offsetDays)}</span>
                <div className={`min-w-0 flex-1 ${t.doneAt ? "text-mute line-through" : ""}`}>
                  <p className="text-sm font-bold">{t.title}</p>
                  {t.detail && <p className="text-xs text-mute">{t.detail}</p>}
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-bold tabular-nums">{fmt.weekday(t.dueDate)}</p>
                  {late && <Pill tone="orange">Vencida</Pill>}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section
        title="Contenido de la campaña"
        aside={
          <form action={generateBatch}>
            <input type="hidden" name="campaignId" value={campaign.id} />
            <SubmitButton className="btn btn-blue btn-sm" pendingText="Generando…">Generar batch 20 piezas</SubmitButton>
          </form>
        }
      >
        {campaign.pieces.length === 0 ? (
          <p className="text-sm text-mute">
            Sin piezas todavía. El batch arranca en D−21 (o hoy si ya pasó) y cubre 4 semanas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pieza</th>
                  <th>Plataforma</th>
                  <th>Formato</th>
                  <th>Estado</th>
                  <th className="text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {campaign.pieces.map((p) => (
                  <tr key={p.id}>
                    <td className="tabular-nums">{p.scheduledFor ? fmt.weekday(p.scheduledFor) : "—"}</td>
                    <td>{p.title}</td>
                    <td>{PLATFORMS[p.platform]}</td>
                    <td>{FORMATS[p.format]}</td>
                    <td>{STAGES[p.stage]}</td>
                    <td className="text-right tabular-nums">{num(p.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href="/contenido" className="mt-2 inline-block text-xs font-bold uppercase underline">
              Ver en el kanban
            </Link>
          </div>
        )}
      </Section>

      <form action={deleteCampaign} className="border-t border-line pt-6">
        <input type="hidden" name="id" value={campaign.id} />
        <ConfirmButton message="¿Borrar la campaña con todas sus tareas? Las piezas de contenido quedan.">
          Borrar campaña
        </ConfirmButton>
      </form>
    </>
  );
}
