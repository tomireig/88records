"use client";

import { Ban, RotateCcw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelScheduledPost, loadPostDetail, retryFailedPost } from "@/app/actions";
import { fmt, when } from "@/lib/when";
import { STATUS_LABEL, STATUS_MARK } from "@/lib/status";
import { PRIVACY_LABELS } from "../publish/choices-form";
import { Avatar, Button, Dialog, StatusMark, type Mark } from "../ui";

type Detail = Extract<Awaited<ReturnType<typeof loadPostDetail>>, { ok: true }>["post"];

export function PostDetail({ postId, tz, onClose }: { postId: string | null; tz: string; onClose: () => void }) {
  const [post, setPost] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!postId) return;
    setPost(null);
    setError(null);
    let alive = true;
    const load = () =>
      loadPostDetail(postId).then((r) => {
        if (!alive) return;
        if (r.ok) setPost(r.post);
        else setError(r.error);
      });
    void load();
    // Mientras está en curso, el historial se actualiza solo.
    const t = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [postId]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(okMsg);
        onClose();
      } else toast.error(r.error ?? "No se pudo");
    });

  return (
    <Dialog open={Boolean(postId)} onOpenChange={(o) => !o && onClose()} title={post?.videoTitle ?? "Publicación"} width="max-w-lg">
      {error && <p className="p-5 text-sm text-bad">{error}</p>}
      {!post && !error && (
        <div className="space-y-3 p-5">
          <div className="skeleton h-12 rounded-md" />
          <div className="skeleton h-24 rounded-md" />
        </div>
      )}
      {post && (
        <div className="divide-y divide-line">
          <div className="flex items-center gap-3 px-5 py-4">
            <Avatar src={post.account.avatarUrl} name={post.account.displayName} color={post.account.color} size={34} busy={post.status === "publishing" || post.status === "processing"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{post.creatorNickname || post.account.displayName}</div>
              <div className="font-mono text-xs text-fg-3 tabular">{when(post.scheduledFor, tz)}</div>
            </div>
            <StatusMark mark={STATUS_MARK[post.status] ?? "scheduled"} withLabel />
          </div>

          {post.failReason && (
            <div className="bg-bad/[0.06] px-5 py-3 text-[13px] text-bad-fg">{post.failReason}</div>
          )}

          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 px-5 py-4 text-[13px]">
            <dt className="text-fg-3">Modo</dt>
            <dd>{post.mode === "direct" ? "Publicación directa" : "Borrador en TikTok"}</dd>
            {post.mode === "direct" && (
              <>
                <dt className="text-fg-3">Privacidad</dt>
                <dd>{post.privacyLevel ? PRIVACY_LABELS[post.privacyLevel as keyof typeof PRIVACY_LABELS] : "—"}</dd>
                <dt className="text-fg-3">Permisos</dt>
                <dd>
                  {[post.allow.comment && "comentarios", post.allow.duet && "dúo", post.allow.stitch && "stitch"].filter(Boolean).join(", ") || "Ninguno"}
                </dd>
              </>
            )}
            {(post.brandOrganic || post.brandContent) && (
              <>
                <dt className="text-fg-3">Comercial</dt>
                <dd>{[post.brandOrganic && "Tu marca", post.brandContent && "Contenido de marca"].filter(Boolean).join(" · ")}</dd>
              </>
            )}
            {post.publicPostId && (
              <>
                <dt className="text-fg-3">ID en TikTok</dt>
                <dd className="font-mono tabular">{post.publicPostId}</dd>
              </>
            )}
            <dt className="text-fg-3">Texto</dt>
            <dd className="whitespace-pre-wrap text-fg-2">{post.caption || "Sin texto"}</dd>
          </dl>

          <div className="px-5 py-4">
            <h3 className="mb-3 text-[13px] font-medium">Historial</h3>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {post.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px]">
                    <StatusMark mark={STATUS_MARK[e.status] ?? "scheduled"} />
                  </span>
                  <div className="text-[13px]">{e.message || STATUS_LABEL[e.status]}</div>
                  <div className="font-mono text-[11px] text-fg-3 tabular">{fmt(e.at, tz, "d MMM · HH:mm:ss")}</div>
                </li>
              ))}
            </ol>
          </div>

          {(post.status === "scheduled" || post.status === "failed") && (
            <div className="flex justify-end gap-2 bg-ink-1/60 px-5 py-3">
              {post.status === "scheduled" && (
                <Button variant="danger" size="sm" icon={<Ban className="size-3.5" />} loading={pending} onClick={() => act(() => cancelScheduledPost(post.id), "Publicación cancelada")}>
                  Cancelar publicación
                </Button>
              )}
              {post.status === "failed" && (
                <Button variant="primary" size="sm" icon={<RotateCcw className="size-3.5" />} loading={pending} onClick={() => act(() => retryFailedPost(post.id), "Se reintenta en un minuto")}>
                  Reintentar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
