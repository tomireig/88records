import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TEAM_COOKIE, verifyTeamToken } from "@/lib/team-session";

const PUBLIC = ["/login", "/auth/", "/api/files/", "/privacidad", "/terminos"];

function toLogin(request: NextRequest) {
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  const isPublic = PUBLIC.some((p) => request.nextUrl.pathname.startsWith(p));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Contraseña de equipo mientras no haya Supabase.
    if (process.env.APP_PASSWORD) {
      if (isPublic || (await verifyTeamToken(request.cookies.get(TEAM_COOKIE)?.value))) return NextResponse.next();
      return toLogin(request);
    }
    if (process.env.NODE_ENV === "production" && !isPublic) {
      return new NextResponse(
        "Falta configurar el acceso: cargá APP_PASSWORD (contraseña de equipo) o las claves de Supabase en Vercel.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }
    return NextResponse.next();
  }

  // Refresca la sesión de Supabase en cada request (patrón oficial de @supabase/ssr).
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && !isPublic) return toLogin(request);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
