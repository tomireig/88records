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
      <aside className="sticky top-0 hidden h-dvh w-[212px] shrink-0 flex-col border-r border-line bg-ink-1/80 px-3 pt-5 pb-4 backdrop-blur md:flex">
        <Link href="/calendario" className="mb-7 px-2.5" aria-label="88RECORDS®, inicio">
          <span className="block text-[15px] font-bold tracking-[-0.02em]">
            88RECORDS<sup className="ml-px text-[9px] font-medium text-fg-2">®</sup>
          </span>
          <span className="mt-0.5 block text-xs text-fg-3">Panel TikTok™</span>
        </Link>
        <nav className="flex flex-col gap-0.5" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                  active ? "text-fg" : "text-fg-2 hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md border border-line-strong bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon className={cn("relative size-4", active && "text-orange")} strokeWidth={1.8} />
                <span className="relative">{label}</span>
                {href === "/bandeja" && inboxCount > 0 && (
                  <span className="relative ml-auto rounded-full bg-orange px-1.5 font-mono text-[11px] leading-5 text-white tabular">
                    {inboxCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto truncate px-2.5 text-xs text-fg-3" title={userLabel}>
          {userLabel}
        </div>
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
