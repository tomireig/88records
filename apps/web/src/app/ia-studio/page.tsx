import type { GenerationKind } from "@88/ai";
import { db } from "@88/db";
import { Generator } from "@/components/generator";
import { Empty, PageHeader, Section } from "@/components/ui";
import { KIND_LABELS, providerLabel } from "@/lib/ai-kinds";

export const dynamic = "force-dynamic";

const KINDS: GenerationKind[] = ["hooks", "script", "caption", "visual", "media_prompt", "calendar", "bio"];

const dt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AIStudioPage() {
  const [tracks, history] = await Promise.all([
    db.track.findMany({ include: { artist: true }, orderBy: { createdAt: "desc" } }),
    db.aiGeneration.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <PageHeader tag="IA Studio" title="Generar" />

      {!hasKey && (
        <p className="mb-6 border-l-4 border-ultra pl-4 text-sm text-mute">
          Modo plantillas: los textos salen de las plantillas del sello. Con la IA conectada, salen a medida de cada track.
        </p>
      )}

      <Section title="Nuevo">
        <Generator
          kinds={KINDS}
          tracks={tracks.map((t) => ({ id: t.id, title: t.title, artist: t.artist.name, genre: t.genre, mood: t.mood }))}
        />
      </Section>

      <Section title="Historial">
        {history.length === 0 ? (
          <Empty>Todavía no generaste nada.</Empty>
        ) : (
          <ul className="divide-y divide-line border border-ink">
            {history.map((h) => {
              const input = JSON.parse(h.prompt) as { track?: string; artist?: string };
              return (
                <li key={h.id}>
                  <details className="px-3 py-2">
                    <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 text-sm">
                      <span className="font-bold">{KIND_LABELS[h.kind as GenerationKind] ?? h.kind}</span>
                      <span className="text-mute">{[input.track, input.artist].filter(Boolean).join(" · ")}</span>
                      <span className="ml-auto text-xs tabular-nums text-mute">{dt.format(h.createdAt)}</span>
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{h.output}</pre>
                    <p className="mt-2 text-[10px] uppercase tracking-widest text-mute">{providerLabel(h.provider)}</p>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
