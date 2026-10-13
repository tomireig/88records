"use client";

import { AlertTriangle, CalendarPlus, Copy, MoreHorizontal, Trash2, UploadCloud } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeVideo, updateVideo } from "@/app/actions";
import type { AccountDTO, ArtistDTO, VideoDTO } from "@/lib/data";
import { atLocal, bytes, dayKey, duration } from "@/lib/when";
import { PublishDialog, type PublishTarget } from "../publish/publish-dialog";
import { Avatar, Button, cn, Dialog } from "../ui";
import { DropZone, UploaderProvider, useUploader } from "./uploader";

type Filter = "all" | "ready" | "unused" | "processing" | "failed";

export function LibraryView(props: { tz: string; videos: VideoDTO[]; accounts: AccountDTO[]; artists: ArtistDTO[] }) {
  return (
    <UploaderProvider>
      <Library {...props} />
    </UploaderProvider>
  );
}

function nextSlot(account: AccountDTO, tz: string): string {
  const now = Date.now();
  for (let d = 0; d < 8; d++) {
    const day = dayKey(new Date(now + d * 24 * 3600_000), tz);
    for (const slot of [...account.preferredSlots].sort()) {
      const at = atLocal(day, slot, tz).getTime();
      if (at > now + 10 * 60_000) return new Date(at).toISOString();
    }
  }
  return new Date(now + 3600_000).toISOString();
}

function Library({ tz, videos, accounts, artists }: { tz: string; videos: VideoDTO[]; accounts: AccountDTO[]; artists: ArtistDTO[] }) {
  const router = useRouter();
  const uploader = useUploader();
  const [filter, setFilter] = useState<Filter>("all");
  const [artist, setArtist] = useState<string>("");
  const [pickFor, setPickFor] = useState<VideoDTO | null>(null);
  const [publish, setPublish] = useState<PublishTarget | null>(null);
  const [edit, setEdit] = useState<VideoDTO | null>(null);

  const processing = videos.some((v) => v.status === "processing" || v.status === "uploading");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [processing, router]);

  const counts = useMemo(
    () => ({
      all: videos.length,
      ready: videos.filter((v) => v.status === "ready").length,
      unused: videos.filter((v) => v.status === "ready" && v.usedOn.length === 0).length,
      processing: videos.filter((v) => v.status === "processing" || v.status === "uploading").length,
      failed: videos.filter((v) => v.status === "failed").length,
    }),
    [videos],
  );
  const shown = videos.filter((v) => {
    if (artist && v.artistId !== artist) return false;
    if (filter === "ready") return v.status === "ready";
    if (filter === "unused") return v.status === "ready" && v.usedOn.length === 0;
    if (filter === "processing") return v.status === "processing" || v.status === "uploading";
    if (filter === "failed") return v.status === "failed";
    return true;
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "unused", label: "Sin publicar" },
    { id: "ready", label: "Listos" },
    { id: "processing", label: "Procesando" },
    { id: "failed", label: "Con error" },
  ];

  return (
    <DropZone className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Biblioteca</h1>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs whitespace-nowrap transition-colors",
                filter === f.id ? "border-white/25 bg-white/[0.08] text-fg" : "border-line text-fg-3 hover:text-fg",
              )}
            >
              {f.label}
              <span className="font-mono tabular opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {artists.length > 0 && (
            <select
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="h-8 rounded-md border border-line-strong bg-ink-3 px-2 text-[13px] text-fg-2"
              aria-label="Filtrar por artista"
            >
              <option value="">Todos los artistas</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <Button size="sm" variant="primary" icon={<UploadCloud className="size-3.5" />} onClick={uploader.pick}>
            Subir videos
          </Button>
        </div>
      </header>

      {videos.length === 0 ? (
        <div className="grid flex-1 place-items-center p-8">
          <button
            onClick={uploader.pick}
            className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-10 py-14 text-center hover:border-orange/50"
          >
            <UploadCloud className="size-7 text-orange" />
            <span className="text-base font-medium">Subí los primeros videos</span>
            <span className="text-sm text-fg-2">
              Arrastralos a cualquier parte de esta pantalla. MP4, MOV o WebM, verticales 9:16 idealmente. Se calcula la duración, la miniatura y un hash
              para avisarte si el mismo archivo va a más de una cuenta.
            </span>
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="p-8 text-center text-sm text-fg-3">No hay videos con ese filtro.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:p-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          <AnimatePresence initial={false}>
            {shown.map((v, i) => (
              <motion.article
                key={v.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(i * 0.02, 0.25), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="group overflow-hidden rounded-lg border border-line bg-ink-2 transition-colors hover:border-line-strong"
              >
                <VideoCard video={v} onSchedule={() => setPickFor(v)} onEdit={() => setEdit(v)} />
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AccountPicker
        video={pickFor}
        accounts={accounts}
        onClose={() => setPickFor(null)}
        onPick={(acc) => {
          const v = pickFor!;
          setPickFor(null);
          const base = (acc.captionTemplate || "{titulo}").replaceAll("{titulo}", v.title).trim();
          const tags = acc.hashtags.map((h) => `#${h}`).filter((h) => !base.includes(h)).join(" ");
          setPublish({
            accountId: acc.id,
            accountName: acc.displayName,
            accountColor: acc.color,
            avatarUrl: acc.avatarUrl,
            videoId: v.id,
            at: nextSlot(acc, tz),
            caption: [base, tags].filter(Boolean).join("\n\n"),
          });
        }}
      />
      <PublishDialog
        target={publish}
        tz={tz}
        onClose={(done) => {
          setPublish(null);
          if (done) router.refresh();
        }}
      />
      <EditVideo video={edit} artists={artists} onClose={() => setEdit(null)} />
    </DropZone>
  );
}

function VideoCard({ video: v, onSchedule, onEdit }: { video: VideoDTO; onSchedule: () => void; onEdit: () => void }) {
  const vertical = v.width && v.height ? v.height / v.width > 1.6 : true;
  return (
    <>
      <div className="relative aspect-[9/16] bg-ink-4">
        {v.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumbUrl} alt="" className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        )}
        {(v.status === "processing" || v.status === "uploading") && (
          <div className="skeleton absolute inset-0 grid place-items-center">
            <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs text-fg-2 backdrop-blur">Procesando…</span>
          </div>
        )}
        {v.status === "failed" && (
          <div className="absolute inset-0 grid place-items-center bg-bad/10 p-3 text-center text-xs text-[#ffb3b3]">{v.error}</div>
        )}
        {v.status === "ready" && (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur tabular">
            {duration(v.durationSec)}
          </span>
        )}
        {v.usedOn.length > 0 && (
          <span
            className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur"
            title={`Ya está en ${v.usedOn.map((u) => u.displayName).join(", ")}`}
          >
            <Copy className="size-3" />
            {v.usedOn.length === 1 ? v.usedOn[0]!.displayName : `${v.usedOn.length} cuentas`}
          </span>
        )}
        {v.status === "ready" && (
          <div className="absolute inset-x-1.5 bottom-9 flex justify-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button size="sm" variant="primary" icon={<CalendarPlus className="size-3.5" />} onClick={onSchedule}>
              Programar
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-start gap-1 p-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-medium" title={v.title}>
            {v.title}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-fg-3">
            {v.artistName ?? "Sin artista"} · <span className="font-mono tabular">{bytes(v.sizeBytes)}</span>
            {v.status === "ready" && !vertical && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-warn" title={`${v.width}×${v.height}: TikTok rinde mejor en vertical 9:16`}>
                <AlertTriangle className="size-3" /> no vertical
              </span>
            )}
          </p>
        </div>
        <button onClick={onEdit} className="rounded p-1 text-fg-3 hover:bg-white/5 hover:text-fg" aria-label={`Editar ${v.title}`}>
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </>
  );
}

function AccountPicker({ video, accounts, onClose, onPick }: { video: VideoDTO | null; accounts: AccountDTO[]; onClose: () => void; onPick: (a: AccountDTO) => void }) {
  const usedIds = new Set(video?.usedOn.map((u) => u.id));
  const sorted = [...accounts].sort((a, b) => Number(b.artistId === video?.artistId) - Number(a.artistId === video?.artistId));
  return (
    <Dialog open={Boolean(video)} onOpenChange={(o) => !o && onClose()} title="¿En qué cuenta?" description={video?.title} width="max-w-md">
      {accounts.length === 0 ? (
        <div className="p-5 text-sm text-fg-2">
          Todavía no hay cuentas conectadas.{" "}
          <a href="/api/tiktok/connect" className="text-orange underline">
            Conectar la primera
          </a>
          .
        </div>
      ) : (
        <ul className="p-2">
          {sorted.map((a) => {
            const broken = a.health === "broken";
            return (
              <li key={a.id}>
                <button
                  disabled={broken}
                  onClick={() => onPick(a)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-white/5 disabled:opacity-40"
                >
                  <Avatar src={a.avatarUrl} name={a.displayName} color={a.color} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{a.displayName}</span>
                    <span className="block truncate text-xs text-fg-3">
                      {broken ? "Desconectada" : a.artistName ?? "Sin artista"}
                      {usedIds.has(a.id) && " · ya tiene este video"}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-fg-3 tabular">
                    hoy {a.todayCount}/{a.maxPostsPerDay}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

function EditVideo({ video, artists, onClose }: { video: VideoDTO | null; artists: ArtistDTO[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (video) {
      setTitle(video.title);
      setArtistId(video.artistId ?? "");
    }
  }, [video]);

  return (
    <Dialog open={Boolean(video)} onOpenChange={(o) => !o && onClose()} title="Editar video" width="max-w-md">
      {video && (
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateVideo(video.id, title, artistId || null);
              if (r.ok) {
                toast.success("Guardado");
                onClose();
              } else toast.error(r.error);
            });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-ink-3 px-3 text-sm" />
            <span className="mt-1 block text-xs text-fg-3">Se usa en el caption cuando la plantilla de la cuenta tiene {"{titulo}"}.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Artista</span>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-ink-3 px-2 text-sm">
              <option value="">Sin artista</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={<Trash2 className="size-3.5" />}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!confirm(`¿Borrar "${video.title}"? No se puede deshacer.`)) return;
                  const r = await removeVideo(video.id);
                  if (r.ok) {
                    toast.success("Video borrado");
                    onClose();
                  } else toast.error(r.error);
                })
              }
            >
              Borrar
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
