"use client";

import { useFormStatus } from "react-dom";

// Se bloquea mientras el form se guarda: evita duplicados por doble click.
export function SubmitButton({
  children,
  pendingText = "Guardando…",
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
