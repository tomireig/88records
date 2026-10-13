import Link from "next/link";

export function PageHeader({ tag, title, children }: { tag: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="tag text-orange">{tag}</p>
        <h1 className="h1 mt-2">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="h2">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, accent, href }: { label: string; value: string; accent?: boolean; href?: string }) {
  const body = (
    <div className={`box h-full p-4 ${accent ? "border-orange bg-orange text-paper" : ""}`}>
      <p className="tag opacity-80">{label}</p>
      <p className="mt-3 text-3xl font-bold tabular-nums md:text-4xl">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border border-dashed border-line px-4 py-6 text-sm text-mute">{children}</p>;
}

export function Pill({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "orange" | "ultra" | "mute" }) {
  const tones = {
    ink: "border-ink text-ink",
    orange: "border-orange bg-orange text-paper",
    ultra: "border-ultra bg-ultra text-paper",
    mute: "border-line text-mute",
  };
  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
}
