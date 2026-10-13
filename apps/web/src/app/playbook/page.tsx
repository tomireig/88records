import { PageHeader } from "@/components/ui";
import { PLAYBOOK } from "@/lib/playbook";

export default function PlaybookPage() {
  return (
    <>
      <PageHeader tag="Playbook" title="Casos reales" />
      <div className="grid gap-6">
        {PLAYBOOK.map((c, i) => (
          <article key={c.artist} className="box grid gap-4 p-5 md:grid-cols-[200px_1fr]">
            <div>
              <p className="text-5xl font-bold tabular-nums text-orange">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-xl font-bold uppercase leading-tight">{c.artist}</p>
              <p className="tag mt-1 text-mute">{c.release}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="tag mb-1">Qué hizo</p>
                <p className="text-sm">{c.what}</p>
              </div>
              <div>
                <p className="tag mb-1 text-ultra">Lección</p>
                <p className="text-sm font-bold">{c.lesson}</p>
              </div>
              <div>
                <p className="tag mb-1 text-orange">Para 88RECORDS®</p>
                <ul className="list-inside list-disc text-sm">
                  {c.apply.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
