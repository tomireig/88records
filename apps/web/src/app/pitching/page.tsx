import { db } from "@88/db";
import Link from "next/link";
import {
  createCurator,
  createPitch,
  deleteCurator,
  deletePitch,
  setPitchStage,
  updatePitch,
} from "@/app/actions/pitching";
import { ConfirmButton } from "@/components/confirm-button";
import { Generator } from "@/components/generator";
import { Empty, PageHeader, Pill, Section } from "@/components/ui";
import { fmt, relative, today } from "@/lib/dates";
import { PITCH_ORDER, PITCH_STAGES, num } from "@/lib/labels";

export const dynamic = "force-dynamic";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Cuántos géneros del track aparecen en los del curador. */
function matchScore(trackGenre: string | null, curatorGenres: string[]) {
  if (!trackGenre) return 0;
  const wanted = trackGenre.split(/[,/]/).map(norm).filter(Boolean);
  const has = curatorGenres.map(norm);
  return wanted.filter((g) => has.some((h) => h.includes(g) || g.includes(h))).length;
}

export default async function PitchingPage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track: trackParam } = await searchParams;
  const now = today();

  const [tracks, curators, pitches] = await Promise.all([
    db.track.findMany({ include: { artist: true }, orderBy: { createdAt: "desc" } }),
    db.curator.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { pitches: true } } } }),
    db.pitch.findMany({ include: { curator: true, track: { include: { artist: true } } }, orderBy: { createdAt: "desc" } }),
  ]);

  const selected = tracks.find((t) => t.id === trackParam) ?? tracks[0];
  const pitchedForSelected = new Set(pitches.filter((p) => p.trackId === selected?.id).map((p) => p.curatorId));
  const matches = selected
    ? curators
        .map((c) => ({ c, score: matchScore(selected.genre, c.genres) }))
        .sort((a, b) => b.score - a.score || (b.c.followers ?? 0) - (a.c.followers ?? 0))
    : [];

  return (
    <>
      <PageHeader tag="Pitching" title="Curadores" />

      <Section title="Pipeline">
        {pitches.length === 0 ? (
          <Empty>Sin pitches. Elegí un track en Matching y sumá curadores.</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="grid min-w-[1000px] grid-cols-5 gap-3">
              {PITCH_ORDER.map((stage) => {
                const col = pitches.filter((p) => p.stage === stage);
                return (
                  <div key={stage} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
                      <p className="tag">{PITCH_STAGES[stage]}</p>
                      <span className="text-xs tabular-nums text-mute">{col.length}</span>
                    </div>
                    {col.map((p) => {
                      const followUpDue = p.followUpAt && p.followUpAt <= now && (stage === "SENT" || stage === "FOLLOW_UP");
                      return (
                        <article key={p.id} className={`box p-3 text-sm ${followUpDue ? "border-ultra" : ""}`}>
                          <p className="font-bold leading-tight">{p.curator.playlist}</p>
                          <p className="text-xs text-mute">{p.curator.name}</p>
                          <p className="mt-1 text-xs">{p.track.title} · {p.track.artist.name}</p>
                          {p.followUpAt && (stage === "SENT" || stage === "FOLLOW_UP") && (
                            <p className={`mt-1 text-xs ${followUpDue ? "font-bold text-ultra" : "text-mute"}`}>
                              Follow-up {relative(p.followUpAt, now)}
                            </p>
                          )}
                          {stage === "ACCEPTED" && p.adds > 0 && <p className="mt-1 text-xs font-bold">{num(p.adds)} adds</p>}
                          <form action={setPitchStage} className="mt-2 flex gap-1">
                            <input type="hidden" name="id" value={p.id} />
                            <select name="stage" defaultValue={p.stage} className="input py-1 text-xs">
                              {PITCH_ORDER.map((s) => (
                                <option key={s} value={s}>{PITCH_STAGES[s]}</option>
                              ))}
                            </select>
                            <button className="btn btn-sm">OK</button>
                          </form>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-mute">
                              Costo y resultado
                            </summary>
                            <form action={updatePitch} className="mt-2 grid gap-2">
                              <input type="hidden" name="id" value={p.id} />
                              <div className="grid grid-cols-2 gap-2">
                                <label className="field">
                                  Costo USD
                                  <input name="costUsd" inputMode="decimal" defaultValue={p.costUsd || ""} className="input" />
                                </label>
                                <label className="field">
                                  Adds
                                  <input name="adds" inputMode="numeric" defaultValue={p.adds || ""} className="input" />
                                </label>
                              </div>
                              <textarea name="message" rows={3} defaultValue={p.message ?? ""} placeholder="Mensaje enviado" className="input" />
                              <button className="btn btn-primary btn-sm">Guardar</button>
                            </form>
                            <form action={deletePitch} className="mt-2">
                              <input type="hidden" name="id" value={p.id} />
                              <ConfirmButton message="¿Borrar este pitch?">Borrar</ConfirmButton>
                            </form>
                          </details>
                          {p.sentAt && <p className="mt-2 text-[10px] text-mute">Enviado {fmt.short(p.sentAt)}</p>}
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      <Section title="Matching por género">
        {tracks.length === 0 ? (
          <Empty>Cargá tracks en el Catálogo para hacer matching.</Empty>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {tracks.map((t) => (
                <Link
                  key={t.id}
                  href={`/pitching?track=${t.id}`}
                  className={`btn btn-sm ${selected?.id === t.id ? "bg-ink text-paper" : ""}`}
                >
                  {t.title}
                </Link>
              ))}
            </div>
            {selected && !selected.genre && (
              <p className="mb-3 text-sm text-orange">Este track no tiene género cargado. Sin género no hay matching.</p>
            )}
            {matches.length === 0 ? (
              <Empty>No hay curadores cargados.</Empty>
            ) : (
              <ul className="divide-y divide-line border border-ink">
                {matches.map(({ c, score }) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    {score > 0 ? <Pill tone="orange">Match</Pill> : <Pill tone="mute">Sin match</Pill>}
                    <div className="min-w-0 flex-1">
                      <span className="font-bold">{c.playlist}</span>{" "}
                      <span className="text-mute">· {c.name} · {c.genres.join(", ") || "sin géneros"}</span>
                    </div>
                    {c.followers != null && <span className="text-xs tabular-nums text-mute">{num(c.followers)} seg.</span>}
                    {pitchedForSelected.has(c.id) ? (
                      <span className="text-xs text-mute">Ya está en el pipeline</span>
                    ) : (
                      <form action={createPitch}>
                        <input type="hidden" name="curatorId" value={c.id} />
                        <input type="hidden" name="trackId" value={selected!.id} />
                        <button className="btn btn-sm">Sumar al pipeline</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title="Pitch editorial y DMs">
        <Generator
          kinds={["pitch", "dm_es", "dm_en"]}
          tracks={tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist.name, genre: t.genre, mood: t.mood }))}
          curators={curators.map((c) => ({ id: c.id, name: c.name, playlist: c.playlist }))}
        />
      </Section>

      <Section title="CRM de curadores">
        {curators.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Playlist</th>
                  <th>Curador</th>
                  <th>Géneros</th>
                  <th>Seguidores</th>
                  <th>Contacto</th>
                  <th>Idioma</th>
                  <th>Pitches</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {curators.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noreferrer" className="underline">{c.playlist}</a>
                      ) : (
                        c.playlist
                      )}
                    </td>
                    <td>{c.name}</td>
                    <td className="text-xs">{c.genres.join(", ")}</td>
                    <td className="tabular-nums">{c.followers != null ? num(c.followers) : "—"}</td>
                    <td className="text-xs">{[c.email, c.instagram].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="uppercase">{c.language}</td>
                    <td className="tabular-nums">{c._count.pitches}</td>
                    <td>
                      <form action={deleteCurator}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton message={`¿Borrar a ${c.name} y sus pitches?`}>Borrar</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form action={createCurator} className="box grid gap-3 p-4 md:grid-cols-4">
          <label className="field">
            Curador
            <input name="name" required className="input" />
          </label>
          <label className="field">
            Playlist
            <input name="playlist" required className="input" />
          </label>
          <label className="field md:col-span-2">
            Link de la playlist
            <input name="url" type="url" className="input" />
          </label>
          <label className="field md:col-span-2">
            Géneros (separados por coma)
            <input name="genres" placeholder="reggaetón, urbano, techengue" className="input" />
          </label>
          <label className="field">
            Seguidores
            <input name="followers" inputMode="numeric" className="input" />
          </label>
          <label className="field">
            Idioma
            <select name="language" className="input">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          </label>
          <label className="field">
            Email
            <input name="email" type="email" className="input" />
          </label>
          <label className="field">
            Instagram
            <input name="instagram" placeholder="@usuario" className="input" />
          </label>
          <label className="field md:col-span-2">
            Notas
            <input name="notes" className="input" />
          </label>
          <div>
            <button className="btn btn-primary">Agregar curador</button>
          </div>
        </form>
      </Section>
    </>
  );
}
