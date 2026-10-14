"use client";

import { CalendarDays, Clapperboard, Inbox, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./ui";

const NAV = [
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: Clapperboard },
  { href: "/cuentas", label: "Cuentas", icon: UsersRound },
  { href: "/bandeja", label: "Bandeja", icon: Inbox },
] as const;

export function Shell({
  children,
  inboxCount,
  notices,
  userLabel,
}: {
  children: ReactNode;
  inboxCount: number;
  notices: ReactNode;
  userLabel: string;
}) {
  const path = usePathname();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 z-30 hidden h-dvh w-16 shrink-0 flex-col items-center border-r border-line bg-ink-1/80 pt-4 pb-4 backdrop-blur md:flex">
        <Link href="/calendario" className="group relative mb-6 grid size-10 place-items-center rounded-md" aria-label="88RECORDS®, Panel TikTok™">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-8" />
          <Tip>88RECORDS® · Panel TikTok™</Tip>
        </Link>
        <nav className="flex flex-col items-center gap-1" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn("group relative grid size-10 place-items-center rounded-md transition-colors", active ? "text-fg" : "text-fg-3 hover:bg-white/[0.05] hover:text-fg")}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md border border-line-strong bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className={cn("relative size-[18px]", active && "text-orange")} strokeWidth={1.8} />
                {href === "/bandeja" && inboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-orange px-1 text-center font-mono text-[10px] leading-4 text-white tabular">{inboxCount}</span>
                )}
                <Tip>{label}</Tip>
              </Link>
            );
          })}
        </nav>
        <span className="group relative mt-auto grid size-8 place-items-center rounded-full border border-line-strong text-[11px] text-fg-2" tabIndex={0} aria-label={userLabel}>
          {userLabel.replace(/^Modo local · /, "").slice(0, 1).toUpperCase()}
          <Tip>{userLabel}</Tip>
        </span>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {notices}
        {children}
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-ink-1/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex h-14 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-fg" : "text-fg-3")}
            >
              <Icon className={cn("size-5", active && "text-orange")} strokeWidth={1.8} />
              {label}
              {href === "/bandeja" && inboxCount > 0 && (
                <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-orange px-1 font-mono text-[10px] leading-4 text-white tabular">
                  {inboxCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Etiqueta que aparece al pasar el mouse o con foco de teclado. */
function Tip({ children }: { children: ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-x-1 -translate-y-1/2 rounded-md border border-line-strong bg-ink-3 px-2 py-1 text-xs whitespace-nowrap text-fg opacity-0 shadow-lift transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}
