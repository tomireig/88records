import type { Mark } from "@/components/ui";

export const STATUS_MARK: Record<string, Mark> = {
  scheduled: "scheduled",
  publishing: "busy",
  processing: "busy",
  in_drafts: "drafts",
  published: "published",
  failed: "failed",
  canceled: "canceled",
};

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programado",
  publishing: "Subiendo",
  processing: "Procesando",
  in_drafts: "En borradores",
  published: "Publicado",
  failed: "Error",
  canceled: "Cancelado",
};
