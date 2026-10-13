// Vuelta del link mágico de Supabase: canjea el code por la sesión y entra al panel.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured, supabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const home = new URL("/calendario", req.url);
  if (!supabaseConfigured() || !code) return NextResponse.redirect(home);
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=link", req.url));
  return NextResponse.redirect(home);
}
