"use client";

import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  if (sent) {
    return (
      <div className="mt-7 flex gap-3 rounded-md border border-line bg-white/[0.03] p-4 text-sm">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-orange" />
        <p className="text-fg-2">
          Te mandamos un link a <strong className="font-medium text-fg">{email}</strong>. Abrilo desde este mismo navegador para entrar.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-7 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
        });
        setLoading(false);
        if (error) setError("No pudimos mandar el link. Revisá el mail y probá de nuevo.");
        else setSent(true);
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-fg-2">Mail</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@88records.com"
          className="h-10 w-full rounded-md border border-line-strong bg-ink-3/80 px-3 text-sm placeholder:text-fg-3 focus:border-orange/60 focus:outline-none"
        />
      </label>
      {error && <p className="text-xs text-bad">{error}</p>}
      <Button type="submit" variant="primary" loading={loading} className="h-10 w-full" icon={<ArrowRight className="size-4" />}>
        Entrar con link al mail
      </Button>
      <p className="text-xs text-fg-3">Solo entran las personas del sello habilitadas.</p>
    </form>
  );
}
