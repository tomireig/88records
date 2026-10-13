"use client";

import type { GenerationKind } from "@88/ai";
import { useActionState, useState } from "react";
import { generateAction, type GenerateState } from "@/app/actions/ai";
import { KIND_LABELS } from "@/lib/ai-kinds";

export interface TrackOption {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  mood: string | null;
}

export interface CuratorOption {
  id: string;
  name: string;
  playlist: string;
}

const CURATOR_KINDS: GenerationKind[] = ["dm_es", "dm_en"];

export function Generator({
  kinds,
  tracks,
  curators = [],
}: {
  kinds: GenerationKind[];
  tracks: TrackOption[];
  curators?: CuratorOption[];
}) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(generateAction, {});
  const [kind, setKind] = useState<GenerationKind>(kinds[0]!);
  const [fields, setFields] = useState({ artist: "", track: "", genre: "", mood: "" });
  const [curator, setCurator] = useState({ curator: "", playlist: "" });
  const [copied, setCopied] = useState(false);

  const pickTrack = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    setFields(t ? { artist: t.artist, track: t.title, genre: t.genre ?? "", mood: t.mood ?? "" } : { artist: "", track: "", genre: "", mood: "" });
  };
  const pickCurator = (id: string) => {
    const c = curators.find((x) => x.id === id);
    setCurator(c ? { curator: c.name, playlist: c.playlist } : { curator: "", playlist: "" });
  };

  const copy = async () => {
    if (!state.text) return;
    await navigator.clipboard.writeText(state.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const needsCurator = CURATOR_KINDS.includes(kind);
  const chars = state.text?.length ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={action} className="box grid content-start gap-3 p-4">
        <label className="field">
          Qué generar
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as GenerationKind)} className="input">
            {kinds.map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        {tracks.length > 0 && (
          <label className="field">
            Track del catálogo
            <select onChange={(e) => pickTrack(e.target.value)} className="input" defaultValue="">
              <option value="">Elegir (completa los campos)</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.title} · {t.artist}</option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(["artist", "track", "genre", "mood"] as const).map((f) => (
            <label key={f} className="field">
              {{ artist: "Artista", track: "Track", genre: "Género", mood: "Mood" }[f]}
              <input
                name={f}
                value={fields[f]}
                onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
                className="input"
              />
            </label>
          ))}
        </div>
        {needsCurator ? (
          <>
            {curators.length > 0 && (
              <label className="field">
                Curador
                <select onChange={(e) => pickCurator(e.target.value)} className="input" defaultValue="">
                  <option value="">Elegir</option>
                  {curators.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.playlist}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                Nombre del curador
                <input name="curator" value={curator.curator} onChange={(e) => setCurator({ ...curator, curator: e.target.value })} className="input" />
              </label>
              <label className="field">
                Playlist
                <input name="playlist" value={curator.playlist} onChange={(e) => setCurator({ ...curator, playlist: e.target.value })} className="input" />
              </label>
            </div>
          </>
        ) : (
          <label className="field">
            Plataforma
            <select name="platform" className="input" defaultValue="TikTok">
              <option>TikTok</option>
              <option>Instagram</option>
              <option>YouTube</option>
            </select>
          </label>
        )}
        <label className="field">
          Contexto extra
          <textarea name="context" rows={3} className="input" placeholder="Lo que tenga que saber: historia del tema, referencias, qué evitar…" />
        </label>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Generando…" : "Generar"}
        </button>
      </form>

      <div className="box flex min-h-[320px] flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="tag">Resultado</p>
          {state.text && (
            <div className="flex items-center gap-3">
              <span className={`text-xs tabular-nums ${kind === "pitch" && chars > 500 ? "font-bold text-orange" : "text-mute"}`}>
                {chars} caracteres
              </span>
              <button type="button" onClick={copy} className="btn btn-sm">
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}
        </div>
        {state.error && <p className="text-sm font-bold text-orange">{state.error}</p>}
        {state.notice && <p className="mb-3 border border-orange px-3 py-2 text-xs">{state.notice}</p>}
        {state.text ? (
          <pre className="flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed">{state.text}</pre>
        ) : (
          <p className="text-sm text-mute">{pending ? "Pensando…" : "Lo que generes aparece acá y queda guardado en el historial."}</p>
        )}
        {state.provider && <p className="mt-3 text-[10px] uppercase tracking-widest text-mute">{state.provider}</p>}
      </div>
    </div>
  );
}
