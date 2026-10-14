"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus, Sparkles, UploadCloud } from "lucide-react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { autofillWeek, movePost } from "@/app/actions";
import type { AccountDTO, PostDTO, ProposalDTO, VideoDTO } from "@/lib/data";
import { atLocal, dayKey, fmt, timeKey, weekDays } from "@/lib/when";
import { DropZone, UploaderProvider, useUploader } from "../library/uploader";
import { PublishDialog, type PublishTarget } from "../publish/publish-dialog";
import { Avatar, Button, cn, StatusMark } from "../ui";
import { STATUS_LABEL, STATUS_MARK } from "@/lib/status";
import { PostDetail } from "./post-detail";

interface Props {
  tz: string;
  view: "week" | "month";
  start: string;
  anchorDay: string;
  days: number;
  accounts: AccountDTO[];
  posts: PostDTO[];
  proposals: ProposalDTO[];
  videos: VideoDTO[];
}

const BUSY = new Set(["publishing", "processing"]);

/** Corre el chip arrastrado al costado del cursor para que se vea la celda destino iluminada. */
const besideCursor: Modifier = ({ transform }) => ({ ...transform, x: transform.x + 22, y: transform.y + 18 });

/** Estela naranja detrás del cursor mientras se arrastra: tres luces que siguen con distinto retraso. */
function DragTrail({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const springs = [
    { x: useSpring(0, { stiffness: 900, damping: 60 }), y: useSpring(0, { stiffness: 900, damping: 60 }) },
    { x: useSpring(0, { stiffness: 380, damping: 40 }), y: useSpring(0, { stiffness: 380, damping: 40 }) },
    { x: useSpring(0, { stiffness: 160, damping: 28 }), y: useSpring(0, { stiffness: 160, damping: 28 }) },
  ];
  useEffect(() => {
    if (!active || reduce) return;
    const move = (e: PointerEvent) => {
      for (const s of springs) {
        s.x.set(e.clientX);
        s.y.set(e.clientY);
      }
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);
  if (!active || reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      {springs.map((s, i) => (
        <motion.span
          key={i}
          className="absolute -mt-2 -ml-2 size-4 rounded-full bg-orange blur-[3px]"
          style={{ x: s.x, y: s.y, opacity: 0.55 - i * 0.16, scale: 1 - i * 0.2 }}
        />
      ))}
    </div>
  );
}

function buildCaption(account: AccountDTO, video: { title: string }): string {
  const base = (account.captionTemplate || "{titulo}").replaceAll("{titulo}", video.title).trim();
  const tags = account.hashtags.map((h) => `#${h.replace(/^#/, "")}`).filter((h) => !base.includes(h));
  return [base, tags.join(" ")].filter(Boolean).join("\n\n");
}

/** Primera franja preferida libre de ese día; si no hay, la próxima hora redonda. */
function suggestTime(account: AccountDTO, day: string, posts: PostDTO[], tz: string): string {
  const now = Date.now();
  const taken = posts.filter((p) => p.accountId === account.id).map((p) => new Date(p.scheduledFor).getTime());
  for (const slot of [...account.preferredSlots].sort()) {
    const at = atLocal(day, slot, tz).getTime();
    if (at > now + 5 * 60_000 && !taken.some((t) => Math.abs(t - at) < 45 * 60_000)) return new Date(at).toISOString();
  }
  const base = Math.max(now, atLocal(day, "09:00", tz).getTime());
  return new Date(Math.ceil((base + 10 * 60_000) / 3600_000) * 3600_000).toISOString();
}

export function CalendarBoard(props: Props) {
  return (
    <UploaderProvider>
      <Board {...props} />
    </UploaderProvider>
  );
}

function Board({ tz, view, start, anchorDay, days, accounts, posts: initialPosts, proposals, videos }: Props) {
  const router = useRouter();
  const uploader = useUploader();
  const [posts, setPosts] = useState(initialPosts);
  const [dragging, setDragging] = useState<{ kind: "video"; video: VideoDTO } | { kind: "post"; post: PostDTO } | null>(null);
  const [publish, setPublish] = useState<PublishTarget | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [filling, startFill] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  useEffect(() => setPosts(initialPosts), [initialPosts]);

  // Mientras algo se publica, la vista se refresca sola.
  const busy = posts.some((p) => BUSY.has(p.status)) || videos.some((v) => v.status === "processing" || v.status === "uploading");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 7000);
    return () => clearInterval(t);
  }, [busy, router]);

  const dayList = useMemo(() => {
    const out: string[] = [];
    for (let w = 0; w < days / 7; w++) out.push(...weekDays(new Date(new Date(start).getTime() + w * 7 * 24 * 3600_000), tz));
    return out;
  }, [start, days, tz]);
  const today = dayKey(new Date(), tz);
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const nav = (delta: number) => {
    const base = atLocal(view === "month" ? `${anchorDay.slice(0, 7)}-01` : dayList[0]!, "12:00", tz);
    const next = view === "month" ? new Date(base.getFullYear(), base.getMonth() + delta, 15) : new Date(base.getTime() + delta * 7 * 24 * 3600_000);
    return `/calendario?vista=${view === "month" ? "mes" : "semana"}&desde=${dayKey(next, tz)}`;
  };
  const title =
    view === "month"
      ? fmt(atLocal(anchorDay, "12:00", tz), tz, "MMMM yyyy")
      : `${fmt(atLocal(dayList[0]!, "12:00", tz), tz, "d MMM")} – ${fmt(atLocal(dayList[6]!, "12:00", tz), tz, "d MMM yyyy")}`;

  function onDragStart(e: DragStartEvent) {
    const d = e.active.data.current as typeof dragging;
    setDragging(d);
  }

  function onDragEnd(e: DragEndEvent) {
    const d = e.active.data.current as typeof dragging;
    setDragging(null);
    const over = e.over?.data.current as { accountId?: string; day: string } | undefined;
    if (!d || !over) return;

    if (d.kind === "video") {
      if (!over.accountId) return toast("Para programar, soltalo en la fila de una cuenta en la vista semanal.");
      const account = accById.get(over.accountId)!;
      if (account.health === "broken") return toast.error(`${account.displayName} está desconectada. Reconectala primero.`);
      if (d.video.status !== "ready") return toast("El video todavía se está procesando.");
      setPublish({
        accountId: account.id,
        accountName: account.displayName,
        accountColor: account.color,
        avatarUrl: account.avatarUrl,
        videoId: d.video.id,
        at: suggestTime(account, over.day, posts, tz),
        caption: buildCaption(account, d.video),
        slots: account.preferredSlots,
      });
      return;
    }

    const post = d.post;
    if (over.accountId && over.accountId !== post.accountId) {
      return toast.error("Cada publicación tiene la configuración de su cuenta. Para otra cuenta, cancelala y programala de nuevo.");
    }
    if (dayKey(new Date(post.scheduledFor), tz) === over.day) return;
    const at = atLocal(over.day, timeKey(new Date(post.scheduledFor), tz), tz);
    if (at.getTime() < Date.now()) return toast.error("Ese horario ya pasó.");
    const prev = posts;
    setPosts((list) => list.map((p) => (p.id === post.id ? { ...p, scheduledFor: at.toISOString() } : p)));
    movePost(post.id, at.toISOString()).then((r) => {
      if (r.ok) toast.success(`Movido al ${fmt(at, tz, "EEE d · HH:mm")}`);
      else {
        setPosts(prev);
        toast.error(r.error);
      }
    });
  }

  function fill() {
    startFill(async () => {
      const r = await autofillWeek(atLocal(dayList[0]!, "00:00", tz).toISOString());
      if (!r.ok) return void toast.error(r.error);
      if (r.count === 0) toast("No quedan huecos o videos sin programar para esta semana.");
      else toast.success(`${r.count} ${r.count === 1 ? "propuesta lista" : "propuestas listas"} para aprobar en la Bandeja`, {
        action: { label: "Ver", onClick: () => router.push("/bandeja") },
      });
      router.refresh();
    });
  }

  // ← → cambian de semana o mes, T vuelve a hoy. Nunca mientras se escribe.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.key === "ArrowLeft") router.push(nav(-1));
      else if (e.key === "ArrowRight") router.push(nav(1));
      else if (e.key.toLowerCase() === "t") router.push(`/calendario?vista=${view === "month" ? "mes" : "semana"}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ready = videos.filter((v) => v.status === "ready");

  return (
    <DndContext id="calendario" sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex items-center gap-1">
              <Link href={nav(-1)} className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Anterior" title="Anterior (←)">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href={nav(1)} className="grid size-8 place-items-center rounded-md text-fg-2 hover:bg-white/5 hover:text-fg" aria-label="Siguiente" title="Siguiente (→)">
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em] first-letter:uppercase">{title}</h1>
            <Link
              href={`/calendario?vista=${view === "month" ? "mes" : "semana"}`}
              className="rounded-md border border-line-strong px-2.5 py-1 text-xs text-fg-2 hover:text-fg"
            >
              Hoy
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden rounded-md border border-line-strong bg-ink-2 p-0.5 sm:flex" role="tablist" aria-label="Vista">
                {(["semana", "mes"] as const).map((v) => {
                  const active = (v === "mes") === (view === "month");
                  return (
                    <Link
                      key={v}
                      role="tab"
                      aria-selected={active}
                      href={`/calendario?vista=${v}&desde=${anchorDay}`}
                      className={cn("rounded px-3 py-1 text-[13px] capitalize", active ? "bg-ink-4 text-fg" : "text-fg-3 hover:text-fg")}
                    >
                      {v}
                    </Link>
                  );
                })}
              </div>
              {view === "week" && accounts.length > 0 && (
                <Button size="sm" icon={<Sparkles className="size-3.5 text-orange" />} loading={filling} onClick={fill}>
                  <span className="hidden sm:inline">Autollenar semana</span>
                  <span className="sm:hidden">Autollenar</span>
                </Button>
              )}
              <Button size="sm" variant="primary" icon={<UploadCloud className="size-3.5" />} onClick={uploader.pick} aria-label="Subir videos">
                <span className="hidden sm:inline">Subir videos</span>
              </Button>
            </div>
          </header>

          {accounts.length === 0 ? (
            <EmptyAccounts />
          ) : view === "week" ? (
            <>
              <WeekGrid
                days={dayList}
                today={today}
                tz={tz}
                accounts={accounts}
                posts={posts}
                proposals={proposals}
                dragging={dragging}
                onOpenPost={setDetail}
              />
              <Agenda days={dayList} today={today} tz={tz} accById={accById} posts={posts} proposals={proposals} onOpenPost={setDetail} />
            </>
          ) : (
            <MonthGrid days={dayList} anchorMonth={anchorDay.slice(0, 7)} today={today} tz={tz} accById={accById} posts={posts} proposals={proposals} onOpenPost={setDetail} />
          )}
        </section>

        <aside className="hidden w-[264px] shrink-0 flex-col border-l border-line bg-ink-1/60 xl:flex">
          <DropZone className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-[13px] font-medium">Biblioteca</h2>
              <span className="font-mono text-xs text-fg-3 tabular">{ready.length} listos</span>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              {videos.length === 0 ? (
                <button
                  onClick={uploader.pick}
                  className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-10 text-center text-[13px] text-fg-2 hover:border-orange/50 hover:text-fg"
                >
                  <UploadCloud className="size-5 text-orange" />
                  Arrastrá videos acá o tocá para elegirlos
                </button>
              ) : (
                videos.map((v) => <LibraryItem key={v.id} video={v} />)
              )}
            </div>
            <p className="border-t border-line px-4 py-3 text-xs leading-5 text-fg-3">Arrastrá un video a la fila de una cuenta para programarlo.</p>
          </DropZone>
        </aside>
      </div>

      <DragTrail active={Boolean(dragging)} />
      <DragOverlay modifiers={[besideCursor]} dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {dragging?.kind === "video" && <VideoChip video={dragging.video} lifted />}
        {dragging?.kind === "post" && <PostChip post={dragging.post} tz={tz} color={accById.get(dragging.post.accountId)?.color ?? "#fff"} lifted />}
      </DragOverlay>

      <PublishDialog
        target={publish}
        tz={tz}
        onClose={(done) => {
          setPublish(null);
          if (done) router.refresh();
        }}
      />
      <PostDetail
        postId={detail}
        tz={tz}
        onClose={() => {
          setDetail(null);
          router.refresh();
        }}
      />
    </DndContext>
  );
}

function EmptyAccounts() {
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold">Conectá la primera cuenta de TikTok</h2>
        <p className="mt-2 text-sm text-fg-2">
          Cada cuenta conectada es una fila del calendario. Se abre el login oficial de TikTok: la contraseña nunca pasa por acá.
        </p>
        <a
          href="/api/tiktok/connect"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-orange px-4 text-sm font-medium text-white hover:bg-orange-hi"
        >
          <Plus className="size-4" /> Conectar cuenta
        </a>
      </div>
    </div>
  );
}

function WeekGrid({
  days,
  today,
  tz,
  accounts,
  posts,
  proposals,
  dragging,
  onOpenPost,
}: {
  days: string[];
  today: string;
  tz: string;
  accounts: AccountDTO[];
  posts: PostDTO[];
  proposals: ProposalDTO[];
  dragging: unknown;
  onOpenPost: (id: string) => void;
}) {
  return (
    <div className="hidden min-h-0 flex-1 overflow-auto md:flex">
      <div className="flex min-h-full min-w-[960px] flex-1 flex-col">
        <div className="sticky top-0 z-10 grid grid-cols-[176px_repeat(7,minmax(0,1fr))] border-b border-line bg-ink-0/90 backdrop-blur">
          <div className="px-4 py-2.5 text-xs text-fg-3">Cuenta</div>
          {days.map((d) => {
            const isToday = d === today;
            return (
              <div key={d} className={cn("relative px-3 py-2.5 text-xs", isToday ? "text-fg" : "text-fg-3")}>
                {isToday && <span className="absolute inset-x-2 top-0 h-px bg-orange shadow-[0_0_12px_rgb(255_77_0/0.9)]" />}
                <span className="capitalize">{fmt(atLocal(d, "12:00", tz), tz, "EEE")}</span>{" "}
                <span className="font-mono tabular">{d.slice(8)}</span>
              </div>
            );
          })}
        </div>

        {accounts.map((acc, i) => {
          const broken = acc.health === "broken";
          return (
            <motion.div
              key={acc.id}
              initial={{ opacity: 0.4, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn("grid max-h-[200px] flex-1 basis-[76px] grid-cols-[176px_repeat(7,minmax(0,1fr))] border-b border-line", broken && "grayscale")}
            >
              <div
                className="flex items-center gap-2.5 border-r border-line px-3 py-3"
                style={{ backgroundImage: `linear-gradient(90deg, ${acc.color}1f, transparent 75%)` }}
              >
                <Avatar
                  src={acc.avatarUrl}
                  name={acc.displayName}
                  color={acc.color}
                  size={28}
                  busy={posts.some((p) => p.accountId === acc.id && BUSY.has(p.status))}
                />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{acc.displayName}</div>
                  {broken ? (
                    <Link href="/cuentas" className="text-xs text-bad hover:underline">
                      Desconectada
                    </Link>
                  ) : (
                    <div className="font-mono text-[11px] text-fg-3 tabular">
                      hoy {acc.todayCount}/{acc.maxPostsPerDay}
                    </div>
                  )}
                </div>
              </div>
              {days.map((d) => (
                <Cell
                  key={d}
                  accountId={acc.id}
                  day={d}
                  past={d < today}
                  disabled={broken}
                  dragging={Boolean(dragging)}
                  color={acc.color}
                  posts={posts.filter((p) => p.accountId === acc.id && dayKey(new Date(p.scheduledFor), tz) === d)}
                  proposals={proposals.filter((p) => p.accountId === acc.id && dayKey(new Date(p.scheduledFor), tz) === d)}
                  tz={tz}
                  onOpenPost={onOpenPost}
                />
              ))}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({
  accountId,
  day,
  past,
  disabled,
  dragging,
  color,
  posts,
  proposals,
  tz,
  onOpenPost,
}: {
  accountId?: string;
  day: string;
  past: boolean;
  disabled: boolean;
  dragging: boolean;
  color: string;
  posts: PostDTO[];
  proposals: ProposalDTO[];
  tz: string;
  onOpenPost: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${accountId}:${day}`, data: { accountId, day }, disabled: disabled || past });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-[76px] space-y-1 border-r border-line p-1.5 transition-[background,box-shadow] duration-150 last:border-r-0",
        past && "bg-black/20",
        dragging && !past && !disabled && "bg-white/[0.015]",
        isOver && "bg-ultra/[0.12] shadow-[inset_0_0_0_1px_rgb(112_112_255/0.8),inset_0_0_24px_rgb(30_30_230/0.35)]",
      )}
    >
      {posts.map((p) => (
        <DraggablePost key={p.id} post={p} tz={tz} color={color} onOpen={() => onOpenPost(p.id)} />
      ))}
      {proposals.map((p) => (
        <Link
          key={p.actionId}
          href="/bandeja"
          title={p.reason}
          className="flex items-center gap-1.5 rounded border border-dashed border-line-strong px-1.5 py-1 text-[11px] text-fg-3 hover:border-fg-3 hover:text-fg-2"
        >
          <StatusMark mark="proposed" />
          <span className="font-mono tabular">{timeKey(new Date(p.scheduledFor), tz)}</span>
          <span className="truncate">{p.videoTitle}</span>
        </Link>
      ))}
    </div>
  );
}

function DraggablePost({ post, tz, color, onOpen }: { post: PostDTO; tz: string; color: string; onOpen: () => void }) {
  const movable = post.status === "scheduled";
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `post:${post.id}`, data: { kind: "post", post }, disabled: !movable });
  return (
    <PostChip
      post={post}
      tz={tz}
      color={color}
      onClick={onOpen}
      faded={isDragging}
      buttonProps={{ ref: setNodeRef, ...(movable ? { ...listeners, ...attributes, role: undefined } : {}) }}
    />
  );
}

function PostChip({
  post,
  tz,
  color,
  lifted,
  faded,
  onClick,
  buttonProps,
}: {
  post: PostDTO;
  tz: string;
  color: string;
  lifted?: boolean;
  faded?: boolean;
  onClick?: () => void;
  buttonProps?: Record<string, unknown>;
}) {
  const done = post.status === "published" || post.status === "in_drafts";
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onClick}
      title={`${STATUS_LABEL[post.status]} · ${post.videoTitle}${post.failReason ? ` · ${post.failReason}` : ""}`}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded border bg-ink-3 p-1 text-left transition-[border-color,background,box-shadow]",
        post.status === "failed" ? "border-bad/50" : "border-line-strong hover:border-white/25 hover:bg-ink-4",
        done && "opacity-70 saturate-50",
        faded && "opacity-30",
        lifted && "w-[180px] rotate-[-1.5deg] border-orange/70 bg-ink-4 shadow-[var(--glow-orange)]",
      )}
      style={{ borderLeftColor: lifted ? undefined : color }}
    >
      {post.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbUrl} alt="" className="h-7 w-4 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="h-7 w-4 shrink-0 rounded-sm bg-ink-4" />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="font-mono text-[11px] text-fg tabular">{timeKey(new Date(post.scheduledFor), tz)}</span>
          <StatusMark mark={STATUS_MARK[post.status] ?? "scheduled"} />
        </span>
        <span className="line-clamp-2 block text-[11px] leading-[14px] text-fg-2 [overflow-wrap:anywhere]">{post.videoTitle}</span>
      </span>
    </button>
  );
}

function LibraryItem({ video }: { video: VideoDTO }) {
  const ready = video.status === "ready";
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `video:${video.id}`, data: { kind: "video", video }, disabled: !ready });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn(isDragging && "opacity-30", ready ? "cursor-grab active:cursor-grabbing" : "cursor-default")}>
      <VideoChip video={video} />
    </div>
  );
}

function VideoChip({ video, lifted }: { video: VideoDTO; lifted?: boolean }) {
  const ready = video.status === "ready";
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-line bg-ink-2 p-1.5 transition-colors hover:border-line-strong",
        lifted && "w-[240px] rotate-[-1.5deg] border-orange/70 bg-ink-3 shadow-[var(--glow-orange)]",
      )}
    >
      <div className="relative h-14 w-8 shrink-0 overflow-hidden rounded bg-ink-4">
        {video.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbUrl} alt="" className="size-full object-cover" />
        )}
        {!ready && <div className="skeleton absolute inset-0" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">{video.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
          {ready ? (
            <span className="font-mono tabular">{Math.round(video.durationSec ?? 0)} s</span>
          ) : (
            <span className="animate-pulse-soft text-busy">Procesando…</span>
          )}
          {video.usedOn.length > 0 && (
            <span className="flex items-center gap-1" title={`Ya está en ${video.usedOn.map((u) => u.displayName).join(", ")}`}>
              ·
              {video.usedOn.slice(0, 4).map((u) => (
                <span key={u.id} className="size-1.5 rounded-full" style={{ background: u.color }} />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  anchorMonth,
  today,
  tz,
  accById,
  posts,
  proposals,
  onOpenPost,
}: {
  days: string[];
  anchorMonth: string;
  today: string;
  tz: string;
  accById: Map<string, AccountDTO>;
  posts: PostDTO[];
  proposals: ProposalDTO[];
  onOpenPost: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line">
        {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => (
          <div key={d} className="bg-ink-1 px-2 py-2 text-xs text-fg-3">
            {d}
          </div>
        ))}
        {days.map((d) => (
          <MonthCell
            key={d}
            day={d}
            inMonth={d.startsWith(anchorMonth)}
            isToday={d === today}
            past={d < today}
            tz={tz}
            accById={accById}
            posts={posts.filter((p) => dayKey(new Date(p.scheduledFor), tz) === d)}
            proposals={proposals.filter((p) => dayKey(new Date(p.scheduledFor), tz) === d).length}
            onOpenPost={onOpenPost}
          />
        ))}
      </div>
    </div>
  );
}

function MonthCell({
  day,
  inMonth,
  isToday,
  past,
  tz,
  accById,
  posts,
  proposals,
  onOpenPost,
}: {
  day: string;
  inMonth: boolean;
  isToday: boolean;
  past: boolean;
  tz: string;
  accById: Map<string, AccountDTO>;
  posts: PostDTO[];
  proposals: number;
  onOpenPost: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { day }, disabled: past });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[112px] bg-ink-1 p-1.5 transition-[background,box-shadow]",
        !inMonth && "bg-ink-0/80",
        isOver && "bg-ultra/[0.12] shadow-[inset_0_0_0_1px_rgb(112_112_255/0.8)]",
      )}
    >
      <div className={cn("mb-1 px-1 font-mono text-xs tabular", isToday ? "text-orange" : inMonth ? "text-fg-2" : "text-fg-3/60")}>{Number(day.slice(8))}</div>
      <div className="space-y-0.5">
        {posts.slice(0, 4).map((p) => (
          <DraggableMonthPost key={p.id} post={p} tz={tz} color={accById.get(p.accountId)?.color ?? "#fff"} onOpen={() => onOpenPost(p.id)} />
        ))}
        {posts.length > 4 && <div className="px-1 text-[11px] text-fg-3">+{posts.length - 4} más</div>}
        {proposals > 0 && (
          <Link href="/bandeja" className="flex items-center gap-1 px-1 text-[11px] text-fg-3 hover:text-fg-2">
            <StatusMark mark="proposed" /> {proposals} {proposals === 1 ? "propuesta" : "propuestas"}
          </Link>
        )}
      </div>
    </div>
  );
}

function DraggableMonthPost({ post, tz, color, onOpen }: { post: PostDTO; tz: string; color: string; onOpen: () => void }) {
  const movable = post.status === "scheduled";
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `post:${post.id}`, data: { kind: "post", post }, disabled: !movable });
  return (
    <button
      ref={setNodeRef}
      {...(movable ? { ...listeners, ...attributes, role: undefined } : {})}
      onClick={onOpen}
      className={cn("flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-white/5", isDragging && "opacity-30")}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-mono text-fg-2 tabular">{timeKey(new Date(post.scheduledFor), tz)}</span>
      <span className="truncate text-fg-3">{post.videoTitle}</span>
      <span className="ml-auto">
        <StatusMark mark={STATUS_MARK[post.status] ?? "scheduled"} />
      </span>
    </button>
  );
}

/** En el celular: agenda por día, para mirar estados y abrir el detalle. */
function Agenda({
  days,
  today,
  tz,
  accById,
  posts,
  proposals,
  onOpenPost,
}: {
  days: string[];
  today: string;
  tz: string;
  accById: Map<string, AccountDTO>;
  posts: PostDTO[];
  proposals: ProposalDTO[];
  onOpenPost: (id: string) => void;
}) {
  return (
    <div className="space-y-5 px-4 py-4 md:hidden">
      {days.map((d) => {
        const list = posts.filter((p) => dayKey(new Date(p.scheduledFor), tz) === d);
        const props = proposals.filter((p) => dayKey(new Date(p.scheduledFor), tz) === d).length;
        return (
          <section key={d}>
            <h2 className={cn("mb-2 text-xs capitalize", d === today ? "text-orange" : "text-fg-3")}>
              {fmt(atLocal(d, "12:00", tz), tz, "EEEE d")}
              {d === today && " · hoy"}
            </h2>
            {list.length === 0 && props === 0 ? (
              <p className="text-[13px] text-fg-3">Nada programado</p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-ink-2">
                {list.map((p) => {
                  const acc = accById.get(p.accountId);
                  return (
                    <button key={p.id} onClick={() => onOpenPost(p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <span className="font-mono text-[13px] tabular">{timeKey(new Date(p.scheduledFor), tz)}</span>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: acc?.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{p.videoTitle}</span>
                        <span className="block truncate text-xs text-fg-3">{acc?.displayName}</span>
                      </span>
                      <StatusMark mark={STATUS_MARK[p.status] ?? "scheduled"} withLabel />
                    </button>
                  );
                })}
                {props > 0 && (
                  <Link href="/bandeja" className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-fg-2">
                    <StatusMark mark="proposed" /> {props} {props === 1 ? "propuesta para aprobar" : "propuestas para aprobar"}
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
