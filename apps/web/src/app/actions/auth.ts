"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { str } from "@/lib/form";
import { SESSION_COOKIE, SESSION_DAYS, createToken, safeEqual } from "@/lib/session";

export async function login(_prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { error: "La contraseña no está configurada en el servidor." };

  // Freno simple contra prueba y error.
  await new Promise((r) => setTimeout(r, 400));
  if (!(await safeEqual(str(fd, "password"), expected))) return { error: "Contraseña incorrecta." };

  (await cookies()).set(SESSION_COOKIE, await createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });

  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
