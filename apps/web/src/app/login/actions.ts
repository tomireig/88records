"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, supabaseServer } from "@/lib/supabase";
import { createTeamToken, safeEqual, TEAM_COOKIE, TEAM_DAYS } from "@/lib/team-session";

export async function loginWithPassword(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const expected = process.env.APP_PASSWORD;
  const given = String(form.get("password") ?? "");
  if (!expected || !given || !(await safeEqual(given, expected))) {
    // Un respiro chico ante intentos repetidos.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Esa contraseña no es." };
  }
  (await cookies()).set(TEAM_COOKIE, await createTeamToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEAM_DAYS * 86_400,
  });
  redirect("/calendario");
}

export async function logout(): Promise<void> {
  const mode = authMode();
  if (mode === "password") (await cookies()).delete(TEAM_COOKIE);
  if (mode === "supabase") await (await supabaseServer()).auth.signOut();
  redirect("/login");
}
