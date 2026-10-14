import { cn } from "../ui";

const LABEL = {
  uploading: "Subiendo",
  analyzing: "Analizando",
  rendering: "Renderizando",
  ready: "Listo",
  failed: "Error",
} as const;

export function ReleaseStatusPill({ status, proposals }: { status: keyof typeof LABEL; proposals?: number }) {
  const busy = status === "analyzing" || status === "rendering" || status === "uploading";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        status === "failed" ? "border-bad/40 text-bad-fg" : status === "ready" ? "border-ok/30 text-ok" : "border-busy/40 text-busy",
      )}
    >
      <span className={cn("size-1.5 rounded-full", status === "failed" ? "bg-bad" : status === "ready" ? "bg-ok" : "bg-busy", busy && "animate-pulse-soft")} />
      {status === "ready" && proposals ? `${proposals} en la bandeja` : LABEL[status]}
    </span>
  );
}
