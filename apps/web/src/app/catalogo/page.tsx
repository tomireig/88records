import { db, type Artist, type Track } from "@88/db";
import { createArtist, createTrack, deleteTrack, updateTrack } from "@/app/actions/catalog";
import { ConfirmButton } from "@/components/confirm-button";
import { Empty, PageHeader, Pill, Section } from "@/components/ui";
import { fmt, toDateInput } from "@/lib/dates";
import { TRACK_STATUS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const mmss = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

function TrackFields({ artists, track }: { artists: Artist[]; track?: Track }) {
  return (
    <>
      <label className="field md:col-span-2">
        Título
        <input name="title" required defaultValue={track?.title} className="input" />
      </label>
      <label className="field">
        Artista
        <select name="artistId" required defaultValue={track?.artistId ?? artists[0]?.id} className="input">
          {artists.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Estado
        <select name="status" defaultValue={track?.status ?? "DEMO"} className="input">
          {Object.entries(TRACK_STATUS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Género
        <input name="genre" defaultValue={track?.genre ?? ""} placeholder="reggaetón, techengue…" className="input" />
      </label>
      <label className="field">
        Mood
        <input name="mood" defaultValue={track?.mood ?? ""} placeholder="perreo, previa, triste…" className="input" />
      </label>
      <label className="field">
        BPM
        <input name="bpm" inputMode="numeric" defaultValue={track?.bpm ?? ""} className="input" />
      </label>
      <label className="field">
        Tonalidad
        <input name="musicalKey" defaultValue={track?.musicalKey ?? ""} placeholder="Am, F#m…" className="input" />
      </label>
      <label className="field">
        Duración
        <input name="duration" defaultValue={mmss(track?.durationSec ?? null)} placeholder="3:12" className="input" />
      </label>
      <label className="field">
        ISRC
        <input name="isrc" defaultValue={track?.isrc ?? ""} className="input" />
      </label>
      <label className="field">
        Release
        <input name="releaseDate" type="date" defaultValue={toDateInput(track?.releaseDate)} className="input" />
      </label>
      <label className="field md:col-span-4">
        Notas
        <input name="notes" defaultValue={track?.notes ?? ""} className="input" />
      </label>
    </>
  );
}

export default async function CatalogPage() {
  const [artists, tracks] = await Promise.all([
    db.artist.findMany({ orderBy: { name: "asc" } }),
    db.track.findMany({ include: { artist: true }, orderBy: [{ releaseDate: "desc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <>
      <PageHeader tag="Catálogo" title="Tracks" />

      <Section title="Tracks del sello">
        {tracks.length === 0 ? (
          <Empty>Todavía no cargaste tracks.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Track</th>
                  <th>Estado</th>
                  <th>Género / mood</th>
                  <th>BPM</th>
                  <th>Key</th>
                  <th>Dur.</th>
                  <th>Release</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tracks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <p className="font-bold">{t.title}</p>
                      <p className="text-xs text-mute">{t.artist.name}{t.isrc && ` · ${t.isrc}`}</p>
                    </td>
                    <td>
                      <Pill tone={t.status === "RELEASED" ? "orange" : t.status === "READY" ? "ultra" : "ink"}>
                        {TRACK_STATUS[t.status]}
                      </Pill>
                    </td>
                    <td className="text-xs">{[t.genre, t.mood].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="tabular-nums">{t.bpm ?? "—"}</td>
                    <td>{t.musicalKey ?? "—"}</td>
                    <td className="tabular-nums">{mmss(t.durationSec) || "—"}</td>
                    <td className="tabular-nums">{t.releaseDate ? fmt.short(t.releaseDate) : "—"}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest">Editar</summary>
                        <form action={updateTrack} className="mt-2 grid min-w-[600px] gap-2 md:grid-cols-4">
                          <input type="hidden" name="id" value={t.id} />
                          <TrackFields artists={artists} track={t} />
                          <button className="btn btn-primary btn-sm">Guardar</button>
                        </form>
                        <form action={deleteTrack} className="mt-2">
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton message={`¿Borrar "${t.title}"? También se borran sus pitches.`}>Borrar</ConfirmButton>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Nuevo track">
        {artists.length === 0 ? (
          <Empty>Primero cargá un artista abajo.</Empty>
        ) : (
          <form action={createTrack} className="box grid gap-3 p-4 md:grid-cols-4">
            <TrackFields artists={artists} />
            <div>
              <button className="btn btn-primary">Agregar track</button>
            </div>
          </form>
        )}
      </Section>

      <Section title="Artistas">
        <div className="mb-3 flex flex-wrap gap-2">
          {artists.map((a) => (
            <Pill key={a.id}>{a.name}{a.country && ` · ${a.country}`}</Pill>
          ))}
        </div>
        <form action={createArtist} className="box grid gap-3 p-4 md:grid-cols-4 md:items-end">
          <label className="field md:col-span-2">
            Nombre
            <input name="name" required className="input" />
          </label>
          <label className="field">
            País
            <input name="country" placeholder="AR, CL, PR" className="input" />
          </label>
          <button className="btn">Agregar artista</button>
        </form>
      </Section>
    </>
  );
}
