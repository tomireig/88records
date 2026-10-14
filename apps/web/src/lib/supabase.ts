import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type AuthMode = "supabase" | "password" | "local" | "none";

/**
 * Cómo se entra al panel: Supabase Auth si está configurado; si no, la contraseña de equipo
 * (APP_PASSWORD); en desarrollo sin nada, directo como el dueño. En producción sin nada, no entra nadie.
 */
export function authMode(): AuthMode {
  if (supabaseConfigured()) return "supabase";
  if (process.env.APP_PASSWORD) return "password";
  return process.env.NODE_ENV !== "production" ? "local" : "none";
}

export function localMode(): boolean {
  return authMode() === "local";
}

/** Usuario con el que entra la contraseña de equipo: el primer dueño configurado. */
export function teamEmail(): string {
  return ((process.env.OWNER_EMAILS ?? "").split(",")[0]?.trim() || "equipo@88records.app").toLowerCase();
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // En un Server Component no se pueden escribir cookies; el middleware ya refrescó la sesión.
        }
      },
    },
  });
}
