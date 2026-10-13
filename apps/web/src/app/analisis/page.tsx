import { db } from "@88/db";
import { Empty, PageHeader, Section, Stat } from "@/components/ui";
import { FORMATS, PLATFORMS, num, pct, usd } from "@/lib/labels";

export const dynamic = "force-dynamic";

interface Row {
  key: string;
  label: string;
  pieces: number;
  views: number;
  engagement: number;
}

function group<K extends string>(
  pieces: { views: number; likes: number; comments: number; shares: number; saves: number; key: K }[],
  labels: Record<K, string>,
): Row[] {
  const map = new Map<K, Row>();
  for (const p of pieces) {
    const row = map.get(p.key) ?? { key: p.key, label: labels[p.key], pieces: 0, views: 0, engagement: 0 };
    row.pieces += 1;
    row.views += p.views;
    row.engagement += p.likes + p.comments + p.shares + p.saves;
    map.set(p.key, row);
  }
  return [...map.values()].sort((a, b) => b.views / b.pieces - a.views / a.pieces);
}

function RankTable({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.views / r.pieces), 1);
  return (
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Nombre</th>
          <th className="text-right">Piezas</th>
          <th className="w-1/3">Views promedio</th>
          <th className="text-right">Engagement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const avg = r.views / r.pieces;
          return (
            <tr key={r.key}>
              <td className="font-bold tabular-nums">{i + 1}</td>
              <td className="font-bold">{r.label}</td>
              <td className="text-right tabular-nums">{r.pieces}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-3 bg-orange" style={{ width: `${(avg / max) * 100}%` }} />
                  <span className="shrink-0 text-xs tabular-nums">{num(avg)}</span>
                </div>
              </td>
              <td className="text-right tabular-nums">{r.views ? pct(r.engagement / r.views) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function AnalysisPage() {
  const [published, pitches] = await Promise.all([
    db.contentPiece.findMany({ where: { stage: "PUBLISHED" } }),
    db.pitch.findMany(),
  ]);

  const byFormat = group(published.map((p) => ({ ...p, key: p.format })), FORMATS);
  const byPlatform = group(published.map((p) => ({ ...p, key: p.platform })), PLATFORMS);

  const sent = pitches.filter((p) => p.stage !== "TO_SEND");
  const accepted = pitches.filter((p) => p.stage === "ACCEPTED");
  const resolved = pitches.filter((p) => p.stage === "ACCEPTED" || p.stage === "REJECTED");
  const totalCost = pitches.reduce((s, p) => s + p.costUsd, 0);
  const totalAdds = pitches.reduce((s, p) => s + p.adds, 0);

  const best = byFormat[0];

  return (
    <>
      <PageHeader tag="Análisis" title="Qué rinde" />

      {best && (
        <p className="mb-8 border-l-4 border-orange pl-4 text-lg">
          El formato que mejor rinde es <strong>{best.label}</strong>, con {num(best.views / best.pieces)} views
          promedio. Es el que conviene doblar en D+14.
        </p>
      )}

      <Section title="Por formato">
        {byFormat.length === 0 ? (
          <Empty>Cuando marques piezas como publicadas y cargues sus views, el ranking aparece acá.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <RankTable rows={byFormat} />
          </div>
        )}
      </Section>

      <Section title="Por plataforma">
        {byPlatform.length === 0 ? (
          <Empty>Sin piezas publicadas todavía.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <RankTable rows={byPlatform} />
          </div>
        )}
      </Section>

      <Section title="Pitching">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Enviados" value={num(sent.length)} />
          <Stat label="Aceptados" value={num(accepted.length)} />
          <Stat label="Conversión" value={resolved.length ? pct(accepted.length / sent.length) : "—"} />
          <Stat label="Costo por add" value={totalAdds ? usd(totalCost / totalAdds) : "—"} accent />
        </div>
        <p className="mt-3 text-xs text-mute">
          Conversión = aceptados sobre enviados. Costo por add = todo lo gastado en pitching dividido por los adds
          conseguidos ({usd(totalCost)} / {num(totalAdds)} adds).
        </p>
      </Section>
    </>
  );
}
