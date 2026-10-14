"use client";

import { FileAudio, ImageIcon, Plus, Video, X } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createArtist, finishRelease, startRelease } from "@/app/actions";
import type { ArtistDTO } from "@/lib/data";
import { bytes } from "@/lib/when";
import { put } from "../library/uploader";
import { Button, cn, Dialog } from "../ui";

const AUDIO = "audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/aac,audio/mp4,audio/x-m4a";
const IMAGE = "image/jpeg,image/png,image/webp";
const VIDEO = "video/mp4,video/quicktime,video/webm";

const spec = (f: File) => ({ fileName: f.name, size: f.size, mimeType: f.type || "application/octet-stream" });

export function NewReleaseButton({ artists: initial }: { artists: ArtistDTO[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        Nuevo lanzamiento
      </Button>
      <NewReleaseDialog open={open} onClose={() => setOpen(false)} artists={initial} />
    </>
  );
}

function NewReleaseDialog({ open, onClose, artists: initial }: { open: boolean; onClose: () => void; artists: ArtistDTO[] }) {
  const router = useRouter();
  const [artists, setArtists] = useState(initial);
  const [artistId, setArtistId] = useState(initial[0]?.id ?? "");
  const [newArtist, setNewArtist] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [clips, setClips] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  const total = (audio?.size ?? 0) + (cover?.size ?? 0) + clips.reduce((a, c) => a + c.size, 0);
  const problems = [!artistId && !newArtist.trim() && "Elegí el artista.", !title.trim() && "Poné el nombre del tema.", !date && "Elegí la fecha.", !audio && "Falta el audio del tema."].filter(Boolean) as string[];

  async function submit() {
    setProgress(0);
    try {
      let aid = artistId;
      if (!aid) {
        const r = await createArtist(newArtist);
        if (!r.ok) throw new Error(r.error);
        aid = r.artist.id;
        setArtists((l) => [...l, r.artist]);
        setArtistId(aid);
      }
      const r = await startRelease({ artistId: aid, title, releaseDate: date, lyrics, audio: spec(audio!), cover: cover ? spec(cover) : null, clips: clips.map(spec) });
      if (!r.ok) throw new Error(r.error);
      const jobs: [File, { url: string; headers: Record<string, string> }][] = [[audio!, r.audio]];
      if (cover && r.cover) jobs.push([cover, r.cover]);
      clips.forEach((c, i) => jobs.push([c, r.clips[i]!.upload]));
      const done = new Map<File, number>();
      for (const [file, target] of jobs) {
        await put(target.url, target.headers, file, (p) => {
          done.set(file, p * file.size);
          setProgress([...done.values()].reduce((a, b) => a + b, 0) / Math.max(1, total));
        });
      }
      const fin = await finishRelease(r.releaseId);
      if (!fin.ok) throw new Error(fin.error);
      toast.success("Subido. El worker arranca el análisis.");
      onClose();
      router.push(`/lanzamientos/${r.releaseId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setProgress(null);
    }
  }

  const field = "h-9 w-full rounded-md border border-line-strong bg-ink-3 px-3 text-sm placeholder:text-fg-3";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && progress === null && onClose()}
      title="Nuevo lanzamiento"
      description="Subí el tema y la fecha. El sistema analiza el audio, renderiza las piezas y propone la campaña de D−14 a D+30."
      width="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-fg-3">{progress !== null ? `Subiendo ${Math.round(progress * 100)}% de ${bytes(total)}` : problems[0] ?? `${bytes(total)} para subir`}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={progress !== null}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={submit} loading={progress !== null} disabled={problems.length > 0}>
              Subir y analizar
            </Button>
          </div>
        </div>
      }
    >
      {progress !== null && (
        <div className="h-0.5 bg-white/5">
          <motion.div className="h-full bg-orange" animate={{ width: `${progress * 100}%` }} transition={{ ease: "easeOut" }} />
        </div>
      )}
      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Artista</span>
            {artists.length ? (
              <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={field}>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="">Otro artista…</option>
              </select>
            ) : null}
            {(!artists.length || !artistId) && (
              <input value={newArtist} onChange={(e) => setNewArtist(e.target.value)} placeholder="Nombre del artista" className={cn(field, artists.length && "mt-2")} />
            )}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Fecha de lanzamiento</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(field, "font-mono tabular [color-scheme:dark]")} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Tema</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del tema" className={field} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <FilePick label="Audio del tema" hint="WAV, MP3, FLAC o M4A" accept={AUDIO} icon={<FileAudio className="size-4" />} file={audio} onFile={setAudio} />
          <FilePick label="Portada" hint="JPG o PNG cuadrada" accept={IMAGE} icon={<ImageIcon className="size-4" />} file={cover} onFile={setCover} />
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium">Material crudo (opcional)</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-fg-2 hover:border-orange/50 hover:text-fg">
            <Video className="size-4 text-orange" />
            Videos de estudio, show o videoclip para las piezas detrás de escena
            <input type="file" accept={VIDEO} multiple hidden onChange={(e) => e.target.files && setClips((c) => [...c, ...e.target.files!])} />
          </label>
          {clips.length > 0 && (
            <ul className="mt-2 space-y-1">
              {clips.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-fg-2">
                  <span className="truncate">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono tabular text-fg-3">{bytes(c.size)}</span>
                    <button onClick={() => setClips((l) => l.filter((_, j) => j !== i))} aria-label={`Quitar ${c.name}`} className="text-fg-3 hover:text-fg">
                      <X className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Letra (opcional)</span>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={3}
            placeholder="Si el tema tiene voz, la letra se transcribe sola. Pegala acá solo si querés tenerla a mano."
            className="w-full rounded-md border border-line-strong bg-ink-3 px-3 py-2 text-sm placeholder:text-fg-3"
          />
        </label>
      </div>
    </Dialog>
  );
}

function FilePick({ label, hint, accept, icon, file, onFile }: { label: string; hint: string; accept: string; icon: ReactNode; file: File | null; onFile: (f: File | null) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <label
        className={cn(
          "flex h-[58px] cursor-pointer items-center gap-2.5 rounded-md border px-3 text-[13px] transition-colors",
          file ? "border-line-strong bg-ink-3 text-fg" : "border-dashed border-line-strong text-fg-2 hover:border-orange/50 hover:text-fg",
        )}
      >
        <span className={file ? "text-ok" : "text-orange"}>{icon}</span>
        <span className="min-w-0">
          <span className="block truncate">{file ? file.name : "Elegir archivo"}</span>
          <span className="block text-xs text-fg-3">{file ? bytes(file.size) : hint}</span>
        </span>
        <input type="file" accept={accept} hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}
