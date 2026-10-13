import { db, type Platform } from "@88/db";
import Link from "next/link";
import { createPiece, deletePiece, generateBatch, movePiece, updatePiece } from "@/app/actions/content";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, Pill, Section } from "@/components/ui";
import { fmt, toDateInput, today } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { FORMATS, PLATFORMS, STAGES, STAGE_ORDER, isEnum, num } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ p?: string; todas?: string }> }) {
  const { p, todas } = await searchParams;
  const platform: Platform | undefined = isEnum(PLATFORMS, p) ? p : undefined;
  const now = today();

  const [pieces, campaigns] = await Promise.all([
    db.contentPiece.findMany({
      where: platform ? { platform } : undefined,
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      include: { campaign: { select: { name: true } } },
    }),
    db.campaign.findMany({ where: { status: { not: "DONE" } }, orderBy: { releaseDate: "asc" } }),
  ]);

  return (
    <>
      <PageHeader tag="Contenido" title="Piezas">
        <form action={generateBatch} className="flex gap-2">
          <select name="campaignId" className="input w-auto" defaultValue={campaigns[0]?.id ?? ""}>
            <option value="">Sin campaña (arranca hoy)</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <SubmitButton className="btn btn-blue whitespace-nowrap" pendingText="Generando…">Generar batch 20 piezas</SubmitButton>
        </form>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/contenido" className={`btn btn-sm ${!platform ? "bg-ink text-paper" : ""}`}>
          Todas
        </Link>
        {Object.entries(PLATFORMS).map(([v, l]) => (
          <Link key={v} href={`/contenido?p=${v}`} className={`btn btn-sm ${platform === v ? "bg-ink text-paper" : ""}`}>
            {l}
          </Link>
        ))}
      </div>

      <div className="-mx-4 mb-10 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-[1000px] grid-cols-5 gap-3">
          {STAGE_ORDER.map((stage) => {
            const all = pieces.filter((x) => x.stage === stage);
            // Lo publicado crece sin parar: se ven las últimas 6 salvo que pidas todas.
            const capped = stage === "PUBLISHED" && !todas && all.length > 6;
            const col = capped ? [...all].sort((a, b) => (b.scheduledFor?.getTime() ?? 0) - (a.scheduledFor?.getTime() ?? 0)).slice(0, 6) : all;
            return (
              <div key={stage} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
                  <p className="tag">{STAGES[stage]}</p>
                  <span className="text-xs tabular-nums text-mute">{all.length}</span>
                </div>
                {col.map((piece) => {
                  const late = piece.scheduledFor && piece.scheduledFor < now && stage !== "PUBLISHED";
                  return (
                    <article key={piece.id} className="box p-3 text-sm">
                      <div className="mb-1 flex flex-wrap gap-1">
                        <Pill tone="ultra">{PLATFORMS[piece.platform]}</Pill>
                        <Pill>{FORMATS[piece.format]}</Pill>
                      </div>
                      <p className="font-bold leading-tight">{piece.title}</p>
                      {piece.hook && <p className="mt-1 text-xs text-mute">{piece.hook}</p>}
                      <p className={`mt-2 text-xs tabular-nums ${late ? "font-bold text-orange" : "text-mute"}`}>
                        {piece.scheduledFor ? fmt.weekday(piece.scheduledFor) : "Sin fecha"}
                        {stage === "PUBLISHED" && ` · ${num(piece.views)} views`}
                      </p>
                      <div className="mt-2 flex gap-1">
                        {stage !== "IDEA" && (
                          <form action={movePiece}>
                            <input type="hidden" name="id" value={piece.id} />
                            <input type="hidden" name="dir" value="back" />
                            <button className="btn btn-sm" aria-label="Volver una etapa">←</button>
                          </form>
                        )}
                        {stage !== "PUBLISHED" && (
                          <form action={movePiece}>
                            <input type="hidden" name="id" value={piece.id} />
                            <button className="btn btn-sm">
                              {STAGES[STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1]!]} →
                            </button>
                          </form>
                        )}
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-mute">
                          Editar y métricas
                        </summary>
                        <form action={updatePiece} className="mt-2 grid gap-2">
                          <input type="hidden" name="id" value={piece.id} />
                          <input type="hidden" name="stage" value={piece.stage} />
                          <input name="title" defaultValue={piece.title} className="input" required />
                          <textarea name="hook" defaultValue={piece.hook ?? ""} className="input" rows={2} placeholder="Hook / idea" />
                          <div className="grid grid-cols-2 gap-2">
                            <select name="platform" defaultValue={piece.platform} className="input">
                              {Object.entries(PLATFORMS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                            <select name="format" defaultValue={piece.format} className="input">
                              {Object.entries(FORMATS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <input type="date" name="scheduledFor" defaultValue={toDateInput(piece.scheduledFor)} className="input" />
                          <div className="grid grid-cols-2 gap-2">
                            {(["views", "likes", "comments", "shares", "saves"] as const).map((m) => (
                              <label key={m} className="field">
                                {{ views: "Views", likes: "Likes", comments: "Comentarios", shares: "Shares", saves: "Guardados" }[m]}
                                <input name={m} inputMode="numeric" defaultValue={piece[m] || ""} className="input" />
                              </label>
                            ))}
                          </div>
                          <textarea name="notes" defaultValue={piece.notes ?? ""} className="input" rows={2} placeholder="Notas" />
                          <SubmitButton className="btn btn-primary btn-sm" pendingText="Guardando…">Guardar</SubmitButton>
                        </form>
                        <form action={deletePiece} className="mt-2">
                          <input type="hidden" name="id" value={piece.id} />
                          <ConfirmButton message="¿Borrar esta pieza?">Borrar</ConfirmButton>
                        </form>
                      </details>
                    </article>
                  );
                })}
                {capped && (
                  <Link href={`/contenido?${new URLSearchParams({ ...(platform && { p: platform }), todas: "1" })}`} className="btn btn-sm">
                    Ver las {all.length} publicadas
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Section title="Nueva pieza">
        <form action={createPiece} className="box grid gap-3 p-4 md:grid-cols-3">
          <label className="field md:col-span-2">
            Título
            <input name="title" required className="input" />
          </label>
          <label className="field">
            Fecha
            <input name="scheduledFor" type="date" className="input" />
          </label>
          <label className="field">
            Plataforma
            <select name="platform" className="input" defaultValue={platform ?? "TIKTOK"}>
              {Object.entries(PLATFORMS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Formato
            <select name="format" className="input">
              {Object.entries(FORMATS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Campaña
            <select name="campaignId" className="input" defaultValue="">
              <option value="">Ninguna</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="field md:col-span-3">
            Hook / idea
            <input name="hook" className="input" />
          </label>
          <div>
            <SubmitButton className="btn btn-primary" pendingText="Agregando…">Agregar</SubmitButton>
          </div>
        </form>
      </Section>
    </>
  );
}
