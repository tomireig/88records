import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · 88RECORDS® Marketing OS™" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="-mx-4 -my-6 grid min-h-screen md:-mx-10 md:-my-10 md:grid-cols-2">
      <section className="flex flex-col justify-between bg-orange p-6 text-paper md:p-12">
        <p className="text-2xl font-bold tracking-tight">
          88RECORDS<span className="text-ink">®</span>
        </p>
        <div className="my-16 md:my-0">
          <p className="tag opacity-80">Marketing OS™</p>
          <h1 className="mt-3 text-5xl font-bold uppercase leading-[0.9] tracking-tight md:text-7xl">
            Lanzar.
            <br />
            Contar.
            <br />
            Medir.
          </h1>
          <p className="mt-6 max-w-sm text-sm">
            Campañas, contenido, pitching y fans del sello en un solo lugar.
          </p>
        </div>
        <p className="tag opacity-80">Argentina · Chile · Puerto Rico</p>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <p className="tag text-ultra">Acceso del equipo</p>
          <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight">Entrar</h2>
          <LoginForm next={next ?? ""} />
        </div>
      </section>
    </div>
  );
}
