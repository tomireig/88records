export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración pendiente · 88RECORDS® Marketing OS™" };

export default function SetupPage() {
  const steps = [
    {
      done: Boolean(process.env.DATABASE_URL),
      title: "Base de datos",
      how: "Vercel → proyecto 88records → Storage → Create Database → Neon → conectarla al proyecto.",
    },
    {
      done: Boolean(process.env.APP_PASSWORD),
      title: "Contraseña del equipo",
      how: "Settings → Environment Variables → APP_PASSWORD, para Production y Preview.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 grid overflow-auto bg-paper md:grid-cols-2">
      <section className="flex flex-col justify-between bg-orange p-6 text-paper md:p-12">
        <p className="text-2xl font-bold tracking-tight">
          88RECORDS<span className="text-ink">®</span>
        </p>
        <div className="my-16 md:my-0">
          <p className="tag opacity-80">Marketing OS™</p>
          <h1 className="mt-3 text-5xl font-bold uppercase leading-[0.9] tracking-tight md:text-7xl">
            Casi
            <br />
            listo.
          </h1>
        </div>
        <p className="tag opacity-80">Argentina · Chile · Puerto Rico</p>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <p className="tag text-ultra">Configuración pendiente</p>
          <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight">Faltan dos pasos</h2>
          <ol className="mt-6 grid gap-3">
            {steps.map((s, i) => (
              <li key={s.title} className={`box p-4 ${s.done ? "border-line text-mute" : ""}`}>
                <p className="text-sm font-bold uppercase">
                  {i + 1}. {s.title} {s.done && "· listo"}
                </p>
                {!s.done && <p className="mt-1 text-sm">{s.how}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-mute">Después, en Deployments: Redeploy.</p>
        </div>
      </section>
    </div>
  );
}
