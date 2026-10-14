import { TikTokClient } from "@88/connectors/tiktok";
import { db } from "@88/db";
import { tiktokMode } from "@88/services/tiktok";
import { AlertTriangle, PowerOff } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireSession } from "@/lib/auth";
import { countProposals } from "@/lib/data";
import { localMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function Notice({ tone, icon, children }: { tone: "warn" | "bad" | "info"; icon: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    warn: "border-warn/25 bg-warn/[0.06] text-warn-fg",
    bad: "border-bad/25 bg-bad/[0.07] text-bad-fg",
    info: "border-line bg-white/[0.02] text-fg-2",
  };
  return (
    <div className={`flex items-start gap-2.5 border-b px-4 py-2 text-[13px] leading-5 md:px-6 ${tones[tone]}`} role="status">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const mode = tiktokMode();
  const [inboxCount, heartbeat] = await Promise.all([
    countProposals(session.org.id),
    db.workerHeartbeat.findUnique({ where: { id: "main" } }),
  ]);
  const workerOnline = heartbeat && Date.now() - heartbeat.seenAt.getTime() < 2 * 60_000;

  const notices = (
    <>
      {!workerOnline && (
        <Notice tone="bad" icon={<PowerOff className="size-4" />}>
          <strong className="font-medium">El worker está apagado.</strong> Lo programado no se va a publicar hasta que lo prendas con{" "}
          <code className="font-mono text-xs">pnpm worker</code> en la PC.
          {heartbeat && <> Último latido: {heartbeat.seenAt.toLocaleString("es-AR", { timeZone: session.org.timezone })}.</>}
        </Notice>
      )}
      {!mode.audited && (
        <Notice tone="warn" icon={<AlertTriangle className="size-4" />}>
          <strong className="font-medium">Modo sin auditar.</strong> Hasta que TikTok apruebe la app, publican como máximo 5 cuentas por día, todo sale
          como privado (Solo yo) y las cuentas tienen que estar en privado.{" "}
          {mode.directPost ? "Publicación directa activada." : "Los videos llegan como borrador a la app de TikTok y se terminan de publicar ahí."}
        </Notice>
      )}
      {!TikTokClient.isConfigured() && (
        <Notice tone="info" icon={<AlertTriangle className="size-4" />}>
          Falta la app de TikTok: cargá <code className="font-mono text-xs">TIKTOK_CLIENT_KEY</code> y{" "}
          <code className="font-mono text-xs">TIKTOK_CLIENT_SECRET</code> en el <code className="font-mono text-xs">.env</code> para conectar cuentas.
        </Notice>
      )}
    </>
  );

  return (
    <Shell inboxCount={inboxCount} notices={notices} userLabel={localMode() ? `Modo local · ${session.user.email}` : session.user.email}>
      {children}
    </Shell>
  );
}
