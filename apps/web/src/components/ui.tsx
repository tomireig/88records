"use client";

import * as RDialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export const cn = clsx;

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-orange text-white shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_20px_-6px_rgb(255_77_0/0.55)] hover:bg-orange-hi active:translate-y-px",
  secondary: "bg-ink-3 text-fg border border-line-strong hover:bg-ink-4 hover:border-white/20 active:translate-y-px",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/5",
  danger: "text-bad border border-bad/30 hover:bg-bad/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background,border-color,color,transform,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label className={cn("flex items-start justify-between gap-4 py-2.5", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg-3">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200",
          checked ? "border-orange bg-orange" : "border-line-strong bg-ink-4",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
          className={cn("absolute top-0.5 size-3.5 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")}
        />
      </button>
    </label>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "max-w-2xl",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Fijo debajo del contenido: las acciones nunca quedan fuera de la vista. */
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount {...(description ? {} : { "aria-describedby": undefined })}>
              <motion.div
                className={cn(
                  "fixed top-[6vh] left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-24px)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line-strong bg-ink-2/95 shadow-pop backdrop-blur-xl",
                  width,
                )}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <RDialog.Title className="text-[15px] font-semibold tracking-tight">{title}</RDialog.Title>
                    {description && (
                      <RDialog.Description className="mt-0.5 text-[13px] text-fg-2">{description}</RDialog.Description>
                    )}
                  </div>
                  <RDialog.Close className="-mr-1 rounded-md p-1 text-fg-3 hover:bg-white/5 hover:text-fg" aria-label="Cerrar">
                    <X className="size-4" />
                  </RDialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                {footer && <div className="shrink-0 border-t border-line bg-ink-1/80 px-5 py-4">{footer}</div>}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

export function Avatar({ src, name, color, size = 28, busy }: { src?: string | null; name: string; color: string; size?: number; busy?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, boxShadow: `0 0 0 1.5px ${color}, 0 0 14px -2px ${color}66` }}
    >
      {busy && (
        // Late suave mientras algo de la cuenta se está publicando.
        <span aria-hidden className="absolute -inset-[4px] animate-pulse-soft rounded-full" style={{ boxShadow: `0 0 0 1.5px ${color}, 0 0 18px ${color}` }} />
      )}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-[10px] font-semibold text-fg" style={{ fontSize: size * 0.36 }}>
          {initials}
        </span>
      )}
    </span>
  );
}

export type Mark = "scheduled" | "proposed" | "busy" | "drafts" | "published" | "failed" | "canceled";

const markStyle: Record<Mark, { cls: string; label: string }> = {
  scheduled: { cls: "bg-fg", label: "Programado" },
  proposed: { cls: "border border-fg-2 bg-transparent", label: "Propuesto" },
  busy: { cls: "bg-busy animate-pulse-soft", label: "Procesando" },
  drafts: { cls: "bg-warn", label: "En borradores" },
  published: { cls: "bg-ok", label: "Publicado" },
  failed: { cls: "bg-bad", label: "Error" },
  canceled: { cls: "bg-fg-3", label: "Cancelado" },
};

/** Estado como una marca en celda fija: llena programado, hueca propuesto, color según resultado. */
export function StatusMark({ mark, withLabel }: { mark: Mark; withLabel?: boolean }) {
  const s = markStyle[mark];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-2 shrink-0 rounded-full", s.cls)} aria-hidden={withLabel} aria-label={withLabel ? undefined : s.label} />
      {withLabel && <span className="text-xs text-fg-2">{s.label}</span>}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-ink-3 px-1.5 py-px font-mono text-[10px] text-fg-2">{children}</kbd>;
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="grid size-4 shrink-0 cursor-pointer appearance-none place-content-center rounded border border-line-strong bg-ink-3 transition-colors checked:border-ultra-hi checked:bg-ultra before:hidden before:size-2 before:rounded-[2px] before:bg-white checked:before:block hover:border-white/30"
    />
  );
}
