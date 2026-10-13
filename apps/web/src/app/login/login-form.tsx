"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        Contraseña
        <input name="password" type="password" required autoFocus autoComplete="current-password" className="input text-base" />
      </label>
      {state.error && <p className="text-sm font-bold text-orange">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
