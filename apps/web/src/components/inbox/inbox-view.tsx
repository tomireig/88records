"use client";

import { Check, CheckCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { approveProposals, discardProposals, loadBatchContext } from "@/app/actions";
import type { AccountDTO, ProposalDTO } from "@/lib/data";
import { fmt, when } from "@/lib/when";
import { ChoicesForm, choicesProblems, ConsentText, EMPTY_CHOICES, type ChoicesState } from "../publish/choices-form";
import { Avatar, Button, cn, Dialog } from "../ui";

type Batch = Extract<Awaited<ReturnType<typeof loadBatchContext>>, { ok: true }>;

const RECENT_LABEL: Record<string, string> = {
  approved: "Aprobada, esperando su horario",
  executing: "Ejecutándose",
  done: "Hecha",
  failed: "Falló",
  discarded: "Descartada",
};

export function InboxView({
  tz,
  proposals,
  accounts,
  recent,
}: {
  tz: string;
  proposals: ProposalDTO[];
  accounts: AccountDTO[];
  recent: { id: string; status: string; updatedAt: string; scheduledFor: string | null; title: string; account: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  useEffect(() => setSelected((s) => new Set([...s].filter((id) => proposals.some((p) => p.actionId === id)))), [proposals]);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allSelected = proposals.length > 0 && selected.size === proposals.length;

  const discard = (ids: string[]) =>
    start(async () => {
      const r = await discardProposals(ids);
      if (r.ok) {
        toast(`${r.count} ${r.count === 1 ? "propuesta descartada" : "propuestas descartadas"}`);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Bandeja</h1>
        <span className="font-mono text-xs text-fg-3 tabular">{proposals.length} para aprobar</span>
        {proposals.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setSelected(allSelected ? new Set() : new Set(proposals.map((p) => p.actionId)))} className="text-xs text-fg-2 hover:text-fg">
              {allSelected ? "Quitar selección" : "Seleccionar todo"}
            </button>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} disabled={pending} onClick={() => discard([...selected])}>
                  Descartar {selected.size}
                </Button>
                <Button size="sm" variant="primary" icon={<CheckCheck className="size-3.5" />} onClick={() => setApproving([...selected])}>
                  Aprobar {selected.size}
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-4xl p-4 md:p-6">
        {proposals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
            <h2 className="text-base font-medium">Nada para aprobar</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-fg-2">
              Las propuestas aparecen acá cuando usás «Autollenar semana» en el{" "}
              <Link href="/calendario" className="text-fg underline">
                calendario
              </Link>
              . Nada se publica sin pasar por esta bandeja o por la pantalla de publicación.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {proposals.map((p, i) => {
                const acc = accById.get(p.accountId);
                const isSel = selected.has(p.actionId);
                return (
                  <motion.li
                    key={p.actionId}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "flex gap-3 rounded-lg border bg-ink-2 p-3 transition-[border-color,box-shadow]",
                      isSel ? "border-ultra-hi/70 shadow-[var(--glow-ultra)]" : "border-line hover:border-line-strong",
                    )}
                  >
                    <label className="flex shrink-0 cursor-pointer items-start pt-1">
                      <input type="checkbox" checked={isSel} onChange={() => toggle(p.actionId)} className="size-4 accent-[#1e1ee6]" aria-label={`Seleccionar ${p.videoTitle}`} />
                    </label>
                    <div className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded bg-ink-4">
                      {p.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {acc && <Avatar src={acc.avatarUrl} name={acc.displayName} color={acc.color} size={18} />}
                        <span className="text-[13px] font-medium">{acc?.displayName ?? "Cuenta desconectada"}</span>
                        <span className="font-mono text-xs text-fg-2 tabular">{when(p.scheduledFor, tz)}</span>
                      </div>
                      <p className="mt-1 truncate text-[13px]">{p.videoTitle}</p>
                      {p.caption && <p className="mt-0.5 line-clamp-1 text-xs text-fg-3">{p.caption}</p>}
                      <p className="mt-1.5 text-xs leading-5 text-fg-2">{p.reason}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-start">
                      <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={() => setApproving([p.actionId])}>
                        Aprobar
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => discard([p.actionId])} aria-label={`Descartar ${p.videoTitle}`}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {recent.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-medium text-fg-2">Últimas decisiones</h2>
            <ul className="divide-y divide-line text-[13px]">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">
                    {r.title} <span className="text-fg-3">· {r.account}</span>
                  </span>
                  <span className={cn("text-xs", r.status === "failed" ? "text-bad" : r.status === "done" ? "text-ok" : "text-fg-3")}>{RECENT_LABEL[r.status]}</span>
                  <span className="hidden font-mono text-xs text-fg-3 tabular sm:inline">{fmt(r.updatedAt, tz, "d MMM HH:mm")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ApproveDialog
        ids={approving}
        proposals={proposals}
        onClose={(done) => {
          setApproving(null);
          if (done) {
            setSelected(new Set());
            router.refresh();
          }
        }}
      />
    </div>
  );
}

function ApproveDialog({ ids, proposals, onClose }: { ids: string[] | null; proposals: ProposalDTO[]; onClose: (done: boolean) => void }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ChoicesState>(EMPTY_CHOICES);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!ids) return;
    setBatch(null);
    setError(null);
    setChoices(EMPTY_CHOICES);
    let alive = true;
    loadBatchContext(ids).then((r) => {
      if (!alive) return;
      if (r.ok) setBatch(r);
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [ids]);

  const direct = batch?.mode.directPost ?? false;
  const broken = batch?.accounts.filter((a) => a.error) ?? [];
  const problems = batch ? choicesProblems(choices, direct) : [];
  const n = ids?.length ?? 0;
  const single = n === 1 ? proposals.find((p) => p.actionId === ids![0]) : null;

  return (
    <Dialog
      open={Boolean(ids)}
      onOpenChange={(o) => !o && onClose(false)}
      title={n === 1 ? "Aprobar publicación" : `Aprobar ${n} publicaciones`}
      description={single ? single.videoTitle : "Lo que elijas acá se aplica a todas. Cada una sale en su cuenta y horario."}
      width="max-w-xl"
    >
      {error && <p className="p-5 text-sm text-bad">{error}</p>}
      {!batch && !error && (
        <div className="space-y-3 p-5">
          <div className="skeleton h-10 rounded-md" />
          <div className="skeleton h-32 rounded-md" />
        </div>
      )}
      {batch && (
        <>
          <div className="space-y-6 p-5">
            <div>
              <h3 className="mb-2 text-[13px] font-medium">Cuentas</h3>
              <ul className="space-y-1 text-[13px]">
                {batch.accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span>{a.nickname}</span>
                    {a.error ? <span className="truncate text-xs text-bad">{a.error}</span> : <span className="text-xs text-fg-3">{direct ? "Publicación directa" : "A borradores de TikTok"}</span>}
                  </li>
                ))}
              </ul>
              {broken.length > 0 && <p className="mt-2 text-xs text-warn">Las publicaciones de cuentas con error van a quedar en la bandeja.</p>}
            </div>

            {direct && batch.common.length === 0 ? (
              <p className="text-[13px] text-bad">Estas cuentas no comparten ninguna opción de privacidad. Aprobalas por separado.</p>
            ) : (
              <ChoicesForm
                value={choices}
                onChange={setChoices}
                direct={direct}
                allowed={batch.common}
                locked={{ comment: batch.commentLocked, duet: batch.duetLocked, stitch: batch.stitchLocked }}
              />
            )}
          </div>
          <div className="border-t border-line bg-ink-1/60 px-5 py-4">
            <ConsentText brandContent={choices.brandContent} />
            {problems[0] && <p className="mt-2 text-xs text-warn">{problems[0]}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onClose(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                icon={<CheckCheck className="size-4" />}
                loading={pending}
                disabled={problems.length > 0 || (direct && batch.common.length === 0)}
                onClick={() =>
                  start(async () => {
                    const r = await approveProposals(ids!, {
                      privacyLevel: direct ? choices.privacyLevel : null,
                      allowComment: choices.allowComment,
                      allowDuet: choices.allowDuet,
                      allowStitch: choices.allowStitch,
                      brandOrganic: choices.brandOrganic,
                      brandContent: choices.brandContent,
                      consent: true,
                    });
                    if (!r.ok) return void toast.error(r.error);
                    if (r.approved) toast.success(`${r.approved} ${r.approved === 1 ? "publicación programada" : "publicaciones programadas"}`);
                    for (const e of r.errors.slice(0, 3)) toast.error(e.message);
                    onClose(r.approved > 0);
                  })
                }
              >
                {n === 1 ? "Aprobar y programar" : `Aprobar ${n}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}
