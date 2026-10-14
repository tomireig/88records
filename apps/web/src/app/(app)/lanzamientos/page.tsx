import type { Metadata } from "next";
import Link from "next/link";
import { NewReleaseButton } from "@/components/releases/new-release";
import { ReleaseStatusPill } from "@/components/releases/status";
import { requireSession } from "@/lib/auth";
import { listArtists, listReleases } from "@/lib/data";
import { atLocal, dayKey, fmt } from "@/lib/when";

export const metadata: Metadata = { title: "Lanzamientos" };

function countdown(iso: string | null, tz: string): string {
  if (!iso) return "Sin fecha";
  const days = Math.round((atLocal(dayKey(new Date(iso), tz), "12:00", tz).getTime() - atLocal(dayKey(new Date(), tz), "12:00", tz).getTime()) / 86_400_000);
  if (days === 0) return "Sale hoy";
  if (days > 0) return `Faltan ${days} ${days === 1 ? "día" : "días"}`;
  return `Salió hace ${-days} ${days === -1 ? "día" : "días"}`;
}

export default async function ReleasesPage() {
  const { org } = await requireSession();
  const [releases, artists] = await Promise.all([listReleases(org.id), listArtists(org.id)]);
  const tz = org.timezone;

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-ink-0/80 px-4 py-3 backdrop-blur-xl md:px-6">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Lanzamientos</h1>
        <div className="ml-auto">
          <NewReleaseButton artists={artists} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4 md:p-6">
        {releases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong px-6 py-14 text-center">
            <h2 className="text-base font-medium">Subí el primer lanzamiento</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-fg-2">
              El tema, la portada y la fecha alcanzan. El worker analiza el audio (BPM, tonalidad, drops, estribillo y letra), renderiza unas 20 piezas
              y propone la campaña completa en la bandeja para que la apruebes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink-1/60">
            {releases.map((r) => (
              <li key={r.id}>
                <Link href={`/lanzamientos/${r.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
                  <span className="size-14 shrink-0 overflow-hidden rounded-md bg-ink-4">
                    {r.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt="" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-fg-3">
                      {r.artistName} · {r.releaseDate ? fmt(r.releaseDate, tz, "d MMM yyyy") : "sin fecha"} · {countdown(r.releaseDate, tz)}
                    </span>
                  </span>
                  <span className="hidden w-36 shrink-0 sm:block">
                    <span className="block font-mono text-xs text-fg-2 tabular">
                      {r.pieces.ready}/{r.pieces.total} piezas
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full bg-orange" style={{ width: `${r.pieces.total ? (r.pieces.ready / r.pieces.total) * 100 : 0}%` }} />
                    </span>
                  </span>
                  <ReleaseStatusPill status={r.status} proposals={r.proposals} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
