"use client";

import { History, Plus, RefreshCw, Settings2, Unplug } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createArtist, disconnect, saveAccountRules } from "@/app/actions";
import type { AccountDTO, ArtistDTO } from "@/lib/data";
import { fmt, relativeWhen } from "@/lib/when";
import { Avatar, Button, cn, Dialog } from "../ui";

const FLASH_ERRORS: Record<string, string> = {
  config: "Falta configurar la app de TikTok (TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET).",
  denied: "Cancelaste la autorización en TikTok. La cuenta no se conectó.",
  state: "La conexión venció o no coincide. Probá de nuevo desde el botón.",
  oauth: "TikTok no completó la conexión.",
};

const HEALTH = {
  active: { label: "Activa", cls: "bg-ok" },
  expiring: { label: "Por vencer", cls: "bg-warn" },
  broken: { label: "Caída", cls: "bg-bad" },
} as const;

const COLORS = ["#FF4D00", "#4D5BFF", "#00C2A8", "#FFB000", "#E04DFF", "#4DB8FF", "#FF4D8D", "#9BE15D"];

export function AccountsView({
  tz,
  accounts,
  artists,
  flash,
}: {
  tz: string;
  accounts: AccountDTO[];
  artists: ArtistDTO[];
  flash: { connected?: string; error?: string; detail?: string };
}) {
  const [editing, setEditing] = useState<AccountDTO | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    if (flash.connected) toast.success(`${flash.connected} quedó conectada`);
    if (flash.error) toast.error(flash.detail || FLASH_ERRORS[flash.error] || "No se pudo conectar la cuenta.");
    // Limpia la URL sin navegar: una navegación acá cortaría cualquier acción que se dispare enseguida.
    if (flash.connected || flash.error) window.history.replaceState(null, "", "/cuentas");
  }, [flash]);

  const publishingToday = accounts.filter((a) => a.todayCount > 0).length;

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Cuentas</h1>
        <span className="font-mono text-xs text-fg-3 tabular">
          {accounts.length} conectadas · {publishingToday} publican hoy
        </span>
        <a href="/api/tiktok/connect" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-orange px-3 text-[13px] font-medium text-white hover:bg-orange-hi">
          <Plus className="size-3.5" /> Conectar cuenta
        </a>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 p-4 md:p-6">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
            <h2 className="text-base font-medium">Todavía no hay cuentas</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-fg-2">
              Tocá «Conectar cuenta»: se abre el login oficial de TikTok, iniciás sesión con la cuenta del artista y autorizás. Repetilo por cada cuenta.
              Para conectar otra, cerrá sesión en TikTok en el navegador antes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink-1/60">
            {accounts.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0.4, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4 md:flex-nowrap", a.health === "broken" && "bg-bad/[0.03]")}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={a.avatarUrl} name={a.displayName} color={a.color} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.displayName}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("size-1.5 rounded-full", HEALTH[a.health].cls)} />
                        {HEALTH[a.health].label}
                      </span>
                      <span>·</span>
                      <span className="truncate">{a.artistName ?? "Sin artista asignado"}</span>
                    </div>
                    {a.health === "broken" && a.lastError && <p className="mt-1 text-xs text-bad-fg">{a.lastError}</p>}
                    {a.health === "expiring" && (
                      <p className="mt-1 text-xs text-warn">La autorización vence el {fmt(a.refreshExpiresAt, tz, "d MMM")}. Reconectala antes.</p>
                    )}
                  </div>
                </div>

                <dl className="grid w-full grid-cols-2 gap-x-6 text-xs md:w-[240px]">
                  <div>
                    <dt className="text-fg-3">Hoy</dt>
                    <dd className="mt-0.5 font-mono text-sm tabular">
                      {a.todayCount}
                      <span className="text-fg-3">/{a.maxPostsPerDay}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-3">Próxima</dt>
                    <dd className="mt-0.5 truncate font-mono text-sm tabular">{a.nextPostAt ? relativeWhen(a.nextPostAt, tz) : "—"}</dd>
                  </div>
                </dl>

                <div className="flex items-center gap-1">
                  {a.health !== "active" && (
                    <a href="/api/tiktok/connect" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-orange px-3 text-[13px] font-medium text-white hover:bg-orange-hi">
                      <RefreshCw className="size-3.5" /> Reconectar
                    </a>
                  )}
                  <Button size="sm" variant="ghost" icon={<Settings2 className="size-3.5" />} onClick={() => setEditing(a)}>
                    Reglas
                  </Button>
                  <Link href={`/cuentas/${a.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] text-fg-2 hover:bg-white/5 hover:text-fg">
                    <History className="size-3.5" /> Historial
                  </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        )}

        <Artists artists={artists} />
      </div>

      <RulesDialog account={editing} artists={artists} onClose={() => setEditing(null)} />
    </div>
  );
}

function Artists({ artists }: { artists: ArtistDTO[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <section>
      <h2 className="text-sm font-medium">Artistas</h2>
      <p className="mt-1 text-xs text-fg-3">Asignar cada cuenta y cada video a su artista hace que «Autollenar semana» no mezcle contenido entre artistas.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {artists.map((a) => (
          <span key={a.id} className="rounded-full border border-line-strong bg-ink-2 px-3 py-1 text-[13px]">
            {a.name}
          </span>
        ))}
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createArtist(name);
              if (r.ok) {
                setName("");
                toast.success(`${r.artist.name} agregado`);
              } else toast.error(r.error);
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del artista"
            className="h-8 w-48 rounded-full border border-line-strong bg-ink-3 px-3 text-[13px] placeholder:text-fg-3"
          />
          <Button size="sm" type="submit" loading={pending} disabled={!name.trim()}>
            Agregar
          </Button>
        </form>
      </div>
    </section>
  );
}

function RulesDialog({ account, artists, onClose }: { account: AccountDTO | null; artists: ArtistDTO[]; onClose: () => void }) {
  const [artistId, setArtistId] = useState("");
  const [slots, setSlots] = useState("");
  const [max, setMax] = useState(3);
  const [template, setTemplate] = useState("");
  const [tags, setTags] = useState("");
  const [color, setColor] = useState("#FF4D00");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!account) return;
    setArtistId(account.artistId ?? "");
    setSlots(account.preferredSlots.join(", "));
    setMax(account.maxPostsPerDay);
    setTemplate(account.captionTemplate ?? "");
    setTags(account.hashtags.map((h) => `#${h}`).join(" "));
    setColor(account.color);
  }, [account]);

  const field = "h-9 w-full rounded-md border border-line-strong bg-ink-3 px-3 text-sm placeholder:text-fg-3";

  return (
    <Dialog open={Boolean(account)} onOpenChange={(o) => !o && onClose()} title={`Reglas de ${account?.displayName ?? ""}`}
      width="max-w-lg"
      footer={account && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={<Unplug className="size-3.5" />}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!confirm(`¿Desconectar ${account!.displayName}? Se cancelan sus publicaciones programadas.`)) return;
                  const r = await disconnect(account!.id);
                  if (r.ok) {
                    toast.success("Cuenta desconectada");
                    onClose();
                  } else toast.error(r.error);
                })
              }
            >
              Desconectar
            </Button>
            <Button type="submit" form="rules-form" variant="primary" loading={pending}>
              Guardar reglas
            </Button>
          </div>
      )}
    >
      {account && (
        <form
          id="rules-form"
          className="space-y-5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveAccountRules(account.id, {
                artistId: artistId || null,
                preferredSlots: slots.split(/[,\s]+/).filter(Boolean),
                maxPostsPerDay: max,
                captionTemplate: template,
                hashtags: tags.split(/[\s,]+/).filter(Boolean),
                color,
              });
              if (r.ok) {
                toast.success("Reglas guardadas");
                onClose();
              } else toast.error(r.error);
            });
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Artista</span>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={field}>
              <option value="">Sin artista</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">Franjas preferidas</span>
              <input value={slots} onChange={(e) => setSlots(e.target.value)} placeholder="12:30, 19:00, 21:30" className={cn(field, "font-mono tabular")} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">Tope por día</span>
              <input type="number" min={1} max={15} value={max} onChange={(e) => setMax(Number(e.target.value))} className={cn(field, "font-mono tabular")} />
            </label>
            <p className="col-span-2 -mt-1.5 text-xs text-fg-3">
              Hora de Buenos Aires. TikTok corta alrededor de 15 publicaciones por día por cuenta, sumando todas las apps.
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Plantilla de caption</span>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={3}
              placeholder="{titulo} · ya disponible en todas las plataformas"
              className="w-full rounded-md border border-line-strong bg-ink-3 px-3 py-2 text-sm placeholder:text-fg-3"
            />
            <span className="mt-1 block text-xs text-fg-3">{"{titulo}"} se reemplaza por el título del video.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Hashtags</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#techengue #cumbia" className={field} />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">Color en el calendario</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color.toLowerCase() === c.toLowerCase()}
                  className={cn("size-7 rounded-full ring-offset-2 ring-offset-ink-2 transition-shadow", color.toLowerCase() === c.toLowerCase() && "ring-2 ring-white")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>

        </form>
      )}
    </Dialog>
  );
}
