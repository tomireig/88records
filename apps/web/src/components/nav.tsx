"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

const ITEMS = [
  { href: "/", label: "Panel" },
  { href: "/campanas", label: "Campañas" },
  { href: "/contenido", label: "Contenido" },
  { href: "/ia-studio", label: "IA Studio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/pitching", label: "Pitching" },
  { href: "/fan-funnel", label: "Fan Funnel" },
  { href: "/analisis", label: "Análisis" },
  { href: "/playbook", label: "Playbook" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (path === "/login") return null;

  return (
    <aside className="border-b border-ink bg-ink text-paper md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
      <div className="flex items-baseline justify-between px-4 pt-4 md:block md:px-6 md:pt-8">
        <Link href="/" className="block text-xl font-bold leading-none tracking-tight">
          88RECORDS<span className="text-orange">®</span>
        </Link>
        <p className="tag mt-1 text-paper/60 md:mt-2">Marketing OS™</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 py-3 md:mt-8 md:flex-col md:gap-0 md:px-0 md:py-0">
        {ITEMS.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-baseline gap-3 px-3 py-2 text-xs font-bold uppercase tracking-widest md:px-6 md:py-3 ${
              active(item.href) ? "bg-orange text-paper" : "text-paper/70 hover:text-paper"
            }`}
          >
            <span className="hidden font-normal tabular-nums md:inline">{String(i + 1).padStart(2, "0")}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={logout} className="px-4 pb-3 md:mt-auto md:px-6 md:py-6">
        <button className="text-[10px] font-bold uppercase tracking-widest text-paper/50 hover:text-paper">Salir</button>
      </form>
    </aside>
  );
}
