"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { loginWithPassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(loginWithPassword, { error: null });
  return (
    <form action={action} className="mt-7 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-fg-2">Contraseña del equipo</span>
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          className="h-10 w-full rounded-md border border-line-strong bg-ink-3/80 px-3 text-sm focus:border-orange/60 focus:outline-none"
        />
      </label>
      {state.error && <p className="text-xs text-bad">{state.error}</p>}
      <Button type="submit" variant="primary" loading={pending} className="h-10 w-full" icon={<ArrowRight className="size-4" />}>
        Entrar
      </Button>
    </form>
  );
}
