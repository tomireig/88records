"use client";

import { ArrowLeft, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { pieceVideoUrl, proposeReleaseCampaign, retryReleaseAnalysis } from "@/app/actions";
import type { AnalysisView, PieceDTO, ReleaseDetail } from "@/lib/data";
import { duration, fmt } from "@/lib/when";
import { Button, cn, Dialog } from "../ui";
import { ReleaseStatusPill } from "./status";

const FORMAT: Record<string, string> = { hook: "Hook", visualizer: "Visualizer", lyric: "Lyric", bts: "BTS" };

function dayLabel(d: number | null) {
  if (d === null) return "";
  return d === 0 ? "Día D" : d < 0 ? `D−${-d}` : `D+${d}`;
}

export function ReleaseView({ release: r, tz }: { release: ReleaseDetail; tz: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const busy = r.status === "analyzing" || r.status === "rendering" || r.status === "uploading";
  const [preview, setPreview] = useState<PieceDTO | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [busy, router]);

  const ready = r.pieces.filter((p) => p.status === "ready").length;

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <Link href="/lanzamientos" className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Volver a lanzamientos">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em]">{r.title}</h1>
        <ReleaseStatusPill status={r.status} proposals={r.proposals} />
        <div className="ml-auto flex items-center gap-2">
          {r.status === "failed" && (
            <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={pending} onClick={() => start(async () => {
              const res = await retryReleaseAnalysis(r.id);
              if (!res.ok) toast.error(res.error);
            })}>
              Reintentar
            </Button>
          )}
          {r.status === "ready" && (
            <Button size="sm" variant="primary" icon={<Sparkles className="size-3.5" />} loading={pending} onClick={() => start(async () => {
              const res = await proposeReleaseCampaign(r.id);
              if (res.ok) toast.success("El worker arma la campaña: en unos segundos aparece en la Bandeja.");
              else toast.error(res.error);
            })}>
              Proponer campaña
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
        <section className="flex flex-col gap-5 sm:flex-row">
          <div className="size-40 shrink-0 overflow-hidden rounded-lg bg-ink-4 shadow-lift">
            {r.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverUrl} alt={`Portada de ${r.title}`} className="size-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg-2">
              {r.artist.name} · {r.releaseDate ? fmt(r.releaseDate, tz, "EEEE d 'de' MMMM yyyy") : "sin fecha"}
            </p>
            {r.analysis ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <Stat label="Tempo" value={`${Math.round(r.analysis.bpm)}`} unit="BPM" />
                <Stat label="Tonalidad" value={r.analysis.key.short} unit={`${r.analysis.key.camelot} · ${r.analysis.key.name}`} />
                <Stat label="Duración" value={duration(r.analysis.durationSec)} />
                <Stat label="Clima" value={r.analysis.profile.mood} small />
              </dl>
            ) : (
              <div className="mt-4 space-y-2">
                {r.error ? (
                  <p className="text-sm text-bad-fg">{r.error}</p>
                ) : (
                  <>
                    <p className="text-sm text-fg-2">Analizando el audio en el worker: tempo, tonalidad, energía, drops, estribillo y letra.</p>
                    <div className="skeleton h-12 rounded-md" />
                  </>
                )}
              </div>
            )}
            {r.status === "ready" && r.artistAccounts === 0 && (
              <p className="mt-4 rounded-md border border-warn/30 bg-warn/[0.06] p-3 text-[13px] text-warn-fg">
                {r.artist.name} no tiene cuentas de TikTok asignadas. Conectá una y asignala al artista en{" "}
                <Link href="/cuentas" className="underline">
                  Cuentas
                </Link>{" "}
                para que se proponga la campaña.
              </p>
            )}
          </div>
        </section>

        {r.analysis && r.audioUrl && <EnergySection analysis={r.analysis} audioUrl={r.audioUrl} />}

        {r.analysis?.words && r.analysis.words.length > 0 && (
          <section>
            <h2 className="mb-2 text-[13px] font-medium">Letra transcripta</h2>
            <p className="max-w-[70ch] text-sm leading-7 text-fg-2">{r.analysis.words.map((w) => w.word).join(" ")}</p>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-medium">Piezas de la campaña</h2>
            {r.pieces.length > 0 && (
              <span className="font-mono text-xs text-fg-3 tabular">
                {ready}/{r.pieces.length} listas
              </span>
            )}
          </div>
          {r.pieces.length === 0 ? (
            <p className="text-sm text-fg-3">{busy ? "Las piezas aparecen acá apenas termina el análisis." : "Todavía no hay piezas."}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {r.pieces.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0.4, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => p.status === "ready" && setPreview(p)}
                  disabled={p.status !== "ready"}
                  className="group overflow-hidden rounded-lg border border-line bg-ink-2 text-left transition-colors enabled:hover:border-line-strong"
                >
                  <div className="relative aspect-[9/16] bg-ink-4">
                    {p.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                    )}
                    {p.status === "processing" && <div className="skeleton absolute inset-0" />}
                    {p.status === "failed" && <div className="absolute inset-0 grid place-items-center bg-bad/10 p-2 text-center text-[11px] text-bad-fg">{p.error}</div>}
                    <span className="absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur tabular">{dayLabel(p.day)}</span>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-medium">{FORMAT[p.format ?? ""] ?? "Pieza"}</div>
                    <div className="font-mono text-[11px] text-fg-3 tabular">{p.status === "ready" ? duration(p.durationSec) : p.status === "failed" ? "error" : "renderizando"}</div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      </div>

      <PiecePreview piece={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function Stat({ label, value, unit, small }: { label: string; value: string; unit?: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-3">{label}</dt>
      <dd className={cn("mt-0.5 truncate", small ? "text-sm" : "font-mono text-2xl tracking-tight tabular")}>
        {value}
        {unit && <span className="ml-1.5 font-sans text-xs text-fg-3">{unit}</span>}
      </dd>
    </div>
  );
}

/** Curva de energía con drops y estribillo; los fragmentos se escuchan ahí mismo. */
function EnergySection({ analysis: a, audioUrl }: { analysis: AnalysisView; audioUrl: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<{ start: number; end: number } | null>(null);
  const [now, setNow] = useState(0);
  const W = 1000;
  const H = 120;
  const path = useMemo(() => {
    const pts = a.energy.map((v, i) => `${((i * a.energyStep) / a.durationSec) * W},${H - v * (H - 8)}`);
    return `M0,${H} L${pts.join(" L")} L${W},${H} Z`;
  }, [a]);
  const x = (sec: number) => (sec / a.durationSec) * W;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const tick = () => {
      setNow(el.currentTime);
      if (playing && el.currentTime >= playing.end) {
        el.pause();
        setPlaying(null);
      }
    };
    el.addEventListener("timeupdate", tick);
    return () => el.removeEventListener("timeupdate", tick);
  }, [playing]);

  function play(f: { start: number; end: number }) {
    const el = audio.current!;
    if (playing?.start === f.start) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.currentTime = f.start;
    void el.play();
    setPlaying(f);
  }

  return (
    <section>
      <h2 className="mb-2 text-[13px] font-medium">Energía del tema</h2>
      <div className="relative overflow-hidden rounded-lg border border-line bg-ink-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-32 w-full" role="img" aria-label={`Curva de energía: ${a.drops.length} drops detectados`}>
          <defs>
            <linearGradient id="energia" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ff4d00" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ff4d00" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {a.chorus && <rect x={x(a.chorus.start)} y={0} width={x(a.chorus.end) - x(a.chorus.start)} height={H} fill="#1e1ee6" opacity={0.18} />}
          <path d={path} fill="url(#energia)" stroke="#ff4d00" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {a.drops.map((d) => (
            <line key={d.at} x1={x(d.at)} x2={x(d.at)} y1={0} y2={H} stroke="#ffffff" strokeOpacity={0.6} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          ))}
          {playing && <rect x={x(playing.start)} y={0} width={x(playing.end) - x(playing.start)} height={H} fill="#ffffff" opacity={0.07} />}
          {playing && <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3 border-t border-dashed border-white/60" /> drop
          </span>
          {a.chorus && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-ultra/60" /> estribillo
            </span>
          )}
          <span className="ml-auto font-mono tabular">
            {a.drops.map((d) => duration(d.at)).join(" · ")}
          </span>
        </div>
      </div>

      <h3 className="mt-5 mb-2 text-[13px] font-medium">Mejores fragmentos para video corto</h3>
      <ul className="grid gap-2 md:grid-cols-3">
        {a.fragments.map((f) => {
          const active = playing?.start === f.start;
          return (
            <li key={`${f.length}-${f.start}`}>
              <button
                onClick={() => play(f)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                  active ? "border-orange/60 bg-orange/[0.06]" : "border-line bg-ink-2 hover:border-line-strong",
                )}
              >
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", active ? "bg-orange text-white" : "bg-white/[0.06] text-fg")}>
                  {active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-xs tabular">
                    {f.length} s · {duration(f.start)}–{duration(f.end)}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-fg-2">{f.reason}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <audio ref={audio} src={audioUrl} preload="none" onEnded={() => setPlaying(null)} />
    </section>
  );
}

function PiecePreview({ piece, onClose }: { piece: PieceDTO | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!piece) return;
    let alive = true;
    void pieceVideoUrl(piece.id).then((r) => {
      if (alive && r.ok) setUrl(r.url);
    });
    return () => {
      alive = false;
    };
  }, [piece]);

  return (
    <Dialog open={Boolean(piece)} onOpenChange={(o) => !o && onClose()} title={piece?.title ?? ""} description={piece?.why ?? undefined} width="max-w-md">
      {piece && (
        <div className="space-y-3 p-4">
          <div className="mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-md bg-black">
            {url ? <video src={url} controls autoPlay playsInline className="size-full" /> : <div className="skeleton size-full" />}
          </div>
          {piece.caption && <p className="text-[13px] text-fg-2">{piece.caption}</p>}
        </div>
      )}
    </Dialog>
  );
}
