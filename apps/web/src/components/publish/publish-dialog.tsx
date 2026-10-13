"use client";

import { CAPTION_MAX } from "@88/connectors/tiktok";
import { AlertTriangle, Copy, Send } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createPost, loadPublishContext, type PublishContext } from "@/app/actions";
import { atLocal, dayKey, duration, timeKey, when } from "@/lib/when";
import { Avatar, Button, Dialog } from "../ui";
import { ChoicesForm, choicesProblems, ConsentText, EMPTY_CHOICES, type ChoicesState } from "./choices-form";

export interface PublishTarget {
  accountId: string;
  accountName: string;
  accountColor: string;
  avatarUrl: string | null;
  videoId: string;
  at: string;
  caption: string;
}

export function PublishDialog({
  target,
  tz,
  onClose,
}: {
  target: PublishTarget | null;
  tz: string;
  onClose: (scheduled: boolean) => void;
}) {
  const [ctx, setCtx] = useState<PublishContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ChoicesState>(EMPTY_CHOICES);
  const [caption, setCaption] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!target) return;
    setCtx(null);
    setLoadError(null);
    setChoices(EMPTY_CHOICES);
    setCaption(target.caption);
    setDay(dayKey(new Date(target.at), tz));
    setTime(timeKey(new Date(target.at), tz));
    let alive = true;
    loadPublishContext(target.accountId, target.videoId, target.at).then((r) => {
      if (!alive) return;
      if (r.ok) setCtx(r.context);
      else setLoadError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [target, tz]);

  const at = useMemo(() => {
    try {
      return day && time ? atLocal(day, time, tz) : null;
    } catch {
      return null;
    }
  }, [day, time, tz]);

  const direct = ctx?.mode.directPost ?? false;
  const captionLen = [...caption].length;
  const tooLong = ctx && ctx.durationSec !== null && ctx.durationSec > ctx.info.maxVideoPostDurationSec;
  const problems = ctx
    ? [
        ...choicesProblems(choices, direct),
        ...(captionLen > CAPTION_MAX ? [`El texto supera los ${CAPTION_MAX} caracteres.`] : []),
        ...(tooLong ? [`El video dura ${duration(ctx.durationSec)} y la cuenta permite hasta ${ctx.info.maxVideoPostDurationSec} s.`] : []),
        ...(!at || at.getTime() < Date.now() - 60_000 ? ["Elegí un horario que no haya pasado."] : []),
      ]
    : [];
  const soon = at && at.getTime() - Date.now() < 2 * 60_000;

  function submit() {
    if (!target || !at || !ctx) return;
    start(async () => {
      const r = await createPost({
        accountId: target.accountId,
        videoId: target.videoId,
        at: (soon ? new Date(Date.now() + 5_000) : at).toISOString(),
        choices: {
          caption,
          privacyLevel: direct ? choices.privacyLevel : null,
          allowComment: choices.allowComment,
          allowDuet: choices.allowDuet,
          allowStitch: choices.allowStitch,
          brandOrganic: choices.brandOrganic,
          brandContent: choices.brandContent,
          consent: true,
        },
      });
      if (r.ok) {
        toast.success(soon ? "Publicando ahora" : `Programado para ${when(at, tz)}`);
        onClose(true);
      } else toast.error(r.error);
    });
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose(false)} title="Publicar en TikTok" width="max-w-4xl">
      {target && (
        <div className="grid gap-0 md:grid-cols-[300px_1fr]">
          <div className="border-b border-line bg-ink-1 p-4 md:border-r md:border-b-0">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[268px] overflow-hidden rounded-md bg-black">
              {ctx ? (
                <video src={`${ctx.videoUrl}#t=0.1`} controls playsInline preload="metadata" className="size-full object-contain" />
              ) : (
                <div className="skeleton size-full" />
              )}
            </div>
            {ctx && (
              <p className="mt-3 truncate text-center text-xs text-fg-3">
                {ctx.videoTitle} · <span className="font-mono tabular">{duration(ctx.durationSec)}</span>
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              <Avatar src={ctx?.info.avatarUrl ?? target.avatarUrl} name={target.accountName} color={target.accountColor} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{ctx?.info.nickname ?? target.accountName}</div>
                <div className="truncate text-xs text-fg-3">
                  {ctx ? (direct ? "Publicación directa" : "Se envía a borradores de TikTok") : "Consultando la cuenta en TikTok…"}
                </div>
              </div>
            </div>

            {loadError ? (
              <div className="m-5 flex gap-2.5 rounded-md border border-bad/30 bg-bad/[0.07] p-3 text-[13px] text-[#ffb3b3]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Esta cuenta no puede publicar ahora.</p>
                  <p className="mt-0.5 text-xs opacity-90">{loadError}</p>
                </div>
              </div>
            ) : !ctx ? (
              <div className="space-y-3 p-5">
                <div className="skeleton h-24 rounded-md" />
                <div className="skeleton h-10 rounded-md" />
                <div className="skeleton h-28 rounded-md" />
              </div>
            ) : (
              <div className="space-y-6 p-5">
                {ctx.duplicates.length > 0 && (
                  <div className="flex gap-2.5 rounded-md border border-warn/30 bg-warn/[0.06] p-3 text-[13px] text-[#ffd48a]">
                    <Copy className="mt-0.5 size-4 shrink-0" />
                    <p>
                      Este mismo archivo ya está en <strong className="font-medium">{ctx.duplicates.map((d) => d.displayName).join(", ")}</strong>. TikTok
                      penaliza el contenido duplicado entre cuentas: conviene una variante con otro arranque o recorte.
                    </p>
                  </div>
                )}

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label htmlFor="caption" className="text-[13px] font-medium">
                      Texto
                    </label>
                    <span className={`font-mono text-xs tabular ${captionLen > CAPTION_MAX ? "text-bad" : "text-fg-3"}`}>
                      {captionLen}/{CAPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    placeholder="Caption, hashtags y menciones"
                    className="w-full resize-y rounded-md border border-line-strong bg-ink-3 px-3 py-2 text-sm placeholder:text-fg-3 focus:border-orange/60 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium">Día</span>
                    <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-ink-3 px-3 font-mono text-sm tabular [color-scheme:dark]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium">Hora</span>
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-full rounded-md border border-line-strong bg-ink-3 px-3 font-mono text-sm tabular [color-scheme:dark]" />
                  </label>
                  <p className="col-span-2 -mt-1 text-xs text-fg-3">
                    Hora de Buenos Aires · ese día lleva <span className="font-mono tabular">{ctx.dayCount}</span> de{" "}
                    <span className="font-mono tabular">{ctx.maxPostsPerDay}</span> publicaciones en esta cuenta
                  </p>
                </div>

                {direct ? (
                  <ChoicesForm
                    value={choices}
                    onChange={setChoices}
                    direct
                    allowed={ctx.allowed}
                    locked={{ comment: ctx.info.commentDisabled, duet: ctx.info.duetDisabled, stitch: ctx.info.stitchDisabled }}
                  />
                ) : (
                  <>
                    <p className="rounded-md border border-line bg-white/[0.02] p-3 text-[13px] text-fg-2">
                      El video va a llegar a la bandeja de TikTok de <strong className="font-medium text-fg">{ctx.info.nickname}</strong>. Privacidad,
                      comentarios, dúo y stitch se eligen ahí al terminar de publicar.
                    </p>
                    <ChoicesForm value={choices} onChange={setChoices} direct={false} allowed={[]} locked={{ comment: true, duet: true, stitch: true }} />
                  </>
                )}
              </div>
            )}

            <div className="mt-auto border-t border-line bg-ink-1/60 px-5 py-4">
              {ctx && <ConsentText brandContent={choices.brandContent} />}
              {problems.length > 0 && ctx && <p className="mt-2 text-xs text-warn">{problems[0]}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => onClose(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" icon={<Send className="size-4" />} disabled={!ctx || problems.length > 0} loading={pending} onClick={submit}>
                  {soon ? "Publicar ahora" : at ? `Programar · ${when(at, tz)}` : "Programar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
