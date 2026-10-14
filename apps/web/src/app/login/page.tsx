import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LiveBackground } from "./live-background";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";
import { authMode } from "@/lib/supabase";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const mode = authMode();
  if (mode === "local" || (await getSession())) redirect("/calendario");
  const { error } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <LiveBackground />
      <div className="relative w-full max-w-[380px] rounded-lg border border-line-strong bg-ink-1/70 p-7 shadow-pop backdrop-blur-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">
          88RECORDS<sup className="ml-0.5 text-xs font-medium text-fg-2">®</sup>
        </h1>
        <p className="mt-1 text-sm text-fg-2">Panel TikTok™ del sello</p>
        {mode === "supabase" ? (
          <LoginForm initialError={error === "link" ? "El link venció o ya se usó. Pedí otro." : null} />
        ) : mode === "password" ? (
          <PasswordForm />
        ) : (
          <p className="mt-6 text-sm text-warn">Falta configurar el acceso: APP_PASSWORD o las claves de Supabase.</p>
        )}
      </div>
    </main>
  );
}
